import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseAddplots } from "../src/pgfplots/addplotParser.js";

const frac = "bar interval width=.8,/pgf/bar interval width=.5,/pgf/bar interval shift=.6,bar interval shift=.25";
const reversed = dim => `${dim}mode=log,log basis ${dim}=2,${dim} dir=reverse,${dim}min=1,${dim}max=16`;
const paintFrame = "width=4cm,height=3cm,xmin=0,xmax=4,ymin=0,ymax=3";
const repeated = "/tikz/ybar,mark=*,mark=none,draw=none,fill=red,samples at={0,1},/pgf/bar width=.6cm," +
  "/tikz/bar width=1cm,bar shift=-.4cm,/tikz/bar shift=.25cm";
const cases = [
  { id: "function", axis: "width=6cm,height=3cm,xmin=0,xmax=3,ymin=0",
    plot: "/tikz/ybar interval,bar interval width=.7,domain=0:3,samples=4", data: "{x+1}",
    // The fourth height sets ymax=4 and gets marked; it is not a fourth bar.
    bars: [[.3,0,1.4,.75],[2.3,0,1.4,1.5],[4.3,0,1.4,2.25]], marks: [[0,.75],[2,1.5],[4,2.25],[6,3]] },
  { id: "log-ybar", axis: `width=8cm,height=5cm,${reversed("x")},ymin=0,ymax=5`,
    plot: `/tikz/ybar interval,${frac},samples at={0,1,3,4}`, data: "({2^x},{x+1})",
    bars: [[8,0,-1,1],[6,0,-2,2],[2,0,-1,4]], marks: [[8,1],[6,2],[2,4],[0,5]] },
  { id: "log-xbar", axis: `width=5cm,height=8cm,${reversed("y")},xmin=0,xmax=5`,
    plot: `/tikz/xbar interval,${frac},samples at={0,1,3,4}`, data: "({x+1},{2^x})",
    bars: [[0,8,1,-1],[0,6,2,-2],[0,2,4,-1]], marks: [[1,8],[2,6],[4,2],[5,0]] },
  ...["jump", "discard"].map(policy => ({ id: policy, axis: "width=4cm,height=4cm,xmin=-2,xmax=2,ymin=0,ymax=4",
    plot: `/tikz/ybar interval,domain=-2:2,samples=5,unbounded coords=${policy}`, data: "{2+1/x}",
    bars: [[0,0,1,1.5], ...(policy === "discard" ? [[1,0,2,1]] : []), [3,0,1,3]],
    marks: [[0,1.5],[1,1],[3,3],[4,2.5]] })),
  { id: "fixed-xbar", axis: "width=4cm,height=3cm,xmin=0,xmax=4,ymin=0,ymax=3",
    plot: "/tikz/xbar,/pgf/bar width=.6cm,bar width=.4cm,bar shift=-.3cm,/pgf/bar shift=.1cm,samples at={1,2}",
    data: "({2*x},{x})", bars: [[0,.9,2,.4],[0,1.9,4,.4]], marks: [[2,1],[4,2]] },
  { id: "axis-style", axis: "width=2cm,height=3cm,xmin=0,xmax=2,ymin=0,ymax=3,ybar interval",
    plot: "/pgf/bar interval width=.8,bar interval width=.5,bar interval shift=.8,/pgf/bar interval shift=.25,domain=0:2,samples=3",
    data: "{x+1}", bars: [[0,0,.5,1],[1,0,.5,2]], marks: [[0,1],[1,2],[2,3]] },
  { id: "clipped", axis: "width=2cm,height=3cm,xmin=0,xmax=2,ymin=0,ymax=3",
    plot: "/tikz/ybar interval,domain=-1:3,samples=3", data: "{2}",
    bars: [[-1,0,2,2],[1,0,2,2]], marks: [[1,2]] },
  { id: "alpha", axis: paintFrame, plot: repeated + ",fill opacity=.5", data: "({2},{2})",
    bars: [[1.75,0,1,2],[1.75,0,1,2]], marks: [], paint: "f", fillOpacity: .5 },
  { id: "odd", axis: paintFrame, plot: repeated + ",even odd rule", data: "({2},{2})",
    bars: [[1.75,0,1,2],[1.75,0,1,2]], marks: [], paint: "f*" },
  { id: "winding", axis: paintFrame, plot: "/tikz/ybar interval,mark=o,/tikz/mark={},draw=none,fill=red,domain=0:2,samples=3," +
    "/pgf/bar interval width=.4,/tikz/bar interval width=1,bar interval shift=.1,/tikz/bar interval shift=.5",
    data: "({1+2*(1-abs(x-1))},{2-x})", bars: [[1,0,2,2],[3,0,-2,1]], marks: [], paint: "f" },
  { id: "touching", axis: paintFrame, plot: "/tikz/ybar interval,mark=none,draw=blue,draw opacity=.5,fill=cyan,domain=0:2,samples=3",
    data: "{x+1}", bars: [[0,0,1,1],[1,0,1,2]], marks: [], paint: "B" },
  { id: "wide-pen", axis: paintFrame,
    plot: "/tikz/ybar,mark=none,fill=none,draw=blue,draw opacity=.5,line width=.4cm,bar width=.4cm,samples at={1,1.6}",
    data: "{2}", bars: [[.8,0,.4,2],[1.4,0,.4,2]], marks: [], paint: "S" }
];

