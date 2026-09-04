import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import { spacedHookArrowMetrics } from "../src/tikz/libraries/arrows.spaced.js";
import { legacyHookArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.spaced}
\begin{tikzpicture}
  \draw[-{spaced left hook}] (0,0) -- (2,0);
  \draw[-{spaced left hook reversed}] (0,1) -- (2,1);
  \draw[-{spaced right hook}] (0,2) -- (2,2);
  \draw[-{spaced right hook reversed}] (0,3) -- (2,3);
  \draw[-{spaced hooks}] (0,4) -- (2,4);
  \draw[{spaced hooks reversed}-{spaced hooks}] (0,5) -- (2,5);
\end{tikzpicture}`;

const UNITS_PER_PT = lineWidthFromPt(1);
const inPt = (value) => value / UNITS_PER_PT;

test("parses all source-declared spaced hook aliases", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.map((item) => item.style.markerEnd.kind), [
    "legacy-spaced-left-hook",
    "legacy-spaced-left-hook-reversed",
    "legacy-spaced-right-hook",
    "legacy-spaced-right-hook-reversed",
    "legacy-spaced-hooks",
    "legacy-spaced-hooks"
  ]);
  assert.equal(paths.at(-1).style.markerStart.kind, "legacy-spaced-hooks-reversed");
});

test("composes each hook with the PGF space arrow at the active line width", () => {
  const lineWidth = lineWidthFromPt(1.2);
  const expectedSpacePt = 0.88 + 0.3 * 1.2;

  for (const family of ["left-hook", "right-hook", "hooks"]) {
    for (const reversed of [false, true]) {
      const suffix = `${family}${reversed ? "-reversed" : ""}`;
      const base = legacyHookArrowMetrics(`legacy-${suffix}`, lineWidth);
      const spaced = spacedHookArrowMetrics(`legacy-spaced-${suffix}`, lineWidth);

      assert.equal(spaced.side, base.side);
      assert.equal(spaced.reversed, reversed);
      assert.ok(Math.abs(inPt(spaced.space) - expectedSpacePt) < 1e-9);
      assert.ok(Math.abs(spaced.placement - (base.placement + spaced.space)) < 1e-9);
      assert.ok(Math.abs(spaced.terminalPlacement - (base.placement + spaced.space)) < 1e-9);
      assert.ok(Math.abs(spaced.assemblyLength - (base.assemblyLength + spaced.space)) < 1e-9);
      assert.equal(spaced.unit, base.unit);
      assert.equal(spaced.minX, base.minX);
      assert.equal(spaced.maxX, base.maxX);
      assert.equal(spaced.minY, base.minY);
      assert.equal(spaced.maxY, base.maxY);
    }
  }
});

test("keeps spaced hooks stroke-only with source cubic, cap, and join semantics", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(1.2) };
  const left = resolveInlineArrowTip("spaced left hook", style);
  const right = resolveInlineArrowTip("spaced right hook", style);
  const both = resolveInlineArrowTip("spaced hooks", style);
  const reversed = resolveInlineArrowTip("spaced hooks reversed", style);

  for (const tip of [left, right, both, reversed]) {
    assert.equal(tip.fill, "none");
    assert.equal(tip.stroke, style.stroke);
    assert.equal(tip.lineCap, "round");
    assert.equal(tip.lineJoin, "miter");
    assert.match(tip.geometry.path, /C/u);
  }
  assert.ok(left.geometry.bounds.minY < 0);
  assert.ok(Math.abs(left.geometry.bounds.maxY) < 1e-9);
  assert.ok(Math.abs(right.geometry.bounds.minY) < 1e-9);
  assert.ok(right.geometry.bounds.maxY > 0);
  assert.ok(reversed.geometry.bounds.minX < 0);
  assert.ok(both.geometry.shorten > legacyHookArrowMetrics("legacy-hooks", style.lineWidth).placement);
});
