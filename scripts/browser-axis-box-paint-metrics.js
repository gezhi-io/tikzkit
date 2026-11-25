// Tick/grid extents cannot detect a reversed dashed outline or wrong paint
// order. Sample the directed frame path and inspect its actual browser pen.
export async function captureAxisBoxPaint(page) {
  return page.evaluate(() => {
    const paths = [...document.querySelectorAll("svg path")].filter(p => !p.closest("defs,clipPath,mask"));
    const frames = paths.filter(p => getComputedStyle(p).stroke === "rgb(0, 0, 0)" &&
      /z/i.test(p.getAttribute("d") || "") && p.getBBox().width > 0 && p.getBBox().height > 0)
      .sort((a, b) => b.getBBox().width * b.getBBox().height - a.getBBox().width * a.getBBox().height);
    if (!frames.length) throw new Error("Expected a black closed axis frame");
    const frame = frames[0], box = frame.getBoundingClientRect();
    const measure = p => {
      const style = getComputedStyle(p), matrix = p.getScreenCTM();
      const scale = Math.hypot(matrix.a, matrix.b), length = p.getTotalLength();
      return {
        color: style.stroke, width: parseFloat(style.strokeWidth) * scale,
        dash: style.strokeDasharray === "none" ? [] : style.strokeDasharray.split(/[ ,]+/).map(n => parseFloat(n) * scale),
        dashOffset: parseFloat(style.strokeDashoffset) * scale,
        cap: style.strokeLinecap, join: style.strokeLinejoin,
        points: Array.from({ length: 129 }, (_, i) => {
          const point = p.getPointAtLength(length * i / 128).matrixTransform(matrix);
          return { x: point.x - box.left, y: point.y - box.bottom };
        })
      };
    };
    const plots = paths.filter(p => {
      const rgb = getComputedStyle(p).stroke.match(/^rgb\((\d+), (\d+), (\d+)\)$/)?.slice(1).map(Number);
      return rgb && (rgb[0] !== rgb[1] || rgb[1] !== rgb[2]);
    });
    if (!plots.length) throw new Error("Expected colored plot paths");
    return { frame: measure(frame), plots: plots.map(p => ({ ...measure(p), afterFrame: paths.indexOf(p) > paths.indexOf(frame) })) };
  });
}

export function compareAxisBoxPaint(actual, reference, tolerancePx = .09) {
  let maxErrorPx = 0;
  const compare = (a, b) => {
    if (!a || !b || a.color !== b.color || a.cap !== b.cap || a.join !== b.join ||
      a.dash.length !== b.dash.length || a.points.length !== b.points.length) return false;
    maxErrorPx = Math.max(maxErrorPx, Math.abs(a.width - b.width), Math.abs(a.dashOffset - b.dashOffset),
      ...a.dash.map((n, i) => Math.abs(n - b.dash[i])),
      ...a.points.flatMap((p, i) => [Math.abs(p.x - b.points[i].x), Math.abs(p.y - b.points[i].y)]));
    return true;
  };
  const matchingFrame = compare(actual.frame, reference.frame);
  const matchingPlots = actual.plots.length === reference.plots.length &&
    actual.plots.every((p, i) => compare(p, reference.plots[i]));
  const matchingOrder = actual.plots.length === reference.plots.length &&
    actual.plots.every((p, i) => p.afterFrame === reference.plots[i].afterFrame);
  return { alignment: "Box southwest corner; translation only, fixed physical scale", tolerancePx,
    plots: actual.plots.length, referencePlots: reference.plots.length, matchingFrame, matchingPlots, matchingOrder, maxErrorPx,
    accepted: matchingFrame && matchingPlots && matchingOrder && maxErrorPx < tolerancePx };
}
