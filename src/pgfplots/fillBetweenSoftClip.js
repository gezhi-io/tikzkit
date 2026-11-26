import { parseOptions, stripOuterBraces } from "../engine/options.js";
import { curveToCommand, lineToCommand, moveToCommand } from "../engine/pathBuilder.js";
import { PGF_SP } from "../engine/pgf-fixed-point.js";
import { cubicBezierPoint, cubicExtremaParameters, emptyBoundingBox, includePoint } from "../scene/bbox.js";

const DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

// Strip-only helper for callers that have no orthogonal data survey. Actual
// PGFPlots axes resolve a finite numericFillBetweenClipBox and use the
// whole-contour clipper below; sequential x/y strips are not equivalent.
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

const TEX_PT = 2.54 / 72.27; // Scene cm.
const TEX_SP = TEX_PT / PGF_SP;
const HIT_TOLERANCE = 0.1 * TEX_PT;

// A min/max box starts at its southwest corner. A resolver which knows the
// authored corners can set flipX / flipY to start on the opposite side(s).
// This is PGF soft clipping of a boundary, not geometric polygon intersection:
// keep alternate segments of the original softpath, even at a tangent or a Z.
export function clipFillBetweenBox(commands, box) {
  if (!commands.length || box == null) return commands;
  const { minX, maxX, minY, maxY } = box;
  if (![minX, maxX, minY, maxY].every(Number.isFinite) || minX >= maxX || minY >= maxY) return [];
  if (commands[0].type !== "moveTo" || !Number.isFinite(commands[0].x) || !Number.isFinite(commands[0].y)) return [];
  const edges = boxEdges(box);
  const unique = boxHitFilter();
  let keep = firstInsideBox(commands[0], box, edges);
  let current, start, keptMove, clipped = false;
  const result = [];
  for (const cmd of commands) {
    if (cmd.type === "moveTo") {
      if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return [];
      current = start = cmd;
      if (keep) { keptMove = cmd; result.push(cmd); }
      continue;
    }
    const closing = cmd.type === "closePath", cubic = cmd.type === "curveTo";
    if (!cubic && !closing && cmd.type !== "lineTo") return [];
    const end = closing && cmd.x === undefined && cmd.y === undefined ? start : cmd;
    if (!Number.isFinite(end.x) || !Number.isFinite(end.y)) return [];
    let points;
    const hits = [];
    const add = (p, t) => { if (unique(p)) hits.push({ p, t }); };
    if (cubic) {
      if (![cmd.x1, cmd.y1, cmd.x2, cmd.y2].every(Number.isFinite)) return [];
      points = [current, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }, end];
      const bounds = controlBounds(points);
      for (const edge of edges) cubicBoxHits(points, bounds, edge.cubic, edge.bounds, add);
      hits.sort((a, b) => a.t - b.t);
    } else {
      // With intersection sorting disabled PGF gives line hits only a segment
      // index. Ties keep rectangle-edge order, even on a descending line.
      for (const edge of edges) {
        const p = lineBoxHit(current, end, edge);
        if (p) add(p);
      }
    }
    for (const { p, t } of hits) {
      clipped = true;
      if (cubic) {
        const [left, right] = splitCubic(points, t); // Original time on the remaining controls.
        if (keep) result.push(curveToCommand(left[1], left[2], left[3]));
        right[0] = p;
        points = right;
      } else if (keep) result.push(lineToCommand(p));
      keep = !keep;
      if (keep) { keptMove = p; result.push(moveToCommand(p)); }
    }
    if (keep) {
      if (cubic && hits.length) result.push(curveToCommand(points[1], points[2], points[3]));
      else if (closing && keptMove !== start && end === start) result.push({ ...cmd, x: end.x, y: end.y });
      else result.push(cmd);
    }
    current = end;
  }
  return !clipped && keep ? commands : result;
}

function boxEdges({ minX, maxX, minY, maxY, flipX, flipY }) {
  const [x, X] = flipX ? [maxX, minX] : [minX, maxX];
  const [y, Y] = flipY ? [maxY, minY] : [minY, maxY];
  const corners = [{ x, y }, { x, y: Y }, { x: X, y: Y }, { x: X, y }];
  return corners.map((a, i) => {
    const b = corners[(i + 1) % 4];
    const cubic = [a, edgeSupport(a, b), edgeSupport(b, a), b];
    return { a, b, axis: a.x === b.x ? "x" : "y", cubic, bounds: controlBounds(cubic) };
  });
}

