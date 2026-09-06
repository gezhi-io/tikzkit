import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { collectPgfplotsLibraries, patchplotsLibrary } from "../src/pgfplots/index.js";

function role(item) {
  return item.subtype || item.semanticRole || item.style?.semanticRole;
}

test("patchplots triangle renders one filled planar three-vertex patch", () => {
  const result = tikzToSvg(String.raw`
\documentclass[border=2pt]{standalone}
\usepackage{pgfplots}
\usepgfplotslibrary{patchplots}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[view={45}{30},xmin=0,xmax=2,ymin=0,ymax=2,zmin=0,zmax=2]
    \addplot3[patch,patch type=triangle,draw=black,fill=orange!65]
      coordinates {(0,0,0) (2,0,1) (0,2,2)};
  \end{axis}
\end{tikzpicture}
\end{document}`);

  assert.deepEqual(result.diagnostics, []);
  const surfaces = result.ir.items.filter((item) => item.type === "path" && role(item) === "axis-surface");
  const fills = surfaces.filter((item) => item.style.fill && item.style.fill !== "none");
  const meshes = surfaces.filter((item) => item.style.stroke && item.style.stroke !== "none");
  assert.equal(fills.length, 1);
  assert.equal(meshes.length, 1);
  assert.equal(fills[0].commands.filter((command) => command.type === "lineTo").length, 2);
  assert.ok(fills[0].commands.some((command) => command.type === "closePath"));
  assert.notEqual(fills[0].style.fill, "none");
  assert.notEqual(meshes[0].style.stroke, "none");
});

test("patchplots rectangle preserves the A-to-B-to-C-to-D vertex stream", () => {
  const result = tikzToSvg(String.raw`
\documentclass[border=2pt]{standalone}
\usepackage{pgfplots}
\usepgfplotslibrary{patchplots}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[view={45}{30},xmin=0,xmax=2,ymin=0,ymax=2,zmin=0,zmax=2,xlabel=$x$,ylabel=$y$,zlabel=$z$]
    \addplot3[patch,patch type=rectangle,draw=black,fill=cyan!50]
      coordinates {(0,0,0) (2,0,1) (2,2,2) (0,2,1)};
  \end{axis}
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  const surfaces = result.ir.items.filter((item) => item.type === "path" && role(item) === "axis-surface");
  const fills = surfaces.filter((item) => item.style.fill && item.style.fill !== "none");
  const meshes = surfaces.filter((item) => item.style.stroke && item.style.stroke !== "none");
  assert.equal(fills.length, 1);
  assert.equal(meshes.length, 1);
  assert.equal(fills[0].style.fill, "rgb(128 214 247)");
  assert.equal(meshes[0].style.stroke, "rgb(204,153,0)");
  assert.equal(fills[0].commands.filter((command) => command.type === "lineTo").length, 3);
  assert.ok(fills[0].commands.some((command) => command.type === "closePath"));
  assert.equal(meshes[0].commands.filter((command) => command.type === "lineTo").length, 3);
  assert.ok(meshes[0].commands.some((command) => command.type === "closePath"));
  assert.match(result.svg, /class="tikz-math-glyph tikz-math-glyph-z"/);
  assert.doesNotMatch(result.svg, /<text[^>]*>\s*z\s*<\/text>/);
});

test("patchplots line renders one open two-vertex mapped-color segment", () => {
  const result = tikzToSvg(String.raw`
\documentclass[border=2pt]{standalone}
\usepackage{pgfplots}
\usepgfplotslibrary{patchplots}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[view={45}{30},xmin=0,xmax=2,ymin=0,ymax=2,zmin=0,zmax=2]
    \addplot3[patch,patch type=line,line width=1.2pt]
      coordinates {(0,0,0) (2,2,2)};
  \end{axis}
\end{tikzpicture}
\end{document}`);

  assert.deepEqual(result.diagnostics, []);
  const surfaces = result.ir.items.filter((item) => item.type === "path" && role(item) === "axis-surface");
  assert.equal(surfaces.length, 1);
  assert.equal(surfaces[0].commands.filter((command) => command.type === "lineTo").length, 1);
  assert.equal(surfaces[0].commands.some((command) => command.type === "closePath"), false);
  assert.equal(surfaces[0].style.fill, "none");
  assert.equal(surfaces[0].style.stroke, "rgb(255 191.5 0)");
  assert.ok(Math.abs(surfaces[0].style.lineWidth - 4.217517642992186) < 1e-9);

  const tickLabels = result.ir.items.filter(
    (item) => item.type === "textNode" && /^[012]$/u.test(item.text)
  );
  const xMaxLabel = tickLabels[2];
  const yMinLabel = tickLabels[3];
  assert.ok(xMaxLabel && yMinLabel, "expected x=2 and y=0 labels at the shared projected corner");
  assert.ok(
    yMinLabel.x - xMaxLabel.x > 0.34,
    `PGFPlots outer normals should keep shared-corner tick labels separate, got ${yMinLabel.x - xMaxLabel.x}cm`
  );
  assert.ok(Math.abs(yMinLabel.y - xMaxLabel.y) < 0.01);
});

test("patchplots declaration resolves to its dedicated partial library module", () => {
  const libraries = collectPgfplotsLibraries(String.raw`\usepgfplotslibrary{patchplots}`);

  assert.equal(libraries.length, 1);
  assert.equal(libraries[0].name, "patchplots");
  assert.equal(libraries[0].status, "partial");
  assert.equal(libraries[0].localSource, patchplotsLibrary.localSource);
  assert.match(libraries[0].implementedBy, /renderAxisTrianglePatchCoordinatePlot/);
  assert.match(libraries[0].implementedBy, /renderAxisRectanglePatchCoordinatePlot/);
  assert.match(libraries[0].implementedBy, /renderAxisLinePatchCoordinatePlot/);
});
