import test from "node:test";
import assert from "node:assert/strict";
import { tikzToSvg } from "../src/index.js";
import {
  diamondBorderPoint,
  diamondGeometry,
  diamondLayoutSize
} from "../src/tikz/libraries/shapes.geometric.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
}

test("diamond layout follows PGF aspect sizing before independent minimum dimensions", () => {
  const natural = diamondLayoutSize(2, 1, { aspect: 2 });
  close(natural.width, 4);
  close(natural.height, 2);

  const minimum = diamondLayoutSize(0.4, 0.2, {
    aspect: 1.5,
    minimumWidth: 3.4,
    minimumHeight: 2.2
  });
  close(minimum.width, 3.4);
  close(minimum.height, 2.2);
});

test("diamond geometry separates the PGF anchor contour from the contracted paint contour", () => {
  const geometry = diamondGeometry(
    { width: 3.4, height: 2.2 },
    { diamondOuterXSep: 0.246, diamondOuterYSep: 0.07 }
  );

  close(geometry.anchorHalfWidth, 1.946);
  close(geometry.anchorHalfHeight, 1.17);
  close(geometry.paintHalfWidth, 1.946 - Math.SQRT2 * 0.246);
  close(geometry.paintHalfHeight, 1.17 - Math.SQRT2 * 0.07);
  close(geometry.anchors["north east"].x, 0.973);
  close(geometry.anchors["north east"].y, 0.585);

  const border = diamondBorderPoint(geometry, { x: 1, y: 1 });
  const expected = 1 / (1 / geometry.anchorHalfWidth + 1 / geometry.anchorHalfHeight);
  close(border.x, expected);
  close(border.y, expected);
});

test("diamond paint, named anchors, numeric anchors, and clipping share the source-derived geometry", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{arrows.meta,shapes.geometric}
\begin{tikzpicture}
  \node[diamond,aspect=1.5,draw,line width=2pt,minimum width=34mm,minimum height=22mm,
    inner sep=0pt,outer xsep=7pt,outer ysep=2pt] (d) at (0,0) {$x$};
  \draw[->] (-3,0) -- (d);
  \draw[red] (d.north east) -- (d.south west);
  \draw[blue] (d.30) -- ++(.5,0);
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  const diamond = result.ir.items.find((item) => item.type === "nodeBox" && item.shape === "diamond");
  assert.ok(diamond);
  close(diamond.width, 3.4);
  close(diamond.height, 2.2);
  close(diamond.shapeData.diamondOuterXSep, 7 / 28.4527559, 1e-5);
  close(diamond.shapeData.diamondOuterYSep, 2 / 28.4527559, 1e-5);

  const geometry = diamondGeometry(diamond, diamond.shapeData);
  assert.ok(geometry.paintHalfWidth < diamond.width / 2);
  assert.ok(geometry.paintHalfHeight < diamond.height / 2);
  assert.match(result.svg, /class="tikz-node-shape tikz-node-diamond"/);

  const paths = result.ir.items.filter((item) => item.type === "path");
  const incoming = paths.find((path) => path.style?.markerEnd);
  const named = paths.find((path) => path.style?.stroke === "red");
  const numeric = paths.find((path) => path.style?.stroke === "blue");
  close(incoming.commands.at(-1).x, -geometry.anchorHalfWidth, 1e-5);
  close(named.commands[0].x, geometry.anchorHalfWidth / 2, 1e-5);
  close(named.commands[0].y, geometry.anchorHalfHeight / 2, 1e-5);
  close(numeric.commands[0].x, diamondBorderPoint(geometry, { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) }).x, 1e-5);
});
