import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseTikz, preprocessTikzSource } from "../src/frontend/index.js";
import { tikzToSvg } from "../src/index.js";

const jordanSource = String.raw`
\documentclass{article}
\usepackage[pdftex,active,tightpage]{preview}
\setlength\PreviewBorder{2mm}
\usepackage{tikz}
\usetikzlibrary{fit,matrix,positioning}
\tikzset{highlight/.style={rectangle,rounded corners,fill=#1!15,draw,fill opacity=0.5,inner sep=1pt}}
\newcommand{\tikzmark}[2]{
  \tikz[overlay,remember picture,baseline=(#1.base)] \node (#1) {#2};
}
\newcommand{\Highlight}[3]{
  \tikz[overlay,remember picture]{\node[highlight=#3,fit=(#1.north west) (#2.south east)] {};}
}
\begin{document}
\begin{preview}
$
A_{\lambda_i}=\left(
\begin{array}{*5{c}}
\tikzmark{1}{$\lambda_i$}&1&0&&0\\
&\lambda_i&1&&\\
&&\lambda_i\tikzmark{2}{}&&\\
&&&\ddots&\\
0&&&&\tikzmark{3}{$\lambda_i$}\tikzmark{4}{}\\
\end{array}
\right)
\Highlight{1}{2}{blue}
\Highlight{3}{4}{red}
$
\end{preview}
\end{document}`;

test("lowers standalone tikzmark math arrays to matrix and fit semantics", () => {
  const preprocessed = preprocessTikzSource(jordanSource);

  assert.doesNotMatch(preprocessed.source, /\\setlength/);
  assert.match(preprocessed.source, /\\matrix \(tikzkit-marked-array-1\)/);
  assert.match(preprocessed.source, /left delimiter=left parenthesis/);
  assert.match(preprocessed.source, /tikzkit preserve math size/);
  assert.match(preprocessed.source, /column sep=0\.30cm/);
  assert.match(preprocessed.source, /fit=\(1\.north west\) \(2\.south east\)/);
  assert.match(preprocessed.source, /fit=\(3\.north west\) \(3\.south east\)/);
  assert.match(preprocessed.source, /minimum width=0\.48cm,minimum height=0\.56cm/);
  assert.equal(preprocessed.previewBorder, 0.2);
});

test("renders the Jordan array, delimiters, and both native-sized highlight regions", () => {
  const parsed = parseTikz(jordanSource);
  const result = tikzToSvg(jordanSource);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const blue = boxes.find((item) => item.style.fill === "rgb(217 217 255)");
  const red = boxes.find((item) => item.style.fill === "rgb(255 217 217)");
  const delimiters = result.ir.items.filter((item) => item.subtype === "matrix-delimiter");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.ir.previewBorder, 0.2);
  assert.equal(delimiters.length, 2);
  assert.ok(labels.includes(String.raw`$A_{\lambda_i}=$`));
  assert.ok(labels.filter((text) => text === String.raw`$\lambda_i$`).length >= 4);
  assert.ok(blue, "expected the upper-left blue fit overlay");
  assert.ok(red, "expected the lower-right red fit overlay");
  assert.ok(blue.width > 1.9 && blue.height > 1.38 && blue.height < 1.43, `unexpected blue fit size ${blue.width}x${blue.height}`);
  assert.ok(red.width > 0.45 && red.height > 0.54 && red.height < 0.58, `unexpected red fit size ${red.width}x${red.height}`);
  assert.equal(blue.style.fillOpacity, 0.5);
  assert.equal(red.style.fillOpacity, 0.5);
  assert.ok(blue.y > red.y && blue.x < red.x);
  const lambdaFontSize = Number(result.svg.match(/<text[^>]+font-size="([0-9.]+)"[^>]*><tspan>λ<\/tspan>/)?.[1]);
  assert.ok(lambdaFontSize > 33, `matrix lambda was incorrectly shrunk to ${lambdaFontSize}`);
  const width = Number(result.svg.match(/\bwidth="([0-9.]+)pt"/)?.[1]);
  const height = Number(result.svg.match(/\bheight="([0-9.]+)pt"/)?.[1]);
  assert.ok(width > 147 && width < 152, `unexpected document width ${width}pt`);
  assert.ok(height > 76 && height < 80, `unexpected document height ${height}pt`);
});

