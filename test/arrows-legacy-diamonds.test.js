import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { legacyDiamondArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.meta}
\begin{tikzpicture}[line width=.8pt]
  \draw[-diamond] (0,0) -- (2,0);
  \draw[-{open diamond}] (0,1) -- (2,1);
  \draw[{diamond}-] (0,2) -- (2,2);
  \draw[{open diamond}-{diamond}] (0,3) -- (2,3);
  \draw[-{Diamond}] (0,4) -- (2,4);
\end{tikzpicture}`;

test("distinguishes legacy diamond names from arrows.meta Diamond", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && (item.style.markerStart || item.style.markerEnd));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths[0].style.markerEnd.kind, "legacy-diamond");
  assert.equal(paths[1].style.markerEnd.kind, "legacy-open-diamond");
  assert.equal(paths[2].style.markerStart.kind, "legacy-diamond");
  assert.equal(paths[3].style.markerStart.kind, "legacy-open-diamond");
  assert.equal(paths[3].style.markerEnd.kind, "legacy-diamond");
  assert.equal(paths[4].style.markerEnd.kind, "kite");
});

test("uses installed PGF line-width formulas for legacy diamonds", () => {
  const lineWidth = lineWidthFromPt(0.8);
  const unitsPerPt = lineWidthFromPt(1);
  const filled = legacyDiamondArrowMetrics("legacy-diamond", lineWidth);
  const open = legacyDiamondArrowMetrics("legacy-open-diamond", lineWidth);

  assert.equal(filled.open, false);
  assert.equal(open.open, true);
  assert.ok(Math.abs(filled.unit / unitsPerPt - 0.62) < 1e-9);
  assert.ok(Math.abs(filled.frontX / unitsPerPt - 0.62) < 1e-9);
  assert.ok(Math.abs(filled.middleX / unitsPerPt + 3.72) < 1e-9);
  assert.ok(Math.abs(filled.backX / unitsPerPt + 8.06) < 1e-9);
  assert.ok(Math.abs(filled.halfHeight / unitsPerPt - 2.48) < 1e-9);
  assert.ok(Math.abs(filled.backEnd / unitsPerPt + 8.46) < 1e-9);
  assert.ok(Math.abs(filled.tipEnd / unitsPerPt - 1.02) < 1e-9);

  assert.equal(open.backX, 0);
  assert.ok(Math.abs(open.middleX / unitsPerPt - 4.34) < 1e-9);
  assert.ok(Math.abs(open.frontX / unitsPerPt - 8.68) < 1e-9);
  assert.ok(Math.abs(open.backEnd / unitsPerPt + 0.4) < 1e-9);
  assert.ok(Math.abs(open.tipEnd / unitsPerPt - 9.08) < 1e-9);
  assert.ok(Math.abs(open.assemblyLength / unitsPerPt - 9.48) < 1e-9);
});

test("renders filled and open diamonds with PGF paint and join semantics", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(0.8) };
  const filled = resolveInlineArrowTip("diamond", style);
  const open = resolveInlineArrowTip("open diamond", style);

  assert.equal(filled.fill, "#2457a6");
  assert.equal(filled.stroke, "#2457a6");
  assert.equal(filled.strokeWidth, style.lineWidth);
  assert.equal(open.fill, "none");
  assert.equal(open.stroke, "#2457a6");
  assert.equal(open.strokeWidth, style.lineWidth);
  assert.equal(filled.lineCap, "butt");
  assert.equal(open.lineCap, "butt");
  assert.equal(filled.lineJoin, "round");
  assert.equal(open.lineJoin, "round");
  assert.match(filled.geometry.path, /^M .* L .* L .* L .* Z$/u);
  assert.ok(open.geometry.bounds.maxX > 0);
  assert.ok(filled.geometry.bounds.minX < 0);
});
