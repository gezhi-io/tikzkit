import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import { spacedImpliesArrowMetrics } from "../src/tikz/libraries/arrows.spaced.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.spaced}
\begin{tikzpicture}
  \draw[line width=1pt,-{spaced implies}] (0,0) -- (3,0);
  \draw[double,line width=1pt,double distance=.6pt,{spaced implies}-] (0,1) -- (3,1);
  \draw[double=yellow,line width=1.4pt,double distance=1.2pt,{spaced implies}-{spaced implies}] (0,2) -- (3,2);
\end{tikzpicture}`;

const UNITS_PER_PT = lineWidthFromPt(1);
const inPt = (value) => value / UNITS_PER_PT;

function close(actual, expected, label) {
  assert.ok(Math.abs(inPt(actual) - expected) < 1e-9, `${label}: ${inPt(actual)} != ${expected}`);
}

test("parses spaced implies at start, end, and both endpoints", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && (item.style.markerStart || item.style.markerEnd));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths.length, 3);
  assert.equal(paths[0].style.markerEnd.kind, "legacy-spaced-implies");
  assert.equal(paths[1].style.markerStart.kind, "legacy-spaced-implies");
  assert.equal(paths[2].style.markerStart.kind, "legacy-spaced-implies");
  assert.equal(paths[2].style.markerEnd.kind, "legacy-spaced-implies");
});

test("derives implies metrics from the active outer and inner line widths", () => {
  const plain = spacedImpliesArrowMetrics("legacy-spaced-implies", lineWidthFromPt(1));
  close(plain.outerLineWidth, 1, "plain outer line width");
  close(plain.innerLineWidth, 0, "plain inner line width");
  close(plain.arrowLineWidth, 0.5, "plain arrow line width");
  close(plain.backEnd, -0.59, "plain backend");
  close(plain.tipEnd, 0.765, "plain tip end");
  close(plain.halfHeight, 0.9125, "plain half height");
  close(plain.space, 1.18, "plain space");
  close(plain.placement, 1.945, "plain placement");
  close(plain.assemblyLength, 2.535, "plain assembly length");

  const doubled = spacedImpliesArrowMetrics(
    "legacy-spaced-implies",
    lineWidthFromPt(1),
    lineWidthFromPt(0.6),
    true
  );
  close(doubled.outerLineWidth, 2.6, "double outer line width");
  close(doubled.innerLineWidth, 0.6, "double inner line width");
  close(doubled.arrowLineWidth, 1, "double arrow line width");
  close(doubled.backEnd, -1.588, "double backend");
  close(doubled.tipEnd, 2.148, "double tip end");
  close(doubled.halfHeight, 2.62, "double half height");
  close(doubled.space, 1.66, "double space");
  close(doubled.placement, 3.808, "double placement");
  close(doubled.assemblyLength, 5.396, "double assembly length");

  const custom = spacedImpliesArrowMetrics(
    "legacy-spaced-implies",
    lineWidthFromPt(1.4),
    lineWidthFromPt(1.2),
    true
  );
  close(custom.outerLineWidth, 4, "custom outer line width");
  close(custom.innerLineWidth, 1.2, "custom inner line width");
  close(custom.arrowLineWidth, 1.4, "custom arrow line width");
  close(custom.backEnd, -2.468, "custom backend");
  close(custom.tipEnd, 3.378, "custom tip end");
  close(custom.halfHeight, 4.145, "custom half height");
  close(custom.space, 2.08, "custom space");
  close(custom.placement, 5.458, "custom placement");
  close(custom.assemblyLength, 7.926, "custom assembly length");
});

test("renders the PGF implies cubic as an open round stroke", () => {
  const style = {
    stroke: "#2457a6",
    lineWidth: lineWidthFromPt(1),
    doubleColor: "white",
    doubleDistance: lineWidthFromPt(0.6)
  };
  const tip = resolveInlineArrowTip("spaced implies", style);

  assert.equal(tip.kind, "legacy-spaced-implies");
  assert.equal(tip.fill, "none");
  assert.equal(tip.stroke, style.stroke);
  assert.equal(tip.strokeWidth, lineWidthFromPt(1));
  assert.equal(tip.lineCap, "round");
  assert.equal(tip.lineJoin, "round");
  assert.match(tip.geometry.path, /^M /);
  assert.equal((tip.geometry.path.match(/ C /g) || []).length, 2);

  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  assert.match(result.svg, /tikz-arrow-legacy-spaced-implies/);
  assert.match(result.svg, /tikz-double-outer/);
  assert.match(result.svg, /tikz-double-inner/);
});
