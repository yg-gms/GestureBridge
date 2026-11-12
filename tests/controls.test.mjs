import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizePose } from '../features.mjs';
import { LABELS, PoseRecorder } from '../recording.mjs';
import { euclideanDistance, predictPose, acceptedLabel } from '../classifier.mjs';
import { CALIBRATION_STEPS, CalibrationSession } from '../calibration.mjs';
import { CommandGate } from '../commands.mjs';

function page() {
  let now = 0;
  const element = () => ({
    disabled: false, textContent: '', hidden: false, listeners: {},
    addEventListener(type, callback) { this.listeners[type] = callback; },
    append() {}, getContext() { return { clearRect() {}, beginPath() {}, arc() {}, fill() {} }; },
  });
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, element()]));
  const slides = Array.from({ length: 6 }, element);
  const document = {
    hidden: false, listeners: {},
    getElementById: id => elements[id],
    querySelectorAll: () => slides,
    createElement: element,
    addEventListener(type, callback) { this.listeners[type] = callback; },
  };
  const context = vm.createContext({
    document, console: { log() {}, error(error) { throw error; } }, performance: { now: () => now },
    clearTimeout, setTimeout: () => 0,
    normalizePose, LABELS, PoseRecorder, euclideanDistance, predictPose, acceptedLabel,
    CALIBRATION_STEPS, CalibrationSession, CommandGate,
  });
  // Supply real local imports while running the browser entry in a small DOM fixture.
  const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '').replace('import.meta.env.BASE_URL', '"/"');
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  run('calibration.result = { cutoff: 1 }; video.srcObject = { getTracks: () => [] }; renderRecording();');
  const frame = (landmarks, time) => {
    now = time;
    context.testLandmarks = landmarks;
    run('video.readyState = 2; video.currentTime = (video.currentTime || 0) + 1; handLandmarker = { detectForVideo: () => ({ landmarks: testLandmarks }) }; detectHands();');
  };
  return { elements, document, slides, run, frame };
}

test('fresh tracked poses reach the classifier, gate and slide viewer', () => {
  const { elements, run, frame } = page();
  const poses = [0, 1, 2].map(pose => Array.from({ length: 21 }, (_, index) => ({
    x: 0.2 + index * 0.005 + (index > 10 ? pose * 0.1 : 0),
    y: 0.2 + index * 0.01,
  })));
  run('video.videoWidth = 640; video.videoHeight = 480;');
  const examples = ['next', 'previous', 'neutral'].flatMap((label, index) =>
    Array.from({ length: 5 }, () => ({ label, vector: normalizePose(poses[index], 640, 480) })));
  run(`recorder.examples = ${JSON.stringify(examples)}; recorder.clips = { next: 3, previous: 3, neutral: 3 };`);
  elements['toggle-controls'].listeners.click();
  for (let time = 0; time <= 400; time += 100) frame([poses[2]], time);
  assert.equal(run('commandGate.armed'), true);
  for (let time = 500; time <= 1500; time += 100) frame([poses[0]], time);
  assert.equal(elements['slide-position'].textContent, 'Slide 2 of 6');
  for (let time = 1600; time <= 2000; time += 100) frame([poses[2]], time);
  for (let time = 2100; time <= 2600; time += 100) frame([poses[1]], time);
  assert.equal(elements['slide-position'].textContent, 'Slide 1 of 6');
});

test('stopping a calibrated camera disables gesture controls and updates instructions', () => {
  const { elements, run } = page();
  assert.equal(elements['toggle-controls'].disabled, false);
  run('handleStopClick();');
  assert.equal(elements['toggle-controls'].disabled, true);
  assert.match(elements['command-status'].textContent, /start the camera/);
});

test('disabled gesture controls explain missing training, unfinished calibration and failure', () => {
  const { elements, run } = page();
  run('calibration.reset(); renderRecording();');
  assert.equal(elements['toggle-controls'].disabled, true);
  assert.match(elements['command-status'].textContent, /Record three clips/);
  run('recorder.clips = { next: 3, previous: 3, neutral: 3 }; renderRecording();');
  assert.match(elements['command-status'].textContent, /Complete calibration.*0\/5/);
  run('calibration.captures = [[], []]; renderRecording();');
  assert.match(elements['command-status'].textContent, /Complete calibration.*2\/5/);
  run('calibration.result = { cutoff: null, reason: "overlap" }; renderRecording();');
  assert.match(elements['command-status'].textContent, /Calibration failed.*Restart calibration/);
});

test('the final successful calibration capture enables the gesture controls button', () => {
  const { elements, run, frame } = page();
  const poses = [0, 1, 2, 3, 4].map(pose => Array.from({ length: 21 }, (_, index) => ({
    x: 0.2 + index * 0.005 + (index > 10 ? pose * 0.1 : 0),
    y: 0.2 + index * 0.01,
  })));
  const examples = ['next', 'previous', 'neutral'].flatMap((label, index) =>
    Array.from({ length: 5 }, () => ({ label, vector: normalizePose(poses[index], 640, 480) })));
  run(`video.videoWidth = 640; video.videoHeight = 480; calibration.reset(); recorder.examples = ${JSON.stringify(examples)}; recorder.clips = { next: 3, previous: 3, neutral: 3 };`);
  for (let step = 0; step < 5; step++) {
    const start = step * 2300;
    frame([poses[step]], start);
    assert.equal(elements['toggle-controls'].disabled, true);
    elements['capture-calibration'].listeners.click();
    for (let time = 100; time <= 2100; time += 100) frame([poses[step]], start + time);
  }
  assert.equal(elements['toggle-controls'].disabled, false);
  assert.equal(run('controlsPaused'), true);
  elements['toggle-controls'].listeners.click();
  assert.equal(run('controlsPaused'), false);
  assert.equal(run('slideIndex'), 0);
});

test('Escape and hidden tab pause controls; resuming requires Neutral again', () => {
  for (const interruption of ['escape', 'hidden']) {
    const { elements, document, run } = page();
    elements['toggle-controls'].listeners.click();
    run('commandGate.update("neutral", 0); commandGate.update("neutral", 200); commandGate.update("neutral", 400); commandGate.update("next", 500);');
    if (interruption === 'escape') document.listeners.keydown({ key: 'Escape' });
    else {
      document.hidden = true;
      document.listeners.visibilitychange();
      document.hidden = false;
      run('renderRecording();');
    }
    assert.equal(run('controlsPaused'), true);
    assert.equal(run('commandGate.pending'), null);
    elements['toggle-controls'].listeners.click();
    assert.equal(run('controlsPaused'), false);
    assert.equal(run('commandGate.armed'), false);
    assert.equal(run('commandGate.update("next", 1000)'), null);
  }
});

test('manual slide navigation stays bounded at the first and sixth slides', () => {
  const { elements, slides } = page();
  for (let i = 0; i < 10; i++) elements['next-slide'].listeners.click();
  assert.equal(elements['slide-position'].textContent, 'Slide 6 of 6');
  assert.equal(elements['next-slide'].disabled, true);
  assert.equal(slides.filter(slide => !slide.hidden).length, 1);
  for (let i = 0; i < 10; i++) elements['previous-slide'].listeners.click();
  assert.equal(elements['slide-position'].textContent, 'Slide 1 of 6');
  assert.equal(elements['previous-slide'].disabled, true);
});
