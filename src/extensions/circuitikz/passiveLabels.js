import { PGF_SP, pgfDimension, pgfFixedDivide, pgfFixedMultiply, pgfFixedReciprocal,
  pgfPrintDimension } from "../../engine/pgf-fixed-point.js";
import { pgfCos } from "../../engine/safe-expression.js";
import { pgfDirectionDegreesSp } from "../../pgf/normalisedDirection.js";

const PT_PER_CM = 72.27 / 2.54;
const SP_PER_CM = PGF_SP * PT_PER_CM;
const sp = cm => Math.round(cm * SP_PER_CM);
const validLength = cm => Number.isFinite(cm) && Math.abs(sp(cm)) < 16384 * PGF_SP;
const half = n => Math.trunc(n / 2);
const times = (factor, length) => Math.trunc(pgfDimension(factor) * length);
const round = n => Math.sign(n) * Math.round(Math.abs(n)); // pgfmathround: ties away from zero
const identity = { a: 1, b: 0, c: 0, d: 1 };

function polar(angle, radius) {
  return { x: times(pgfCos(angle), radius), y: times(pgfCos(angle - 90), radius) };
}

// pgfpointborderrectangle (pgfcorepoints.code.tex): even a numeric anchor is
// a ray against the actual label rectangle, with a reciprocal of an sp count.
function rectangleBorder(angle, w, h) {
  const ray = polar(angle, PGF_SP);
  const x = Math.abs(ray.x), y = Math.abs(ray.y);
  const cx = Math.trunc(x / 8), cy = Math.trunc(y / 8);
  function project(extent, other, count) {
    const reciprocal = Math.trunc(8192 * PGF_SP / count);
    return Math.trunc(Math.trunc(reciprocal * other / PGF_SP) * extent / PGF_SP);
  }
  const xFirst = cx > cy;
  const [major, minor, m, n, extent, other] = xFirst ? [x, y, cx, cy, w, h] : [y, x, cy, cx, h, w];
  let hitMajor = 0, hitMinor = other;
  if (m >= 255) {
    const hit = project(extent, minor, m);
    if (hit < other || n < 255) { hitMajor = extent; hitMinor = hit < other ? hit : 0; }
    else hitMajor = project(other, major, n);
  }
  const [bx, by] = xFirst ? [hitMajor, hitMinor] : [hitMinor, hitMajor];
  return { x: ray.x < 0 ? -bx : bx, y: ray.y < 0 ? -by : by };
}

function linear({ a, b, c, d }, { x, y }) {
  return { x: times(a, x) + times(c, y), y: times(b, x) + times(d, y) };
}

// pgfpointanchor undoes the current matrix; TikZ then reapplies it to the
// coordinate. These are not necessarily inverses in sp (1/1.5 = .66675).
function coordinateFrame(matrix, determinant, mid) {
  const { a, b, c, d, e = 0, f = 0 } = matrix;
  if (a === 1 && b === 0 && c === 0 && d === 1) return { lookup: p => p, directionDelta: p => p };
  let inverse;
  if (!b && !c) {
    inverse = { a: pgfFixedReciprocal(a), b: 0, c: 0, d: pgfFixedReciprocal(d) };
  } else {
    const r = pgfFixedReciprocal(determinant);
    inverse = { a: pgfFixedMultiply(pgfDimension(d), r), b: pgfFixedMultiply(pgfDimension(-b), r),
      c: pgfFixedMultiply(pgfDimension(-c), r), d: pgfFixedMultiply(pgfDimension(a), r) };
  }
  if (!Object.values(inverse).every(Number.isFinite)) return null;
  const tx = sp(e), ty = sp(f), mx = sp(mid.x), my = sp(mid.y);
  const shift = linear(inverse, { x: -tx, y: -ty });
  function lookup(p) {
    const local = linear(inverse, { x: mx + p.x, y: my + p.y });
    const page = linear(matrix, { x: local.x + shift.x, y: local.y + shift.y });
    return { x: page.x + tx - mx, y: page.y + ty - my };
  }
  // pgfcircpath.tex computes the angle from the named start and end anchors,
  // not from the requested polar angle or from their unit page-space tangent.
  return { lookup, directionDelta: p => linear(inverse, linear(matrix, p)) };
}

