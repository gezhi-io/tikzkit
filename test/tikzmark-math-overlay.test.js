import assert from "node:assert/strict";
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
  assert.match(preprocessed.source, /fit=\(1\.north west\) \(2\.south east\)/);
  assert.match(preprocessed.source, /fit=\(3\.north west\) \(3\.south east\)/);
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
  assert.ok(width > 147 && width < 152, `unexpected document width ${width}pt`);
});
