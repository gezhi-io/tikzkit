import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { withGalleryDebugGrid } from "../scripts/gallery-debug-grid.js";
import { REAL_GALLERY_CASES } from "../web/real-gallery-data.js";

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

test("does not inject gallery grids into nested tikzpicture nodes", () => {
  const source = withGalleryDebugGrid(String.raw`\documentclass[tikz]{standalone}
\begin{document}
\begin{tikzpicture}
  \node at (0,0) {\begin{tikzpicture}\draw (0,0) -- (1,0);\end{tikzpicture}};
  \draw (0,-1) -- (2,-1);
\end{tikzpicture}
\end{document}`);

  assert.equal((source.match(/\\draw\[black!45/g) || []).length, 2);
});

test("uses rendered text node extents for current bounding box debug grids", () => {
  const source = withGalleryDebugGrid(String.raw`\documentclass[tikz]{standalone}
\begin{document}
\begin{tikzpicture}
  \node at (0,0) {\tikz \draw[x=1cm,y=1cm] (0,0) -- (2,0);};
\end{tikzpicture}
\end{document}`);
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const gridLines = result.ir.items.filter((item) => item.subtype === "grid-line");
  const xs = gridLines.flatMap((line) => line.commands.map((command) => command.x).filter((value) => Number.isFinite(value)));

  assert.ok(Math.min(...xs) <= -1.9, `expected grid to include image left extent, got ${Math.min(...xs)}`);
  assert.ok(Math.max(...xs) >= 1.9, `expected grid to include image right extent, got ${Math.max(...xs)}`);
});

test("keeps Case 122 scaled 3d debug grid as native-style corner nails", () => {
  const source = withGalleryDebugGrid(REAL_GALLERY_CASES[121].source);
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const gridLines = result.ir.items.filter((item) => item.subtype === "grid-line");
  const verticals = gridLines.filter((line) => line.commands[0].x === line.commands[1].x);
  const horizontals = gridLines.filter((line) => line.commands[0].y === line.commands[1].y);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(verticals.length, 3);
  assert.equal(horizontals.length, 1);
  assert.equal(horizontals[0].commands[0].y, 3);
});
