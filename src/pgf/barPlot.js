import { closePathCommand, lineToCommand, moveToCommand } from "../engine/pathBuilder.js";

const handlers = new Set(["xbar", "ybar", "xbar interval", "ybar interval"]);

export function isBarPlotHandler(name) {
  return handlers.has(name);
}

function appendRectangle(commands, x0, y0, x1, y1, special) {
  // PGF's ordinary PDF rectangle and its transformed/rounded alternative
  // have the same winding, but different dash origins. The latter also
  // explicitly restores the construction pen to the original corner.
  if (special) {
    commands.push(moveToCommand(x1, y1), lineToCommand(x0, y1), lineToCommand(x0, y0),
      lineToCommand(x1, y0), closePathCommand(), moveToCommand(x0, y0));
  } else {
    commands.push(moveToCommand(x0, y0), lineToCommand(x1, y0), lineToCommand(x1, y1),
      lineToCommand(x0, y1), closePathCommand());
  }
}

export function barPlotCommands(points, handler, { width, shift, baseline, special }) {
  const horizontal = handler.startsWith("xbar");
  const interval = handler.endsWith(" interval");
  const category = horizontal ? "y" : "x", value = horizontal ? "x" : "y";
  const result = [];
  // Intervals consume the previous value and the NEXT category, in input
  // order. Signed extents matter both for reversed bins and compound fills.
  for (let i = 0; i < points.length - Number(interval); i++) {
    const p = points[i], delta = interval ? points[i + 1][category] - p[category] : 1;
    const size = width * delta, start = p[category] + shift * delta - size / 2;
    if (horizontal) appendRectangle(result, baseline, start, p[value], start + size, special);
    else appendRectangle(result, start, baseline, start + size, p[value], special);
  }
  return result;
}
