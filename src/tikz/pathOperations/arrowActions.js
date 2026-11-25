import { tikzBoolean } from "../../engine/options.js";

export function withoutArrowActions(style) {
  const { markerStart, markerEnd, shortenStart, shortenEnd, arrowStroke, ...shaft } = style;
  return shaft;
}

// pgfusepath, pgfcorepathusage.code.tex:133-172. Both explicit shortening
// and tip placement live inside the same branch; fill alone never enters it.
export function resolveArrowActions(style, commands, options, { splitClosed = false, strokeInk = "black" } = {}) {
  if (!style.markerStart && !style.markerEnd && !style.shortenStart && !style.shortenEnd) return style;
  const mode = String(options.tips ?? "on draw");
  const stroked = style.stroke !== "none";
  const arrowsOnly = !stroked && style.fill === "none" && (mode === "true" || mode === "proper");
  if ((!stroked && !arrowsOnly) || mode === "false" || mode === "never" || tikzBoolean(options.clip) ||
      !commands.length || splitClosed || commands.some(c => c.type === "closePath") ||
      ((mode === "proper" || mode === "on proper draw") && !properFinalSubpath(commands))) {
    return withoutArrowActions(style);
  }
  return arrowsOnly && (style.markerStart || style.markerEnd) ? { ...style, arrowStroke: strokeInk } : style;
}

function properFinalSubpath(commands) {
  // PGF resets the test at each moveto and compares all support points to
  // that move. A cubic can be proper even when both endpoints coincide.
  const index = commands.findLastIndex(c => c.type === "moveTo");
  if (index < 0) return false;
  const { x, y } = commands[index];
  for (let i = index + 1; i < commands.length; ++i) {
    const c = commands[i];
    if (c.x !== x || c.y !== y || (c.type === "curveTo" &&
        (c.x1 !== x || c.y1 !== y || c.x2 !== x || c.y2 !== y))) return true;
  }
  return false;
}
