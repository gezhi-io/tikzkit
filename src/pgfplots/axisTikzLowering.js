import { createAxisModel } from "./axis.js";
import { parseOptions, splitTopLevel } from "../engine/options.js";
import { mergePgfplotsOptionMaps } from "./namedOptions.js";
import {
  renderAxisBounds,
  renderAxisBox,
  renderAxisLines,
  renderDatavisualizationCleanAxes,
  shouldRenderAxisLines
} from "./axisLines.js";
import { createAxisGeometry, isPgfplotsTopView } from "./geometry.js";
import { normalizePgfplotsSymbolicCoordinates } from "./coordinates.js";
import { renderAxisGrid, shouldRenderAnyAxisGrid } from "./grid.js";
import { renderAxisLabels } from "./labels.js";
import { renderLegendEntries } from "./legend.js";
import { preparePgfplotsHistogram } from "./histogram.js";
import { renderAxisTicks } from "./ticks.js";
import { defaultPgfplotsBarCycleStyle, defaultPgfplotsCycleMarkStyle } from "./plotStyle.js";
import { createPgfplotsDateContext, normalizePgfplotsDateAxisOptions } from "./dateCoordinates.js";
import { renderAxisFillBetween } from "./fillBetween.js";
import { lowerPgfplotsPlotReferences } from "./plotReferences.js";
import { pgfplotsStackedRenderEntries, preparePgfplotsStackedPlots } from "./stackedPlots.js";
import { normalizePgfplotsAreaOptions, pgfplotsUsesAreaCycle } from "./areaPlots.js";

// PGF's axis-description node box is about 1.7pt narrower on its rotated
// cross-axis than the browser's CMU text layout box. Apply the correction only
// when exporting `current axis.outer south west`, which is defined from that
// TeX bounding box and is commonly reused by clipping/cropping macros.
const PGFPLOTS_OUTER_BBOX_X_COMPENSATION = "1.7pt";

