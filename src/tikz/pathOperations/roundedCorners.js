import { closePathCommand, curveToCommand, lineToCommand, moveToCommand } from "../../engine/pathBuilder.js";
import { PGF_SP } from "../../engine/pgf-fixed-point.js";
import { pgfNormalisedDirectionSp } from "../../pgf/normalisedDirection.js";

const spPerCm = PGF_SP * 72.27 / 2.54;
const toSp = cm => Math.sign(cm) * Math.round(Math.abs(cm) * spPerCm);
const supportFactor = Math.round(.5522847 * PGF_SP);
const scale = (sp, factorSp) => Math.trunc(sp * factorSp / PGF_SP);

function makeCorner(vertex, previous, next, inset) {
  const x = toSp(vertex.x), y = toSp(vertex.y);
  function leg(toward) {
    const normal = pgfNormalisedDirectionSp(toSp(toward.x) - x, toSp(toward.y) - y);
    const dx = scale(inset, normal.x), dy = scale(inset, normal.y);
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

// pgf@specialrect walks from northeast to northwest before closing. The
// inset is a signed length along each leg, not an SVG rx constrained by size.
export function roundedRectangleOutline(west, south, east, north, inset) {
  return roundPathCorners([
    moveToCommand(east, north), lineToCommand(west, north), lineToCommand(west, south),
    lineToCommand(east, south), closePathCommand()
  ], () => inset);
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
