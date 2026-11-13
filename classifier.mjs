import { LABELS } from './labels.mjs';

export function euclideanDistance(a, b) {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length === 0 ||
    a.length !== b.length ||
    !a.every(Number.isFinite) ||
    !b.every(Number.isFinite)
  )
    return null;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

const validPose = (vector) =>
  Array.isArray(vector) &&
  vector.length === 42 &&
  vector.every(Number.isFinite);

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function cleanPoseClip(samples) {
  if (
    !Array.isArray(samples) ||
    samples.length !== 15 ||
    !Array.from(samples).every(validPose)
  )
    return null;
  const distances = samples.map((sample) =>
    samples.map((other) => euclideanDistance(sample, other)),
  );
  if (!distances.flat().every(Number.isFinite)) return null;
  const totals = distances.map((row) =>
    row.reduce((sum, distance) => sum + distance, 0),
  );
  const fromCenter = distances[totals.indexOf(Math.min(...totals))];
  const typical = median(fromCenter);
  const mad = median(
    fromCenter.map((distance) => Math.abs(distance - typical)),
  );
  // shortcut: 0.1 is an initial jitter allowance; tune it using fresh physical trials.
  const cutoff = typical + Math.max(3 * 1.4826 * mad, 0.1);
  const kept = samples.filter((_, index) => fromCenter[index] <= cutoff);
  return { samples: kept, removed: samples.length - kept.length };
}

export function predictPose(vector, examples) {
  if (
    !validPose(vector) ||
    !Array.isArray(examples) ||
    !examples.every(
      (example) =>
        example && LABELS.includes(example.label) && validPose(example.vector),
    ) ||
    !LABELS.every(
      (label) =>
        examples.filter((example) => example.label === label).length >= 5,
    )
  )
    return null;

  const distances = examples.map((example) => ({
    label: example.label,
    distance: euclideanDistance(vector, example.vector),
  }));
  if (
    distances.some(
      (example) => !Number.isFinite(example.distance) || example.distance < 0,
    )
  )
    return null;

  const nearest = distances.sort((a, b) => a.distance - b.distance).slice(0, 5);
  const votes = LABELS.map((label) => ({
    label,
    count: nearest.filter((example) => example.label === label).length,
  }));
  const winner = votes.sort((a, b) => b.count - a.count)[0];
  return {
    label: winner.count >= 4 ? winner.label : null,
    votes: winner.count,
    agreement: winner.count / 5,
    distance: nearest.reduce((sum, example) => sum + example.distance, 0) / 5,
  };
}

export function acceptedLabel(prediction, cutoff) {
  if (
    !prediction ||
    !Number.isFinite(cutoff) ||
    cutoff < 0 ||
    !LABELS.includes(prediction.label) ||
    !Number.isInteger(prediction.votes) ||
    prediction.votes < 4 ||
    prediction.votes > 5 ||
    !Number.isFinite(prediction.distance) ||
    prediction.distance < 0 ||
    prediction.distance > cutoff
  )
    return null;
  return prediction.label;
}
