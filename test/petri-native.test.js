import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const library = String.raw`\usetikzlibrary{petri}`;
const optional = { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" };
const pt = 72.27 / 2.54;

function scene(source) {
  const result = tikzToSvg(library + "\n" + source);
  assert.deepEqual(result.diagnostics, []);
  return result.ir;
}
function near(actual, expected, label, eps = .003) {
  assert.ok(Math.abs(actual - expected) < eps, `${label}: public ${actual} vs MacTeX ${expected} pt`);
}

test("Petri physical reference: painted widths differ from outer anchors and from text font size", () => {
  const ir = scene(String.raw`\begin{tikzpicture}
    \node[place] (p) {}; \node[transition] (s) {}; \node[token] (t) {};
    \node[token] (digit) {1};
    \begin{scope}[every token/.style={font=\Large}]
      \node[token] (empty) {}; \node[token] (large) {1};
    \end{scope}
    \node[token] (restored) {1};
    \coordinate (east) at (t.east); \coordinate (west) at (t.west);
  \end{tikzpicture}`);
  // Measured in 10pt article: 5ex/1ex refer to the surrounding font, not \tiny.
  const widths = { p:21.52771, s:11.38107, t:4.30554, digit:6.09228, empty:4.30554, large:13.02783, restored:6.09228 };
  const boxes = ir.items.filter(i => i.type === "nodeBox");
  assert.equal(boxes.length, Object.keys(widths).length);
  for (const b of boxes) {
    near(b.width * pt, widths[b.id], b.id + " width");
    near(b.height * pt, widths[b.id], b.id + " height");
  }
  near((ir.coordinates.east.x - ir.coordinates.west.x) * pt, 4.70554, "default east-west (includes outer sep)");
});

const children = String.raw`[children are tokens,token distance=10pt]
 child {node[token] {1}} child {node[token] {2}} child {node[token] {3}}`;
const cases = [
  ...Array.from({ length:13 }, (_, n) => ({ id:"n" + n, keys:"tokens=" + n, count:n })),
  { id:"explicit", children, count:3 },
  { id:"localdist", keys:"token distance=14pt,tokens=2", count:2 },
  { id:"scopedist", scope:"token distance=14pt", keys:"tokens=2", count:2 },
  { id:"styled", scope:String.raw`every token/.style={font=\Large}`, keys:"structured tokens={1,2,3}", count:3 },
  { id:"mirror", scope:"xscale=1.5,yscale=-1.6", at:"(1,2)", keys:"tokens=3", count:3 }
];

function picture(c, inspect = false) {
  const name = "p" + c.id;
  // Zero outer sep lets the cardinal anchors measure the paint path itself.
  // Read the anchors outside the transformed scope, in picture coordinates.
  return String.raw`\begin{tikzpicture}[outer sep=0pt]
    \begin{scope}[${c.scope ?? ""}]
      \node[place${c.keys ? "," + c.keys : ""}] (${name}) at ${c.at ?? "(0,0)"} {} ${c.children ?? ""};
    \end{scope}
    ${inspect ? String.raw`\def\pid{${c.id}}\pref{${name}}{0}\foreach\i in {1,...,13}{\pref{${name}-\i}{\i}}` : ""}
  \end{tikzpicture}`;
}

const probe = String.raw`\makeatletter
\def\pref#1#2{\ifcsname pgf@sh@ns@#1\endcsname\begingroup
  \pgfpointanchor{#1}{center}\edef\px{\number\pgf@x}\edef\py{\number\pgf@y}%
  \pgfpointanchor{#1}{west}\edef\west{\the\pgf@x}\pgfpointanchor{#1}{east}\edef\pw{\number\dimexpr\pgf@x-\west\relax}%
  \pgfpointanchor{#1}{south}\edef\south{\the\pgf@y}\pgfpointanchor{#1}{north}\edef\ph{\number\dimexpr\pgf@y-\south\relax}%
  \typeout{PETRIREF|\pid|#2|\px|\py|\pw|\ph}\endgroup\fi}
\makeatother`;

test("Petri physical reference: compare original PGF child anchors to public centers and circle boundaries", optional, async t => {
  const dir = mkdtempSync(join(tmpdir(), "petri-native-"));
  try {
    writeFileSync(join(dir, "petri.tex"), ["\\documentclass[10pt]{article}", "\\usepackage{tikz}", library, probe,
      "\\begin{document}", ...cases.map(c => picture(c, true)), "\\end{document}"].join("\n"));
    const run = spawnSync(process.env.QA_LATEX_ENGINE || "pdflatex",
      ["-draftmode", "-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "petri.tex"],
      { cwd:dir, encoding:"utf8", timeout:30000 });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout.slice(-1800));
    const rows = readFileSync(join(dir, "petri.log"), "utf8").split(/\r?\n/).filter(l => l.startsWith("PETRIREF|"));
    for (const c of cases) await t.test(c.id, () => {
      const records = rows.filter(l => l.startsWith("PETRIREF|" + c.id + "|")).map(l => l.split("|").slice(2).map(Number));
      assert.deepEqual(records.map(r => r[0]), Array.from({ length:c.count + 1 }, (_, i) => i), "native child indices");
      const ir = scene(picture(c)), boxes = ir.items.filter(i => i.type === "nodeBox");
      assert.equal(boxes.length, records.length, "painted places and tokens");
      assert.ok(!ir.items.some(i => i.type === "path" && i.style.stroke !== "none"), "unexpected child edge");
      boxes.forEach((box, i) => {
        assert.equal(box.shape, "circle");
        for (const [j, key] of ["x","y","width","height"].entries()) {
          near(box[key] * pt, records[i][j+1] / 65536, `${c.id} child ${i} ${key}`, c.id === "mirror" ? .03 : .003);
        }
      });
    });
  } finally {
    rmSync(dir, { recursive:true, force:true });
  }
});

function ink(css) {
  const names = { black:"#000000", white:"#ffffff", red:"#ff0000", blue:"#0000ff", lime:"#00ff00" };
  const rgb = css.match(/^rgb\(([^)]+)\)$/);
  return rgb ? "#" + rgb[1].trim().split(/[ ,]+/).map(v => Math.round(Number(v)).toString(16).padStart(2, "0")).join("")
    : names[css] ?? css;
}

