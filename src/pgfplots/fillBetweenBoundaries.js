import { normalizeOptions, parseOptions, splitTopLevel, stripTexComments } from "../engine/options.js";
import { curveToCommand, lineToCommand, moveToCommand } from "../engine/pathBuilder.js";
import { namedAxisLinePlotCommands } from "./addplotLowering.js";
import { parseOptionalOptions } from "./addplotParser.js";
import { transformAxisStatementCoordinates } from "./axisOverlay.js";
import { axisPlotPathName } from "./plotPath.js";

const number = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
const pair = new RegExp(String.raw`\s*\(\s*(${number})\s*,\s*(${number})\s*\)`, "y");

// Consume the entire projected path. Unknown operations, unresolved controls
// and relative coordinates invalidate it, even after a valid leading segment.
function overlayCommands(canvas) {
  const source = canvas.trim();
  const commands = [];
  let cursor = 0;
  const take = re => {
    re.lastIndex = cursor;
    const match = re.exec(source);
    if (match) cursor = re.lastIndex;
    return match;
  };
  const point = () => {
    const m = take(pair);
    return m && { x: Number(m[1]), y: Number(m[2]) };
  };
  while (cursor < source.length) {
    const last = commands.at(-1);
    if (take(/\s*\.\.\s*controls\b/y)) {
      const c1 = point(), c2 = c1 && take(/\s*and\b/y) && point();
      const to = c2 && take(/\s*\.\./y) && point();
      if (!last || !to) return [];
      commands.push(curveToCommand(c1, c2, to));
    } else {
      const op = take(/\s*(--|-\||\|-)/y)?.[1];
      const to = point();
      if (!to || (op && !last)) return [];
      if (op === "-|") commands.push(lineToCommand(to.x, last.y));
      if (op === "|-") commands.push(lineToCommand(last.x, to.y));
      commands.push(op ? lineToCommand(to) : moveToCommand(to));
    }
  }
  return commands;
}

function pathOptions(statement, cursor) {
  const keys = [];
  let group;
  while ((group = parseOptionalOptions(statement, cursor)).end > cursor) {
    keys.push(group.raw);
    cursor = group.end;
  }
  return { options: parseOptions(keys.join(",")), path: statement.slice(cursor) };
}

function overlayBoundary(command, spec, ranges, geometry, options) {
  const { semantic } = normalizeOptions(command, spec.options,
    { styles: options.pgfplotsStyleDefinitions || {}, variables: options.variables || {} });
  // Paint cannot change a named soft path. Do not discard an unknown style,
  // transform or other geometric modifier and then claim its unmodified path.
  if (Object.keys(semantic).some(key =>
    !/^(?:\/tikz\/)?name path(?: global)?$/.test(key) && key !== "tikzkit current color")) return [];
  return overlayCommands(transformAxisStatementCoordinates(spec.path, ranges, geometry));
}

export function namedFillBetweenBoundaries(body, addplots, axisOptions, ranges, geometry, options = {}) {
  const boundaries = new Map();
  if (geometry.is3d || axisOptions["pgfplots 3d surface"]) return boundaries;
  const store = (name, commands) => {
    if (commands.some(c => c.type !== "moveTo") &&
        commands.every(({ type, ...operands }) => Object.values(operands).every(Number.isFinite))) boundaries.set(name, commands);
    else boundaries.delete(name);
  };
  for (const plot of addplots || []) {
    const name = axisPlotPathName(plot.options);
    if (name) store(name, namedAxisLinePlotCommands(plot, axisOptions, ranges, geometry, options));
  }
  for (const statement of splitTopLevel(stripTexComments(body || ""), ";")) {
    const match = /^\\(draw|path|filldraw|fill)\b/.exec(statement);
    if (!match) continue;
    const spec = pathOptions(statement, match[0].length);
    const name = axisPlotPathName(spec.options);
    if (name) store(name, overlayBoundary(match[1], spec, ranges, geometry, options));
  }
  return boundaries;
}
