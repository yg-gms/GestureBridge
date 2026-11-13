import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCoordinates, normalizePose } from '../features.mjs';
import { acceptedLabel, predictPose } from '../classifier.mjs';

const hand = Array.from({ length: 21 }, (_, index) => ({
  x: 0.4 + ((index % 4) - 1.5) * 0.03,
  y: 0.7 - Math.floor(index / 4) * 0.06,
}));
hand[0] = { x: 0.4, y: 0.8 };
hand[9] = { x: 0.4, y: 0.6 };

function rotate(points, degrees, width = 640, height = 480) {
  const angle = (degrees * Math.PI) / 180;
  const wrist = points[0];
  return points.map((point) => {
    const x = (point.x - wrist.x) * width;
    const y = (point.y - wrist.y) * height;
    return {
      x: wrist.x + (x * Math.cos(angle) - y * Math.sin(angle)) / width,
      y: wrist.y + (x * Math.sin(angle) + y * Math.cos(angle)) / height,
    };
  });
}

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

test('a 20–30 degree sideways tilt produces the same pose vector', () => {
  const expected = normalizePose(hand, 640, 480);
  for (const angle of [-30, -20, 20, 30]) {
    const actual = normalizePose(rotate(hand, angle), 640, 480);
    assert.equal(actual.length, 42);
    for (let index = 0; index < expected.length; index++) {
      assert.ok(
        Math.abs(actual[index] - expected[index]) < 1e-10,
        `rotation ${angle}, coordinate ${index}`,
      );
    }
  }
});

test('rotation alignment preserves differences in finger shape', () => {
  const changed = hand.map((point) => ({ ...point }));
  changed[4].x += 0.07;
  const original = normalizePose(hand, 640, 480);
  const different = normalizePose(rotate(changed, 30), 640, 480);
  assert.ok(Math.abs(original[8] - different[8]) > 0.1);
});

test('the classifier accepts a trained finger shape after a modest tilt', () => {
  const examples = ['next', 'previous', 'neutral'].flatMap((label, index) => {
    const points = hand.map((point) => ({ ...point }));
    points[4].x += index * 0.08;
    return Array.from({ length: 5 }, () => ({
      label,
      vector: normalizePose(points, 640, 480),
    }));
  });
  for (const angle of [-30, -20, 20, 30]) {
    const prediction = predictPose(
      normalizePose(rotate(hand, angle), 640, 480),
      examples,
    );
    assert.equal(acceptedLabel(prediction, 0.01), 'next');
  }
});