export function renderPgfplotsAxisAsTikz(axisOptions, body, options = {}, diagnostics = [], dependencies = {}) {
  const preparedAxisOptions = dependencies.preparePgfplotsAxisOptions(axisOptions, options);
  const dateContext = createPgfplotsDateContext(preparedAxisOptions);
  const parsedAddplots = dependencies.parseAddplots(body, { ...options, pgfplotsDateContext: dateContext }, diagnostics);
  const dateAxisOptions = normalizePgfplotsDateAxisOptions(preparedAxisOptions, parsedAddplots, dateContext);
  const areaAxisOptions = normalizePgfplotsAreaOptions(dateAxisOptions);
  const histogram = preparePgfplotsHistogram(
    areaAxisOptions,
    parsedAddplots
  );
  const symbolic = normalizePgfplotsSymbolicCoordinates(histogram.addplots, histogram.axisOptions);
  const stacked = preparePgfplotsStackedPlots(symbolic.axisOptions, symbolic.addplots, options);
  let addplots = applyPgfplotsCycleStyles(stacked.addplots, stacked.axisOptions, options);
  const legendEntries = dependencies.parseLegendEntries(body);
  const has3dSurface = addplots.some((plot) => dependencies.isSurfacePlot(plot, dateAxisOptions));
  const has3dPlot = addplots.some((plot) => plot.is3d);
  const declaredFunctions = dependencies.parsePgfplotsDeclaredFunctions([
    ...(options.pgfplotsDeclareFunctions || []),
    ...dependencies.optionValues(preparedAxisOptions["declare function"])
  ]);
  const declaredColormaps = dependencies.parsePgfplotsColormaps?.(options.pgfplotsStyleOptions?.colormap) || {};
  const axisColormaps = dependencies.parsePgfplotsColormaps?.(preparedAxisOptions.colormap) || {};
  const axisColormapName = Object.keys(axisColormaps)[0] || "";
  let resolvedAxisOptions = {
    ...stacked.axisOptions,
    "colormap name": stacked.axisOptions["colormap name"] ?? axisColormapName ?? stacked.axisOptions["colormap name"],
    "pgfplots declared functions": declaredFunctions,
    "pgfplots colormaps": {
      ...declaredColormaps,
      ...axisColormaps,
      ...(preparedAxisOptions["pgfplots colormaps"] || {})
    },
    "pgfplots 3d surface": has3dPlot
  };
  const inheritedPlotBox = inheritedPgfplotsOverlayPlotBox(
    resolvedAxisOptions,
    options.__tikzkitPgfplotsAxisLayoutState
  );
  if (inheritedPlotBox) {
    resolvedAxisOptions = {
      ...resolvedAxisOptions,
      "tikzkit pgfplots inherited plot box": inheritedPlotBox
    };
  }
  addplots = applyPgfplotsConstantScatterColors(addplots, resolvedAxisOptions);
  const overlayBody = lowerPgfplotsPlotReferences(body, addplots);
  if (resolvedAxisOptions["pgfplots ternary axis"]) {
    return dependencies.renderTernaryAxisAsTikz(resolvedAxisOptions, addplots);
  }
  const ranges = dependencies.computeAxisRanges(resolvedAxisOptions, addplots);
  const geometry = createAxisGeometry(resolvedAxisOptions, ranges);
  rememberPgfplotsPrimaryAxis(
    resolvedAxisOptions,
    geometry,
    options.__tikzkitPgfplotsAxisLayoutState
  );
  const axisModel = createAxisModel({
    axisOptions: resolvedAxisOptions,
    addplots,
    ranges,
    geometry,
    legendEntries
  });
  const axisReplayModel = createAxisReplayModel(axisModel);
  const axisOnTop = optionEnabled(axisModel.options["axis on top"]);
  const fillBetweenCommands = (dependencies.renderAxisFillBetween || renderAxisFillBetween)(
    body,
    addplots,
    axisModel.options,
    axisModel.ranges,
    axisModel.geometry,
    options
  );
  const commands = [renderAxisBounds(axisModel.geometry)];
  const axisBox = renderAxisBox(axisModel.options, axisModel.geometry);
  if (has3dPlot && !isPgfplotsTopView(axisModel.options)) {
    const axis3DBox = dependencies.renderAxis3DBox(axisModel.options, axisModel.ranges, axisModel.geometry);
    const axis3DBoxForeground = dependencies.renderAxis3DBoxForeground?.(axisModel.options, axisModel.ranges, axisModel.geometry) || [];
    commands.push(...dependencies.renderAxis3DGrid(axisModel.options, axisModel.ranges, axisModel.geometry));
    if (axis3DBoxForeground.length) commands.push(...axis3DBox);
    pgfplotsStackedRenderEntries(addplots, axisModel.options).forEach(({ plot, plotIndex }) => {
      commands.push(...dependencies.renderAddplot(plot, axisModel.options, axisModel.ranges, axisModel.geometry, options, plotIndex));
      commands.push(...(dependencies.renderCurrentPlotCoordinates?.(plot, axisModel.options, axisModel.ranges, axisModel.geometry, options) || []));
    });
    commands.push(...dependencies.renderAxisOverlayStatements(
      overlayBody,
      axisModel.ranges,
      axisModel.geometry,
      axisModel.options
    ));
    commands.push(...(axis3DBoxForeground.length ? axis3DBoxForeground : axis3DBox));
    commands.push(...dependencies.renderAxis3DTicks(axisModel.options, axisModel.ranges, axisModel.geometry));
    commands.push(...dependencies.renderAxisLabels3D(axisModel.options, axisModel.ranges, axisModel.geometry));
    commands.push(...dependencies.renderAxis3DColorbar(axisModel.options, axisModel.ranges, axisModel.geometry));
    commands.push(...renderLegendEntries(axisModel.options, axisModel.ranges, axisModel.geometry, axisModel.legendEntries, addplots));
    return `\n${commands.join("\n")}\n`;
  }
  if (shouldRenderAnyAxisGrid(axisModel.options)) {
    if (!axisOnTop) {
      commands.push(...renderAxisGrid(axisModel.options, addplots, axisModel.ranges, axisModel.geometry));
    }
  }
  commands.push(...fillBetweenCommands);
  if (!axisOnTop && !axisReplayModel) {
    commands.push(...renderAxisLineCommands(axisModel));
    commands.push(...renderAxisTicks(axisModel.options, addplots, axisModel.ranges, axisModel.geometry));
  }
  pgfplotsStackedRenderEntries(addplots, axisModel.options).forEach(({ plot, plotIndex }) => {
    commands.push(...dependencies.renderAddplot(plot, axisModel.options, axisModel.ranges, axisModel.geometry, options, plotIndex));
    commands.push(...(dependencies.renderCurrentPlotCoordinates?.(plot, axisModel.options, axisModel.ranges, axisModel.geometry, options) || []));
  });
  commands.push(...dependencies.renderAxisOverlayStatements(
    overlayBody,
    axisModel.ranges,
    axisModel.geometry,
    axisModel.options
  ));
  if (axisOnTop) {
    if (shouldRenderAnyAxisGrid(axisModel.options)) {
      commands.push(...renderAxisGrid(axisModel.options, addplots, axisModel.ranges, axisModel.geometry));
    }
    commands.push(...renderAxisTicks(axisModel.options, addplots, axisModel.ranges, axisModel.geometry));
    commands.push(...renderAxisLineCommands(axisModel));
  } else if (axisReplayModel) {
    commands.push(...renderAxisTicks(axisReplayModel.options, addplots, axisReplayModel.ranges, axisReplayModel.geometry));
    commands.push(...renderAxisLineCommands(axisReplayModel));
  }
  if (axisBox) commands.push(axisBox);
  commands.push(...renderAxisLabels(axisModel.options, axisModel.ranges, axisModel.geometry));
  commands.push(...renderLegendEntries(axisModel.options, axisModel.ranges, axisModel.geometry, axisModel.legendEntries, addplots));
  commands.push(...renderCurrentAxisCoordinates(axisModel));
  return `\n${commands.join("\n")}\n`;
}

