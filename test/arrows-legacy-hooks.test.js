import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { legacyHookArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.meta}
\begin{tikzpicture}[line width=.8pt]
  \draw[-{left hook}] (0,0) -- (2,0);
  \draw[-{left hook reversed}] (0,1) -- (2,1);
  \draw[-{right hook}] (0,2) -- (2,2);
  \draw[-{right hook reversed}] (0,3) -- (2,3);
  \draw[-{hooks}] (0,4) -- (2,4);
  \draw[-{hooks reversed}] (0,5) -- (2,5);
  \draw[-{Hook}] (0,6) -- (2,6);
  \draw[{left hook}-{right hook reversed}] (0,7) -- (2,7);
\end{tikzpicture}`;

test("distinguishes all legacy hook declarations from arrows.meta Hook", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.slice(0, 7).map((path) => path.style.markerEnd.kind), [
    "legacy-left-hook",
    "legacy-left-hook-reversed",
    "legacy-right-hook",
    "legacy-right-hook-reversed",
    "legacy-hooks",
    "legacy-hooks-reversed",
    "hook"
  ]);
  assert.equal(paths[7].style.markerStart.kind, "legacy-left-hook");
  assert.equal(paths[7].style.markerEnd.kind, "legacy-right-hook-reversed");
  assert.equal([...result.svg.matchAll(/class="tikz-arrow-tip tikz-arrow-legacy-/g)].length, 8);
  assert.match(result.svg, /tikz-arrow-legacy-left-hook-reversed/);
  assert.match(result.svg, /tikz-arrow-legacy-right-hook-reversed/);
  assert.match(result.svg, /tikz-arrow-legacy-hooks-reversed/);
});

test("uses installed PGF dimensions for legacy hooks", () => {
  const lineWidth = lineWidthFromPt(0.8);
  const unitsPerPt = lineWidthFromPt(1);
  const left = legacyHookArrowMetrics("legacy-left-hook", lineWidth);
  const right = legacyHookArrowMetrics("legacy-right-hook", lineWidth);
  const reversed = legacyHookArrowMetrics("legacy-left-hook-reversed", lineWidth);
  const hooks = legacyHookArrowMetrics("legacy-hooks", lineWidth);

  assert.ok(Math.abs(left.unit / unitsPerPt - 0.56) < 1e-9);
  assert.ok(Math.abs(left.backEnd / unitsPerPt + 0.4) < 1e-9);
  assert.ok(Math.abs(left.tipEnd / unitsPerPt - 2.5) < 1e-9);
  assert.ok(Math.abs(left.placement / unitsPerPt - 2.5) < 1e-9);
  assert.ok(Math.abs(left.assemblyLength / unitsPerPt - 2.9) < 1e-9);
  assert.ok(Math.abs(left.maxX / unitsPerPt - 2.1) < 1e-9);
  assert.ok(Math.abs(left.maxY / unitsPerPt - 3.36) < 1e-9);
  assert.equal(left.side, "left");
  assert.equal(right.side, "right");
  assert.equal(hooks.side, "both");
  assert.equal(reversed.reversed, true);
  assert.ok(Math.abs(reversed.placement / unitsPerPt - 0.4) < 1e-9);
  assert.ok(reversed.minX < 0);
  assert.equal(reversed.maxX, 0);
});

test("renders source-derived hook curves and open-tip paint", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(0.8) };
  const left = resolveInlineArrowTip("left hook", style);
  const right = resolveInlineArrowTip("right hook", style);
  const reversed = resolveInlineArrowTip("hooks reversed", style);

  for (const tip of [left, right, reversed]) {
    assert.equal(tip.fill, "none");
    assert.equal(tip.stroke, "#2457a6");
    assert.equal(tip.strokeWidth, style.lineWidth);
    assert.equal(tip.lineCap, "round");
    assert.equal(tip.lineJoin, "miter");
    assert.match(tip.geometry.path, /C/);
  }
  assert.ok(left.geometry.bounds.minY < 0);
  assert.ok(Math.abs(left.geometry.bounds.maxY) < 1e-9);
  assert.ok(Math.abs(right.geometry.bounds.minY) < 1e-9);
  assert.ok(right.geometry.bounds.maxY > 0);
  assert.ok(reversed.geometry.bounds.minX < 0);
  assert.ok(Math.abs(reversed.geometry.bounds.maxX) < 1e-9);
  assert.ok(reversed.geometry.bounds.minY < 0);
  assert.ok(reversed.geometry.bounds.maxY > 0);
});
