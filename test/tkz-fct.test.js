import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { expandTkzFct, tkzFctExtension } from "../src/extensions/tkz-fct.js";
import { collectTexPackages } from "../src/packages/declarations.js";

const FIXTURE = new URL("./fixtures/examples/latex-examples/intersecting-lines-5.tex", import.meta.url);
const DISCONTINUITY_FIXTURE = new URL(
  "./fixtures/examples/latex-examples/discontinuity-jump.tex",
  import.meta.url
);

test("exposes the tkz-fct Cartesian frame as a built-in preprocess extension", () => {
  assert.equal(tkzFctExtension.phase, "preprocess");
  assert.deepEqual(tkzFctExtension.commands, [
    "tkzInit",
    "tkzGrid",
    "tkzAxeXY",
    "tkzDrawX",
    "tkzDrawY",
    "tkzLabelX",
    "tkzLabelY",
    "tkzAxeX",
    "tkzAxeY",
    "tkzFct",
    "tkzFctPar",
    "tkzFctPolar"
  ]);
  const pkg = collectTexPackages(String.raw`\usepackage{tkz-fct}`)[0];
  assert.equal(pkg.status, "partial");
  assert.equal(pkg.implementedBy, "src/extensions/tkz-fct.js");
});

test("lowers tkzDrawX and tkzDrawY without adding the separate numeric-label commands", () => {
  const expanded = expandTkzFct(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=-1,xmax=1,ymin=-1,ymax=1,xstep=.2,ystep=.2]
  \tkzDrawX[color=red,label={$u$},right space=1,noticks]
  \tkzDrawY[color=blue,label={$v$},up space=1,step=.4,ticklt=3pt,tickrt=4pt]
\end{tikzpicture}`);

  assert.doesNotMatch(expanded, /\\tkzDraw[XY]/);
  assert.match(expanded, /\\draw\[color=red,line width=0\.4pt,-latex\] \(-5,0\) -- \(6,0\) node\[below=3pt,inner sep=1pt,outer sep=0pt\] \{\$u\$\};/);
  assert.match(expanded, /\\draw\[color=blue,line width=0\.4pt,-latex\] \(0,-5\) -- \(0,6\) node\[left=3pt,inner sep=1pt,outer sep=0pt\] \{\$v\$\};/);
  assert.doesNotMatch(expanded, /color=red,line width=0\.8pt/);
  assert.match(expanded, /\\draw\[color=blue,line width=0\.8pt\] \(4pt,-5\) -- \(-3pt,-5\);/);
  assert.match(expanded, /\\draw\[color=blue,line width=0\.8pt\] \(4pt,-3\) -- \(-3pt,-3\);/);
  assert.doesNotMatch(expanded, /\$-1\$/);
});

test("uses tkz-base trig positions for independent axis ticks", () => {
  const expanded = expandTkzFct(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=-3.2,xmax=3.2,ymin=-1,ymax=1]
  \tkzDrawX[trig=2]
\end{tikzpicture}`);

  assert.match(expanded, /\(0,2pt\) -- \(0,-2pt\);/);
  assert.match(expanded, /\(1\.5707963268,2pt\) -- \(1\.5707963268,-2pt\);/);
  assert.match(expanded, /\(-1\.5707963268,2pt\) -- \(-1\.5707963268,-2pt\);/);
});

