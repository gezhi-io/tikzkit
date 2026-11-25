import { pgfplotsCompatAtLeast } from "./compat.js";
import { texAdd, texLess, texMultiply } from "./surveyFloat.js";

// tikzlibrarypgfplots.statistics.code.tex: /pgfplots/boxplot/estimator choices.
const estimators = new Map([
  ["legacy"], ["legacy*"],
  ["R1", "SAS3", "Maple1"],
  ["R2", "SAS5", "Maple2"],
  ["R3", "SAS2"],
  ["R4", "SAS1", "SciPy0-1", "Maple3"],
  ["R5", "SciPy12-12", "Maple4"],
  ["R6", "SAS4", "SciPy0-0", "Maple5"],
  ["R7", "Excel", "SciPy1-1", "Maple6"],
  ["R8", "SciPy13-13", "Maple7"],
  ["R9", "SciPy38-38", "Maple8"]
].flatMap(names => names.map(name => [name, names[0]])));

function midpoint(a, b) {
  const sum = a + b;
  return Number.isFinite(sum) ? sum / 2 : a / 2 + b / 2;
}

function quantile(data, p, estimator, backend) {
  const n = data.length;
  if (!n) return null;
  const at = rank => data[Math.max(1, Math.min(n, rank)) - 1];
  let h = n * p;
  switch (estimator) {
    case "legacy":
    case "legacy*": {
      // legacy uses one-based ranks; the original legacy* used zero-based
      // offsets into n-1 intervals. Both take a midpoint for ANY fraction.
      const original = estimator === "legacy*";
      const count = original ? n - 1 : n;
      h = backend === "tex" ? texMultiply(count, p) : count * p;
      const rank = Math.floor(h) + (original ? 1 : 0);
      const fractional = backend === "tex" ? texLess(Math.floor(h), h) : !Number.isInteger(h);
      return fractional ? midpoint(at(rank), at(rank + 1)) : at(rank);
    }
    case "R1": return at(Math.ceil(h));
    case "R2":
      h += 0.5;
      return midpoint(at(Math.ceil(h - 0.5)), at(Math.floor(h + 0.5)));
    // PGF rounds a half up here, not to the nearest even rank as R itself does.
    case "R3": return at(Math.round(backend === "tex" ? texMultiply(n, p) : h));
    case "R4": break;
    case "R5": h += 0.5; break;
    case "R6": h = (n + 1) * p; break;
    case "R7": h = (n - 1) * p + 1; break;
    case "R8": h = (n + 1 / 3) * p + 1 / 3; break;
    case "R9": h = (n + 1 / 4) * p + 3 / 8; break;
  }
  if (h <= 1) return data[0];
  if (h >= n) return data[n - 1];
  const rank = Math.floor(h);
  const t = h - rank;
  const a = at(rank), b = at(rank + 1);
  if (t === 0 || a === b) return a;
  return Number.isFinite(b - a) ? a + t * (b - a) : (1 - t) * a + t * b;
}

function numberOption(value, fallback) {
  if (typeof value === "string" && value.trim() !== "") value = Number(value);
  return Number.isFinite(value) ? value : fallback;
}

function statistic(option, computed) {
  if (option === undefined || option === "auto") return computed;
  return numberOption(option, null);
}

/**
 * Summarize finite numeric measurements, without changing the input. Options:
 * estimator (overrides compat), lowerProbability, upperProbability, whiskerRange,
 * and overrides named after the result fields (except outliers). An omitted or
 * "auto" field is computed; null or "" disables it. In particular average is a
 * numerical result, not a request to paint a mark.
 *
 * The default survey is TeX, except for the Lua-only R1/R2. Set backend to
 * "lua" to select its outlier ordering and quartile override behavior explicitly.
 */
export function summarizeBoxplot(values, options = {}) {
  const defaultName = pgfplotsCompatAtLeast(options.compat, "1.12") ? "Excel" : "legacy";
  const name = String(options.estimator ?? defaultName).trim();
  const estimator = estimators.get(name);
  if (!estimator) throw new RangeError(`Unknown boxplot estimator: ${name}`);
  const luaOnly = estimator === "R1" || estimator === "R2";
  const backend = options.backend ?? (luaOnly ? "lua" : "tex");
  if (backend !== "lua" && backend !== "tex") throw new RangeError(`Unknown boxplot backend: ${backend}`);
  if (backend === "tex" && luaOnly) throw new RangeError(`Boxplot estimator ${name} requires the Lua backend`);

  const data = [];
  let sum = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    data.push(value);
    sum += value;
  }
  data.sort((a, b) => a - b);
  if (backend === "lua") sum = data.reduce((s, v) => s + v, 0);
  const n = data.length;
  let mean = n ? sum / n : null;
  if (n && !Number.isFinite(sum)) {
    const scale = Math.max(-data[0], data[n - 1]);
    mean = (data.reduce((s, v) => s + v / scale, 0) / n) * scale;
  }
  const percentile = p => quantile(data, p, estimator, backend);
  const q1 = percentile(numberOption(options.lowerProbability, 0.25));
  const q3 = percentile(numberOption(options.upperProbability, 0.75));
  const lowerQuartile = statistic(options.lowerQuartile, q1);
  const upperQuartile = statistic(options.upperQuartile, q3);
  const outliers = [];
  let lowerWhisker = null, upperWhisker = null;
  if (n) {
    // TeX reads back nonempty explicit quartiles before computing fences.
    // statistics.lua classifies first, before any overrides are sent to TeX.
    const lower = backend === "lua" ? q1 : lowerQuartile ?? q1;
    const upper = backend === "lua" ? q3 : upperQuartile ?? q3;
    const range = numberOption(options.whiskerRange, 1.5);
    const tex = backend === "tex";
    const width = range === 0 ? 0 : tex ? texMultiply(texAdd(upper, -lower), range) : (upper - lower) * range;
    const lowFence = tex ? texAdd(lower, -width) : lower - width;
    const highFence = tex ? texAdd(upper, width) : upper + width;
    const less = tex ? texLess : (a, b) => a < b;
    // The two whiskers are independent: neither requires a sample to satisfy
    // BOTH fences. In particular, even a two-point box can have crossed whiskers.
    for (const value of data) {
      if (less(value, lowFence)) outliers.push(value);
      else if (lowerWhisker === null) lowerWhisker = value;
      if (less(highFence, value)) {
        if (backend === "tex") outliers.push(value);
      } else upperWhisker = value;
    }
    if (backend === "lua") {
      for (let i = n - 1; i >= 0 && data[i] > highFence; --i) outliers.push(data[i]);
    }
  }
  return {
    lowerWhisker: statistic(options.lowerWhisker, lowerWhisker),
    lowerQuartile,
    median: statistic(options.median, percentile(0.5)),
    upperQuartile,
    upperWhisker: statistic(options.upperWhisker, upperWhisker),
    average: statistic(options.average, mean),
    sampleSize: statistic(options.sampleSize, n),
    outliers
  };
}
