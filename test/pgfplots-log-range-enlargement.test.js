import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { axisTransformRanges, createAxisGeometry } from "../src/pgfplots/geometry.js";
import { computeAxisRanges } from "../src/pgfplots/rangeResolver.js";

const loglog = { xmode: "log", ymode: "log", width: "7cm" };
const cmPerSp = 2.54 / (72.27 * 65536);
const series = (xMin, xMax, yMin, yMax) => [{ type: "coordinates", options: {},
  points: [{ x: xMin, y: yMin }, { x: xMax, y: yMax }] }];
const control = series(16, 1024, 32, 2048);
const manual = series(16, 192000, 32, 204800);

function near(value, expected, tolerance, label) {
  assert.ok(Math.abs(value - expected) <= tolerance, `${label}: ${value} vs ${expected} (tol ${tolerance})`);
}

function logPair(ranges, axis, expected, tolerance = .0002) {
  near(Math.log(ranges[axis + "Min"]), expected[0], tolerance, axis + " min (ln)");
  near(Math.log(ranges[axis + "Max"]), expected[1], tolerance, axis + " max (ln)");
}

test("manual p. 321: surveyed error extents receive one margin in log space", () => {
  // pgfplots.reference.errorbars.tex:198-215 with its printed 7cm preamble.
  // Supply its surveyed data bounds directly to isolate enlargement from the
  // error domain. MacTeX recorded the limits after @enlarge@limit@ifconfigured
  // and the canvas displacements from (rel axis cs:0,0) in TeX scaled points.
  const bounds = computeAxisRanges(loglog, manual);
  logPair(bounds, "x", [1.83318, 13.10452]);
  logPair(bounds, "y", [2.58920, 13.10616]);
  const g = createAxisGeometry(loglog, bounds);
  near(g.width, 10103500 * cmPerSp, .0002, "frame width (cm)");
  near(g.height, 8309055 * cmPerSp, .0002, "frame height (cm)");
  for (const [i, [x, y]] of [[842019, 692450], [9261400, 7616653]].entries()) {
    const p = g.mapPoint(manual[0].points[i]);
    near(p.x - g.origin.x, x * cmPerSp, .0002, "canvas x (cm)");
    near(p.y - g.origin.y, y * cmPerSp, .0002, "canvas y (cm)");
  }
});

test("with the native survey supplied, the enlargement step agrees within one TeX scaled point", () => {
  const data = series(...[2.77249, 12.1652, 3.46565, 12.2297].map(Math.exp));
  const bounds = computeAxisRanges(loglog, data);
  logPair(bounds, "x", [1.83318, 13.10452], 1 / 65536);
  logPair(bounds, "y", [2.58920, 13.10616], 1 / 65536);
});

test("auto enlarges inferred sides only; tight, non-boxed and 3D limits stay put", () => {
  const pinned = computeAxisRanges({ ...loglog, xmin: 16, ymax: 2048 }, control);
  assert.equal(pinned.xMin, 16);
  assert.equal(pinned.yMax, 2048);
  logPair(pinned, "x", [2.77252, 7.34737]);
  logPair(pinned, "y", [3.04974, 7.62460]);
  for (const options of [{ enlargelimits: false }, { "axis lines": "left" },
    { xmin: 16, xmax: 1024, ymin: 32, ymax: 2048 }, { "pgfplots 3d surface": true }]) {
    const bounds = computeAxisRanges({ ...loglog, ...options }, control);
    assert.deepEqual([bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax], [16, 1024, 32, 2048]);
  }
  const narrow = computeAxisRanges(loglog, series(1, 1.004, 2, 2.01));
  assert.deepEqual([narrow.xMin, narrow.xMax, narrow.yMin, narrow.yMax], [1, 1.004, 2, 2.01]);
  const semi = computeAxisRanges({ ymode: "log", xmin: -2, xmax: 6, ymin: 1, ymax: 128 }, control);
  assert.deepEqual([semi.xMin, semi.xMax, semi.yMin, semi.yMax], [-2, 6, 1, 128]);
});

// rel activates both sides; value only changes the fraction. A later
// upper/lower/auto can change sides again, independently of pinned bounds.
const explicitCases = [
  [{ enlargelimits: true }, [2.35661, 7.34737]],
  [{ "enlarge x limits": "upper,value=.25" }, [2.77252, 7.97119]],
  [{ "enlarge x limits": "rel=.25,upper" }, [2.77252, 7.97119]],
  [{ "enlarge x limits": "upper,rel=.25" }, [1.73279, 7.97119]],
  [{ "enlarge x limits": ".25", enlargelimits: false }, [2.77252, 6.93146]],
  [{ enlargelimits: false, "enlarge x limits": ".25" }, [1.73279, 7.97119]],
  [{ "axis lines": "left", "enlarge x limits": ".25" }, [1.73279, 7.97119]],
  [{ "enlarge x limits": ".25", "axis lines": "left" }, [2.77252, 6.93146]],
  [{ "enlarge x limits": "value=.25" }, [2.77252, 6.93146]],
  [{ "enlarge x limits": "auto" }, [2.77252, 6.93146]],
  [{ "enlarge x limits": "abs=2" }, [2.07947, 7.62451]],
  [{ "enlarge x limits": "abs=.5" }, [2.77252, 6.93146]]
];

