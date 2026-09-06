import { createScaledTickFormat, formatAxisNumber, formatAxisPoint, formatScaledAxisTickLabel, joinOptions } from "./format.js";
import { pgfplotsViewDirection } from "./geometry.js";
import { pgfplotsSurfaceColor } from "./surface.js";
import {
  axisAutoMajorTickCount,
  axisMinorTickValues,
  axisRenderedTickLabels,
  axisTickLabelAlignment,
  axisTickLabelAnchor,
  axisTickLabelInnerSep,
  axisTickLabelPositionOptions,
  axisTickLabelRotation,
  axisTickLabelStyleOptions,
  axisTickLabelTextOption,
  axisTickNumberFormat,
  axisTickValues,
  extraAxisTickPassOptions,
  tickDistanceValues as axisTickDistanceValues
} from "./ticks.js";
import { parseDimension } from "../engine/math.js";
import { parseOptions } from "../engine/options.js";
import { shouldRenderAnyAxisGrid } from "./grid.js";
import { isLogAxis } from "./ranges.js";
import { axisLogBase, axisLogTickLabel } from "./logAxis.js";
import { pgfplotsPictureFontScale, pgfplotsRoleFontCommand } from "./fonts.js";
import { parseTikzFontPatch } from "../tex/fontSpec.js";
import {
  estimateFormulaBox,
  formulaTotalHeight,
  measurePlainTextTeXBoxPt,
  parseMathText
} from "../tikz/textMetrics.js";

export function renderAxis3DBox(axisOptions = {}, ranges, geometry) {
  const style = "axis line, black, line width=0.4pt";
  const axisLines = String(axisOptions["axis lines"] ?? axisOptions.axis ?? "box").trim().toLowerCase();
  if (axisLines === "none" || axisLines === "false") return [];
  if (["left", "middle", "center"].includes(axisLines)) {
    const openStyle = `${style}, -stealth`;
    const edges = axis3DTickLabelEdges(ranges, geometry);
    return ["x", "y", "z"].map((axis) =>
      `\\draw[${openStyle}] ${formatAxisPoint(edges[axis].from)} -- ${formatAxisPoint(edges[axis].to)};`
    );
  }
  const foreground = axis3DForegroundFaces(axisOptions, geometry);
  return axis3DBoxEdges(ranges, geometry)
    .filter((edge) => !axis3DEdgeIsForeground(edge, foreground))
    .map((edge) => `\\draw[${style}] ${formatAxisPoint(edge.from)} -- ${formatAxisPoint(edge.to)};`);
}

export function renderAxis3DBoxForeground(axisOptions = {}, ranges, geometry) {
  const style = "axis line, black, line width=0.4pt";
  const axisLines = String(axisOptions["axis lines"] ?? axisOptions.axis ?? "box").trim().toLowerCase();
  if (axisLines === "none" || axisLines === "false" || ["left", "middle", "center"].includes(axisLines)) return [];
  if (axis3DBoxMode(axisOptions) === "background") return [];
  const foreground = axis3DForegroundFaces(axisOptions, geometry);
  return axis3DBoxEdges(ranges, geometry)
    .filter((edge) => axis3DEdgeIsForeground(edge, foreground))
    .map((edge) => `\\draw[${style}] ${formatAxisPoint(edge.from)} -- ${formatAxisPoint(edge.to)};`);
}

export function renderAxis3DGrid(axisOptions = {}, ranges, geometry) {
  const background = axis3DBackgroundSides(axisOptions, ranges);
  const commands = [];
  if (shouldRenderAnyAxisGrid(axisOptions)) {
    const ticks = axis3DTickValues(axisOptions, ranges, geometry);
    const minorTicks = axis3DMinorTickValues(axisOptions, ranges, ticks);
    const style = axis3DGridStyle(axisOptions);
    appendAxis3DGridLines(commands, style, geometry, ranges, background, minorTicks, axisOptions, true);
    appendAxis3DGridLines(commands, style, geometry, ranges, background, ticks, axisOptions, false);
  }
  for (const axis of ["x", "y", "z"]) {
    const pass = extraAxisTickPassOptions(axisOptions, axis, [], ranges);
    if (!pass || !shouldRenderAnyAxisGrid(pass)) continue;
    const ticks = { x: [], y: [], z: [], [axis]: pass["pgfplots extra tick values"] || [] };
    appendAxis3DGridLines(
      commands,
      axis3DGridStyle(pass, axis),
      geometry,
      ranges,
      background,
      ticks,
      pass,
      false
    );
  }
  return dedupeAdjacentCommands(commands);
}

function axis3DGridStyle(axisOptions = {}, axis = "") {
  return joinOptions([
    "axis 3d grid",
    axisOptions["axis grid color"] || "black!25",
    `line width=${axisOptions["axis grid line width"] || "0.4pt"}`,
    axisOptions["grid style"] || axisOptions["major grid style"] || "",
    axis ? axisOptions[`${axis} major grid style`] || "" : ""
  ]);
}

