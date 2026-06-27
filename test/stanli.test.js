import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stanliExtension, tikzToSvg } from "../src/index.js";
import { expandStanli } from "../src/extensions/stanli.js";
import { lineWidthFromPt } from "../src/tikz-metrics.js";

function render(body) {
  return tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{stanli}
\begin{document}
\begin{tikzpicture}
${body}
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });
}

test("exposes stanli as a built-in extension module", () => {
  assert.equal(stanliExtension.name, "stanli");
  assert.equal(stanliExtension.phase, "preprocess");
  assert.ok(stanliExtension.commands.includes("point"));
  assert.ok(stanliExtension.commands.includes("dbeam"));
});

test("expands stanli 2D structural commands into ordinary TikZ", () => {
  const result = render(String.raw`
\scaling{.5};
\point{a}{0}{0};
\point{b}{4}{0};
\beam{1}{a}{b}[1][1];
\support{1}{a};
\hinge{1}{b};
\lineload{2}{a}{b}[1][1][.5];
\dimensioning{1}{a}{b}{-1}[$4$];
\notation{1}{a}{$A$}[below];
\notation{4}{a}{b}[$S$];`);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.a, { x: 0, y: 0 });
  assert.deepEqual(result.ir.coordinates.b, { x: 2, y: 0 });
  assert.ok(result.ir.items.filter((item) => item.type === "path").length >= 5);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$A$"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$S$"));
});

test("expands stanli 3D example commands with coords basis", () => {
  const result = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{stanli}
\begin{document}
\setcoords{-25}{10}[1][1.2]
\setaxis{2}
\begin{tikzpicture}[coords]
\dpoint{a}{0}{0}{0};
\dpoint{b}{3}{0}{0};
\dpoint{c}{3}{3}{0};
\daxis{1}{a};
\dbeam{1}{a}{b};
\dbeam{3}{b}{c};
\dsupport{1}{b};
\dhinge{2}{b}[a][c][1];
\dlineload{5}{0}{b}{c}[.5][.5][.11];
\ddimensioning{xy}{a}{b}{1}[$3$\,m];
\dnotation{1}{b}{$B$}[below left];
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ast.pictures[0].options.x);
  assert.deepEqual(result.ir.coordinates.a, { x: 0, y: 0 });
  assert.ok(result.ir.items.filter((item) => item.type === "path").length >= 6);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("B")));
});

test("expands stanli 3D local-axis and interleaved optional arguments", () => {
  const result = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{stanli}
\begin{document}
\setcoords
\setaxis
\begin{tikzpicture}[coords]
\dpoint{a}{0}{0};
\dpoint{b}{0}{3}{-1};
\dpoint{c}{1.5}{3}{-1};
\daxis{2}{yz}[a][b][.5][above right][left][below];
\daxis{3}{0}[a][c][.4][63.43][18.43];
\dlineload{5}{45}[45]{b}{c}[.5][0][.3];
\dinternalforces{yz}{a}{b}{.5}{-1}[-.4][blue];
\ddimensioning{xz}[3]{b}{c}{.5}[$1.5$\,m][1.5];
\daddon{1}{xy}{a}{b}{.5};
\daddon{2}{yz}{a}{b}{c}[-1];
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.a, { x: 0, y: 0 });
  assert.ok(result.ir.items.filter((item) => item.type === "path").length >= 8);
});

