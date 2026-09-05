import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

function bounds(commands = []) {
  const points = [];
  for (const command of commands) {
    for (const [xKey, yKey] of [["x", "y"], ["x1", "y1"], ["x2", "y2"]]) {
      if (Number.isFinite(command[xKey]) && Number.isFinite(command[yKey])) {
        points.push({ x: command[xKey], y: command[yKey] });
      }
    }
  }
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y))
  };
}

test("executes a preamble pgfdeclareplotmark circle at every direct TikZ plot point", () => {
  const result = tikzToSvg(String.raw`
\documentclass[border=2pt]{standalone}
\usepackage{tikz}
\usetikzlibrary{plotmarks}
\pgfdeclareplotmark{shifted ring}
  {\pgfpathcircle{\pgfpoint{0cm}{1ex}}{1ex}\pgfusepathqstroke}
\begin{document}
\begin{tikzpicture}
  \draw[blue,mark size=3pt] plot[mark=shifted ring]
    coordinates {(0,0) (1,1)};
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });
  const marks = result.ir.items.filter((item) => item.shape === "plot-mark");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 2);
  assert.ok(marks.every((mark) => mark.mark === "shifted ring"));
  assert.ok(marks.every((mark) => mark.style.fill === "none"));
  const first = bounds(marks[0].commands);
  assert.ok(first.minY > -0.01, "the declared circle should sit above, not around, the data point");
  assert.ok(first.maxY > 0.29, "the 1ex radius and 1ex offset should be evaluated at use time");
});

test("resolves pgfplotmarksize inside custom move and line path commands", () => {
  const result = tikzToSvg(String.raw`
\pgfdeclareplotmark{wide bar}{
  \pgfpathmoveto{\pgfqpoint{-\pgfplotmarksize}{0pt}}
  \pgfpathlineto{\pgfqpoint{\pgfplotmarksize}{0pt}}
  \pgfusepathqstroke
}
\begin{tikzpicture}
  \draw[red,mark size=5pt] plot[mark=wide bar] coordinates {(2,3)};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const mark = result.ir.items.find((item) => item.shape === "plot-mark");
  const markBounds = bounds(mark?.commands);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(mark);
  assert.equal(mark.commands.length, 2);
  assert.ok(markBounds.minX < 1.83 && markBounds.maxX > 2.17);
  assert.ok(Math.abs(markBounds.minY - 3) < 1e-8 && Math.abs(markBounds.maxY - 3) < 1e-8);
});

test("reuses filled custom plot-mark declarations inside PGFPlots", () => {
  const result = tikzToSvg(String.raw`
\documentclass[border=2pt]{standalone}
\usepackage{pgfplots}
\usetikzlibrary{plotmarks}
\pgfdeclareplotmark{solid caret}{
  \pgfpathmoveto{\pgfqpoint{0pt}{\pgfplotmarksize}}
  \pgfpathlineto{\pgfqpoint{\pgfplotmarksize}{-\pgfplotmarksize}}
  \pgfpathlineto{\pgfqpoint{-\pgfplotmarksize}{-\pgfplotmarksize}}
  \pgfpathclose
  \pgfusepathqfillstroke
}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=2,ymin=0,ymax=2,width=5cm,height=4cm]
    \addplot[only marks,blue,mark=solid caret,mark size=4pt]
      coordinates {(1,1)};
  \end{axis}
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });
  const mark = result.ir.items.find((item) => item.subtype === "axis-mark" && item.commands?.length === 4);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(mark, "the PGFPlots marker should use the named custom declaration");
  assert.equal(mark.style.fill, "blue");
  assert.equal(mark.commands.at(-1)?.type, "closePath");
});
