export function createAxisRanges(input = {}) {
  return {
    xMin: finiteOrDefault(input.xMin, 0),
    xMax: finiteOrDefault(input.xMax, 1),
    yMin: finiteOrDefault(input.yMin, 0),
    yMax: finiteOrDefault(input.yMax, 1),
    zMin: finiteOrDefault(input.zMin, 0),
    zMax: finiteOrDefault(input.zMax, 1)
  };
}

export function rangeSpan(ranges, axis) {
  const min = Number(ranges?.[`${axis}Min`]);
  const max = Number(ranges?.[`${axis}Max`]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 1;
  return max - min || 1;
}

export function isLogAxis(axisOptions = {}, axis) {
  return String(axisOptions[`${axis}mode`] || axisOptions[`${axis} scale`] || "")
    .trim()
    .toLowerCase() === "log";
}

export function scaleAxisValue(value, logMode = false, logBase = 10) {
  const numeric = Number(value);
  if (!logMode) return numeric;
  const base = Number(logBase);
  if (!(numeric > 0) || !(base > 0) || Math.abs(base - 1) < 1e-12) return NaN;
  return Math.log(numeric) / Math.log(base);
}

function finiteOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
