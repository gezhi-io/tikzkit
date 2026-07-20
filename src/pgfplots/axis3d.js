import { createScaledTickFormat, formatAxisNumber, formatAxisPoint, formatScaledAxisTickLabel, joinOptions } from "./format.js";
import { pgfplotsViewDirection } from "./geometry.js";
import { pgfplotsSurfaceColor } from "./surface.js";
import {
  axisAutoMajorTickCount,
  axisMinorTickValues,
  axisTickValues,
  majorTickValues as axisMajorTickValues,
  tickDistanceValues as axisTickDistanceValues
} from "./ticks.js";
import { parseDimension } from "../engine/math.js";
import { parseOptions } from "../engine/options.js";
import { shouldRenderAnyAxisGrid } from "./grid.js";
import { isLogAxis } from "./ranges.js";
import { pgfplotsPictureFontScale, pgfplotsRoleFontCommand } from "./fonts.js";

export function renderAxis3DBox(axisOptions = {}, ranges, geometry) {
  const corners = axis3DBoxCorners(ranges, geometry);
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
  return [
    `\\draw[${style}] ${formatAxisPoint(corners.c000)} -- ${formatAxisPoint(corners.c100)} -- ${formatAxisPoint(corners.c110)} -- ${formatAxisPoint(corners.c010)} -- cycle;`,
    `\\draw[${style}] ${formatAxisPoint(corners.c001)} -- ${formatAxisPoint(corners.c101)} -- ${formatAxisPoint(corners.c111)} -- ${formatAxisPoint(corners.c011)} -- cycle;`,
    `\\draw[${style}] ${formatAxisPoint(corners.c000)} -- ${formatAxisPoint(corners.c001)};`,
    `\\draw[${style}] ${formatAxisPoint(corners.c100)} -- ${formatAxisPoint(corners.c101)};`,
    `\\draw[${style}] ${formatAxisPoint(corners.c010)} -- ${formatAxisPoint(corners.c011)};`,
    `\\draw[${style}] ${formatAxisPoint(corners.c110)} -- ${formatAxisPoint(corners.c111)};`
  ];
}

export function renderAxis3DBoxForeground(axisOptions = {}, ranges, geometry) {
  const style = "axis line, black, line width=0.4pt";
  const axisLines = String(axisOptions["axis lines"] ?? axisOptions.axis ?? "box").trim().toLowerCase();
  if (axisLines === "none" || axisLines === "false" || ["left", "middle", "center"].includes(axisLines)) return [];
  const edges = axis3DTickLabelEdges(ranges, geometry);
  return ["x", "y", "z"].map((axis) =>
    `\\draw[${style}] ${formatAxisPoint(edges[axis].from)} -- ${formatAxisPoint(edges[axis].to)};`
  );
}

export function renderAxis3DGrid(axisOptions = {}, ranges, geometry) {
  if (!shouldRenderAnyAxisGrid(axisOptions)) return [];
  const ticks = axis3DTickValues(axisOptions, ranges, geometry);
  const minorTicks = axis3DMinorTickValues(axisOptions, ranges, ticks);
  const background = axis3DBackgroundSides(axisOptions, ranges);
  const style = joinOptions([
    "axis 3d grid",
    axisOptions["axis grid color"] || "black!25",
    `line width=${axisOptions["axis grid line width"] || "0.4pt"}`,
    axisOptions["grid style"] || axisOptions["major grid style"] || ""
  ]);
  const commands = [];
  appendAxis3DGridLines(commands, style, geometry, ranges, background, minorTicks, axisOptions, true);
  appendAxis3DGridLines(commands, style, geometry, ranges, background, ticks, axisOptions, false);
  return dedupeAdjacentCommands(commands);
}

