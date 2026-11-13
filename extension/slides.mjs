import { runSlidesCommand } from './slides-page.mjs';

export function getSlidesTarget(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(
      /^\/presentation\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)\/(edit|present|preview)\/?$/,
    );
    if (
      url.origin !== 'https://docs.google.com' ||
      url.username ||
      url.password ||
      !match
    )
      return null;
    url.pathname = url.pathname.replace(
      /\/(edit|present|preview)\/?$/,
      '/present',
    );
    url.hash = '';
    return { deckId: match[1], mode: match[2], presentationUrl: url.href };
  } catch {
    return null;
  }
}

export class SlidesController {
  constructor({ api, onChange = () => {} }) {
    this.api = api;
    this.onChange = onChange;
    this.target = null;
    this.generation = 0;
    this.state = {
      connected: false,
      paused: true,
      busy: false,
      title: '',
      message:
        'Open a Google Slides deck, then use Open slideshow and Connect.',
    };
    this.activated = (info) => {
      if (
        this.target &&
        info.windowId === this.target.windowId &&
        info.tabId !== this.target.id
      )
        this.pause('Tab changed. Return to the presentation and resume.');
    };
    this.removed = (id) => {
      if (id === this.target?.id)
        this.disconnect('Presentation closed. Connect to another slideshow.');
    };
    this.updated = (id, change) => {
      if (id !== this.target?.id) return;
      const changed = change.url ? getSlidesTarget(change.url) : null;
      if (
        (change.status === 'loading' && !changed) ||
        (change.url &&
          (!changed ||
            changed.deckId !== this.target.deckId ||
            changed.mode === 'edit'))
      ) {
        this.disconnect(
          'Presentation changed or reloaded. Connect again when it is ready.',
        );
      }
    };
    this.focused = (id) => {
      if (this.target && id !== this.target.windowId)
        this.pause('Chrome lost focus. Return to the presentation and resume.');
    };
    api.tabs.onActivated.addListener(this.activated);
    api.tabs.onUpdated.addListener(this.updated);
    api.tabs.onRemoved.addListener(this.removed);
    api.windows.onFocusChanged.addListener(this.focused);
  }

  snapshot() {
    return { ...this.state };
  }
  emit() {
    this.onChange(this.snapshot());
  }
  pause(message = 'Paused. Resume when the presentation is ready.') {
    this.generation++;
    this.state = { ...this.state, paused: true, busy: false, message };
    this.emit();
  }
  disconnect(message) {
    this.target = null;
    this.state.connected = false;
    this.state.title = '';
    this.pause(message);
  }

  async inject(command, target, expiresAt) {
    const results = await this.api.scripting.executeScript({
      target: { tabId: target.id },
      func: runSlidesCommand,
      args: [{ command, deckId: target.deckId, expiresAt }],
    });
    const result = results.find((item) => item.frameId === 0)?.result;
    if (!result || result.ok !== true)
      throw new Error(
        result?.message || 'The slideshow did not respond. Connect again.',
      );
    return result;
  }

  async connect() {
    if (this.state.busy) return false;
    this.disconnect('Checking the current tab…');
    const generation = this.generation;
    this.state.busy = true;
    this.emit();
    try {
      const [tab] = await this.api.tabs.query({
        active: true,
        currentWindow: true,
      });
      const deck = getSlidesTarget(tab?.url);
      if (!deck || !Number.isInteger(tab.id))
        throw new Error(
          'Open Google Slides and click the extension icon in that tab, then connect.',
        );
      if (deck.mode === 'edit')
        throw new Error(
          'Use Open slideshow first, wait for it to load, then connect.',
        );
      if (generation !== this.generation) return false;
      const target = {
        id: tab.id,
        windowId: tab.windowId,
        deckId: deck.deckId,
      };
      await this.inject('probe', target, Date.now() + 1000);
      if (generation !== this.generation) return false;
      this.target = target;
      this.state = {
        connected: true,
        paused: true,
        busy: false,
        title: tab.title || 'Google Slides',
        message: 'Connected. Start gesture controls when you are ready.',
      };
      this.emit();
      return true;
    } catch (error) {
      if (generation === this.generation) this.disconnect(error.message);
      return false;
    }
  }

  async openSlideshow() {
    if (this.state.busy) return false;
    this.disconnect('Opening the slideshow…');
    const generation = this.generation;
    this.state.busy = true;
    this.emit();
    try {
      const [tab] = await this.api.tabs.query({
        active: true,
        currentWindow: true,
      });
      const deck = getSlidesTarget(tab?.url);
      if (!deck)
        throw new Error(
          'Open a Google Slides deck and click the extension icon there first.',
        );
      if (generation !== this.generation) return false;
      await this.api.tabs.update(tab.id, { url: deck.presentationUrl });
      if (generation !== this.generation) return false;
      this.state.busy = false;
      this.state.message =
        'Slideshow opened. Wait for it to load, then click Connect.';
      this.emit();
      return true;
    } catch (error) {
      if (generation === this.generation) this.disconnect(error.message);
      return false;
    }
  }

  async activeTarget() {
    const target = this.target;
    if (!target) throw new Error('Connect to a slideshow first.');
    const [[tab], window] = await Promise.all([
      this.api.tabs.query({ active: true, currentWindow: true }),
      this.api.windows.get(target.windowId),
    ]);
    const deck = getSlidesTarget(tab?.url);
    if (
      tab?.id !== target.id ||
      !window.focused ||
      !deck ||
      deck.deckId !== target.deckId ||
      deck.mode === 'edit'
    ) {
      throw new Error(
        'The selected slideshow is not active. Return to it, connect and resume.',
      );
    }
    return target;
  }

  async resume() {
    if (!this.target || this.state.busy) return false;
    const generation = this.generation;
    this.state.busy = true;
    this.emit();
    try {
      const target = await this.activeTarget();
      if (generation !== this.generation) return false;
      await this.inject('probe', target, Date.now() + 1000);
      if (generation !== this.generation) return false;
      this.state = {
        ...this.state,
        busy: false,
        paused: false,
        message: 'Slides controls enabled.',
      };
      this.emit();
      return true;
    } catch (error) {
      if (generation === this.generation) this.pause(error.message);
      return false;
    }
  }

  async navigate(command) {
    if (
      !['next', 'previous'].includes(command) ||
      !this.target ||
      this.state.paused ||
      this.state.busy
    )
      return false;
    const generation = this.generation;
    const expiresAt = Date.now() + 1000;
    this.state.busy = true;
    this.emit();
    try {
      const target = await this.activeTarget();
      if (generation !== this.generation) return false;
      await this.inject(command, target, expiresAt);
      if (generation !== this.generation) return false;
      this.state = {
        ...this.state,
        busy: false,
        message: `${command === 'next' ? 'Next' : 'Previous'} slide change confirmed.`,
      };
      this.emit();
      return true;
    } catch (error) {
      if (generation === this.generation) this.pause(error.message);
      return false;
    }
  }

  dispose() {
    this.api.tabs.onActivated.removeListener(this.activated);
    this.api.tabs.onUpdated.removeListener(this.updated);
    this.api.tabs.onRemoved.removeListener(this.removed);
    this.api.windows.onFocusChanged.removeListener(this.focused);
    this.target = null;
    this.pause();
  }
}
