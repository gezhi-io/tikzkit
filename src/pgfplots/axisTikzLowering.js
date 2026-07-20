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
import { defaultPgfplotsCycleMarkStyle } from "./plotStyle.js";
import { createPgfplotsDateContext, normalizePgfplotsDateAxisOptions } from "./dateCoordinates.js";

// `current axis.outer south west` includes the rotated ylabel description
// node, not only its painted glyphs. The evaluator's live current-bbox tracks
// painted text, so restore the native PGF description-node reserve here.
const PGFPLOTS_ROTATED_YLABEL_OUTER_RESERVE = "3.72pt";

export function renderPgfplotsAxisAsTikz(axisOptions, body, options = {}, diagnostics = [], dependencies = {}) {
  const preparedAxisOptions = dependencies.preparePgfplotsAxisOptions(axisOptions, options);
  const dateContext = createPgfplotsDateContext(preparedAxisOptions);
  const parsedAddplots = dependencies.parseAddplots(body, { ...options, pgfplotsDateContext: dateContext }, diagnostics);
  const dateAxisOptions = normalizePgfplotsDateAxisOptions(preparedAxisOptions, parsedAddplots, dateContext);
  const histogram = preparePgfplotsHistogram(
    dateAxisOptions,
    parsedAddplots
  );
  const symbolic = normalizePgfplotsSymbolicCoordinates(histogram.addplots, histogram.axisOptions);
  let addplots = applyPgfplotsCycleStyles(symbolic.addplots, symbolic.axisOptions, options);
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
  const resolvedAxisOptions = {
    ...symbolic.axisOptions,
    "colormap name": symbolic.axisOptions["colormap name"] ?? axisColormapName ?? symbolic.axisOptions["colormap name"],
    "pgfplots declared functions": declaredFunctions,
    "pgfplots colormaps": {
      ...declaredColormaps,
      ...axisColormaps,
      ...(preparedAxisOptions["pgfplots colormaps"] || {})
    },
    "pgfplots 3d surface": has3dPlot
  };
  addplots = applyPgfplotsConstantScatterColors(addplots, resolvedAxisOptions);
  if (resolvedAxisOptions["pgfplots ternary axis"]) {
    return dependencies.renderTernaryAxisAsTikz(resolvedAxisOptions, addplots);
  }
  const ranges = dependencies.computeAxisRanges(resolvedAxisOptions, addplots);
  const geometry = createAxisGeometry(resolvedAxisOptions, ranges);
  const axisModel = createAxisModel({
    axisOptions: resolvedAxisOptions,
    addplots,
    ranges,
    geometry,
    legendEntries
  });
  const axisReplayModel = createAxisReplayModel(axisModel);
  const axisOnTop = optionEnabled(axisModel.options["axis on top"]);
  const commands = [renderAxisBounds(axisModel.geometry)];
  const axisBox = renderAxisBox(axisModel.options, axisModel.geometry);
  if (has3dPlot && !isPgfplotsTopView(axisModel.options)) {
    const axis3DBox = dependencies.renderAxis3DBox(axisModel.options, axisModel.ranges, axisModel.geometry);
    const axis3DBoxForeground = dependencies.renderAxis3DBoxForeground?.(axisModel.options, axisModel.ranges, axisModel.geometry) || [];
    commands.push(...dependencies.renderAxis3DGrid(axisModel.options, axisModel.ranges, axisModel.geometry));
    if (axis3DBoxForeground.length) commands.push(...axis3DBox);
    addplots.forEach((plot, plotIndex) => {
      commands.push(...dependencies.renderAddplot(plot, axisModel.options, axisModel.ranges, axisModel.geometry, options, plotIndex));
      commands.push(...(dependencies.renderCurrentPlotCoordinates?.(plot, axisModel.options, axisModel.ranges, axisModel.geometry, options) || []));
    });
    commands.push(...dependencies.renderAxisOverlayStatements(body, axisModel.ranges, axisModel.geometry));
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
  if (!axisOnTop && !axisReplayModel) {
    commands.push(...renderAxisLineCommands(axisModel));
    commands.push(...renderAxisTicks(axisModel.options, addplots, axisModel.ranges, axisModel.geometry));
  }
  addplots.forEach((plot, plotIndex) => {
    commands.push(...dependencies.renderAddplot(plot, axisModel.options, axisModel.ranges, axisModel.geometry, options, plotIndex));
    commands.push(...(dependencies.renderCurrentPlotCoordinates?.(plot, axisModel.options, axisModel.ranges, axisModel.geometry, options) || []));
  });
  commands.push(...dependencies.renderAxisOverlayStatements(body, axisModel.ranges, axisModel.geometry));
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
  const outerSouthWest = axisModel.options?.ylabel
    ? `([xshift=-${PGFPLOTS_ROTATED_YLABEL_OUTER_RESERVE}]current bounding box.south west)`
    : "(current bounding box.south west)";
  return [
    `\\coordinate (current axis.south east) at (${formatCoordinate(east)},${formatCoordinate(south)});`,
    `\\coordinate (current axis.north) at (${formatCoordinate(xCenter)},${formatCoordinate(north)});`,
    `\\coordinate (current axis.east) at (${formatCoordinate(east)},${formatCoordinate(yCenter)});`,
    `\\coordinate (current axis.outer south west) at ${outerSouthWest};`,
    "\\coordinate (current axis.outer north) at (current bounding box.north);",
    "\\coordinate (current axis.outer east) at (current bounding box.east);"
  ];
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
  return addplots.map((plot, index) => {
    const plotOptions = plot.options || {};
    const usesDefaultCycle =
      !cycleName &&
      plot.type === "coordinates" &&
      plot.source === "table" &&
      !plot.is3d &&
      (!plotOptions["pgfplots explicit options"] || plotOptions["pgfplots plus"]);
    const cycleStyle = cycleList?.[cycleIndex(index, axisOptions, cycleList.length)]
      || (usesDefaultCycle ? defaultPgfplotsCycleMarkStyle(cycleIndex(index, axisOptions, 10)) : {});
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
