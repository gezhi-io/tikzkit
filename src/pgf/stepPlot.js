import { lineToCommand, moveToCommand } from "../engine/pathBuilder.js";

const handlers = new Set([
  "const plot", "const plot mark left", "const plot mark right", "const plot mark mid",
  "jump mark left", "jump mark right", "jump mark mid"
]);

export function isStepPlotHandler(key) {
  return handlers.has(key);
}

// PGF's constantlineto and jumpmark handlers place corners in the plot's
// coordinate system. They visit the observations in input order, even when
// x decreases. A jump changes only the pen action at the vertical segment.
export function stepPlotCommands(points, handler, { mirror = false, toCanvas } = {}) {
  if (!points.length) return [];
  const commands = [moveToCommand(points[0])];
  const changeHeight = handler.startsWith("jump mark") ? moveToCommand : lineToCommand;
  const mid = handler.endsWith("mid"), right = handler.endsWith("right") !== mirror;
  let previous = points[0];
  for (let i = 1; i < points.length; i++) {
    const a = previous, b = points[i];
    if (mid) {
      const x = (a.x + b.x) / 2;
      commands.push(lineToCommand(x, a.y), changeHeight(x, b.y), lineToCommand(b));
    } else if (right) {
      commands.push(changeHeight(a.x, b.y), lineToCommand(b));
    } else {
      commands.push(lineToCommand(b.x, a.y), changeHeight(b));
    }
    // Both mid handlers cache pgf@x/y *after* pgfpathlineto transforms b.
    // The first sample, and the left/right handlers' xa/ya, are saved before it.
    previous = mid && toCanvas ? toCanvas(b) : b;
  }
  return commands;
}
