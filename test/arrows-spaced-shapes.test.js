import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import {
  legacyCircleArrowMetrics,
  legacyDiamondArrowMetrics,
  legacySquareArrowMetrics
} from "../src/tikz/libraries/arrows.js";
import { spacedShapeArrowMetrics } from "../src/tikz/libraries/arrows.spaced.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.spaced}
\begin{tikzpicture}[line width=1.2pt]
  \draw[-{spaced o}] (0,0) -- (2,0);
  \draw[-{spaced *}] (0,1) -- (2,1);
  \draw[-{spaced diamond}] (0,2) -- (2,2);
  \draw[-{spaced open diamond}] (0,3) -- (2,3);
  \draw[-{spaced square}] (0,4) -- (2,4);
  \draw[{spaced open square}-{spaced diamond}] (0,5) -- (2,5);
\end{tikzpicture}`;

const UNITS_PER_PT = lineWidthFromPt(1);
const inPt = (value) => value / UNITS_PER_PT;

test("parses all source-declared spaced geometric arrow aliases", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.map((item) => item.style.markerEnd.kind), [
    "legacy-spaced-open-circle",
    "legacy-spaced-filled-circle",
    "legacy-spaced-diamond",
    "legacy-spaced-open-diamond",
    "legacy-spaced-square",
    "legacy-spaced-diamond"
  ]);
  assert.equal(paths.at(-1).style.markerStart.kind, "legacy-spaced-open-square");
});

test("adds only the source space component to geometric-arrow placement", () => {
  const lineWidth = lineWidthFromPt(1.2);
  const expectedSpacePt = 0.88 + 0.3 * 1.2;
  const families = [
    ["legacy-open-circle", legacyCircleArrowMetrics],
    ["legacy-filled-circle", legacyCircleArrowMetrics],
    ["legacy-diamond", legacyDiamondArrowMetrics],
    ["legacy-open-diamond", legacyDiamondArrowMetrics],
    ["legacy-square", legacySquareArrowMetrics],
    ["legacy-open-square", legacySquareArrowMetrics]
  ];

  for (const [baseKind, baseMetrics] of families) {
    const base = baseMetrics(baseKind, lineWidth);
    const spaced = spacedShapeArrowMetrics(baseKind.replace("legacy-", "legacy-spaced-"), lineWidth);

    assert.ok(Math.abs(inPt(spaced.space) - expectedSpacePt) < 1e-9);
    assert.ok(Math.abs(spaced.placement - (base.placement + spaced.space)) < 1e-9);
    assert.ok(Math.abs(spaced.terminalPlacement - (base.placement + spaced.space)) < 1e-9);
    assert.ok(Math.abs(spaced.assemblyLength - (base.assemblyLength + spaced.space)) < 1e-9);
    for (const key of ["shape", "open", "unit", "backEnd", "tipEnd", "backX", "middleX", "frontX", "halfHeight", "centerX", "radius"]) {
      if (base[key] !== undefined) assert.equal(spaced[key], base[key]);
    }
  }
});

test("retains PGF fill, stroke, cap, and join semantics for spaced shapes", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(1.2) };
  const filled = [
    resolveInlineArrowTip("spaced *", style),
    resolveInlineArrowTip("spaced diamond", style),
    resolveInlineArrowTip("spaced square", style)
  ];
  const open = [
    resolveInlineArrowTip("spaced o", style),
    resolveInlineArrowTip("spaced open diamond", style),
    resolveInlineArrowTip("spaced open square", style)
  ];

  for (const tip of filled) {
    assert.equal(tip.fill, style.stroke);
    assert.equal(tip.stroke, style.stroke);
    assert.equal(tip.strokeWidth, style.lineWidth);
  }
  for (const tip of open) {
    assert.equal(tip.fill, "none");
    assert.equal(tip.stroke, style.stroke);
    assert.equal(tip.strokeWidth, style.lineWidth);
  }
  assert.equal(filled[0].lineCap, "butt");
  assert.equal(filled[0].lineJoin, "miter");
  for (const tip of [...filled.slice(1), ...open.slice(1)]) {
    assert.equal(tip.lineCap, "butt");
    assert.equal(tip.lineJoin, "round");
  }
  assert.ok(filled[0].geometry.shorten > legacyCircleArrowMetrics("legacy-filled-circle", style.lineWidth).placement);
  assert.ok(open[1].geometry.shorten > legacyDiamondArrowMetrics("legacy-open-diamond", style.lineWidth).placement);
  assert.ok(open[2].geometry.shorten > legacySquareArrowMetrics("legacy-open-square", style.lineWidth).placement);
});

test("keeps explicit shaft caps and joins separate from arrow-tip paint state", () => {
  const result = tikzToSvg(String.raw`
    \begin{tikzpicture}
      \draw[line cap=round,line join=round,-{spaced diamond}] (0,0) -- (2,0);
    \end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /class="tikz-arrowed-path"><path[^>]+stroke-linecap="round" stroke-linejoin="round"/u);
});
