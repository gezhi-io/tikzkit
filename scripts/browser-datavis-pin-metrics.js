// Compare one label visualizer against its native SVG at a shared plot origin.
// Neither the label nor the leader receives an independent alignment transform.
export async function captureDatavisPin(page, glyphCount) {
  return page.evaluate(glyphCount => {
    const svg = document.querySelector("svg");
    const lines = [...svg.querySelectorAll("path")].flatMap(path => {
      if (path.closest("defs")) return [];
      const m = (path.getAttribute("d") || "").match(/^\s*M\s*([-\d.e+]+)[ ,]+([-\d.e+]+)\s*L\s*([-\d.e+]+)[ ,]+([-\d.e+]+)\s*$/i);
      if (!m) return [];
      const matrix = path.getScreenCTM(), style = getComputedStyle(path);
      const a = new DOMPoint(Number(m[1]), Number(m[2])).matrixTransform(matrix);
      const b = new DOMPoint(Number(m[3]), Number(m[4])).matrixTransform(matrix);
      return [{ path, a, b, color: style.stroke,
        width: parseFloat(style.strokeWidth) * Math.hypot(matrix.a, matrix.b) }];
    });
    const borders = lines.filter(l => l.color === "rgb(191, 191, 191)" &&
      Math.abs(l.a.y - l.b.y) < 0.01 && Math.abs(l.a.x - l.b.x) > 100);
    if (!borders.length) throw new Error("Expected datavis plot frame");
    const origin = { x: Math.min(...borders.flatMap(l => [l.a.x, l.b.x])), y: Math.max(...borders.map(l => l.a.y)) };
    const pins = lines.filter(l => l.color === "rgb(128, 128, 128)" && l.width > 0.7 && l.width < 0.9 &&
      Math.abs(l.a.x - l.b.x) > 1 && Math.abs(l.a.y - l.b.y) > 1);
    if (pins.length !== 1) throw new Error(`Expected one 0.2pt pin, found ${pins.length}`);
    const pin = pins[0];
    const relative = p => ({ x: p.x - origin.x, y: p.y - origin.y });
    // Both pipelines paint this node immediately before its appended pin edge.
    const glyphs = [...svg.querySelectorAll('[data-math-layout="cm-tex-box"] text, use')]
      .filter(el => !el.closest("defs") && (el.compareDocumentPosition(pin.path) & Node.DOCUMENT_POSITION_FOLLOWING))
      .slice(-glyphCount).map(el => relative(new DOMPoint(Number(el.getAttribute("x")), Number(el.getAttribute("y")))
        .matrixTransform(el.getScreenCTM())));
    return { endpoints: [relative(pin.a), relative(pin.b)].sort((a, b) => a.x - b.x), glyphs, strokeWidth: pin.width };
  }, glyphCount);
}

export function compareDatavisPin(actual, reference, glyphCount, tolerancePx = 0.3) {
  const error = (a, b) => Math.max(...a.flatMap((p, i) => [Math.abs(p.x - b[i].x), Math.abs(p.y - b[i].y)]));
  const endpointErrorPx = error(actual.endpoints, reference.endpoints);
  const glyphErrorPx = actual.glyphs.length === glyphCount && reference.glyphs.length === glyphCount
    ? error(actual.glyphs, reference.glyphs) : Infinity;
  const strokeErrorPx = Math.abs(actual.strokeWidth - reference.strokeWidth);
  return { endpointErrorPx, glyphErrorPx, strokeErrorPx, tolerancePx,
    accepted: Math.max(endpointErrorPx, glyphErrorPx, strokeErrorPx) < tolerancePx };
}
