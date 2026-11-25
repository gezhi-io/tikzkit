import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createHistogramBins } from "../src/pgfplots/histogramBins.js";

const common = {
  samples: [8, -13, 1.9996, 6, 1.99984, 2, 0, 19],
  config: { bins: 4, "data min": 0, "data max": 8 },
  edges: [0, 2, 4, 6, 8], rawCounts: [3, 2, 0, 3]
};
const constant = {
  samples: [-3, -3, -3, -3], config: { bins: 3 },
  edges: [-3, -3, -3, -3], rawCounts: [4, 0, 0]
};
const modes = (base, variants) => variants.map(([id, options, counts]) => ({
  ...base, id, config: { ...base.config, ...options }, counts
}));

const controls = [
  ...modes(common, [
    ["counts", {}, [3, 2, 0, 3]],
    ["cumulative", { cumulative: true }, [3, 5, 5, 8]],
    ["density", { density: true }, [3 / 16, 2 / 16, 0, 3 / 16]],
    ["cdf", { cumulative: "true", density: "true" }, [3 / 8, 5 / 8, 5 / 8, 1]],
    ["false", { cumulative: "false", density: "false" }, [3, 2, 0, 3]]
  ]),
  { id: "small-width", samples: [-1.1, -.75005, -.75001, -.75, -.50004, -.50001, -.25, 0, .1],
    config: { "data min": -1, "data max": 0, bins: 4 }, edges: [-1, -.75, -.5, -.25, 0],
    rawCounts: [2, 3, 1, 3] },
  { id: "manual", samples: [1, 2, 1, 5, 4, 10, 7, 10, 9, 8, 9, 9], config: { bins: 3 },
    edges: [1, 4, 7, 10], rawCounts: [3, 2, 7] },
  { id: "reciprocal", samples: [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70], config: { bins: 10 },
    edges: [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70], rawCounts: [1, 1, 2, 1, 1, 1, 1, 1, 1, 1] },
  { id: "nonbinary-cdf", samples: [0, 2, 3, 4, 8, -13, 22],
    config: { ...common.config, cumulative: true, density: true }, edges: common.edges, rawCounts: [2, 2, 1, 2],
    counts: [.28570007, .57140015, .71425018, .99995026] },
  { id: "thirds", samples: [0, 1], config: { bins: 3 }, binWidth: .33333,
    edges: [0, .33332993, .66665985, 1], rawCounts: [1, 0, 1] },
  { id: "descending", samples: [-1, 0, 3, 5, 8, 10, 13],
    config: { "data min": 10, "data max": 0, bins: 2 }, edges: [10, 5, 0], rawCounts: [3, 4] },
  ...modes(constant, [
    ["constant", {}, [4, 0, 0]],
    ["constant-cumulative", { cumulative: true }, [4, 4, 4]],
    ["constant-density", { density: true }, [Infinity, 0, 0]],
    ["constant-cdf", { cumulative: true, density: true }, [1, 1, 1]]
  ])
];

// Observe the histogram increment callback and the coordinates the survey hands
// to its output handler, including the terminal interval point. No re-binning in TeX.
const preamble = String.raw`\documentclass{article}
\usepackage{pgfplots}\pgfplotsset{compat=1.18,lua backend=false}
\makeatletter
\let\histadvance\pgfplotsplothandlerhistadvancebin
\def\pgfplotsplothandlerhistadvancebin#1{\typeout{HG|\hid|bin|#1}\histadvance{#1}}
\let\histreport\pgfplotsplothandlerhist@invtrafo
\def\pgfplotsplothandlerhist@invtrafo{%
  \begingroup\pgfmathfloattosci{\pgfmathresult}\let\hx\pgfmathresult
  \pgfmathfloattosci{\pgfplotsplothandlerhistogram@h}%
  \typeout{HG|\hid|point|\hx|\pgfplots@hist@count|\pgfmathresult}\endgroup\histreport}
\makeatother\begin{document}`;

function nativePlot({ id, config, samples }) {
  // Empty keys request data-derived bounds even though the test axis has fixed limits.
  const keys = Object.entries({ "data min": "", "data max": "", ...config })
    .map(([key, value]) => `${key}={${value}}`).join(",");
  return String.raw`\def\hid{${id}}\begin{tikzpicture}
    \begin{axis}[hide axis,xmin=-20,xmax=25,ymin=-2,ymax=10]
    \addplot[hist={${keys}}] coordinates {${samples.map(v => `(0,${v})`).join(" ")}};
    \end{axis}\end{tikzpicture}`;
}

