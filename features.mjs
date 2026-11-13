export function normalizeCoordinates(point, wrist, scale) {
  return [(point.x - wrist.x) / scale, (point.y - wrist.y) / scale];
}

export function normalizePose(landmarks, width, height) {
  if (
    !Array.isArray(landmarks) ||
    landmarks.length !== 21 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !landmarks.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
  )
    return null;

  // Convert both axes to the same units before measuring hand size.
  const points = landmarks.map((p) => ({ x: p.x * width, y: p.y * height }));
  const wrist = points[0];
  const middleBase = points[9];
  const scale = Math.hypot(middleBase.x - wrist.x, middleBase.y - wrist.y);
  if (scale < 0.000001) return null;

  const axisX = (middleBase.x - wrist.x) / scale;
  const axisY = (middleBase.y - wrist.y) / scale;
  const vector = [0, 0];
  for (const point of points.slice(1)) {
    const pair = normalizeCoordinates(point, wrist, scale);
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      !pair.every(Number.isFinite)
    )
      return null;
    // Align the palm direction upright while preserving the finger shape.
    vector.push(
      -pair[0] * axisY + pair[1] * axisX,
      -pair[0] * axisX - pair[1] * axisY,
    );
  }
  return vector;
}