// PGF promotes a line with .666666*A + .333333*B, multiplying the
// dimensions separately. Exact mathematical thirds change the set of
// hits (and hence the alternating runs) on an edge-coincident cubic.
function edgeSupport(a, b) {
  const third = Math.round(PGF_SP / 3) / PGF_SP;
  const mix = (u, v) => (Math.trunc(Math.round(u / TEX_SP) * (1 - third)) +
    Math.trunc(Math.round(v / TEX_SP) * third)) * TEX_SP;
  return { x: mix(a.x, b.x), y: mix(a.y, b.y) };
}

// The native first-point test shoots a ray through the mean of the four
// rectangle corners. A first solution at the start counts as outside.
function firstInsideBox(p, { minX, minY, maxX, maxY }, edges) {
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const dx = cx - p.x, dy = cy - p.y, length = Math.hypot(dx, dy);
  const reach = maxX - minX + (maxY - minY);
  const to = { x: cx + reach * (length ? dx / length : 1), y: cy + reach * (length ? dy / length : 0) };
  const unique = boxHitFilter();
  const hits = edges.map(edge => lineBoxHit(p, to, edge)).filter(hit => hit && unique(hit));
  return hits.length % 2 === 1 &&
    Math.max(Math.abs(hits[0].x - p.x), Math.abs(hits[0].y - p.y)) >= HIT_TOLERANCE;
}

// pgf@iflinesintersect accepts extension past an endpoint only within .1pt
// in the 1-norm. Parallel (including collinear) lines yield no solution.
function lineBoxHit(p, q, { a, b, axis }) {
  const delta = q[axis] - p[axis];
  if (!delta) return null;
  const t = (a[axis] - p[axis]) / delta;
  const length = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
  if (Math.max(-t, t - 1) * length >= HIT_TOLERANCE) return null;
  const cross = axis === "x" ? "y" : "x";
  const v = p[cross] + (q[cross] - p[cross]) * t;
  if (v <= Math.min(a[cross], b[cross]) - HIT_TOLERANCE || v >= Math.max(a[cross], b[cross]) + HIT_TOLERANCE) return null;
  return lerp(p, q, t);
}

// PGF discards an already reported point within 1pt in BOTH coordinates,
// across all source segments and rectangle edges, before sorting by time.
function boxHitFilter() {
  const bins = new Map();
  return p => {
    const x = Math.floor(p.x / TEX_PT), y = Math.floor(p.y / TEX_PT);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const q = bins.get(`${x + i}:${y + j}`);
      if (q && Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) < TEX_PT) return false;
    }
    bins.set(`${x}:${y}`, p);
    return true;
  };
}

function controlBounds(points) {
  return points.reduce(includePoint, emptyBoundingBox());
}

// A double-only overlap test can miss an exact tangent at a subdivision knot.
function disjointDimensions(max, min) {
  return max < min && Math.round(max / TEX_SP) < Math.round(min / TEX_SP);
}

// pgflibraryintersections promotes the directed edge to a cubic. Subdivide
// edge first, then source, in depth-first order. At a leaf the solution POINT
// is the mean of the two control boxes; its TIME is the source bracket midpoint.
function cubicBoxHits(source, bounds, edge, edgeBounds, add, lo = 0, hi = 1, depth = 0) {
  const a = bounds, b = edgeBounds;
  if (disjointDimensions(a.maxX, b.minX) || disjointDimensions(b.maxX, a.minX) ||
      disjointDimensions(a.maxY, b.minY) || disjointDimensions(b.maxY, a.minY)) return;
  if (Math.max(a.maxX - a.minX, a.maxY - a.minY, b.maxX - b.minX, b.maxY - b.minY) < HIT_TOLERANCE) {
    add({ x: (a.minX + a.maxX + b.minX + b.maxX) / 4, y: (a.minY + a.maxY + b.minY + b.maxY) / 4 },
      Math.trunc((lo + hi) / 2 * PGF_SP) / PGF_SP);
    return;
  }
  if (depth >= 48) return; // Beyond TeX's representable dimensions.
  if (depth % 2 === 0) {
    for (const half of splitCubic(edge, 0.5)) {
      cubicBoxHits(source, a, half, controlBounds(half), add, lo, hi, depth + 1);
    }
  } else {
    const [left, right] = splitCubic(source, 0.5), mid = (lo + hi) / 2;
    cubicBoxHits(left, controlBounds(left), edge, b, add, lo, mid, depth + 1);
    if (a.minX !== a.maxX || a.minY !== a.maxY) {
      cubicBoxHits(right, controlBounds(right), edge, b, add, mid, hi, depth + 1);
    }
  }
}
