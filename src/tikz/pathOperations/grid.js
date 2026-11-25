import { roundPoint } from "../../engine/math.js";

// pgfcorepathconstruct.code.tex tests each direction independently against
// .01 TeX pt. This is a physical tolerance, not a percentage of the step.
const SP_PER_PT = 65536;
const SP_PER_CM = SP_PER_PT * 7227 / 254;
const END_ALLOWANCE_SP = Math.round(.01 * SP_PER_PT);
const GRID_LINE_LIMIT = 32768;

// TeX scans a literal with a 16-bit fractional part,
// then converts physical units, truncating the result. A unitless factor
// instead multiplies an already scanned basis vector (pgfpointxy).
const UNIT_RATIOS = { cm: [7227,254], mm: [7227,2540], in: [7227,100], pt: [1,1] };
function gridComponent(raw, axis, basis) {
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(cm|mm|in|pt)?$/i.exec(String(raw).trim());
  if (!match) return null;
  const n = Number(match[1]);
  const fixed = Math.sign(n) * Math.round(Math.abs(n) * SP_PER_PT);
  const unit = UNIT_RATIOS[match[2]];
  if (unit) {
    const length = Math.trunc(fixed * unit[0] / unit[1]);
    return axis === "x" ? { x: length, y: 0 } : { x: 0, y: length };
  }
  const scale = cm => Math.trunc(fixed * Math.trunc(cm * SP_PER_CM) / SP_PER_PT);
  return { x: scale(basis[axis].x), y: scale(basis[axis].y) };
}

export function gridCartesianPair(x, y, basis) {
  const a = gridComponent(x, "x", basis), b = gridComponent(y, "y", basis);
  return a && b ? { x: (a.x + b.x) / SP_PER_CM, y: (a.y + b.y) / SP_PER_CM } : null;
}

export function gridLiteralPoint(raw, basis) {
  const text = String(raw || "").trim();
  const pair = /^([^(),]+),([^(),]+)$/.exec(text.startsWith("(") && text.endsWith(")") ? text.slice(1, -1) : text);
  return pair ? gridCartesianPair(pair[1], pair[2], basis) : null;
}

export function gridStep(layers, resolvePair, resolvePoint) {
  let x = "1cm", y = "1cm";
  for (const options of layers) {
    for (const [key, value] of Object.entries(options || {})) {
      if (key === "step" || key === "/tikz/step") {
        const raw = String(value).trim();
        if (raw.startsWith("(")) {
          // A coordinate saves two *dimensions* now. The basis must not be
          // applied to these a second time even if a later xstep overrides x.
          const point = resolvePoint(raw);
          if (!point) return null;
          x = point.x * SP_PER_CM / SP_PER_PT + "pt"; y = point.y * SP_PER_CM / SP_PER_PT + "pt";
        } else {
          x = y = raw;
        }
      } else if (["xstep", "x step", "/tikz/xstep"].includes(key)) {
        x = value;
      } else if (["ystep", "y step", "/tikz/ystep"].includes(key)) {
        y = value;
      }
    }
  }
  // For unitless keys PGF adds x*xvec and y*yvec, then takes the two
  // components of that sum. A dimension uses the corresponding canvas axis.
  return resolvePair(x, y);
}

function lattice(min, max, step) {
  const stride = Math.round(step * SP_PER_CM);
  if (!(stride > END_ALLOWANCE_SP) || !Number.isFinite(stride)) return [];
  const lower = Math.round(min * SP_PER_CM), upper = Math.round(max * SP_PER_CM);
  const first = Math.ceil(lower / stride) * stride;
  const count = Math.max(1, Math.ceil((upper - first) / stride));
  if (!Number.isSafeInteger(count) || count > GRID_LINE_LIMIT) return null;
  const values = Array.from({ length: count }, (_, i) => (first + i * stride) / SP_PER_CM);
  // PGF's loop draws its first line even when the box is smaller than the
  // step. Only the next candidate is moved back .01pt for a final edge.
  const final = first + count * stride - END_ALLOWANCE_SP;
  if (final < upper) values.push(final / SP_PER_CM);
  return values;
}

export function gridSegments(from, to, step, transform, reportLimit) {
  if (!from || !to || !step || ![from.x, from.y, to.x, to.y, step.x, step.y].every(Number.isFinite)) return [];
  const left = Math.min(from.x, to.x), right = Math.max(from.x, to.x);
  const bottom = Math.min(from.y, to.y), top = Math.max(from.y, to.y);
  const rows = lattice(bottom, top, step.y), columns = lattice(left, right, step.x);
  if (!rows || !columns || rows.length + columns.length > GRID_LINE_LIMIT) {
    reportLimit?.(GRID_LINE_LIMIT);
    return [];
  }
  const point = (x, y) => transform(roundPoint({ x, y }));
  return [
    ...rows.map(y => [point(left, y), point(right, y)]),
    ...columns.map(x => [point(x, bottom), point(x, top)])
  ];
}
