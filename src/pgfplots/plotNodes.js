import { evaluateMath, parseDimension } from "../engine/math.js";
import { parseOptions } from "../engine/options.js";
import { axisNumber } from "./coordinates.js";
import { formatAxisNumber, formatAxisPoint, formatAxisTickLabel, joinOptions } from "./format.js";
import { evaluateAxisExpression } from "./expressions.js";
import { pgfNumberFormatOptions } from "../pgf/numberFormat.js";
import { isPgfplotsIntervalPlot, pgfplotsIntervalDataPoints } from "./intervalPlots.js";
import { plotColorValue, selectPlotColor } from "./plotStyle.js";

export function renderNodesNearCoords(plot = {}, axisOptions = {}, geometry = {}, plotIndex = 0, barLayout) {
  if (!axisOptions["nodes near coords"] && !plot.options?.["nodes near coords"]) return [];
  const histogram = Boolean(plot.options?.["pgfplots histogram"]);
  const orientation = isPgfplotsIntervalPlot(axisOptions, plot.options || {}, "y") ? "y" : "x";
  // Histogram labels belong to the marks phase, not to rectangle subpaths.
  // It visits the final generated tuple even when that tuple only ends a bar.
  const points = !histogram && isPgfplotsIntervalPlot(axisOptions, plot.options || {}, orientation)
    ? (plot.pgfplotsStacked ? (plot.points || []) : pgfplotsIntervalDataPoints(plot, axisOptions, orientation))
        .filter((point) => !point.stackIgnored)
    : (plot.points || []).filter((point) => !point.stackIgnored);
  const stackedBarAxis = stackedBarOrientation(plot, axisOptions);
  const group = plot.barGroup;
  const style = joinOptions([
    group || histogram ? (axisOptions.font && `font=${axisOptions.font}`) : "font=\\scriptsize",
    nodeNearCoordTextColor(plot.options || {}, plotIndex),
    ...nodeNearCoordStyles(axisOptions),
    ...nodeNearCoordStyles(plot.options || {})
  ]);
  const offset = stackedBarAxis || group || histogram ? 0 : nodeNearCoordOffset(axisOptions, plot.options || {});
  return points.map((point, pointIndex) => {
    const positionedPoint = stackedBarAxis
      ? stackedBarNodePoint(point, axisOptions, stackedBarAxis)
      : point;
    const mapped = plot.is3d && typeof geometry.mapPoint3d === "function"
      ? geometry.mapPoint3d(positionedPoint)
      : geometry.mapPoint(positionedPoint);
    const meta = group ? barPointMeta(point, pointIndex, plot, axisOptions) : undefined;
    const anchor = group ? barLabelAnchor(meta, plot, axisOptions) : stackedBarAxis ? "center" : "south";
    const template = nodeNearCoordTemplate(point, plot, axisOptions, pointIndex, meta);
    const shift = group && barLayout ? barLayout(point).shift : 0;
    const at = offsetPoint(mapped, group?.direction === "y" ? shift : 0, group?.direction === "x" ? shift : offset);
    return `\\node[${joinOptions(["axis near coord", `anchor=${anchor}`, group && "tikzkit tex node anchors", style, ...template.styles])}] at ${formatAxisPoint(at)} {${template.label}};`;
  });
}

function barPointMeta(point, index, plot, axis) {
  const input = String(plot.options?.["point meta"] ?? axis["point meta"] ?? plot.barGroup.direction).trim();
  const field = input === "f(x)" ? "y" : input.replace(/^raw(?=[xyz]$)/, "");
  if (["x", "y", "z"].includes(field)) return { input, value: point[field] };
  if (input === "explicit" || input === "explicit symbolic") return { input, value: point.meta };
  const variables = { y: point.y, z: point.z ?? 0, rawx: point.x, rawy: point.y, coordindex: index };
  return { input, value: evaluateAxisExpression(input, point.x, axis, variables) };
}

