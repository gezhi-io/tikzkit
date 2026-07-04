import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { TIKZ_LINE_WIDTHS } from "../src/tikz-metrics.js";

test("installs every path style at the beginning of each path", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[every path/.style={draw,blue,thick}]
  \path (0,0) -- (1,0);
\end{tikzpicture}`);
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths.length, 1);
  assert.equal(paths[0].style.stroke, "blue");
  assert.equal(paths[0].style.lineWidth, TIKZ_LINE_WIDTHS.thick);
});

test("applies path-stream options to the whole path action and style", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \path (0,0) [draw, red, thick] -- (1,0);
\end{tikzpicture}`);
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths.length, 1);
  assert.equal(paths[0].style.stroke, "red");
  assert.equal(paths[0].style.lineWidth, TIKZ_LINE_WIDTHS.thick);
  assert.deepEqual(paths[0].commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 1, y: 0 }
  ]);
});
