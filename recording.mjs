export const LABELS = ['next', 'previous', 'neutral'];

export class PoseRecorder {
  examples = [];
  clips = { next: 0, previous: 0, neutral: 0 };
  active = null;

  start(label, now) {
    if (!LABELS.includes(label) || this.active || this.clips[label] >= 3) return false;
    this.active = { label, start: now, last: -Infinity, samples: [] };
    return true;
  }

  add(vector, now) {
    const clip = this.active;
    if (!clip) return;
    if (!Array.isArray(vector) || vector.length !== 42 || !vector.every(Number.isFinite)) {
      this.cancel();
      return;
    }
    if (now - clip.start >= 3000) {
      if (clip.samples.length === 15) {
        this.examples.push(...clip.samples.map(vector => ({ label: clip.label, vector })));
        this.clips[clip.label]++;
      }
      this.cancel();
      return;
    }
    if (now - clip.start >= clip.samples.length * 200 &&
        now - clip.last >= 100 && clip.samples.length < 15) {
      clip.samples.push([...vector]);
      clip.last = now;
    }
  }

  cancel() { this.active = null; }

  reset(label) {
    if (!LABELS.includes(label)) return;
    this.cancel();
    this.examples = this.examples.filter(example => example.label !== label);
    this.clips[label] = 0;
  }
}
