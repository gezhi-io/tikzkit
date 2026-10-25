// Compare physical browser strokes after translation to the red terminal leads.
// Native and JS may group subpaths differently; neither image is resized to fit.
export async function captureTubeStrokes(page) {
  return page.evaluate(() => {
    const paths = [...document.querySelectorAll("svg path")].filter(p => !p.closest("defs,clipPath"));
    const leads = paths.filter(p => getComputedStyle(p).stroke === "rgb(255, 0, 0)");
    if (!leads.length) throw new Error("Expected red terminal leads for the tube frame");
    const boxes = leads.map(p => p.getBoundingClientRect());
    const origin = { x: Math.min(...boxes.map(b => b.x)), y: Math.min(...boxes.map(b => b.y)) };
    return paths.flatMap(path => {
      const style = getComputedStyle(path);
      if (style.stroke === "none") return [];
      const matrix = path.getScreenCTM();
      const scale = Math.hypot(matrix.a, matrix.b);
      if (Math.abs(scale - Math.hypot(matrix.c, matrix.d)) > .001) throw new Error("Anisotropic audit transform");
      const length = path.getTotalLength();
      const count = Math.max(1, Math.ceil(length * scale / .08));
      const points = Array.from({ length: count + 1 }, (_, i) => {
        const p = path.getPointAtLength(length * i / count).matrixTransform(matrix);
        return { x: p.x - origin.x, y: p.y - origin.y };
      });
      return [{ points, stroke: style.stroke, cap: style.strokeLinecap, join: style.strokeLinejoin,
        width: parseFloat(style.strokeWidth) * scale,
        dash: style.strokeDasharray === "none" ? [] : style.strokeDasharray.match(/[\d.]+/g).map(n => Number(n) * scale) }];
    });
  });
}

export function compareTubeStrokes(actual, reference, tolerancePx = .12) {
  const signature = p => JSON.stringify([p.stroke, p.cap, p.join, p.dash.length]);
  const index = paths => {
    const buckets = new Map();
    for (const path of paths) for (const point of path.points) {
      const key = `${signature(path)}:${Math.floor(point.x)},${Math.floor(point.y)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ point, path });
    }
    return buckets;
  };
  let maxErrorPx = 0, unmatchedSamples = 0, styleErrors = 0, samples = 0;
  for (const [from, to] of [[actual, reference], [reference, actual]]) {
    const buckets = index(to);
    for (const path of from) for (const point of path.points) {
      samples++;
      let distance = Infinity, nearest;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const key = `${signature(path)}:${Math.floor(point.x) + dx},${Math.floor(point.y) + dy}`;
        for (const candidate of buckets.get(key) || []) {
          const d = Math.hypot(point.x - candidate.point.x, point.y - candidate.point.y);
          if (d < distance) { distance = d; nearest = candidate.path; }
        }
      }
      if (!nearest) { unmatchedSamples++; continue; }
      maxErrorPx = Math.max(maxErrorPx, distance);
      if (Math.abs(path.width - nearest.width) > tolerancePx ||
          path.dash.some((value, i) => Math.abs(value - nearest.dash[i]) > tolerancePx)) styleErrors++;
    }
  }
  return { maxErrorPx, unmatchedSamples, styleErrors, samples, tolerancePx,
    accepted: samples > 0 && actual.length > 0 && reference.length > 0 &&
      unmatchedSamples === 0 && styleErrors === 0 && maxErrorPx < tolerancePx };
}