test("expands stanli 3D structural details with native-like support and line-load geometry", () => {
  const expanded = expandStanli(String.raw`
\documentclass{standalone}
\usepackage{stanli}
\begin{document}
\begin{tikzpicture}[coords]
\dpoint{f}{0}{3}{0};
\dpoint{b}{3}{0}{0};
\dpoint{e}{12}{0}{0};
\dpoint{j}{12}{3}{0};
\dbeam{1}{f}{b};
\dsupport{1}{b}[0][0];
\dhinge{2}{b}[f][j][1];
\dlineload{5}{0}{f}{b}[.5][.5][.11];
\ddimensioning{yx}{e}{j}{13}[$3$\,m];
\end{tikzpicture}
\end{document}`);

  assert.match(expanded, /\\fill \(f\) circle \(1pt\);/);
  assert.match(expanded, /\\fill \(b\) circle \(1pt\);/);
  assert.doesNotMatch(expanded, /\(b\) -- \+\+\(-1,0,0\)/);
  assert.doesNotMatch(expanded, /\(b\) -- \+\+\(0,-1,0\)/);
  assert.match(expanded, /\(b\) -- \+\+\(0,0,-1\)/);
  assert.match(expanded, /lineload\d+VarA1/);
  assert.ok((expanded.match(/\\draw\[-latex,line width=1pt\]/g) || []).length >= 5);
  assert.match(expanded, /\(13,0,0\) -- \(13,3,0\)/);
  assert.doesNotMatch(expanded, /\$\(e\)\+\(0,13,0\)\$/);
});

test("renders stanli Case 1561 with distributed load and dimension geometry expanded", async () => {
  const { loadRealGalleryCases } = await import("../scripts/gallery-case-source.js");
  const gallery = await loadRealGalleryCases();
  const case1561 = gallery.cases[1560];
  const result = tikzToSvg(case1561.source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.length > 80, `expected expanded structural details, got ${result.ir.items.length}`);
  assert.ok(
    result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd).length >= 20,
    "expected distributed load arrows to render as individual arrowed paths"
  );
});

test("renders stanli Case 1448 with native-like beams, supports, frame, and help lines", async () => {
  const { loadRealGalleryCases } = await import("../scripts/gallery-case-source.js");
  const gallery = await loadRealGalleryCases();
  const case1448 = gallery.cases[1447];
  const result = tikzToSvg(case1448.source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.subtype === "tikz-framed"), "expected framed picture outline");
  assert.ok(
    result.ir.items.filter((item) => item.type === "path" && item.style?.dashArray?.length).length >= 6,
    "expected stanli type-1 beams to include offset dashed helper lines"
  );
  assert.ok(
    result.ir.items.filter((item) => item.subtype === "stanli-support-hatch").length >= 10,
    "expected support hatching lines"
  );
  const grid = result.ir.items.find((item) => item.subtype === "grid-line");
  assert.ok(grid, "expected help-lines grid");
  assert.notEqual(grid.style?.stroke, "black", "help lines grid should not render as black construction lines");
});

