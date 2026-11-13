import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraPermissionReady } from '../extension/camera-permission.mjs';

test('ungranted camera permission opens setup rather than requesting inside the panel', async () => {
  const opened = [];
  const api = {
    runtime: { getURL: (path) => `chrome-extension://test/${path}` },
    tabs: { create: async (tab) => opened.push(tab) },
  };
  for (const state of ['prompt', 'denied']) {
    assert.equal(
      await cameraPermissionReady(api, { query: async () => ({ state }) }),
      false,
    );
  }
  assert.equal(opened.length, 2);
  assert.equal(opened[0].url, 'chrome-extension://test/extension/camera.html');
  assert.equal(
    await cameraPermissionReady(api, {
      query: async () => ({ state: 'granted' }),
    }),
    true,
  );
  assert.equal(opened.length, 2);
});
