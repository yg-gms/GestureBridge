import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureSession } from '../session.mjs';
import { GestureSlides } from '../extension/gesture-slides.mjs';

const poses = [0, 1, 2, 3, 4].map((pose) =>
  Array.from({ length: 21 }, (_, index) => ({
    x: 0.2 + index * 0.005 + (index > 10 ? pose * 0.1 : 0),
    y: 0.2 + index * 0.01,
  })),
);

function fixture() {
  let now = 0;
  const session = new GestureSession({ now: () => now });
  session.setCameraState({
    running: true,
    loading: false,
    message: 'Camera ready.',
  });
  const frame = (pose, count = 1) => {
    now += 100;
    session.track(
      Array.from({ length: count }, () => poses[pose]),
      640,
      480,
      now,
    );
  };
  const hold = (pose, frames) => {
    for (let i = 0; i < frames; i++) frame(pose);
  };
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
  assert.deepEqual(session.snapshot().clips, {
    next: 3,
    previous: 3,
    neutral: 3,
  });
  assert.equal(session.snapshot().step, 'calibrate');
  assert.equal(session.snapshot().controls.enabled, false);
});

test('choosing another pose keeps it selected until its three clips are recorded', () => {
  const { session, frame, hold } = fixture();
  session.selectLabel('neutral');
  frame(2);
  session.record();
  hold(2, 31);
  assert.equal(session.snapshot().selectedLabel, 'neutral');
  assert.equal(session.snapshot().clips.neutral, 1);
});

test('slow tracking keeps recording progress below complete until enough samples arrive', () => {
  let now = 0;
  const session = new GestureSession({ now: () => now });
  session.setCameraState({ running: true });
  session.track([poses[0]], 640, 480);
  assert.equal(session.record(), true);
  for (now = 300; now <= 3000; now += 300) session.track([poses[0]], 640, 480);
  const view = session.snapshot();
  assert.equal(view.busy, true);
  assert.ok(view.capture.progress < 100);
  for (now = 3300; now <= 4800; now += 300) session.track([poses[0]], 640, 480);
  assert.equal(session.snapshot().clips.next, 1);
  assert.equal(session.snapshot().busy, false);
  assert.equal(
    new GestureSession().restoreTraining(session.exportTraining()),
    true,
  );
});

test('recording reports a removed accidental pose without adding it to training', () => {
  const { session, frame } = fixture();
  frame(0);
  session.record();
  for (let index = 1; index <= 31; index++) frame(index === 6 ? 1 : 0);
  assert.equal(session.snapshot().clips.next, 1);
  assert.match(session.snapshot().message, /ignored 1 unusual sample/i);
  assert.equal(session.recorder.examples.length, 14);
});

test('a mixed recording requests a retake without losing saved progress', () => {
  const { session, frame, hold } = fixture();
  frame(0);
  session.record();
  hold(0, 31);
  session.record();
  for (let index = 1; index <= 31; index++) frame(index <= 14 ? 1 : 0);
  assert.equal(session.snapshot().clips.next, 1);
  assert.match(session.snapshot().message, /pose changed too much/i);
  assert.equal(session.snapshot().step, 'teach');
  assert.equal(session.snapshot().busy, false);
  assert.equal(session.recorder.examples.length, 15);
});

test('successful fresh calibration opens presentation paused and enables its start button', () => {
  const { session, train, calibrate } = fixture();
  train();
  calibrate();
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
  train();
  calibrate([0, 1, 2, 0, 1]);
  assert.equal(session.snapshot().step, 'calibrate');
  assert.match(session.snapshot().message, /overlap/i);
  assert.equal(session.goToStep('present'), false);
  assert.equal(session.toggleControls(), false);
  session.restartCalibration();
  assert.equal(session.snapshot().calibration.count, 0);
});

test('tracked Neutral and commands move one slide until Neutral rearms', () => {
  const { session, hold, train, calibrate } = fixture();
  train();
  calibrate();
  session.toggleControls();
  hold(0, 10);
  assert.equal(session.snapshot().slideIndex, 0);
  hold(2, 5);
  hold(0, 15);
  assert.equal(session.snapshot().slideIndex, 1);
  hold(2, 5);
  hold(1, 6);
  assert.equal(session.snapshot().slideIndex, 0);
});

