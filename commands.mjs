export class CommandGate {
  constructor() { this.reset(); }

  reset() {
    this.armed = false;
    this.pending = null;
    this.lastTime = null;
  }

  update(label, now) {
    if (!Number.isFinite(now)) {
      this.reset();
      return null;
    }
    // At roughly 10 Hz, a gap over 300 ms cannot establish a continuous hold.
    if (this.lastTime !== null && (now < this.lastTime || now - this.lastTime > 300)) this.reset();
    this.lastTime = now;
    if (!['next', 'previous', 'neutral'].includes(label) ||
        (this.armed ? label === 'neutral' : label !== 'neutral')) {
      this.pending = null;
      return null;
    }
    if (this.pending?.label !== label) this.pending = { label, since: now };
    if (now - this.pending.since < (label === 'neutral' ? 400 : 500)) return null;
    this.pending = null;
    this.armed = label === 'neutral';
    return this.armed ? null : label;
  }
}