function barLabelAnchor(meta, plot, axis) {
  let align = plot.options?.["nodes near coords align"] ?? axis["nodes near coords align"] ?? "auto";
  // Native auto alignment depends on the meta handler, not the sign or the
  // direction of the painted bar. An expression on xbar still defaults above.
  if (align === "auto") align = meta.input === "x" ? "horizontal" : "vertical";
  if (align === "horizontal" || align === "vertical") {
    if (meta.input === "explicit symbolic") return "south";
    return align === "horizontal" ? (meta.value < 0 ? "east" : "west") : (meta.value < 0 ? "north" : "south");
  }
  return ({ left: "east", right: "west", above: "south", below: "north" })[align] || String(align).replace(/^anchor=/, "");
}

function nodeNearCoordTemplate(point, plot = {}, axisOptions = {}, pointIndex = 0, meta) {
  const rawTemplate = plot.options?.["nodes near coords"] ?? axisOptions["nodes near coords"];
  const stackedBarAxis = stackedBarOrientation(plot, axisOptions);
  const fallback = meta ? meta.value : point.meta ?? (stackedBarAxis
    ? point[stackedBarAxis === "x" ? "stackDeltaX" : "stackDeltaY"]
    : (plot.is3d ? point.z : point.y));
  const defaultTemplate = rawTemplate === true || rawTemplate === undefined || rawTemplate === null || String(rawTemplate).trim() === "";
  if (meta && defaultTemplate) {
    if (meta.input === "explicit symbolic") return { label: String(fallback ?? ""), styles: [] };
    if (fallback == null || !Number.isFinite(Number(fallback))) return { label: "", styles: [] };
    const opts = pgfNumberFormatOptions(plot.options, pgfNumberFormatOptions(axisOptions, { fixed: true }));
    const number = formatAxisTickLabel(fallback, opts).replace(/\u2212/g, "-");
    return { label: `$${number}$`, styles: ["tikzkit native math", "tikzkit math number"] };
  }
  if (defaultTemplate) {
    return { label: formatAxisNumber(fallback), styles: [] };
  }

  const bindings = visualizationDependencyBindings(axisOptions, plot.options || {}, point);
  let label = String(rawTemplate);
  label = label.replace(/\\pgfplotspointmeta\b/g, formatAxisNumber(fallback));
  label = label.replace(/\\coordindex\b/g, String(pointIndex));
  label = label.replace(/\\thisrow\s*\{([^{}]+)\}/g, (_match, column) => String(point.columns?.[String(column).trim()] ?? ""));
  for (const [macro, value] of bindings) {
    label = label.replace(new RegExp(`\\\\${escapeRegExp(macro)}(?![A-Za-z@])`, "g"), value);
  }
  label = label.replace(/\\pgfmathparse\s*\{([^{}]*)\}\s*\\pgfmathresult/g, (_match, expression) => {
    const value = evaluateMath(expression);
    return Number.isFinite(value) ? formatAxisNumber(value) : "0";
  });
  return lowerNodeNearCoordTextTemplate(label, !meta);
}

function lowerNodeNearCoordTextTemplate(template, defaultScriptsize) {
  let label = String(template || "").trim();
  const styles = [];
  const rotatebox = unwrapRotatebox(label);
  if (rotatebox) {
    label = rotatebox.content;
    const angle = evaluateMath(rotatebox.angle);
    if (Number.isFinite(angle)) styles.push(`rotate=${formatAxisNumber(angle)}`);
  }

  // PGFPlots' default is `\\pgfmathprintnumber\\pgfplotspointmeta`; its
  // output is the formatted numeric token, not the macro name.  A node's
  // font switch is local in TeX, so carry the common switches into the
  // lowered node options rather than letting the SVG text renderer print it.
  label = label.replace(/\\pgfmathprintnumber(?![A-Za-z@])/g, "");
  const fontMatch = label.match(/\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)(?![A-Za-z@])/);
  if (fontMatch) {
    if (!defaultScriptsize || fontMatch[1] !== "scriptsize") styles.push(`font=\\${fontMatch[1]}`);
    label = label.replace(/\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)(?![A-Za-z@])/g, "");
  }
  return { label: label.trim(), styles };
}

