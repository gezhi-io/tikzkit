import { curveToCommand, lineToCommand, moveToCommand } from "../engine/pathBuilder.js";
import { cubicExtremaParameters } from "../scene/bbox.js";
import { prepareFillBetweenPaths } from "./fillBetweenAssembly.js";
import { clipFillBetweenAxis } from "./fillBetweenSoftClip.js";

// null requests the original contours; [] means PGF omitted every split pair.
export function splitFillBetweenRegions(first, second, reverse, options = {}) {
  let omitEmptySegments = true;
  for (const [key, value] of Object.entries(options)) {
    if (key !== "omit empty segments" && key !== "/pgf/fill between/omit empty segments") continue;
    if (value === true || value === "true") omitEmptySegments = true;
    else if (value === false || value === "false") omitEmptySegments = false;
  }
  return splitMonotone(first, second, reverse, { omitEmptySegments });
}

export function splitFillBetweenBoundaries(first, second, reverse, options) {
  return splitFillBetweenRegions(first, second, reverse, options) ?? [];
}

// PGF pairs intersection-induced pieces by traversal time, not by an
// increasing-x region number. Only the intersection sweep goes left to right.
function splitMonotone(first, second, reverse, { keepUnsplit = false, omitEmptySegments = true }) {
  const a = monotoneBoundary(first), b = monotoneBoundary(second);
  if (!a || !b) return null;
  const cuts = [];
  let overlap = false;
  for (let i = 0, j = 0; i < a.edges.length && j < b.edges.length;) {
    const p = a.edges[i], q = b.edges[j];
    const lo = Math.max(p[0].x, q[0].x), hi = Math.min(p.at(-1).x, q.at(-1).x);
    overlap ||= lo < hi;
    if (lo <= hi && !intersections(p, q, lo, hi, cuts)) return null;
    if (p.at(-1).x <= q.at(-1).x) i++;
    if (q.at(-1).x <= p.at(-1).x) j++;
  }
  if (!cuts.length && !(keepUnsplit && overlap)) return null;
  const aa = splitAtCuts(a.edges, a.ascending, cuts);
  // In reverse=false mode PGF first reverses the whole second path and
  // then uses reverse=true to assemble each pair. This also matters for
  // explicit reversal overrides that disagree with the actual directions.
  const bb = splitAtCuts(b.edges, reverse ? b.ascending : !b.ascending, cuts);
  if (!aa || !bb) return null;
  return aa.flatMap((piece, i) => omitEmptySegments && cuts.length && emptySegment(piece) && emptySegment(bb[i]) ? [] :
    [{ first: piece, second: bb[i], reverse: true }]);
}

export function splitXMonotoneFillBetweenPaths(firstPath, secondPath) {
  const commands = points => (points || []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y))
    .map((p, i) => i ? lineToCommand(p) : moveToCommand(p));
  const { first, second, reverse } = prepareFillBetweenPaths(commands(firstPath), commands(secondPath));
  const points = path => path.map(({ x, y }) => ({ x, y }));
  // The point-array API historically returns a single ordinary band for
  // overlapping, nonintersecting graphs; the command API signals fallback.
  return (splitMonotone(first, second, reverse, { keepUnsplit: true }) ?? [])
    .map(region => ({ first: points(region.first), second: points(region.second) }));
}

function monotoneBoundary(path) {
  if (!path || path.length < 2 || path[0].type !== "moveTo") return null;
  const ascending = path[0].x < path.at(-1).x, edges = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i-1], b = path[i];
    // A close, an unconnected move, a vertical edge or a folded x curve
    // isn't the graph of a function. Leave the actual contours to assembly.
    if (b.type !== "lineTo" && b.type !== "curveTo") return null;
    const edge = b.type === "lineTo" ? [a, b] : [a, { x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }, b];
    if (!edge.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    if (a.x === b.x && edge.every(p => p.x === a.x && p.y === a.y)) continue;
    if (!ascending) edge.reverse();
    if (!(edge[0].x < edge.at(-1).x)) return null;
    if (edge.length === 4) {
      // The quadratic Bernstein derivative must be nonnegative on [0,1].
      const [p,q,r,s] = edge;
      const u = q.x - p.x, v = r.x - q.x, w = s.x - r.x;
      if (u < 0 || w < 0 || v < -Math.sqrt(u*w)) return null;
    }
    edges.push(edge);
  }
  if (!ascending) edges.reverse();
  return edges.length ? { ascending, edges } : null;
}

function lineY([p, q], x) {
  if (x === p.x) return p.y;
  if (x === q.x) return q.y;
  return p.y + (q.y - p.y) * ((x - p.x) / (q.x - p.x));
}

function sameNumber(a, b) {
  return Math.abs(a-b) <= 16 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
}

