import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  starburstBorderPoint,
  starburstGeometry,
  starburstLayoutSize
} from "../src/tikz/libraries/shapes.symbols.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("starburst layout follows PGF elliptical incircle and minimum-size rules", () => {
  const elliptical = starburstLayoutSize(2, 1, {
    pointHeight: 0.4,
    shapeBorderRotate: 0
  });
  const quarterTurn = starburstLayoutSize(2, 1, {
    pointHeight: 0.4,
    shapeBorderRotate: 90
  });
  const incircle = starburstLayoutSize(2, 1, {
    pointHeight: 0.4,
    shapeBorderRotate: 27,
    shapeBorderUsesIncircle: true
  });

  close(elliptical.width, 2 * (1.41421 + 0.4));
  close(elliptical.height, 2 * (0.707105 + 0.4));
  close(quarterTurn.width, elliptical.height);
  close(quarterTurn.height, elliptical.width);
  close(incircle.width, incircle.height);
  assert.equal(incircle.rotation, 27);
  assert.equal(quarterTurn.rotation, 90);
});

test("starburst geometry reproduces the PGF seeded point-height sequence", () => {
  const size = starburstLayoutSize(2, 1, { pointHeight: 0.4 });
  const geometry = starburstGeometry(size, {
    starburstPoints: 5,
    starburstPointHeight: 0.4,
    randomStarburst: 100,
    starburstRotation: size.rotation
  });

  assert.equal(geometry.points.length, 10);
  assert.equal(geometry.outerPoints.length, 5);
  assert.equal(geometry.innerPoints.length, 5);
  close(geometry.pointHeightRatios[0], 0.7152325, 1e-7);
  close(geometry.pointHeightRatios[1], 0.4621, 1e-7);
  close(geometry.pointHeightRatios[2], 0.94297, 1e-7);
  close(geometry.outerPoints[0].x, 0);
  assert.ok(geometry.outerPoints[0].y > geometry.innerRadiusY);
});

test("starburst outer and inner point anchors include PGF mitered outer separation", () => {
  const size = starburstLayoutSize(2.2, 1.2, { pointHeight: 0.35 });
  const geometry = starburstGeometry(size, {
    starburstPoints: 9,
    starburstPointHeight: 0.35,
    randomStarburst: 0,
    starburstOuterSep: 0.08,
    starburstRotation: size.rotation
  });

  assert.ok(geometry.anchors["outer point 1"].y > geometry.outerPoints[0].y);
  assert.ok(Math.hypot(
    geometry.anchors["inner point 1"].x,
    geometry.anchors["inner point 1"].y
  ) > Math.hypot(geometry.innerPoints[0].x, geometry.innerPoints[0].y));
  close(
    starburstBorderPoint(geometry, { x: 0, y: 1 }).y,
    geometry.anchors.north.y
  );
});

test("TikZ starburst nodes share one geometry for paint, anchors, and edge clipping", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{arrows.meta,shapes.symbols}
\begin{tikzpicture}[>=Stealth]
  \node[starburst,starburst points=11,starburst point height=4mm,
    random starburst=23,minimum width=35mm,minimum height=18mm,
    outer sep=2pt,draw,fill=yellow!25] (event) {Event};
  \fill (event.outer point 1) circle (1pt);
  \fill (event.inner point 3) circle (1pt);
  \draw[->] (-3,0) -- (event);
  \draw[->] (event) -- (3,0);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const starburst = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "event");
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);
  const geometry = starburstGeometry(starburst, starburst.shapeData);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(starburst.shape, "starburst");
  assert.equal(starburst.shapeData.starburstPoints, 11);
  assert.equal(starburst.shapeData.randomStarburst, 23);
  assert.match(result.svg, /tikz-node-starburst/);
  assert.equal(
    result.ir.items.find((item) => item.type === "textNode" && item.text === "Event")?.nodeLayoutWidth,
    undefined
  );
  assert.equal(geometry.outlineCommands.filter((command) => command.type === "lineTo").length, 21);
  assert.equal(arrows.length, 2);
  close(arrows[0].commands.at(-1).x, starburst.x + geometry.anchors.west.x, 0.04);
  close(arrows[1].commands[0].x, starburst.x + geometry.anchors.east.x, 0.04);
});

test("empty starburst nodes honor minimum dimensions", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.symbols}
\begin{tikzpicture}
  \node[starburst,starburst points=8,random starburst=0,
    minimum width=30mm,minimum height=20mm,draw] (empty) {};
\end{tikzpicture}`);
  const starburst = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "empty");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(starburst.shape, "starburst");
  assert.ok(starburst.width >= 3);
  assert.ok(starburst.height >= 2);
  assert.equal(starburstGeometry(starburst, starburst.shapeData).outerPoints.length, 8);
});