function inheritedPgfplotsOverlayPlotBox(axisOptions = {}, layoutState) {
  const primary = layoutState?.primaryAxis;
  if (!primary || !isRightYAxisOverlay(axisOptions) || hasExplicitAxisPlacement(axisOptions)) return null;
  if (!hasMatchingAxisDimensions(axisOptions, primary.dimensions)) return null;
  return {
    origin: { ...primary.origin },
    width: primary.width,
    height: primary.height
  };
}

function rememberPgfplotsPrimaryAxis(axisOptions = {}, geometry = {}, layoutState) {
  if (!layoutState || isAxisHidden(axisOptions, "x") || isAxisHidden(axisOptions, "y")) return;
  if (![geometry.width, geometry.height, geometry.origin?.x, geometry.origin?.y].every(Number.isFinite)) return;
  layoutState.primaryAxis = {
    origin: { ...geometry.origin },
    width: geometry.width,
    height: geometry.height,
    dimensions: { width: axisOptions.width, height: axisOptions.height }
  };
}

function isRightYAxisOverlay(axisOptions = {}) {
  const side = String(axisOptions["axis y line*"] ?? axisOptions["axis y line"] ?? "").trim().toLowerCase();
  return isAxisHidden(axisOptions, "x") && side === "right";
}

function isAxisHidden(axisOptions = {}, axis) {
  return isEnabled(axisOptions["hide axis"]) || isEnabled(axisOptions.hide) || isEnabled(axisOptions[`hide ${axis} axis`]);
}

