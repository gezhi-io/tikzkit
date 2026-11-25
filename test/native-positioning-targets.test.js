import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const box = "box/.style={draw,rectangle,inner sep=0pt,outer sep=0pt,minimum width=2cm,minimum height=1cm}";

function positions(body, options = "", library = true) {
  const source = (library ? "\\usetikzlibrary{positioning,calc}\n" : "") +
    String.raw`\begin{tikzpicture}[${box},${options}]${body}\end{tikzpicture}`;
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  if (process.env.POSITIONING_PDFLATEX) compareNativeCenters(source, result.ir.coordinates);
  return result.ir.coordinates;
}

function at(points, name, x, y) {
  const p = points[name];
  assert.ok(p && Math.hypot(p.x - x, p.y - y) < 0.0001,
    `${name}: expected (${x}, ${y}) cm, got ${JSON.stringify(p)}`);
}

function compareNativeCenters(source, points) {
  const trace = Object.keys(points).map(name => String.raw`
    \pgfextractx{\probeX}{\pgfpointanchor{${name}}{center}}
    \pgfextracty{\probeY}{\pgfpointanchor{${name}}{center}}
    \typeout{TKZCENTER ${name}: \the\probeX,\the\probeY}`).join("\n");
  const picture = source.replace("\\end{tikzpicture}", () =>
    String.raw`\begin{scope}[reset cm]${trace}\end{scope}\end{tikzpicture}`);
  const dir = mkdtempSync(join(tmpdir(), "tikzkit-positioning-"));
  try {
    writeFileSync(join(dir, "probe.tex"), String.raw`\documentclass{article}\usepackage{tikz}
      \newdimen\probeX\newdimen\probeY\begin{document}${picture}\end{document}`);
    const log = execFileSync(process.env.POSITIONING_PDFLATEX, [
      "-no-shell-escape", "-halt-on-error", "-interaction=nonstopmode", "probe.tex"
    ], { cwd: dir, encoding: "utf8" });
    const centers = [...log.matchAll(/^TKZCENTER (\S+): ([-.\d]+)pt,([-.\d]+)pt/gm)];
    assert.equal(centers.length, Object.keys(points).length, "missing native node centers");
    for (const [, name, x, y] of centers) at(points, name, Number(x) * 2.54 / 72.27, Number(y) * 2.54 / 72.27);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("positioning only centers on grid when the target requests a shape border", () => {
  const p = positions(String.raw`
    \node[box] (A) at (2,3) {};
    \coordinate (P) at (6,3);
    \node[box,right=1cm of A] (implicit) {};
    \node[box,right=1cm of A.center] (explicit) {};
    \node[box,right=1cm of P] (named) {};
    \node[box,above=1cm of {4,3}] (literal) {};
    \node[box,above=1cm of A.north east] (corner) {};`, "on grid");
  at(p, "implicit", 3, 3);
  at(p, "explicit", 4, 3);
  at(p, "named", 8, 3);
  at(p, "literal", 4, 4.5);
  at(p, "corner", 3, 5);
});

test("calculated and projected positioning targets use the coordinate interpreter", () => {
  const p = positions(String.raw`
    \coordinate (A) at (2,3); \coordinate (B) at (4,5);
    \node[box,right=0pt of {$(A)!.5!(B)$}] (midpoint) {};
    \node[box,above=0pt of {A -| B}] (projection) {};
    \node[box,right=0pt of {canvas cs:x=1cm,y=2cm}] (canvas) {};`);
  at(p, "midpoint", 4, 4);
  at(p, "projection", 4, 3.5);
  at(p, "canvas", 2, 2);
});

test("default diagonal node distance is a pair, not Euclidean length one", () => {
  const p = positions(String.raw`
    \node[box] (A) {};
    \node[box,above right=of A] (defaultpair) {};
    \node[box,above right=1cm of A] (single) {};
    \node[box,above right=1cm and 1cm of A] (pair) {};`, "on grid");
  at(p, "defaultpair", 1, 1);
  at(p, "pair", 1, 1);
  at(p, "single", Math.SQRT1_2, Math.SQRT1_2);
});

test("node distance and on grid take effect at the direction key", () => {
  const p = positions(String.raw`
    \node[box] (A) {};
    \node[box,node distance=3cm,right=of A] (early) {};
    \node[box,right=of A,node distance=3cm] (late) {};
    \node[box,above=of A,on grid=false] (gridBefore) {};
    \node[box,on grid=false,above=of A] (gridAfter) {};
    \node[box,localstep,right=of A] (styled) {};`,
    "on grid,node distance=8mm,localstep/.style={node distance=2cm}");
  at(p, "early", 3, 0);
  at(p, "late", .8, 0);
  at(p, "gridBefore", 0, .8);
  at(p, "gridAfter", 0, 1.8);
  at(p, "styled", 2, 0);
});

test("placement projects each bare factor on its own basis before selecting signed components", () => {
  const p = positions(String.raw`
    \node[box] (A) {};
    \node[box,above right=1 and 2 of A] (both) {};
    \node[box,below left=1 and 5mm of A] (mixed) {};
    \node[box,right=1 of A] (horizontal) {};
    \node[box,above left=1 of A] (single) {};`, "on grid,x={(2cm,.5cm)},y={(-.5cm,1.5cm)}");
  at(p, "both", 3.5, 2.5);
  at(p, "mixed", 0, -1.5);
  at(p, "horizontal", 1.5, 0);
  at(p, "single", -1.5 * Math.SQRT1_2, 2 * Math.SQRT1_2);
});

test("a later anchor replaces the positioning self anchor, not the reference or gap", () => {
  const p = positions(String.raw`
    \node[box] (A) {};
    \node[box,right=1cm of A,anchor=north] (after) {};
    \node[box,anchor=north,right=1cm of A] (before) {};
    \node[box,on grid,right=1cm of A,anchor=south] (grid) {};`);
  at(p, "after", 2, -.5);
  at(p, "before", 3, 0);
  at(p, "grid", 1, .5);
});

test("library-only directions without an of target use the same distance grammar", () => {
  const p = positions(String.raw`
    \node[box,above=.5] (number) at (0,0) {};
    \node[box,above right=.5 and 3mm] (pair) at (0,0) {};`, "y=2cm");
  at(p, "number", 0, 1.5);
  at(p, "pair", 1.3, 1.5);
  const core = positions(String.raw`\node[box,above=.5] (plain) at (0,0) {};`, "y=2cm", false);
  at(core, "plain", 0, .5 + .5 * 2.54 / 72.27);
});

test("the last target wins; a later at retains the active shift and self anchor", () => {
  const p = positions(String.raw`
    \node[box] (A) at (4,4) {};
    \node[box,right=1cm of A] (lateAt) at (0,0) {};
    \node[box] (lateOf) at (0,0) [right=1cm of A] {};
    \node[box,at={(2,3)},above=1cm of A] (keyFirst) {};
    \node[box,above=1cm of A,at={(2,3)}] (keyLast) {};
    \node[box,at={(2,3)}] (onlyAt) {};`);
  at(p, "lateAt", 2, 0);
  at(p, "lateOf", 7, 4);
  at(p, "keyFirst", 4, 6);
  at(p, "keyLast", 2, 4.5);
  at(p, "onlyAt", 2, 3);
});

test("repeated positioning registers across style expansion do not move existing nodes", () => {
  const p = positions(String.raw`
    \node[box] (A) {};
    \node[box,node distance=2cm,right=of A,node distance=9cm] (repeated) {};
    \node[box,on grid=false,above=1cm of A,on grid] (notGridded) {};
    \node[box,row,right=of A,node distance=7cm] (fromStyle) {};
    \node[box,right=of A] (restored) {};`, "on grid,row/.style={node distance=1.5cm}");
  at(p, "repeated", 2, 0);
  at(p, "notGridded", 0, 2);
  at(p, "fromStyle", 1.5, 0);
  at(p, "restored", 1, 0);
});

test("normal coordinate rotation is reset before a node shift; transform shape retains it", () => {
  const p = positions(String.raw`
    \coordinate (A) at (1,0);
    \node[box,right=1cm of A] (plain) {};
    \node[box,right=1cm of A,transform shape] (transformed) {};`, "scale=2,rotate=90");
  at(p, "plain", 2, 2);
  at(p, "transformed", 0, 6);
});

test("a sloped path label applies the library shift once in the tangent frame", () => {
  const p = positions(String.raw`
    \draw (0,0) -- node[box,midway,sloped,above right=6mm and 3mm] (pair) {} (0,4cm);
    \draw (0,0) -- node[box,midway,sloped,above=3mm,right=2mm] (last) {} (0,4cm);`);
  at(p, "pair", -1.1, 3.3);
  at(p, "last", 0, 3.2);
});

test("only the last direction supplies the gap, even when an explicit anchor follows", () => {
  const p = positions(String.raw`
    \node[box] (A) {};
    \node[box,above=6mm,right=1cm of A,anchor=north] (after) {};
    \node[box,right=1cm of A,above=6mm] (replace) {};
    \node[box,/tikz/right=0pt of {node cs:name=A}] (border) {};
    \node[box,/tikz/right=0pt of {node cs:name=A,anchor=east}] (fixed) {};`, "on grid");
  at(p, "after", 1, -.5);
  at(p, "replace", 0, 1.1);
  at(p, "border", 0, 0);
  at(p, "fixed", 2, 0);
});

test("positioned coordinate declarations are zero-size nodes, including through styles", () => {
  const p = positions(String.raw`
    \node[box] (A) at (1,2) {};
    \coordinate[stepstyle] (P);
    \coordinate[stepstyle] (Q) at (0,0);
    \coordinate[above right=2mm and 4mm] (R) at (1cm,0);
    \node[box,on grid,below=0pt of P] (B) {};`, "stepstyle/.style={right=4mm of A}");
  at(p, "P", 2.4, 2);
  at(p, "Q", .4, 0);
  at(p, "R", 1.4, .2);
  at(p, "B", 2.4, 1.5);
});
