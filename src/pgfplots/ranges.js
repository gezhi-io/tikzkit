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

export function scaleAxisValue(value, logMode = false) {
  return logMode ? Math.log10(Math.max(1e-12, Number(value))) : Number(value);
}

function finiteOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
