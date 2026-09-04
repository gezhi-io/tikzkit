import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import { spacedDelimiterArrowMetrics } from "../src/tikz/libraries/arrows.spaced.js";
import { legacyDelimiterArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.spaced}
\begin{tikzpicture}
  \draw[arrows={spaced [-spaced ]}] (0,0) -- (2,0);
  \draw[arrows={spaced ]-spaced [}] (0,1) -- (2,1);
  \draw[arrows={spaced (-spaced )}] (0,2) -- (2,2);
  \draw[arrows={spaced )-spaced (}] (0,3) -- (2,3);
  \draw[arrows={spaced |-spaced |}] (0,4) -- (2,4);
\end{tikzpicture}`;

const UNITS_PER_PT = lineWidthFromPt(1);
const inPt = (value) => value / UNITS_PER_PT;

test("parses all source-declared paired spaced delimiter aliases", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.map((item) => item.style.markerStart?.kind), [
    "legacy-spaced-square-bracket",
    "legacy-spaced-square-bracket-reversed",
    "legacy-spaced-round-bracket-reversed",
    "legacy-spaced-round-bracket",
    "legacy-spaced-bar"
  ]);
  assert.deepEqual(paths.map((item) => item.style.markerEnd?.kind), [
    "legacy-spaced-square-bracket-reversed",
    "legacy-spaced-square-bracket",
    "legacy-spaced-round-bracket",
    "legacy-spaced-round-bracket-reversed",
    "legacy-spaced-bar"
  ]);
});

test("adds the PGF space arrow without changing delimiter geometry", () => {
  const lineWidth = lineWidthFromPt(1.2);
  const expectedSpacePt = 0.88 + 0.3 * 1.2;
  const families = [
    ["square-bracket", "square-bracket"],
    ["square-bracket-reversed", "square-bracket-reversed"],
    ["round-bracket", "round-bracket"],
    ["round-bracket-reversed", "round-bracket-reversed"],
    ["legacy-bar", "bar"]
  ];

  for (const [baseKind, spacedKind] of families) {
    const base = legacyDelimiterArrowMetrics(baseKind, lineWidth);
    const spaced = spacedDelimiterArrowMetrics(`legacy-spaced-${spacedKind}`, lineWidth);

    assert.ok(Math.abs(inPt(spaced.space) - expectedSpacePt) < 1e-9);
    assert.ok(Math.abs(spaced.placement - (base.placement + spaced.space)) < 1e-9);
    assert.ok(Math.abs(spaced.terminalPlacement - (base.placement + spaced.space)) < 1e-9);
    assert.ok(Math.abs(spaced.assemblyLength - (base.assemblyLength + spaced.space)) < 1e-9);
    assert.equal(spaced.halfHeight, base.halfHeight);
  }

  const bar = legacyDelimiterArrowMetrics("legacy-bar", lineWidth);
  assert.ok(Math.abs(inPt(bar.backEnd) + 0.3) < 1e-9);
  assert.ok(Math.abs(inPt(bar.tipEnd) - 0.9) < 1e-9);
  assert.ok(Math.abs(inPt(bar.halfHeight) - 3.8) < 1e-9);
  assert.ok(Math.abs(inPt(bar.barX) - 0.3) < 1e-9);
});

test("uses source stroke topology, active width, caps, and joins", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(1.2) };
  const square = resolveInlineArrowTip("spaced [", style);
  const round = resolveInlineArrowTip("spaced (", style);
  const bar = resolveInlineArrowTip("spaced |", style);
  const ordinaryBar = resolveInlineArrowTip("|", style);

  for (const tip of [square, round, bar, ordinaryBar]) {
    assert.equal(tip.fill, "none");
    assert.equal(tip.stroke, style.stroke);
    assert.equal(tip.strokeWidth, style.lineWidth);
  }
  assert.equal(square.lineCap, "butt");
  assert.equal(square.lineJoin, "miter");
  assert.match(square.geometry.path, /^M .* L 0 .* L 0 .* L /u);
  assert.equal(round.lineCap, "round");
  assert.match(round.geometry.path, /^M .* C /u);
  assert.equal(bar.lineCap, "square");
  assert.equal(ordinaryBar.kind, "legacy-bar");
  assert.equal(ordinaryBar.lineCap, "square");
  assert.match(bar.geometry.path, /^M [^ ]+ [^ ]+ L [^ ]+ /u);
  assert.ok(bar.geometry.shorten > ordinaryBar.geometry.shorten);
});
