import { parseOptions } from "../engine/options.js";

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
  const nested = plotOptions.quiver && plotOptions.quiver !== true ? parseOptions(plotOptions.quiver) : {};
  const normalized = { ...nested };
  for (const [rawKey, value] of Object.entries(plotOptions)) {
    const key = rawKey.replace(/^\/pgfplots\//, "");
    if (!key.startsWith("quiver/")) continue;
    normalized[key] = value;
    normalized[key.slice("quiver/".length)] = value;
  }
  return normalized;
}

export function quiverScale(raw) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 1;
}

export function quiverUpdatesLimits(quiver = {}) {
  const raw = quiver["update limits"];
  if (raw === undefined || raw === null || raw === "") return true;
  return !/^(?:false|off|no|0)$/i.test(String(raw).trim());
}
