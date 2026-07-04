export function roundAxis(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

export function formatAxisNumber(value) {
  return String(roundAxis(value)).replace(/^-0$/, "0");
}

export function formatAxisPoint(point) {
  return `(${formatAxisNumber(point.x)},${formatAxisNumber(point.y)})`;
}

export function joinOptions(parts) {
  return parts.filter(Boolean).join(", ");
}
