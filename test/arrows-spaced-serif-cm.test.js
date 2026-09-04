import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import { spacedSerifCmArrowMetrics } from "../src/tikz/libraries/arrows.spaced.js";
import { legacySerifCmArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const UNITS_PER_PT = lineWidthFromPt(1);
const inPt = (value) => value / UNITS_PER_PT;

test("parses ordinary and spaced serif-cm arrow aliases at either path end", () => {
  const result = tikzToSvg(String.raw`
    \usetikzlibrary{arrows,arrows.spaced}
    \begin{tikzpicture}
      \draw[-{serif cm}] (0,0) -- (2,0);
      \draw[-{spaced serif cm}] (0,1) -- (2,1);
      \draw[serif cm-] (0,2) -- (2,2);
      \draw[{spaced serif cm}-{serif cm}] (0,3) -- (2,3);
    \end{tikzpicture}`, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && (item.style.markerStart || item.style.markerEnd));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths[0].style.markerEnd.kind, "legacy-serif-cm");
  assert.equal(paths[1].style.markerEnd.kind, "legacy-spaced-serif-cm");
  assert.equal(paths[2].style.markerStart.kind, "legacy-serif-cm");
  assert.equal(paths[3].style.markerStart.kind, "legacy-spaced-serif-cm");
  assert.equal(paths[3].style.markerEnd.kind, "legacy-serif-cm");
});

test("uses the installed PGF serif-cm dimensions and adds only source space", () => {
  const lineWidth = lineWidthFromPt(1.2);
  const base = legacySerifCmArrowMetrics("legacy-serif-cm", lineWidth);
  const spaced = spacedSerifCmArrowMetrics("legacy-spaced-serif-cm", lineWidth);

  assert.ok(base);
  assert.ok(spaced);
  assert.ok(Math.abs(inPt(base.unit) - 0.94) < 1e-9);
  assert.ok(Math.abs(inPt(base.backEnd) + 0.705) < 1e-9);
  assert.ok(Math.abs(inPt(base.tipEnd) - 0.048) < 1e-9);
  assert.ok(Math.abs(inPt(base.placement) - 0.048) < 1e-9);
  assert.ok(Math.abs(inPt(base.assemblyLength) - 0.753) < 1e-9);
  assert.ok(Math.abs(inPt(spaced.space) - 1.24) < 1e-9);
  assert.ok(Math.abs(inPt(spaced.placement) - 1.288) < 1e-9);
  assert.ok(Math.abs(inPt(spaced.assemblyLength) - 1.993) < 1e-9);
});

test("renders the Computer Modern serif silhouette as fill-only geometry", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(1.2) };
  const base = resolveInlineArrowTip("serif cm", style);
  const spaced = resolveInlineArrowTip("spaced serif cm", style);

  for (const tip of [base, spaced]) {
    assert.equal(tip.fill, style.stroke);
    assert.equal(tip.stroke, "none");
    assert.equal(tip.strokeWidth, 0);
    assert.match(tip.geometry.path, /Z$/u);
    assert.ok(tip.geometry.bounds.minY < 0);
    assert.ok(tip.geometry.bounds.maxY > 0);
  }
  assert.equal(base.geometry.path, spaced.geometry.path);
  assert.ok(spaced.geometry.shorten > base.geometry.shorten);
});

test("renders serif-cm tips on straight, orthogonal, and curved terminal tangents", () => {
  const result = tikzToSvg(String.raw`
    \usetikzlibrary{arrows,arrows.spaced}
    \begin{tikzpicture}[line width=1pt]
      \draw[-{serif cm}] (0,0) -- (2,0);
      \draw[{spaced serif cm}-] (0,1) -- (2,1);
      \draw[-{spaced serif cm}] (0,2) -| (2,3);
      \draw[{serif cm}-{spaced serif cm}] (0,4) to[bend left=25] (2,4);
    \end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.equal([...result.svg.matchAll(/tikz-arrow-legacy-serif-cm/gu)].length, 2);
  assert.equal([...result.svg.matchAll(/tikz-arrow-legacy-spaced-serif-cm/gu)].length, 3);
  assert.match(result.svg, /rotate\(-?90(?:\.0+)?\)/u);
});
