import { parseOptions, stripOuterBraces } from "../engine/options.js";
import { cubicBezierPoint, cubicExtremaParameters } from "../scene/bbox.js";

const DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

// PGFPlots adds 10% to the union of orthogonal axis and survey limits for
// linear axes. AxisModel only passes resolved limits (explicit bounds can
// hide data extrema). Use a strip, not a guessed rectangle: named overlays
// beyond the native rectangle can survive. Arbitrary clip contours and TeX
// expressions are not numeric domain selectors and leave the input alone.
export function softClipFillBetweenBoundary(commands, value, ranges, geometry) {
  if (typeof value !== "string" || !value.trim()) return commands;
  const entries = Object.entries(parseOptions(stripOuterBraces(value)));
  if (entries.length !== 1) return commands;
  const [[key, raw]] = entries;
  if (!["domain", "domain y", "y domain y"].includes(key) || typeof raw !== "string") return commands;
  const limits = raw.split(":").map(part => part.trim());
  if (limits.length !== 2 || !limits.every(part => DECIMAL.test(part) && Number.isFinite(Number(part)))) return commands;

  const axis = key === "domain" ? "x" : "y";
  if (geometry?.is3d || typeof geometry?.mapPoint !== "function") return [];
  const edges = limits.map(part => geometry.mapPoint({
    x: ranges?.xMin, y: ranges?.yMin, [axis]: Number(part)
  })?.[axis]);
  if (!edges.every(Number.isFinite)) return [];
  return clipAxisCommands(commands, axis, Math.min(...edges), Math.max(...edges), true);
}

// Keep drawable runs of an M/L/C/Z boundary in an inclusive scene-coordinate
// strip. A clipped Z contributes its original closing edge, never a new edge
// along the strip. Unsupported commands decline the boundary as a whole.
export function clipFillBetweenAxis(commands, axis, min, max) {
  return clipAxisCommands(commands, axis, min, max, false);
}

function clipAxisCommands(commands, axis, min, max, pgfSoftClip) {
  if ((axis !== "x" && axis !== "y") || !(min <= max)) return [];
  if (min === -Infinity && max === Infinity) return commands;
  const result = [];
  let current, start;
  let continuous = false, wholeSubpath = false, unchanged = true;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (cmd.type === "moveTo") {
      current = start = cmd;
      continuous = false;
      wholeSubpath = min <= cmd[axis] && cmd[axis] <= max;
      unchanged &&= wholeSubpath;
      if (wholeSubpath && (i + 1 === commands.length || commands[i + 1].type === "moveTo")) result.push(cmd);
      continue;
    }
    const closing = cmd.type === "closePath";
    if (!current || (!closing && cmd.type !== "lineTo" && cmd.type !== "curveTo")) return [];
    const end = closing ? start : cmd;
    const points = cmd.type === "curveTo"
      ? [current, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }, end]
      : [current, end];
    if (!points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return [];
    const runs = retainedIntervals(points, axis, min, max);
    const full = runs.length === 1 && runs[0][0] === 0 && runs[0][1] === 1;
    unchanged &&= full;
    wholeSubpath &&= full;
    const nativePieces = pgfSoftClip && points.length === 4 && !full ? pgfCubicPieces(points, runs) : null;
    for (const [index, [a, b]] of runs.entries()) {
      const piece = full ? points : nativePieces?.[index] ?? sliceSegment(points, a, b);
      if (!continuous || a !== 0) result.push({ type: "moveTo", x: piece[0].x, y: piece[0].y });
      if (full && (!closing || wholeSubpath)) result.push(cmd);
      else if (piece.length === 2) result.push({ type: "lineTo", x: piece[1].x, y: piece[1].y });
      else result.push({ type: "curveTo", x1: piece[1].x, y1: piece[1].y, x2: piece[2].x,
        y2: piece[2].y, x: piece[3].x, y: piece[3].y });
      continuous = b === 1;
    }
    if (!runs.length) continuous = false;
    current = end;
  }
  return unchanged ? commands : result;
}

function retainedIntervals(points, axis, min, max) {
  const v = points.map(p => p[axis]);
  if (v.every(n => min <= n && n <= max)) return [[0, 1]];
  if (Math.max(...v) < min || Math.min(...v) > max) return [];
  const cubic = points.length === 4;
  // Translation and uniform scaling leave extrema times unchanged. Normalize
  // before the bbox helper's coefficient tolerances see a very small curve.
  const knots = [0, 1];
  if (cubic) {
    const span = Math.max(...v) - Math.min(...v);
    knots.splice(1, 0, ...cubicExtremaParameters(...v.map(n => (n - v[0]) / span)).sort((a, b) => a - b));
  }
  const at = cubic ? t => cubicBezierPoint(...points, t)[axis] : null;
  const runs = [];
  let left = 0, vl = v[0];
  for (const right of knots.slice(1)) {
    const vr = right === 1 ? v.at(-1) : at(right);
    if (left < right && Math.max(vl, vr) >= min && Math.min(vl, vr) <= max) {
      const cross = edge => {
        if (edge === vl) return left;
        if (edge === vr) return right;
        return cubic ? bisect(at, edge, left, right, vr > vl) : (edge - vl) / (vr - vl);
      };
      const a = vl < min ? cross(min) : vl > max ? cross(max) : left;
      const b = vr < min ? cross(min) : vr > max ? cross(max) : right;
      // An isolated touch has no drawable length. An extremum *inside* the
      // strip is only a search knot, not a reason to split the returned cubic.
      if (a < b) {
        if (runs.at(-1)?.[1] === a) runs.at(-1)[1] = b;
        else runs.push([a, b]);
      }
    }
    left = right;
    vl = vr;
  }
  return runs;
}

function bisect(at, edge, lo, hi, increasing) {
  for (let i = 0; i < 54; i++) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) break;
    const value = at(mid);
    if (value === edge) return mid;
    if ((value < edge) === increasing) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// pgflibraryfillbetween's split@curveto keeps both de Casteljau polygons.
function splitCubic([p, q, r, s], t) {
  const pq = lerp(p, q, t), qr = lerp(q, r, t), rs = lerp(r, s, t);
  const left = lerp(pq, qr, t), right = lerp(qr, rs, t);
  const cut = lerp(left, right, t);
  return [[p, pq, left, cut], [cut, right, rs, s]];
}

// pgflibraryfillbetween.code.tex: pgf@insert@intersections@split@segment.
// PGF sorts the hits on each original cubic. It splits the remaining controls
// at each *original* segment time, not (t - previous) / (1 - previous).
// The next moveto/curveto starts at the intersection solution, which after
// repeated hits can differ from the endpoint just emitted. Lines use the hit
// point directly. Keep this soft-clip convention out of geometric clipping.
function pgfCubicPieces(points, runs) {
  let remainder = points;
  function cut(t) {
    const [left, right] = splitCubic(remainder, t);
    right[0] = cubicBezierPoint(...points, t);
    remainder = right;
    return left;
  }
  return runs.map(([a, b]) => {
    if (a > 0) cut(a);
    return b < 1 ? cut(b) : remainder;
  });
}

function sliceSegment(points, a, b) {
  if (points.length === 2) return [
    a === 0 ? points[0] : lerp(...points, a),
    b === 1 ? points[1] : lerp(...points, b)
  ];
  const prefix = b === 1 ? points : splitCubic(points, b)[0];
  return a === 0 ? prefix : splitCubic(prefix, a / b)[1];
}
