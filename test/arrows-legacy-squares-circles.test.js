import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import {
  legacyCircleArrowMetrics,
  legacySquareArrowMetrics
} from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.meta}
\begin{tikzpicture}[line width=.8pt]
  \draw[-square] (0,0) -- (2,0);
  \draw[-{open square}] (0,1) -- (2,1);
  \draw[-*] (0,2) -- (2,2);
  \draw[-o] (0,3) -- (2,3);
  \draw[{open square}-{square}] (0,4) -- (2,4);
  \draw[{o}-{*}] (0,5) -- (2,5);
  \draw[-{Square}] (0,6) -- (2,6);
\end{tikzpicture}`;

test("distinguishes legacy square and dot names from arrows.meta names", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && (item.style.markerStart || item.style.markerEnd));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths[0].style.markerEnd.kind, "legacy-square");
  assert.equal(paths[1].style.markerEnd.kind, "legacy-open-square");
  assert.equal(paths[2].style.markerEnd.kind, "legacy-filled-circle");
  assert.equal(paths[3].style.markerEnd.kind, "legacy-open-circle");
  assert.equal(paths[4].style.markerStart.kind, "legacy-open-square");
  assert.equal(paths[4].style.markerEnd.kind, "legacy-square");
  assert.equal(paths[5].style.markerStart.kind, "legacy-open-circle");
  assert.equal(paths[5].style.markerEnd.kind, "legacy-filled-circle");
  assert.equal(paths[6].style.markerEnd.kind, "square");
  assert.equal(paths[6].style.markerEnd.meta, true);
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-square"/);
  assert.doesNotMatch(result.svg, /tikz-arrow-legacy-square[^>]+translate\([^)]* 600\)/);
});

test("uses installed PGF formulas for legacy square tips", () => {
  const lineWidth = lineWidthFromPt(0.8);
  const unitsPerPt = lineWidthFromPt(1);
  const filled = legacySquareArrowMetrics("legacy-square", lineWidth);
  const open = legacySquareArrowMetrics("legacy-open-square", lineWidth);

  assert.equal(filled.open, false);
  assert.equal(open.open, true);
  assert.ok(Math.abs(filled.unit / unitsPerPt - 0.62) < 1e-9);
  assert.ok(Math.abs(filled.backX / unitsPerPt + 4.34) < 1e-9);
  assert.ok(Math.abs(filled.frontX / unitsPerPt - 0.62) < 1e-9);
  assert.ok(Math.abs(filled.halfHeight / unitsPerPt - 2.48) < 1e-9);
  assert.ok(Math.abs(filled.backEnd / unitsPerPt + 4.74) < 1e-9);
  assert.ok(Math.abs(filled.tipEnd / unitsPerPt - 1.02) < 1e-9);
  assert.ok(Math.abs(open.backX) < 1e-9);
  assert.ok(Math.abs(open.frontX / unitsPerPt - 4.96) < 1e-9);
  assert.ok(Math.abs(open.backEnd / unitsPerPt + 0.4) < 1e-9);
  assert.ok(Math.abs(open.tipEnd / unitsPerPt - 5.36) < 1e-9);
  assert.ok(Math.abs(open.assemblyLength / unitsPerPt - 5.76) < 1e-9);
});

test("uses installed PGF formulas for legacy filled and open dots", () => {
  const lineWidth = lineWidthFromPt(0.8);
  const unitsPerPt = lineWidthFromPt(1);
  const filled = legacyCircleArrowMetrics("legacy-filled-circle", lineWidth);
  const open = legacyCircleArrowMetrics("legacy-open-circle", lineWidth);

  assert.equal(filled.open, false);
  assert.equal(open.open, true);
  assert.ok(Math.abs(filled.unit / unitsPerPt - 0.56) < 1e-9);
  assert.ok(Math.abs(filled.centerX / unitsPerPt + 1.68) < 1e-9);
  assert.ok(Math.abs(filled.radius / unitsPerPt - 2.52) < 1e-9);
  assert.ok(Math.abs(filled.backEnd / unitsPerPt + 4.6) < 1e-9);
  assert.ok(Math.abs(filled.tipEnd / unitsPerPt - 1.24) < 1e-9);
  assert.ok(Math.abs(open.centerX / unitsPerPt - 2.52) < 1e-9);
  assert.ok(Math.abs(open.radius / unitsPerPt - 2.52) < 1e-9);
  assert.ok(Math.abs(open.backEnd / unitsPerPt + 0.4) < 1e-9);
  assert.ok(Math.abs(open.tipEnd / unitsPerPt - 5.44) < 1e-9);
  assert.ok(Math.abs(open.assemblyLength / unitsPerPt - 5.84) < 1e-9);
});

test("renders legacy square and dot paint semantics from the active path", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(0.8) };
  const square = resolveInlineArrowTip("square", style);
  const openSquare = resolveInlineArrowTip("open square", style);
  const dot = resolveInlineArrowTip("*", style);
  const openDot = resolveInlineArrowTip("o", style);

  for (const filled of [square, dot]) {
    assert.equal(filled.fill, "#2457a6");
    assert.equal(filled.stroke, "#2457a6");
    assert.equal(filled.strokeWidth, style.lineWidth);
  }
  for (const open of [openSquare, openDot]) {
    assert.equal(open.fill, "none");
    assert.equal(open.stroke, "#2457a6");
    assert.equal(open.strokeWidth, style.lineWidth);
  }
  assert.equal(square.lineCap, "butt");
  assert.equal(openSquare.lineCap, "butt");
  assert.equal(square.lineJoin, "round");
  assert.equal(openSquare.lineJoin, "round");
  assert.equal(dot.lineCap, "butt");
  assert.equal(openDot.lineCap, "butt");
  assert.equal(dot.lineJoin, "miter");
  assert.equal(openDot.lineJoin, "miter");
  assert.ok(square.geometry.bounds.minX < 0);
  assert.ok(openSquare.geometry.bounds.minX === 0);
  assert.ok(dot.geometry.centerX < 0);
  assert.ok(openDot.geometry.centerX > 0);
});
