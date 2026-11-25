import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { summarizeBoxplot } from "../src/pgfplots/boxplotStatistics.js";

const five = [20, 0, 40, 2, 10];
const four = [4, 1, 8, 2];
const tails = [9, 1, -9, 6, 3, 1, -2, 8, 3, 1, 2, 3, -10, 6, 1, 9, -2, 3, -9, 1, 3];
const extreme = [100, 2, 1, 3, 4, 0];
const decimalTies = [0.6, -0.2, 0.1, 0.15, 0.3];
const zeroFence = [0, 0.21, 0.25, 0.35, 0.56];
const fifty = Array.from({ length: 50 }, (_, i) => i + 1);
const modern = { compat: "1.18" };
const quartiles = r => [r.lowerQuartile, r.median, r.upperQuartile];

// These fixed expectations also run on machines without TeX.
const estimatorCases = [
  ["legacy", [], [1, 6, 15]],
  ["legacy*", [], [2, 10, 20]],
  ["R1", ["SAS3", "Maple1"], [2, 10, 20]],
  ["R2", ["SAS5", "Maple2"], [2, 10, 20]],
  ["R3", ["SAS2"], [0, 10, 20]],
  ["R4", ["SAS1", "SciPy0-1", "Maple3"], [0.5, 6, 17.5]],
  ["R5", ["SciPy12-12", "Maple4"], [1.5, 10, 25]],
  ["R6", ["SAS4", "SciPy0-0", "Maple5"], [1, 10, 30]],
  ["R7", ["Excel", "SciPy1-1", "Maple6"], [2, 10, 20]],
  ["R8", ["SciPy13-13", "Maple7"], [4 / 3, 10, 80 / 3]],
  ["R9", ["SciPy38-38", "Maple8"], [1.375, 10, 26.25]]
];

