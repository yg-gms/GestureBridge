import test from 'node:test';
import assert from 'node:assert/strict';
import {
  euclideanDistance,
  predictPose,
  acceptedLabel,
  cleanPoseClip,
} from '../classifier.mjs';

const pose = (value) => Array(42).fill(value);
const examples = ['next', 'previous', 'neutral'].flatMap((label, index) =>
  Array.from({ length: 5 }, () => ({ label, vector: pose(index * 2) })),
);

test('clip cleaning removes a stray pose without changing the captured input', () => {
  const samples = [...Array.from({ length: 14 }, () => pose(0)), pose(1)];
  const before = structuredClone(samples);
  const result = cleanPoseClip(samples);
  assert.equal(result.samples.length, 14);
  assert.equal(result.removed, 1);
  assert.ok(
    result.samples.every((sample) => sample.every((value) => value === 0)),
  );
  assert.deepEqual(samples, before);
});

test('clip cleaning preserves normal variation and small jitter when MAD is zero', () => {
  for (const samples of [
    Array.from({ length: 15 }, (_, index) => pose((index - 7) * 0.01)),
    [...Array.from({ length: 14 }, () => pose(0)), pose(0.001)],
  ]) {
    const result = cleanPoseClip(samples);
    assert.equal(result.removed, 0);
    assert.equal(result.samples.length, 15);
  }
});

test('clip cleaning refuses incomplete, invalid and overflowing samples', () => {
  for (const samples of [
    null,
    [],
    Array(15),
    Array(14).fill(pose(0)),
    Array(15).fill(pose(NaN)),
    Array(15).fill([0]),
    Array(15).fill(Array(42)),
    [...Array(14).fill(pose(0)), pose(1e200)],
  ]) {
    assert.equal(cleanPoseClip(samples), null);
  }
});

test('removing a mislabeled sample can stop an accidental pose passing the distance cutoff', () => {
  const next = [...Array.from({ length: 14 }, () => pose(0)), pose(1)];
  const otherLabels = examples.filter((example) => example.label !== 'next');
  const unfiltered = [
    ...next.map((vector) => ({ label: 'next', vector })),
    ...otherLabels,
  ];
  assert.equal(acceptedLabel(predictPose(pose(1), unfiltered), 6), 'next');
  const filtered = [
    ...cleanPoseClip(next).samples.map((vector) => ({ label: 'next', vector })),
    ...otherLabels,
  ];
  assert.equal(acceptedLabel(predictPose(pose(1), filtered), 6), null);
});

test('invalid or incomplete training cannot produce a prediction', () => {
  for (const data of [
    [],
    null,
    examples.slice(0, 10),
    [...examples, { label: 'other', vector: pose(0) }],
    [...examples, { label: 'next', vector: pose(NaN) }],
    [...examples, { label: 'next', vector: [0] }],
  ]) {
    assert.equal(predictPose(pose(0), data), null);
  }
});

test('invalid tracking cannot produce a prediction', () => {
  for (const vector of [
    null,
    [],
    pose(NaN),
    pose(Infinity),
    Array(41).fill(0),
  ]) {
    assert.equal(predictPose(vector, examples), null);
  }
});

test('invalid distance inputs do not produce a finite comparison', () => {
  for (const [a, b] of [
    [[], []],
    [[0], [0, 1]],
    [[NaN], [0]],
    [null, [0]],
  ]) {
    assert.equal(euclideanDistance(a, b), null);
  }
});

test('distance measures separation across coordinates', () => {
  assert.equal(euclideanDistance([0, 0], [3, 4]), 5);
  assert.equal(euclideanDistance([3, 4], [0, 0]), 5);
  assert.equal(euclideanDistance([2, -3], [2, -3]), 0);
  assert.equal(euclideanDistance([1, 2, 3], [1, 2, 5]), 2);
});

test('fresh poses match each of the three recorded labels', () => {
  for (const [index, label] of ['next', 'previous', 'neutral'].entries()) {
    const result = predictPose(pose(index * 2 + 0.01), examples);
    assert.equal(result.label, label);
    assert.equal(result.votes, 5);
    assert.equal(result.agreement, 1);
    assert.ok(Math.abs(result.distance - Math.sqrt(42) * 0.01) < 1e-10);
  }
});

test('the nearest five vote even when the single closest example disagrees', () => {
  const training = [
    { label: 'previous', vector: pose(0) },
    ...Array.from({ length: 4 }, () => ({ label: 'next', vector: pose(0.01) })),
    ...examples.map((example) => ({ ...example, vector: pose(10) })),
  ];
  const before = structuredClone(training);
  const result = predictPose(pose(0), training);
  assert.equal(result.label, 'next');
  assert.equal(result.votes, 4);
  assert.equal(result.agreement, 0.8);
  assert.deepEqual(training, before);
});

test('a split vote stays uncertain', () => {
  const training = [
    ...['next', 'next', 'next', 'previous', 'previous'].map((label) => ({
      label,
      vector: pose(0),
    })),
    ...examples.map((example) => ({ ...example, vector: pose(10) })),
  ];
  const result = predictPose(pose(0), training);
  assert.equal(result.label, null);
  assert.equal(result.votes, 3);
  assert.equal(result.agreement, 0.6);
});

test('agreement alone does not establish that a pose is familiar', () => {
  const result = predictPose(pose(100), examples);
  assert.equal(result.votes, 5);
  assert.ok(result.distance > 100);
});