test("renders stanli Case 1450 with expanded type-2 line loads", async () => {
  const { loadRealGalleryCases } = await import("../scripts/gallery-case-source.js");
  const gallery = await loadRealGalleryCases();
  const case1450 = gallery.cases[1449];
  const result = tikzToSvg(case1450.source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(
    result.ir.items.filter((item) => item.subtype === "stanli-lineload-arrow" && item.style?.markerEnd).length >= 9,
    "expected type-2 line loads to render endpoint and interval force arrows"
  );
  assert.ok(
    result.ir.items.filter((item) => item.subtype === "stanli-lineload-outline").length >= 4,
    "expected type-2 line loads to render top and base outline lines"
  );
  assert.ok(
    result.ir.items.filter((item) => item.subtype === "stanli-lineload-endpoint").length >= 4,
    "expected type-2 line loads to render top endpoint dots"
  );
});

test("renders stanli Case 1455 with showpoint labels on 3D points", async () => {
  const { loadRealGalleryCases } = await import("../scripts/gallery-case-source.js");
  const gallery = await loadRealGalleryCases();
  const case1455 = gallery.cases[1454];
  const expanded = expandStanli(case1455.source);
  const result = tikzToSvg(case1455.source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(expanded, /\\coordinate \(b\) at \(0,3,-1\);/);
  assert.match(expanded, /\\coordinate \(c\) at \(1\.5,3,-1\);/);
  assert.match(expanded, /-- \+\+\(0\.9,0,0\)/);
  for (const label of ["a", "b", "c"]) {
    assert.ok(
      result.ir.items.some((item) => item.type === "textNode" && item.text === label && item.style?.textFill === "red"),
      `expected red showpoint label ${label}`
    );
  }
});

test("renders stanli Case 1462 with native axisarrow geometry", async () => {
  const { loadRealGalleryCases } = await import("../scripts/gallery-case-source.js");
  const gallery = await loadRealGalleryCases();
  const case1462 = gallery.cases[1461];
  const expanded = expandStanli(case1462.source);
  const result = tikzToSvg(case1462.source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(expanded, /\\draw\[axisarrow,->\] \(0,0,0\) -- \+\+\(0\.9,0,0\)/);
  assert.match(expanded, /-- \+\+\(0,0,0\.9\) node\[right\] \{\$z\$\}/);
  const axisPaths = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);
  assert.equal(axisPaths.length, 3);
  assert.equal(axisPaths[0].style.markerEnd.kind, "open-triangle");
  assert.ok(
    Math.abs(axisPaths[0].style.lineWidth - lineWidthFromPt(1)) < 1e-6,
    `expected stanli normalLine 1pt, got ${axisPaths[0].style.lineWidth}`
  );
  assert.match(result.svg, /tikz-arrow-open-triangle/);
  const xAxisLineEnd = Number(result.svg.match(/<g class="tikz-arrowed-path"><path d="M 0 0 L ([\d.-]+)/)?.[1]);
  assert.ok(xAxisLineEnd < 70, `expected open triangle to shorten the visible x-axis line, got ${xAxisLineEnd}`);
});

test("renders stanli Case 1476 with type-5 dsupport spring geometry", async () => {
  const { loadRealGalleryCases } = await import("../scripts/gallery-case-source.js");
  const gallery = await loadRealGalleryCases();
  const case1476 = gallery.cases[1475];
  const expanded = expandStanli(case1476.source);
  const result = tikzToSvg(case1476.source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(expanded, /decoration=\{zigzag/);
  assert.match(expanded, /\$\(a\)\+\(0,0,-0\.26666/);
  const springs = result.ir.items.filter(
    (item) =>
      item.type === "path" &&
      item.subtype === "stanli-dspring" &&
      item.commands.length > 8 &&
      Math.abs(item.style?.lineWidth - lineWidthFromPt(1)) < 1e-6
  );
  assert.equal(springs.length, 2);
  assert.ok(
    result.ir.items.filter((item) => item.type === "path" && item.shape === "circle" && item.style?.fill === "white")
      .length >= 2,
    "expected hinge circles at the spring endpoints"
  );
});

test("renders stanli Case 1485 with spherical dload direction instead of treating rotation as length", async () => {
  const { loadRealGalleryCases } = await import("../scripts/gallery-case-source.js");
  const gallery = await loadRealGalleryCases();
  const case1485 = gallery.cases[1484];
  const expanded = expandStanli(case1485.source);
  const result = tikzToSvg(case1485.source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.doesNotMatch(expanded, /\+\+\(60:30\)/);
  assert.match(expanded, /\+\+\(0\.75,0\.43301[0-9]+,0\.5\)/);
  const load = result.ir.items.find(
    (item) =>
      item.type === "path" &&
      item.style?.stroke === "black" &&
      (item.style?.markerStart || item.style?.markerEnd) &&
      item.commands.length === 2
  );
  assert.ok(load, "expected a black load arrow path");
  const [from, to] = load.commands;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  assert.ok(length > 1.0 && length < 1.35, `expected dload projected length near native 1cm scale, got ${length}`);
  assert.ok(Math.hypot(from.x, from.y) > 0.1, "expected dload to start at force distance offset from point a");
});

test("renders the upstream hackl/TikZ-StructuralAnalysis example", () => {
  const source = readFileSync(new URL("../work/TikZ-StructuralAnalysis/example.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.length > 40);
  assert.equal(result.ast.pictures.length, 2);
});