test("Petri physical reference: native SVG separates inherited ink, explicit fill and bare child colors", () => {
  const ir = scene(String.raw`\begin{tikzpicture}
    \begin{scope}[every place/.style={draw=blue,fill=blue!20,thick}]
      \node[place,structured tokens={A}] (p) {};
      \node[place,colored tokens={red,blue}] (q) at (2,0) {};
    \end{scope}
    \begin{scope}[every token/.style={fill=yellow,draw=green,text=blue}]
      \node[place] (r) at (4,0) {} [children are tokens]
        child {node[token,red] {K}} child {node[token,fill=red] {L}} child {node {Z}};
    \end{scope}
    \node[token] at (6,0) {R};
  \end{tikzpicture}`);
  // Sampled from actual painted paths and glyphs in the pdflatex/Poppler SVG.
  const boxes = ir.items.filter(i => i.type === "nodeBox");
  const black = "#000000", red = "#ff0000", blue = "#0000ff", white = "#ffffff";
  assert.deepEqual(boxes.map(b => [ink(b.style.fill), ink(b.style.stroke)]), [
    ["#ccccff",blue], [black,"none"], ["#ccccff",blue], [red,"none"], [blue,"none"],
    ["none",black], [red,red], [red,"#00ff00"], [black,"none"]
  ]);
  assert.deepEqual(ir.items.filter(i => i.type === "textNode" && i.text).map(i => [i.text,ink(i.style.fill)]),
    [["A",white], ["K",red], ["L",blue], ["Z",black], ["R",white]]);
});