export function renderAxis3DTicks(axisOptions, ranges, geometry) {
  const commands = [];
  const tickLength = parseDimension(String(axisOptions["major tick length"] || axisOptions.tickwidth || "0.15cm"), {});
  const tickLabelStyle = (options, axis, anchor) => {
    const style = axisTickLabelStyleOptions(options, axis);
    const font = pgfplotsRoleFontCommand("tick", options, axis3DFontOption(options, axis, "tick"));
    const innerSep = axisTickLabelInnerSep(options, axis) ?? defaultPerspectiveTickLabelInnerSep(options, axis);
    return joinOptions([
      "axis tick label",
      `anchor=${axisTickLabelAnchor(style, anchor, axis)}`,
      axisTickLabelRotation(style),
      axisTickLabelAlignment(style),
      ...axisTickLabelPositionOptions(style),
      `font=${font}`,
      `inner sep=${innerSep}`,
      axisTickLabelTextOption(style)
    ]);
  };
  const { x: resolvedXTicks, y: resolvedYTicks, z: resolvedZTicks } = axis3DTickValues(axisOptions, ranges, geometry);
  const minorTicks = axis3DMinorTickValues(axisOptions, ranges, {
    x: resolvedXTicks,
    y: resolvedYTicks,
    z: resolvedZTicks
  });
  const zLog = isLogAxis(axisOptions, "z");
  const zTickFormat = zLog ? null : createScaledTickFormat(resolvedZTicks, scaledTickOptions(axisOptions, "z"));
  const zTickPrecision = zTickFormat ? scaledTickLabelPrecision(resolvedZTicks, zTickFormat) : undefined;
  const labels = axis3DRenderedTickLabels(
    axisOptions,
    { x: resolvedXTicks, y: resolvedYTicks, z: resolvedZTicks },
    zTickFormat,
    zTickPrecision
  );
  const layout = axis3DAnnotationLayout(axisOptions, ranges, geometry);
  const oppositeTickAxes = Object.fromEntries(["x", "y", "z"].map((axis) => [axis, shouldRenderOpposite3DTicks(axisOptions, axis)]));
  const boxTickEdges = Object.values(oppositeTickAxes).some(Boolean) ? axis3DBoxTickEdges(axisOptions, ranges, geometry) : {};
  const center = Object.values(oppositeTickAxes).some(Boolean) ? projectedBoxCenter(ranges, geometry) : null;
  const tickNormal = (axis, edge) => oppositeTickAxes[axis] ? annotationNormal(edge, center, axis) : edge.normal;
  const minorTickLength = parseDimension(String(axisOptions["minor tick length"] || axisOptions.subtickwidth || "0.1cm"), {});
  for (const [axis, values] of Object.entries(minorTicks)) {
    for (const value of values) {
      const edge = layout[axis];
      const coordinate = axis === "x"
        ? { x: value, y: edge.y, z: edge.z }
        : axis === "y"
          ? { x: edge.x, y: value, z: edge.z }
          : { x: edge.x, y: edge.y, z: value };
      const base = geometry.mapPoint3d(coordinate);
      const to = offsetAlongNormal(base, invertVector(tickNormal(axis, edge)), minorTickLength);
      const minorStyle = "axis minor tick, gray, line width=0.2pt";
      commands.push(`\\draw[${minorStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
      if (oppositeTickAxes[axis]) {
        commands.push(...additionalBoxTickCommands(axis, value, layout[axis], boxTickEdges[axis], center, geometry, minorStyle, minorTickLength));
      }
    }
  }
  for (const [index, x] of resolvedXTicks.entries()) {
    const tickStyle = axis3DTickStyle(axisOptions, "x");
    const base = geometry.mapPoint3d({ x, y: layout.x.y, z: layout.x.z });
    const to = offsetAlongNormal(base, invertVector(tickNormal("x", layout.x)), tickLength);
    commands.push(`\\draw[${tickStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
    if (oppositeTickAxes.x) commands.push(...additionalBoxTickCommands("x", x, layout.x, boxTickEdges.x, center, geometry, tickStyle, tickLength));
    if (labels.x[index] !== "") {
      const placement = axis3DTickLabelPlacement(axisOptions, "x", layout.x, base, labels.x[index], tickLength);
      commands.push(`\\node[${tickLabelStyle(axisOptions, "x", placement.anchor)}] at ${formatAxisPoint(placement.point)} {${labels.x[index]}};`);
    }
  }
  for (const [index, y] of resolvedYTicks.entries()) {
    const tickStyle = axis3DTickStyle(axisOptions, "y");
    const base = geometry.mapPoint3d({ x: layout.y.x, y, z: layout.y.z });
    const to = offsetAlongNormal(base, invertVector(tickNormal("y", layout.y)), tickLength);
    commands.push(`\\draw[${tickStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
    if (oppositeTickAxes.y) commands.push(...additionalBoxTickCommands("y", y, layout.y, boxTickEdges.y, center, geometry, tickStyle, tickLength));
    if (labels.y[index] !== "") {
      const placement = axis3DTickLabelPlacement(axisOptions, "y", layout.y, base, labels.y[index], tickLength);
      commands.push(`\\node[${tickLabelStyle(axisOptions, "y", placement.anchor)}] at ${formatAxisPoint(placement.point)} {${labels.y[index]}};`);
    }
  }
  for (const [index, z] of resolvedZTicks.entries()) {
    const tickStyle = axis3DTickStyle(axisOptions, "z");
    const base = geometry.mapPoint3d({ x: layout.z.x, y: layout.z.y, z });
    const to = offsetAlongNormal(base, invertVector(tickNormal("z", layout.z)), tickLength);
    commands.push(`\\draw[${tickStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
    if (oppositeTickAxes.z) commands.push(...additionalBoxTickCommands("z", z, layout.z, boxTickEdges.z, center, geometry, tickStyle, tickLength));
    if (labels.z[index] !== "") {
      const placement = axis3DTickLabelPlacement(axisOptions, "z", layout.z, base, labels.z[index], tickLength);
      commands.push(`\\node[${tickLabelStyle(axisOptions, "z", placement.anchor)}] at ${formatAxisPoint(placement.point)} {${labels.z[index]}};`);
    }
  }
  if (zTickFormat?.scaled) {
    // PGFPlots places this at `zticklabel* cs:1.2,-0.3em`: continue the
    // selected z tick-label edge beyond its upper endpoint instead of
    // crowding the highest numeric tick.
    const scaleBase = pointAlongProjectedEdge(layout.z, 1.2);
    const font = pgfplotsRoleFontCommand("tick", axisOptions, axis3DFontOption(axisOptions, "z", "tick"));
    commands.push(`\\node[axis tick scale label, anchor=${axisTickAnnotationAnchor(axisOptions, "z", layout.z.normal)}, font=${font}, inner sep=0pt, outer sep=0pt] at ${formatAxisPoint(scaleBase)} {$${zTickFormat.scaleLabel}$};`);
  }
  appendExtraAxis3DTicks(commands, axisOptions, ranges, geometry, layout, boxTickEdges, center, tickLabelStyle);
  return dedupeAdjacentCommands(commands.filter(Boolean));
}

function appendExtraAxis3DTicks(commands, axisOptions, ranges, geometry, layout, boxTickEdges, center, tickLabelStyle) {
  for (const axis of ["x", "y", "z"]) {
    const pass = extraAxisTickPassOptions(axisOptions, axis, [], ranges);
    if (!pass) continue;
    const values = pass["pgfplots extra tick values"] || [];
    const labels = axisRenderedTickLabels(
      pass,
      axis,
      pass[`${axis}ticklabels`],
      values,
      axisTickNumberFormat(pass, axis),
      pass[`${axis}ticklabel`]
    );
    const edge = layout[axis];
    const tickLength = parseDimension(String(pass["major tick length"] || pass.tickwidth || "0.15cm"), {});
    const tickStyle = axis3DTickStyle(pass, axis);
    const opposite = shouldRenderOpposite3DTicks(pass, axis);
    for (const [index, value] of values.entries()) {
      const coordinate = axis === "x"
        ? { x: value, y: edge.y, z: edge.z }
        : axis === "y"
          ? { x: edge.x, y: value, z: edge.z }
          : { x: edge.x, y: edge.y, z: value };
      const base = geometry.mapPoint3d(coordinate);
      const primaryTickNormal = opposite ? annotationNormal(edge, center, axis) : edge.normal;
      const to = offsetAlongNormal(base, invertVector(primaryTickNormal), tickLength);
      commands.push(`\\draw[${tickStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
      if (opposite) {
        commands.push(...additionalBoxTickCommands(axis, value, edge, boxTickEdges[axis], center, geometry, tickStyle, tickLength));
      }
      if (labels[index] !== "") {
        const placement = axis3DTickLabelPlacement(pass, axis, edge, base, labels[index], tickLength);
        commands.push(`\\node[${tickLabelStyle(pass, axis, placement.anchor)}] at ${formatAxisPoint(placement.point)} {${labels[index]}};`);
      }
    }
  }
}

function axis3DTickStyle(axisOptions = {}, axis = "x", kind = "major") {
  return joinOptions([
    kind === "minor" ? "axis minor tick" : "axis tick",
    axisOptions[`${axis} axis tick color`] || axisOptions["axis tick color"] || "gray",
    `line width=${axisOptions["axis tick line width"] || "0.2pt"}`,
    axisOptions["tick style"] || "",
    axisOptions[`${kind} tick style`] || "",
    axisOptions[`${axis} tick style`] || axisOptions[`${axis}tick style`] || "",
    axisOptions[`${axis} ${kind} tick style`] || ""
  ]);
}

function shouldRenderOpposite3DTicks(axisOptions = {}, axis) {
  const raw = axisOptions[`axis ${axis} line`] ?? axisOptions[`axis ${axis} line*`] ?? axisOptions["axis lines"] ?? axisOptions.axis ?? "box";
  return String(raw).trim().toLowerCase() === "box";
}

function defaultPerspectiveTickLabelInnerSep(axisOptions = {}, axis) {
  return ".3333em";
}

function axis3DTickValues(axisOptions = {}, ranges = {}, geometry = {}) {
  const xTicks = axisTickValues(axisOptions.xtick, "x", []);
  const yTicks = axisTickValues(axisOptions.ytick, "y", []);
  const zTicks = axisTickValues(axisOptions.ztick, "z", []);
  const xDistanceTicks = axisTickDistanceValues(axisOptions, "x", ranges.xMin, ranges.xMax);
  const yDistanceTicks = axisTickDistanceValues(axisOptions, "y", ranges.yMin, ranges.yMax);
  const zDistanceTicks = axisTickDistanceValues(axisOptions, "z", ranges.zMin, ranges.zMax);
  return {
    x: axis3DTicksExplicitlyEmpty(axisOptions.xtick) ? [] : xTicks.length ? xTicks : xDistanceTicks.length ? xDistanceTicks : automaticAxis3DTickValuesForAxis(axisOptions, "x", ranges.xMin, ranges.xMax, axis3DAutoMajorTickCount(axisOptions, "x", ranges, geometry)),
    y: axis3DTicksExplicitlyEmpty(axisOptions.ytick) ? [] : yTicks.length ? yTicks : yDistanceTicks.length ? yDistanceTicks : automaticAxis3DTickValuesForAxis(axisOptions, "y", ranges.yMin, ranges.yMax, axis3DAutoMajorTickCount(axisOptions, "y", ranges, geometry)),
    z: axis3DTicksExplicitlyEmpty(axisOptions.ztick) ? [] : zTicks.length ? zTicks : zDistanceTicks.length ? zDistanceTicks : automaticAxis3DTickValuesForAxis(axisOptions, "z", ranges.zMin, ranges.zMax, axis3DAutoMajorTickCount(axisOptions, "z", ranges, geometry))
  };
}

function axis3DMinorTickValues(axisOptions = {}, ranges = {}, majorTicks = {}) {
  return {
    x: axisMinorTickValues(axisOptions, "x", majorTicks.x || [], ranges.xMin, ranges.xMax),
    y: axisMinorTickValues(axisOptions, "y", majorTicks.y || [], ranges.yMin, ranges.yMax),
    z: axisMinorTickValues(axisOptions, "z", majorTicks.z || [], ranges.zMin, ranges.zMax)
  };
}

function axis3DTicksExplicitlyEmpty(raw) {
  if (raw === undefined || raw === null || raw === false) return false;
  const value = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim().toLowerCase();
  return value === "" || value === "none" || value === "\\empty" || value === "empty";
}

function automaticAxis3DTickValuesForAxis(axisOptions, axis, min, max, count) {
  return isLogAxis(axisOptions, axis)
    ? automaticLogAxis3DTickValues(axisOptions, axis, min, max, count)
    : automaticAxis3DTickValues(min, max, count);
}

function automaticLogAxis3DTickValues(axisOptions, axis, min, max, count) {
  const base = axisLogBase(axisOptions, axis);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) return [];
  const minExponent = Math.ceil(Math.log(min) / Math.log(base) - 1e-10);
  const maxExponent = Math.floor(Math.log(max) / Math.log(base) + 1e-10);
  const exponentSpan = Math.max(0, maxExponent - minExponent);
  const exponentStep = Math.max(1, Math.ceil(exponentSpan / Math.max(1, Number(count) || 3)));
  const firstExponent = Math.ceil(minExponent / exponentStep) * exponentStep;
  const values = [];
  for (let exponent = firstExponent; exponent <= maxExponent; exponent += exponentStep) {
    values.push(Number((base ** exponent).toPrecision(12)));
  }
  return values;
}

function formatAxis3DTickLabel(axisOptions, axis, value) {
  return isLogAxis(axisOptions, axis) && value > 0
    ? axisLogTickLabel(axisOptions, axis, value)
    : formatAxisNumber(value);
}

function axis3DRenderedTickLabels(axisOptions, ticks, zTickFormat, zTickPrecision) {
  const defaults = {
    x: ticks.x.map((value) => formatAxis3DTickLabel(axisOptions, "x", value)),
    y: ticks.y.map((value) => formatAxis3DTickLabel(axisOptions, "y", value)),
    z: ticks.z.map((value) => isLogAxis(axisOptions, "z")
      ? formatAxis3DTickLabel(axisOptions, "z", value)
      : formatScaledAxisTickLabel(value, zTickFormat, { precision: zTickPrecision }))
  };
  for (const axis of ["x", "y", "z"]) {
    const raw = axisOptions[`${axis}ticklabels`];
    const template = axisOptions[`${axis}ticklabel`];
    if (!hasCustomAxis3DTickLabels(raw, template)) continue;
    defaults[axis] = axisRenderedTickLabels(
      axisOptions,
      axis,
      raw,
      ticks[axis],
      axisTickNumberFormat(axisOptions, axis),
      template
    );
  }
  return defaults;
}

function hasCustomAxis3DTickLabels(raw, template) {
  if (raw !== undefined && raw !== null && raw !== false) return true;
  const value = String(template ?? "").trim();
  return Boolean(value) && value !== "true" && value !== "false";
}

function automaticAxis3DTickValues(min, max, count) {
  return majorAxis3DTickValues(min, max, count).filter((tick) => !autoAxis3DTickOutsideRange(tick, min, max));
}

function majorAxis3DTickValues(min, max, maxTicks = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [];
  const span = max - min;
  const rawStep = Math.abs(span) / Math.max(1, maxTicks - 1);
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const fraction = rawStep / base;
  const tolerance = 1e-9;
  const niceFraction =
    fraction < 1.5 - tolerance ? 1 : fraction < 3.5 - tolerance ? 2 : fraction < 7.5 - tolerance ? 5 : 10;
  const step = niceFraction * base;
  const start = Math.ceil(min / step) * step;
  const values = [];
  for (let value = start; value <= max + step * 0.2; value += step) {
    values.push(roundAxis3DTick(value, min, max));
    if (values.length >= 200) break;
  }
  return values;
}

function axis3DAutoMajorTickCount(axisOptions = {}, axis, ranges = {}, geometry = {}) {
  const projectedLength = axis3DProjectedAxisLength(axis, ranges, geometry);
  if (projectedLength > 0) {
    const spacing = axis3DMaxSpaceBetweenTicks(axisOptions);
    const minimum = axis3DMinimumTickCount(axisOptions);
    return Math.max(minimum, Math.floor(projectedLength / spacing) + 1);
  }
  if (axis === "z") return axisAutoMajorTickCount("y", geometry, 6);
  return axisAutoMajorTickCount(axis, geometry, 7);
}

function axis3DMaxSpaceBetweenTicks(axisOptions = {}) {
  const raw = axisOptions["max space between ticks"];
  const source = raw === undefined || raw === null || raw === "" ? "35pt" : /^[-+]?\d*\.?\d+$/.test(String(raw).trim()) ? `${String(raw).trim()}pt` : String(raw);
  const parsed = parseDimension(source, {});
  return Number.isFinite(parsed) && parsed > 0 ? parsed : parseDimension("35pt", {});
}

function axis3DMinimumTickCount(axisOptions = {}) {
  const parsed = Math.floor(Number(axisOptions["try min ticks"]));
  // PGFPlots applies `every 3d description` after the generic axis
  // defaults. That style lowers `try min ticks` from four to three so
  // compact projected axes do not become crowded with labels.
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : 3;
}

function axis3DProjectedAxisLength(axis, ranges = {}, geometry = {}) {
  if (typeof geometry.mapPoint3d !== "function") return 0;
  const from = {
    x: Number.isFinite(ranges.xMin) ? ranges.xMin : 0,
    y: Number.isFinite(ranges.yMin) ? ranges.yMin : 0,
    z: Number.isFinite(ranges.zMin) ? ranges.zMin : 0
  };
  const to = { ...from };
  if (axis === "x") to.x = Number.isFinite(ranges.xMax) ? ranges.xMax : from.x + 1;
  if (axis === "y") to.y = Number.isFinite(ranges.yMax) ? ranges.yMax : from.y + 1;
  if (axis === "z") to.z = Number.isFinite(ranges.zMax) ? ranges.zMax : from.z + 1;
  const start = geometry.mapPoint3d(from);
  const end = geometry.mapPoint3d(to);
  return Math.hypot((end.x || 0) - (start.x || 0), (end.y || 0) - (start.y || 0));
}

function axis3DGridLine(style, geometry, from, to) {
  return `\\draw[${style}] ${formatAxisPoint(geometry.mapPoint3d(from))} -- ${formatAxisPoint(geometry.mapPoint3d(to))};`;
}

function appendAxis3DGridLines(commands, style, geometry, ranges, background, ticks, axisOptions, minor) {
  for (const axis of ["x", "y", "z"]) {
    if (minor && !shouldRenderMinor3DGrid(axisOptions, axis)) continue;
    for (const value of ticks[axis] || []) {
      if (axis === "x") {
        commands.push(axis3DGridLine(style, geometry, { x: value, y: ranges.yMin, z: background.z }, { x: value, y: ranges.yMax, z: background.z }));
        commands.push(axis3DGridLine(style, geometry, { x: value, y: background.y, z: ranges.zMin }, { x: value, y: background.y, z: ranges.zMax }));
      } else if (axis === "y") {
        commands.push(axis3DGridLine(style, geometry, { x: ranges.xMin, y: value, z: background.z }, { x: ranges.xMax, y: value, z: background.z }));
        commands.push(axis3DGridLine(style, geometry, { x: background.x, y: value, z: ranges.zMin }, { x: background.x, y: value, z: ranges.zMax }));
      } else {
        commands.push(axis3DGridLine(style, geometry, { x: ranges.xMin, y: background.y, z: value }, { x: ranges.xMax, y: background.y, z: value }));
        commands.push(axis3DGridLine(style, geometry, { x: background.x, y: ranges.yMin, z: value }, { x: background.x, y: ranges.yMax, z: value }));
      }
    }
  }
}

function shouldRenderMinor3DGrid(axisOptions = {}, axis) {
  const axisSpecific = axisOptions[`${axis}minorgrids`] ?? axisOptions[`${axis} minor grids`];
  if (axisSpecific !== undefined && axisSpecific !== null && axisSpecific !== "") {
    return !["false", "none", "off", "0"].includes(String(axisSpecific).trim().toLowerCase());
  }
  const grid = String(axisOptions.grid || "").trim().toLowerCase();
  return grid === "both" || grid === "minor";
}

function axis3DBackgroundSides(axisOptions, ranges) {
  const view = pgfplotsViewDirection(axisOptions);
  return {
    x: view.x >= 0 ? ranges.xMax : ranges.xMin,
    y: view.y >= 0 ? ranges.yMax : ranges.yMin,
    z: view.z >= 0 ? ranges.zMax : ranges.zMin
  };
}

function axis3DTickLabelEdges(ranges, geometry) {
  const candidates = axis3DParallelEdges(ranges, geometry);
  return {
    x: chooseProjectedEdge(candidates.x, "y"),
    y: chooseProjectedEdge(candidates.y, "y"),
    z: chooseProjectedEdge(candidates.z, "x")
  };
}

function axis3DBoxTickEdges(axisOptions, ranges, geometry) {
  const candidates = axis3DParallelEdges(ranges, geometry);
  const foreground = axis3DForegroundSides(axisOptions, ranges, geometry);
  return {
    x: candidates.x.filter((edge) => edge.y !== foreground.y || edge.z !== foreground.z),
    y: candidates.y.filter((edge) => edge.x !== foreground.x || edge.z !== foreground.z),
    z: candidates.z.filter((edge) => edge.x !== foreground.x || edge.y !== foreground.y)
  };
}

function axis3DParallelEdges(ranges, geometry) {
  return {
    x: [
      projectedEdge(geometry, ranges, { y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMin }),
      projectedEdge(geometry, ranges, { y: ranges.yMin, z: ranges.zMax }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMax }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMax }),
      projectedEdge(geometry, ranges, { y: ranges.yMax, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMin }),
      projectedEdge(geometry, ranges, { y: ranges.yMax, z: ranges.zMax }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMax }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMax })
    ],
    y: [
      projectedEdge(geometry, ranges, { x: ranges.xMin, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMin }),
      projectedEdge(geometry, ranges, { x: ranges.xMin, z: ranges.zMax }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMax }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMax }),
      projectedEdge(geometry, ranges, { x: ranges.xMax, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMin }),
      projectedEdge(geometry, ranges, { x: ranges.xMax, z: ranges.zMax }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMax }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMax })
    ],
    z: [
      projectedEdge(geometry, ranges, { x: ranges.xMin, y: ranges.yMin }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMax }),
      projectedEdge(geometry, ranges, { x: ranges.xMin, y: ranges.yMax }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMax }),
      projectedEdge(geometry, ranges, { x: ranges.xMax, y: ranges.yMin }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMax }),
      projectedEdge(geometry, ranges, { x: ranges.xMax, y: ranges.yMax }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMax })
    ]
  };
}

function projectedEdge(geometry, ranges, edge, from, to) {
  const projectedFrom = finitePoint(geometry.mapPoint3d(from));
  const projectedTo = finitePoint(geometry.mapPoint3d(to));
  return {
    ...edge,
    from: projectedFrom,
    to: projectedTo,
    outerNormal: projectedOuterNormal(geometry, ranges, edge, from, to),
    midpoint: {
      x: (projectedFrom.x + projectedTo.x) / 2,
      y: (projectedFrom.y + projectedTo.y) / 2
    }
  };
}

function projectedOuterNormal(geometry, ranges, edge, from, to) {
  const varyingAxis = ["x", "y", "z"].find((axis) => edge[axis] === undefined);
  const midpoint = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
    z: (from.z + to.z) / 2
  };
  const projectedMidpoint = finitePoint(geometry.mapPoint3d(midpoint));
  const components = [];
  for (const axis of ["x", "y", "z"]) {
    if (axis === varyingAxis) continue;
    const min = Number(ranges[`${axis}Min`]);
    const max = Number(ranges[`${axis}Max`]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < 1e-12) continue;
    const current = Number(edge[axis]);
    const interiorValue = Math.abs(current - min) <= Math.abs(current - max) ? max : min;
    const interiorPoint = { ...midpoint, [axis]: interiorValue };
    const inward = normalizedVector(projectedMidpoint, finitePoint(geometry.mapPoint3d(interiorPoint)));
    if (inward) components.push({ x: -inward.x, y: -inward.y });
  }
  if (!components.length) return null;
  const sum = components.reduce((result, component) => ({
    x: result.x + component.x,
    y: result.y + component.y
  }), { x: 0, y: 0 });
  return normalizedVector({ x: 0, y: 0 }, sum);
}

function chooseProjectedEdge(edges, coordinate, direction = "min") {
  return edges.reduce((best, edge) => {
    const better = direction === "max"
      ? edge.midpoint[coordinate] > best.midpoint[coordinate]
      : edge.midpoint[coordinate] < best.midpoint[coordinate];
    return better ? edge : best;
  });
}

function additionalBoxTickCommands(axis, value, labelEdge, edges, center, geometry, style, length) {
  return (edges || [])
    .filter((edge) => !sameAxis3DEdge(axis, edge, labelEdge))
    .map((edge) => boxTickCommand(axis, value, edge, center, geometry, style, length))
    .filter(Boolean);
}

function sameAxis3DEdge(axis, first, second) {
  if (!first || !second) return false;
  if (axis === "x") return first.y === second.y && first.z === second.z;
  if (axis === "y") return first.x === second.x && first.z === second.z;
  return first.x === second.x && first.y === second.y;
}

function boxTickCommand(axis, value, edge, center, geometry, style, length) {
  if (!edge) return "";
  const coordinate = axis === "x"
    ? { x: value, y: edge.y, z: edge.z }
    : axis === "y"
      ? { x: edge.x, y: value, z: edge.z }
      : { x: edge.x, y: edge.y, z: value };
  const base = geometry.mapPoint3d(coordinate);
  const outward = annotationNormal(edge, center, axis);
  const to = offsetAlongNormal(base, { x: -outward.x, y: -outward.y }, length);
  return `\\draw[${style}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`;
}

function axis3DAnnotationLayout(axisOptions, ranges, geometry) {
  const edges = axis3DTickLabelEdges(ranges, geometry);
  const center = projectedBoxCenter(ranges, geometry);
  return Object.fromEntries(Object.entries(edges).map(([axis, edge]) => {
    const normal = annotationNormal(edge, center, axis, shouldRenderOpposite3DTicks(axisOptions, axis));
    return [axis, { ...edge, normal, anchor: anchorForOutwardNormal(normal) }];
  }));
}

function annotationNormal(edge, center, axis, useProjectedAxisNormal = false) {
  if (useProjectedAxisNormal && edge.outerNormal) return edge.outerNormal;
  const tangent = normalizedVector(edge.from, edge.to);
  const outward = normalizedVector(center, edge.midpoint);
  if (!tangent) return outward || axisFallbackNormal(axis);
  let normal = { x: -tangent.y, y: tangent.x };
  if (outward && dot2(normal, outward) < 0) normal = { x: -normal.x, y: -normal.y };
  return normal;
}

function projectedBoxCenter(ranges, geometry) {
  const corners = [
    { x: ranges.xMin, y: ranges.yMin, z: ranges.zMin },
    { x: ranges.xMin, y: ranges.yMin, z: ranges.zMax },
    { x: ranges.xMin, y: ranges.yMax, z: ranges.zMin },
    { x: ranges.xMin, y: ranges.yMax, z: ranges.zMax },
    { x: ranges.xMax, y: ranges.yMin, z: ranges.zMin },
    { x: ranges.xMax, y: ranges.yMin, z: ranges.zMax },
    { x: ranges.xMax, y: ranges.yMax, z: ranges.zMin },
    { x: ranges.xMax, y: ranges.yMax, z: ranges.zMax }
  ].map((corner) => finitePoint(geometry.mapPoint3d(corner)));
  return corners.reduce((center, point) => ({ x: center.x + point.x / corners.length, y: center.y + point.y / corners.length }), { x: 0, y: 0 });
}

function normalizedVector(from, to) {
  const vector = { x: to.x - from.x, y: to.y - from.y };
  const length = Math.hypot(vector.x, vector.y);
  return Number.isFinite(length) && length > 1e-9 ? { x: vector.x / length, y: vector.y / length } : null;
}

function dot2(a, b) {
  return a.x * b.x + a.y * b.y;
}

function anchorForOutwardNormal(normal, diagonalThreshold = 0.35) {
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const dominant = Math.max(absX, absY, 1e-9);
  const horizontal = absX >= dominant * diagonalThreshold ? (normal.x >= 0 ? "west" : "east") : "";
  const vertical = absY >= dominant * diagonalThreshold ? (normal.y >= 0 ? "south" : "north") : "";
  return [vertical, horizontal].filter(Boolean).join(" ") || "center";
}

function cardinalAnchorForOutwardNormal(normal) {
  if (Math.abs(normal.x) >= Math.abs(normal.y)) return normal.x >= 0 ? "west" : "east";
  return normal.y >= 0 ? "south" : "north";
}

function axisAnnotationAnchor(axisOptions, axis, normal) {
  return shouldRenderOpposite3DTicks(axisOptions, axis)
    ? cardinalAnchorForOutwardNormal(normal)
    : anchorForOutwardNormal(normal);
}

function axisTickAnnotationAnchor(axisOptions, axis, normal) {
  return shouldRenderOpposite3DTicks(axisOptions, axis)
    ? cardinalAnchorForOutwardNormal(normal)
    : anchorForOutwardNormal(normal, 0.1);
}

function axisFallbackNormal(axis) {
  if (axis === "x") return { x: 0, y: -1 };
  if (axis === "y") return { x: 1, y: 0 };
  return { x: -1, y: 0 };
}

function tickLabelDistance(axisOptions = {}, axis, tickLength = parseDimension("0.15cm", {})) {
  const axisLine = String(
    axisOptions[`axis ${axis} line`] ??
    axisOptions[`axis ${axis} line*`] ??
    axisOptions["axis lines"] ??
    axisOptions.axis ??
    "box"
  ).trim().toLowerCase();
  if (axisLine === "box") {
    const boxedDistance = axis === "x" ? 0.155 : 0.04;
    return Math.max(0, boxedDistance + axisTickLabelShift(axisOptions, axis));
  }
  const defaultAlignment = axisLine === "box" ? "inside" : "center";
  const alignment = String(
    axisOptions[`${axis}tick align`] ??
    axisOptions[`${axis} tick align`] ??
    axisOptions["tick align"] ??
    defaultAlignment
  ).trim().toLowerCase();
  const factor = alignment === "outside" ? 1 : alignment === "center" ? 0.5 : 0;
  const shift = axisTickLabelShift(axisOptions, axis);
  return Math.max(0, tickLength * factor + shift);
}

function axis3DTickLabelPlacement(axisOptions, axis, edge, base, text, tickLength) {
  const style = axisTickLabelStyleOptions(axisOptions, axis);
  const fallbackAnchor = axisTickAnnotationAnchor(axisOptions, axis, edge.normal);
  const explicitAnchor = explicitAxis3DAnchor(style);
  if (explicitAnchor) {
    return {
      anchor: axisTickLabelAnchor(style, fallbackAnchor, axis),
      point: offsetAlongNormal(base, edge.normal, tickLabelDistance(axisOptions, axis, tickLength))
    };
  }

  const font = pgfplotsRoleFontCommand("tick", axisOptions, axis3DFontOption(axisOptions, axis, "tick"));
  const innerSep = axisTickLabelInnerSep(axisOptions, axis) ?? defaultPerspectiveTickLabelInnerSep(axisOptions, axis);
  const rotation = axis3DTickLabelRotationDegrees(style);
  return {
    anchor: "center",
    point: axis3DNearTickLabelCenter(
      offsetAlongNormal(base, edge.normal, axisTickLabelShift(axisOptions, axis)),
      edge,
      edge.normal,
      text,
      font,
      rotation,
      innerSep
    )
  };
}

function explicitAxis3DAnchor(style = {}) {
  if (style.anchor === undefined || style.anchor === null) return "";
  return String(style.anchor).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
}

function axis3DNearTickLabelCenter(at, edge, outward, text, font, rotation, innerSep) {
  const size = axis3DTextNodeSize(text, font, innerSep);
  const radians = -(Number(rotation) || 0) * Math.PI / 180;
  const inward = rotateVector(invertVector(outward), radians);
  const tangent = rotateVector(normalizedVector(edge.from, edge.to) || { x: 1, y: 0 }, radians);
  const outerSep = parseDimension("0.2pt", {});
  const anchor = {
    x: Math.abs(inward.x) > 0.17 ? Math.sign(inward.x) * (size.width / 2 + outerSep) : 0,
    y: Math.abs(inward.y) > 0.17 ? Math.sign(inward.y) * (size.height / 2 + outerSep) : 0
  };
  const determinant = inward.x * tangent.y - tangent.x * inward.y;
  if (Math.abs(determinant) < 1e-9) {
    return offsetAlongNormal(at, outward, Math.abs(dot2(anchor, inward)));
  }
  const normalDistance = (anchor.x * tangent.y - tangent.x * anchor.y) / determinant;
  return offsetAlongNormal(at, outward, Math.max(0, normalDistance));
}

function rotateVector(vector, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos
  };
}

function axisTickLabelShift(axisOptions = {}, axis) {
  const raw = axisOptions[`${axis}ticklabel shift`] ?? axisOptions[`${axis} ticklabel shift`] ?? axisOptions["ticklabel shift"];
  if (raw === undefined || raw === null || raw === true || String(raw).trim() === "") return 0;
  const text = String(raw).trim();
  const dimension = /[a-zA-Z\\]/.test(text) ? text : `${text}pt`;
  const parsed = parseDimension(dimension, {});
  return Number.isFinite(parsed) ? parsed : 0;
}

function finitePoint(point = {}) {
  return {
    x: Number.isFinite(point.x) ? point.x : 0,
    y: Number.isFinite(point.y) ? point.y : 0
  };
}

function dedupeAdjacentCommands(commands) {
  const seen = new Set();
  return commands.filter((command) => {
    if (seen.has(command)) return false;
    seen.add(command);
    return true;
  });
}

export function renderAxisLabels3D(axisOptions, ranges, geometry) {
  const commands = [];
  const layout = axis3DAnnotationLayout(axisOptions, ranges, geometry);
  if (axisOptions.xlabel) {
    const placement = axis3DAxisLabelPlacement(axisOptions, "x", axisOptions.xlabel, ranges, geometry, layout);
    commands.push(axis3DAxisLabelCommand("x", axisOptions.xlabel, placement));
  }
  if (axisOptions.ylabel) {
    const placement = axis3DAxisLabelPlacement(axisOptions, "y", axisOptions.ylabel, ranges, geometry, layout);
    commands.push(axis3DAxisLabelCommand("y", axisOptions.ylabel, placement));
  }
  if (axisOptions.zlabel) {
    const placement = axis3DAxisLabelPlacement(axisOptions, "z", axisOptions.zlabel, ranges, geometry, layout);
    commands.push(axis3DAxisLabelCommand("z", axisOptions.zlabel, placement));
  }
  if (axisOptions.title) {
    // A 3D top-face midpoint can be materially below the projected box's
    // highest corner. PGFPlots positions an axis title above the full axis
    // picture, so anchor it from the projected bbox rather than the top-face
    // midpoint.
    const bounds = axis3DProjectedBounds(ranges, geometry);
    const titlePoint = { x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY };
    const titleFont = roleFontOption("title", axisOptions, fontFromStyle(axisOptions["title style"]) || axisOptions["axis title font"]);
    commands.push(`\\node[${joinOptions(["axis label", "anchor=south", titleFont ? `font=${titleFont}` : ""])}] at ${formatAxisPoint(offsetPoint(titlePoint, 0, 0.25))} {${axisOptions.title}};`);
  }
  return commands;
}

function axis3DAxisLabelCommand(axis, text, placement) {
  return `\\node[${joinOptions([
    "axis label",
    `anchor=${placement.anchor}`,
    placement.rotation ? `rotate=${placement.rotation}` : "",
    placement.font ? `font=${placement.font}` : "",
    ...axis3DLabelVisualOptions(placement.style)
  ])}] at ${formatAxisPoint(placement.point)} {${text}};`;
}

function axis3DAxisLabelPlacement(axisOptions, axis, text, ranges, geometry, layout = axis3DAnnotationLayout(axisOptions, ranges, geometry)) {
  const edge = layout[axis];
  const style = axis3DLabelStyleOptions(axisOptions, axis);
  const font = roleFontOption("axisLabel", axisOptions, axis3DFontOption(axisOptions, axis, "label"));
  const rotation = axis3DLabelRotationDegrees(style, axis === "z" ? 90 : 0);
  const innerSep = style["inner sep"] ?? ".3333em";
  const explicitAnchor = explicitAxis3DAnchor(style);

  if (!shouldRenderOpposite3DTicks(axisOptions, axis)) {
    const legacy = legacyAxis3DLabelPlacement(axisOptions, axis, edge);
    return { ...legacy, font, rotation, innerSep, style };
  }

  const tickExtent = axis3DMaximumTickLabelExtent(axisOptions, axis, ranges, geometry, edge);
  let at = offsetAlongNormal(pointAlongProjectedEdge(edge, 0.5), edge.normal, tickExtent + axis3DLabelShift(axisOptions, axis));
  at = offsetPoint(at, axis3DStyleShift(style.xshift), axis3DStyleShift(style.yshift));
  const point = explicitAnchor
    ? at
    : axis3DNearTickLabelCenter(at, edge, edge.normal, text, font, rotation, innerSep);
  return {
    point,
    anchor: explicitAnchor || "center",
    font,
    rotation,
    innerSep,
    style
  };
}

function legacyAxis3DLabelPlacement(axisOptions, axis, edge) {
  if (axis === "x") {
    return {
      point: offsetAlongNormal(pointAlongProjectedEdge(edge, 0.428), edge.normal, 0.615),
      anchor: axisAnnotationAnchor(axisOptions, axis, edge.normal)
    };
  }
  if (axis === "y") {
    return {
      point: offsetAlongNormal(pointAlongProjectedEdge(edge, 0.541), edge.normal, 0.764),
      anchor: axisAnnotationAnchor(axisOptions, axis, edge.normal)
    };
  }
  return {
    point: offsetAlongNormal(edge.midpoint, edge.normal, 1),
    anchor: axisAnnotationAnchor(axisOptions, axis, edge.normal)
  };
}

function axis3DMaximumTickLabelExtent(axisOptions, axis, ranges, geometry, edge) {
  const ticks = axis3DTickValues(axisOptions, ranges, geometry);
  const zLog = isLogAxis(axisOptions, "z");
  const zTickFormat = zLog ? null : createScaledTickFormat(ticks.z, scaledTickOptions(axisOptions, "z"));
  const zTickPrecision = zTickFormat ? scaledTickLabelPrecision(ticks.z, zTickFormat) : undefined;
  const labels = axis3DRenderedTickLabels(axisOptions, ticks, zTickFormat, zTickPrecision);
  const tickLength = parseDimension(String(axisOptions["major tick length"] || axisOptions.tickwidth || "0.15cm"), {});
  const style = axisTickLabelStyleOptions(axisOptions, axis);
  const font = pgfplotsRoleFontCommand("tick", axisOptions, axis3DFontOption(axisOptions, axis, "tick"));
  const innerSep = axisTickLabelInnerSep(axisOptions, axis) ?? defaultPerspectiveTickLabelInnerSep(axisOptions, axis);
  const rotation = axis3DTickLabelRotationDegrees(style);
  let extent = 0;

  for (const [index, value] of (ticks[axis] || []).entries()) {
    const label = labels[axis][index] ?? "";
    if (label === "") continue;
    const coordinate = axis === "x"
      ? { x: value, y: edge.y, z: edge.z }
      : axis === "y"
        ? { x: edge.x, y: value, z: edge.z }
        : { x: edge.x, y: edge.y, z: value };
    const base = geometry.mapPoint3d(coordinate);
    const placement = axis3DTickLabelPlacement(axisOptions, axis, edge, base, label, tickLength);
    extent = Math.max(
      extent,
      axis3DTextNodeOutwardExtent(
        placement.point,
        label,
        font,
        placement.anchor,
        rotation,
        innerSep,
        base,
        edge.normal
      )
    );
  }
  return extent;
}

function axis3DTextNodeOutwardExtent(at, text, fontCommand, anchor, rotation, innerSep, origin, outward) {
  const geometry = axis3DTextNodeGeometry(at, text, fontCommand, anchor, rotation, innerSep);
  const radians = (Number(rotation) || 0) * Math.PI / 180;
  const localX = { x: Math.cos(radians), y: Math.sin(radians) };
  const localY = { x: -Math.sin(radians), y: Math.cos(radians) };
  const halfExtent = Math.abs(dot2(outward, localX)) * geometry.size.width / 2
    + Math.abs(dot2(outward, localY)) * geometry.size.height / 2;
  return Math.max(0, dot2({ x: geometry.center.x - origin.x, y: geometry.center.y - origin.y }, outward) + halfExtent);
}

function axis3DLabelStyleOptions(axisOptions = {}, axis) {
  const merged = {};
  for (const raw of [
    axisOptions["label style"],
    axisOptions[`${axis} label style`],
    axisOptions[`${axis}label style`]
  ]) {
    if (raw === undefined || raw === null || raw === true || raw === false) continue;
    Object.assign(merged, parseOptions(String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1")));
  }
  return merged;
}

function axis3DLabelRotationDegrees(style = {}, fallback = 0) {
  const value = String(style.rotate ?? fallback).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const rotation = Number(value);
  return Number.isFinite(rotation) ? rotation : fallback;
}

function axis3DLabelShift(axisOptions = {}, axis) {
  const raw = axisOptions[`${axis}label shift`] ?? axisOptions[`${axis} label shift`] ?? axisOptions["label shift"];
  return axis3DStyleShift(raw);
}

function axis3DStyleShift(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false || String(raw).trim() === "") return 0;
  const parsed = parseDimension(String(raw), {});
  return Number.isFinite(parsed) ? parsed : 0;
}

function axis3DLabelVisualOptions(style = {}) {
  const textColor = style.text || style.color;
  return [
    textColor ? `text=${textColor}` : "",
    style.align ? `align=${style.align}` : "",
    style["inner sep"] !== undefined ? `inner sep=${style["inner sep"]}` : "",
    style["text width"] !== undefined ? `text width=${style["text width"]}` : ""
  ].filter(Boolean);
}

export function renderAxis3DColorbar(axisOptions = {}, ranges, geometry) {
  if (!axisColorbarEnabled(axisOptions)) return [];
  const orientation = colorbarOrientation(axisOptions);
  const styleOptions = parseColorbarStyle(axisOptions["colorbar style"]);
  const tickFont = pgfplotsRoleFontCommand(
    "colorbarTick",
    axisOptions,
    fontFromStyle(styleOptions["tick label style"]) || styleOptions["tick label font"]
  );
  const bounds = axis3DProjectedBounds(ranges, geometry);
  const parentBounds = axis3DParentBounds(axisOptions, ranges, geometry);
  const parentWidth = bounds.width || geometry.width || 1;
  const parentHeight = bounds.height || geometry.height || 1;
  const width = colorbarDimension(
    styleOptions.width ?? (orientation === "horizontal" ? undefined : axisOptions["colorbar/width"]),
    orientation === "horizontal" ? parentWidth : 0.5,
    parentWidth
  );
  const height = colorbarDimension(
    styleOptions.height ?? (orientation === "horizontal" ? axisOptions["colorbar/width"] : undefined),
    orientation === "horizontal" ? 0.5 : parentHeight,
    parentHeight
  );
  const box = colorbarBox(styleOptions, bounds, parentBounds, width, height, orientation);
  const { xMin, xMax, yMin, yMax } = box;
  const horizontalSide = colorbarHorizontalTickSide(styleOptions);
  const commands = [];
  const gradientStops = colorbarGradientStops(ranges, axisOptions);
  const gradientAngle = orientation === "horizontal" ? 270 : 0;
  commands.push(
    `\\draw[axis colorbar, draw=none, shading=axis, shading angle=${gradientAngle}, tikzkit axis stops={${gradientStops}}, line width=0pt] ${formatAxisPoint({ x: xMin, y: yMin })} -- ${formatAxisPoint({ x: xMax, y: yMin })} -- ${formatAxisPoint({ x: xMax, y: yMax })} -- ${formatAxisPoint({ x: xMin, y: yMax })} -- cycle;`
  );
  commands.push(
    `\\draw[axis colorbar frame, black, line width=0.25pt] ${formatAxisPoint({ x: xMin, y: yMin })} -- ${formatAxisPoint({ x: xMax, y: yMin })} -- ${formatAxisPoint({ x: xMax, y: yMax })} -- ${formatAxisPoint({ x: xMin, y: yMax })} -- cycle;`
  );
  const ticks = colorbarTickValues(
    orientation === "horizontal" ? styleOptions.xtick : styleOptions.ytick,
    ranges,
    orientation === "horizontal" ? width : height,
    styleOptions
  );
  const tickAxis = orientation === "horizontal" ? "x" : "y";
  const tickFormat = createScaledTickFormat(ticks, scaledTickOptions({ ...axisOptions, ...styleOptions }, tickAxis));
  const tickPrecision = scaledTickLabelPrecision(ticks, tickFormat);
  for (const tick of ticks) {
    const position = (tick - ranges.zMin) / (ranges.zMax - ranges.zMin || 1);
    const from = colorbarTickPoint(box, position, orientation, 0, horizontalSide);
    const to = colorbarTickPoint(box, position, orientation, 0.08, horizontalSide);
    const labelAnchor = orientation === "horizontal"
      ? horizontalSide === "upper" ? "south" : "north"
      : orientation === "left" ? "east" : "west";
    const labelOffset = orientation === "horizontal"
      ? offsetPoint(to, 0, horizontalSide === "upper" ? 0.05 : -0.05)
      : offsetPoint(to, orientation === "left" ? -0.05 : 0.05, 0);
    commands.push(`\\draw[axis colorbar tick, black, line width=0.22pt] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
    commands.push(`\\node[axis colorbar tick label, anchor=${labelAnchor}, font=${tickFont}] at ${formatAxisPoint(labelOffset)} {${formatScaledAxisTickLabel(tick, tickFormat, { precision: tickPrecision })}};`);
  }
  if (tickFormat.scaled) {
    const scalePoint = orientation === "horizontal"
      ? { x: xMax, y: horizontalSide === "upper" ? yMax + 0.13 : yMin - 0.13 }
      : { x: xMin, y: yMax };
    const scaleAnchor = orientation === "horizontal"
      ? horizontalSide === "upper" ? "south east" : "north east"
      : "south west";
    commands.push(`\\node[axis colorbar tick scale label, anchor=${scaleAnchor}, font=${tickFont}] at ${formatAxisPoint(scalePoint)} {$${tickFormat.scaleLabel}$};`);
  }
  if (styleOptions.title) {
    const titleFont = pgfplotsRoleFontCommand(
      "title",
      axisOptions,
      fontFromStyle(styleOptions["title style"]) || styleOptions["title font"]
    );
    const titleY = yMax + (orientation === "horizontal"
      ? horizontalSide === "upper" ? 0.36 : 0.12
      : tickFormat.scaled ? 0.29 : 0.12);
    commands.push(`\\node[axis colorbar title, anchor=south, font=${titleFont}] at ${formatAxisPoint({ x: (xMin + xMax) / 2, y: titleY })} {${styleOptions.title}};`);
  }
  return commands;
}

function colorbarGradientStops(ranges, axisOptions) {
  const stopCount = 16;
  return Array.from({ length: stopCount + 1 }, (_unused, index) => {
    const offset = index / stopCount;
    const z = ranges.zMin + (ranges.zMax - ranges.zMin) * offset;
    return `${roundColorbarNumber(offset)}/${pgfplotsSurfaceColor(z, ranges, 0, axisOptions)}`;
  }).join("|");
}

function roundColorbarNumber(value) {
  return Number(Number(value).toFixed(6));
}

function scaledTickOptions(axisOptions = {}, axis = "") {
  const axisSpecific = axis ? axisOptions[`scaled ${axis} ticks`] : undefined;
  return {
    "scaled ticks": axisSpecific ?? axisOptions["scaled ticks"],
    scaledTicks: axisOptions.scaledTicks,
    scaleTicksBelowExponent: axisOptions["scale ticks below exponent"],
    scaleTicksAboveExponent: axisOptions["scale ticks above exponent"]
  };
}

function axis3DBoxCorners(ranges, geometry) {
  return {
    c000: geometry.mapPoint3d({ x: ranges.xMin, y: ranges.yMin, z: ranges.zMin }),
    c100: geometry.mapPoint3d({ x: ranges.xMax, y: ranges.yMin, z: ranges.zMin }),
    c010: geometry.mapPoint3d({ x: ranges.xMin, y: ranges.yMax, z: ranges.zMin }),
    c110: geometry.mapPoint3d({ x: ranges.xMax, y: ranges.yMax, z: ranges.zMin }),
    c001: geometry.mapPoint3d({ x: ranges.xMin, y: ranges.yMin, z: ranges.zMax }),
    c101: geometry.mapPoint3d({ x: ranges.xMax, y: ranges.yMin, z: ranges.zMax }),
    c011: geometry.mapPoint3d({ x: ranges.xMin, y: ranges.yMax, z: ranges.zMax }),
    c111: geometry.mapPoint3d({ x: ranges.xMax, y: ranges.yMax, z: ranges.zMax })
  };
}

function axis3DBoxMode(axisOptions = {}) {
  const raw = axisOptions["3d box"];
  if (raw === true) return "complete";
  const value = String(raw ?? "background").trim().toLowerCase();
  if (value === "" || value === "true" || value === "complete") return "complete";
  if (value === "complete*") return "complete*";
  return "background";
}

function axis3DForegroundFaces(axisOptions = {}, geometry = {}) {
  const view = pgfplotsViewDirection(axisOptions);
  return Object.fromEntries(["x", "y", "z"].map((axis) => {
    const direction = Number(geometry.axisDirections?.[axis]) < 0 ? -1 : 1;
    return [axis, view[axis] * direction < 0 ? 1 : 0];
  }));
}

function axis3DForegroundSides(axisOptions, ranges, geometry) {
  const faces = axis3DForegroundFaces(axisOptions, geometry);
  return {
    x: faces.x ? ranges.xMax : ranges.xMin,
    y: faces.y ? ranges.yMax : ranges.yMin,
    z: faces.z ? ranges.zMax : ranges.zMin
  };
}

function axis3DBoxEdges(ranges, geometry) {
  const corners = axis3DBoxCorners(ranges, geometry);
  const edge = (axis, fixed, from, to) => ({ axis, fixed, from: corners[`c${from}`], to: corners[`c${to}`] });
  return [
    edge("x", { y: 0, z: 0 }, "000", "100"),
    edge("x", { y: 0, z: 1 }, "001", "101"),
    edge("x", { y: 1, z: 0 }, "010", "110"),
    edge("x", { y: 1, z: 1 }, "011", "111"),
    edge("y", { x: 0, z: 0 }, "000", "010"),
    edge("y", { x: 0, z: 1 }, "001", "011"),
    edge("y", { x: 1, z: 0 }, "100", "110"),
    edge("y", { x: 1, z: 1 }, "101", "111"),
    edge("z", { x: 0, y: 0 }, "000", "001"),
    edge("z", { x: 0, y: 1 }, "010", "011"),
    edge("z", { x: 1, y: 0 }, "100", "101"),
    edge("z", { x: 1, y: 1 }, "110", "111")
  ];
}

function axis3DEdgeIsForeground(edge, foreground) {
  return Object.entries(edge.fixed).every(([axis, side]) => foreground[axis] === side);
}

function axisColorbarEnabled(axisOptions = {}) {
  if (axisOptions["colorbar right"] || axisOptions["colorbar left"] || axisOptions["colorbar horizontal"]) return true;
  if (axisOptions.colorbar === true) return true;
  if (axisOptions.colorbar === undefined || axisOptions.colorbar === null || axisOptions.colorbar === false) return false;
  const value = String(axisOptions.colorbar ?? "").trim().toLowerCase();
  return ["", "true", "right", "left", "horizontal"].includes(value);
}

function colorbarOrientation(axisOptions = {}) {
  if (axisOptions["colorbar horizontal"] || String(axisOptions.colorbar || "").trim().toLowerCase() === "horizontal") return "horizontal";
  if (axisOptions["colorbar left"] || String(axisOptions.colorbar || "").trim().toLowerCase() === "left") return "left";
  return "right";
}

function parseColorbarStyle(raw) {
  if (raw === undefined || raw === null || raw === true) return {};
  const text = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1");
  return parseOptions(text);
}

function axis3DFontOption(axisOptions = {}, axis, role) {
  if (role === "tick") {
    return lastFontOption([
      axisOptions["axis tick label font"],
      fontFromStyle(axisOptions["tick label style"]),
      fontFromStyle(axisOptions[`${axis} tick label style`]),
      axisOptions[`${axis} tick label font`]
    ]);
  }
  return lastFontOption([
    axisOptions["axis label font"],
    fontFromStyle(axisOptions["label style"]),
    fontFromStyle(axisOptions[`${axis} label style`]),
    axisOptions[`${axis} label font`]
  ]);
}

function fontFromStyle(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false) return "";
  return String(parseOptions(String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1")).font || "").trim();
}

function lastFontOption(values) {
  return values.filter((value) => value !== undefined && value !== null && String(value).trim()).at(-1) || "";
}

function roleFontOption(role, axisOptions, explicit) {
  if (pgfplotsPictureFontScale(axisOptions) === 1 && !String(explicit || "").trim() && !hasPgfplotsFontProfile(axisOptions)) return "";
  return pgfplotsRoleFontCommand(role, axisOptions, explicit);
}

function colorbarDimension(raw, fallback, parentAxisDimension = fallback) {
  if (raw === undefined || raw === null || raw === true || String(raw).trim() === "") return fallback;
  const parentMatch = String(raw).trim().match(/^([-+]?\d*\.?\d+)\s*\*\s*\\pgfkeysvalueof\{\/pgfplots\/parent axis (?:height|width)\}$/);
  if (parentMatch) {
    const factor = Number(parentMatch[1]);
    if (Number.isFinite(factor) && factor > 0) return factor * parentAxisDimension;
  }
  const parsed = parseDimension(String(raw), {});
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function colorbarBox(styleOptions, bounds, parentBounds, width, height, orientation) {
  const defaults = orientation === "horizontal"
    ? { at: { x: bounds.minX, y: parentBounds.minY - 0.3 }, anchor: "north west" }
    : orientation === "left"
      ? { at: { x: parentBounds.minX - 0.3, y: bounds.maxY }, anchor: "north east" }
      : { at: { x: parentBounds.maxX + 0.3, y: bounds.maxY }, anchor: "north west" };
  const rawAt = colorbarAt(styleOptions.at, bounds, parentBounds) || defaults.at;
  const at = {
    x: rawAt.x + colorbarShift(styleOptions.xshift),
    y: rawAt.y + colorbarShift(styleOptions.yshift)
  };
  const anchor = String(styleOptions.anchor || defaults.anchor).trim().toLowerCase();
  let xMin = at.x;
  let yMin = at.y - height;
  if (anchor.includes("east")) xMin = at.x - width;
  if (anchor.includes("south")) yMin = at.y;
  if (anchor === "center") {
    xMin = at.x - width / 2;
    yMin = at.y - height / 2;
  }
  return { xMin, xMax: xMin + width, yMin, yMax: yMin + height };
}

export function axis3DParentBounds(axisOptions = {}, ranges = {}, geometry = {}) {
  const projected = axis3DProjectedBounds(ranges, geometry);
  const margin = geometry.margin || {};
  const bounds = {
    minX: projected.minX - finiteNonNegative(margin.left),
    maxX: projected.maxX + finiteNonNegative(margin.right),
    minY: projected.minY - finiteNonNegative(margin.bottom),
    maxY: projected.maxY + finiteNonNegative(margin.top)
  };
  const layout = axis3DAnnotationLayout(axisOptions, ranges, geometry);
  const ticks = axis3DTickValues(axisOptions, ranges, geometry);
  const tickLength = parseDimension(String(axisOptions["major tick length"] || axisOptions.tickwidth || "0.15cm"), {});
  const zLog = isLogAxis(axisOptions, "z");
  const zTickFormat = zLog ? null : createScaledTickFormat(ticks.z, scaledTickOptions(axisOptions, "z"));
  const zTickPrecision = zTickFormat ? scaledTickLabelPrecision(ticks.z, zTickFormat) : undefined;
  const labels = axis3DRenderedTickLabels(axisOptions, ticks, zTickFormat, zTickPrecision);

  for (const axis of ["x", "y", "z"]) {
    const style = axisTickLabelStyleOptions(axisOptions, axis);
    const font = pgfplotsRoleFontCommand("tick", axisOptions, axis3DFontOption(axisOptions, axis, "tick"));
    const innerSep = axisTickLabelInnerSep(axisOptions, axis) ?? defaultPerspectiveTickLabelInnerSep(axisOptions, axis);
    const rotation = axis3DTickLabelRotationDegrees(style);
    for (const [index, value] of (ticks[axis] || []).entries()) {
      const coordinate = axis === "x"
        ? { x: value, y: layout.x.y, z: layout.x.z }
        : axis === "y"
          ? { x: layout.y.x, y: value, z: layout.y.z }
          : { x: layout.z.x, y: layout.z.y, z: value };
      const text = labels[axis][index] ?? "";
      if (text === "") continue;
      const placement = axis3DTickLabelPlacement(
        axisOptions,
        axis,
        layout[axis],
        geometry.mapPoint3d(coordinate),
        text,
        tickLength
      );
      includeBounds(bounds, axis3DTextNodeBounds(placement.point, text, font, placement.anchor, rotation, innerSep));
    }
  }

  for (const axis of ["x", "y", "z"]) {
    const pass = extraAxisTickPassOptions(axisOptions, axis, [], ranges);
    if (!pass) continue;
    const values = pass["pgfplots extra tick values"] || [];
    const labels = axisRenderedTickLabels(
      pass,
      axis,
      pass[`${axis}ticklabels`],
      values,
      axisTickNumberFormat(pass, axis),
      pass[`${axis}ticklabel`]
    );
    const style = axisTickLabelStyleOptions(pass, axis);
    const font = pgfplotsRoleFontCommand("tick", pass, axis3DFontOption(pass, axis, "tick"));
    const innerSep = axisTickLabelInnerSep(pass, axis) ?? defaultPerspectiveTickLabelInnerSep(pass, axis);
    const rotation = axis3DTickLabelRotationDegrees(style);
    const extraTickLength = parseDimension(String(pass["major tick length"] || pass.tickwidth || "0.15cm"), {});
    for (const [index, value] of values.entries()) {
      const coordinate = axis === "x"
        ? { x: value, y: layout.x.y, z: layout.x.z }
        : axis === "y"
          ? { x: layout.y.x, y: value, z: layout.y.z }
          : { x: layout.z.x, y: layout.z.y, z: value };
      const text = labels[index] ?? "";
      if (text === "") continue;
      const placement = axis3DTickLabelPlacement(
        pass,
        axis,
        layout[axis],
        geometry.mapPoint3d(coordinate),
        text,
        extraTickLength
      );
      includeBounds(bounds, axis3DTextNodeBounds(placement.point, text, font, placement.anchor, rotation, innerSep));
    }
  }

  if (zTickFormat?.scaled) {
    const font = pgfplotsRoleFontCommand("tick", axisOptions, axis3DFontOption(axisOptions, "z", "tick"));
    includeBounds(bounds, axis3DTextNodeBounds(
      pointAlongProjectedEdge(layout.z, 1.2),
      `$${zTickFormat.scaleLabel}$`,
      font,
      axisTickAnnotationAnchor(axisOptions, "z", layout.z.normal),
      0,
      "0pt"
    ));
  }

  for (const axis of ["x", "y", "z"]) {
    const text = axisOptions[`${axis}label`];
    if (!text) continue;
    const placement = axis3DAxisLabelPlacement(axisOptions, axis, text, ranges, geometry, layout);
    includeBounds(bounds, axis3DTextNodeBounds(
      placement.point,
      text,
      placement.font,
      placement.anchor,
      placement.rotation,
      placement.innerSep
    ));
  }
  if (axisOptions.title) {
    const titleFont = roleFontOption("title", axisOptions, fontFromStyle(axisOptions["title style"]) || axisOptions["axis title font"]);
    const at = offsetPoint({ x: (projected.minX + projected.maxX) / 2, y: projected.maxY }, 0, 0.25);
    includeBounds(bounds, axis3DTextNodeBounds(at, axisOptions.title, titleFont, "south"));
  }
  return {
    ...bounds,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY
  };
}

function axis3DTickLabelRotationDegrees(style = {}) {
  const value = String(style.rotate ?? "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const rotation = Number(value);
  return Number.isFinite(rotation) ? rotation : 0;
}

function axis3DTextNodeBounds(at, text, fontCommand, anchor = "center", rotation = 0, innerSep = ".3333em") {
  const { center, size } = axis3DTextNodeGeometry(at, text, fontCommand, anchor, rotation, innerSep);
  const radians = (Number(rotation) || 0) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfWidth = Math.abs(size.width * cos) / 2 + Math.abs(size.height * sin) / 2;
  const halfHeight = Math.abs(size.width * sin) / 2 + Math.abs(size.height * cos) / 2;
  return {
    minX: center.x - halfWidth,
    maxX: center.x + halfWidth,
    minY: center.y - halfHeight,
    maxY: center.y + halfHeight
  };
}

function axis3DTextNodeGeometry(at, text, fontCommand, anchor = "center", rotation = 0, innerSep = ".3333em") {
  const size = axis3DTextNodeSize(text, fontCommand, innerSep);
  const radians = (Number(rotation) || 0) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const normalizedAnchor = String(anchor || "center").trim().toLowerCase().replace(/-/g, " ");
  const anchorVector = {
    x: normalizedAnchor.includes("east") ? size.width / 2 : normalizedAnchor.includes("west") ? -size.width / 2 : 0,
    y: normalizedAnchor.includes("north") ? size.height / 2 : normalizedAnchor.includes("south") ? -size.height / 2 : 0
  };
  const rotatedAnchor = {
    x: anchorVector.x * cos - anchorVector.y * sin,
    y: anchorVector.x * sin + anchorVector.y * cos
  };
  const center = { x: at.x - rotatedAnchor.x, y: at.y - rotatedAnchor.y };
  return { center, size };
}

function axis3DTextNodeSize(text, fontCommand, innerSep) {
  const patch = parseTikzFontPatch(fontCommand || "");
  const fontSizePt = Number(patch.sizePt) || 10;
  const scale = fontSizePt / 10;
  const math = parseMathText(String(text || "").trim());
  const measured = math
    ? estimateFormulaBox(math.tex, {
        scale,
        minWidth: 0.08 * scale,
        widthPadding: 0.08 * scale,
        texTextMetrics: true,
        mathVersion: patch.mathVersion
      })
    : measurePlainTextTeXBoxPt(String(text || ""), { fontSizePt, fontFamily: patch.family });
  const contentWidth = math
    ? measured.width
    : Number.isFinite(measured?.width)
      ? measured.width / 28.45274
      : Math.max(0.08 * scale, [...String(text || "")].length * 0.13 * scale);
  const contentHeight = math
    ? formulaTotalHeight(measured)
    : measured
      ? (measured.height + measured.depth) / 28.45274
      : 0.18 * scale;
  const sep = parseDimension(String(innerSep || "0pt"), {}) * scale;
  return {
    width: Math.max(0.08 * scale, contentWidth) + 2 * sep,
    height: Math.max(0.18 * scale, contentHeight) + 2 * sep
  };
}

function includeBounds(target, addition) {
  target.minX = Math.min(target.minX, addition.minX);
  target.maxX = Math.max(target.maxX, addition.maxX);
  target.minY = Math.min(target.minY, addition.minY);
  target.maxY = Math.max(target.maxY, addition.maxY);
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function colorbarShift(raw) {
  if (raw === undefined || raw === null || raw === true || raw === false) return 0;
  const value = parseDimension(String(raw), {});
  return Number.isFinite(value) ? value : 0;
}

function colorbarHorizontalTickSide(styleOptions = {}) {
  const raw = String(styleOptions["xticklabel pos"] ?? styleOptions["xtick pos"] ?? "lower")
    .trim()
    .toLowerCase();
  return ["upper", "top", "right"].includes(raw) ? "upper" : "lower";
}

function colorbarTickPoint(box, position, orientation, extension, horizontalSide = "lower") {
  if (orientation === "horizontal") {
    return {
      x: box.xMin + (box.xMax - box.xMin) * position,
      y: horizontalSide === "upper" ? box.yMax + extension : box.yMin - extension
    };
  }
  return {
    x: orientation === "left" ? box.xMin - extension : box.xMax + extension,
    y: box.yMin + (box.yMax - box.yMin) * position
  };
}

function colorbarAt(raw, bounds, parentBounds = bounds) {
  if (raw === undefined || raw === null || raw === true) return null;
  const text = String(raw).trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  const parentAnchor = text.match(/^\(?\s*parent axis\.(above north west|above north|above north east)\s*\)?$/i);
  if (parentAnchor) {
    const anchor = parentAnchor[1].toLowerCase();
    return {
      x: anchor.endsWith("west")
        ? bounds.minX
        : anchor.endsWith("east")
          ? bounds.maxX
          : (bounds.minX + bounds.maxX) / 2,
      y: parentBounds.maxY
    };
  }
  const match = text.match(/^\(?\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)?$/);
  if (!match) return null;
  return {
    x: bounds.minX + Number(match[1]) * bounds.width,
    y: bounds.minY + Number(match[2]) * bounds.height
  };
}

function colorbarTickValues(raw, ranges, height, styleOptions = {}) {
  const explicit = axisTickValues(raw, "z", []);
  if (explicit.length) return explicit;
  const count = colorbarAutoTickCount(styleOptions, height);
  const span = Math.abs(ranges.zMax - ranges.zMin);
  const endpointPadding = Number.isFinite(span) ? span * 0.005 : 0;
  return majorAxis3DTickValues(ranges.zMin - endpointPadding, ranges.zMax + endpointPadding, count)
    .filter((tick) => !autoColorbarTickOutsideRange(tick, ranges.zMin, ranges.zMax));
}

function colorbarAutoTickCount(styleOptions = {}, height) {
  // PGFPlots realizes a colorbar as a standalone vertical axis.  Its tick
  // planner uses the bar's physical axis height, the generic 35pt spacing,
  // and the generic try-min-ticks=4 default rather than the parent's 3D
  // try-min-ticks=3 setting.  This is why a 50-unit range can correctly use
  // only -20, 0, and 20 while a compact -2..2 colorbar still uses unit ticks.
  const rawSpacing = styleOptions["max space between ticks"];
  const spacingSource = rawSpacing === undefined || rawSpacing === null || rawSpacing === ""
    ? "35pt"
    : /^[-+]?\d*\.?\d+$/.test(String(rawSpacing).trim())
      ? `${String(rawSpacing).trim()}pt`
      : String(rawSpacing);
  const spacing = parseDimension(spacingSource, {});
  const requestedMinimum = Math.floor(Number(styleOptions["try min ticks"]));
  const minimum = Number.isFinite(requestedMinimum) && requestedMinimum >= 2 ? requestedMinimum : 4;
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(spacing) || spacing <= 0) return minimum;
  // The implemented colorbar renderer deliberately caps this subset at five
  // labels.  It matches the native examples we support while avoiding a long
  // chain of overlapping fractional labels when a caller constructs an
  // unusually tall standalone bar.
  return Math.min(5, Math.max(minimum, Math.floor(height / spacing) + 1));
}

function autoColorbarTickOutsideRange(tick, min, max) {
  const value = Number(tick);
  const lower = Number(min);
  const upper = Number(max);
  if (!Number.isFinite(value) || !Number.isFinite(lower) || !Number.isFinite(upper)) return false;
  const span = Math.abs(upper - lower);
  // A sampled surface may miss an analytic extremum by a tiny amount (for
  // example an even sample count around zero). Native PGFPlots still keeps
  // the rounded colorbar endpoint in that case.
  const tolerance = Math.max(1e-12, span * 0.005, Math.abs(value) * 1e-12);
  return value < lower - tolerance || value > upper + tolerance;
}

function hasPgfplotsFontProfile(axisOptions = {}) {
  return ["normalsize", "small", "footnotesize", "tiny"].some((name) => axisOptions[name]);
}

function autoAxis3DTickOutsideRange(tick, min, max) {
  const value = Number(tick);
  const lower = Number(min);
  const upper = Number(max);
  if (!Number.isFinite(value) || !Number.isFinite(lower) || !Number.isFinite(upper)) return false;
  const span = Math.abs(upper - lower);
  const tolerance = Math.max(1e-12, span * 1e-9, Math.abs(value) * 1e-12);
  return value < lower - tolerance || value > upper + tolerance;
}

function roundAxis3DTick(value, min, max) {
  const magnitude = Math.max(Math.abs(Number(value)), Math.abs(Number(min)), Math.abs(Number(max)));
  const decimals = magnitude < 0.1 ? 12 : 3;
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function scaledTickLabelPrecision(ticks = [], tickFormat = {}) {
  if (!tickFormat.scaled) return undefined;
  const scaledTicks = ticks
    .map((tick) => Number(tick) / tickFormat.factor)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const differences = [];
  for (let index = 1; index < scaledTicks.length; index += 1) {
    const difference = Math.abs(scaledTicks[index] - scaledTicks[index - 1]);
    if (difference > 1e-12) differences.push(difference);
  }
  if (!differences.length) return undefined;
  const step = Math.min(...differences);
  for (let decimals = 0; decimals <= 8; decimals += 1) {
    const factor = 10 ** decimals;
    if (Math.abs(Math.round(step * factor) / factor - step) < 1e-8) return decimals;
  }
  return 8;
}

function axis3DProjectedBounds(ranges, geometry) {
  const corners = Object.values(axis3DBoxCorners(ranges, geometry));
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y)),
    width: Math.max(...corners.map((point) => point.x)) - Math.min(...corners.map((point) => point.x)),
    height: Math.max(...corners.map((point) => point.y)) - Math.min(...corners.map((point) => point.y))
  };
}

function offsetPoint(point, x, y) {
  return { x: point.x + x, y: point.y + y };
}

function pointAlongProjectedEdge(edge, position) {
  return {
    x: edge.from.x + (edge.to.x - edge.from.x) * position,
    y: edge.from.y + (edge.to.y - edge.from.y) * position
  };
}

function offsetAlongNormal(point, normal, distance) {
  return offsetPoint(point, normal.x * distance, normal.y * distance);
}

function invertVector(vector) {
  return { x: -vector.x, y: -vector.y };
}
