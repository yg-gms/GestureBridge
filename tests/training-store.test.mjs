import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureSession } from '../session.mjs';
import { TrainingStore } from '../extension/training-store.mjs';

test('local setup restores partial training and excludes calibration and running state', async () => {
  const source = new GestureSession();
  source.recorder.clips.next = 1;
  source.recorder.examples = Array.from({ length: 12 }, () => ({
    label: 'next',
    vector: Array(42).fill(0),
  }));
  const session = new GestureSession();
  const store = new TrainingStore(session, {
    get: async () => ({ training: source.exportTraining() }),
  });
  assert.equal(await store.load(), true);
  assert.equal(session.recorder.clips.next, 1);
  assert.equal(session.paused, true);
  assert.equal(session.calibrated, false);
});

test('corrupt or unreadable storage reports failure without overwriting it', async () => {
  for (const get of [
    async () => ({ training: { version: 0 } }),
    async () => {
      throw new Error('unavailable');
    },
  ]) {
    const store = new TrainingStore(new GestureSession(), { get });
    assert.equal(await store.load(), false);
    assert.equal(store.status.error, true);
    assert.equal(store.status.action, 'load');
  }
});

test('writes are ordered so a reset wins over a pending earlier save', async () => {
  const session = new GestureSession();
  let release;
  const writes = [];
  const store = new TrainingStore(session, {
    set: async (value) => {
      writes.push(value.training);
      if (writes.length === 1)
        await new Promise((resolve) => {
          release = resolve;
        });
    },
  });
  session.recorder.clips.next = 1;
  session.recorder.examples = Array.from({ length: 12 }, () => ({
    label: 'next',
    vector: Array(42).fill(0),
  }));
  const first = store.save();
  await Promise.resolve();
  session.resetTraining();
  const last = store.save();
  assert.equal(writes.length, 1);
  release();
  await Promise.all([first, last]);
  assert.equal(writes[0].clips.next, 1);
  assert.equal(writes[1].examples.length, 0);
  assert.equal(store.status.error, false);
});

test('a failed save stays visible and can be retried', async () => {
  let fails = true;
  const store = new TrainingStore(new GestureSession(), {
    set: async () => {
      if (fails) throw new Error('full');
    },
  });
  assert.equal(await store.save(), false);
  assert.equal(store.status.error, true);
  assert.equal(store.status.action, 'save');
  fails = false;
  assert.equal(await store.save(), true);
  assert.equal(store.status.error, false);
});
