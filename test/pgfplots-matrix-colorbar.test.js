import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { renderMatrixColorbar } from "../src/pgfplots/matrixColorbar.js";

const ptPerCm = 72.27 / 2.54;
const tolerance = .025; // TeX pt
const compat = String.raw`\usepackage{pgfplots}\pgfplotsset{compat=1.18}`;
const sized = "scale only axis,width=6cm,height=4cm";
const tickless = String.raw`xtick=\empty,ytick=\empty`;
const cases = [
  { id: "manual", axis: "width=7cm" },
  { id: "starred", kind: "matrix plot*", axis: sized + "," + tickless },
  { id: "tall", axis: "scale only axis,width=4cm,height=10cm," + tickless, min: -3 },
  { id: "outside-labels", axis: sized + ",yticklabel pos=right,ytick={0,1,2},yticklabels={1000,2000,3000}" },
  { id: "earlier-ink", axis: sized, before: "\\draw (20,0) -- (21,1);" },
  { id: "left", side: "left", axis: sized },
  { id: "horizontal", side: "horizontal", axis: sized, min: -2 },
  { id: "style", axis: sized, style: "height=2cm,ytick={0,3,8}" },
  { id: "small-scaled-meta", axis: sized + ",point meta min=0,point meta max=.00008", scaled: true },
  { id: "reversed-bar", axis: sized, style: "y dir=reverse,ytick={0,3,8}" },
  { id: "two-series-one-bar", axis: sized, second: true }
];

function picture(c, native = false) {
  const trace = String.raw`name=bar,major tick style={/tikz/record ticks},
    xticklabel={\recordlabel},yticklabel={\recordlabel}`;
  return String.raw`${native ? "\\def\\caseid{" + c.id + "}" : ""}\begin{tikzpicture}
    ${c.before || ""}
    \begin{axis}[name=parent,enlargelimits=false,${c.axis},colorbar${c.side ? " " + c.side : ""},
      colorbar style={${[native && trace, c.style].filter(Boolean).join(",")}}]
      \addplot[${c.kind || "matrix plot"},mesh/cols=3,point meta=explicit] coordinates {
        (0,0)[${c.min ?? 0}] (1,0)[1] (2,0)[2] (0,1)[3] (1,1)[nan] (2,1)[5] (0,2)[6] (1,2)[7] (2,2)[8]};
      ${c.second ? String.raw`\addplot[matrix plot*,mesh/cols=2,point meta=explicit] coordinates {
        (0,0)[10] (1,0)[12] (0,1)[14] (1,1)[16]};` : ""}
    \end{axis}
    ${native ? String.raw`\frameanchor{south west}\frameanchor{north east}` : ""}
  \end{tikzpicture}`;
}

function publicScene(c) {
  const result = tikzToSvg(compat + "\n" + picture(c));
  assert.deepEqual(result.diagnostics, []);
  const bars = result.ir.items.filter(p => p.style?.shading === "axis");
  assert.equal(bars.length, 1, "one colorbar gradient");
  const items = result.ir.items.slice(result.ir.items.indexOf(bars[0]));
  return { ...result, bar: bars[0], items };
}

test("matrix colorbar uses finite surveyed meta, never the parent's z limits or y direction", () => {
  const geometry = { origin: { x: 2, y: 1 }, width: 5, height: 4 };
  const ranges = { xMin: -11, xMax: 0, yMin: 4, yMax: 9, zMin: 90, zMax: 100 };
  const value = { colorbar: true, "pgfplots matrix meta range": { min: 0, max: 8 } };
  assert.deepEqual(renderMatrixColorbar({ colorbar: true }, ranges, geometry), []);
  assert.deepEqual(renderMatrixColorbar({ ...value, colorbar: false }, ranges, geometry), []);
  assert.deepEqual(renderMatrixColorbar({ ...value, "pgfplots matrix meta range": { min: NaN, max: 8 } }, ranges, geometry), []);
  const normal = renderMatrixColorbar(value, ranges, geometry);
  assert.deepEqual(renderMatrixColorbar({ ...value, "y dir": "reverse" }, { zMin: -80, zMax: -40 }, geometry), normal);
  assert.ok(normal.some(s => s.includes("axis colorbar frame")));
  for (const c of [cases[0], cases[1]]) {
    const { svg } = publicScene(c);
    assert.match(svg, /<linearGradient[^>]+y1="100%"[^>]+y2="0%"/);
    assert.match(svg, /<stop offset="0%" stop-color="(?:rgb\(0[, ]+0[, ]+255\)|#0000ff|blue)"/i);
    assert.match(svg, /<stop offset="100%" stop-color="(?:rgb\(255[, ]+0[, ]+0\)|#ff0000|red)"/i);
  }
  assert.match(publicScene(cases.find(c => c.id === "reversed-bar")).svg, /<linearGradient[^>]+y1="0%"[^>]+y2="100%"/);
});

