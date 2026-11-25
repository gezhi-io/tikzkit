import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPgfRandom, tikzToSvg } from "../src/index.js";
import { sampleSeededHistogramRows } from "../src/pgfplots/histogramRandom.js";

// Installed pgfplots.libs.statistics.tex, uniform plot-expression example.
const manual = String.raw`tiny,height=4cm,width=12cm,ybar interval,ymin=0,xmin=0,xmax=1,
  axis on top,extra x ticks={0,1},extra x tick style={grid=none,x tick label as interval=false,
  xticklabel={$\pgfmathprintnumber\tick$}},xticklabel={$[\pgfmathprintnumber[fixed]\tick,\cdot)$}`;
const fixed = "hide axis,scale only axis,width=10cm,height=4cm,xmin=0,xmax=1,ymin=0,ymax=40,enlargelimits=false";
const picture = (plots, axis = manual) => String.raw`\begin{tikzpicture}\begin{axis}[${axis}]${plots}\end{axis}\end{tikzpicture}`;
const seed = String.raw`\pgfmathsetseed{100}`;
const rnd = String.raw`\addplot+ [samples=200,hist] {rnd};`;
const rand = String.raw`\addplot+ [samples=200,hist={data min=-1,data max=1}] {rand};`;
const expected = [
  [22, 21, 17, 18, 31, 18, 23, 20, 16, 14],
  [21, 9, 26, 21, 22, 25, 19, 21, 17, 19],
  [17, 21, 17, 21, 27, 15, 15, 26, 22, 19]
];

function renderedCounts(source, unit, options) {
  const result = tikzToSvg(source, options);
  assert.deepEqual(result.diagnostics, []);
  if (unit === undefined) {
    const ticks = result.ir.items.filter(item => item.type === "textNode" && item.x < 0);
    unit = (ticks.find(t => t.text === "10").y - ticks.find(t => t.text === "0").y) / 10;
  }
  return result.ir.items.filter(i => i.subtype === "axis-bar").map(bar => {
    const counts = [];
    let ys = [];
    for (const c of bar.commands) {
      if (c.type === "closePath") {
        const n = (Math.max(...ys) - Math.min(...ys)) / unit;
        assert.ok(Math.abs(n - Math.round(n)) < .001, "bin height should be an integer on the axis scale");
        counts.push(Math.round(n));
        ys = [];
      } else ys.push(c.y);
    }
    return counts;
  });
}

test("seeded manual histogram and consecutive rnd/rand surveys paint the native bin counts", () => {
  assert.deepEqual(renderedCounts(seed + picture(rnd)), expected.slice(0, 1));
  assert.deepEqual(renderedCounts(seed + picture(rnd + rnd + rand)), expected);
  assert.deepEqual(renderedCounts(seed + picture(rnd)), expected.slice(0, 1), "fresh render, fresh seed");
});

test("only source-order draws advance the histogram stream, across axes and explicit reseeds", () => {
  const noDraw = String.raw`\addplot+[samples=5] {x};`;
  const prev = picture(rnd + noDraw, fixed);
  assert.deepEqual(renderedCounts(seed + prev + picture(rnd + seed + rnd, fixed), .1),
    [expected[0], expected[1], expected[0]]);
  const future = tikzToSvg(picture(rnd + seed + rnd, fixed));
  assert.ok(future.diagnostics.some(d => d.code === "math-unknown-variable"));
  assert.equal(future.ir.items.filter(i => i.subtype === "axis-bar").length, 1);
});

test("printed sp decimals and the state handed to later TikZ decorations match the survey", () => {
  const input = { type: "function", expression: "rnd", options: { samples: 5, hist: true } };
  const rng = createPgfRandom(100);
  assert.deepEqual(sampleSeededHistogramRows(input, {}, {}, rng).map(p => p.y), [.62032, .2828, .92397, .42828, .47987]);
  assert.equal(rng.getSeed(), 751755505);
  const line = String.raw`\draw[teal,decorate,decoration={random steps,segment length=5mm,amplitude=2mm}] (0,0)--(4,0);`;
  const draw = before => {
    const r = tikzToSvg(String.raw`\pgfmathsetseed{100}\begin{tikzpicture}${before}${line}\end{tikzpicture}`);
    assert.deepEqual(r.diagnostics, []);
    return r.ir.items.findLast(i => i.style?.stroke === "teal").commands;
  };
  const afterHistogram = draw(String.raw`\begin{axis}[${fixed}]${rnd}\end{axis}`);
  assert.deepEqual(afterHistogram, draw(String.raw`\pgfmathsetseed{1316654990}`));
  assert.notDeepEqual(afterHistogram, draw(""));
});