function nativeLog(cases, expectError = false) {
  const dir = mkdtempSync(join(tmpdir(), "pgfplots-histogram-bins-"));
  try {
    writeFileSync(join(dir, "probe.tex"), [preamble, ...cases.map(nativePlot), "\\end{document}"].join("\n"));
    const run = spawnSync(process.env.QA_LATEX_ENGINE || "pdflatex", ["-no-shell-escape", "-interaction=nonstopmode",
      ...(expectError ? [] : ["-halt-on-error"]), "probe.tex"], { cwd: dir, encoding: "utf8", timeout: 20000 });
    assert.ifError(run.error);
    assert.equal(run.status, expectError ? 1 : 0, run.stdout.slice(-2500));
    return run.stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function close(actual, expected, label, tolerance = 1e-12) {
  if (!Number.isFinite(expected)) return assert.equal(actual, expected, label);
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${label}: got ${actual}, expected ${expected}`);
}

test("histogram survey agrees with fixed numeric controls without TeX", () => {
  for (const { id, samples, config, binWidth, edges, rawCounts, counts = rawCounts } of controls) {
    const result = createHistogramBins(Object.freeze([...samples]), config);
    assert.ok(result, id);
    assert.equal(result.bins, rawCounts.length, id);
    assert.equal(result.dataMin, edges[0], id);
    assert.equal(result.dataMax, edges.at(-1), id);
    close(result.binWidth, binWidth ?? (result.dataMax - result.dataMin) / result.bins, id);
    assert.deepEqual(result.rawCounts, rawCounts, id);
    assert.equal(result.counts.length, result.bins, id);
    result.counts.forEach((value, i) => close(value, counts[i], id));
    assert.deepEqual(result.edges, edges, id);
  }
});

test("filters unavailable observations and infers each missing bound independently", () => {
  assert.equal(createHistogramBins(), null);
  assert.equal(createHistogramBins([undefined, null, "", NaN, Infinity, -Infinity]), null);
  const values = [null, "1+1", NaN, 4, -Infinity, "", 6, undefined];
  const low = createHistogramBins(values, { bins: "2", "data min": "0" });
  assert.deepEqual(low.edges, [0, 3, 6]);
  assert.deepEqual(low.rawCounts, [1, 2]);
  const high = createHistogramBins(values, { bins: 2, "data max": 10, intervals: false });
  assert.deepEqual(high.edges, [2, 6, 10], "intervals=false belongs to the output handler, not the bin survey");
  assert.deepEqual(high.counts, [2, 1]);
  assert.equal(createHistogramBins([1, 2, 3], { bins: 3, "data min": 2, "data max": 2 }), null);
});

test("positive bin width extends the final edge and obeys the same allocation limit as bin counts", () => {
  const result = createHistogramBins([0, .2, 1.19, 1.21, 2.1, 2.9], { bins: 99, "data min": 0, "data max": 2.1, "bin width": .6 });
  assert.equal(result.bins, 4);
  assert.equal(result.binWidth, .6);
  result.edges.forEach((v, i) => close(v, [0, .6, 1.2, 1.8, 2.4][i], "width extension"));
  assert.deepEqual(result.rawCounts, [2, 1, 1, 2]);
  assert.deepEqual(createHistogramBins([3, 3], { "bin width": 2 }).edges, [2, 4], "explicit width requests one centered bin");
  assert.equal(createHistogramBins([0, 1], { "bin width": 1e-100 }), null, "cannot honor this width within the bin limit");
  assert.equal(createHistogramBins([0, 1], { "bin width": -1, bins: 2 }).bins, 2);
  assert.equal(createHistogramBins([0, 1], { bins: 0 }).bins, 10);
  assert.equal(createHistogramBins([0, 1], { bins: 2.6 }).bins, 3);
  assert.equal(createHistogramBins([0, 1], { bins: 100000 }).bins, 10000);
});

test("small and large finite edges stay finite without a fixed decimal rounding scale", () => {
  const tiny = createHistogramBins([1e-15, 3e-15], { bins: 2 });
  assert.deepEqual(tiny.edges, [1e-15, 2e-15, 3e-15]);
  const large = createHistogramBins([1e307, 1.2e307], { bins: 2 });
  assert.ok(large.edges.every(Number.isFinite));
  assert.ok(large.edges[0] < large.edges[1] && large.edges[1] < large.edges[2]);
  assert.equal(createHistogramBins([0, Number.MIN_VALUE], { bins: 2 }), null, "nonzero span with unrepresentable width");
  const many = new Float64Array(180000);
  many[many.length - 1] = 1;
  assert.deepEqual(createHistogramBins(many, { bins: 2 }).counts, [many.length - 1, 1]);
});

const native = { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" };
test("installed PGFPlots: bin assignments, widths, and painted histogram heights", native, () => {
  const log = nativeLog(controls).split(/\r?\n/);
  for (const { id, config, samples, edges, rawCounts, counts = rawCounts } of controls) {
    const records = kind => log.filter(line => line.startsWith(`HG|${id}|${kind}|`))
      .map(line => line.split("|").slice(3).map(v => v === "inf" ? Infinity : Number(v)));
    const increments = records("bin");
    assert.equal(increments.length, samples.length, id);
    const tallies = Array(config.bins).fill(0);
    for (const [index] of increments) tallies[index]++;
    assert.deepEqual(tallies, rawCounts, id);
    const points = records("point");
    assert.equal(points.length, edges.length, id);
    const js = createHistogramBins(samples, config);
    assert.deepEqual(js.rawCounts, tallies, id);
    points.forEach(([x, y, h], i) => {
      close(x, edges[i], `${id} edge ${i}`, 1e-4);
      close(y, counts[Math.min(i, counts.length - 1)], `${id} height ${i}`, 1e-4);
      close(h, (edges.at(-1) - edges[0]) / config.bins, `${id} width`, 1e-4);
      close(js.edges[i], x, `${id} JS edge ${i}`);
      close(js.counts[Math.min(i, js.bins - 1)], y, `${id} JS height ${i}`);
      close(js.binWidth, h, `${id} JS width`);
    });
  }
});

test("installed PGFPlots: a zero-width range cannot index a different sample value", native, () => {
  const log = nativeLog([{ id: "bad", samples: [1, 3], config: { "data min": 2, "data max": 2, bins: 3 } }], true);
  assert.match(log, /Missing number, treated as zero/);
});
