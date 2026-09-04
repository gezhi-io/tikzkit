import { isPgfplotsIntervalPlot } from "./histogram.js";

const COORDINATE_EPSILON = 1e-9;

export function preparePgfplotsStackedPlots(axisOptions = {}, addplots = [], options = {}) {
  const normalizedAxisOptions = normalizeStackedAxisOptions(axisOptions, options);
  const stackAxis = pgfplotsStackAxis(normalizedAxisOptions);
  if (!stackAxis) {
    return { axisOptions: normalizedAxisOptions, addplots, active: false, supported: false };
  }
  if (!supportsCoordinateStack(addplots, normalizedAxisOptions, stackAxis)) {
    return { axisOptions: normalizedAxisOptions, addplots, active: true, supported: false };
  }

  const pointCount = addplots[0].points.length;
  const positiveLevels = Array(pointCount).fill(0);
  const negativeLevels = Array(pointCount).fill(0);
  const previousLevels = Array(pointCount).fill(0);
  const separateNegative = normalizedAxisOptions["stack negative"] === "separate";
  const direction = normalizedAxisOptions["stack dir"] === "minus" ? -1 : 1;
  const ignoresZero = optionEnabled(normalizedAxisOptions["stacked ignores zero"], true);
  const valueKey = stackAxis;
  const baseKey = stackAxis === "x" ? "stackBaseX" : "stackBaseY";
  const deltaKey = stackAxis === "x" ? "stackDeltaX" : "stackDeltaY";

  const stackedPlots = addplots.map((plot) => {
    const points = plot.points.map((point, pointIndex) => {
      const delta = Number(point[valueKey]);
      const levels = separateNegative
        ? (delta < 0 ? negativeLevels : positiveLevels)
        : previousLevels;
      const stackBase = levels[pointIndex];
      const value = stackBase + direction * delta;
      levels[pointIndex] = value;
      return {
        ...point,
        [valueKey]: value,
        [baseKey]: stackBase,
        [deltaKey]: delta,
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

export function pgfplotsStackAxis(axisOptions = {}) {
  const axis = normalizedChoice(axisOptions["stack plots"], "false");
  return axis === "x" || axis === "y" ? axis : null;
}

export function pgfplotsStackedRenderEntries(addplots = [], axisOptions = {}) {
  const entries = addplots.map((plot, plotIndex) => ({ plot, plotIndex }));
  const hasPreparedStack = addplots.some((plot) => plot.pgfplotsStacked);
  const reverse = optionEnabled(axisOptions["reverse stacked plots"], true);
  return hasPreparedStack && reverse ? entries.reverse() : entries;
}

function normalizeStackedAxisOptions(axisOptions, options) {
  const variant = stackedBarVariant(axisOptions);
  if (!variant) return { ...axisOptions };

  const compat = options.compat ?? options.pgfplotsStyleOptions?.compat;
  const { stackAxis, stackedKey, plotHandler, interval } = variant;
  const barDirection = normalizedChoice(axisOptions[stackedKey], "plus");
  const stackDirection = normalizedChoice(axisOptions["stack dir"], barDirection);
  const negativeMode = normalizedNegativeMode(
    axisOptions["stack negative"],
    compatAtLeast(compat, 1.13) ? "separate" : "on previous"
  );
  const ignoresZero = axisOptions["stacked ignores zero"] === undefined
    ? (interval ? false : compatAtLeast(compat, 1.9))
    : axisOptions["stacked ignores zero"];

  return {
    ...axisOptions,
    [plotHandler]: true,
    "stack plots": stackAxis,
    "stack dir": stackDirection,
    "stack negative": negativeMode,
    "stacked ignores zero": ignoresZero
  };
}

function stackedBarVariant(axisOptions) {
  const variants = [
    { stackAxis: "x", stackedKey: "xbar interval stacked", plotHandler: "xbar interval", interval: true },
    { stackAxis: "y", stackedKey: "ybar interval stacked", plotHandler: "ybar interval", interval: true },
    { stackAxis: "x", stackedKey: "xbar stacked", plotHandler: "xbar", interval: false },
    { stackAxis: "y", stackedKey: "ybar stacked", plotHandler: "ybar", interval: false }
  ];
  return variants.find(({ stackedKey }) => optionEnabled(axisOptions[stackedKey], false)) || null;
}

function supportsCoordinateStack(addplots, axisOptions, stackAxis) {
  const gridAxis = stackAxis === "x" ? "y" : "x";
  if (!addplots.length || String(axisOptions[`${stackAxis}mode`] || "").trim().toLowerCase() === "log") return false;
  const intervalModes = addplots.map((plot) => (
    isPgfplotsIntervalPlot(axisOptions, plot.options || {}, stackAxis)
  ));
  const interval = intervalModes[0];
  if (intervalModes.some((value) => value !== interval)) return false;
  if (addplots.some((plot) => (
    plot.type !== "coordinates" ||
    plot.is3d ||
    plot.closedCycle ||
    !Array.isArray(plot.points) ||
    plot.points.length < (interval ? 2 : 1)
  ))) return false;

  const grid = addplots[0].points.map((point) => Number(point[gridAxis]));
  return addplots.every((plot) => (
    plot.points.length === grid.length &&
    plot.points.every((point, index) => (
      Number.isFinite(Number(point.x)) &&
      Number.isFinite(Number(point.y)) &&
      Math.abs(Number(point[gridAxis]) - grid[index]) <= COORDINATE_EPSILON
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
