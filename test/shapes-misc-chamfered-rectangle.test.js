import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  chamferedRectangleBorderPoint,
  chamferedRectangleGeometry,
  chamferedRectangleLayoutSize
} from "../src/tikz/libraries/shapes.misc.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("chamfered rectangle layout follows PGF angle, separation, and minimum-size rules", () => {
  const natural = chamferedRectangleLayoutSize(2, 1, {
    angle: 45,
    xsep: 0.2,
    ysep: 0.3
  });

  close(natural.chamferedRectangleHalfContentWidth, 1);
  close(natural.chamferedRectangleHalfContentHeight, 0.5);
  close(natural.chamferedRectangleXSep, 0.2);
  close(natural.chamferedRectangleYCut, 0.2);
  close(natural.chamferedRectangleYSep, 0.3);
  close(natural.chamferedRectangleXCut, 0.3);
  close(natural.width, 2.4);
  close(natural.height, 1.6);

  const clamped = chamferedRectangleLayoutSize(0.4, 0.2, {
    angle: 45,
    xsep: 2,
    ysep: 2
  });
  close(clamped.chamferedRectangleXSep, 0.1);
  close(clamped.chamferedRectangleYCut, 0.1);
  close(clamped.chamferedRectangleYSep, 0.2);
  close(clamped.chamferedRectangleXCut, 0.2);

  const minimum = chamferedRectangleLayoutSize(1, 0.6, {
    angle: 45,
    xsep: 0.2,
    ysep: 0.2,
    minimumWidth: 3,
    minimumHeight: 2
  });
  close(minimum.width, 3);
  close(minimum.height, 2);
});

test("chamfered rectangle geometry keeps selective corners and PGF named anchors", () => {
  const layout = chamferedRectangleLayoutSize(2, 1, {
    angle: 30,
    xsep: 0.25,
    ysep: 0.2,
    corners: "north east, south west"
  });
  const geometry = chamferedRectangleGeometry(layout, {
    ...layout,
    chamferedRectangleOuterXSep: 0.08,
    chamferedRectangleOuterYSep: 0.12,
    chamferedRectangleBaseOffset: -0.1,
    chamferedRectangleMidOffset: 0.16
  });

  assert.equal(geometry.visibleBoundaryPoints.length, 12);
  assert.deepEqual(geometry.corners, {
    northEast: true,
    northWest: false,
    southEast: false,
    southWest: true
  });
  assert.ok(geometry.anchors["north east"].x < geometry.anchors["before north east"].x);
  close(geometry.anchors["north west"].x, -layout.width / 2 - 0.08);
  close(geometry.anchors["north west"].y, layout.height / 2 + 0.12);
  close(geometry.anchors.base.y, -0.1);
  close(geometry.anchors.mid.y, 0.16);
  assert.ok(geometry.anchors["base east"].x > 0);
  assert.ok(geometry.anchors["mid west"].x < 0);

  const squareLayout = chamferedRectangleLayoutSize(1.2, 0.6, {
    angle: 45,
    xsep: 0.2,
    ysep: 0.2,
    corners: "chamfer none"
  });
  const square = chamferedRectangleGeometry(squareLayout, squareLayout);
  assert.deepEqual(square.corners, {
    northEast: false,
    northWest: false,
    southEast: false,
    southWest: false
  });
  close(square.visibleAnchors["north east"].x, squareLayout.width / 2);
  close(square.visibleAnchors["north east"].y, squareLayout.height / 2);
});

test("TikZ chamfered rectangle nodes render shape options, anchors, and clipped arrows", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.misc,arrows.meta}
\begin{tikzpicture}[>=Latex]
  \node[shape=chamfered rectangle,draw,fill=cyan!18,
    chamfered rectangle angle=35,chamfered rectangle sep=3mm,
    chamfered rectangle corners={north east,south west},
    minimum width=32mm,minimum height=14mm,outer sep=2pt] (gate) at (0,0) {Validate};
  \draw[->] (-3,1.5) -- (gate);
  \draw[->] (3,-1.5) -- (gate);
  \fill[red] (gate.before north east) circle (1pt);
  \fill[green] (gate.after south west) circle (1pt);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const node = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "gate");
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(node?.shape, "chamferedRectangle");
  assert.equal(node?.shapeData?.chamferedRectangleAngle, 35);
  assert.deepEqual(node?.shapeData?.chamferedRectangleCorners, ["north east", "south west"]);
  assert.match(result.svg, /tikz-node-chamferedRectangle/);
  assert.equal(arrows.length, 2);

  const geometry = chamferedRectangleGeometry(node, node.shapeData);
  const northWest = chamferedRectangleBorderPoint(geometry, { x: -2, y: 1 });
  const southEast = chamferedRectangleBorderPoint(geometry, { x: 2, y: -1 });
  close(arrows[0].commands.at(-1).x - node.x, northWest.x, 0.03);
  close(arrows[0].commands.at(-1).y - node.y, northWest.y, 0.03);
  close(arrows[1].commands.at(-1).x - node.x, southEast.x, 0.03);
  close(arrows[1].commands.at(-1).y - node.y, southEast.y, 0.03);
});

test("numeric chamfered rectangle anchors use the outer-separation contour", () => {
  const layout = chamferedRectangleLayoutSize(1.4, 0.8, {
    angle: 60,
    xsep: 0.2,
    ysep: 0.2,
    corners: "chamfer all"
  });
  const geometry = chamferedRectangleGeometry(layout, {
    ...layout,
    chamferedRectangleOuterXSep: 0.1,
    chamferedRectangleOuterYSep: 0.05
  });
  const angle = 70 * Math.PI / 180;
  const numeric = chamferedRectangleBorderPoint(geometry, {
    x: Math.cos(angle),
    y: Math.sin(angle)
  });

  assert.ok(numeric.x > 0);
  assert.ok(numeric.y > layout.height / 2);
  assert.ok(numeric.y <= geometry.anchorBounds.maxY + 1e-9);
});
