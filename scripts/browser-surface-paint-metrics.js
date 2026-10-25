// Flat/faceted control fixtures only: compare every filled linear polygon,
// independently of whether native and JS split fill/stroke into separate paths.
export async function captureSurfacePaint(page) {
  return page.evaluate(() => {
    const svg = document.querySelector("svg").getBoundingClientRect();
    return [...document.querySelectorAll("svg path")].flatMap(path => {
      if (path.closest("defs,clipPath,mask")) return [];
      const d = path.getAttribute("d") || "";
      const style = getComputedStyle(path);
      if (!/z/i.test(d) || /[achqstv]/i.test(d) || (d.match(/l/gi) || []).length < 3 ||
          !/^rgb\(/.test(style.fill) || Number(style.fillOpacity) === 0 || Number(style.opacity) === 0) return [];
      const box = path.getBoundingClientRect();
      return [{ x: box.x + box.width / 2 - svg.x, y: box.y + box.height / 2 - svg.y,
        width: box.width, height: box.height, rgb: style.fill.match(/[\d.]+/g).map(Number) }];
    });
  });
}

export function compareSurfacePaint(actual, native, tolerancePx = .35, toleranceByte = 1) {
  const remaining = new Set(native.map((_, i) => i));
  let maxGeometryErrorPx = 0, maxColorErrorByte = 0;
  const mismatches = [];
  for (const face of actual) {
    let match = -1, distance = Infinity;
    for (const i of remaining) {
      const candidate = native[i];
      const error = Math.max(...["x", "y", "width", "height"].map(key => Math.abs(face[key] - candidate[key])));
      if (error < distance) { match = i; distance = error; }
    }
    if (match < 0) { maxGeometryErrorPx = Infinity; break; }
    remaining.delete(match);
    const colorError = Math.max(...face.rgb.map((channel, i) => Math.abs(channel - native[match].rgb[i])));
    maxGeometryErrorPx = Math.max(maxGeometryErrorPx, distance);
    maxColorErrorByte = Math.max(maxColorErrorByte, colorError);
    if (distance > tolerancePx || colorError > toleranceByte) {
      mismatches.push({ actual: face, native: native[match], geometryErrorPx: distance, colorErrorByte: colorError });
    }
  }
  return { count: actual.length, referenceCount: native.length, maxGeometryErrorPx, maxColorErrorByte,
    tolerancePx, toleranceByte, mismatches,
    accepted: native.length > 0 && actual.length === native.length && maxGeometryErrorPx <= tolerancePx && maxColorErrorByte <= toleranceByte };
}
