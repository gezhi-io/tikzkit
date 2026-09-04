import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import { spacedSideToArrowMetrics } from "../src/tikz/libraries/arrows.spaced.js";
import { legacySideToArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.spaced}
\begin{tikzpicture}[line width=1.2pt]
  \draw[-{spaced left to}] (0,0) -- (2,0);
  \draw[-{spaced left to reversed}] (0,1) -- (2,1);
  \draw[-{spaced right to}] (0,2) -- (2,2);
  \draw[{spaced right to reversed}-{spaced left to}] (0,3) -- (2,3);
\end{tikzpicture}`;

const UNITS_PER_PT = lineWidthFromPt(1);
const inPt = (value) => value / UNITS_PER_PT;

test("parses all source-declared spaced side-to aliases", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.map((item) => item.style.markerEnd.kind), [
    "legacy-spaced-left-to",
    "legacy-spaced-left-to-reversed",
    "legacy-spaced-right-to",
    "legacy-spaced-left-to"
  ]);
  assert.equal(paths.at(-1).style.markerStart.kind, "legacy-spaced-right-to-reversed");
});

test("shares the source geometry with the four ordinary side-to aliases", () => {
  const result = tikzToSvg(String.raw`
    \usetikzlibrary{arrows}
    \begin{tikzpicture}
      \draw[-{left to}] (0,0) -- (2,0);
      \draw[-{left to reversed}] (0,1) -- (2,1);
      \draw[-{right to}] (0,2) -- (2,2);
      \draw[-{right to reversed}] (0,3) -- (2,3);
    \end{tikzpicture}`, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.map((item) => item.style.markerEnd.kind), [
    "legacy-left-to",
    "legacy-left-to-reversed",
    "legacy-right-to",
    "legacy-right-to-reversed"
  ]);
});

test("uses installed PGF dimensions and adds only the invisible space", () => {
  const lineWidth = lineWidthFromPt(1.2);
  const expectedSpacePt = 0.88 + 0.3 * 1.2;

  for (const side of ["left", "right"]) {
    for (const reversed of [false, true]) {
      const suffix = `${side}-to${reversed ? "-reversed" : ""}`;
      const base = legacySideToArrowMetrics(`legacy-${suffix}`, lineWidth);
      const spaced = spacedSideToArrowMetrics(`legacy-spaced-${suffix}`, lineWidth);

      assert.equal(base.side, side);
      assert.equal(base.reversed, reversed);
      assert.ok(Math.abs(inPt(base.unit) - 0.64) < 1e-9);
      assert.ok(Math.abs(inPt(base.arrowLineWidth) - 0.96) < 1e-9);
      assert.ok(Math.abs(inPt(base.backEnd) - (reversed ? -0.12 : -2.4)) < 1e-9);
      assert.ok(Math.abs(inPt(base.tipEnd) - (reversed ? 3.48 : 0.96)) < 1e-9);
      assert.ok(Math.abs(inPt(spaced.space) - expectedSpacePt) < 1e-9);
      assert.ok(Math.abs(spaced.placement - (base.placement + spaced.space)) < 1e-9);
      assert.ok(Math.abs(spaced.terminalPlacement - (base.placement + spaced.space)) < 1e-9);
      assert.ok(Math.abs(spaced.assemblyLength - (base.assemblyLength + spaced.space)) < 1e-9);
    }
  }
});

test("preserves upper and lower half geometry plus reversed stem paint", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(1.2) };
  const left = resolveInlineArrowTip("spaced left to", style);
  const right = resolveInlineArrowTip("spaced right to", style);
  const leftReversed = resolveInlineArrowTip("spaced left to reversed", style);
  const rightReversed = resolveInlineArrowTip("spaced right to reversed", style);

  for (const tip of [left, right, leftReversed, rightReversed]) {
    assert.equal(tip.fill, "none");
    assert.equal(tip.stroke, style.stroke);
    assert.equal(tip.lineCap, "round");
    assert.equal(tip.lineJoin, "round");
    assert.equal(tip.strokeWidth, lineWidthFromPt(0.96));
  }
  assert.ok(left.geometry.bounds.minY < 0);
  assert.ok(Math.abs(left.geometry.bounds.maxY) < 1e-9);
  assert.ok(Math.abs(right.geometry.bounds.minY) < 1e-9);
  assert.ok(right.geometry.bounds.maxY > 0);

  for (const tip of [leftReversed, rightReversed]) {
    assert.equal(tip.geometry.parts.length, 2);
    assert.equal(tip.geometry.parts[0].strokeWidth, style.lineWidth);
    assert.equal(tip.geometry.parts[0].lineCap, "butt");
    assert.equal(tip.geometry.parts[1].strokeWidth, lineWidthFromPt(0.96));
    assert.equal(tip.geometry.parts[1].lineCap, "round");
    assert.match(tip.geometry.parts[1].path, /M[^M]+C[^M]+M[^M]+C/u);
  }
});

test("renders side-to parts at straight, start, orthogonal, and curved terminals", () => {
  const result = tikzToSvg(String.raw`
    \usetikzlibrary{arrows,arrows.spaced}
    \begin{tikzpicture}[line width=1pt]
      \draw[-{spaced left to}] (0,0) -- (2,0);
      \draw[{spaced right to reversed}-] (0,1) -- (2,1);
      \draw[-{spaced right to}] (0,2) -| (2,3);
      \draw[-{spaced left to reversed}] (0,4) to[bend left=25] (2,4);
    \end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /tikz-arrow-legacy-spaced-left-to/u);
  assert.match(result.svg, /tikz-arrow-legacy-spaced-right-to-reversed/u);
  assert.match(result.svg, /tikz-arrow-part-stem/u);
  assert.match(result.svg, /tikz-arrow-part-curve/u);
});
