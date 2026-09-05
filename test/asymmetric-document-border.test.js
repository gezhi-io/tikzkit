import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function svgViewBox(svg) {
  return svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
}

test("standalone four-side borders survive parse, evaluation, and SVG layout", () => {
  const source = String.raw`\documentclass[border={2mm 5mm 11mm 14mm}]{standalone}
\usepackage{tikz}
\begin{document}
\begin{tikzpicture}\draw (0,0) -- (1,0);\end{tikzpicture}
\end{document}`;
  const bordered = tikzToSvg(source, { mathRenderer: "svg-text" });
  const tight = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const borderedView = svgViewBox(bordered.svg);
  const tightView = svgViewBox(tight.svg);

  assert.deepEqual(bordered.ast.previewMargins, { left: 0.2, bottom: 0.5, right: 1.1, top: 1.4 });
  assert.deepEqual(bordered.ir.previewMargins, bordered.ast.previewMargins);
  assert.deepEqual(bordered.diagnostics, []);
  assert.deepEqual(tight.diagnostics, []);
  assert.ok(Math.abs(borderedView[0] - (tightView[0] - 20)) < 1e-6);
  assert.ok(Math.abs(borderedView[1] - (tightView[1] - 140)) < 1e-6);
  assert.ok(Math.abs(borderedView[2] - (tightView[2] + 130)) < 1e-6);
  assert.ok(Math.abs(borderedView[3] - (tightView[3] + 190)) < 1e-6);
});

test("an explicit renderer margin overrides asymmetric source margins", () => {
  const source = String.raw`\documentclass[border={2mm 5mm 11mm 14mm}]{standalone}
\begin{document}\tikz \draw (0,0) -- (1,0);\end{document}`;
  const explicit = tikzToSvg(source, { margin: 7, mathRenderer: "svg-text" });
  const tight = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const explicitView = svgViewBox(explicit.svg);
  const tightView = svgViewBox(tight.svg);

  assert.ok(Math.abs(explicitView[0] - (tightView[0] - 7)) < 1e-6);
  assert.ok(Math.abs(explicitView[1] - (tightView[1] - 7)) < 1e-6);
  assert.ok(Math.abs(explicitView[2] - (tightView[2] + 14)) < 1e-6);
  assert.ok(Math.abs(explicitView[3] - (tightView[3] + 14)) < 1e-6);
});
