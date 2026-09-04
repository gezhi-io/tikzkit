import { isPgfplotsIntervalPlot } from "./histogram.js";

const COORDINATE_EPSILON = 1e-9;

export function preparePgfplotsStackedPlots(axisOptions = {}, addplots = [], options = {}) {
  const normalizedAxisOptions = normalizeVerticalStackedAxisOptions(axisOptions, options);
  if (!verticalStackingEnabled(normalizedAxisOptions)) {
    return { axisOptions: normalizedAxisOptions, addplots, active: false, supported: false };
  }
  if (!supportsVerticalCoordinateStack(addplots, normalizedAxisOptions)) {
    return { axisOptions: normalizedAxisOptions, addplots, active: true, supported: false };
  }

  const pointCount = addplots[0].points.length;
  const positiveLevels = Array(pointCount).fill(0);
  const negativeLevels = Array(pointCount).fill(0);
  const previousLevels = Array(pointCount).fill(0);
  const separateNegative = normalizedAxisOptions["stack negative"] === "separate";
  const direction = normalizedAxisOptions["stack dir"] === "minus" ? -1 : 1;
  const ignoresZero = optionEnabled(normalizedAxisOptions["stacked ignores zero"], true);

  const stackedPlots = addplots.map((plot) => {
    const points = plot.points.map((point, pointIndex) => {
      const delta = Number(point.y);
      const levels = separateNegative
        ? (delta < 0 ? negativeLevels : positiveLevels)
        : previousLevels;
      const stackBaseY = levels[pointIndex];
      const y = stackBaseY + direction * delta;
      levels[pointIndex] = y;
      return {
        ...point,
        y,
        stackBaseY,
        stackDeltaY: delta,
        stackIgnored: ignoresZero && Math.abs(delta) <= COORDINATE_EPSILON
      };
    });
    return {
      ...plot,
      points,
      coordinateRows: [points],
      pgfplotsStacked: true
    };
  });

  return {
    axisOptions: normalizedAxisOptions,
    addplots: stackedPlots,
    active: true,
    supported: true
  };
}

export function pgfplotsStackedRenderEntries(addplots = [], axisOptions = {}) {
  const entries = addplots.map((plot, plotIndex) => ({ plot, plotIndex }));
  const hasPreparedStack = addplots.some((plot) => plot.pgfplotsStacked);
  const reverse = optionEnabled(axisOptions["reverse stacked plots"], true);
  return hasPreparedStack && reverse ? entries.reverse() : entries;
}

function normalizeVerticalStackedAxisOptions(axisOptions, options) {
  const ybarStacked = optionEnabled(axisOptions["ybar stacked"], false);
  if (!ybarStacked) return { ...axisOptions };

  const compat = options.compat ?? options.pgfplotsStyleOptions?.compat;
  const ybarDirection = normalizedChoice(axisOptions["ybar stacked"], "plus");
  const stackDirection = normalizedChoice(axisOptions["stack dir"], ybarDirection);
  const negativeMode = normalizedNegativeMode(
    axisOptions["stack negative"],
    compatAtLeast(compat, 1.13) ? "separate" : "on previous"
  );
  const ignoresZero = axisOptions["stacked ignores zero"] === undefined
    ? compatAtLeast(compat, 1.9)
    : axisOptions["stacked ignores zero"];

  return {
    ...axisOptions,
    ybar: true,
    "stack plots": "y",
    "stack dir": stackDirection,
    "stack negative": negativeMode,
    "stacked ignores zero": ignoresZero
  };
}

function verticalStackingEnabled(axisOptions) {
  return normalizedChoice(axisOptions["stack plots"], "false") === "y";
}

function supportsVerticalCoordinateStack(addplots, axisOptions) {
  if (!addplots.length || String(axisOptions.ymode || "").trim().toLowerCase() === "log") return false;
  if (addplots.some((plot) => (
    plot.type !== "coordinates" ||
    plot.is3d ||
    plot.closedCycle ||
    !Array.isArray(plot.points) ||
    !plot.points.length ||
    isPgfplotsIntervalPlot(axisOptions, plot.options || {}, "y")
  ))) return false;

  const grid = addplots[0].points.map((point) => Number(point.x));
  return addplots.every((plot) => (
    plot.points.length === grid.length &&
    plot.points.every((point, index) => (
      Number.isFinite(Number(point.x)) &&
      Number.isFinite(Number(point.y)) &&
      Math.abs(Number(point.x) - grid[index]) <= COORDINATE_EPSILON
    ))
  ));
}

function normalizedChoice(value, fallback) {
  if (value === undefined || value === null || value === true || value === "") return fallback;
  return String(value).trim().toLowerCase();
}

function normalizedNegativeMode(value, fallback) {
  const normalized = normalizedChoice(value, fallback);
  return normalized === "separate" ? "separate" : "on previous";
}

function optionEnabled(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true) return true;
  if (value === false) return false;
  return !["false", "0", "none", "off", "no"].includes(String(value).trim().toLowerCase());
}

function compatAtLeast(raw, minimum) {
  const value = String(raw ?? "newest").trim().toLowerCase();
  if (!value || value === "newest") return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed >= minimum : true;
}
