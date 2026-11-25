import { lineWidthFromPt, TIKZ_UNIT } from "./metrics.js";

// TikZ changes the pen after constructing the path/anchors. PGF paints the
// same path twice, first with the full pen and then, if positive, the inner pen.
export function doubleStrokeOptions(keys, nominalWidth, toLength, color) {
  if (!Object.hasOwn(keys, "double") && !Object.hasOwn(keys, "double distance") &&
      !Object.hasOwn(keys, "double distance between line centers")) return {};
  let enabled = false, ink = "white", gap;
  for (const [key, value] of Object.entries(keys)) {
    if (key === "tikzkit double ink") ink = color(String(value));
    if (key === "double") {
      enabled = value !== false && value !== "none";
      if (enabled && value !== true && value !== "") ink = color(String(value));
    } else if (key === "double distance" || key === "double distance between line centers") {
      enabled = true;
      gap = toLength(value) - (key === "double distance" ? 0 : nominalWidth);
    }
  }
  return enabled ? { doubleColor: ink, doubleDistance: Number.isFinite(gap) ? gap : toLength("0.6pt") } : {};
}

export function doublePenWidths(style) {
  const nominal = Number(style.lineWidth ?? 1);
  const gap = Number.isFinite(style.doubleDistance) ? style.doubleDistance : lineWidthFromPt(0.6);
  return { outer: Math.max(0, 2 * nominal + gap), inner: Math.max(0, gap) };
}

// PGF adds half the physical outer pen to each side of a stroked path's
// construction bounds. Double strokes do not add two independent margins.
export function strokePadding(style = {}, unit = TIKZ_UNIT, boundsLineWidth = style.lineWidth) {
  if (style.stroke === "none") return 0;
  const width = style.doubleColor === undefined ? Number(boundsLineWidth)
    : doublePenWidths({ ...style, lineWidth: boundsLineWidth }).outer;
  return Number.isFinite(width) && width > 0 ? width / (2 * unit) : 0;
}
