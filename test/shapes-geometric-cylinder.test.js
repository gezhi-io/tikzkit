import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  cylinderBorderPoint,
  cylinderGeometry,
  cylinderLayoutSize
} from "../src/tikz/libraries/shapes.geometric.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("cylinder layout preserves PGF width/height semantics through quarter rotation", () => {
  const horizontal = cylinderLayoutSize(1.2, 0.6, {
    aspect: 0.5,
    innerYSep: 0.1,
    minimumHeight: 2
  });
  const vertical = cylinderLayoutSize(0.6, 1.2, {
    aspect: 0.5,
    innerXSep: 0.1,
    minimumHeight: 2,
    shapeBorderRotate: 90
  });
  const wideEnds = cylinderLayoutSize(0.6, 0.5, {
    aspect: 0.5,
    innerYSep: 0.1,
    minimumWidth: 1.5
  });

  close(horizontal.width, 2);
  close(vertical.width, horizontal.height);
  close(vertical.height, horizontal.width);
  close(wideEnds.height, 1.5);
});

test("cylinder geometry exposes curved paths, named anchors, and curved border hits", () => {
  const geometry = cylinderGeometry({ width: 2.4, height: 1.2 }, {
    cylinderAspect: 0.5,
    cylinderInnerYSep: 0.1,
    cylinderLineWidth: 0.02
  });
  const diagonal = cylinderBorderPoint(geometry, { x: 2, y: 1 });

  assert.ok(geometry.outlineCommands.filter((command) => command.type === "curveTo").length >= 6);
  assert.ok(geometry.bodyCommands.some((command) => command.type === "curveTo"));
  assert.ok(geometry.endCommands.some((command) => command.type === "curveTo"));
  assert.ok(geometry.anchors.top.x > geometry.anchors["before top"].x);
  assert.ok(geometry.anchors.bottom.x < geometry.anchors["before bottom"].x);
  assert.ok(diagonal.x < geometry.bounds.maxX && diagonal.y < geometry.bounds.maxY);
});

test("TikZ cylinder nodes render body/end fills and use curved anchors", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.geometric,arrows.meta}
\begin{tikzpicture}
  \node[cylinder,shape border rotate=90,shape aspect=.4,draw,
    minimum width=1.6cm,minimum height=2.4cm,cylinder uses custom fill,
    cylinder body fill=orange!20,cylinder end fill=orange!45] (tank) at (0,0) {Tank};
  \draw[->] (tank.shape center) -- (tank.east);
  \draw (tank.before bottom) -- (tank.before top);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const cylinder = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "tank");
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(cylinder?.shape, "cylinder");
  assert.equal(cylinder?.shapeData.cylinderUsesCustomFill, true);
  assert.equal(cylinder?.shapeData.cylinderBodyFill, "rgb(255 230 204)");
  assert.match(result.svg, /tikz-node-cylinder-body/);
  assert.match(result.svg, /tikz-node-cylinder-end/);
  assert.match(result.svg, /tikz-node-cylinder-outline/);
  assert.ok(paths.length >= 2);
  const expectedGeometry = cylinderGeometry(cylinder, cylinder.shapeData);
  close(paths[0].commands[0].y, expectedGeometry.anchors["shape center"].y);
  close(paths[0].commands.at(-1).x, cylinder.width / 2);
});
