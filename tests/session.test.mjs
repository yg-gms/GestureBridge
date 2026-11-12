import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureSession } from '../session.mjs';

const poses = [0, 1, 2, 3, 4].map(pose => Array.from({ length: 21 }, (_, index) => ({
  x: 0.2 + index * 0.005 + (index > 10 ? pose * 0.1 : 0), y: 0.2 + index * 0.01,
})));

function fixture() {
  let now = 0;
  const session = new GestureSession({ now: () => now });
  session.setCameraState({ running: true, loading: false, message: 'Camera ready.' });
  const frame = (pose, count = 1) => {
    now += 100;
    session.track(Array.from({ length: count }, () => poses[pose]), 640, 480, now);
  };
  const hold = (pose, frames) => { for (let i = 0; i < frames; i++) frame(pose); };
  const train = () => {
    for (let pose = 0; pose < 3; pose++) {
      for (let clip = 0; clip < 3; clip++) {
        frame(pose);
        assert.equal(session.record(), true);
        hold(pose, 31);
      }
    }
  };
  const calibrate = (values = [0, 1, 2, 3, 4]) => {
    for (const pose of values) {
      frame(pose);
      assert.equal(session.captureCalibration(), true);
      hold(pose, 21);
    }
  };
  return { session, frame, hold, train, calibrate };
}

test('setup exposes only reachable stages and guides each label into calibration', () => {
  const { session, train } = fixture();
  assert.equal(session.goToStep('present'), false);
  assert.equal(session.goToStep('calibrate'), false);
  train();
  assert.deepEqual(session.snapshot().clips, { next: 3, previous: 3, neutral: 3 });
  assert.equal(session.snapshot().step, 'calibrate');
  assert.equal(session.snapshot().controls.enabled, false);
});

test('choosing another pose keeps it selected until its three clips are recorded', () => {
  const { session, frame, hold } = fixture();
  session.selectLabel('neutral');
  frame(2); session.record(); hold(2, 31);
  assert.equal(session.snapshot().selectedLabel, 'neutral');
  assert.equal(session.snapshot().clips.neutral, 1);
});

test('successful fresh calibration opens presentation paused and enables its start button', () => {
  const { session, train, calibrate } = fixture();
  train(); calibrate();
  const view = session.snapshot();
  assert.equal(view.step, 'present');
  assert.equal(view.calibration.count, 5);
  assert.equal(view.calibration.ready, true);
  assert.equal(view.controls.enabled, true);
  assert.equal(view.controls.paused, true);
  assert.equal(view.controls.started, false);
  assert.equal(view.slideIndex, 0);
});

test('overlap stays in calibration with an actionable failure instead of unlocking presentation', () => {
  const { session, train, calibrate } = fixture();
  train(); calibrate([0, 1, 2, 0, 1]);
  assert.equal(session.snapshot().step, 'calibrate');
  assert.match(session.snapshot().message, /overlap/i);
  assert.equal(session.goToStep('present'), false);
  assert.equal(session.toggleControls(), false);
  session.restartCalibration();
  assert.equal(session.snapshot().calibration.count, 0);
});

test('tracked Neutral and commands move one slide until Neutral rearms', () => {
  const { session, hold, train, calibrate } = fixture();
  train(); calibrate(); session.toggleControls();
  hold(0, 10);
  assert.equal(session.snapshot().slideIndex, 0);
  hold(2, 5); hold(0, 15);
  assert.equal(session.snapshot().slideIndex, 1);
  hold(2, 5); hold(1, 6);
  assert.equal(session.snapshot().slideIndex, 0);
});

test('leaving presentation pauses without deleting the trained profile', () => {
  const { session, hold, train, calibrate } = fixture();
  train(); calibrate(); session.toggleControls(); hold(2, 5);
  assert.equal(session.snapshot().controls.started, true);
  assert.equal(session.goToStep('teach'), true);
  hold(0, 10);
  assert.equal(session.snapshot().slideIndex, 0);
  assert.equal(session.snapshot().controls.paused, true);
  assert.equal(session.snapshot().calibration.ready, true);
  session.goToStep('present'); session.toggleControls(); hold(0, 10);
  assert.equal(session.snapshot().slideIndex, 0);
});

test('retaking one label invalidates calibration while preserving the other labels', () => {
  const { session, train, calibrate } = fixture();
  train(); calibrate(); session.resetLabel('previous');
  const view = session.snapshot();
  assert.equal(view.step, 'teach');
  assert.equal(view.selectedLabel, 'previous');
  assert.deepEqual(view.clips, { next: 3, previous: 0, neutral: 3 });
  assert.equal(view.calibration.ready, false);
  assert.equal(view.controls.paused, true);
});

test('tracking interruptions discard only the unfinished capture', () => {
  const { session, frame, hold } = fixture();
  frame(0); session.record(); hold(0, 31);
  session.record(); hold(0, 5); frame(0, 2);
  assert.equal(session.snapshot().clips.next, 1);
  assert.equal(session.snapshot().busy, false);
  assert.equal(session.snapshot().hand.ready, false);
  assert.match(session.snapshot().message, /discarded/i);
});

test('hidden tab and camera stop pause controls and require Neutral on resume', () => {
  for (const interruption of ['hidden', 'camera']) {
    const { session, hold, train, calibrate } = fixture();
    train(); calibrate(); session.toggleControls(); hold(2, 5); hold(0, 4);
    if (interruption === 'hidden') { session.setHidden(true); session.setHidden(false); }
    else session.setCameraState({ running: false, loading: false, message: 'Camera off.' });
    assert.equal(session.snapshot().controls.paused, true);
    if (interruption === 'camera') {
      assert.equal(session.snapshot().controls.enabled, false);
      session.setCameraState({ running: true, loading: false, message: 'Camera ready.' });
    }
    session.toggleControls(); hold(0, 10);
    assert.equal(session.snapshot().slideIndex, 0);
  }
});

test('pause cancels pending holds and manual navigation remains bounded', () => {
  const { session, hold, train, calibrate } = fixture();
  train(); calibrate(); session.toggleControls(); hold(2, 5); hold(0, 4);
  session.pause(); hold(0, 10);
  assert.equal(session.snapshot().slideIndex, 0);
  for (let i = 0; i < 10; i++) session.changeSlide('next');
  assert.equal(session.snapshot().slideIndex, 5);
  for (let i = 0; i < 10; i++) session.changeSlide('previous');
  assert.equal(session.snapshot().slideIndex, 0);
});
