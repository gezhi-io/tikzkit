import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { legacyCapArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.meta}
\begin{tikzpicture}[line width=.8pt]
  \draw[-{round cap}] (0,0) -- (2,0);
  \draw[-{butt cap}] (0,1) -- (2,1);
  \draw[-{triangle 90 cap}] (0,2) -- (2,2);
  \draw[-{triangle 90 cap reversed}] (0,3) -- (2,3);
  \draw[-{fast cap}] (0,4) -- (2,4);
  \draw[-{fast cap reversed}] (0,5) -- (2,5);
  \draw[-{Round Cap}] (0,6) -- (2,6);
  \draw[{round cap}-{fast cap reversed}] (0,7) -- (2,7);
\end{tikzpicture}`;

test("distinguishes all legacy cap declarations from arrows.meta cap names", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.slice(0, 7).map((path) => path.style.markerEnd.kind), [
    "legacy-round-cap",
    "legacy-butt-cap",
    "legacy-triangle-90-cap",
    "legacy-triangle-90-cap-reversed",
    "legacy-fast-cap",
    "legacy-fast-cap-reversed",
    "round-cap"
  ]);
  assert.equal(paths[7].style.markerStart.kind, "legacy-round-cap");
  assert.equal(paths[7].style.markerEnd.kind, "legacy-fast-cap-reversed");
  assert.equal([...result.svg.matchAll(/class="tikz-arrow-tip tikz-arrow-legacy-/g)].length, 8);
});

test("uses installed PGF extents for legacy caps", () => {
  const lineWidth = lineWidthFromPt(0.8);
  const unitsPerPt = lineWidthFromPt(1);
  const round = legacyCapArrowMetrics("legacy-round-cap", lineWidth);
  const butt = legacyCapArrowMetrics("legacy-butt-cap", lineWidth);
  const triangle = legacyCapArrowMetrics("legacy-triangle-90-cap", lineWidth);
  const triangleReversed = legacyCapArrowMetrics("legacy-triangle-90-cap-reversed", lineWidth);
  const fast = legacyCapArrowMetrics("legacy-fast-cap", lineWidth);

  assert.ok(Math.abs(round.backEnd / unitsPerPt) < 1e-9);
  assert.ok(Math.abs(round.tipEnd / unitsPerPt - 0.8) < 1e-9);
  assert.ok(Math.abs(round.assemblyLength / unitsPerPt - 0.8) < 1e-9);
  assert.ok(Math.abs(butt.backEnd / unitsPerPt + 0.08) < 1e-9);
  assert.ok(Math.abs(butt.tipEnd / unitsPerPt - 0.4) < 1e-9);
  assert.ok(Math.abs(triangle.tipEnd / unitsPerPt - 0.8) < 1e-9);
  assert.ok(Math.abs(triangle.halfHeight / unitsPerPt - 0.4) < 1e-9);
  assert.equal(triangleReversed.reversed, true);
  assert.ok(Math.abs(fast.tipEnd / unitsPerPt - 1.6) < 1e-9);
  assert.ok(Math.abs(fast.assemblyLength / unitsPerPt - 1.68) < 1e-9);
});

test("renders source-derived cap paths with declaration paint semantics", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(0.8) };
  const round = resolveInlineArrowTip("round cap", style);
  const butt = resolveInlineArrowTip("butt cap", style);
  const triangle = resolveInlineArrowTip("triangle 90 cap", style);
  const triangleReversed = resolveInlineArrowTip("triangle 90 cap reversed", style);
  const fast = resolveInlineArrowTip("fast cap", style);
  const fastReversed = resolveInlineArrowTip("fast cap reversed", style);

  for (const tip of [round, butt]) {
    assert.equal(tip.fill, "none");
    assert.equal(tip.stroke, "#2457a6");
    assert.equal(tip.strokeWidth, style.lineWidth);
  }
  assert.equal(round.lineCap, "round");
  assert.equal(butt.lineCap, "butt");

  for (const tip of [triangle, triangleReversed, fast, fastReversed]) {
    assert.equal(tip.fill, "#2457a6");
    assert.equal(tip.stroke, "none");
    assert.equal(tip.strokeWidth, 0);
    assert.match(tip.geometry.path, /Z$/);
  }
  assert.notEqual(triangle.geometry.path, triangleReversed.geometry.path);
  assert.notEqual(fast.geometry.path, fastReversed.geometry.path);
  assert.ok(fast.geometry.bounds.maxX > triangle.geometry.bounds.maxX);
});