function picture(c, native = false) {
  const hook = native && c.paint ? String.raw`,execute at begin plot visualization={\barpainttrace}` : "";
  const ink = c.paint ? "" : "draw=blue,fill=cyan,mark=*,";
  return String.raw`\begin{tikzpicture}\begin{axis}[hide axis,scale only axis,enlargelimits=false,${c.axis}${hook}]
    \addplot[${ink}${c.plot}] ${c.data}${native ? String.raw` \pgfextra{\bartrace}` : ""};
    \end{axis}\end{tikzpicture}`;
}

function compareRows(actual, expected, name, tolerance = 0.00001) {
  assert.equal(actual.length, expected.length, `${name}: ${actual.length} rows instead of ${expected.length}`);
  for (const [i, row] of expected.entries()) {
    assert.equal(actual[i].length, row.length);
    row.forEach((value, j) => assert.ok(Math.abs(actual[i][j] - value) < tolerance,
      `${name}: row ${i}, operand ${j}: ${actual[i][j]}cm versus ${value}cm`));
  }
}

for (const c of cases) test(`sampled bar handler: ${c.id}`, () => {
  const { ir, diagnostics } = tikzToSvg("\\pgfplotsset{compat=1.18}" + picture(c));
  assert.deepEqual(diagnostics, []);
  const rects = [];
  const paths = ir.items.filter(p => p.subtype === "axis-bar");
  if (c.paint) {
    assert.equal(paths.length, 1, "one fill/stroke action for the whole bar stream");
    const { fillRule, fill, stroke, fillOpacity, strokeOpacity } = paths[0].style;
    assert.equal(fillRule ?? "nonzero", c.paint === "f*" ? "evenodd" : "nonzero");
    assert.equal(fill !== "none", c.paint !== "S");
    assert.equal(stroke !== "none", !c.paint.startsWith("f"));
    if (c.fillOpacity !== undefined) assert.equal(fillOpacity, c.fillOpacity);
    if (c.paint === "S" || c.paint === "B") assert.equal(strokeOpacity, .5);
  }
  for (const path of paths) {
    assert.ok(path.clipRect, "bar paint must honor the axis clip");
    for (let i = 0; i < path.commands.length; i += 5) {
      const rect = path.commands.slice(i, i + 5);
      assert.deepEqual(rect.map(p => p.type), ["moveTo", "lineTo", "lineTo", "lineTo", "closePath"]);
      rects.push([rect[0].x, rect[0].y, rect[1].x - rect[0].x, rect[2].y - rect[1].y]);
    }
  }
  compareRows(rects, c.bars, c.id);
  assert.ok(!ir.items.some(p => p.subtype === "axis-plot"), "the samples must not turn into a line");
  compareRows(ir.items.filter(p => p.subtype === "axis-mark").map(p => [p.cx,p.cy]), c.marks, c.id + " marks");
});