test("explicit enlargement follows PGF key order independently of pinned limits", () => {
  for (const [options, logs] of explicitCases) {
    const axis = Object.freeze({ ...loglog, xmin: 16, xmax: 1024, ...options });
    logPair(computeAxisRanges(axis, control), "x", logs);
  }
});

test("explicit log enlargement reaches the frame and canvas exactly once", () => {
  for (const [options, logs] of explicitCases) {
    const axis = Object.freeze({ ...loglog, xmin: 16, xmax: 1024, ...options });
    const g = createAxisGeometry(axis, computeAxisRanges(axis, control));
    logPair(g.transformRanges, "x", logs);
    logPair(g.lineRanges, "x", logs);
  }
});

test("raw geometry inputs, the linear half of a semilog plot and 3D retain their own enlargement", () => {
  const axis = { xmode: "log", enlargelimits: .1 };
  const bare = { xMin: 100, xMax: 110, yMin: 20, yMax: 40, zMin: 0, zMax: 1 };
  const expected = { ...bare, xMin: 99, xMax: 111, yMin: 18, yMax: 42 };
  assert.deepEqual(axisTransformRanges(axis, bare), expected);
  const data = series(100, 110, 20, 40);
  const surveyed = computeAxisRanges(axis, data);
  const transformed = axisTransformRanges(axis, surveyed);
  assert.equal(transformed.xMin, surveyed.xMin);
  assert.equal(transformed.xMax, surveyed.xMax);
  assert.deepEqual([transformed.yMin, transformed.yMax], [18, 42]);
  const three = { ...axis, "pgfplots 3d surface": true };
  assert.deepEqual(axisTransformRanges(three, computeAxisRanges(three, data)), { ...expected, zMin: -.1, zMax: 1.1 });
  assert.deepEqual(axisTransformRanges(three, surveyed), axisTransformRanges(three, { ...surveyed }));
  const physical = { xmode: "log", "enlarge x limits": "abs=5mm" };
  assert.deepEqual(axisTransformRanges(physical, computeAxisRanges({ ...physical, "enlarge y limits": false }, data)),
    axisTransformRanges(physical, bare));
});

test("a declared log basis uses its own transformed fixed-point units", () => {
  const axis = { ...loglog, "log basis x": 2 };
  // Native survey -> enlargement with the base-two coordinate math class.
  const data = series(2 ** 4.00047, 2 ** 10.00140, 32, 2048);
  const bounds = computeAxisRanges(axis, data);
  near(Math.log2(bounds.xMin), 3.40034, 1 / 65536, "base-two min");
  near(Math.log2(bounds.xMax), 10.60153, 1 / 65536, "base-two max");
});

test("replay the original manual example against the installed PGFPlots enlargement routine",
  { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" }, () => {
    const archive = execFileSync("kpsewhich", ["--format=doc", "pgfplots.doc.src.tar.bz2"], { encoding: "utf8" }).trim();
    const doc = execFileSync("tar", ["-xOjf", archive, "pgfplots.reference.errorbars.tex"], { encoding: "utf8" });
    const example = doc.match(/\\begin\{tikzpicture\}\s*\\begin\{loglogaxis\}[\s\S]*?\\end\{tikzpicture\}/)?.[0];
    assert.ok(example?.includes("32068"), "missing the manual's explicit-relative example");
    const source = String.raw`\documentclass{article}\usepackage{pgfplots}\pgfplotsset{width=7cm,compat=1.18}
\makeatletter
\let\nativeenlarge\pgfplots@enlarge@limit@ifconfigured
\def\pgfplots@enlarge@limit@ifconfigured#1{%
  \edef\beforesize{\csname pgfplots@#1min\endcsname|\csname pgfplots@#1max\endcsname}%
  \nativeenlarge{#1}%
  \typeout{RANGE|#1|\beforesize|\csname pgfplots@#1min\endcsname|\csname pgfplots@#1max\endcsname}}
\begin{document}
${example}
\end{document}`;
    const tmp = mkdtempSync(join(tmpdir(), "pgfplots-log-enlarge-"));
    try {
      writeFileSync(join(tmp, "probe.tex"), source);
      const run = spawnSync(process.env.QA_LATEX_ENGINE || "pdflatex",
        ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "probe.tex"],
        { cwd: tmp, encoding: "utf8", timeout: 20000 });
      assert.ifError(run.error);
      assert.equal(run.status, 0, run.stdout.slice(-1600));
      const limits = Object.fromEntries(run.stdout.split(/\r?\n/).filter(l => l.startsWith("RANGE|")).map(l => {
        const [, axis, ...values] = l.split("|");
        return [axis, values.map(Number)];
      }));
      const data = series(...[...limits.x.slice(0, 2), ...limits.y.slice(0, 2)].map(Math.exp));
      const bounds = computeAxisRanges(loglog, data);
      for (const axis of ["x", "y"]) logPair(bounds, axis, limits[axis].slice(2), 1 / 65536);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
