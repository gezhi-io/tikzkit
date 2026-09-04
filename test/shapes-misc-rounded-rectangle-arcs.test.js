import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  roundedRectangleBorderPoint,
  roundedRectangleGeometry,
  roundedRectangleLayoutSize
} from "../src/tikz/libraries/shapes.misc.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("rounded rectangle layout follows PGF arc radius, chord, and asymmetric end rules", () => {
  const layout = roundedRectangleLayoutSize(2, 1, {
    innerXSep: 0.2,
    innerYSep: 0.3,
    arcLength: 120,
    westArc: "concave",
    eastArc: "convex"
  });
  const halfAngle = Math.PI / 3;
  const radius = 0.8 / Math.sin(halfAngle);
  const arcWidth = radius * (1 - Math.cos(halfAngle));
  const chordWidth = radius - Math.sqrt(radius * radius - 0.25);

  close(layout.roundedRectangleHalfHeight, 0.8);
  close(layout.roundedRectangleRadius, radius);
  close(layout.roundedRectangleArcWidth, arcWidth);
  close(layout.roundedRectangleChordWidth, chordWidth);
  close(layout.roundedRectangleHalfWidth, 1.2);
  close(layout.minX, -1.2 - arcWidth);
  close(layout.maxX, 1.2 + chordWidth);
  close(layout.width, layout.maxX - layout.minX);
  close(layout.height, 1.6);
});

test("rounded rectangle geometry keeps convex, concave, and straight side contours distinct", () => {
  const layout = roundedRectangleLayoutSize(1.6, 0.6, {
    innerXSep: 0.2,
    innerYSep: 0.25,
    arcLength: 90,
    westArc: "none",
    eastArc: "concave"
  });
  const geometry = roundedRectangleGeometry(layout, {
    ...layout,
    roundedRectangleOuterXSep: 0.1,
    roundedRectangleOuterYSep: 0.08,
    roundedRectangleBaseOffset: -0.12,
    roundedRectangleMidOffset: 0.15
  });

  assert.equal(geometry.westArc, "none");
  assert.equal(geometry.eastArc, "concave");
  close(geometry.anchors.west.x, -layout.roundedRectangleHalfWidth - 0.1);
  assert.ok(geometry.anchors.east.x > layout.maxX);
  close(geometry.anchors.north.y, layout.roundedRectangleHalfHeight + 0.08);
  close(geometry.anchors["base east"].y, -0.12);
  close(geometry.anchors["mid west"].y, 0.15);
  assert.ok(geometry.outlineCommands.some((command) => command.type === "curveTo"));
  assert.ok(geometry.outlineCommands.some((command) => command.type === "lineTo"));
});

test("TikZ rounded rectangle arc keys drive path rendering, anchors, and automatic clipping", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.misc,arrows.meta}
\begin{tikzpicture}[>=Latex]
  \node[shape=rounded rectangle,draw,fill=cyan!18,
    rounded rectangle arc length=120,
    rounded rectangle left arc=concave,
    rounded rectangle right arc=none,
    minimum width=32mm,minimum height=14mm,outer sep=2pt] (gate) at (0,0) {Validate};
  \draw[->] (-3,1.2) -- (gate);
  \draw[->] (3,-1.2) -- (gate);
  \fill[red] (gate.north west) circle (1pt);
  \fill[green] (gate.east) circle (1pt);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const node = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "gate");
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(node?.shape, "roundedRectangle");
  assert.equal(node?.shapeData?.roundedRectangleArcLength, 120);
  assert.equal(node?.shapeData?.roundedRectangleWestArc, "concave");
  assert.equal(node?.shapeData?.roundedRectangleEastArc, "none");
  assert.match(result.svg, /tikz-node-roundedRectangle/);
  assert.equal(arrows.length, 2);

  const geometry = roundedRectangleGeometry(node, node.shapeData);
  const northwest = roundedRectangleBorderPoint(geometry, { x: -3, y: 1.2 });
  const southeast = roundedRectangleBorderPoint(geometry, { x: 3, y: -1.2 });
  close(arrows[0].commands.at(-1).x - node.x, northwest.x, 0.03);
  close(arrows[0].commands.at(-1).y - node.y, northwest.y, 0.03);
  close(arrows[1].commands.at(-1).x - node.x, southeast.x, 0.03);
  close(arrows[1].commands.at(-1).y - node.y, southeast.y, 0.03);
});

test("numeric rounded rectangle anchors use the convex arc and outer separation", () => {
  const layout = roundedRectangleLayoutSize(1.4, 0.7, {
    innerXSep: 0.2,
    innerYSep: 0.2,
    arcLength: 120,
    westArc: "convex",
    eastArc: "convex"
  });
  const geometry = roundedRectangleGeometry(layout, {
    ...layout,
    roundedRectangleOuterXSep: 0.1,
    roundedRectangleOuterYSep: 0.05
  });
  const angle = 25 * Math.PI / 180;
  const numeric = roundedRectangleBorderPoint(geometry, {
    x: Math.cos(angle),
    y: Math.sin(angle)
  });

  assert.ok(numeric.x > layout.roundedRectangleHalfWidth);
  assert.ok(numeric.y > 0);
  assert.ok(numeric.x <= geometry.anchorBounds.maxX + 1e-9);
});

test("wide rounded rectangles select the outward convex ellipse intersection", () => {
  const layout = roundedRectangleLayoutSize(6, 0.7, {
    innerXSep: 0.2,
    innerYSep: 0.2,
    arcLength: 120,
    westArc: "convex",
    eastArc: "convex"
  });
  const geometry = roundedRectangleGeometry(layout, {
    ...layout,
    roundedRectangleOuterXSep: 0.1,
    roundedRectangleOuterYSep: 0.05
  });
  const east = roundedRectangleBorderPoint(geometry, { x: 1, y: 0 });
  const west = roundedRectangleBorderPoint(geometry, { x: -1, y: 0 });

  close(east.x, geometry.anchors.east.x);
  close(west.x, geometry.anchors.west.x);
  close(east.y, 0);
  close(west.y, 0);
});
