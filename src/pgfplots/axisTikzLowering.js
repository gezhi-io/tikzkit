import { createAxisModel } from "./axis.js";
import { parseDimension } from "../engine/math.js";
import { parseOptions, splitTopLevel } from "../engine/options.js";
import { parseTikzFontPatch } from "../tex/fontSpec.js";
import { layoutNativeText } from "../tex/textBox.js";
import { layoutNativeMath } from "../tex/mathBox.js";
import { mergePgfplotsOptionMaps } from "./namedOptions.js";
import {
  renderAxisBounds,
  renderAxisBox,
  renderAxisLines,
  renderDatavisualizationCleanAxes,
  shouldRenderAxisLines
} from "./axisLines.js";
import { axisHasExplicitDescriptionPlacement, createAxisGeometry, isMiddleAxis, isPgfplotsTopView } from "./geometry.js";
import { axisClipRectangle } from "./clipping.js";
import { pgfplotsUsesNative2DText } from "./axisOptions.js";
import { normalizePgfplotsSymbolicCoordinates } from "./coordinates.js";
import { renderAxisGrid, shouldRenderAnyAxisGrid } from "./grid.js";
import { renderAxisLabels } from "./labels.js";
import { renderAxis3DBackground } from "./axis3d.js";
import { renderLegendEntries } from "./legend.js";
import { preparePgfplotsHistogram } from "./histogram.js";
import { axisRenderedTickLabels, axisTickLabelInnerSep, axisTickLabelStyleOptions, renderAxisTicks } from "./ticks.js";
import { pgfplotsRoleFontCommand } from "./fonts.js";
import { pgfplotsCompatAtLeast, pgfplotsCompatLevel } from "./compat.js";
import { defaultPgfplotsBarCycleStyle, defaultPgfplotsCycleMarkStyle } from "./plotStyle.js";
import { createPgfplotsDateContext, normalizePgfplotsDateAxisOptions } from "./dateCoordinates.js";
import { renderAxisFillBetween } from "./fillBetween.js";
import { lowerPgfplotsPlotReferences } from "./plotReferences.js";
import { pgfplotsStackedRenderEntries, preparePgfplotsStackedPlots } from "./stackedPlots.js";
import { normalizePgfplotsAreaOptions, pgfplotsUsesAreaCycle } from "./areaPlots.js";
import { enlarge3DZLimits } from "./rangeResolver.js";

