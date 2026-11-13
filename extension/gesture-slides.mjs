export class GestureSlides {
  constructor(session, slides, onChange = () => {}) {
    this.session = session;
    this.slides = slides;
    this.onChange = onChange;
    this.epoch = 0;
    this.starting = false;
    session.onCommand = (command) => {
      void this.navigate(command);
    };
    session.onChange = (view) => {
      if (
        (!view.controls.enabled && this.starting) ||
        (view.controls.paused && !slides.state.paused)
      )
        this.pause();
      this.onChange();
    };
    slides.onChange = (view) => {
      if (view.paused && !session.paused) session.pause();
      this.onChange();
    };
  }

  pause(message) {
    this.epoch++;
    this.starting = false;
    this.slides.pause(message);
    this.session.pause();
  }

  async toggle() {
    if (!this.session.paused || this.starting) {
      this.pause();
      return false;
    }
    if (this.session.blockReason() || !this.slides.state.connected)
      return false;
    const epoch = this.epoch;
    this.starting = true;
    const ready = await this.slides.resume();
    if (epoch !== this.epoch) return false;
    if (!ready || this.session.blockReason() || !this.slides.state.connected) {
      this.pause(this.slides.state.message);
      return false;
    }
    this.starting = false;
    return this.session.toggleControls();
  }

  async navigate(command) {
    if (
      this.session.paused ||
      this.session.blockReason() ||
      !['next', 'previous'].includes(command)
    )
      return false;
    const epoch = this.epoch;
    this.session.gate.reset();
    const changed = await this.slides.navigate(command);
    if (epoch !== this.epoch) return false;
    if (!changed && !this.session.paused) this.pause(this.slides.state.message);
    return changed;
  }

  dispose() {
    this.onChange = () => {};
    this.pause();
    this.session.onCommand = null;
    this.session.onChange = () => {};
    this.slides.onChange = () => {};
  }
}