test("literal file names and discarded local seed assignments do not consume random samples", () => {
  const file = String.raw`\addplot+ file{random.dat};`;
  const unused = String.raw`{\pgfmathsetseed{7}}`;
  assert.deepEqual(renderedCounts(seed + unused + picture(file + rnd, fixed), .1,
    { pgfplotsTableResolver: () => "0 0\n1 1" }), [expected[0]]);
});

test("unsupported random expressions and ordinary plots do not silently borrow a histogram generator", () => {
  const random = createPgfRandom(100);
  for (const plot of [
    { type: "function", expression: "rnd", options: {} },
    { type: "function", expression: "2*rand", options: { hist: true } },
    { type: "function", expression: "rnd", options: { hist: true, samples: 2000 } },
    { type: "function", expression: "rnd", options: { hist: true, "samples at": "0,...,3" } }
  ]) assert.equal(sampleSeededHistogramRows(plot, {}, {}, random), undefined);
  assert.equal(random.getSeed(), 100);
  const ordinary = String.raw`\addplot+[samples=3]{rnd};`;
  const result = tikzToSvg(seed + picture(ordinary + rnd, fixed));
  assert.ok(result.diagnostics.some(d => d.code === "math-unknown-variable"));
  assert.ok(!result.ir.items.some(i => i.subtype === "axis-bar"), "unknown previous draw count requires a fresh seed");
});

test("installed pdfLaTeX: every surveyed value, generator state and bin for consecutive series",
  { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" }, () => {
    const preamble = String.raw`\documentclass{article}
\usepackage{pgfplots}\usepgfplotslibrary{statistics}\pgfplotsset{compat=1.18,lua backend=false}
\makeatletter
\let\hrlimits\pgfplotsplothandlersurveypoint@hist@limits
\def\pgfplotsplothandlersurveypoint@hist@limits{\begingroup
  \pgfmathfloattosci{\pgfplots@current@point@data}\typeout{HR|\hrid|row|\pgfmathresult|\pgfmath@rnd@z}
  \endgroup\hrlimits}
\let\hrbin\pgfplotsplothandlerhistadvancebin
\def\pgfplotsplothandlerhistadvancebin#1{\typeout{HR|\hrid|bin|#1}\hrbin{#1}}
\makeatother\begin{document}`;
    const dir = mkdtempSync(join(tmpdir(), "tikzkit-histogram-random-"));
    try {
      const tagged = [rnd, rnd, rand].map((plot, i) => String.raw`\def\hrid{${i}}${plot}`).join("\n");
      const solo = seed + picture("\\def\\hrid{solo}" + rnd);
      writeFileSync(join(dir, "survey.tex"), preamble + solo + seed + picture(tagged) + "\\end{document}");
      const run = spawnSync(process.env.QA_LATEX_ENGINE || "pdflatex", ["-no-shell-escape", "-halt-on-error",
        "-interaction=nonstopmode", "survey.tex"], { cwd: dir, encoding: "utf8", timeout: 20000 });
      assert.ifError(run.error);
      assert.equal(run.status, 0, run.stdout.slice(-2500));
      const log = run.stdout.split(/\r?\n/);
      const nativeCounts = id => {
        const counts = Array(10).fill(0);
        for (const line of log.filter(l => l.startsWith("HR|" + id + "|bin|"))) counts[Number(line.split("|")[3])]++;
        return counts;
      };
      assert.deepEqual(renderedCounts(seed + picture(rnd)), [nativeCounts("solo")]);
      const random = createPgfRandom(100), control = createPgfRandom(100);
      const painted = renderedCounts(seed + picture(rnd + rnd + rand));
      for (const [i, expression] of ["rnd", "rnd", "rand"].entries()) {
        const rows = sampleSeededHistogramRows({ type: "function", expression, options: { samples: 200, hist: true } },
          {}, {}, random);
        const observed = log.filter(l => l.startsWith("HR|" + i + "|row|")).map(l => l.split("|"));
        assert.equal(observed.length, 200);
        for (const [j, row] of observed.entries()) {
          assert.equal(rows[j].y, Number(row[3]));
          assert.equal(control.nextInteger(), Number(row[4]));
        }
        assert.equal(random.getSeed(), control.getSeed());
        assert.deepEqual(painted[i], nativeCounts(i));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