test("lowers tkzLabelX and tkzLabelY in source units with origin, fraction, and pi formatting", () => {
  const expanded = expandTkzFct(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=20,xmax=60,xstep=10,ymin=-3.2,ymax=3.2]
  \tkzLabelX[step=20,orig,below right=4pt,text=blue]
  \tkzLabelY[trig=2,orig]
\end{tikzpicture}
\begin{tikzpicture}
  \tkzInit[xmin=-1,xmax=1.75,xstep=.33333]
  \tkzLabelX[frac=3]
\end{tikzpicture}`);

  assert.doesNotMatch(expanded, /\\tkzLabel[XY]/);
  assert.match(expanded, /node\[below=3pt,inner sep=1pt,outer sep=0pt,fill=white,below right=4pt,text=blue\] \{\$40\$\}/);
  assert.match(expanded, /node\[left=3pt,inner sep=1pt,outer sep=0pt,fill=white\] \{\$-\\pi\$\}/);
  assert.match(expanded, /node\[left=3pt,inner sep=1pt,outer sep=0pt,fill=white\] \{\$\\frac\{-\\pi\}\{2\}\$\}/);
  assert.doesNotMatch(expanded, /node\[left=3pt,[^\n]*\] \{\$0\$\}/);
  assert.match(expanded, /\$\\frac\{-2\}\{3\}\$/);
  assert.match(expanded, /\$\\frac\{1\}\{3\}\$/);
});

test("combines tkzAxeX and tkzAxeY from their native draw and label commands", () => {
  const result = tikzToSvg(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=0,xmax=2,ymin=0,ymax=2]
  \tkzAxeX
  \tkzAxeY
\end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$1$"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$x$"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$y$"));
});

test("lowers tkzFct gnuplot syntax into scaled, clipped ordinary TikZ segments", () => {
  const expanded = expandTkzFct(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=0,xmax=10,ymin=0,ymax=20,ystep=5]
  \tkzFct[color=red,style=dashed,samples=3,domain=0:10]{2*x+5}
\end{tikzpicture}`);

  assert.doesNotMatch(expanded, /\\tkzFct/);
  assert.match(expanded, /\\begin\{scope\}\\clip \(0,0\) rectangle \(10,4\);/);
  assert.match(expanded, /\\draw\[color=red,dashed,line width=1pt\] \(0,1\) -- \(5,3\) -- \(7\.5,4\);/);
});

test("renders tkzFct expressions in source units before xstep and ystep scaling", () => {
  const result = tikzToSvg(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=0,xmax=10,xstep=2,ymin=0,ymax=20,ystep=5]
  \tkzFct[color=blue,samples=3,domain=0:10]{2*\x+5}
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find((item) => item.type === "path" && item.style?.stroke === "blue");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    path.commands.map((command) => [command.x, command.y]),
    [[0, 1], [2.5, 3], [3.75, 4]]
  );
});

test("lowers tkzFctPar by evaluating t in source units and scaling each coordinate", () => {
  const expanded = expandTkzFct(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=0,xmax=10,ymin=0,ymax=20,ystep=5]
  \tkzFctPar[color=red,style=dashed,samples=3,domain=0:10]{t}{2*t+5}
\end{tikzpicture}`);

  assert.doesNotMatch(expanded, /\\tkzFctPar/);
  assert.match(expanded, /\\begin\{scope\}\\clip \(0,0\) rectangle \(10,4\);/);
  assert.match(expanded, /\\draw\[color=red,dashed,line width=0\.4pt\] \(0,1\) -- \(5,3\) -- \(7\.5,4\);/);
});

test("uses tkzFctPar's native -5:5 default domain independently of the frame", () => {
  const result = tikzToSvg(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=-2,xmax=2,ymin=-2,ymax=2]
  \tkzFctPar[color=blue,samples=3]{t}{t}
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style?.stroke === "blue");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths.length, 1);
  assert.deepEqual(
    paths[0].commands.map((command) => [command.x, command.y]),
    [[-2, -2], [0, 0], [2, 2]]
  );
});

test("lowers tkzFctPolar with its native radial mapping and default domain", () => {
  const expanded = expandTkzFct(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=-1,xmax=1,ymin=-1,ymax=1,xstep=.2,ystep=.2]
  \tkzFctPolar[color=red,samples=5]{1}
\end{tikzpicture}`);

  assert.doesNotMatch(expanded, /\\tkzFctPolar/);
  assert.doesNotMatch(expanded, /\\clip/);
  assert.match(expanded, /\\draw\[color=red,line width=0\.4pt\] \(5,0\) -- \(0,5\) -- \(-5,0\) -- \(0,-5\) -- \(5,0\);/);
});

