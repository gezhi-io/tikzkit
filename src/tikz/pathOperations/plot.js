import { evaluateMath } from "../../engine/math.js";
import { splitTopLevel, stripOuterBraces } from "../../engine/options.js";
import { moveToCommand, lineToCommand, closePathCommand } from "../../engine/pathBuilder.js";
import { smoothPlotCommands } from "../../pgf/smoothPlot.js";
import { expandForeachValues } from "../commands/foreach.js";

const handlers = new Set(["smooth", "smooth cycle", "sharp plot", "sharp cycle", "only marks", "xcomb", "ycomb"]);

export function tikzPlotHandler(options) {
  // These TikZ keys assign a handler, even when their optional value is false.
  let handler = "sharp plot";
  for (const key of Object.keys(options)) if (handlers.has(key)) handler = key;
  return handler;
}

export function tikzPlotMarkName(options) {
  let mark = "";
  for (const [key, value] of Object.entries(options)) {
    if (key === "mark") mark = String(Array.isArray(value) ? value.at(-1) : value).trim();
    else if (key === "no marks" || key === "no markers") mark = "";
  }
  return mark === "none" ? "" : mark;
}

function sampleValues(options, env, expressionPlot) {
  const keys = Object.keys(options);
  const explicit = keys.indexOf("samples at");
  // Both domain and samples recalculate samples at; the last write wins.
  if (expressionPlot && explicit > Math.max(keys.indexOf("domain"), keys.indexOf("samples"))) {
    const raw = stripOuterBraces(String(options["samples at"])).trim();
    return raw ? expandForeachValues(splitTopLevel(raw), env).map(value => evaluateMath(value, env.variables)) : [];
  }
  const [from, to] = splitTopLevel(stripOuterBraces(String(options.domain ?? "-5:5")), ":");
  const start = evaluateMath(from, env.variables), end = evaluateMath(to ?? "5", env.variables);
  const count = Math.max(2, Math.min(expressionPlot ? 200 : 500, Math.round(evaluateMath(options.samples ?? 25, env.variables))));
  if (expressionPlot && Math.abs((end - start) / (count - 1)) < .0001) return [start, end];
  return Array.from({ length: count }, (_, i) => start + (end - start) * (i / (count - 1)));
}

export function tikzPlotPoints(segment, options, env, { coordinate, project }) {
  if (segment.kind === "plotCoordinates") return segment.coordinates.map(raw => coordinate(raw, env.variables));
  const expressionPlot = segment.kind === "plot";
  const variable = String(options.variable ?? "x").trim().replace(/^\\/, "");
  return sampleValues(options, env, expressionPlot).map(value => {
    const variables = { ...env.variables, [variable]: value };
    if (expressionPlot) return coordinate(segment.coordinate, variables);
    const y = evaluateMath(segment.expression, { ...variables, x: value }, { dialect: "gnuplot" });
    return Number.isFinite(y) ? project(value, y) : null;
  });
}

export function tikzPlotCommands(points, handler, options, env, connect) {
  if (!points.length || handler === "only marks") return [];
  if (handler === "xcomb" || handler === "ycomb") {
    return points.flatMap(p => [moveToCommand(handler === "xcomb" ? { x: 0, y: p.y } : { x: p.x, y: 0 }), lineToCommand(p)]);
  }
  const smooth = handler === "smooth" || handler === "smooth cycle";
  const closed = handler === "smooth cycle" || handler === "sharp cycle";
  const commands = smooth ? smoothPlotCommands(points, { closed, tension: evaluateMath(options.tension ?? .5, env.variables) })
    : points.map((p, i) => i ? lineToCommand(p) : moveToCommand(p));
  if (handler === "sharp cycle") commands.push(closePathCommand());
  if (connect && !closed) commands[0] = lineToCommand(points[0]);
  return commands;
}
