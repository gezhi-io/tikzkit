import { parseOptions } from "../engine/options.js";
import { evaluateRestrictedExpression } from "../engine/safe-expression.js";

export function isAxisQuiverPlot(plotOptions = {}) {
  return Boolean(
    plotOptions.quiver ||
      plotOptions["/pgfplots/quiver"] ||
      plotOptions["quiver/u"] ||
      plotOptions["quiver/v"] ||
      plotOptions["quiver/w"]
  );
}

export function parseQuiverOptions(plotOptions = {}) {
  const normalized = {};
  for (const [rawKey, value] of Object.entries(plotOptions)) {
    const key = rawKey.replace(/^\/pgfplots\//, "");
    if (key === "quiver" && value && value !== true) {
      Object.assign(normalized, parseOptions(value));
      continue;
    }
    if (!key.startsWith("quiver/")) continue;
    normalized[key] = value;
    normalized[key.slice("quiver/".length)] = value;
  }
  return normalized;
}

export function quiverScale(raw) {
  const value = evaluateRestrictedExpression(String(raw ?? "1"), {}, { pgfTrig: true }).value;
  return Number.isFinite(value) ? value : 1;
}

export function quiverUpdatesLimits(quiver = {}) {
  const raw = quiver["update limits"];
  if (raw === undefined || raw === null || raw === "") return true;
  return !/^(?:false|off|no|0)$/i.test(String(raw).trim());
}