function close(actual, expected, label, tolerance = 1e-14) {
  if (expected === null) return assert.equal(actual, null, label);
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${label}: got ${actual}, expected ${expected}`);
}

test("raw boxplot compatibility switches at 1.12; legacy* is never the compatibility default", () => {
  for (const compat of [undefined, "default", "pre 1.3", "1.3", "1.10", "1.11"]) {
    assert.deepEqual(quartiles(summarizeBoxplot(four, { compat })), [1, 2, 4], String(compat));
  }
  for (const compat of ["1.12", "1.18", "newest"]) {
    assert.deepEqual(quartiles(summarizeBoxplot(four, { compat })), [1.75, 3, 5], compat);
  }
  assert.deepEqual(quartiles(summarizeBoxplot(four, { ...modern, estimator: "legacy*" })), [1.5, 3, 6]);
  assert.deepEqual(quartiles(summarizeBoxplot(four, { compat: "1.8", estimator: "Excel" })), [1.75, 3, 5]);
});

test("all native estimator spellings, interpolation ranks, and discontinuous ties", () => {
  for (const [name, aliases, expected] of estimatorCases) {
    for (const estimator of [name, ...aliases]) {
      const actual = quartiles(summarizeBoxplot(five, { estimator }));
      actual.forEach((v, i) => close(v, expected[i], `${estimator} quantile ${i}`));
      const ends = summarizeBoxplot([2, 8], { estimator, lowerProbability: 0, upperProbability: 1 });
      assert.deepEqual([ends.lowerQuartile, ends.upperQuartile], [2, 8], `${estimator} clamps endpoint ranks`);
    }
  }
  assert.deepEqual(quartiles(summarizeBoxplot(four, { estimator: "R1" })), [1, 2, 4]);
  assert.deepEqual(quartiles(summarizeBoxplot(four, { estimator: "R2" })), [1.5, 3, 6]);
  assert.equal(summarizeBoxplot(five, { estimator: "R3" }).median, 10, "rank 2.5 rounds to 3, not 2");
  assert.throws(() => summarizeBoxplot(five, { estimator: "ScuPy13-13" }), RangeError);
});

test("strict outlier tests include ties on either fence and preserve multiplicity in native order", () => {
  const r = summarizeBoxplot(Object.freeze([...tails]), modern);
  assert.deepEqual(r, {
    lowerWhisker: -2, lowerQuartile: 1, median: 2, upperQuartile: 3, upperWhisker: 6,
    average: 4 / 3, sampleSize: 21, outliers: [-10, -9, -9, 8, 9, 9]
  });
  assert.deepEqual(summarizeBoxplot(tails, { ...modern, backend: "lua" }).outliers, [-10, -9, -9, 9, 9, 8]);
  assert.deepEqual(summarizeBoxplot(tails, { estimator: "SAS3" }).outliers, [-10, -9, -9, 9, 9, 8]);
  assert.deepEqual(summarizeBoxplot([2, 1, 2, 2, 7, 2, 2], modern), {
    lowerWhisker: 2, lowerQuartile: 2, median: 2, upperQuartile: 2, upperWhisker: 2,
    average: 18 / 7, sampleSize: 7, outliers: [1, 7]
  });
});

test("TeX decimal decisions remain distinct from Lua's binary floating-point decisions", () => {
  const decimal = summarizeBoxplot(decimalTies, modern);
  assert.deepEqual([decimal.lowerWhisker, decimal.upperWhisker, decimal.outliers], [-0.2, 0.6, []]);
  assert.deepEqual(summarizeBoxplot(decimalTies, { ...modern, backend: "lua" }).outliers, [-0.2]);
  const zero = summarizeBoxplot(zeroFence, modern);
  assert.deepEqual([zero.lowerWhisker, zero.upperWhisker, zero.outliers], [0, 0.56, []]);
  const options = { estimator: "legacy", lowerProbability: 0.58 };
  assert.equal(summarizeBoxplot(fifty, options).lowerQuartile, 29);
  assert.equal(summarizeBoxplot(fifty, { ...options, backend: "lua" }).lowerQuartile, 28.5);
});

test("offset probabilities, zero range, and independent one-sided whiskers", () => {
  const offsets = summarizeBoxplot(five, { ...modern, lowerProbability: 0.2, upperProbability: 0.6, whiskerRange: 0 });
  close(offsets.lowerQuartile, 1.6, "20th percentile");
  assert.deepEqual({ ...offsets, lowerQuartile: 1.6 }, {
    lowerWhisker: 2, lowerQuartile: 1.6, median: 10, upperQuartile: 14, upperWhisker: 10,
    average: 14.4, sampleSize: 5, outliers: [0, 20, 40]
  });
  assert.deepEqual(summarizeBoxplot([10, 0], { ...modern, whiskerRange: 0 }), {
    lowerWhisker: 10, lowerQuartile: 2.5, median: 5, upperQuartile: 7.5, upperWhisker: 0,
    average: 5, sampleSize: 2, outliers: [0, 10]
  });
  const aboveData = summarizeBoxplot([0, 10], { ...modern, lowerQuartile: 50, upperQuartile: 50 });
  assert.equal(aboveData.lowerWhisker, null);
  assert.equal(aboveData.upperWhisker, 10);
  assert.deepEqual(aboveData.outliers, [0, 10]);
});

test("quartile overrides affect TeX fences; other overrides do not reclassify observations", () => {
  const options = { ...modern, lowerQuartile: 0, upperQuartile: 50, median: 0, average: 0, sampleSize: 12 };
  const tex = summarizeBoxplot(extreme, options);
  assert.deepEqual(tex, { lowerWhisker: 0, lowerQuartile: 0, median: 0, upperQuartile: 50, upperWhisker: 100,
    average: 0, sampleSize: 12, outliers: [] });
  assert.deepEqual(summarizeBoxplot(extreme, { ...options, backend: "lua" }),
    { ...tex, upperWhisker: 4, outliers: [100] }, "Lua publishes overrides after classification");
  assert.deepEqual(summarizeBoxplot(extreme, { ...modern, lowerWhisker: 2, upperWhisker: 200 }), {
    lowerWhisker: 2, lowerQuartile: 1.25, median: 2.5, upperQuartile: 3.75, upperWhisker: 200,
    average: 110 / 6, sampleSize: 6, outliers: [100]
  });
  assert.deepEqual(summarizeBoxplot(extreme, { ...modern, lowerQuartile: "", median: null, sampleSize: "",
    average: "auto", whiskerRange: 0 }), {
    lowerWhisker: 2, lowerQuartile: null, median: null, upperQuartile: 3.75, upperWhisker: 3,
    average: 110 / 6, sampleSize: null, outliers: [0, 1, 4, 100]
  });
  assert.equal(summarizeBoxplot(four, { average: "" }).average, null);
  assert.equal(summarizeBoxplot(four).average, 3.75, "a numerical mean does not imply a painted mean mark");
});

test("empty and nonfinite input, singleton rank clamping, and finite means", () => {
  assert.deepEqual(summarizeBoxplot([NaN, -Infinity, Infinity, "", null]), {
    lowerWhisker: null, lowerQuartile: null, median: null, upperQuartile: null, upperWhisker: null,
    average: null, sampleSize: 0, outliers: []
  });
  for (const [estimator] of estimatorCases) {
    assert.deepEqual(summarizeBoxplot([NaN, -2, Infinity], { estimator }), {
      lowerWhisker: -2, lowerQuartile: -2, median: -2, upperQuartile: -2, upperWhisker: -2,
      average: -2, sampleSize: 1, outliers: []
    });
  }
  const max = Number.MAX_VALUE;
  assert.equal(summarizeBoxplot([max, max]).average, max);
  assert.equal(summarizeBoxplot([-max, max], modern).median, 0);
});

// Observe the installed raw handler and the final keys it hands to the
// prepared handler. The published average is not necessarily the raw mean.
const preamble = String.raw`\documentclass{article}
\usepackage{pgfplots}\usepgfplotslibrary{statistics}
\makeatletter
\def\bxfield#1#2{\typeout{BX|\bxid|#1|\pgfplotsboxplotvalue{#2}}}
\let\bxend\pgfplotsplothandlersurveyend@boxplot@prepared
\def\pgfplotsplothandlersurveyend@boxplot@prepared{%
  \bxfield{lowerWhisker}{lower whisker}\bxfield{lowerQuartile}{lower quartile}%
  \bxfield{median}{median}\bxfield{upperQuartile}{upper quartile}%
  \bxfield{upperWhisker}{upper whisker}\bxfield{average}{average}\bxfield{sampleSize}{sample size}\bxend}
\def\bxfloat#1#2{\begingroup\pgfmathfloattosci{#2}\typeout{BX|\bxid|#1|\pgfmathresult}\endgroup}
\let\bxstats\pgfplotsplothandlersurveyend@boxplot@computestats
\def\pgfplotsplothandlersurveyend@boxplot@computestats{%
  \bxstats\bxfloat{mean}{\pgfplotsplothandlerboxplot@average}}
\let\bxoutlier\pgfplotsplothandlerboxplot@outlier
\def\pgfplotsplothandlerboxplot@outlier{\bxfloat{out}{\pgfplots@current@point@data}\bxoutlier}
\ifdefined\directlua
  \directlua{
    local compute = pgfplots.boxPlotCompute
    pgfplots.boxPlotCompute = function(...)
      local r = compute(...)
      local prefix = "BX|" .. token.get_macro("bxid") .. "|"
      texio.write_nl("term and log", prefix .. "mean|" .. r.average)
      for _, v in ipairs(r.outliers) do texio.write_nl("term and log", prefix .. "out|" .. v) end
      return r
    end
  }
\fi
\makeatother\begin{document}`;

const keys = {
  estimator: "estimator", lowerProbability: "lower quartile off", upperProbability: "upper quartile off",
  whiskerRange: "whisker range", lowerWhisker: "lower whisker", lowerQuartile: "lower quartile",
  median: "median", upperQuartile: "upper quartile", upperWhisker: "upper whisker", average: "average",
  sampleSize: "sample size"
};

function nativePlot({ data, options = {} }, i, backend) {
  const raw = Object.entries(options).filter(([k]) => Object.hasOwn(keys, k))
    .map(([k, v]) => `${keys[k]}={${v ?? ""}}`).join(",");
  const compat = options.compat ? `compat=${options.compat},` : "";
  return String.raw`\begingroup\def\bxid{${i}}\pgfplotsset{${compat}lua backend=${backend === "lua"}}
    \begin{tikzpicture}\begin{axis}[hide axis,xmin=-20,xmax=210,ymin=0,ymax=2]
    \addplot[boxplot={${raw}}] coordinates {${data.map(y => `(0,${y})`).join(" ")}};
    \end{axis}\end{tikzpicture}\endgroup`;
}

function compareNative(cases, backend) {
  const engine = backend === "lua" ? process.env.QA_LUALATEX_ENGINE || "lualatex" : process.env.QA_LATEX_ENGINE || "pdflatex";
  const dir = mkdtempSync(join(tmpdir(), "pgfplots-boxplot-"));
  let log;
  try {
    writeFileSync(join(dir, "probe.tex"), [preamble, ...cases.map((c, i) => nativePlot(c, i, backend)), "\\end{document}"].join("\n"));
    const env = { ...process.env, TEXMFCACHE: [".", process.env.TEXMFCACHE || "$TEXMFSYSVAR", "$TEXMFVAR"].join(delimiter) };
    const run = spawnSync(engine, ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "probe.tex"],
      { cwd: dir, encoding: "utf8", timeout: 30000, env });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout.slice(-2500));
    log = run.stdout.split(/\r?\n/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  cases.forEach(({ data, options = {} }, i) => {
    const actual = summarizeBoxplot(data, { ...options, backend });
    const label = `${engine}, case ${i} ${JSON.stringify(options)}`;
    const records = key => log.filter(l => l.startsWith(`BX|${i}|${key}|`)).map(l => l.split("|")[3])
      .map(v => v === "" ? null : Number(v));
    const single = key => {
      const found = records(key);
      assert.equal(found.length, 1, `${label}: missing or repeated ${key}`);
      return found[0];
    };
    const tolerance = backend === "tex" ? 5e-5 : 1e-12;
    for (const [key, value] of Object.entries(actual)) {
      if (key === "outliers") assert.deepEqual(value, records("out"), `${label}: point stream`);
      else if (key === "average") {
        const published = single(key), computed = single("mean");
        const auto = options.average === undefined || options.average === "auto";
        if (auto) {
          // TeX's mantissa division, e.g. 110/6 = 18.332, is less precise than Lua's.
          const meanTolerance = backend === "tex" ? 1e-4 : tolerance;
          close(value, computed, `${label}: computed mean`, meanTolerance);
          if (options.average === "auto" && backend === "tex") close(value, published, label, meanTolerance);
          else assert.equal(published, null, `${label}: mean was not published`);
        } else close(value, published, label, tolerance);
      } else close(value, single(key), `${label}: ${key}`, tolerance);
    }
  });
}

const native = { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" };
const common = [
  { data: tails, options: modern },
  { data: decimalTies, options: modern },
  { data: [-4], options: { ...modern, average: "auto" } },
  { data: [10, 0], options: { ...modern, whiskerRange: 0 } },
  { data: five, options: { ...modern, lowerProbability: 0.2, upperProbability: 0.6, whiskerRange: 0 } },
  { data: extreme, options: { ...modern, lowerQuartile: 0, upperQuartile: 50, median: 0, average: 0, sampleSize: 12 } },
  { data: extreme, options: { ...modern, lowerWhisker: 2, upperWhisker: 200 } },
  { data: extreme, options: { ...modern, lowerQuartile: "", median: "", average: "auto", sampleSize: "", whiskerRange: 0 } },
  { data: zeroFence, options: modern }
];

test("installed PGFPlots TeX raw plots: effective statistics, computed mean and emitted outliers", native, () => {
  compareNative([
    { data: four }, ...["1.11", "1.12", "newest"].map(compat => ({ data: four, options: { compat } })),
    ...estimatorCases.filter(([name]) => name !== "R1" && name !== "R2").map(([estimator]) => ({ data: five, options: { ...modern, estimator } })),
    { data: [0, 10], options: { ...modern, lowerQuartile: 50, upperQuartile: 50 } },
    { data: fifty, options: { estimator: "legacy", lowerProbability: 0.58 } },
    ...common
  ], "tex");
});

test("installed PGFPlots Lua raw plots: Lua-only estimators, overrides and outlier ordering", native, () => {
  compareNative([
    ...["R1", "Maple2", "SAS2"].map(estimator => ({ data: four, options: { ...modern, estimator } })),
    ...common
  ], "lua");
});
