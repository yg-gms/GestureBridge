import { LABELS } from './labels.mjs';
import { predictPose } from './classifier.mjs';

export const CALIBRATION_STEPS = [
  { label: 'next', name: 'Next', instruction: 'Show your trained Next pose.' },
  {
    label: 'previous',
    name: 'Previous',
    instruction: 'Show your trained Previous pose.',
  },
  {
    label: 'neutral',
    name: 'Neutral',
    instruction: 'Show your trained Neutral pose.',
  },
  {
    label: null,
    name: 'Unrelated pose 1',
    instruction: 'Show a different pose that you did not train.',
  },
  {
    label: null,
    name: 'Unrelated pose 2',
    instruction: 'Show another unrelated pose, different from the first.',
  },
];

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  return (
    sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower)
  );
}

export function calibrationCutoff(captures) {
  if (
    !Array.isArray(captures) ||
    captures.length !== 5 ||
    !captures.every(
      (clip) =>
        Array.isArray(clip) &&
        clip.length === 10 &&
        clip.every(
          (sample) =>
            sample && Number.isFinite(sample.distance) && sample.distance >= 0,
        ),
    )
  ) {
    return { cutoff: null, reason: 'incomplete' };
  }
  if (
    !LABELS.every((label, index) =>
      captures[index].every(
        (sample) =>
          sample.label === label &&
          Number.isInteger(sample.votes) &&
          sample.votes >= 4 &&
          sample.votes <= 5,
      ),
    )
  ) {
    return { cutoff: null, reason: 'known-poses' };
  }
  const knownLimit = percentile(
    captures
      .slice(0, 3)
      .flat()
      .map((sample) => sample.distance),
    0.95,
  );
  const unrelatedLimit = percentile(
    captures
      .slice(3)
      .flat()
      .map((sample) => sample.distance),
    0.05,
  );
  if (unrelatedLimit <= knownLimit) return { cutoff: null, reason: 'overlap' };
  return { cutoff: (knownLimit + unrelatedLimit) / 2, reason: null };
}

export class CalibrationSession {
  captures = [];
  active = null;
  result = null;

  start(now) {
    if (this.active || this.result || !Number.isFinite(now)) return false;
    this.active = { start: now, last: -Infinity, samples: [] };
    return true;
  }

  add(vector, examples, now) {
    const clip = this.active;
    if (!clip) return null;
    const prediction = predictPose(vector, examples);
    if (!prediction || !Number.isFinite(now) || now < clip.start) {
      this.cancel();
      return 'retry';
    }
    if (now - clip.start >= 2000) {
      this.cancel();
      if (clip.samples.length !== 10) return 'retry';
      this.captures.push(clip.samples);
      if (this.captures.length < 5) return 'saved';
      this.result = calibrationCutoff(this.captures);
      return this.result.cutoff === null ? 'failed' : 'complete';
    }
    if (
      now - clip.start >= clip.samples.length * 200 &&
      now - clip.last >= 100 &&
      clip.samples.length < 10
    ) {
      clip.samples.push(prediction);
      clip.last = now;
    }
    return null;
  }

  cancel() {
    this.active = null;
  }

  reset() {
    this.cancel();
    this.captures = [];
    this.result = null;
  }
}
