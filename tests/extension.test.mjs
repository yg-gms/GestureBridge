import test from 'node:test';
import assert from 'node:assert/strict';
import { SlidesController, getSlidesTarget } from '../extension/slides.mjs';

function event() {
  const listeners = new Set();
  return {
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
    emit: (...args) => listeners.forEach((fn) => fn(...args)),
    get size() {
      return listeners.size;
    },
  };
}

function fixture() {
  let active = {
    id: 7,
    windowId: 2,
    url: 'https://docs.google.com/presentation/d/deck_1/present#slide=id.p1',
    title: 'Test deck',
  };
  let focused = true;
  let result = { ok: true, slide: 'id.p2' };
  const sent = [];
  const api = {
    tabs: {
      query: async () => [active],
      update: async (id, update) => {
        active = { ...active, ...update };
      },
      onActivated: event(),
      onUpdated: event(),
      onRemoved: event(),
    },
    windows: { get: async () => ({ id: 2, focused }), onFocusChanged: event() },
    scripting: {
      executeScript: async (options) => {
        sent.push(options);
        return [{ frameId: 0, result }];
      },
    },
  };
  const controller = new SlidesController({ api });
  return {
    controller,
    api,
    sent,
    setActive: (value) => {
      active = value;
    },
    setFocused: (value) => {
      focused = value;
    },
    setResult: (value) => {
      result = value;
    },
  };
}

test('only standard HTTPS Google Slides decks are accepted', () => {
  for (const url of [
    'https://docs.google.com/presentation/d/deck_1/edit#slide=id.p1',
    'https://docs.google.com/presentation/u/0/d/deck_1/preview',
  ]) {
    const target = getSlidesTarget(url);
    assert.equal(target.deckId, 'deck_1');
    assert.ok(target.presentationUrl.endsWith('/present'));
  }
  for (const url of [
    'https://docs.google.com.evil.test/presentation/d/a/present',
    'http://docs.google.com/presentation/d/a/present',
    'https://docs.google.com/document/d/a/edit',
    'https://docs.google.com/presentation/d/e/a/pub',
    'garbage',
    null,
  ]) {
    assert.equal(getSlidesTarget(url), null);
  }
});

test('connect starts paused and only explicit resume enables commands', async () => {
  const { controller, sent } = fixture();
  assert.equal(await controller.connect(), true);
  assert.equal(controller.snapshot().paused, true);
  assert.equal(await controller.navigate('next'), false);
  assert.equal(sent.length, 1);
  assert.equal(await controller.resume(), true);
  assert.equal(await controller.navigate('next'), true);
  assert.equal(sent.at(-1).target.tabId, 7);
  assert.equal(sent.at(-1).args[0].command, 'next');
  assert.equal(sent.at(-1).args[0].deckId, 'deck_1');
  assert.equal(typeof sent.at(-1).func, 'function');
});

test('editor mode requires opening the slideshow before connecting', async () => {
  const { controller, setActive, sent } = fixture();
  setActive({
    id: 7,
    windowId: 2,
    url: 'https://docs.google.com/presentation/d/deck_1/edit',
    title: 'Test deck',
  });
  assert.equal(await controller.connect(), false);
  assert.equal(sent.length, 0);
  assert.match(controller.snapshot().message, /open slideshow/i);
  assert.equal(await controller.openSlideshow(), true);
  assert.equal(controller.snapshot().paused, true);
  assert.equal(await controller.connect(), true);
});

test('switching tabs, closing the target and losing focus pause control', async () => {
  for (const kind of ['tab', 'close', 'window', 'navigate']) {
    const { controller, api } = fixture();
    await controller.connect();
    await controller.resume();
    if (kind === 'tab') api.tabs.onActivated.emit({ tabId: 8, windowId: 2 });
    if (kind === 'close') api.tabs.onRemoved.emit(7);
    if (kind === 'window') api.windows.onFocusChanged.emit(-1);
    if (kind === 'navigate')
      api.tabs.onUpdated.emit(7, { status: 'loading' }, {});
    assert.equal(controller.snapshot().paused, true);
    assert.equal(await controller.navigate('next'), false);
  }
});

test('an active-tab change is checked again before injection even if no event arrives', async () => {
  const { controller, setActive, sent } = fixture();
  await controller.connect();
  await controller.resume();
  const before = sent.length;
  setActive({
    id: 8,
    windowId: 2,
    url: 'https://docs.google.com/presentation/d/deck_2/present',
  });
  assert.equal(await controller.navigate('next'), false);
  assert.equal(sent.length, before);
  assert.equal(controller.snapshot().paused, true);
});

test('unfocused Chrome and changed decks cannot receive a command', async () => {
  for (const kind of ['focus', 'deck']) {
    const { controller, setFocused, setActive, sent } = fixture();
    await controller.connect();
    await controller.resume();
    const before = sent.length;
    if (kind === 'focus') setFocused(false);
    else
      setActive({
        id: 7,
        windowId: 2,
        url: 'https://docs.google.com/presentation/d/other/present',
      });
    assert.equal(await controller.navigate('previous'), false);
    assert.equal(sent.length, before);
  }
});

test('an unconfirmed command pauses and does not claim navigation succeeded', async () => {
  const { controller, setResult } = fixture();
  await controller.connect();
  await controller.resume();
  setResult({ ok: false, message: 'No slide change was observed.' });
  assert.equal(await controller.navigate('next'), false);
  assert.equal(controller.snapshot().paused, true);
  assert.match(controller.snapshot().message, /No slide change/);
});

test('duplicate clicks are not queued and pausing prevents a late result from resuming', async () => {
  const { controller, api } = fixture();
  await controller.connect();
  await controller.resume();
  let release;
  api.scripting.executeScript = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const first = controller.navigate('next');
  for (let i = 0; i < 5 && !release; i++) await Promise.resolve();
  assert.equal(await controller.navigate('next'), false);
  controller.pause();
  release([{ frameId: 0, result: { ok: true } }]);
  assert.equal(await first, false);
  assert.equal(controller.snapshot().paused, true);
});

test('hash changes during navigation do not disconnect a bound deck', async () => {
  const { controller, api } = fixture();
  await controller.connect();
  await controller.resume();
  api.tabs.onUpdated.emit(
    7,
    {
      url: 'https://docs.google.com/presentation/d/deck_1/present#slide=id.p2',
    },
    {},
  );
  assert.equal(controller.snapshot().paused, false);
  controller.dispose();
  assert.equal(api.tabs.onActivated.size, 0);
  assert.equal(api.windows.onFocusChanged.size, 0);
});

test('a slide query update with loading status keeps the connected deck', async () => {
  const { controller, api } = fixture();
  await controller.connect();
  await controller.resume();
  api.tabs.onUpdated.emit(7, {
    status: 'loading',
    url: 'https://docs.google.com/presentation/d/deck_1/present?slide=id.p2',
  });
  assert.equal(controller.snapshot().connected, true);
  assert.equal(controller.snapshot().paused, false);
});