function unwrapRotatebox(value) {
  const prefix = "\\rotatebox";
  if (!value.startsWith(prefix)) return null;
  let cursor = prefix.length;
  const angle = readBalancedBraces(value, cursor);
  if (!angle) return null;
  cursor = angle.end;
  const content = readBalancedBraces(value, cursor);
  if (!content || value.slice(content.end).trim()) return null;
  return { angle: angle.content, content: content.content };
}

function readBalancedBraces(value, start) {
  let cursor = start;
  while (/\s/.test(value[cursor] || "")) cursor += 1;
  if (value[cursor] !== "{") return null;
  const contentStart = cursor + 1;
  let depth = 1;
  cursor += 1;
  for (; cursor < value.length; cursor += 1) {
    if (value[cursor] === "\\") {
      cursor += 1;
      continue;
    }
    if (value[cursor] === "{") depth += 1;
    if (value[cursor] === "}") depth -= 1;
    if (depth === 0) return { content: value.slice(contentStart, cursor), end: cursor + 1 };
  }
  return null;
}

function nodeNearCoordOffset(axisOptions = {}, plotOptions = {}) {
  const merged = {};
  for (const rawStyle of [...nodeNearCoordStyles(axisOptions), ...nodeNearCoordStyles(plotOptions)]) {
    Object.assign(merged, parseOptions(rawStyle));
  }
  const anchor = String(merged.anchor || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim().toLowerCase();
  // PGFPlots' default near-coordinate placement raises labels only when the
  // style itself does not supply a displacement. A user `shift` already
  // carries the intended x/y offset, so adding the fallback raises rotated
  // histogram labels twice.
  const hasExplicitShift = ["shift", "xshift", "yshift"].some((key) => merged[key] !== undefined);
  return anchor === "center" || hasExplicitShift ? 0 : 0.08;
}

function stackedBarOrientation(plot = {}, axisOptions = {}) {
  if ((plot.points || []).some((point) => Number.isFinite(Number(point.stackBaseX))) && Boolean(
    axisOptions["xbar stacked"] || axisOptions.xbar || plot.options?.xbar
  )) return "x";
  if ((plot.points || []).some((point) => Number.isFinite(Number(point.stackBaseY))) && Boolean(
    axisOptions["ybar stacked"] || axisOptions.ybar || plot.options?.ybar
  )) return "y";
  return null;
}

function stackedBarNodePoint(point, axisOptions = {}, orientation = "y") {
  const rawOffset = axisNumber(axisOptions["nodes near coords bar offset"], 0.5);
  const offset = Number.isFinite(rawOffset) ? rawOffset : 0.5;
  const valueKey = orientation;
  const baseKey = orientation === "x" ? "stackBaseX" : "stackBaseY";
  const base = Number(point[baseKey]);
  return {
    ...point,
    [valueKey]: base + (Number(point[valueKey]) - base) * offset
  };
}

function visualizationDependencyBindings(axisOptions, plotOptions, point) {
  const declarations = [axisOptions["visualization depends on"], plotOptions["visualization depends on"]]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value !== undefined && value !== null && value !== true);
  const bindings = new Map();
  for (const declaration of declarations) {
    const match = String(declaration).match(/(?:\bvalue\s+)?\\thisrow\s*\{([^{}]+)\}\s*\\as\s*\\([A-Za-z@]+)/);
    if (!match) continue;
    bindings.set(match[2], String(point.columns?.[match[1].trim()] ?? ""));
  }
  return bindings;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nodeNearCoordTextColor(plotOptions, plotIndex) {
  // PGFPlots inserts the node while the current plot-coordinate style is
  // active, so an implicit cycle color applies here too. Later node styles
  // remain after this option in renderNodesNearCoords and can override it.
  const color = plotColorValue(selectPlotColor(plotOptions, plotIndex));
  return color && color !== "black" ? `text=${color}` : "";
}

function nodeNearCoordStyles(options = {}) {
  return [
    options["every node near coord/.style"],
    options["every node near coord/.append style"]
  ].flatMap((value) => Array.isArray(value) ? value : [value]).filter((value) => value && value !== true).map(String);
}

export function renderAxisPlotInlineNodes(nodes = [], mappedPoints = [], plotColor = "") {
  if (!nodes.length || !mappedPoints.length) return [];
  const commands = [];
  for (const node of nodes) {
    const base = interpolatePolylinePoint(mappedPoints, axisNumber(node.options?.pos, node.options?.pos === undefined ? 1 : 0.5));
    if (!base) continue;
    const shift = {
      x: parseDimension(String(node.options?.xshift || "0"), {}),
      y: parseDimension(String(node.options?.yshift || "0"), {})
    };
    const point = offsetPoint(base, Number.isFinite(shift.x) ? shift.x : 0, Number.isFinite(shift.y) ? shift.y : 0);
    const anchor = inlineAxisNodeAnchor(node.options || {});
    const inheritedTextColor = axisInlineNodeTextColor(node.options || {}, plotColor);
    const style = joinOptions([
      "axis plot node",
      `anchor=${anchor}`,
      node.options?.font ? `font=${node.options.font}` : "",
      inheritedTextColor ? `text=${inheritedTextColor}` : "",
      axisInlineNodeOption("pin", node.options?.pin),
      axisInlineNodeOption("label", node.options?.label),
      axisInlineNodeOption("pin distance", node.options?.["pin distance"]),
      axisInlineNodeOption("pin edge", node.options?.["pin edge"]),
      node.options?.fill && node.options.fill !== true ? `fill=${node.options.fill}` : "",
      node.options?.draw && node.options.draw !== true ? `draw=${node.options.draw}` : node.options?.draw === true ? "draw" : ""
    ]);
    if (Math.hypot(point.x - base.x, point.y - base.y) > 1e-6 && (node.options?.["append after command"] || anchor.includes("west") || anchor.includes("east"))) {
      commands.push(`\\draw[axis plot node connector, gray, thin] ${formatAxisPoint(base)} -- ${formatAxisPoint(point)};`);
    }
    commands.push(`\\node[${style}] at ${formatAxisPoint(point)} {${node.text}};`);
  }
  return commands;
}

function axisInlineNodeTextColor(options = {}, plotColor = "") {
  if (options.text && options.text !== true) return "";
  if (options.color && options.color !== true) return "";
  const color = plotColorValue(plotColor);
  return color && color !== "black" ? color : "";
}

function axisInlineNodeOption(key, value) {
  if (value === undefined || value === null || value === false || value === "") return "";
  if (Array.isArray(value)) return value.map((item) => axisInlineNodeOption(key, item)).filter(Boolean).join(", ");
  if (value === true) return key;
  return `${key}={${value}}`;
}

function interpolatePolylinePoint(points, rawPos) {
  if (!points.length) return null;
  if (points.length === 1) return points[0];
  const pos = Math.max(0, Math.min(1, Number.isFinite(rawPos) ? rawPos : 0.5));
  const lengths = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    lengths.push(length);
    total += length;
  }
  if (total <= 1e-9) return points[0];
  let target = total * pos;
  for (let index = 1; index < points.length; index += 1) {
    const length = lengths[index - 1];
    if (target <= length || index === points.length - 1) {
      const t = length <= 1e-9 ? 0 : target / length;
      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * t,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * t
      };
    }
    target -= length;
  }
  return points[points.length - 1];
}

function inlineAxisNodeAnchor(options = {}) {
  const explicit = String(options.anchor || "").trim();
  if (explicit) return explicit;
  if (options.above) return "south";
  if (options.below) return "north";
  if (options.left) return "east";
  if (options.right) return "west";
  return "center";
}

function offsetPoint(point, x, y) {
  return { x: point.x + x, y: point.y + y };
}
