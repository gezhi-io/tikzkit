import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import { legacyImpliesArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows}
\begin{tikzpicture}
  \draw[line width=1pt,-implies] (0,0) -- (3,0);
  \draw[double,line width=1pt,double distance=.6pt,implies-] (0,1) -- (3,1);
  \draw[double=yellow,line width=1.4pt,double distance=1.2pt,implies-implies] (0,2) -- (3,2);
\end{tikzpicture}`;

const UNITS_PER_PT = lineWidthFromPt(1);
const inPt = (value) => value / UNITS_PER_PT;

function close(actual, expected, label) {
  assert.ok(Math.abs(inPt(actual) - expected) < 1e-9, `${label}: ${inPt(actual)} != ${expected}`);
}

test("parses legacy implies at start, end, and both endpoints", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && (item.style.markerStart || item.style.markerEnd));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths.length, 3);
  assert.equal(paths[0].style.markerEnd.kind, "legacy-implies");
  assert.equal(paths[1].style.markerStart.kind, "legacy-implies");
  assert.equal(paths[2].style.markerStart.kind, "legacy-implies");
  assert.equal(paths[2].style.markerEnd.kind, "legacy-implies");
});

test("derives ordinary implies metrics from active outer and inner line widths", () => {
  const plain = legacyImpliesArrowMetrics("legacy-implies", lineWidthFromPt(1));
  close(plain.outerLineWidth, 1, "plain outer line width");
  close(plain.innerLineWidth, 0, "plain inner line width");
  close(plain.arrowLineWidth, 0.5, "plain arrow line width");
  close(plain.backEnd, -0.59, "plain backend");
  close(plain.tipEnd, 0.765, "plain tip end");
  close(plain.halfHeight, 0.9125, "plain half height");
  close(plain.placement, 0.765, "plain placement");
  close(plain.assemblyLength, 1.355, "plain assembly length");

  const doubled = legacyImpliesArrowMetrics(
    "legacy-implies",
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
  close(doubled.placement, 2.148, "double placement");
  close(doubled.assemblyLength, 3.736, "double assembly length");
});

test("renders ordinary implies as the source open round cubic", () => {
  const style = {
    stroke: "#2457a6",
    lineWidth: lineWidthFromPt(1),
    doubleColor: "white",
    doubleDistance: lineWidthFromPt(0.6)
  };
  const tip = resolveInlineArrowTip("implies", style);

  assert.equal(tip.kind, "legacy-implies");
  assert.equal(tip.fill, "none");
  assert.equal(tip.stroke, style.stroke);
  assert.equal(tip.strokeWidth, lineWidthFromPt(1));
  assert.equal(tip.lineCap, "round");
  assert.equal(tip.lineJoin, "round");
  assert.match(tip.geometry.path, /^M /);
  assert.equal((tip.geometry.path.match(/ C /g) || []).length, 2);

  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  assert.match(result.svg, /tikz-arrow-legacy-implies/);
  assert.match(result.svg, /tikz-double-outer/);
  assert.match(result.svg, /tikz-double-inner/);
});

test("orients ordinary implies on straight, orthogonal, and curved terminal tangents", () => {
  const result = tikzToSvg(String.raw`
    \usetikzlibrary{arrows}
    \begin{tikzpicture}[double=white,line width=.8pt,double distance=.5pt]
      \draw[-implies] (0,0) -- (2,0);
      \draw[implies-] (0,1) -- (2,1);
      \draw[-implies] (0,2) -| (2,3);
      \draw[implies-implies] (0,4) to[bend left=25] (2,4);
    \end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.equal([...result.svg.matchAll(/tikz-arrow-legacy-implies/gu)].length, 5);
  assert.match(result.svg, /rotate\(-?90(?:\.0+)?\)/u);
});