test("a local parent box excludes earlier picture contents from 2D colorbar placement", () => {
  const options = { colorbar: true, "pgfplots matrix meta range": { min: 0, max: 8 } };
  const commands = renderMatrixColorbar(options, {}, { origin: { x: 0, y: 0 }, width: 6, height: 4 }, "matrix parent");
  const result = tikzToSvg(String.raw`\begin{tikzpicture}\draw (20,0) -- (21,0);
    {[local bounding box=matrix parent]\path (0,0) rectangle (7,4);} ${commands.join("\n")}\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  const gradient = result.ir.items.find(p => p.style?.shading === "axis");
  assert.equal(gradient.commands[0].x, 7.3);
});

const instrumentation = String.raw`\makeatletter
\newwrite\oraclefile \immediate\openout\oraclefile=bar.points
\def\record#1{\immediate\write\oraclefile{\caseid|#1}}
\def\frameanchor#1{\pgfpointdiff{\pgfpointanchor{parent}{south west}}{\pgfpointanchor{bar}{#1}}%
  \record{#1|\strip@pt\pgf@x|\strip@pt\pgf@y}}
\def\recordlabel{\record{value|\tick}\pgfmathprintnumber\tick}
\newdimen\ox \newdimen\oy
\def\pathop#1#2#3{\pgf@x=\dimexpr#2-\ox\relax \pgf@y=\dimexpr#3-\oy\relax
  \record{#1|\strip@pt\pgf@x|\strip@pt\pgf@y}}
\def\recordticks{\begingroup\pgfgetpath\savedpath\pgfplotspointdescriptionxy{0}{0}\ox=\pgf@x \oy=\pgf@y
  \def\pgfsyssoftpath@movetotoken{\pathop M}\def\pgfsyssoftpath@linetotoken{\pathop L}\savedpath\endgroup}
\tikzset{record ticks/.code={\tikz@addmode{\recordticks}}}`;

function nativeRecords() {
  const dir = mkdtempSync(join(tmpdir(), "pgfplots-matrix-colorbar-"));
  try {
    writeFileSync(join(dir, "bar.tex"), ["\\documentclass{article}", compat, instrumentation, "\\begin{document}",
      ...cases.map(c => picture(c, true)), "\\end{document}"].join("\n"));
    const run = spawnSync(process.env.QA_LATEX_ENGINE || "pdflatex",
      ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "bar.tex"],
      { cwd: dir, encoding: "utf8", timeout: 30000 });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout.slice(-2000));
    return readFileSync(join(dir, "bar.points"), "utf8").trim().split(/\r?\n/).map(line => line.split("|"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("2D matrix colorbar bounds and painted ticks match installed PGFPlots",
  { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" }, async t => {
    const records = nativeRecords();
    for (const c of cases) await t.test(c.id, () => {
      const get = key => records.filter(([id, op]) => id === c.id && op === key).map(row => row.slice(2).map(Number));
      const { ir, bar, items } = publicScene(c);
      const parent = ir.coordinates["parent.south west"];
      const [sw, ne] = [bar.commands[0], bar.commands[2]];
      const pt = (q, origin) => [(q.x - origin.x) * ptPerCm, (q.y - origin.y) * ptPerCm];
      const close = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tolerance);
      for (const [key, corner] of [["south west", sw], ["north east", ne]]) {
        const [ref] = get(key), actual = pt(corner, parent);
        assert.ok(close(actual, ref), `${key} (pt): JS ${actual}, native ${ref}`);
      }
      const texts = items.filter(p => p.type === "textNode").map(p => p.text.replaceAll("\u2212", "-"));
      const labels = (c.scaled ? texts.filter(s => Number.isFinite(Number(s))) : texts).map(Number);
      if (c.scaled) assert.ok(texts.some(s => /10\^\{-5\}/.test(s)), "scale factor on small meta values");
      assert.deepEqual(labels, get("value").flat(), "native tick density and values");
      const ends = get("L");
      const segments = get("M").map((v, i) => [...v, ...ends[i]]);
      const paths = items.filter(p => p.commands?.length === 2);
      assert.equal(paths.length, segments.length, "ticks on both frame edges");
      for (const p of paths) {
        const segment = p.commands.flatMap(q => pt(q, sw));
        const i = segments.findIndex(s => close(segment, s));
        assert.notEqual(i, -1, `painted tick (pt): JS ${segment}, native candidates ${JSON.stringify(segments)}`);
        segments.splice(i, 1);
      }
    });
  });
