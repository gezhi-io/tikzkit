import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { diamondSplitGeometry } from "../src/tikz/libraries/shapes.multipart.js";

function closeTo(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be close to ${expected}`);
}

test("diamond split geometry follows PGF part padding, aspect, and outer separation", () => {
  const geometry = diamondSplitGeometry({
    upper: { width: 2, height: 0.4, depth: 0.1 },
    lower: { width: 1, height: 0.3, depth: 0.05 }
  }, {
    innerXSep: 0.2,
    innerYSep: 0.1,
    outerXSep: 0.04,
    outerYSep: 0.08,
    minimumWidth: 0,
    minimumHeight: 0,
    aspect: 2,
    midlineOffset: 0.07
  });

  closeTo(geometry.anchorRadiusX, 3.04);
  closeTo(geometry.anchorRadiusY, 1.58);
  closeTo(geometry.visibleRadiusX, 3.04 - Math.SQRT2 * 0.04);
  closeTo(geometry.visibleRadiusY, 1.58 - Math.SQRT2 * 0.08);
  closeTo(geometry.separatorRadiusX, 3);
  closeTo(geometry.anchors["north east"].x, geometry.anchorRadiusX / 2);
  closeTo(geometry.anchors.mid.y - geometry.anchors.base.y, 0.07);
});

test("diamond split creates independent text boxes and a split diamond border", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.multipart}
\begin{tikzpicture}
  \node[diamond split,draw,inner xsep=4pt,inner ysep=3pt,
    minimum width=2cm,minimum height=1.4cm] (state)
    {$x^2$\nodepart{lower}$y_0$};
  \draw (state.lower) -- (state.east);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const anchorPath = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.shape, "diamondSplit");
  assert.equal(labels.length, 2);
  assert.ok(labels[0].y > box.y);
  assert.ok(labels[1].y < box.y);
  assert.ok(anchorPath.commands[0].x < box.x);
  assert.ok(anchorPath.commands[0].y < box.y);
  assert.ok(anchorPath.commands.at(-1).x > box.x + box.width / 2);
  closeTo(anchorPath.commands.at(-1).y, box.y);
  assert.match(result.svg, /tikz-node-diamond-split/);
});

test("diamond split exposes text, lower, base, mid, and compass anchors", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.multipart}
\begin{tikzpicture}
  \node[diamond split,draw,aspect=1.4,outer xsep=2pt,outer ysep=4pt] (cell)
    {top\nodepart{lower}bottom};
  \draw[red] (cell.base) -- (cell.mid);
  \draw[green] (cell.north west) -- (cell.south east);
  \draw[blue] (cell.text) -- (cell.lower);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox");
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.shape, "diamondSplit");
  assert.equal(paths.length, 3);
  closeTo(paths[0].commands[0].x, paths[0].commands.at(-1).x);
  assert.ok(paths[0].commands.at(-1).y > paths[0].commands[0].y);
  assert.ok(paths[1].commands[0].x < box.x && paths[1].commands[0].y > box.y);
  assert.ok(paths[1].commands.at(-1).x > box.x && paths[1].commands.at(-1).y < box.y);
  assert.ok(paths[2].commands[0].y > box.y);
  assert.ok(paths[2].commands.at(-1).y < box.y);
});

test("diamond split physics formula uses TeX undelimited frac arguments without widening the node", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{arrows.meta,shapes.geometric,shapes.multipart}
\begin{tikzpicture}[>=Latex]
  \node[diamond split,draw,aspect=1.25,inner xsep=6pt,inner ysep=4pt,
    minimum width=43mm,minimum height=28mm] (energy)
    {$E_k=\frac12mv^2$\nodepart{lower}$E_p=mgh$};
  \draw[-Latex] (-42mm,0) -- (energy.west);
  \draw[-Latex] (energy.lower) -- ++(0,-14mm);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "energy");

  assert.deepEqual(result.diagnostics, []);
  closeTo(box.width, 4.79, 0.06);
  closeTo(box.height, 3.83, 0.06);
  assert.match(result.svg, /tikz-inline-fraction/);
  assert.doesNotMatch(result.svg, /\\frac12|>frac12</);
});
