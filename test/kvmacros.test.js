import test from "node:test";
import assert from "node:assert/strict";
import { tikzToSvg } from "../src/index.js";
import { expandKvmacros } from "../src/extensions/kvmacros.js";

const SOURCE = String.raw`
\usepackage[dvipsnames]{xcolor}
\input{kvmacros}
\usepackage{tikz}
\usetikzlibrary{calc}
\newcommand{\tikzmark}[1]{\tikz[overlay,remember picture,baseline] \node (#1) {};}
\newcommand{\DrawArrow}[3][]{
  \begin{tikzpicture}[overlay,remember picture]
    \draw[->,thick,#1] ($(#2)+(-0.50em,3.5ex)$) to ($(#3)+(1.5em,0ex)$);
  \end{tikzpicture}
}
\karnaughmap{4}{$f(w,x,y,z)$}{{$w$}{$x$}{$y$}{$z$}}{
  1100 1100 0011 0101
}{
  \textcolor{Blue}{\put(2,3.5){\oval(3.9,0.9)[]}}
  \textcolor{WildStrawberry}{\put(0.9,3.5){\oval(1.7,0.8)[]}}
  \textcolor{Green}{\put(0.7,1.5){\tikzmark{11}\oval(1.9,0.9)}}
  \textcolor{Sepia}{\put(1.5,1.5){\oval(1.6,0.7)}}
  \textcolor{Red}{\put(1.92,1){\oval(0.9,1.9)}}
  \textcolor{LimeGreen}{
    \put(1.76,-0.2){\tikzmark{13}\oval(0.9,2.1)[t]}
    \put(1.76,4.2){\oval(0.9,2.1)[b]}
  }
}
\DrawArrow[red,ultra thick,out=-180,in=-90,distance=1.5em,shorten >= -4.5ex]{13}{11}
`;

test("lowers kvmacros maps to Gray-code cells, variable brackets, and picture overlays", () => {
  const lowered = expandKvmacros(SOURCE, []);
  assert.doesNotMatch(lowered, /\\(?:karnaughmap|kvmap|input\s*\{?kvmacros)/);
  assert.match(lowered, /\\begin\{tikzpicture\}\[x=8mm,y=8mm\]/);
  assert.match(lowered, /\\path\[use as bounding box\] \(-2,-4\) rectangle \(4,2\);/);
  assert.match(lowered, /\\begin\{scope\}\[overlay\]/);
  assert.match(lowered, /at \(2\.05,-0\.95\) \{5\}/, "expected Gray-code column ordering");
  assert.match(lowered, /at \(0\.05,-2\.95\) \{10\}/, "expected Gray-code row ordering");
  assert.match(lowered, /\\draw\[draw=WildStrawberry\]/);
});

test("preserves the standalone paragraph canvas around a legacy picture map", () => {
  const lowered = expandKvmacros(`\\documentclass{standalone}\n${SOURCE}`, []);
  assert.match(lowered, /\\path\[use as bounding box\] \(-2\.966,-4\.088\) rectangle \(4\.38,2\.088\);/);
});

test("matches kvmacros picture flow, dvips colors, and curved arrow geometry", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.type === "textNode").length, 37);
  assert.ok(
    result.ir.items.filter((item) => item.type !== "bbox").every((item) => item.overlay === true),
    "expected the fixed picture contents, including nodes, not to enlarge the outer box"
  );

  assert.ok(Math.abs(result.ir.coordinates["11"].x - 0.7943064) < 1e-6);
  assert.ok(Math.abs(result.ir.coordinates["13"].x - 1.9937664) < 1e-6);

  const coloredStrokes = new Set(
    result.ir.items.filter((item) => item.type === "path").map((item) => item.style?.stroke)
  );
  for (const color of [
    "rgb(46 49 146)",
    "rgb(237 20 102)",
    "rgb(0 166 80)",
    "rgb(95 22 9)",
    "rgb(237 28 36)",
    "rgb(128 204 40)"
  ]) {
    assert.ok(coloredStrokes.has(color), `missing native dvips color ${color}`);
  }

  const arrow = result.ir.items.find((item) => item.type === "path" && item.style?.markerEnd);
  assert.ok(arrow, "expected the DrawArrow overlay");
  assert.ok(Math.abs(arrow.commands[0].x - 1.8180365) < 1e-6, "expected picture whitespace-adjusted source mark");
  const cmr10Em = (655361 / 65536) / 28.4527559;
  assert.ok(Math.abs(arrow.commands[0].x - arrow.commands[1].x1 - 1.5 * cmr10Em) < 1e-10, "expected distance=1.5em control arm");
  const cmr10Ex = (282168 / 65536) / 28.4527559;
  assert.ok(Math.abs(arrow.style.shortenEnd + 4.5 * cmr10Ex * 100) < 1e-10, "expected negative shorten >= to remain signed");
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-to"/);
});
