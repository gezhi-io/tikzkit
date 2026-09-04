import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import { spacedAngleArrowMetrics } from "../src/tikz/libraries/arrows.spaced.js";
import { legacyDelimiterArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.spaced}
\begin{tikzpicture}
  \draw[-{spaced angle 90}] (0,0) -- (2,0);
  \draw[-{spaced angle 90 reversed}] (0,1) -- (2,1);
  \draw[-{spaced angle 60}] (0,2) -- (2,2);
  \draw[-{spaced angle 60 reversed}] (0,3) -- (2,3);
  \draw[-{spaced angle 45}] (0,4) -- (2,4);
  \draw[{spaced angle 45 reversed}-{spaced angle 45}] (0,5) -- (2,5);
\end{tikzpicture}`;

const UNITS_PER_PT = lineWidthFromPt(1);
const inPt = (value) => value / UNITS_PER_PT;

test("parses all source-declared spaced angle aliases", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.map((item) => item.style.markerEnd.kind), [
    "legacy-spaced-angle-90",
    "legacy-spaced-angle-90-reversed",
    "legacy-spaced-angle-60",
    "legacy-spaced-angle-60-reversed",
    "legacy-spaced-angle-45",
    "legacy-spaced-angle-45"
  ]);
  assert.equal(paths.at(-1).style.markerStart.kind, "legacy-spaced-angle-45-reversed");
});

test("composes each angle with the PGF space arrow at the active line width", () => {
  const lineWidth = lineWidthFromPt(1.2);
  const expectedSpacePt = 0.88 + 0.3 * 1.2;

  for (const angle of [90, 60, 45]) {
    for (const reversed of [false, true]) {
      const suffix = `angle-${angle}${reversed ? "-reversed" : ""}`;
      const base = legacyDelimiterArrowMetrics(suffix, lineWidth);
      const spaced = spacedAngleArrowMetrics(`legacy-spaced-${suffix}`, lineWidth);

      assert.equal(spaced.shape, suffix.replace(/-reversed$/u, ""));
      assert.equal(spaced.reversed, reversed);
      assert.equal(spaced.angle, angle);
      assert.ok(Math.abs(inPt(spaced.space) - expectedSpacePt) < 1e-9);
      assert.ok(Math.abs(spaced.placement - (base.placement + spaced.space)) < 1e-9);
      assert.ok(Math.abs(spaced.terminalPlacement - (base.placement + spaced.space)) < 1e-9);
      assert.ok(Math.abs(spaced.assemblyLength - (base.assemblyLength + spaced.space)) < 1e-9);
      assert.equal(spaced.backX, base.backX);
      assert.equal(spaced.tipX, base.tipX);
      assert.equal(spaced.halfHeight, base.halfHeight);
    }
  }
});

test("keeps spaced angles stroke-only with source cap and join semantics", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(1.2) };
  const angle90 = resolveInlineArrowTip("spaced angle 90", style);
  const angle60 = resolveInlineArrowTip("spaced angle 60", style);
  const angle45 = resolveInlineArrowTip("spaced angle 45", style);
  const reversed = resolveInlineArrowTip("spaced angle 60 reversed", style);

  assert.equal(angle60.fill, "none");
  assert.equal(angle60.stroke, style.stroke);
  assert.equal(angle60.lineCap, "round");
  assert.equal(angle60.lineJoin, "miter");
  assert.ok(angle90.geometry.bounds.maxY > angle60.geometry.bounds.maxY);
  assert.ok(angle60.geometry.bounds.maxY > angle45.geometry.bounds.maxY);
  assert.ok(reversed.geometry.bounds.maxX > 0);
  assert.ok(angle60.geometry.shorten > legacyDelimiterArrowMetrics("angle-60", style.lineWidth).placement);
  assert.match(angle60.geometry.path, / L /u);
});