function intersections(p, q, lo, hi, cuts) {
  function cut(x) {
    if (sameNumber(x, lo)) x = lo;
    else if (sameNumber(x, hi)) x = hi;
    if (lo <= x && x <= hi && (!cuts.length || !sameNumber(cuts.at(-1), x))) cuts.push(x);
  }
  if (lo === hi) {
    const endAt = edge => edge[0].x === lo ? edge[0] : edge.at(-1);
    if (sameNumber(endAt(p).y, endAt(q).y)) cut(lo);
    return true;
  }
  if (p.length === 2 && q.length === 2) {
    const difference = x => {
      const a = lineY(p, x), b = lineY(q, x);
      return sameNumber(a, b) ? 0 : a - b;
    };
    const left = difference(lo), right = difference(hi);
    // Coincident spans have no unique intersection times.
    if (left === 0 && right === 0) return false;
    if (left === 0) cut(lo);
    if (right === 0) cut(hi);
    if (left < 0 && right > 0 || left > 0 && right < 0) cut(lo + (hi-lo) * (left/(left-right)));
    return true;
  }

  const py = p.map(v => v.y), qy = q.map(v => v.y);
  if (Math.max(...py) < Math.min(...qy) || Math.max(...qy) < Math.min(...py)) return true;
  // Against a line, y(t)-line(x(t)) is cubic. Two native smooth plots
  // sampled on the same x grid also share x(t), so yA(t)-yB(t) is cubic.
  // Other overlapping cubic parameterizations are intentionally unsplit.
  const curve = p.length === 4 ? p : q, other = curve === p ? q : p;
  if (other.length === 4 && !curve.every((v, i) => v.x === other[i].x)) {
    // A straight contour stored as a cubic (e.g. a smoothed constant) is
    // still a line for root-finding. Its output continues to be a cubic.
    for (const [edge, partner] of [[other, curve], [curve, other]]) {
      const chord = [edge[0], edge[3]];
      if (edge.every(v => v.y === lineY(chord, v.x))) return intersections(partner, chord, lo, hi, cuts);
    }
    return false;
  }
  const d = curve.map((v, i) => v.y - (other.length === 4 ? other[i].y : lineY(other, v.x)));
  if (d.every(v => v === 0)) return false;
  const x = curve.map(v => v.x);
  for (const t of cubicZeros(d)) cut(bernstein(x, t));
  return true;
}

function bernstein([a,b,c,d], t) {
  const s = 1-t;
  return a*s*s*s + 3*b*s*s*t + 3*c*s*t*t + d*t*t*t;
}

function cubicZeros(values) {
  const scale = Math.max(...values.map(Math.abs));
  const normalized = values.map(v => v/scale);
  const knots = [0, ...cubicExtremaParameters(...normalized).sort((a,b) => a-b), 1];
  const result = [];
  let left = 0, a = normalized[0];
  if (Math.abs(a) <= 16*Number.EPSILON) result.push(0);
  for (const right of knots.slice(1)) {
    const b = bernstein(normalized, right);
    if (Math.abs(b) <= 16*Number.EPSILON) result.push(right);
    else if (Math.abs(a) > 16*Number.EPSILON && (a < 0) !== (b < 0)) {
      let lo = left, hi = right;
      for (let i = 0; i < 54; i++) {
        const mid = (lo+hi)/2, value = bernstein(normalized, mid);
        if (value === 0) { lo = hi = mid; break; }
        if ((value < 0) === (a < 0)) lo = mid;
        else hi = mid;
      }
      result.push((lo+hi)/2);
    }
    left = right; a = b;
  }
  return result;
}

function splitAtCuts(edges, ascending, cuts) {
  const step = ascending ? 1 : -1;
  let k = ascending ? 0 : cuts.length - 1;
  let path = [moveToCommand(ascending ? edges[0][0] : edges.at(-1).at(-1))];
  const pieces = [];
  for (let i = ascending ? 0 : edges.length - 1; i >= 0 && i < edges.length; i += step) {
    const edge = edges[i];
    const p = ascending ? edge[0] : edge.at(-1), q = ascending ? edge.at(-1) : edge[0];
    const cmd = edge.length === 2 ? lineToCommand(q) : curveToCommand(edge[ascending ? 1 : 2], edge[ascending ? 2 : 1], q);
    let from = p.x;
    function append(to) {
      if (from === to) return true;
      if (edge.length === 2) path.push(to === q.x ? cmd : lineToCommand(to, lineY(edge, to)));
      else if (from === p.x && to === q.x) path.push(cmd);
      else {
        // Only clip the one cubic straddling the cut, never the whole path.
        const [, piece] = clipFillBetweenAxis([moveToCommand(p), cmd], "x", Math.min(from,to), Math.max(from,to));
        if (piece?.type !== "curveTo") return false;
        path.push(piece);
      }
      from = to;
      return true;
    }
    while (k >= 0 && k < cuts.length && step * (cuts[k]-q.x) <= 0) {
      if (!append(cuts[k])) return null;
      pieces.push(path);
      path = [moveToCommand(path.at(-1))];
      k += step;
    }
    if (!append(q.x)) return null;
  }
  pieces.push(path);
  return pieces;
}

function emptySegment(path) {
  // PGF's default omit-empty test is on each control bounding box, not on
  // polygon area. A point on one path still pairs with a nonempty other tail.
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const c of path) {
    xmin = Math.min(xmin, c.x); xmax = Math.max(xmax, c.x);
    ymin = Math.min(ymin, c.y); ymax = Math.max(ymax, c.y);
    if (c.type === "curveTo") {
      xmin = Math.min(xmin,c.x1,c.x2); xmax = Math.max(xmax,c.x1,c.x2);
      ymin = Math.min(ymin,c.y1,c.y2); ymax = Math.max(ymax,c.y1,c.y2);
    }
  }
  return xmax-xmin < 2.54/72.27 || ymax-ymin < 2.54/72.27;
}