test('leaving presentation pauses without deleting the trained profile', () => {
  const { session, hold, train, calibrate } = fixture();
  train();
  calibrate();
  session.toggleControls();
  hold(2, 5);
  assert.equal(session.snapshot().controls.started, true);
  assert.equal(session.goToStep('teach'), true);
  hold(0, 10);
  assert.equal(session.snapshot().slideIndex, 0);
  assert.equal(session.snapshot().controls.paused, true);
  assert.equal(session.snapshot().calibration.ready, true);
  session.goToStep('present');
  session.toggleControls();
  hold(0, 10);
  assert.equal(session.snapshot().slideIndex, 0);
});

test('retaking one label invalidates calibration while preserving the other labels', () => {
  const { session, train, calibrate } = fixture();
  train();
  calibrate();
  session.resetLabel('previous');
  const view = session.snapshot();
  assert.equal(view.step, 'teach');
  assert.equal(view.selectedLabel, 'previous');
  assert.deepEqual(view.clips, { next: 3, previous: 0, neutral: 3 });
  assert.equal(view.calibration.ready, false);
  assert.equal(view.controls.paused, true);
});

test('tracking interruptions discard only the unfinished capture', () => {
  const { session, frame, hold } = fixture();
  frame(0);
  session.record();
  hold(0, 31);
  session.record();
  hold(0, 5);
  frame(0, 2);
  assert.equal(session.snapshot().clips.next, 1);
  assert.equal(session.snapshot().busy, false);
  assert.equal(session.snapshot().hand.ready, false);
  assert.match(session.snapshot().message, /discarded/i);
});

test('hidden tab and camera stop pause controls and require Neutral on resume', () => {
  for (const interruption of ['hidden', 'camera']) {
    const { session, hold, train, calibrate } = fixture();
    train();
    calibrate();
    session.toggleControls();
    hold(2, 5);
    hold(0, 4);
    if (interruption === 'hidden') {
      session.setHidden(true);
      session.setHidden(false);
    } else
      session.setCameraState({
        running: false,
        loading: false,
        message: 'Camera off.',
      });
    assert.equal(session.snapshot().controls.paused, true);
    if (interruption === 'camera') {
      assert.equal(session.snapshot().controls.enabled, false);
      session.setCameraState({
        running: true,
        loading: false,
        message: 'Camera ready.',
      });
    }
    session.toggleControls();
    hold(0, 10);
    assert.equal(session.snapshot().slideIndex, 0);
  }
});

test('pause cancels pending holds and manual navigation remains bounded', () => {
  const { session, hold, train, calibrate } = fixture();
  train();
  calibrate();
  session.toggleControls();
  hold(2, 5);
  hold(0, 4);
  session.pause();
  hold(0, 10);
  assert.equal(session.snapshot().slideIndex, 0);
  for (let i = 0; i < 10; i++) session.changeSlide('next');
  assert.equal(session.snapshot().slideIndex, 5);
  for (let i = 0; i < 10; i++) session.changeSlide('previous');
  assert.equal(session.snapshot().slideIndex, 0);
});

test('an external command adapter receives gated commands without moving the demo deck', () => {
  const { session, hold, train, calibrate } = fixture();
  const commands = [];
  session.onCommand = (command) => commands.push(command);
  train();
  calibrate();
  session.toggleControls();
  hold(0, 10);
  assert.deepEqual(commands, []);
  hold(2, 5);
  hold(0, 15);
  hold(2, 5);
  hold(1, 10);
  assert.deepEqual(commands, ['next', 'previous']);
  assert.equal(session.slideIndex, 0);
});

test('saved training restores copied poses with fresh calibration and disarmed controls', () => {
  const { session, train, calibrate } = fixture();
  train();
  calibrate();
  session.toggleControls();
  const saved = session.exportTraining();
  const restored = new GestureSession();
  assert.equal(restored.restoreTraining(saved), true);
  assert.equal(restored.trained, true);
  assert.equal(restored.step, 'calibrate');
  assert.equal(restored.calibrated, false);
  assert.equal(restored.paused, true);
  assert.equal(restored.gate.armed, false);
  assert.equal(restored.camera.running, false);
  saved.examples[0].vector[0] = 99;
  assert.equal(restored.recorder.examples[0].vector[0], 0);
  assert.equal('calibration' in saved, false);
});

test('invalid or incompatible saved training never replaces current examples', () => {
  const { session, train } = fixture();
  train();
  const valid = session.exportTraining();
  for (const corrupt of [
    null,
    { ...valid, version: 0 },
    { ...valid, features: 'older-normalization' },
    { ...valid, examples: valid.examples.slice(0, 1) },
    { ...valid, clips: { ...valid.clips, next: 4 } },
    {
      ...valid,
      examples: [{ label: 'next', vector: Array(42).fill(Infinity) }],
    },
  ]) {
    assert.equal(session.restoreTraining(corrupt), false);
    assert.deepEqual(session.exportTraining(), valid);
  }
});

