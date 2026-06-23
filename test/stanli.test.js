import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stanliExtension, tikzToSvg } from "../src/index.js";

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

test("renders the upstream hackl/TikZ-StructuralAnalysis example", () => {
  const source = readFileSync(new URL("../work/TikZ-StructuralAnalysis/example.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.length > 40);
  assert.equal(result.ast.pictures.length, 2);
});
