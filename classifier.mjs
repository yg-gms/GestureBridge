import { LABELS } from './recording.mjs';

export function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length ||
      !a.every(Number.isFinite) || !b.every(Number.isFinite)) return null;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

const validPose = vector => Array.isArray(vector) && vector.length === 42 && vector.every(Number.isFinite);

export function predictPose(vector, examples) {
  if (!validPose(vector) || !Array.isArray(examples) ||
      !examples.every(example => example && LABELS.includes(example.label) && validPose(example.vector)) ||
      !LABELS.every(label => examples.filter(example => example.label === label).length >= 5)) return null;

  const distances = examples.map(example => ({
    label: example.label,
    distance: euclideanDistance(vector, example.vector),
  }));
  if (distances.some(example => !Number.isFinite(example.distance) || example.distance < 0)) return null;

  const nearest = distances.sort((a, b) => a.distance - b.distance).slice(0, 5);
  const votes = LABELS.map(label => ({ label, count: nearest.filter(example => example.label === label).length }));
  const winner = votes.sort((a, b) => b.count - a.count)[0];
  return {
    label: winner.count >= 4 ? winner.label : null,
    votes: winner.count,
    agreement: winner.count / 5,
    distance: nearest.reduce((sum, example) => sum + example.distance, 0) / 5,
  };
}
