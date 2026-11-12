import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera } from '../camera.mjs';
import { GestureSession } from '../session.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function fixture(overrides = {}) {
  let stopped = 0;
  const track = { stop() { stopped++; }, addEventListener() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const video = { srcObject: null, readyState: 0, play: async () => {} };
  const canvas = { width: 0, height: 0, getContext: () => ({ clearRect() {} }) };
  const session = new GestureSession();
  const camera = createCamera({ video, canvas, session,
    loadModel: async () => ({ close() {} }), getUserMedia: async () => stream, ...overrides });
  return { camera, session, video, stream, stopped: () => stopped };
}

test('camera requests video only and stopping releases all media tracks', async () => {
  const { camera, session, video, stopped } = fixture();
  assert.equal(await camera.start(), true);
  assert.equal(session.snapshot().camera.running, true);
  assert.notEqual(video.srcObject, null);
  camera.stop();
  assert.equal(stopped(), 1);
  assert.equal(video.srcObject, null);
  assert.equal(session.snapshot().camera.running, false);
  assert.equal(session.snapshot().controls.paused, true);
});

test('stopping during model loading prevents a late camera request', async () => {
  const model = deferred();
  let requests = 0;
  const { camera, session } = fixture({ loadModel: () => model.promise,
    getUserMedia: async () => { requests++; throw new Error('should not request'); } });
  const start = camera.start();
  camera.stop();
  model.resolve({ close() {} });
  assert.equal(await start, false);
  assert.equal(requests, 0);
  assert.equal(session.snapshot().camera.loading, false);
});

test('an immediate stop and restart shares one pending model load', async () => {
  const model = deferred();
  let loads = 0;
  const { camera } = fixture({ loadModel: () => { loads++; return model.promise; } });
  const first = camera.start();
  camera.stop();
  const second = camera.start();
  assert.equal(loads, 1);
  model.resolve({ close() {} });
  assert.equal(await first, false);
  assert.equal(await second, true);
  camera.dispose();
});

test('stopping while camera access is pending releases a late stream', async () => {
  const media = deferred();
  const requested = deferred();
  const { camera, video, stream, stopped } = fixture({ getUserMedia: () => { requested.resolve(); return media.promise; } });
  const start = camera.start();
  await requested.promise;
  camera.stop();
  media.resolve(stream);
  assert.equal(await start, false);
  assert.equal(stopped(), 1);
  assert.equal(video.srcObject, null);
});

test('camera playback failure releases its stream and permits retry', async () => {
  const { camera, video, stopped, session } = fixture();
  video.play = async () => { throw new Error('playback failed'); };
  assert.equal(await camera.start(), false);
  assert.equal(stopped(), 1);
  assert.equal(session.snapshot().camera.loading, false);
  assert.match(session.snapshot().camera.message, /could not start/i);
  video.play = async () => {};
  assert.equal(await camera.start(), true);
  camera.dispose();
});
