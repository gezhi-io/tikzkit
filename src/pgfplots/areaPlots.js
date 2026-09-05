import { axisPlotPointChain, clampAxisBaseline } from "./plotPath.js";
import { pgfplotsStackAxis } from "./stackedPlots.js";

export function normalizePgfplotsAreaOptions(axisOptions = {}) {
  if (!optionEnabled(axisOptions["area style"])) return { ...axisOptions };
  return {
    ...axisOptions,
    "area cycle list": axisOptions["area cycle list"] ?? true,
    "area legend": axisOptions["area legend"] ?? true,
    "axis on top": axisOptions["axis on top"] ?? true
  };
}

export function stackedClosedCyclePointChain(plot, dataPoints, mappedPoints, axisOptions, geometry, ranges = {}) {
  if (!plot?.pgfplotsStacked || pgfplotsStackAxis(axisOptions) !== "y") return null;
  if (!dataPoints.length || dataPoints.length !== mappedPoints.length) return null;

  const zeroLevelPoints = dataPoints
    .map((point) => {
      const zeroLevel = Number.isFinite(Number(point.stackBaseY)) ? Number(point.stackBaseY) : 0;
      return geometry.mapPoint({
        x: point.x,
        y: clampAxisBaseline(
          zeroLevel,
          Number.isFinite(Number(ranges.yMin)) ? Number(ranges.yMin) : -Infinity,
          Number.isFinite(Number(ranges.yMax)) ? Number(ranges.yMax) : Infinity
        )
      });
    })
    .reverse();
  const top = axisPlotPointChain(mappedPoints, axisOptions, plot.options);
  const zeroLevel = axisPlotPointChain(
    zeroLevelPoints,
    axisOptions,
    plot.options,
    { mirrorConstPlot: true }
  );
  return `${top} -- ${zeroLevel} -- cycle`;
}

export function pgfplotsUsesAreaCycle(axisOptions = {}) {
  return optionEnabled(axisOptions["area cycle list"]);
}

export function pgfplotsUsesAreaLegend(axisOptions = {}) {
  if (optionEnabled(axisOptions["area legend"])) return true;
  const legendStyle = String(axisOptions["legend style"] || "");
  return /(?:^|,)\s*area legend(?:\s*(?:,|$|=true\b))/.test(legendStyle);
}

function optionEnabled(value) {
  if (value === undefined || value === null || value === false) return false;
  return !["false", "0", "none", "off", "no"].includes(String(value).trim().toLowerCase());
}