test("addplot mark is a scalar at its last position across named styles, including an empty mark", () => {
  const definitions = { symbols: { mark: ["o", "square*"] } };
  for (const [keys, expected] of [
    ["mark=*,symbols,mark={}", "none"], ["mark=none,symbols", "square*"],
    ["symbols,mark={},mark=+", "+"], ["mark=*,mark=none,symbols", "square*"],
    ["/tikz/mark=*,symbols,/tikz/mark={}", "none"], ["mark=none,/tikz/mark=+", "+"]
  ]) {
    const [plot] = parseAddplots(`\\addplot+[${keys}] {1};`, { pgfplotsStyleDefinitions: definitions });
    assert.equal(plot.options.mark, expected, keys);
  }
});

test("an axis post style can restore or clear a sampled plot mark", () => {
  for (const [last, count] of [["{}", 0], ["+", 2]]) {
    const { ir, diagnostics } = tikzToSvg(String.raw`\begin{tikzpicture}
      \begin{axis}[hide axis,scale only axis,${paintFrame},every axis plot post/.style={mark=*,mark=${last}}]
        \addplot[/tikz/ybar,mark=none,samples at={1,2}] {1};
      \end{axis}\end{tikzpicture}`);
    assert.deepEqual(diagnostics, []);
    assert.equal(ir.items.filter(item => item.subtype === "axis-mark").length, count, last);
  }
});

test("installed PGFPlots produces the same signed rectangles and raw observation marks", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 to replay"
}, () => {
  const tex = String.raw`\documentclass{article}\usepackage{pgfplots}\pgfplotsset{compat=1.18}
\makeatletter
\def\bartrace{\begingroup\pgfgetpath\bartokens
  \def\pgfsyssoftpath@rectcornertoken##1##2##3##4##5{\typeout{BAR|\barid|rect|##1|##2|##4|##5}}%
  \bartokens\endgroup}
\let\barusepath\pgfusepath\def\barclip{clip}
\def\pgfusepath#1{\def\baraction{#1}\ifx\baraction\barclip
  \typeout{BAR|\barid|origin|\the\pgf@pathminx|\the\pgf@pathminy}\fi\barusepath{#1}}
\let\barusemark\pgfuseplotmark
\def\pgfuseplotmark#1{\begingroup\pgfpointtransformed{\pgfpointorigin}%
  \typeout{BAR|\barid|mark|\the\pgf@x|\the\pgf@y}\endgroup\barusemark{#1}}
\def\barpaint#1{\typeout{BAR|\barid|paint|#1\ifpgfsys@eorule*\fi}}
\def\barpainttrace{\let\barfill\pgfsys@fill\let\barboth\pgfsys@fillstroke\let\barstroke\pgfsys@stroke
  \def\pgfsys@fill{\barpaint{f}\barfill}\def\pgfsys@fillstroke{\barpaint{B}\barboth}\def\pgfsys@stroke{\barpaint{S}\barstroke}}
\begin{document}` + cases.map(c => `\\def\\barid{${c.id}}` + picture(c, true)).join("\n") + "\\end{document}";
  const cwd = mkdtempSync(join(tmpdir(), "pgfplots-sampled-bars-"));
  try {
    writeFileSync(join(cwd, "probe.tex"), tex);
    execFileSync("pdflatex", ["-draftmode", "-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "probe.tex"],
      { cwd, timeout: 30000 });
    const log = readFileSync(join(cwd, "probe.log"), "utf8").split(/\r?\n/);
    for (const c of cases) {
      const records = kind => log.filter(line => line.startsWith(`BAR|${c.id}|${kind}|`)).map(line => line.split("|").slice(3));
      if (c.paint) assert.deepEqual(records("paint"), [[c.paint]], c.id + " native paints");
      const rows = kind => records(kind).map(row => row.map(v => parseFloat(v) * 2.54 / 72.27));
      const [sw] = rows("origin");
      const relative = kind => rows(kind).map(([x,y,...rest]) => [x - sw[0], y - sw[1], ...rest]);
      compareRows(relative("rect"), c.bars, c.id + " native", .002);
      compareRows(relative("mark"), c.marks, c.id + " native marks", .002);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
