export function formatSvgNumber(value) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}
