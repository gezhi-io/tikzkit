export async function captureDecorationBounds(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("svg").getBoundingClientRect();
    // Native replacement pictures are filled paths, not glyph <use> nodes.
    const glyphs = [...document.querySelectorAll("svg text, svg use, svg path, .tikz-decoration-replacement")]
      .filter(element => !element.closest("defs, clipPath, mask") &&
        (element.tagName !== "path" || getComputedStyle(element).fill !== "none"))
      .map(element => element.getBoundingClientRect());
    return {
      width: canvas.width, height: canvas.height, glyphs: glyphs.length,
      overflowPx: Math.max(0, ...glyphs.flatMap(box => [
        canvas.left - box.left, canvas.top - box.top,
        box.right - canvas.right, box.bottom - canvas.bottom
      ]))
    };
  });
}

export function compareDecorationBounds(actual, reference, { allowEmpty = false } = {}) {
  // Audit screenshots share one physical 3x scale. Never fit a cropped SVG
  // to the reference: doing so can disguise the missing character margins.
  const tolerancePx = .2;
  const canvasErrorPx = Math.max(...["width", "height"].map(key => Math.abs(actual[key] - reference[key])));
  const overflowPx = Math.max(actual.overflowPx, reference.overflowPx);
  const hasPaint = allowEmpty || (actual.glyphs > 0 && reference.glyphs > 0);
  return { canvasErrorPx, overflowPx, tolerancePx, glyphs: actual.glyphs, referenceGlyphs: reference.glyphs,
    accepted: hasPaint && canvasErrorPx < tolerancePx && overflowPx < tolerancePx };
}
