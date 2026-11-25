import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const optional = { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" };
const ptPerCm = 72.27 / 2.54;
const tolerancePt = .025;
const samples = "coordinates {(1,-9)(2,0)(3,1)(4,2)(5,4)(6,5)(7,6)(8,10)}";
const csv = "obs,unused,signal\n0,100,4\n1,,0\n1,nan,1\n1,inf,0\n3,5,1\n6,7,0\n";
const table = "table[col sep=comma,x=obs,y=unused] {rows.csv}";
const manualTable = String.raw`table[row sep=\\,y index=0]{data\\1\\2\\1\\5\\4\\10\\7\\10\\9\\8\\9\\9\\}`;
const sharp = "handler/.style={/tikz/sharp plot}";
const domain = "domain=-1:3,samples=5";
const cases = [
  { id: "count-clamp-both-tails" },
  { id: "density-width-two", hist: "density", y: "ymin=0,ymax=.5" },
  { id: "small-density-auto-range", bins: 2, hist: "data min=0,data max=20000,density",
    x: "", y: "", data: "coordinates {(0,1)(0,2)(0,15000)}", gauges: [[5000,.00004],[15000,.00006]], ops: "RSRS" },
  { id: "cumulative-count", hist: "cumulative" },
  { id: "cdf-width-two", hist: "cumulative,density", y: "ymin=0,ymax=1" },
  { id: "inherit-xmin-only", x: "xmin=1" },
  { id: "inherit-xmax-only", x: "xmax=3" },
  { id: "hist-bounds-override-axis", hist: "data min=0,data max=6", x: "xmin=-3,xmax=9" },
  { id: "bin-edge-tolerance", data: "coordinates {(0,0)(0,1.999)(0,1.9999)(0,2)(0,3.999)(0,3.9999)(0,4)(0,6)}" },
  // The third left edge is surveyed even though it cannot start a painted bar.
  { id: "intervals-false-bars", hist: "intervals=false", y: "", ops: "RSRS" },
  { id: "sharp-duplicate-endpoint", hist: sharp, ops: "MLLL" },
  { id: "sharp-no-endpoint", hist: sharp + ",intervals=false", ops: "MLL" },
  { id: "manual-sharp-auto-range", x: "", y: "", hist: "handler/.style={sharp plot},intervals=false", data: manualTable, ops: "MLL" },
  { id: "x-with-missing-y", hist: "data=x", data: table },
  { id: "table-column-row-index", hist: String.raw`data={\thisrow{signal}+\coordindex}`, data: table },
  { id: "table-x-with-variable", setup: String.raw`\def\offset{2}`, hist: String.raw`data={x+\offset}`, data: table },
  { id: "sample-function-x", hist: "data=x", plot: domain, data: "{x*x}" },
  { id: "sample-function-y", hist: "data=y", axis: String.raw`declare function={histenergy(\u)=\u*\u;}`, plot: domain, data: "{histenergy(x)}" },
  { id: "sample-function-custom-variable", hist: "data=y", plot: domain + String.raw`,variable=\t`, data: String.raw`{\t*\t}` }
];

const preamble = String.raw`\usepackage{pgfplots}\pgfplotsset{compat=1.18}`;
// Read the finished PGF soft path before it is painted. R is a rectangle's
// corner and S its size, so only R, M and L need the axis origin subtracted.
const probe = String.raw`\makeatletter
\newwrite\histfile \immediate\openout\histfile=hist.points
\newdimen\histox \newdimen\histoy
\def\historigin{\pgfplotspointrelaxisxy{0}{0}\histox=\pgf@x \histoy=\pgf@y}
\def\histpoint#1#2#3{\pgf@x=\dimexpr#2-\histox\relax \pgf@y=\dimexpr#3-\histoy\relax
  \immediate\write\histfile{\caseid|#1|\strip@pt\pgf@x|\strip@pt\pgf@y}}
\def\histsize#1#2{\begingroup\histox=0pt \histoy=0pt \histpoint{S}{#1}{#2}\endgroup}
\def\histpath{\begingroup\pgfgetpath\savedpath\historigin
  \def\pgfsyssoftpath@movetotoken{\histpoint{M}}\def\pgfsyssoftpath@linetotoken{\histpoint{L}}%
  \def\pgfsyssoftpath@rectcornertoken{\histpoint{R}}\let\pgfsyssoftpath@rectsizetoken=\histsize
  \savedpath\endgroup}
\def\histgauge#1#2#3{\begingroup\historigin\pgfplotspointaxisxy{#2}{#3}\histpoint{#1}{\pgf@x}{\pgf@y}\endgroup}`;

function picture(c, native) {
  const axis = ["scale only axis,width=6cm,height=4cm,hide axis,clip=false,enlargelimits=false",
    c.x ?? "xmin=0,xmax=6", c.y ?? "ymin=0,ymax=8", c.axis].filter(Boolean).join(",");
  const hist = ["bins=" + (c.bins ?? 3), c.hist].filter(Boolean).join(",");
  const gauges = (c.gauges || [[1,.25],[3,.75]]).map(([x, y], i) => {
    const name = ["lo", "hi"][i];
    return native ? String.raw`\pgfplotsextra{\histgauge{${name}}{${x}}{${y}}}` :
      String.raw`\coordinate (${name}) at (axis cs:${x},${y});`;
  });
  return String.raw`\begin{tikzpicture}${native ? "\\def\\caseid{" + c.id + "}" : ""}${c.setup || ""}
    \begin{axis}[${axis}]
    \addplot[mark=none,hist={${hist}}${c.plot ? "," + c.plot : ""}] ${c.data || samples}${native ? " \\pgfextra{\\histpath}" : ""};
    ${gauges.join("\n")}
    \end{axis}\end{tikzpicture}`;
}

function nativeRecords() {
  const dir = mkdtempSync(join(tmpdir(), "pgfplots-histogram-"));
  try {
    writeFileSync(join(dir, "rows.csv"), csv);
    writeFileSync(join(dir, "hist.tex"), ["\\documentclass{article}", preamble, probe, "\\begin{document}",
      ...cases.map(c => picture(c, true)), "\\end{document}"].join("\n"));
    const run = spawnSync(process.env.QA_LATEX_ENGINE || "pdflatex",
      ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "hist.tex"],
      { cwd: dir, encoding: "utf8", timeout: 30000 });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout.slice(-2200));
    return readFileSync(join(dir, "hist.points"), "utf8").trim().split(/\r?\n/).map(line => line.split("|"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function sceneRecords(ir) {
  const rows = [];
  for (const p of ir.items) {
    if (p.subtype === "axis-bar") {
      for (let i = 0; i < p.commands.length; i += 5) {
        const rect = p.commands.slice(i, i + 5);
        assert.deepEqual(rect.map(q => q.type), ["moveTo", "lineTo", "lineTo", "lineTo", "closePath"]);
        const points = rect.slice(0, 4);
        const xs = points.map(q => q.x), ys = points.map(q => q.y);
        const x = Math.min(...xs), y = Math.min(...ys), right = Math.max(...xs), top = Math.max(...ys);
        for (const [j, a] of points.entries()) {
          const b = points[(j + 1) % 4];
          assert.ok(a.x === b.x || a.y === b.y, "non-rectangular bar");
        }
        for (const cx of [x, right]) for (const cy of [y, top]) {
          assert.ok(points.some(q => q.x === cx && q.y === cy), "missing bar corner");
        }
        rows.push(["R", x, y], ["S", right - x, top - y]);
      }
    } else if (p.subtype === "axis-plot") {
      for (const q of p.commands) rows.push([{ moveTo: "M", lineTo: "L" }[q.type], q.x, q.y]);
    }
  }
  for (const name of ["lo", "hi"]) rows.push([name, ir.coordinates[name]?.x, ir.coordinates[name]?.y]);
  return rows;
}

test("numeric histograms match installed PGFPlots paths and axis limits", optional, async t => {
  const records = nativeRecords();
  for (const c of cases) await t.test(c.id, () => {
    const native = records.filter(([id]) => id === c.id).map(([, op, x, y]) => [op, Number(x), Number(y)]);
    assert.deepEqual(native.map(([op]) => op), [...(c.ops || "RSRSRS"), "lo", "hi"], "native path and gauges");
    const { ir, diagnostics } = tikzToSvg(preamble + "\n" + picture(c, false), {
      pgfplotsTableResolver: name => name === "rows.csv" ? csv : undefined
    });
    assert.deepEqual(diagnostics, []);
    const scene = sceneRecords(ir);
    assert.deepEqual(scene.map(([op]) => op), native.map(([op]) => op), "public vs native path operations");
    native.forEach(([op, ...coords], i) => coords.forEach((expected, j) => {
      const actual = scene[i][j + 1] * ptPerCm;
      assert.ok(Math.abs(actual - expected) <= tolerancePt,
        `${op}[${i}] ${"xy"[j]}: JS ${actual}, native ${expected} (TeX pt, tolerance ${tolerancePt})`);
    }));
  });
});
