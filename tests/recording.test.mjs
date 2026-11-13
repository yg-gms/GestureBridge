import test from 'node:test';
import assert from 'node:assert/strict';
import { PoseRecorder } from '../recording.mjs';

const vector = Array(42).fill(0.5);
function finish(recorder, start = 0) {
  for (let t = start; t <= start + 3000; t += 100) recorder.add(vector, t);
}

test('records 15 independent copies per completed clip, at roughly 5 Hz', () => {
  const recorder = new PoseRecorder();
  recorder.start('next', 0);
  finish(recorder);
  assert.equal(recorder.clips.next, 1);
  assert.equal(recorder.examples.length, 15);
  vector[0] = 99;
  assert.equal(recorder.examples[0].vector[0], 0.5);
  vector[0] = 0.5;
  assert.equal(recorder.active, null);
});
test('cancellation discards only the incomplete clip', () => {
  const recorder = new PoseRecorder();
  recorder.start('next', 0);
  finish(recorder);
  recorder.start('neutral', 4000);
  recorder.add(vector, 4000);
  recorder.cancel();
  assert.equal(recorder.examples.length, 15);
  assert.equal(recorder.clips.neutral, 0);
});
test('three separate clips required and reset affects only its label', () => {
  const recorder = new PoseRecorder();
  for (let t = 0; t < 12000; t += 4000) {
    recorder.start('next', t);
    finish(recorder, t);
  }
  assert.equal(recorder.examples.length, 45);
  assert.equal(recorder.start('next', 13000), false);
  recorder.start('neutral', 14000);
  finish(recorder, 14000);
  recorder.reset('next');
  assert.equal(recorder.examples.length, 15);
  assert.equal(recorder.examples[0].label, 'neutral');
  assert.equal(recorder.clips.next, 0);
});
test('invalid vectors cancel the incomplete capture', () => {
  for (const invalid of [null, [], Array(42).fill(NaN)]) {
    const recorder = new PoseRecorder();
    recorder.start('next', 0);
    recorder.add(vector, 0);
    recorder.add(invalid, 200);
    assert.equal(recorder.active, null);
    assert.equal(recorder.examples.length, 0);
  }
});
test('does not accept unknown labels or overlapping captures', () => {
  const recorder = new PoseRecorder();
  assert.equal(recorder.start('invalid', 0), false);
  assert.equal(recorder.start('next', 0), true);
  assert.equal(recorder.start('previous', 0), false);
});
test('a delayed frame cannot commit an undersampled clip', () => {
  const recorder = new PoseRecorder();
  recorder.start('next', 0);
  recorder.add(vector, 0);
  recorder.add(vector, 3100);
  assert.equal(recorder.clips.next, 0);
  assert.equal(recorder.examples.length, 0);
  assert.equal(recorder.active, null);
});
test('ordinary detection timing jitter still captures a complete 3-second clip', () => {
  const recorder = new PoseRecorder();
  recorder.start('next', 0);
  for (let t = 100; t <= 3100; t += 120) recorder.add(vector, t);
  assert.equal(recorder.clips.next, 1);
  assert.equal(recorder.examples.length, 15);
});

function recordSamples(recorder, values, start = 0) {
  assert.equal(recorder.start('next', start), true);
  values.forEach((value, index) =>
    recorder.add(Array(42).fill(value), start + index * 200),
  );
  return recorder.add(Array(42).fill(values.at(-1)), start + 3000);
}

test('completed clips save only their consistent samples and report the removed count', () => {
  for (const removed of [1, 3]) {
    const recorder = new PoseRecorder();
    const outcome = recordSamples(recorder, [
      ...Array(15 - removed).fill(0),
      ...Array(removed).fill(1),
    ]);
    assert.equal(outcome.status, 'saved');
    assert.equal(outcome.removed, removed);
    assert.equal(recorder.clips.next, 1);
    assert.equal(recorder.examples.length, 15 - removed);
    assert.ok(
      recorder.examples.every((example) =>
        example.vector.every((value) => value === 0),
      ),
    );
  }
});

test('clips with too many inconsistent samples request a retake and preserve earlier clips', () => {
  for (const inconsistent of [4, 7]) {
    const recorder = new PoseRecorder();
    recordSamples(recorder, Array(15).fill(0));
    const before = structuredClone(recorder.examples);
    const outcome = recordSamples(
      recorder,
      [...Array(15 - inconsistent).fill(0), ...Array(inconsistent).fill(1)],
      4000,
    );
    assert.equal(outcome.status, 'retry');
    assert.equal(outcome.reason, 'unstable');
    assert.equal(recorder.clips.next, 1);
    assert.deepEqual(recorder.examples, before);
    assert.equal(recorder.active, null);
  }
});

test('cleaning each clip separately keeps variation between consistent recordings', () => {
  const recorder = new PoseRecorder();
  for (const [index, value] of [0, 0.1, 0.2].entries()) {
    recordSamples(recorder, Array(15).fill(value), index * 4000);
  }
  assert.equal(recorder.clips.next, 3);
  assert.equal(recorder.examples.length, 45);
  assert.deepEqual(
    [...new Set(recorder.examples.map((example) => example.vector[0]))],
    [0, 0.1, 0.2],
  );
});
