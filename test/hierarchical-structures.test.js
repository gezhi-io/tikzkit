import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { TIKZ_LINE_WIDTHS, lineWidthFromPt } from "../src/tikz-metrics.js";

test("installs every picture style at the beginning of each picture", () => {
  const result = tikzToSvg(String.raw`
\tikzset{every picture/.style={red,line width=2pt}}
\begin{tikzpicture}
  \draw (0,0) -- (1,0);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.style.stroke, "red");
  assert.equal(path.style.lineWidth, lineWidthFromPt(2));
});

test("installs every scope style at the beginning of each scope without leaking outward", () => {
  const result = tikzToSvg(String.raw`
\tikzset{every scope/.style={blue,thick}}
\begin{tikzpicture}
  \draw (0,0) -- (1,0);
  \begin{scope}
    \draw (0,1) -- (1,1);
  \end{scope}
\end{tikzpicture}`);
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths.length, 2);
  assert.equal(paths[0].style.stroke, "black");
  assert.equal(paths[0].style.lineWidth, TIKZ_LINE_WIDTHS.thin);
  assert.equal(paths[1].style.stroke, "blue");
  assert.equal(paths[1].style.lineWidth, TIKZ_LINE_WIDTHS.thick);
});
