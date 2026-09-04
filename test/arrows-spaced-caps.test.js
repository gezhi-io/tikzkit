import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { legacySpacedArrowSpace, spacedCapArrowMetrics } from "../src/tikz/libraries/arrows.spaced.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.spaced}
\begin{tikzpicture}[line width=2pt]
  \draw[-{spaced round cap}] (0,0) -- (2,0);
  \draw[-{spaced butt cap}] (0,1) -- (2,1);
  \draw[-{spaced triangle 90 cap}] (0,2) -- (2,2);
  \draw[-{spaced triangle 90 cap reversed}] (0,3) -- (2,3);
  \draw[-{spaced fast cap}] (0,4) -- (2,4);
  \draw[-{spaced fast cap reversed}] (0,5) -- (2,5);
  \draw[{spaced round cap}-{spaced fast cap reversed}] (0,6) -- (2,6);
\end{tikzpicture}`;

test("parses all six spaced cap aliases as a distinct legacy family", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.slice(0, 6).map((path) => path.style.markerEnd.kind), [
    "legacy-spaced-round-cap",
    "legacy-spaced-butt-cap",
    "legacy-spaced-triangle-90-cap",
    "legacy-spaced-triangle-90-cap-reversed",
    "legacy-spaced-fast-cap",
    "legacy-spaced-fast-cap-reversed"
  ]);
  assert.equal(paths[6].style.markerStart.kind, "legacy-spaced-round-cap");
  assert.equal(paths[6].style.markerEnd.kind, "legacy-spaced-fast-cap-reversed");
});

test("derives the arrows.spaced gap from 0.88pt plus 0.3 line widths", () => {
  const lineWidth = lineWidthFromPt(2);
  const unitsPerPt = lineWidthFromPt(1);
  const space = legacySpacedArrowSpace(lineWidth);
  const round = spacedCapArrowMetrics("legacy-spaced-round-cap", lineWidth);
  const fast = spacedCapArrowMetrics("legacy-spaced-fast-cap", lineWidth);

  assert.ok(Math.abs(space / unitsPerPt - 1.48) < 1e-9);
  assert.ok(Math.abs(round.space / unitsPerPt - 1.48) < 1e-9);
  assert.ok(Math.abs(round.placement / unitsPerPt - 3.48) < 1e-9);
  assert.ok(Math.abs(round.assemblyLength / unitsPerPt - 3.48) < 1e-9);
  assert.ok(Math.abs(fast.placement / unitsPerPt - 5.48) < 1e-9);
  assert.ok(Math.abs(fast.assemblyLength / unitsPerPt - 5.68) < 1e-9);
});

test("reuses cap paint paths while shifting spaced terminals away from endpoints", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(2) };
  const space = legacySpacedArrowSpace(style.lineWidth);

  for (const name of ["round cap", "butt cap", "triangle 90 cap", "triangle 90 cap reversed", "fast cap", "fast cap reversed"]) {
    const plain = resolveInlineArrowTip(name, style);
    const spaced = resolveInlineArrowTip(`spaced ${name}`, style);
    assert.equal(spaced.geometry.path, plain.geometry.path);
    assert.ok(Math.abs(spaced.geometry.placement - plain.geometry.placement - space) < 1e-9);
    assert.equal(spaced.fill, plain.fill);
    assert.equal(spaced.stroke, plain.stroke);
    assert.equal(spaced.lineCap, plain.lineCap);
  }
});