export function renderAxis3DTicks(axisOptions, ranges, geometry) {
  const commands = [];
  const tickStyle = "axis tick, gray, line width=0.2pt";
  const tickLength = parseDimension(String(axisOptions["major tick length"] || axisOptions.tickwidth || "0.15cm"), {});
  const tickLabelStyle = (axis, anchor) => {
    const font = pgfplotsRoleFontCommand("tick", axisOptions, axis3DFontOption(axisOptions, axis, "tick"));
    const innerSep = shouldRenderOpposite3DTicks(axisOptions, axis) ? "0pt" : "0.333em";
    return `axis tick label, anchor=${anchor}, font=${font}, inner sep=${innerSep}, outer sep=0pt`;
  };
  const { x: resolvedXTicks, y: resolvedYTicks, z: resolvedZTicks } = axis3DTickValues(axisOptions, ranges, geometry);
  const minorTicks = axis3DMinorTickValues(axisOptions, ranges, {
    x: resolvedXTicks,
    y: resolvedYTicks,
    z: resolvedZTicks
  });
  const zTickFormat = createScaledTickFormat(resolvedZTicks, scaledTickOptions(axisOptions, "z"));
  const zTickPrecision = scaledTickLabelPrecision(resolvedZTicks, zTickFormat);
  const layout = axis3DAnnotationLayout(ranges, geometry);
  const labelAnchors = Object.fromEntries(["x", "y", "z"].map((axis) => [axis, axisTickAnnotationAnchor(axisOptions, axis, layout[axis].normal)]));
  const oppositeTickAxes = Object.fromEntries(["x", "y", "z"].map((axis) => [axis, shouldRenderOpposite3DTicks(axisOptions, axis)]));
  const opposite = Object.values(oppositeTickAxes).some(Boolean) ? axis3DOppositeTickEdges(ranges, geometry) : {};
  const center = Object.values(oppositeTickAxes).some(Boolean) ? projectedBoxCenter(ranges, geometry) : null;
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
      const to = offsetAlongNormal(base, invertVector(edge.normal), minorTickLength);
      const minorStyle = "axis minor tick, gray, line width=0.2pt";
      commands.push(`\\draw[${minorStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
      if (oppositeTickAxes[axis]) {
        commands.push(oppositeTickCommand(axis, value, opposite[axis], center, geometry, minorStyle, minorTickLength));
      }
    }
  }
  for (const x of resolvedXTicks) {
    const base = geometry.mapPoint3d({ x, y: layout.x.y, z: layout.x.z });
    const to = offsetAlongNormal(base, invertVector(layout.x.normal), tickLength);
    commands.push(`\\draw[${tickStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
    if (oppositeTickAxes.x) commands.push(oppositeTickCommand("x", x, opposite.x, center, geometry, tickStyle, tickLength));
    commands.push(`\\node[${tickLabelStyle("x", labelAnchors.x)}] at ${formatAxisPoint(offsetAlongNormal(base, layout.x.normal, tickLabelDistance(axisOptions, "x", tickLength)))} {${formatAxis3DTickLabel(axisOptions, "x", x)}};`);
  }
  for (const y of resolvedYTicks) {
    const base = geometry.mapPoint3d({ x: layout.y.x, y, z: layout.y.z });
    const to = offsetAlongNormal(base, invertVector(layout.y.normal), tickLength);
    commands.push(`\\draw[${tickStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
    if (oppositeTickAxes.y) commands.push(oppositeTickCommand("y", y, opposite.y, center, geometry, tickStyle, tickLength));
    commands.push(`\\node[${tickLabelStyle("y", labelAnchors.y)}] at ${formatAxisPoint(offsetAlongNormal(base, layout.y.normal, tickLabelDistance(axisOptions, "y", tickLength)))} {${formatAxis3DTickLabel(axisOptions, "y", y)}};`);
  }
  for (const z of resolvedZTicks) {
    const base = geometry.mapPoint3d({ x: layout.z.x, y: layout.z.y, z });
    const to = offsetAlongNormal(base, invertVector(layout.z.normal), tickLength);
    commands.push(`\\draw[${tickStyle}] ${formatAxisPoint(base)} -- ${formatAxisPoint(to)};`);
    if (oppositeTickAxes.z) commands.push(oppositeTickCommand("z", z, opposite.z, center, geometry, tickStyle, tickLength));
    commands.push(`\\node[${tickLabelStyle("z", labelAnchors.z)}] at ${formatAxisPoint(offsetAlongNormal(base, layout.z.normal, tickLabelDistance(axisOptions, "z", tickLength)))} {${formatScaledAxisTickLabel(z, zTickFormat, { precision: zTickPrecision })}};`);
  }
  if (zTickFormat.scaled) {
    // PGFPlots places this at `zticklabel* cs:1.2,-0.3em`: continue the
    // selected z tick-label edge beyond its upper endpoint instead of
    // crowding the highest numeric tick.
    const scaleBase = pointAlongProjectedEdge(layout.z, 1.2);
    const font = pgfplotsRoleFontCommand("tick", axisOptions, axis3DFontOption(axisOptions, "z", "tick"));
    commands.push(`\\node[axis tick scale label, anchor=${labelAnchors.z}, font=${font}, inner sep=0pt, outer sep=0pt] at ${formatAxisPoint(scaleBase)} {$${zTickFormat.scaleLabel}$};`);
  }
  return dedupeAdjacentCommands(commands.filter(Boolean));
}

function shouldRenderOpposite3DTicks(axisOptions = {}, axis) {
  const raw = axisOptions[`axis ${axis} line`] ?? axisOptions[`axis ${axis} line*`] ?? axisOptions["axis lines"] ?? axisOptions.axis ?? "box";
  return String(raw).trim().toLowerCase() === "box";
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
    z: axis3DTicksExplicitlyEmpty(axisOptions.ztick) ? [] : zTicks.length ? zTicks : zDistanceTicks.length ? zDistanceTicks : automaticAxis3DTickValues(ranges.zMin, ranges.zMax, axis3DAutoMajorTickCount(axisOptions, "z", ranges, geometry))
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
    ? automaticLogAxis3DTickValues(min, max)
    : automaticAxis3DTickValues(min, max, count);
}

function automaticLogAxis3DTickValues(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) return [];
  const values = [];
  for (let exponent = Math.ceil(Math.log10(min) - 1e-12); exponent <= Math.floor(Math.log10(max) + 1e-12); exponent += 1) {
    values.push(10 ** exponent);
  }
  return values;
}

function formatAxis3DTickLabel(axisOptions, axis, value) {
  if (!isLogAxis(axisOptions, axis) || value <= 0) return formatAxisNumber(value);
  const exponent = Math.round(Math.log10(value));
  if (Math.abs(value - 10 ** exponent) <= Math.abs(value) * 1e-10) return `$10^{${exponent}}$`;
  return formatAxisNumber(value);
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

function axis3DOppositeTickEdges(ranges, geometry) {
  const candidates = axis3DParallelEdges(ranges, geometry);
  return {
    x: chooseProjectedEdge(candidates.x, "y", "max"),
    y: chooseProjectedEdge(candidates.y, "y", "max"),
    z: chooseProjectedEdge(candidates.z, "x", "max")
  };
}

function axis3DParallelEdges(ranges, geometry) {
  return {
    x: [
      projectedEdge(geometry, { y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMin }),
      projectedEdge(geometry, { y: ranges.yMin, z: ranges.zMax }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMax }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMax }),
      projectedEdge(geometry, { y: ranges.yMax, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMin }),
      projectedEdge(geometry, { y: ranges.yMax, z: ranges.zMax }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMax }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMax })
    ],
    y: [
      projectedEdge(geometry, { x: ranges.xMin, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMin }),
      projectedEdge(geometry, { x: ranges.xMin, z: ranges.zMax }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMax }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMax }),
      projectedEdge(geometry, { x: ranges.xMax, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMin }),
      projectedEdge(geometry, { x: ranges.xMax, z: ranges.zMax }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMax }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMax })
    ],
    z: [
      projectedEdge(geometry, { x: ranges.xMin, y: ranges.yMin }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMin, z: ranges.zMax }),
      projectedEdge(geometry, { x: ranges.xMin, y: ranges.yMax }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMin }, { x: ranges.xMin, y: ranges.yMax, z: ranges.zMax }),
      projectedEdge(geometry, { x: ranges.xMax, y: ranges.yMin }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMin, z: ranges.zMax }),
      projectedEdge(geometry, { x: ranges.xMax, y: ranges.yMax }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMin }, { x: ranges.xMax, y: ranges.yMax, z: ranges.zMax })
    ]
  };
}

function projectedEdge(geometry, edge, from, to) {
  const projectedFrom = finitePoint(geometry.mapPoint3d(from));
  const projectedTo = finitePoint(geometry.mapPoint3d(to));
  return {
    ...edge,
    from: projectedFrom,
    to: projectedTo,
    midpoint: {
      x: (projectedFrom.x + projectedTo.x) / 2,
      y: (projectedFrom.y + projectedTo.y) / 2
    }
  };
}

function chooseProjectedEdge(edges, coordinate, direction = "min") {
  return edges.reduce((best, edge) => {
    const better = direction === "max"
      ? edge.midpoint[coordinate] > best.midpoint[coordinate]
      : edge.midpoint[coordinate] < best.midpoint[coordinate];
    return better ? edge : best;
  });
}

function oppositeTickCommand(axis, value, edge, center, geometry, style, length) {
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

function axis3DAnnotationLayout(ranges, geometry) {
  const edges = axis3DTickLabelEdges(ranges, geometry);
  const center = projectedBoxCenter(ranges, geometry);
  return Object.fromEntries(Object.entries(edges).map(([axis, edge]) => {
    const normal = annotationNormal(edge, center, axis);
    return [axis, { ...edge, normal, anchor: anchorForOutwardNormal(normal) }];
  }));
}

function annotationNormal(edge, center, axis) {
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
  const layout = axis3DAnnotationLayout(ranges, geometry);
  const labelFont = (axis) => roleFontOption("axisLabel", axisOptions, axis3DFontOption(axisOptions, axis, "label"));
  if (axisOptions.xlabel) {
    const boxed = shouldRenderOpposite3DTicks(axisOptions, "x");
    const point = offsetAlongNormal(pointAlongProjectedEdge(layout.x, boxed ? 0.5 : 0.428), layout.x.normal, boxed ? 0.72 : 0.615);
    commands.push(`\\node[${joinOptions(["axis label", `anchor=${axisAnnotationAnchor(axisOptions, "x", layout.x.normal)}`, labelFont("x") ? `font=${labelFont("x")}` : ""])}] at ${formatAxisPoint(point)} {${axisOptions.xlabel}};`);
  }
  if (axisOptions.ylabel) {
    const boxed = shouldRenderOpposite3DTicks(axisOptions, "y");
    const point = offsetAlongNormal(pointAlongProjectedEdge(layout.y, boxed ? 0.5 : 0.541), layout.y.normal, boxed ? 0.96 : 0.764);
    commands.push(`\\node[${joinOptions(["axis label", `anchor=${axisAnnotationAnchor(axisOptions, "y", layout.y.normal)}`, labelFont("y") ? `font=${labelFont("y")}` : ""])}] at ${formatAxisPoint(point)} {${axisOptions.ylabel}};`);
  }
  if (axisOptions.zlabel) {
    commands.push(`\\node[${joinOptions(["axis label", `anchor=${axisAnnotationAnchor(axisOptions, "z", layout.z.normal)}`, "rotate=90", labelFont("z") ? `font=${labelFont("z")}` : ""])}] at ${formatAxisPoint(offsetAlongNormal(layout.z.midpoint, layout.z.normal, zAxisLabelDistance(axisOptions, ranges, geometry)))} {${axisOptions.zlabel}};`);
  }
  if (axisOptions.title) {
    const titlePoint = geometry.mapPoint3d({ x: (ranges.xMin + ranges.xMax) / 2, y: (ranges.yMin + ranges.yMax) / 2, z: ranges.zMax });
    const titleFont = roleFontOption("title", axisOptions, fontFromStyle(axisOptions["title style"]) || axisOptions["axis title font"]);
    commands.push(`\\node[${joinOptions(["axis label", "anchor=south", titleFont ? `font=${titleFont}` : ""])}] at ${formatAxisPoint(offsetPoint(titlePoint, 0, 0.25))} {${axisOptions.title}};`);
  }
  return commands;
}

export function renderAxis3DColorbar(axisOptions = {}, ranges, geometry) {
  if (!axisColorbarEnabled(axisOptions)) return [];
  const styleOptions = parseColorbarStyle(axisOptions["colorbar style"]);
  const tickFont = pgfplotsRoleFontCommand(
    "colorbarTick",
    axisOptions,
    fontFromStyle(styleOptions["tick label style"]) || styleOptions["tick label font"]
  );
  const bounds = axis3DProjectedBounds(ranges, geometry);
  const width = colorbarDimension(styleOptions.width ?? axisOptions["colorbar/width"], 0.5);
  const height = colorbarDimension(styleOptions.height, bounds.height || geometry.height || 1, bounds.height || geometry.height || 1);
  const box = colorbarBox(styleOptions, bounds, width, height);
  const { xMin, xMax, yMin, yMax } = box;
  const commands = [];
  const segments = 16;
  for (let index = 0; index < segments; index += 1) {
    const t0 = index / segments;
    const t1 = (index + 1) / segments;
    const zMid = ranges.zMin + (ranges.zMax - ranges.zMin) * ((t0 + t1) / 2);
    const fill = pgfplotsSurfaceColor(zMid, ranges, 0, axisOptions);
    const segmentMinY = yMin + height * t0;
    const segmentMaxY = yMin + height * t1;
    commands.push(
      `\\draw[axis colorbar, draw=none, fill=${fill}, line width=0pt] ${formatAxisPoint({ x: xMin, y: segmentMinY })} -- ${formatAxisPoint({ x: xMax, y: segmentMinY })} -- ${formatAxisPoint({ x: xMax, y: segmentMaxY })} -- ${formatAxisPoint({ x: xMin, y: segmentMaxY })} -- cycle;`
    );
  }
  commands.push(
    `\\draw[axis colorbar frame, black, line width=0.25pt] ${formatAxisPoint({ x: xMin, y: yMin })} -- ${formatAxisPoint({ x: xMax, y: yMin })} -- ${formatAxisPoint({ x: xMax, y: yMax })} -- ${formatAxisPoint({ x: xMin, y: yMax })} -- cycle;`
  );
  const ticks = colorbarTickValues(
    styleOptions.ytick,
    ranges,
    height
  );
  const tickFormat = createScaledTickFormat(ticks, scaledTickOptions({ ...axisOptions, ...styleOptions }, "z"));
  const tickPrecision = scaledTickLabelPrecision(ticks, tickFormat);
  for (const tick of ticks) {
    const y = yMin + height * ((tick - ranges.zMin) / (ranges.zMax - ranges.zMin || 1));
    const from = { x: xMax, y };
    const to = { x: xMax + 0.08, y };
    commands.push(`\\draw[axis colorbar tick, black, line width=0.22pt] ${formatAxisPoint(from)} -- ${formatAxisPoint(to)};`);
    commands.push(`\\node[axis colorbar tick label, anchor=west, font=${tickFont}] at ${formatAxisPoint(offsetPoint(to, 0.05, 0))} {${formatScaledAxisTickLabel(tick, tickFormat, { precision: tickPrecision })}};`);
  }
  if (tickFormat.scaled) {
    commands.push(`\\node[axis colorbar tick scale label, anchor=west, font=${tickFont}] at ${formatAxisPoint({ x: xMax + 0.13, y: yMax })} {$${tickFormat.scaleLabel}$};`);
  }
  if (styleOptions.title) {
    const titleFont = pgfplotsRoleFontCommand(
      "title",
      axisOptions,
      fontFromStyle(styleOptions["title style"]) || styleOptions["title font"]
    );
    commands.push(`\\node[axis colorbar title, anchor=south, font=${titleFont}] at ${formatAxisPoint({ x: (xMin + xMax) / 2, y: yMax + 0.12 })} {${styleOptions.title}};`);
  }
  return commands;
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

function axisColorbarEnabled(axisOptions = {}) {
  if (axisOptions.colorbar === true) return true;
  if (axisOptions.colorbar === undefined || axisOptions.colorbar === null || axisOptions.colorbar === false) return false;
  const value = String(axisOptions.colorbar ?? "").trim().toLowerCase();
  return value === "" || value === "true" || value === "right";
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

function colorbarBox(styleOptions, bounds, width, height) {
  const at = colorbarAt(styleOptions.at, bounds) || { x: bounds.maxX + 0.3, y: bounds.maxY };
  const anchor = String(styleOptions.anchor || "north west").trim().toLowerCase();
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

function colorbarAt(raw, bounds) {
  if (raw === undefined || raw === null || raw === true) return null;
  const match = String(raw).trim().match(/^\(?\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)?$/);
  if (!match) return null;
  return {
    x: bounds.minX + Number(match[1]) * bounds.width,
    y: bounds.minY + Number(match[2]) * bounds.height
  };
}

function colorbarTickValues(raw, ranges, height) {
  const explicit = axisTickValues(raw, "z", []);
  if (explicit.length) return explicit;
  const minimumDenseHeight = parseDimension("2cm", {});
  const shortColorbar = Number.isFinite(height) && height < minimumDenseHeight;
  const count = shortColorbar ? 3 : 5;
  const span = Math.abs(ranges.zMax - ranges.zMin);
  const endpointPadding = Number.isFinite(span) ? span * 0.005 : 0;
  return majorAxis3DTickValues(ranges.zMin - endpointPadding, ranges.zMax + endpointPadding, count)
    .filter((tick) => !autoColorbarTickOutsideRange(tick, ranges.zMin, ranges.zMax));
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

function zAxisLabelDistance(axisOptions, ranges, geometry) {
  const zTicks = axis3DTickValues(axisOptions, ranges, geometry).z;
  const tickFormat = createScaledTickFormat(zTicks, scaledTickOptions(axisOptions, "z"));
  const precision = scaledTickLabelPrecision(zTicks, tickFormat);
  const widest = zTicks.reduce((width, value) => {
    const label = formatScaledAxisTickLabel(value, tickFormat, { precision });
    return Math.max(width, approximateTickLabelWidth(label));
  }, 0);
  return Math.max(1.12, tickLabelDistance(axisOptions, "z") + widest + 0.2);
}

function approximateTickLabelWidth(label) {
  const plain = String(label ?? "")
    .replace(/\$|\\[a-zA-Z]+|[{}]/g, "")
    .replace(/\^[-+]?\d+/g, "0");
  return Math.max(0.16, plain.length * 0.105);
}

function offsetAlongNormal(point, normal, distance) {
  return offsetPoint(point, normal.x * distance, normal.y * distance);
}

function invertVector(vector) {
  return { x: -vector.x, y: -vector.y };
}
