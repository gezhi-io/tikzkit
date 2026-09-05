import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { legacyPrimeArrowMetrics } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { pathTerminalSegments, resolveInlineArrowTip } from "../src/renderers/svg/paths.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows}
\begin{tikzpicture}[line width=2pt]
  \draw[-{latex'}] (0,0) -- (2,0);
  \draw[-{latex' reversed}] (0,1) -- (2,1);
  \draw[-{stealth'}] (0,2) -- (2,2);
  \draw[-{stealth' reversed}] (0,3) -- (2,3);
  \draw[{latex'}-{stealth' reversed}] (0,4) -- (2,4);
\end{tikzpicture}`;

test("preserves the four ordinary legacy prime arrow aliases", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.slice(0, 4).map((path) => path.style.markerEnd.kind), [
    "latex-prime",
    "latex-prime-reversed",
    "stealth-prime",
    "stealth-prime-reversed"
  ]);
  assert.equal(paths[4].style.markerStart.kind, "latex-prime");
  assert.equal(paths[4].style.markerEnd.kind, "stealth-prime-reversed");
});

test("derives legacy prime backend and tip-end metrics from the active line width", () => {
  const lineWidth = lineWidthFromPt(2);
  const unitsPerPt = lineWidthFromPt(1);
  const inPt = (value) => value / unitsPerPt;
  const expected = {
    "latex-prime": [-3.52, 5.28, 5.28, 8.8],
    "latex-prime-reversed": [-5.28, 3.52, 3.52, 8.8],
    "stealth-prime": [-6.28, 2.76, 2.76, 9.04],
    "stealth-prime-reversed": [-2.76, 6.28, 6.28, 9.04]
  };

  for (const [kind, [backEnd, tipEnd, placement, assemblyLength]] of Object.entries(expected)) {
    const metrics = legacyPrimeArrowMetrics(kind, lineWidth);
    assert.ok(metrics, kind);
    assert.ok(Math.abs(inPt(metrics.backEnd) - backEnd) < 1e-9, `${kind} backend`);
    assert.ok(Math.abs(inPt(metrics.tipEnd) - tipEnd) < 1e-9, `${kind} tip end`);
    assert.ok(Math.abs(inPt(metrics.placement) - placement) < 1e-9, `${kind} placement`);
    assert.ok(Math.abs(inPt(metrics.assemblyLength) - assemblyLength) < 1e-9, `${kind} assembly`);
  }
});

test("uses source cubic geometry and paint for ordinary legacy prime tips", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(2) };
  const latex = resolveInlineArrowTip("latex'", style);
  const latexReversed = resolveInlineArrowTip("latex' reversed", style);
  const stealth = resolveInlineArrowTip("stealth'", style);
  const stealthReversed = resolveInlineArrowTip("stealth' reversed", style);

  assert.equal(latex.fill, style.stroke);
  assert.equal(latex.stroke, "none");
  assert.equal(latex.lineCap, "butt");
  assert.match(latex.geometry.path, /^M .* C .* C .* C .* Z$/u);
  assert.notEqual(latex.geometry.path, latexReversed.geometry.path);

  assert.equal(stealth.fill, style.stroke);
  assert.equal(stealth.stroke, style.stroke);
  assert.equal(stealth.strokeWidth, style.lineWidth);
  assert.equal(stealth.lineCap, "butt");
  assert.equal(stealth.lineJoin, "round");
  assert.match(stealth.geometry.path, /^M .* C .* C .* C .* Z$/u);
  assert.notEqual(stealth.geometry.path, stealthReversed.geometry.path);
});

test("renders source-distinct prime tips and shortens the shaft to each tip end", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /tikz-arrow-latex-prime/);
  assert.match(result.svg, /tikz-arrow-latex-prime-reversed/);
  assert.match(result.svg, /tikz-arrow-stealth-prime/);
  assert.match(result.svg, /tikz-arrow-stealth-prime-reversed/);
  assert.doesNotMatch(result.svg, /tikz-arrow-latex-prime[^>]+stroke="#2457a6"/);
});

test("orients a curved start tip from the first control point rather than the end tangent", () => {
  const terminal = pathTerminalSegments([
    { type: "moveTo", x: 0, y: 0 },
    { type: "curveTo", x1: 1, y1: 1, x2: 2, y2: 0, x: 3, y: 0 }
  ]);

  assert.ok(Math.abs(terminal.first.startAngle + 45) < 1e-9);
  assert.ok(Math.abs(terminal.last.angle) < 1e-9);
});
