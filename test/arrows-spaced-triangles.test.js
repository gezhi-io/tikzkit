import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import { spacedTriangleArrowMetrics } from "../src/tikz/libraries/arrows.spaced.js";
import { legacyTriangleArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.spaced}
\begin{tikzpicture}
  \draw[-{spaced triangle 90}] (0,0) -- (2,0);
  \draw[-{spaced triangle 90 reversed}] (0,1) -- (2,1);
  \draw[-{spaced triangle 60}] (0,2) -- (2,2);
  \draw[-{spaced triangle 60 reversed}] (0,3) -- (2,3);
  \draw[-{spaced triangle 45}] (0,4) -- (2,4);
  \draw[-{spaced triangle 45 reversed}] (0,5) -- (2,5);
  \draw[-{spaced open triangle 90}] (0,6) -- (2,6);
  \draw[-{spaced open triangle 90 reversed}] (0,7) -- (2,7);
  \draw[-{spaced open triangle 60}] (0,8) -- (2,8);
  \draw[-{spaced open triangle 60 reversed}] (0,9) -- (2,9);
  \draw[-{spaced open triangle 45}] (0,10) -- (2,10);
  \draw[{spaced open triangle 45 reversed}-{spaced open triangle 45}] (0,11) -- (2,11);
\end{tikzpicture}`;

const UNITS_PER_PT = lineWidthFromPt(1);
const inPt = (value) => value / UNITS_PER_PT;

test("parses all source-declared spaced triangle aliases", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.map((item) => item.style.markerEnd.kind), [
    "legacy-spaced-triangle-90",
    "legacy-spaced-triangle-90-reversed",
    "legacy-spaced-triangle-60",
    "legacy-spaced-triangle-60-reversed",
    "legacy-spaced-triangle-45",
    "legacy-spaced-triangle-45-reversed",
    "legacy-spaced-open-triangle-90",
    "legacy-spaced-open-triangle-90-reversed",
    "legacy-spaced-open-triangle-60",
    "legacy-spaced-open-triangle-60-reversed",
    "legacy-spaced-open-triangle-45",
    "legacy-spaced-open-triangle-45"
  ]);
  assert.equal(paths.at(-1).style.markerStart.kind, "legacy-spaced-open-triangle-45-reversed");
});

test("composes each triangle with the PGF space arrow at the active line width", () => {
  const lineWidth = lineWidthFromPt(0.8);
  const expectedSpacePt = 0.88 + 0.3 * 0.8;

  for (const open of [false, true]) {
    for (const angle of [90, 60, 45]) {
      for (const reversed of [false, true]) {
        const suffix = `${open ? "open-" : ""}triangle-${angle}${reversed ? "-reversed" : ""}`;
        const base = legacyTriangleArrowMetrics(suffix, lineWidth);
        const spaced = spacedTriangleArrowMetrics(`legacy-spaced-${suffix}`, lineWidth);

        assert.equal(spaced.open, open);
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
  }
});

test("keeps spaced filled and open triangles on the source paint path", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(0.8) };
  const filled = resolveInlineArrowTip("spaced triangle 60", style);
  const open = resolveInlineArrowTip("spaced open triangle 60", style);
  const reversed = resolveInlineArrowTip("spaced triangle 60 reversed", style);

  assert.equal(filled.fill, style.stroke);
  assert.equal(filled.stroke, style.stroke);
  assert.equal(open.fill, "none");
  assert.equal(open.stroke, style.stroke);
  assert.equal(reversed.fill, style.stroke);
  assert.equal(filled.lineCap, "butt");
  assert.equal(filled.lineJoin, "miter");
  assert.ok(filled.geometry.shorten > legacyTriangleArrowMetrics("triangle-60", style.lineWidth).placement);
  assert.match(filled.geometry.path, / L /);
});
