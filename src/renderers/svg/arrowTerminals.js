import { shortenCubicCurve } from "./arrowBending.js";

// pgfcorepathusage checks the whole soft path for closure, then splits at
// the last moveto. General path/decoration terminal inspection is different.
export function prepareArrowTerminals(commands, startOptions, endOptions) {
  let move = -1;
  for (let i = 0; i < commands.length; i++) {
    if (commands[i].type === "closePath") return { commands };
    if (commands[i].type === "moveTo") move = i;
  }
  if (move < 0) return { commands };
  if (move === commands.length - 1) {
    const frame = { endpoint: commands[move], outward: { x: 0, y: 1 } };
    return { commands, start: frame, end: frame };
  }

  const shaft = startOptions.distance || endOptions.distance ? commands.slice() : commands;
  // PGF prepares the end first. On a single segment the start must see
  // the rewritten end (and possibly rewritten cubic controls).
  const end = prepareTerminal(shaft, shaft.length - 1, "end", endOptions);
  const start = prepareTerminal(shaft, move + 1, "start", startOptions);
  return { commands: shaft, start, end };
}

function prepareTerminal(shaft, i, side, { distance, precise }) {
  const start = shaft[i - 1];
  const end = shaft[i];
  const curve = terminalCurve(start, end);
  const atStart = side === "start";
  const endpoint = atStart ? start : end;
  const opposite = atStart ? end : start;
  let ref = opposite;
  if (curve) {
    const near = atStart ? curve.startControl : curve.endControl;
    const far = atStart ? curve.endControl : curve.startControl;
    if (!samePoint(endpoint, near)) ref = near;
    else if (!samePoint(endpoint, far)) ref = far;
  }
  const dx = endpoint.x - ref.x;
  const dy = endpoint.y - ref.y;
  const length = Math.hypot(dx, dy);
  // pgfpointnormalised(0,0) is +y. PGF normalizes the shortening
  // vector and the reverse tip vector separately, so *both* become +y.
  const outward = length ? { x: dx / length, y: dy / length } : { x: 0, y: 1 };
  const frame = { endpoint, outward, curve };
  if (!distance) return frame;

  if (precise && curve) {
    const [p, a, b, q] = shortenCubicCurve([start, curve.startControl, curve.endControl, end], distance, side);
    shaft[i - 1] = { ...start, x: p.x, y: p.y };
    shaft[i] = { ...end, type: "curveTo", x1: a.x, y1: a.y, x2: b.x, y2: b.y, x: q.x, y: q.y };
  } else {
    const x = endpoint.x - outward.x * distance;
    const y = endpoint.y + (length ? -outward.y : 1) * distance;
    if (curve) {
      // Quick end shortening keeps both controls. At the start PGF writes
      // the chosen reference point back as the first support token.
      const a = atStart ? ref : curve.startControl;
      shaft[i] = { ...end, type: "curveTo", x1: a.x, y1: a.y, x2: curve.endControl.x, y2: curve.endControl.y };
    }
    const j = atStart ? i - 1 : i;
    shaft[j] = { ...shaft[j], x, y };
  }
  return frame;
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

export function terminalCurveForTip(curve, side, { tip, curveDistance }) {
  if (!curve || !tip.bending || tip.bending.mode === "bend") return curve;
  const near = side === "start" ? "startControl" : "endControl";
  const far = side === "start" ? curve.endControl : curve.startControl;
  if (!samePoint(curve[side], curve[near]) || samePoint(curve[side], far)) return curve;

  const prime = tip.bending.mode === "flexPrime";
  const tipEnd = tip.geometry.logicalTipOffset ?? tip.geometry.placement ?? 0;
  const visualTip = prime ? tipEnd : tip.geometry.visualTipEnd ?? tipEnd;
  const span = prime ? tip.assemblyLength : tip.geometry.visualSpan ?? tip.assemblyLength;
  if (curveDistance + tipEnd !== visualTip || (tip.bending.factor !== 0 && span !== 0)) return curve;
  // This rigid tip samples only the tangent at t=0. pgfmodulebending uses
  // the next distinct support here; every other distance uses the real curve.
  return { ...curve, [near]: far };
}

function terminalCurve(start, end) {
  if (end.type === "curveTo") return {
    start, end, startControl: { x: end.x1, y: end.y1 }, endControl: { x: end.x2, y: end.y2 }
  };
  if (end.type !== "quadTo") return null;
  // The PGF soft path represents a quadratic by its equivalent cubic.
  const support = (p) => ({ x: p.x + (end.x1 - p.x) * 2 / 3, y: p.y + (end.y1 - p.y) * 2 / 3 });
  return { start, end, startControl: support(start), endControl: support(end) };
}
