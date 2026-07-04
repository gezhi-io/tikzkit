import { evaluateMath } from "../engine/math.js";
import { splitTopLevel } from "../engine/options.js";

export function parseCoordinateList(input) {
  const text = String(input || "");
  const points = [];
  const pattern = /\(([^)]*)\)/g;
  let match = pattern.exec(text);
  while (match) {
    const parts = splitTopLevel(match[1], ",");
    if (parts.length >= 2) {
      const point = {
        x: axisNumber(parts[0]),
        y: axisNumber(parts[1]),
        raw: `(${parts[0].trim()},${parts[1].trim()})`
      };
      if (parts.length >= 3) {
        point.z = axisNumber(parts[2]);
        point.raw = `(${parts[0].trim()},${parts[1].trim()},${parts[2].trim()})`;
      }
      points.push(point);
    }
    match = pattern.exec(text);
  }
  return points;
}

export function axisNumber(raw, fallback = 0) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const value = evaluateMath(String(raw), {});
  return Number.isFinite(value) ? value : fallback;
}
