
export function normalizeCoordinates(point, wrist, scale) {
  return [(point.x - wrist.x) / scale, (point.y - wrist.y) / scale];
}

export function normalizePose(landmarks, width, height) {
  if (!Array.isArray(landmarks) || landmarks.length !== 21 ||
      !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
      !landmarks.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;

  // Convert both axes to the same units before measuring hand size.
  const points = landmarks.map(p => ({ x: p.x * width, y: p.y * height }));
  const wrist = points[0];
  const middleBase = points[9];
  const scale = Math.hypot(middleBase.x - wrist.x, middleBase.y - wrist.y);
  if (scale < 0.000001) return null;

  const vector = [];
  for (const point of points) {
    const pair = normalizeCoordinates(point, wrist, scale);
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(Number.isFinite)) return null;
    vector.push(...pair);
  }
  return vector;
}