test('only completed training changes trigger saving, including retake and reset', () => {
  const { session, frame, hold } = fixture();
  let changes = 0;
  session.onTrainingChange = () => changes++;
  frame(0);
  session.record();
  hold(0, 5);
  assert.equal(changes, 0);
  hold(0, 26);
  assert.equal(changes, 1);
  session.resetLabel('next');
  assert.equal(changes, 2);
  session.resetTraining();
  assert.equal(changes, 3);
  assert.equal(session.recorder.examples.length, 0);
  assert.equal(session.calibrated, false);
  assert.equal(session.paused, true);
});

function connectedSlides() {
  return {
    state: { connected: true, paused: true, busy: false, message: '' },
    onChange: () => {},
    sent: [],
    pause(message = 'Paused') {
      this.state.paused = true;
      this.state.message = message;
      this.onChange(this.state);
    },
    async resume() {
      this.state.paused = false;
      this.onChange(this.state);
      return true;
    },
    async navigate(command) {
      this.sent.push(command);
      return true;
    },
  };
}

test('trained gestures control the external deck once and target loss cancels a pending hold', async () => {
  const { session, hold, train, calibrate } = fixture();
  const slides = connectedSlides();
  const bridge = new GestureSlides(session, slides);
  assert.equal(await bridge.toggle(), false);
  train();
  calibrate();
  assert.equal(await bridge.toggle(), true);
  hold(0, 10);
  assert.deepEqual(slides.sent, []);
  hold(2, 5);
  hold(0, 15);
  assert.deepEqual(slides.sent, ['next']);
  await Promise.resolve();
  hold(2, 5);
  hold(1, 4);
  slides.pause('Target lost');
  hold(1, 10);
  assert.equal(session.paused, true);
  assert.deepEqual(slides.sent, ['next']);
  await bridge.toggle();
  hold(1, 10);
  assert.deepEqual(slides.sent, ['next']);
  hold(2, 5);
  hold(1, 6);
  assert.deepEqual(slides.sent, ['next', 'previous']);
});

test('camera loss or an explicit pause during resume prevents late activation', async () => {
  for (const stop of ['pause', 'camera']) {
    const { session, train, calibrate } = fixture();
    train();
    calibrate();
    const slides = connectedSlides();
    let release;
    slides.resume = () =>
      new Promise((resolve) => {
        release = () => {
          resolve(true);
        };
      });
    const bridge = new GestureSlides(session, slides);
    const pending = bridge.toggle();
    if (stop === 'pause') bridge.pause();
    else session.setCameraState({ running: false });
    release();
    assert.equal(await pending, false);
    assert.equal(session.paused, true);
    assert.equal(slides.state.paused, true);
  }
});

test('a stale resume or failed command cannot pause a newly started control session', async () => {
  const { session, train, calibrate } = fixture();
  train();
  calibrate();
  const slides = connectedSlides();
  const bridge = new GestureSlides(session, slides);
  let release;
  slides.resume = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const oldStart = bridge.toggle();
  bridge.pause();
  slides.resume = async () => {
    slides.state.paused = false;
    slides.onChange(slides.state);
    return true;
  };
  await bridge.toggle();
  release(false);
  await oldStart;
  assert.equal(session.paused, false);
  let fail;
  slides.navigate = () =>
    new Promise((resolve) => {
      fail = resolve;
    });
  const oldCommand = bridge.navigate('next');
  bridge.pause();
  await bridge.toggle();
  fail(false);
  await oldCommand;
  assert.equal(session.paused, false);
});

test('manual navigation clears the hold and navigation failure pauses recognition', async () => {
  const { session, hold, train, calibrate } = fixture();
  train();
  calibrate();
  const slides = connectedSlides();
  const bridge = new GestureSlides(session, slides);
  await bridge.toggle();
  hold(2, 5);
  hold(0, 4);
  await bridge.navigate('previous');
  hold(0, 10);
  assert.deepEqual(slides.sent, ['previous']);
  slides.navigate = async () => {
    slides.pause('No change confirmed');
    return false;
  };
  hold(2, 5);
  hold(0, 6);
  await Promise.resolve();
  assert.equal(session.paused, true);
  assert.equal(slides.state.message, 'No change confirmed');
});
