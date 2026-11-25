import { parseOptions, splitTopLevel, tikzBoolean } from "../../engine/options.js";

export function ellipseOptionLayers(segment, styles, expand) {
  // Parenthesized radii take the legacy branch before TikZ consults
  // "every circle". Modern keys execute in order, including repeated rotations.
  if (segment.syntax === "legacy") return [];
  const local = typeof segment.optionsRaw === "string"
    ? splitTopLevel(segment.optionsRaw, ",").filter(Boolean).map(key => parseOptions(key))
    : [segment.options || {}];
  if (styles?.["every circle"]) local.unshift({ "every circle": true });
  return local.map(expand);
}

export function ellipseRadiusKeys(segment, pathOptions, layers) {
  if (segment.syntax === "legacy") {
    const [x, y] = segment.legacyRadii;
    return { x, y: y ?? x, shared: y == null };
  }
  let x = "0pt", y = "0pt", shared = true;
  for (const options of [pathOptions, ...layers]) {
    for (const [raw, value] of Object.entries(options)) {
      const key = raw.replace(/^\/tikz\//, "");
      if (key === "radius") { x = y = value; shared = true; }
      if (key === "x radius") { x = value; shared = false; }
      if (key === "y radius") { y = value; shared = false; }
    }
  }
  return { x, y, shared };
}

export function usesCompoundEllipses(segments, options, style) {
  const count = segments.filter(s => s.kind === "circle" || s.kind === "ellipse").length;
  if (!count) return false;
  // Open segments and closed outlines share one PGF soft path. Splitting
  // the paint would lose holes, blend translucent crossings twice, or put
  // an arrow on every piece. Keep independent ordinary marks as shape IR.
  const mixed = segments.some(s => !["circle", "ellipse", "coordinate", "options", "node"].includes(s.kind));
  return mixed || options["name path"] || options["name path global"] || tikzBoolean(options.clip) ||
    (tikzBoolean(options["tikzkit quick path"]) && segments.length > 2) ||
    (count > 1 && (style.markerStart || style.markerEnd || style.fillRule ||
      Number(style.opacity ?? 1) !== 1 || Number(style.strokeOpacity ?? 1) !== 1 || Number(style.fillOpacity ?? 1) !== 1));
}

export function hasOppositeEllipseWinding(shapes) {
  let winding = 0;
  for (const shape of shapes) {
    if ((shape.shape !== "circle" && shape.shape !== "ellipse") || !(shape.commands?.length >= 3)) return false;
    // The start and two consecutive quarter turns give the winding after
    // signed radii and transforms. Reversed contours cancel in nonzero fills.
    const [a, b, c] = shape.commands;
    const sign = Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    if (winding && sign && sign !== winding) return true;
    if (sign) winding = sign;
  }
  return false;
}

export function markEllipseControlBounds(commands, center, from) {
  // In pgfpathellipse the temporary assignment of the first control's y
  // has no terminating relax. TeX can test the old register (center.y)
  // before the new value is assigned. The soft path still paints the full
  // cubic. Preserve that distinction without changing other Bezier curves.
  let minX = from.x, maxX = from.x, minY = from.y, maxY = from.y;
  function record(x, y) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  for (const c of commands) {
    if (c.type === "curveTo") {
      const deferred = c.x1 >= minX && c.x1 <= maxX && center.y >= minY && center.y <= maxY;
      if (deferred && (c.y1 < minY || c.y1 > maxY)) c.boundsControl1XOnly = true;
      record(c.x1, deferred ? center.y : c.y1);
      record(c.x2, c.y2);
    }
    if ("x" in c) record(c.x, c.y);
  }
}
