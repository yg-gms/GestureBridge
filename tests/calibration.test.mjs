import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrationCutoff, CalibrationSession } from '../calibration.mjs';
import { acceptedLabel } from '../classifier.mjs';

const pose = value => Array(42).fill(value);
const examples = ['next', 'previous', 'neutral'].flatMap((label, index) =>
  Array.from({ length: 5 }, () => ({ label, vector: pose(index * 2) })));
const prediction = (label, distance, votes = 5) => ({ label, distance, votes });
const captures = () => ['next', 'previous', 'neutral', null, null].map((label, index) =>
  Array.from({ length: 10 }, () => prediction(label, index < 3 ? 1 : 5)));

test('fresh known and unrelated captures set a cutoff between their distances', () => {
  assert.deepEqual(calibrationCutoff(captures()), { cutoff: 3, reason: null });
});

test('overlapping known and unrelated distances cannot enable acceptance', () => {
  const data = captures();
  data[3] = data[3].map(() => prediction('next', 1));
  assert.deepEqual(calibrationCutoff(data), { cutoff: null, reason: 'overlap' });
});

test('incorrect or uncertain known poses require re-recording or retrying', () => {
  for (const bad of [prediction('previous', 1), prediction(null, 1, 3)]) {
    const data = captures();
    data[0][0] = bad;
    assert.deepEqual(calibrationCutoff(data), { cutoff: null, reason: 'known-poses' });
  }
});

test('incomplete and invalid calibration samples are refused', () => {
  for (const data of [null, [], captures().slice(0, 4),
    [...captures().slice(0, 4), []],
    captures().map(clip => clip.map(sample => ({ ...sample, distance: NaN })))]) {
    assert.deepEqual(calibrationCutoff(data), { cutoff: null, reason: 'incomplete' });
  }
});

test('cutoff uses percentile separation rather than one large unrelated outlier', () => {
  const data = captures();
  for (let i = 3; i < 5; i++) data[i] = data[i].map(() => prediction(null, 1));
  data[4][9].distance = 100;
  assert.equal(calibrationCutoff(data).reason, 'overlap');
});

test('cutoff interpolates the 95th known and 5th unrelated percentiles', () => {
  const data = captures();
  data.slice(0, 3).flat().forEach((sample, index) => { sample.distance = index; });
  data.slice(3).flat().forEach((sample, index) => { sample.distance = 40 + index; });
  assert.ok(Math.abs(calibrationCutoff(data).cutoff - 34.25) < 1e-10);
});

test('a label requires both a calibrated distance and four agreeing neighbours', () => {
  assert.equal(acceptedLabel(prediction('next', 1, 4), 1), 'next');
  assert.equal(acceptedLabel(prediction('neutral', 0), 1), 'neutral');
  for (const cutoff of [null, undefined, NaN, Infinity, -1]) {
    assert.equal(acceptedLabel(prediction('next', 0), cutoff), null);
  }
  for (const result of [null, prediction('next', 2), prediction('next', NaN),
    prediction('next', 0, 3), prediction(null, 0), prediction('other', 0)]) {
    assert.equal(acceptedLabel(result, 1), null);
  }
});

function finish(session, value, start) {
  assert.equal(session.start(start), true);
  let outcome;
  for (let time = start + 100; time <= start + 2100; time += 100) {
    const result = session.add(pose(value), examples, time);
    if (result) outcome = result;
  }
  return outcome;
}

test('five separate captures calibrate without adding samples to training', () => {
  const session = new CalibrationSession();
  const before = structuredClone(examples);
  for (const [index, value] of [0.01, 2.01, 4.01, 10, 12].entries()) {
    assert.equal(finish(session, value, index * 3000), index === 4 ? 'complete' : 'saved');
    assert.equal(session.captures[index].length, 10);
  }
  assert.ok(session.result.cutoff > Math.sqrt(42) * 0.01);
  assert.equal(session.result.reason, null);
  assert.equal(session.start(15000), false);
  assert.deepEqual(examples, before);
});

test('failed calibration never supplies a cutoff and requires a restart', () => {
  const session = new CalibrationSession();
  for (const [index, value] of [0, 2, 4, 0, 2].entries()) {
    assert.equal(finish(session, value, index * 3000), index === 4 ? 'failed' : 'saved');
  }
  assert.deepEqual(session.result, { cutoff: null, reason: 'overlap' });
  assert.equal(acceptedLabel(prediction('next', 0), session.result.cutoff), null);
  assert.equal(session.start(15000), false);
  session.reset();
  assert.equal(session.start(15000), true);
});

test('cancellation and slow tracking discard only the current calibration capture', () => {
  const session = new CalibrationSession();
  finish(session, 0, 0);
  session.start(3000);
  session.add(pose(2), examples, 3100);
  session.cancel();
  assert.equal(session.captures.length, 1);
  session.start(6000);
  session.add(pose(2), examples, 6100);
  assert.equal(session.add(pose(2), examples, 8100), 'retry');
  assert.equal(session.captures.length, 1);
  assert.equal(session.active, null);
});

test('invalid poses and overlapping captures are refused', () => {
  const session = new CalibrationSession();
  assert.equal(session.start(0), true);
  assert.equal(session.start(100), false);
  assert.equal(session.add([], examples, 200), 'retry');
  assert.equal(session.active, null);
  assert.equal(session.captures.length, 0);
});

test('reset invalidates an earlier cutoff and all calibration captures', () => {
  const session = new CalibrationSession();
  [0, 2, 4, 10, 12].forEach((value, index) => finish(session, value, index * 3000));
  assert.ok(Number.isFinite(session.result.cutoff));
  session.reset();
  assert.equal(session.result, null);
  assert.deepEqual(session.captures, []);
  assert.equal(session.active, null);
  assert.equal(session.start(15000), true);
});