test("keeps renderer cell fitting enabled for ordinary math matrices", () => {
  const ordinary = tikzToSvg(String.raw`
\begin{tikzpicture}
  \matrix [matrix of math nodes] { \lambda_i & 1 \\ 0 & 3 \\ };
\end{tikzpicture}`);
  const lowered = tikzToSvg(jordanSource);
  const ordinaryMatrixCells = ordinary.ir.items.filter((item) => item.type === "textNode" && item.text.includes("lambda"));
  const loweredMatrixCells = lowered.ir.items.filter((item) => item.type === "textNode" && item.text === String.raw`$\lambda_i$`);

  assert.deepEqual(ordinary.diagnostics, []);
  assert.deepEqual(lowered.diagnostics, []);
  assert.ok(ordinaryMatrixCells.some((item) => item.fitBox), "ordinary matrix cells should retain existing fitted text boxes");
  assert.ok(loweredMatrixCells.every((item) => !item.fitBox), "only the lowered tikzmark matrix should preserve natural math size");
});

test("lowers inline tabular tikzmarks into matrix anchors for an overlay brace", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/cache-4-way-associative.tex", "utf8");
  const preprocessed = preprocessTikzSource(source);
  const result = tikzToSvg(source);

  assert.match(preprocessed.source, /\\matrix \(tikzkit-tabular-1\)/);
  assert.match(preprocessed.source, /\\coordinate \(a\) at \(tikzkit-tabular-1-2-2\.base east\)/);
  assert.match(preprocessed.source, /\\coordinate \(b\) at \(tikzkit-tabular-1-5-2\.base east\)/);
  assert.match(
    preprocessed.source,
    /\\draw\[line width=\.4pt\] \(\[yshift=-2pt\]tikzkit-tabular-1-row-1-south-west\) -- \(\[yshift=-2pt\]tikzkit-tabular-1-row-1-south-east\);/,
    "expected the second rule generated by a double \\hline"
  );
  assert.doesNotMatch(preprocessed.source, /\\begin\{tikzpicture\}\s*\[remember picture,overlay\]/);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.coordinates.a.y > result.ir.coordinates.b.y, "expected mark a above mark b");
  assert.ok(
    result.ir.items.some((item) => item.type === "path" && item.commands?.length === 7),
    "expected the tabular overlay brace path"
  );
  const brace = result.ir.items.find((item) => item.type === "path" && item.commands?.length === 7);
  const braceLabel = result.ir.items.find((item) => item.type === "textNode" && item.text.includes("blibla"));
  assert.ok(brace);
  assert.ok(braceLabel);
  assert.ok(
    braceLabel.x > Math.max(...brace.commands.map((command) => command.x ?? Number.NEGATIVE_INFINITY)) + 0.2,
    "expected a sloped yshift to move the brace label to the path's outside"
  );

  const straightRules = result.ir.items
    .filter((item) => item.type === "path" && item.commands?.length === 2)
    .map((item) => item.commands);
  assert.ok(
    straightRules.some(([from, to]) => from.x === to.x),
    "expected the tabular column rule to remain vertically aligned across rows"
  );
  assert.ok(
    straightRules.some(([from, to]) => from.y === to.y),
    "expected the tabular header rule to remain horizontally aligned across columns"
  );
  const horizontalRules = straightRules.filter(([from, to]) => from.y === to.y);
  assert.ok(horizontalRules.length >= 2, "expected both strokes generated by a double \\hline");
  assert.ok(
    Math.abs(horizontalRules[0][0].y - horizontalRules[1][0].y) > 0.06,
    "expected the double rule strokes to retain their 2pt separation"
  );
});