function hasExplicitAxisPlacement(axisOptions = {}) {
  const value = axisOptions.at;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function hasMatchingAxisDimensions(axisOptions = {}, dimensions = {}) {
  return ["width", "height"].every((key) => normalizeAxisDimension(axisOptions[key]) === normalizeAxisDimension(dimensions[key]));
}

function normalizeAxisDimension(value) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

function isEnabled(value) {
  if (value === undefined || value === null || value === false) return false;
  return !["false", "0", "none", "off", "no"].includes(String(value).trim().toLowerCase());
}

function createAxisReplayModel(axisModel = {}) {
  const replay = axisModel.options?.["__pgfplots axis replay options"];
  if (!replay || typeof replay !== "object") return null;
  const options = mergePgfplotsOptionMaps(axisModel.options, replay);
  for (const key of ["axis line style", "x axis line style", "y axis line style", "tick style", "ticklabel style", "tick label style"]) {
    const cleaned = stripAxisVisibilityOptions(options[key]);
    if (cleaned === undefined) delete options[key];
    else options[key] = cleaned;
  }
  return { ...axisModel, options };
}

function stripAxisVisibilityOptions(value) {
  if (value === undefined || value === null) return value;
  const values = Array.isArray(value) ? value : [value];
  const cleaned = values
    .map((entry) => splitTopLevel(String(entry), ",")
      .map((part) => part.trim())
      .filter((part) => part && !/^(?:transparent|opaque)$/i.test(part))
      .join(","))
    .filter(Boolean);
  if (!cleaned.length) return undefined;
  return Array.isArray(value) ? cleaned : cleaned.join(",");
}

function renderAxisLineCommands(axisModel) {
  if (axisModel.options["datavis clean axes"]) {
    return renderDatavisualizationCleanAxes(axisModel.options, axisModel.ranges, axisModel.geometry);
  }
  return shouldRenderAxisLines(axisModel.options)
    ? renderAxisLines(axisModel.options, axisModel.ranges, axisModel.geometry)
    : [];
}

function renderCurrentAxisCoordinates(axisModel = {}) {
  const geometry = axisModel.geometry || {};
  const origin = geometry.origin || { x: 0, y: 0 };
  const west = Number(origin.x) || 0;
  const south = Number(origin.y) || 0;
  const east = west + (Number(geometry.width) || 0);
  const north = south + (Number(geometry.height) || 0);
  const xCenter = (west + east) / 2;
  const yCenter = (south + north) / 2;
  const commands = [
    `\\coordinate (current axis.south east) at (${formatCoordinate(east)},${formatCoordinate(south)});`,
    `\\coordinate (current axis.north) at (${formatCoordinate(xCenter)},${formatCoordinate(north)});`,
    `\\coordinate (current axis.east) at (${formatCoordinate(east)},${formatCoordinate(yCenter)});`,
    `\\coordinate (current axis.outer south west) at ([xshift=${PGFPLOTS_OUTER_BBOX_X_COMPENSATION}]current bounding box.south west);`,
    "\\coordinate (current axis.outer north) at (current bounding box.north);",
    "\\coordinate (current axis.outer east) at (current bounding box.east);"
  ];
  const name = String(axisModel.options?.name || "").trim();
  if (!name) return commands;
  const namedAnchors = {
    center: { x: xCenter, y: yCenter },
    west: { x: west, y: yCenter },
    east: { x: east, y: yCenter },
    north: { x: xCenter, y: north },
    south: { x: xCenter, y: south },
    "north west": { x: west, y: north },
    "north east": { x: east, y: north },
    "south west": { x: west, y: south },
    "south east": { x: east, y: south }
  };
  for (const [anchor, point] of Object.entries(namedAnchors)) {
    commands.push(`\\coordinate (${name}.${anchor}) at (${formatCoordinate(point.x)},${formatCoordinate(point.y)});`);
  }
  return commands;
}

function formatCoordinate(value) {
  return Number(Number(value).toFixed(3)).toString();
}

function optionEnabled(value) {
  if (value === undefined || value === null || value === false) return false;
  const text = String(value).trim().toLowerCase();
  return text !== "false" && text !== "0" && text !== "none" && text !== "off";
}

export function applyPgfplotsCycleStyles(addplots = [], axisOptions = {}, options = {}) {
  const cycleName = String(axisOptions["cycle list name"] || "").trim();
  const cycleList = cycleName ? options.pgfplotsCycleLists?.[cycleName] : null;
  const everyAxisPlotStyle = axisStyleOptions(axisOptions["every axis plot/.append style"]);
  const usesStackedBarCycle = !cycleName && (
    optionEnabled(axisOptions["xbar stacked"]) ||
    optionEnabled(axisOptions["ybar stacked"]) ||
    optionEnabled(axisOptions["xbar interval stacked"]) ||
    optionEnabled(axisOptions["ybar interval stacked"])
  );
  const usesAreaCycle = !cycleName && pgfplotsUsesAreaCycle(axisOptions);
  return addplots.map((plot, index) => {
    const plotOptions = plot.options || {};
    const usesDefaultCycle =
      !cycleName &&
      (plotOptions["pgfplots plus"] ||
        (plot.type === "coordinates" &&
          plot.source === "table" &&
          !plot.is3d &&
          !plotOptions["pgfplots explicit options"]));
    const cycleStyle = cycleList?.[cycleIndex(index, axisOptions, cycleList.length)]
      || (usesStackedBarCycle || usesAreaCycle
        ? defaultPgfplotsBarCycleStyle(cycleIndex(index, axisOptions, 6))
        : usesDefaultCycle
          ? defaultPgfplotsCycleMarkStyle(cycleIndex(index, axisOptions, 10))
          : {});
    return {
      ...plot,
      options: mergePgfplotsOptionMaps(mergePgfplotsOptionMaps(everyAxisPlotStyle, cycleStyle), plotOptions)
    };
  });
}

function axisStyleOptions(raw) {
  if (raw === undefined || raw === null || raw === true) return {};
  return parseOptions(String(raw));
}

function applyPgfplotsConstantScatterColors(addplots = [], axisOptions = {}) {
  return addplots.map((plot) => {
    if (!plot.options?.scatter) return plot;
    const rawMeta = String(plot.options["point meta"] ?? "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
    if (!rawMeta || !Number.isFinite(Number(rawMeta))) return plot;
    const colormapName = String(plot.options["colormap name"] || axisOptions["colormap name"] || "hot").trim();
    const colormap = axisOptions["pgfplots colormaps"]?.[colormapName];
    const firstStop = Array.isArray(colormap)
      ? [...colormap]
          .filter((stop) => Number.isFinite(Number(stop?.position)) && stop?.color)
          .sort((left, right) => Number(left.position) - Number(right.position))[0]
      : null;
    const mappedColor = firstStop?.color || (colormapName.toLowerCase() === "hot" ? "blue" : "");
    if (!mappedColor) return plot;
    return {
      ...plot,
      options: {
        ...plot.options,
        "pgfplots scatter mapped color": mappedColor
      }
    };
  });
}

function cycleIndex(index, axisOptions, size) {
  const shift = Number(axisOptions["cycle list shift"] || 0);
  const shifted = index + (Number.isFinite(shift) ? shift : 0);
  return ((shifted % size) + size) % size;
}