// Retain the old CMU paint-box allowance only for non-native text. Native
// TeX node boxes already define the complete outer axis rectangle.
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
    "pgfplots compat": options.pgfplotsStyleOptions?.compat,
    "pgfplots colormaps": {
      ...declaredColormaps,
      ...axisColormaps,
      ...(preparedAxisOptions["pgfplots colormaps"] || {})
    },
    "pgfplots 3d surface": has3dPlot,
    "tikzkit pgfplots top view": has3dPlot && isPgfplotsTopView(preparedAxisOptions)
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
  if (Object.keys(options.plotMarkDeclarations || {}).length) {
    addplots = addplots.map((plot) => ({
      ...plot,
      options: {
        ...(plot.options || {}),
        "tikzkit plot mark declarations": options.plotMarkDeclarations
      }
    }));
  }
  const overlayBody = lowerPgfplotsPlotReferences(body, addplots);
  if (resolvedAxisOptions["pgfplots ternary axis"]) {
    return dependencies.renderTernaryAxisAsTikz(resolvedAxisOptions, addplots);
  }
  const surveyedRanges = dependencies.computeAxisRanges(resolvedAxisOptions, addplots, { enlargeZ: false });
  const ranges = has3dPlot ? enlarge3DZLimits(resolvedAxisOptions, surveyedRanges) : surveyedRanges;
  if (has3dPlot) {
    // Point-meta normalization belongs to the survey, before axis padding.
    resolvedAxisOptions["pgfplots surveyed color range"] = {
      zMin: surveyedRanges.zMin, zMax: surveyedRanges.zMax
    };
  }
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
  const topView3D = has3dPlot && isPgfplotsTopView(axisModel.options);
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
    // Text nodes contribute their native TeX boxes. A synthetic label
    // gutter here would count that space twice and distort the SVG canvas.
    commands[0] = renderAxisBounds({ ...axisModel.geometry,
      margin: { left: 0, right: 0, bottom: 0, top: 0 } });
    const axis3DBoxForeground = dependencies.renderAxis3DBoxForeground?.(axisModel.options, axisModel.ranges, axisModel.geometry) || [];
    const backgroundAxisCommands = renderAxis3DBackground(axisModel.options, axisModel.ranges, axisModel.geometry);
    if (!axisOnTop) commands.push(...backgroundAxisCommands);
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
    if (axisOnTop) commands.push(...backgroundAxisCommands);
    commands.push(...dependencies.renderAxisLabels3D(axisModel.options, axisModel.ranges, axisModel.geometry));
    commands.push(...dependencies.renderAxis3DColorbar(axisModel.options, axisModel.ranges, axisModel.geometry));
    commands.push(...renderLegendEntries(axisModel.options, axisModel.ranges, axisModel.geometry, axisModel.legendEntries, addplots, options));
    commands.push(...axis3DBoxForeground);
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
    if (!topView3D) commands.push(...renderAxisTicks(axisModel.options, addplots, axisModel.ranges, axisModel.geometry));
  }
  const foregroundIntervalNodes = [];
  pgfplotsStackedRenderEntries(addplots, axisModel.options).forEach(({ plot, plotIndex }) => {
    const plotCommands = dependencies.renderAddplot(plot, axisModel.options, axisModel.ranges, axisModel.geometry, options, plotIndex);
    const plotOptions = { ...axisModel.options, ...plot.options };
    const afterAxis = axisOnTop && optionEnabled(plotOptions["ybar interval"]) &&
      !optionEnabled(plotOptions["clip marker paths"]) &&
      String(plotOptions["clip mode"] ?? "global").trim() === "global" && !plotOptions["set layers"];
    for (const command of plotCommands) {
      // Unclipped interval labels belong to PGFPlots' after-axis marker pass,
      // otherwise an `axis on top` grid erases parts of the rotated numbers.
      (afterAxis && command.startsWith("\\node[axis near coord") ? foregroundIntervalNodes : commands).push(command);
    }
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
  } else if (topView3D) {
    // A top view still uses PGFPlots' 3D foreground-face pass. Its ticks
    // must remain visible above a surface even without `axis on top`.
    commands.push(...renderAxisTicks(axisModel.options, addplots, axisModel.ranges, axisModel.geometry));
  }
  if (axisBox) commands.push(axisBox);
  commands.push(...foregroundIntervalNodes);
  commands.push(...renderAxisLabels(intervalAxisLabelOptions(axisModel), axisModel.ranges, axisModel.geometry));
  commands.push(...renderLegendEntries(axisModel.options, axisModel.ranges, axisModel.geometry, axisModel.legendEntries, addplots, options));
  commands.push(...renderCurrentAxisCoordinates(axisModel));
  // Measure descriptions and ticks as one unit, including user overlay labels.
  // The leading separator also terminates a preceding legacy \tikzstyle.
  const nativeAxisText = pgfplotsUsesNative2DText(axisModel.options);
  if (nativeAxisText) {
    // Default-size, enlarged and boundary-origin pictures use native text
    // boxes, including inner sep, instead of fitted gutters. An outside tick
    // already contributes its complete node box at a boundary origin; adding
    // the old estimated frame there counts the description reserve twice.
    const bounds = axisClipRectangle(axisModel.geometry);
    const { origin, width, height } = axisModel.geometry;
    const enlarged = bounds && (bounds.minX < origin.x - 1e-8 || bounds.minY < origin.y - 1e-8 ||
      bounds.maxX > origin.x + width + 1e-8 || bounds.maxY > origin.y + height + 1e-8);
    const defaultSize = axisModel.options.width === undefined && axisModel.options.height === undefined;
    const { xMin, xMax, yMin, yMax } = axisModel.ranges;
    const hasTickDescriptions = Object.values(axisModel.ticks).some(tick => !tick.disabled && tick.values.length);
    // Native interior tickless axes add only their painted stroke/arrow bounds.
    // The renderer already includes those; a synthetic margin counts them twice.
    const ticklessInterior = !hasTickDescriptions && xMin < 0 && xMax > 0 && yMin < 0 && yMax > 0;
    const boundaryOrigin = hasTickDescriptions && (xMin >= 0 || xMax <= 0 || yMin >= 0 || yMax <= 0);
    if (bounds && (enlarged || defaultSize || boundaryOrigin || ticklessInterior || !isMiddleAxis(axisModel.options) ||
      axisHasExplicitDescriptionPlacement(axisModel.options))) commands[0] = renderAxisBounds({
      origin: { x: bounds.minX, y: bounds.minY },
      width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY,
      margin: { left: 0, right: 0, bottom: 0, top: 0 }
    });
  }
  const bodyText = commands.join("\n");
  return nativeAxisText
    ? `\n;{[tikzkit native math,tikzkit tex node anchors]\n${bodyText}\n}\n`
    : `\n${bodyText}\n`;
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
    `\\coordinate (current axis.outer south west) at (${pgfplotsUsesNative2DText(axisModel.options) ? "" : `[xshift=${PGFPLOTS_OUTER_BBOX_X_COMPENSATION}]`}current bounding box.south west);`,
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

function intervalAxisLabelOptions(axisModel) {
  const { options, ticks, geometry } = axisModel;
  if (!optionEnabled(options["ybar interval"]) || !pgfplotsUsesNative2DText(options) || isMiddleAxis(options) ||
    !pgfplotsCompatAtLeast(pgfplotsCompatLevel(options), "1.3")) return options;
  const measured = { ...options };
  for (const axis of ["x", "y"]) {
    if (!options[`${axis}label`] || !options[`${axis}ticklabels`] || ticks[axis].disabled ||
      options[`extra ${axis} ticks`] !== undefined || options[`${axis} axis label offset`] !== undefined) continue;
    const labelStyle = [options["label style"], options[`${axis} label style`], options[`${axis}label style`]]
      .filter(Boolean).join(",");
    if (parseOptions(labelStyle).at !== undefined) continue;
    const side = options[`${axis}ticklabel pos`] ?? options[`${axis} tick label pos`] ?? options.ticklabelpos ??
      options["ticklabel pos"] ?? options["tick label pos"];
    if (["upper", "top", "right"].includes(String(side).trim().toLowerCase())) continue;
    const style = axisTickLabelStyleOptions(options, axis);
    // Rotated, paragraph and explicitly anchored tick nodes need their full
    // projected shape; keep those on the existing path until separately audited.
    if (["rotate", "anchor", "shift", "xshift", "yshift", "text width", "align", "inner xsep", "inner ysep", "outer sep",
      "minimum width", "minimum height", "minimum size"].some(key => style[key] !== undefined)) continue;
    const fontCommand = pgfplotsRoleFontCommand("tick", options,
      style.font ?? options[`${axis}ticklabel font`] ?? options[`${axis} tick label font`] ?? options["axis tick label font"]);
    const font = parseTikzFontPatch(fontCommand);
    const boxes = axisRenderedTickLabels(options, axis, options[`${axis}ticklabels`], ticks[axis].values)
      .map(text => {
        const math = String(text).match(/^\$([^$]+)\$$/);
        return math ? layoutNativeMath(math[1], { fontSizePt: font.sizePt, mathVersion: font.mathVersion,
          preferNativeMath: true }) : layoutNativeText(text, font);
      });
    if (!boxes.length || boxes.some(box => !box)) continue;
    const texPtPerCm = 72.27 / 2.54;
    const innerSep = parseDimension(String(axisTickLabelInnerSep(options, axis) ?? "0.3333em"), {});
    const tickLength = parseDimension(String(options["major tick length"] || options.tickwidth || "0.15cm"), {});
    const alignment = String(options[`${axis}tick align`] ?? options["tick align"] ?? "inside").trim().toLowerCase();
    const tickProjection = tickLength * (alignment === "outside" ? 1 : alignment === "center" ? 0.5 : 0);
    // PGFPlots measures the far edge of each tick node's path for `ticklabel cs`
    // (pgfplotsticks.code.tex:460-496). The near anchor contributes one outer
    // sep (half the default .4pt node line width), not a second far-side sep.
    const extent = Math.max(...boxes.map(box => axis === "y" ? box.width : box.height + box.depth)) /
      texPtPerCm + 2 * innerSep + parseDimension("0.2pt", {});
    const offset = Number(options[`${axis} axis tick label distance`] !== undefined
      ? parseDimension(String(options[`${axis} axis tick label distance`]), {}) : tickProjection) + extent;
    const at = axis === "y" ? `${-offset / geometry.width},0.5` : `0.5,${-offset / geometry.height}`;
    measured[`${axis} label style`] = `at={(axis description cs:${at})},${options[`${axis} label style`] || ""}`;
  }
  return measured;
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
