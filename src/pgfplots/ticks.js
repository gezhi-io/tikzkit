export function createAxisTickModel(axisOptions = {}, ranges = {}, addplots = []) {
  return {
    x: createTickAxisModel("x", axisOptions, ranges, addplots),
    y: createTickAxisModel("y", axisOptions, ranges, addplots)
  };
}

export function createTickAxisModel(axis, axisOptions = {}, ranges = {}, addplots = []) {
  const allDisabled = ticksDisabled(axisOptions.ticks) || ticksDisabled(axisOptions.tick);
  const raw = axis === "x" ? axisOptions.xtick ?? axisOptions["x tick"] : axisOptions.ytick ?? axisOptions["y tick"];
  const disabled = allDisabled || ticksDisabled(raw);
  const min = Number(ranges[`${axis}Min`]);
  const max = Number(ranges[`${axis}Max`]);
  const distanceTicks = tickDistanceValues(axisOptions, axis, min, max);
  const explicit = hasExplicitTickOption(raw) || distanceTicks.length > 0;
  const values = disabled
    ? []
    : hasExplicitTickOption(raw)
      ? tickValues(raw, axis, addplots)
      : distanceTicks.length
        ? distanceTicks
        : majorTickValues(min, max, axis === "x" ? 7 : 6);
  return { disabled, explicit, values };
}

export function majorTickValues(min, max, maxTicks = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [];
  const span = max - min;
  const rawStep = Math.abs(span) / Math.max(1, maxTicks - 1);
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const fraction = rawStep / base;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  const step = niceFraction * base;
  const start = Math.ceil(min / step) * step;
  const values = [];
  for (let value = start; value <= max + step * 0.2; value += step) {
    values.push(roundAxis(value));
    if (values.length >= maxTicks + 2) break;
  }
  return values;
}

export function tickDistanceValues(axisOptions = {}, axis, min, max) {
  const raw = axisOptions[`${axis}tick distance`] ?? axisOptions[`${axis} tick distance`];
  const step = Number(raw);
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(min) || !Number.isFinite(max) || min > max) return [];
  const values = [];
  const epsilon = Math.max(1e-9, Math.abs(max - min) * 1e-10);
  for (let value = Math.ceil((min - epsilon) / step) * step; value <= max + epsilon; value += step) {
    values.push(roundAxis(value));
    if (values.length > 200) break;
  }
  return values;
}

function tickValues(raw, axis, addplots = []) {
  const text = String(raw || "").trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!text || text === "\\empty" || text === "empty") return [];
  if (text === "data") {
    const values = addplots.flatMap((plot) => plot.points || []).map((point) => point[axis]).filter(Number.isFinite);
    return [...new Set(values)];
  }
  return text.split(",").map((part) => Number(part.trim())).filter(Number.isFinite);
}

function hasExplicitTickOption(raw) {
  if (raw === undefined || raw === null) return false;
  if (raw === true || raw === false) return true;
  return String(raw).trim() !== "";
}

function ticksDisabled(raw) {
  if (raw === undefined || raw === null || raw === false) return false;
  const text = String(raw).trim().toLowerCase();
  return text === "none" || text === "false" || text === "off" || text === "\\empty" || text === "empty";
}

function roundAxis(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
