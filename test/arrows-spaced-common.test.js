import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import {
  legacySpacedArrowSpace,
  spacedLegacyArrowMetrics
} from "../src/tikz/libraries/arrows.spaced.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";

const SOURCE = String.raw`
\usetikzlibrary{arrows,arrows.spaced}
\begin{tikzpicture}[line width=2pt]
  \draw[-{spaced to}] (0,0) -- (2,0);
  \draw[-{spaced to reversed}] (0,1) -- (2,1);
  \draw[-{spaced latex}] (0,2) -- (2,2);
  \draw[-{spaced latex reversed}] (0,3) -- (2,3);
  \draw[-{spaced latex'}] (0,4) -- (2,4);
  \draw[-{spaced latex' reversed}] (0,5) -- (2,5);
  \draw[-{spaced stealth}] (0,6) -- (2,6);
  \draw[-{spaced stealth reversed}] (0,7) -- (2,7);
  \draw[-{spaced stealth'}] (0,8) -- (2,8);
  \draw[-{spaced stealth' reversed}] (0,9) -- (2,9);
  \draw[{spaced latex'}-{spaced stealth reversed}] (0,10) -- (2,10);
\end{tikzpicture}`;

const EXPECTED_KINDS = [
  "legacy-spaced-to",
  "legacy-spaced-to-reversed",
  "legacy-spaced-latex",
  "legacy-spaced-latex-reversed",
  "legacy-spaced-latex-prime",
  "legacy-spaced-latex-prime-reversed",
  "legacy-spaced-stealth",
  "legacy-spaced-stealth-reversed",
  "legacy-spaced-stealth-prime",
  "legacy-spaced-stealth-prime-reversed"
];

test("parses ten source-distinct arrows.spaced common aliases", () => {
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.slice(0, 10).map((path) => path.style.markerEnd.kind), EXPECTED_KINDS);
  assert.equal(paths[10].style.markerStart.kind, "legacy-spaced-latex-prime");
  assert.equal(paths[10].style.markerEnd.kind, "legacy-spaced-stealth-reversed");
});

test("derives source backend, tip end, and starred-combine spacing at 2pt", () => {
  const lineWidth = lineWidthFromPt(2);
  const unitsPerPt = lineWidthFromPt(1);
  const inPt = (value) => value / unitsPerPt;
  const expected = {
    "legacy-spaced-to": [-3.44, 1.46, 2.94, 6.38],
    "legacy-spaced-to-reversed": [-1.16, 3.88, 5.36, 6.52],
    "legacy-spaced-latex": [-0.88, 7.92, 9.4, 10.28],
    "legacy-spaced-latex-reversed": [-7.92, 0.88, 2.36, 10.28],
    "legacy-spaced-latex-prime": [-3.52, 5.28, 6.76, 10.28],
    "legacy-spaced-latex-prime-reversed": [-5.28, 3.52, 5, 10.28],
    "legacy-spaced-stealth": [-2.64, 4.4, 5.88, 8.52],
    "legacy-spaced-stealth-reversed": [-4.4, 2.64, 4.12, 8.52],
    "legacy-spaced-stealth-prime": [-6.28, 2.76, 4.24, 10.52],
    "legacy-spaced-stealth-prime-reversed": [-2.76, 6.28, 7.76, 10.52]
  };

  assert.ok(Math.abs(inPt(legacySpacedArrowSpace(lineWidth)) - 1.48) < 1e-9);
  for (const [kind, [backEnd, tipEnd, placement, assemblyLength]] of Object.entries(expected)) {
    const metrics = spacedLegacyArrowMetrics(kind, lineWidth);
    assert.ok(metrics, kind);
    assert.ok(Math.abs(inPt(metrics.backEnd) - backEnd) < 1e-9, `${kind} backend`);
    assert.ok(Math.abs(inPt(metrics.tipEnd) - tipEnd) < 1e-9, `${kind} tip end`);
    assert.ok(Math.abs(inPt(metrics.placement) - placement) < 1e-9, `${kind} placement`);
    assert.ok(Math.abs(inPt(metrics.assemblyLength) - assemblyLength) < 1e-9, `${kind} assembly`);
  }
});

test("keeps source paint and reversed geometry while adding endpoint space", () => {
  const style = { stroke: "#2457a6", lineWidth: lineWidthFromPt(2) };
  const forwardTo = resolveInlineArrowTip("spaced to", style);
  const reversedTo = resolveInlineArrowTip("spaced to reversed", style);
  const forwardLatex = resolveInlineArrowTip("spaced latex", style);
  const reversedLatex = resolveInlineArrowTip("spaced latex reversed", style);
  const stealthPrime = resolveInlineArrowTip("spaced stealth'", style);

  assert.equal(forwardTo.fill, "none");
  assert.equal(forwardTo.stroke, style.stroke);
  assert.equal(forwardTo.strokeWidth, lineWidthFromPt(1.6));
  assert.equal(forwardTo.lineCap, "round");
  assert.equal(forwardTo.lineJoin, "round");
  assert.notEqual(forwardTo.geometry.path, reversedTo.geometry.path);
  assert.equal(forwardLatex.stroke, "none");
  assert.equal(forwardLatex.fill, style.stroke);
  assert.notEqual(forwardLatex.geometry.path, reversedLatex.geometry.path);
  assert.equal(stealthPrime.fill, style.stroke);
  assert.equal(stealthPrime.stroke, style.stroke);
  assert.equal(stealthPrime.lineJoin, "round");
});
