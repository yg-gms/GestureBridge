import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCoordinates, normalizePose } from '../features.mjs';

test('invalid tracking results never become examples', () => {
  assert.equal(normalizePose([], 640, 480), null);
  assert.equal(
    normalizePose(Array(21).fill({ x: 0.5, y: 0.5 }), 640, 480),
    null,
  );
  assert.equal(normalizePose(Array(21).fill({ x: NaN, y: 0 }), 640, 480), null);
  assert.equal(normalizePose(Array(21).fill({ x: 0, y: 0 }), 0, 480), null);
});

test('normalization removes position and scale while respecting image aspect ratio', () => {
  assert.deepEqual(
    normalizeCoordinates({ x: 6, y: 8 }, { x: 2, y: 2 }, 2),
    [2, 3],
  );
  const points = Array.from({ length: 21 }, (_, i) => ({
    x: 0.2 + i * 0.01,
    y: 0.3 + i * 0.005,
  }));
  const a = normalizePose(points, 640, 480);
  const b = normalizePose(
    points.map((p) => ({ x: p.x * 1.5 + 0.1, y: p.y * 1.5 - 0.2 })),
    640,
    480,
  );
  const c = normalizePose(
    points.map((p) => ({ x: p.x / 2, y: p.y })),
    1280,
    480,
  );
  assert.equal(a.length, 42);
  assert.deepEqual(a.slice(0, 2), [0, 0]);
  for (let i = 0; i < 42; i++) {
    assert.ok(
      Math.abs(a[i] - b[i]) < 1e-10,
      'same pose after translation and resizing',
    );
    assert.ok(
      Math.abs(a[i] - c[i]) < 1e-10,
      'same pixel geometry with a wider image',
    );
  }
});
