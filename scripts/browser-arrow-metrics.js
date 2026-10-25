export async function captureArrowPaint(page, options = {}) {
  return page.evaluate(({ allStrokes = false }) => {
    const canvas = document.querySelector("svg").getBoundingClientRect();
    const paths = [...document.querySelectorAll("svg path")].flatMap(path => {
      if (path.closest("defs,clipPath")) return [];
      const style = getComputedStyle(path);
      if (style.fill !== "none" || style.stroke === "none"
        || (!allStrokes && style.stroke !== "rgb(0, 0, 0)")) return [];
      const ctm = path.getScreenCTM();
      const length = path.getTotalLength();
      const points = Array.from({ length: 65 }, (_, i) => {
        const p = path.getPointAtLength(length * i / 64).matrixTransform(ctm);
        return { x: p.x - canvas.x, y: p.y - canvas.y };
      });
      const scale = Math.hypot(ctm.a, ctm.b);
      // A sheared SVG pen is not circular. Equal stroke-width alone can hide
      // flattened-paint regressions even when the centerline is identical.
      const penWidths = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4].map(angle => {
        const x = Math.cos(angle), y = Math.sin(angle);
        return parseFloat(style.strokeWidth) * Math.hypot(x * ctm.a + y * ctm.b, x * ctm.c + y * ctm.d);
      });
      return [{ points, stroke: style.stroke, strokeWidth: parseFloat(style.strokeWidth) * scale,
        penWidths,
        cap: style.strokeLinecap, join: style.strokeLinejoin,
        dash: style.strokeDasharray === "none" ? [] : style.strokeDasharray.match(/[\d.]+/g).map(n => Number(n) * scale) }];
    });
    return { width: canvas.width, height: canvas.height, paths };
  }, options);
}

export function compareArrowPaint(actual, reference, tolerancePx = .12) {
  const remaining = [...reference.paths];
  const pathError = (a, b) => Math.max(...a.points.map((p, i) =>
    Math.hypot(p.x - b.points[i].x, p.y - b.points[i].y)));
  let maxErrorPx = 0, strokeErrorPx = 0, penErrorPx = 0;
  let stylesMatch = true;
  for (const p of actual.paths) {
    const errors = remaining.map(q => pathError(p, q));
    const error = Math.min(...errors);
    maxErrorPx = Math.max(maxErrorPx, error);
    if (!Number.isFinite(error)) break;
    const [q] = remaining.splice(errors.indexOf(error), 1);
    strokeErrorPx = Math.max(strokeErrorPx, Math.abs(p.strokeWidth - q.strokeWidth));
    penErrorPx = Math.max(penErrorPx, ...p.penWidths.map((width, i) => Math.abs(width - q.penWidths[i])));
    stylesMatch &&= p.stroke === q.stroke && p.cap === q.cap && p.join === q.join && p.dash.length === q.dash.length
      && p.dash.every((d, i) => Math.abs(d - q.dash[i]) < tolerancePx);
  }
  const canvasErrorPx = Math.max(Math.abs(actual.width - reference.width), Math.abs(actual.height - reference.height));
  const count = actual.paths.length, referenceCount = reference.paths.length;
  return { count, referenceCount, maxErrorPx, strokeErrorPx, penErrorPx, canvasErrorPx, stylesMatch, tolerancePx,
    accepted: count > 0 && count === referenceCount && maxErrorPx < tolerancePx
      && strokeErrorPx < tolerancePx && penErrorPx < tolerancePx && canvasErrorPx < tolerancePx && stylesMatch };
}
