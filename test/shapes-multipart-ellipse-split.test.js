import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { ellipseSplitGeometry } from "../src/tikz/libraries/shapes.multipart.js";

function closeTo(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be close to ${expected}`);
}

test("ellipse split geometry follows PGF sqrt-two radii and outer separation", () => {
  const geometry = ellipseSplitGeometry({
    upper: { width: 2, height: 0.4, depth: 0.1 },
    lower: { width: 1, height: 0.3, depth: 0.05 }
  }, {
    innerXSep: 0.2,
    innerYSep: 0.1,
    lineWidth: 0.02,
    outerXSep: 0.04,
    outerYSep: 0.08,
    midlineOffset: 0.07
  });

  closeTo(geometry.visibleRadiusX, Math.SQRT2 * 1.2);
  closeTo(geometry.visibleRadiusY, Math.SQRT2 * 0.71);
  closeTo(geometry.anchors.east.x, geometry.visibleRadiusX + 0.04);
  closeTo(geometry.anchors.north.y, geometry.visibleRadiusY + 0.08);
  closeTo(geometry.anchors.lower.x, -0.5);
  closeTo(geometry.anchors.mid.y - geometry.anchors.base.y, 0.07);
});

test("ellipse split uses independent TeX boxes and a true elliptical border", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.multipart}
\begin{tikzpicture}
  \node[ellipse split,draw,inner xsep=4pt,inner ysep=3pt,
    minimum width=2cm,minimum height=1.2cm] (state)
    {$x^2$\nodepart{lower}$y_0$};
  \draw (state.lower) -- (state.east);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const anchorPath = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.shape, "ellipseSplit");
  assert.equal(labels.length, 2);
  assert.ok(labels[0].y > box.y);
  assert.ok(labels[1].y < box.y);
  assert.ok(anchorPath.commands[0].x < box.x);
  assert.ok(anchorPath.commands[0].y < box.y);
  assert.ok(anchorPath.commands.at(-1).x > box.x + box.width / 2);
  closeTo(anchorPath.commands.at(-1).y, box.y);
  assert.match(result.svg, /tikz-node-ellipse-split/);
});

test("ellipse split exposes PGF text, lower, base, mid, and compass anchors", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.multipart}
\begin{tikzpicture}
  \node[ellipse split,draw,outer xsep=2pt,outer ysep=4pt] (cell)
    {top\nodepart{lower}bottom};
  \draw[red] (cell.base west) -- (cell.base east);
  \draw[blue] (cell.mid west) -- (cell.mid east);
  \draw[green] (cell.north west) -- (cell.south east);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox");
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.shape, "ellipseSplit");
  assert.equal(paths.length, 3);
  closeTo(paths[0].commands[0].y, paths[0].commands.at(-1).y);
  closeTo(paths[1].commands[0].y, paths[1].commands.at(-1).y);
  assert.ok(paths[1].commands[0].y > paths[0].commands[0].y);
  assert.ok(paths[2].commands[0].x < box.x && paths[2].commands[0].y > box.y);
  assert.ok(paths[2].commands.at(-1).x > box.x && paths[2].commands.at(-1).y < box.y);
});
