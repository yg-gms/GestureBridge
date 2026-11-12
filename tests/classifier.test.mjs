import test from 'node:test';
import assert from 'node:assert/strict';
import { euclideanDistance, predictPose } from '../classifier.mjs';

const pose = value => Array(42).fill(value);
const examples = ['next', 'previous', 'neutral'].flatMap((label, index) =>
  Array.from({ length: 5 }, () => ({ label, vector: pose(index * 2) })));

test('invalid or incomplete training cannot produce a prediction', () => {
  for (const data of [[], null, examples.slice(0, 10),
    [...examples, { label: 'other', vector: pose(0) }],
    [...examples, { label: 'next', vector: pose(NaN) }],
    [...examples, { label: 'next', vector: [0] }]]) {
    assert.equal(predictPose(pose(0), data), null);
  }
});

test('invalid tracking cannot produce a prediction', () => {
  for (const vector of [null, [], pose(NaN), pose(Infinity), Array(41).fill(0)]) {
    assert.equal(predictPose(vector, examples), null);
  }
});

test('invalid distance inputs do not produce a finite comparison', () => {
  for (const [a, b] of [[[], []], [[0], [0, 1]], [[NaN], [0]], [null, [0]]]) {
    assert.equal(euclideanDistance(a, b), null);
  }
});

const ready = euclideanDistance([0, 0], [3, 4]) !== null;
const learningTask = { skip: ready ? false : 'Learning task: complete euclideanDistance in classifier.mjs' };

test('distance measures separation across coordinates', learningTask, () => {
  assert.equal(euclideanDistance([0, 0], [3, 4]), 5);
  assert.equal(euclideanDistance([3, 4], [0, 0]), 5);
  assert.equal(euclideanDistance([2, -3], [2, -3]), 0);
  assert.equal(euclideanDistance([1, 2, 3], [1, 2, 5]), 2);
});

test('fresh poses match each of the three recorded labels', learningTask, () => {
  for (const [index, label] of ['next', 'previous', 'neutral'].entries()) {
    const result = predictPose(pose(index * 2 + 0.01), examples);
    assert.equal(result.label, label);
    assert.equal(result.votes, 5);
    assert.equal(result.agreement, 1);
    assert.ok(Math.abs(result.distance - Math.sqrt(42) * 0.01) < 1e-10);
  }
});

test('the nearest five vote even when the single closest example disagrees', learningTask, () => {
  const training = [
    { label: 'previous', vector: pose(0) },
    ...Array.from({ length: 4 }, () => ({ label: 'next', vector: pose(0.01) })),
    ...examples.map(example => ({ ...example, vector: pose(10) })),
  ];
  const before = structuredClone(training);
  const result = predictPose(pose(0), training);
  assert.equal(result.label, 'next');
  assert.equal(result.votes, 4);
  assert.equal(result.agreement, 0.8);
  assert.deepEqual(training, before);
});

test('a split vote stays uncertain', learningTask, () => {
  const training = [
    ...['next', 'next', 'next', 'previous', 'previous'].map(label => ({ label, vector: pose(0) })),
    ...examples.map(example => ({ ...example, vector: pose(10) })),
  ];
  const result = predictPose(pose(0), training);
  assert.equal(result.label, null);
  assert.equal(result.votes, 3);
  assert.equal(result.agreement, 0.6);
});

test('agreement alone does not establish that a pose is familiar', learningTask, () => {
  const result = predictPose(pose(100), examples);
  assert.equal(result.votes, 5);
  assert.ok(result.distance > 100);
});
