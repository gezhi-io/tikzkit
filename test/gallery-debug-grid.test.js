import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { withGalleryDebugGrid } from "../scripts/gallery-debug-grid.js";

test("injects a one-unit dashed background grid into tikzpicture gallery sources", () => {
  const source = withGalleryDebugGrid(String.raw`\documentclass[tikz]{standalone}
\begin{document}
\begin{tikzpicture}
  \draw (0,0) -- (2,1);
\end{tikzpicture}
\end{document}`);
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  const gridLines = result.ir.items.filter((item) => item.subtype === "grid-line");
  assert.ok(gridLines.length >= 4, "expected injected grid lines");
  assert.ok(result.ir.items.indexOf(gridLines[0]) < result.ir.items.findIndex((item) => item.type === "path" && item.subtype !== "grid-line"));
  assert.match(result.svg, /stroke-dasharray=/);
  assert.match(source, /\\usetikzlibrary\{backgrounds,calc\}/);
  assert.match(source, /black!45/);
  assert.match(source, /line width=0\.18pt/);
  assert.match(source, /dash pattern=on 1pt off 1\.2pt/);
});

test("injects the same debug grid into tikz-cd gallery sources", () => {
  const source = withGalleryDebugGrid(String.raw`\documentclass[tikz]{standalone}
\usepackage{tikz-cd}
\begin{document}
\begin{tikzcd}
  A \arrow[r] & B
\end{tikzcd}
\end{document}`);
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(source, /\\begin\{tikzcd\}\[tikzkit compare grid\]/);
  assert.ok(result.ir.items.some((item) => item.subtype === "grid-line"), "expected tikz-cd debug grid lines");
});
