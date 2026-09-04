import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { legacyTriangleArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows}
\begin{tikzpicture}
  \draw[-triangle 90] (0,0) -- (2,0);
  \draw[-{triangle 60 reversed}] (0,1) -- (2,1);
  \draw[-{triangle 45}] (0,2) -- (2,2);
  \draw[-{open triangle 90}] (0,3) -- (2,3);
  \draw[-{open triangle 60 reversed}] (0,4) -- (2,4);
  \draw[-{open triangle 45}] (0,5) -- (2,5);
  \draw[triangle 90 reversed-triangle 90] (0,6) -- (2,6);
\end{tikzpicture}`;

test("parses numbered legacy triangle and open-triangle tip names", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const kinds = result.ir.items
    .filter((item) => item.type === "path" && item.style.markerEnd)
    .map((item) => item.style.markerEnd.kind);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(kinds, [
    "triangle-90",
    "triangle-60-reversed",
    "triangle-45",
    "open-triangle-90",
    "open-triangle-60-reversed",
    "open-triangle-45",
    "triangle-90"
  ]);
  assert.equal(result.ir.items.at(-1).style.markerStart.kind, "triangle-90-reversed");
});

test("uses the installed PGF line-width formulas for filled legacy triangles", () => {
  const lineWidth = lineWidthFromPt(0.8);
  const unitsPerPt = lineWidthFromPt(1);
  const triangle90 = legacyTriangleArrowMetrics("triangle-90", lineWidth);
  const triangle60 = legacyTriangleArrowMetrics("triangle-60", lineWidth);
  const triangle45 = legacyTriangleArrowMetrics("triangle-45", lineWidth);

  assert.equal(triangle90.open, false);
  assert.equal(triangle90.reversed, false);
  assert.ok(Math.abs(triangle90.unit / unitsPerPt - 0.7) < 1e-9);
  assert.ok(Math.abs(triangle90.backX / unitsPerPt + 3.85) < 1e-9);
  assert.ok(Math.abs(triangle90.tipX / unitsPerPt - 0.35) < 1e-9);
  assert.ok(Math.abs(triangle90.halfHeight / unitsPerPt - 4.2) < 1e-9);
  assert.ok(Math.abs(triangle90.backEnd / unitsPerPt + 4.25) < 1e-9);
  assert.ok(Math.abs(triangle90.tipEnd / unitsPerPt - (0.35 + 0.707 * 0.8)) < 1e-9);

  assert.ok(Math.abs(triangle60.backX / unitsPerPt + (9 * Math.cos(Math.PI / 6) - 0.5) * 0.7) < 1e-9);
  assert.ok(Math.abs(triangle60.halfHeight / unitsPerPt - 3.15) < 1e-9);
  assert.ok(Math.abs(triangle60.backEnd / unitsPerPt + (7.29 * 0.7 + 0.4)) < 1e-9);
  assert.ok(Math.abs(triangle60.tipEnd / unitsPerPt - (0.35 + 0.8)) < 1e-9);

  assert.ok(Math.abs(triangle45.backX / unitsPerPt + (10 * Math.cos((23 * Math.PI) / 180) - 0.5) * 0.7) < 1e-9);
  assert.ok(Math.abs(triangle45.halfHeight / unitsPerPt - 10 * Math.sin((23 * Math.PI) / 180) * 0.7) < 1e-9);
  assert.ok(Math.abs(triangle45.backEnd / unitsPerPt + (8.705 * 0.7 + 0.4)) < 1e-9);
  assert.ok(Math.abs(triangle45.tipEnd / unitsPerPt - (0.35 + 1.28 * 0.8)) < 1e-9);
});

test("keeps open reversed triangles as independent PGF declarations", () => {
  const lineWidth = lineWidthFromPt(0.8);
  const unitsPerPt = lineWidthFromPt(1);
  const forward = legacyTriangleArrowMetrics("open-triangle-60", lineWidth);
  const reversed = legacyTriangleArrowMetrics("open-triangle-60-reversed", lineWidth);

  assert.equal(forward.open, true);
  assert.equal(reversed.open, true);
  assert.equal(forward.reversed, false);
  assert.equal(reversed.reversed, true);
  assert.equal(forward.backX, 0);
  assert.equal(reversed.tipX, 0);
  assert.ok(Math.abs(forward.tipX / unitsPerPt - 5.4558) < 1e-6);
  assert.equal(reversed.backX, forward.tipX);
  assert.notEqual(reversed.backEnd, -forward.tipEnd);
  assert.ok(reversed.placement > forward.placement - lineWidthFromPt(0.5));

  for (const [angle, lengthFactor, backendFactor] of [[90, 6, 0.707], [60, 7.794, 1], [45, 9.205, 1.28]]) {
    const normal = legacyTriangleArrowMetrics(`open-triangle-${angle}`, lineWidth);
    const reverse = legacyTriangleArrowMetrics(`open-triangle-${angle}-reversed`, lineWidth);
    assert.ok(Math.abs(normal.tipX / unitsPerPt - lengthFactor * 0.7) < 1e-9);
    assert.ok(Math.abs(normal.backEnd / unitsPerPt + 0.4) < 1e-9);
    assert.ok(Math.abs(reverse.backEnd / unitsPerPt + backendFactor * 0.8) < 1e-9);
    assert.ok(Math.abs(reverse.tipEnd / unitsPerPt - (lengthFactor * 0.7 + 0.4)) < 1e-9);
  }
});

test("renders filled and open legacy triangles with source paint semantics", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(0.8) };
  const filled = resolveInlineArrowTip("triangle 90", style);
  const open = resolveInlineArrowTip("open triangle 90", style);
  const reversed = resolveInlineArrowTip("triangle 90 reversed", style);

  assert.equal(filled.fill, "#2457a6");
  assert.equal(filled.stroke, "#2457a6");
  assert.equal(filled.strokeWidth, style.lineWidth);
  assert.equal(filled.lineCap, "butt");
  assert.equal(filled.lineJoin, "miter");
  assert.match(filled.geometry.path, /^M .* L .* 0 L .* Z$/u);

  assert.equal(open.fill, "none");
  assert.equal(open.stroke, "#2457a6");
  assert.equal(open.strokeWidth, style.lineWidth);
  assert.ok(reversed.geometry.bounds.maxX > Math.abs(reversed.geometry.bounds.minX));
});
