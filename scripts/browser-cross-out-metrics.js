export async function captureCrossOuts(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("svg").getBoundingClientRect();
    const crosses = [];
    for (const path of document.querySelectorAll("svg path")) {
      if (path.closest("defs")) continue;
      const d = path.getAttribute("d") || "";
      const line = /M\s*([-\d.e+]+)[ ,]+([-\d.e+]+)\s*L\s*([-\d.e+]+)[ ,]+([-\d.e+]+)/gi;
      const segments = [...d.matchAll(line)];
      if (segments.length !== 2 || d.replace(line, "").trim()) continue;
      const matrix = path.getScreenCTM();
      const points = segments.flatMap(m => [
        new DOMPoint(Number(m[1]), Number(m[2])).matrixTransform(matrix),
        new DOMPoint(Number(m[3]), Number(m[4])).matrixTransform(matrix)
      ]);
      const [a, b, c, e] = points;
      // Both diagonals must share a midpoint and span both dimensions.
      if (Math.hypot(a.x + b.x - c.x - e.x, a.y + b.y - c.y - e.y) > 0.05 ||
          Math.min(Math.abs(a.x - b.x), Math.abs(a.y - b.y),
            Math.abs(c.x - e.x), Math.abs(c.y - e.y)) < 1) continue;
      const style = getComputedStyle(path);
      const rgb = style.stroke.match(/[\d.]+/g)?.map(Number);
      if (!rgb || style.fill !== "none") continue;
      crosses.push({
        x: (a.x + b.x) / 2 - canvas.x, y: (a.y + b.y) / 2 - canvas.y,
        width: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)),
        height: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)),
        strokeWidth: parseFloat(style.strokeWidth) * Math.hypot(matrix.a, matrix.b),
        rgb
      });
    }
    return { width: canvas.width, height: canvas.height, crosses };
  });
}

export function compareCrossOuts(actual, reference, tolerancePx = 0.12) {
  const remaining = [...reference.crosses];
  let maxErrorPx = 0;
  let maxColorError = 0;
  for (const cross of actual.crosses) {
    const errors = remaining.map(ref => Math.max(...["x", "y", "width", "height", "strokeWidth"]
      .map(key => Math.abs(cross[key] - ref[key]))));
    const error = Math.min(...errors);
    maxErrorPx = Math.max(maxErrorPx, error);
    if (!Number.isFinite(error)) break;
    const [ref] = remaining.splice(errors.indexOf(error), 1);
    maxColorError = Math.max(maxColorError, ...cross.rgb.map((c, i) => Math.abs(c - ref.rgb[i])));
  }
  const canvasErrorPx = Math.max(Math.abs(actual.width - reference.width), Math.abs(actual.height - reference.height));
  const matchingCount = actual.crosses.length > 0 && actual.crosses.length === reference.crosses.length;
  return { count: actual.crosses.length, referenceCount: reference.crosses.length,
    maxErrorPx, maxColorError, canvasErrorPx, tolerancePx,
    accepted: matchingCount && maxErrorPx < tolerancePx && maxColorError <= 1 && canvasErrorPx < tolerancePx };
}