// pgfcirclabel.tex: signed mod (not Mod), round for the numerical anchor,
// stripdecimals (truncation) for the direction/quadrant comparisons.
function straightAnchor(direction, side) {
  const angle = (round(direction - 90) + (side < 0 ? 180 : 0)) % 360;
  let axis = (angle + 90) % 180;
  if (axis > 135) axis -= 180;
  if (axis > 84 && axis < 96) {
    return { name: (Math.trunc(direction) <= 180) === (side > 0) ? "mid east" : "mid west", angle };
  }
  if (axis > -6 && axis < 6) {
    const base = side < 0 ? angle > 90 : angle < 90 || angle > 180;
    return { name: base ? "base" : "north", angle };
  }
  return { name: String(angle), angle };
}

/**
 * Ordinary fixed R/C, no transform shape or custom label node styling. All
 * public lengths are cm, y up. mid and the returned centers are in page space;
 * localDelta is end minus start BEFORE the coordinate transform, not a unit
 * vector. The coordinate matrix's translation is x/y (or e/f), in cm.
 * With identity coordinates, u (directed unit tangent) is a fallback.
 * textBox is the natural single-line width, ascent and depth BEFORE the strut.
 */
export function passiveLabelLayout({
  mid, u, localDelta, coordinateTransform = identity, side, halfNormal, borderMargin = 1.1,
  align = "straight", ex, em, baselineSkip, textBox, labelDistance = 0, lineWidth = .4 / PT_PER_CM
} = {}) {
  if (![mid?.x, mid?.y].every(validLength) || ![u?.x, u?.y].every(Number.isFinite) ||
      Math.abs(Math.hypot(u.x, u.y) - 1) > 1e-8 || (side !== 1 && side !== -1) ||
      !["straight", "rotate", "smart"].includes(align)) return null;
  const { a, b, c, d, x = 0, y = 0, e = x, f = y } = coordinateTransform ?? {};
  if (![a, b, c, d].every(Number.isFinite) || ![e, f].every(validLength) ||
      (!localDelta && (a !== 1 || b !== 0 || c !== 0 || d !== 1))) return null;
  const delta = localDelta ?? u;
  if (![delta.x, delta.y].every(Number.isFinite)) return null;
  const dx = sp(delta.x), dy = sp(delta.y);
  if ((!dx && !dy) || Math.max(Math.abs(dx), Math.abs(dy)) >= 16384 * PGF_SP) return null;
  const determinant = pgfFixedMultiply(pgfDimension(a), pgfDimension(d)) - pgfFixedMultiply(pgfDimension(b), pgfDimension(c));
  // pgfmathsqrt reads the printed determinant and truncates to five decimals.
  const digits = Math.round(Number(pgfPrintDimension(Math.abs(determinant))) * 1e5);
  const scale = pgfDimension(Math.floor(Math.sqrt(digits * 1e5)) / 1e5);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const frame = coordinateFrame({ a, b, c, d, e, f }, determinant, mid);
  if (!frame) return null;
  const vector = frame.directionDelta({ x: dx, y: dy });
  const signed = pgfDirectionDegreesSp(vector.x, vector.y); // pgfmathanglebetweenpoints
  const direction = signed < 0 ? signed + 360 : signed;
  if (!Number.isFinite(direction)) return null;

  const { width, height, depth } = textBox ?? {};
  if (![halfNormal, width, height, depth, ex, baselineSkip, lineWidth].every(n => validLength(n) && n >= 0) ||
      !ex || !baselineSkip || !validLength(labelDistance) ||
      !Number.isFinite(borderMargin) || !Number.isFinite(pgfDimension(borderMargin)) || borderMargin < 0) return null;
  const remainder = Math.trunc(direction % 90);
  const rotated = align === "rotate" || (align === "smart" && remainder > 20 && remainder < 70);
  if (rotated && (!validLength(em) || em <= 0)) return null;
  const gap = times(.75, sp(ex)), dist = sp(labelDistance);
  if (gap + dist < 0) return null;
  const unscale = length => pgfFixedDivide(length / PGF_SP, scale) * PGF_SP;
  const space = unscale(rotated ? times(1.5, gap) : gap) + unscale(dist);
  if (!Number.isFinite(space)) return null;

  // pgfcircpath/pgfcirc.defines: mirror and invert each select the opposite
  // shape anchor and reflect the symmetric body. Neither flips the label side.
  let attachment = frame.lookup(polar(direction + side * 90, times(borderMargin, sp(halfNormal))));
  function shift(angle, radius) {
    // Only the TikZ calc displacement goes through the ordinary coordinate
    // matrix. The bipole shape and the label node both reset nontranslations.
    const offset = linear(coordinateTransform, polar(angle, radius));
    const start = frame.lookup(attachment);
    attachment = { x: start.x + offset.x, y: start.y + offset.y };
  }
  let anchor, anchorX = 0, anchorY = 0, rotation = 0;
  const wd = sp(width), ht = sp(height), dp = sp(depth), midY = half(sp(ex));
  const boxHt = rotated ? ht : Math.max(ht, times(.7, sp(baselineSkip)));
  const boxDp = rotated ? dp : Math.max(dp, times(.3, sp(baselineSkip)));
  const inner = rotated ? times(.3333, sp(em)) : half(space);
  const outer = rotated ? half(sp(lineWidth)) : 0;
  const hw = half(Math.max(PGF_SP, wd + 2 * inner)) + outer;
  const hh = half(Math.max(PGF_SP, boxHt + boxDp + 2 * inner)) + outer;
  const cy = half(boxHt) - half(boxDp);
  if (rotated) {
    rotation = round(direction);
    const flip = rotation > 90 && rotation < 270;
    if (flip) rotation = Math.trunc(direction - 180) || 0;
    shift(Math.trunc(direction + side * 90), (side < 0 || flip) ? times(1.5, space) : space);
    anchor = "mid";
    anchorY = midY;
  } else {
    const { name, angle } = straightAnchor(direction, side);
    anchor = name;
    if (name === "base") shift(-angle, space);
    else if (name === "north") anchorY = cy + hh;
    else if (name === "mid east" || name === "mid west") {
      anchorX = name === "mid east" ? hw : -hw;
      anchorY = midY;
    } else {
      const hit = rectangleBorder(angle, hw, hh);
      anchorX = hit.x;
      anchorY = cy + hit.y;
    }
    attachment = frame.lookup(attachment);
  }
  const cos = pgfCos(rotation), sin = pgfCos(rotation - 90);
  function at(x, y) {
    x -= anchorX; y -= anchorY;
    return { x: mid.x + (attachment.x + times(cos, x) - times(sin, y)) / SP_PER_CM,
      y: mid.y + (attachment.y + times(sin, x) + times(cos, y)) / SP_PER_CM };
  }
  const point = at(0, 0);
  return {
    point, direction, rotation, anchor,
    anchors: { base: point, mid: at(0, midY), text: at(-half(wd), 0),
      southWest: at(-hw, cy - hh), northEast: at(hw, cy + hh) },
    options: {
      anchor: "base", ...(rotated ? { rotate: rotation } : {}),
      "inner sep": `${inner / SP_PER_CM}cm`, "outer sep": rotated ? `${outer / SP_PER_CM}cm` : "0pt",
      "tikzkit native math": true, "tikzkit tex node anchors": true, "tikzkit layout bbox": true,
      "tikzkit layout bbox top padding": `${(boxHt - ht) / SP_PER_CM}cm`,
      "tikzkit layout bbox bottom padding": `${(boxDp - dp) / SP_PER_CM}cm`
    }
  };
}