test("uses xstep for polar radius and shifts same-sign local origins like tkz-fct", () => {
  const result = tikzToSvg(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=20,xmax=60,xstep=10,ymin=1000,ymax=3000,ystep=1000]
  \tkzFctPolar[color=blue,samples=2,domain=0:pi]{10}
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find((item) => item.type === "path" && item.style?.stroke === "blue");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    path.commands.map((command) => [command.x, command.y]),
    [[-1, -1], [-3, -1]]
  );
});

test("splits tkzFct paths at sampled poles instead of drawing a vertical bridge", () => {
  const result = tikzToSvg(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=-2,xmax=2,ymin=-5,ymax=5]
  \tkzFct[color=red,domain=-2:2,samples=81]{tan(x)}
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style?.stroke === "red");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths.length, 3);
  assert.ok(
    paths.every((path) =>
      !path.commands.some(
        (command, index) =>
          index > 0 &&
          Math.abs(command.y - path.commands[index - 1].y) >= 10 &&
          Math.abs(command.x - path.commands[index - 1].x) < 0.01
      )
    )
  );
});

test("keeps a continuous steep tkzFct segment connected across opposite frame bounds", () => {
  const result = tikzToSvg(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=-5,xmax=5,ymin=-5,ymax=5]
  \tkzFct[color=blue,domain=-10:10,samples=2]{x}
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style?.stroke === "blue");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths.length, 1);
  assert.deepEqual(
    paths[0].commands.map((command) => [command.x, command.y]),
    [[-5, -5], [5, 5]]
  );
});

test("lowers tkzInit, tkzGrid, and tkzAxeXY using tkz-base dimensions", () => {
  const expanded = expandTkzFct(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=0,xmax=4.5,ymin=0,ymax=4.5]
  \tkzGrid[color=gray!30!white]
  \tkzAxeXY
\end{tikzpicture}`);

  assert.doesNotMatch(expanded, /\\tkz(?:Init|Grid|AxeXY)/);
  assert.match(expanded, /line width=0\.4pt,xstep=1cm,ystep=1cm\] \(0,0\) grid \(4\.5,4\.5\)/);
  assert.match(expanded, /line width=0\.4pt,-latex\] \(0,0\) -- \(5,0\)/);
  assert.match(expanded, /line width=0\.8pt/);
  assert.match(expanded, /\\path \(4,2pt\) -- \(4,-2pt\) node\[below=3pt.*\{\$4\$\}/);
});

test("matches tkz-base local origins and subgrid ranges for non-normalized frames", () => {
  const source = String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=20,xmax=100,xstep=20,ymin=1000,ymax=3000,ystep=1000]
  \tkzGrid[sub,subxstep=10,subystep=500,color=orange](-20,-1000)(115,4000)
  \tkzAxeXY
\end{tikzpicture}`;
  const expanded = expandTkzFct(source);
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const gridLines = result.ir.items.filter((item) => item.type === "path" && item.subtype === "grid-line");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.doesNotMatch(expanded, /\(-20,-1000\)\(115,4000\)/);
  assert.match(expanded, /color=orange!50,line width=0\.3pt,xstep=0\.5cm,ystep=0\.5cm\] \(-2,-2\) grid \(4\.75,3\)/);
  assert.match(expanded, /color=orange,line width=0\.4pt,xstep=1cm,ystep=1cm\] \(-2,-2\) grid \(4\.75,3\)/);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(gridLines.length, 38, "expected 25 subgrid lines beneath 13 major-grid lines");
  assert.ok(labels.includes("$20$") && labels.includes("$100$") && labels.includes("$1000$") && labels.includes("$3000$"));
});

