import { curveToCommand, lineToCommand } from "../../engine/pathBuilder.js";
import { PGF_SP, pgfDimension, pgfFixedDivide, pgfFixedMultiply, pgfFixedReciprocal,
  pgfPrintDimension } from "../../engine/pgf-fixed-point.js";
import { pgfCos } from "../../engine/safe-expression.js";

const spPerCm = PGF_SP * 72.27 / 2.54;
const toSp = cm => Math.sign(cm) * Math.round(Math.abs(cm) * spPerCm);
const supportFactor = Math.round(.5522847 * PGF_SP);
const scale = (sp, factorSp) => Math.trunc(sp * factorSp / PGF_SP);

// pgfmathatan@ interpolates a table of degrees at thousandths of slope.
// Its five decimal places are truncated from six-place rounded values.
function atanEntry(index) {
  const degrees = Math.atan(index / 1000) * 180 / Math.PI;
  const tableValue = Math.trunc(Math.round(degrees * 1e6) / 10) / 1e5;
  return Math.round(tableValue * PGF_SP) / PGF_SP;
}

function atanDegrees(ratio) {
  const slope = ratio > 1 ? pgfFixedReciprocal(ratio) : ratio;
  const position = pgfDimension(Number(pgfPrintDimension(slope)) * 1000);
  const index = Math.floor(position);
  let angle = atanEntry(index);
  if (index < 1000) angle += pgfFixedMultiply(position - index, atanEntry(index + 1) - angle);
  return ratio > 1 ? 90 - angle : angle;
}

// pgfpointnormalised uses PGF's atan2 followed by its sine/cosine tables,
// not Euclidean division. In particular, zero points up and tiny dy snaps.
function directionDegrees(dx, dy) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (dx === 0) return dy < 0 ? -90 : 90;
  if (ay < Math.round(.001 * PGF_SP)) return dx < 0 ? 180 : 0;
  const slope = pgfFixedDivide(Math.min(ax, ay) / PGF_SP, Math.max(ax, ay) / PGF_SP);
  const acute = atanDegrees(slope);
  const angle = ay > ax ? 90 - acute : acute;
  return (dy < 0 ? -1 : 1) * (dx < 0 ? 180 - angle : angle);
}

function makeCorner(vertex, previous, next, inset) {
  const x = toSp(vertex.x), y = toSp(vertex.y);
  function leg(toward) {
    const angle = directionDegrees(toSp(toward.x) - x, toSp(toward.y) - y);
    const dx = scale(inset, Math.round(pgfCos(angle) * PGF_SP));
    const dy = scale(inset, Math.round(pgfCos(angle - 90) * PGF_SP));
    return {
      end: { x: (x + dx) / spPerCm, y: (y + dy) / spPerCm },
      support: { x: (x + dx - scale(dx, supportFactor)) / spPerCm,
        y: (y + dy - scale(dy, supportFactor)) / spPerCm }
    };
  }
  const entry = leg(previous), exit = leg(next);
  return { entry: entry.end, exit: exit.end, curve: curveToCommand(entry.support, exit.support, exit.end) };
}

function firstPoint(command, start) {
  switch (command?.type) {
    case "lineTo": return command;
    case "curveTo": return { x: command.x1, y: command.y1 };
    case "closePath": return start;
    default: return null;
  }
}

// insetAt marks the endpoint of the incoming line/cubic/close, in scene cm.
// A close has its own marker, including after an explicit line back to start.
export function roundPathCorners(commands, insetAt) {
  let result = null, start = null, previous = null, first = null, moveIndex = -1;
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index];
    if (command.type === "moveTo") {
      previous = start = command;
      first = null;
      moveIndex = result?.length ?? index;
    } else {
      const target = firstPoint(command, start);
      if (target) {
        first ??= target;
        const close = command.type === "closePath";
        const inset = toSp(insetAt(command, index));
        const before = command.type === "curveTo" ? { x: command.x2, y: command.y2 } : previous;
        const after = close ? first : firstPoint(commands[index + 1], start);
        if (inset && before && after) {
          result ??= commands.slice(0, index);
          const vertex = close ? result[moveIndex] : command;
          const { entry, exit, curve } = makeCorner(vertex, before, after, inset);
          if (close) {
            result[moveIndex] = { ...vertex, ...exit };
            result.push(lineToCommand(entry), curve, command);
            previous = exit;
          } else {
            result.push({ ...command, ...entry }, curve);
            previous = command;
          }
          continue;
        }
      }
      previous = command.type === "closePath" ? start : command;
    }
    result?.push(command);
  }
  return result ?? commands;
}
