import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows}
\begin{tikzpicture}
  \draw[-{square bracket}] (0,0) -- (2,0);
  \draw[-{(}] (0,1) -- (2,1);
  \draw[-{)}] (0,2) -- (2,2);
  \draw[-{angle 90}] (0,3) -- (2,3);
  \draw[-{angle 60}] (0,4) -- (2,4);
  \draw[-{angle 45}] (0,5) -- (2,5);
  \draw[-{angle 60 reversed}] (0,6) -- (2,6);
\end{tikzpicture}`;

test("parses legacy bracket-like and angle arrow-tip names without aliases", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const kinds = result.ir.items
    .filter((item) => item.type === "path" && item.style.markerEnd)
    .map((item) => item.style.markerEnd.kind);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(kinds, [
    "square-bracket",
    "round-bracket-reversed",
    "round-bracket",
    "angle-90",
    "angle-60",
    "angle-45",
    "angle-60-reversed"
  ]);
});

test("derives delimiter-tip geometry from the active path line width", () => {
  const thin = resolveInlineArrowTip("square bracket", { lineWidth: lineWidthFromPt(0.4) });
  const thick = resolveInlineArrowTip("square bracket", { lineWidth: lineWidthFromPt(1.2) });
  const leftSquare = resolveInlineArrowTip("[", { lineWidth: lineWidthFromPt(0.8) });
  const rightSquare = resolveInlineArrowTip("]", { lineWidth: lineWidthFromPt(0.8) });
  const round = resolveInlineArrowTip("(", { lineWidth: lineWidthFromPt(0.8) });

  assert.equal(thin.kind, "square-bracket");
  assert.equal(thick.kind, "square-bracket");
  assert.ok(thick.geometry.bounds.maxY > thin.geometry.bounds.maxY);
  assert.ok(thick.geometry.shorten > thin.geometry.shorten);
  assert.match(thick.geometry.path, /^M .* L 0 .* L 0 .* L /u);
  assert.equal(leftSquare.kind, "square-bracket");
  assert.equal(rightSquare.kind, "square-bracket-reversed");
  assert.ok(rightSquare.geometry.bounds.maxX > Math.abs(rightSquare.geometry.bounds.minX));

  assert.equal(round.kind, "round-bracket-reversed");
  assert.match(round.geometry.path, /^M .* C /u);
  assert.equal(round.lineCap, "round");
  assert.equal(round.fill, "none");
});

test("keeps legacy angle aperture and reversed direction distinct in SVG geometry", () => {
  const style = { lineWidth: lineWidthFromPt(0.8) };
  const angle90 = resolveInlineArrowTip("angle 90", style);
  const angle60 = resolveInlineArrowTip("angle 60", style);
  const angle45 = resolveInlineArrowTip("angle 45", style);
  const reversed = resolveInlineArrowTip("angle 60 reversed", style);

  assert.ok(angle90.geometry.bounds.maxY > angle60.geometry.bounds.maxY);
  assert.ok(angle60.geometry.bounds.maxY > angle45.geometry.bounds.maxY);
  assert.ok(angle45.geometry.bounds.minX < angle60.geometry.bounds.minX);
  assert.ok(angle60.geometry.bounds.minX < angle90.geometry.bounds.minX);
  assert.ok(angle60.geometry.bounds.minX < 0);
  assert.ok(angle60.geometry.bounds.maxX > 0);
  assert.ok(reversed.geometry.bounds.maxX > Math.abs(reversed.geometry.bounds.minX));
  assert.ok(Math.abs(reversed.geometry.bounds.maxX + angle60.geometry.bounds.minX) < 1e-9);
  assert.equal(angle60.fill, "none");
  assert.equal(reversed.fill, "none");
});