test("lowers tkzAxeXY labels from tick endpoints and honors shared axis geometry options", () => {
  const expanded = expandTkzFct(String.raw`
\usepackage{tkz-fct}
\begin{tikzpicture}
  \tkzInit[xmin=0,xmax=2.5,ymin=0,ymax=2.5]
  \begin{scriptsize}
    \tkzAxeXY[
      right space=1.25,
      up space=.75,
      tickwd=1.2pt,
      tickup=3pt,
      tickdn=1pt,
      ticklt=4pt,
      tickrt=.5pt
    ]
  \end{scriptsize}
\end{tikzpicture}`);

  assert.match(expanded, /\\begin\{scope\}\[font=\\scriptsize\]/);
  assert.match(expanded, /line width=0\.4pt,-latex\] \(0,0\) -- \(3\.75,0\)/);
  assert.match(expanded, /line width=0\.4pt,-latex\] \(0,0\) -- \(0,3\.25\)/);
  assert.match(expanded, /\(3\.75,0\) node\[below=3pt.*\{\$x\$\}/);
  assert.match(expanded, /\(0,3\.25\) node\[left=3pt.*\{\$y\$\}/);
  assert.match(expanded, /line width=1\.2pt\] \(0,3pt\) -- \(0,-1pt\)/);
  assert.match(expanded, /line width=1\.2pt\] \(\.5pt,2\) -- \(-4pt,2\)/);
  assert.match(expanded, /\\path \(2,3pt\) -- \(2,-1pt\) node\[overlay,below=3pt.*\{\$2\$\}/);
  assert.match(expanded, /\\path \(\.5pt,2\) -- \(-4pt,2\) node\[left=3pt.*\{\$2\$\}/);
  assert.match(expanded, /\\path \(\.5pt,0\) -- \(-4pt,0\) node\[left=3pt.*\{\$0\$\}/);
  assert.match(expanded, /node\[overlay,below=3pt/);
  assert.match(expanded, /\\path\[use as bounding box\] \(0,-10\.48pt\);/);
});

test("renders the intersecting-lines tkz-fct frame and to-path endpoint crosses", () => {
  const result = tikzToSvg(readFileSync(FIXTURE, "utf8"), { mathRenderer: "svg-text" });
  const gridLines = result.ir.items.filter((item) => item.type === "path" && item.subtype === "grid-line");
  const coloredLines = result.ir.items.filter(
    (item) => item.type === "path" && (item.style?.stroke === "red" || item.style?.stroke === "blue")
  );
  const crosses = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "crossOut");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(gridLines.length, 10);
  assert.deepEqual(coloredLines.map((item) => item.style.stroke), ["red", "blue"]);
  assert.equal(crosses.length, 4);
  assert.deepEqual(
    crosses.map((item) => [item.x, item.y]),
    [[2, 2], [4, 4], [1, 1], [3, 3]]
  );
  assert.match(result.svg, /class="tikz-shape-cross-out"/);
});

test("renders the discontinuity jump with aligned tkz-fct axes and open and closed points", () => {
  const result = tikzToSvg(readFileSync(DISCONTINUITY_FIXTURE, "utf8"), { mathRenderer: "svg-text" });
  const gridLines = result.ir.items.filter((item) => item.type === "path" && item.subtype === "grid-line");
  const plottedLines = result.ir.items.filter(
    (item) => item.type === "path" && !item.subtype && item.commands?.length === 2 && !item.style?.markerEnd
  );
  const jumpPoints = result.ir.items.filter((item) => item.type === "path" && item.shape === "circle");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(gridLines.length, 13);
  assert.deepEqual(
    plottedLines.slice(-2).map((item) => item.commands.map((command) => [command.x, command.y])),
    [
      [[0, 0], [1, 1]],
      [[1, 2], [5, 6]]
    ]
  );
  assert.deepEqual(
    jumpPoints.map((item) => ({ fill: item.style.fill, center: [item.cx, item.cy] })),
    [
      { fill: "black", center: [1, 1] },
      { fill: "white", center: [1, 2] }
    ]
  );
  assert.ok(jumpPoints.every((item) => Math.abs(item.r - 0.10543794107480464) < 1e-12));
  assert.match(result.svg, /stroke="rgb\(217 217 217\)"/);
});
