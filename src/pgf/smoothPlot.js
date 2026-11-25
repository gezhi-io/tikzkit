import { closePathCommand, curveToCommand, moveToCommand } from "../engine/pathBuilder.js";

const SP = 65536;
const SP_PER_CM = SP * 72.27 / 2.54;

// pgflibraryplothandlers scales the neighboring-point difference in TeX
// dimensions. Zero, negative and greater-than-one tensions are all meaningful.
export function smoothPlotCommands(points, { closed = false, tension = 0.5 } = {}) {
  const n = points.length;
  const first = closed ? 1 : 0;
  if (n <= first) return [];
  const commands = [moveToCommand(points[first])];
  if (n <= (closed ? 2 : 1)) return commands;

  const value = Number.isFinite(tension) ? tension : 0.5;
  const fixed = Math.sign(value) * Math.round(Math.abs(value) * SP);
  const factor = Math.trunc(Math.round(.2775 * SP) * fixed / SP) / SP;
  const scaled = delta => Math.trunc(Math.round(delta * SP_PER_CM) * factor) / SP_PER_CM;
  function support(i, sign) {
    if (!closed && (i === 0 || i === n - 1)) return points[i];
    const prev = points[(i + n - 1) % n], next = points[(i + 1) % n];
    return { x: points[i].x + sign * scaled(next.x - prev.x),
      y: points[i].y + sign * scaled(next.y - prev.y) };
  }

  // PGF waits for its second sample to move a cyclic path's pen. Its first
  // painted segment is p1 -> p2, which also sets the phase of a dashed loop.
  const count = closed ? n : n - 1;
  for (let k = 0; k < count; k++) {
    const i = (first + k) % n, j = (i + 1) % n;
    commands.push(curveToCommand(support(i, 1), support(j, -1), points[j]));
  }
  if (closed) commands.push(closePathCommand());
  return commands;
}
