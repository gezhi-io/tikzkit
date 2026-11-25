import { dimensionDecimal } from "../engine/pgf-fixed-math.js";
import { createPgfRandom } from "../engine/pgfRandom.js";
import { sampleFunctionDataPoints } from "./rangeResolver.js";

const randomUse = /\b(?:rnd|rand|random|starburst)\b|\\pgfmath(?:rand(?:om(?:integer|item)?)?|rnd|generatepseudorandomnumber)\b/g;

function randomHistogram(plot, axis) {
  return plot?.type === "function" && !plot.is3d && /^(?:rnd|rand)$/.test(plot.expression) &&
    [axis, plot.options].some(layer => layer && (Object.hasOwn(layer, "hist") || Object.hasOwn(layer, "/pgfplots/hist")));
}

export function sampleSeededHistogramRows(plot, axis, options, random) {
  if (!random || !randomHistogram(plot, axis)) return;
  const count = Number(plot.options.samples ?? axis.samples ?? options.pgfplotsSamples ?? 25);
  const limit = options.pgfplotsMaxSamples || options.pgfplotsSamples || 1200;
  // A truncated/expanded sample list would shift every subsequent draw.
  if (plot.options["samples at"] !== undefined || axis["samples at"] !== undefined ||
      !Number.isSafeInteger(count) || count < 2 || count > limit) return;
  const grid = sampleFunctionDataPoints({ ...plot, expression: "0" }, axis, { ...options, scalarSurvey: true });
  // PGF's two random functions return a printed TeX dimension to the FPU.
  // This changes 0.62031 (seed 100's first rnd) to precisely 0.62032.
  return grid.map(({ x }) => ({ x, y: Number(dimensionDecimal(random[plot.expression]())) }));
}

export function createHistogramRandomSurvey(source) {
  if (!source.includes("\\pgfmathsetseed") || !/\b(?:rnd|rand)\b/.test(source)) return;
  let random;
  let sampled = false;
  const scopes = [];

  function globalState(value) {
    random = value;
    scopes.fill(value);
  }

  // A seed assignment is local; the generator's next draw globally defines
  // its state. Walk only gaps from the existing parsers, never look ahead.
  function observe(gap) {
    const tokens = /\\pgfmathsetseed(?![A-Za-z@])(?:\s*\{\s*([+-]?\d+)\s*\})?|\\(begin|end)\s*\{[^{}]*\}|\\[A-Za-z@]+|\\[\s\S]|[{}]|\b(?:rnd|rand|random|starburst)\b/g;
    for (const [token, literal, environment] of gap.matchAll(tokens)) {
      if (literal !== undefined || token === "\\pgfmathsetseed") {
        const seed = Number(literal);
        random = Number.isSafeInteger(seed) && Math.abs(seed) < 2147483647 ? createPgfRandom(seed) : undefined;
      } else if (environment === "begin" || token === "{" || token === "\\begingroup") scopes.push(random);
      else if (environment === "end" || token === "}" || token === "\\endgroup") random = scopes.pop();
      else if (token.match(randomUse)) globalState(undefined);
    }
  }

  function forAxis(axis, options) {
    return (gap, plot, statement = "") => {
      observe(gap);
      // Literal file/table names (e.g. random.dat) are not PGF expressions.
      const code = plot?.source === "file" || plot?.source === "table"
        ? [...Object.entries(plot.options), ...Object.entries(plot.tableOptions ?? {})].flat().join(" ") : statement;
      const uses = code.match(randomUse);
      if (uses?.length === 1 && uses[0] === plot?.expression) {
        const rows = sampleSeededHistogramRows(plot, axis, options, random);
        if (rows) {
          globalState(random);
          sampled = true;
          return { ...plot, type: "coordinates", points: rows, coordinateRows: [rows] };
        }
      }
      // Other consumers keep their existing evaluator. Their draw count is
      // unknown here; do not invent a stream position before the next seed.
      if (uses) globalState(undefined);
      return plot;
    };
  }

  function endAxis(end) {
    observe(end);
    const seed = sampled ? random?.getSeed() : undefined;
    sampled = false;
    return seed;
  }

  return { observe, forAxis, endAxis };
}
