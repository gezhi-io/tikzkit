import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  circularSectorBorderPoint,
  circularSectorGeometry,
  circularSectorLayoutSize
} from "../src/tikz/libraries/shapes.geometric.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("circular sector layout follows PGF content, minimum-size, and quarter-turn rules", () => {
  const halfAngle = Math.PI / 6;
  const natural = circularSectorLayoutSize(1.2, 0.8, { sectorAngle: 60 });
  const expectedOffset = 0.4 / Math.tan(halfAngle) + 0.6;
  const expectedRadius = Math.hypot(expectedOffset + 0.6, 0.4);

  close(natural.circularSectorCenterOffset, expectedOffset);
  close(natural.circularSectorRadius, expectedRadius);
  close(natural.width, expectedRadius);
  close(natural.height, expectedRadius);

  const wide = circularSectorLayoutSize(1.2, 0.8, {
    sectorAngle: 60,
    minimumWidth: 4
  });
  assert.ok(wide.circularSectorCenterOffset > natural.circularSectorCenterOffset);
  assert.ok(wide.circularSectorRadius > natural.circularSectorRadius);

  const tall = circularSectorLayoutSize(1.2, 0.8, {
    sectorAngle: 60,
    minimumHeight: 3
  });
  close(tall.circularSectorRadius, 3);

  const rotated = circularSectorLayoutSize(1.2, 0.8, {
    sectorAngle: 60,
    shapeBorderRotate: 46
  });
  assert.equal(rotated.circularSectorShapeBorderRotate, 90);
});

test("circular sector geometry separates paint from the rounded and mitered anchor border", () => {
  const layout = circularSectorLayoutSize(1.2, 0.8, { sectorAngle: 70 });
  const geometry = circularSectorGeometry(layout, {
    ...layout,
    circularSectorOuterSep: 0.1,
    circularSectorBaseOffset: -0.08,
    circularSectorMidOffset: 0.12
  });
  const halfAngle = 35 * Math.PI / 180;

  close(
    geometry.anchors["sector center"].x - geometry.visibleAnchors["sector center"].x,
    0.1 / Math.sin(halfAngle)
  );
  assert.ok(geometry.anchors["arc start"].y > geometry.visibleAnchors["arc start"].y);
  assert.ok(geometry.anchors["arc end"].y < geometry.visibleAnchors["arc end"].y);
  close(geometry.anchors.base.y, -0.08);
  close(geometry.anchors.mid.y, 0.12);

  const west = circularSectorBorderPoint(geometry, { x: -1, y: 0 });
  close(west.x, geometry.sectorCenter.x - geometry.anchorRadius);
});

test("TikZ circular sector nodes render options, named anchors, and automatic clipping", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.geometric,arrows.meta}
\begin{tikzpicture}[>=Latex]
  \node[circular sector,draw,fill=cyan!18,circular sector angle=72,
    minimum width=28mm,minimum height=20mm,outer sep=2pt] (slice) at (0,0) {Route};
  \draw[->] (-3,0) -- (slice);
  \draw[->] (3,0) -- (slice);
  \fill[red] (slice.arc start) circle (1pt);
  \fill[green] (slice.sector center) circle (1pt);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const node = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "slice");
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(node?.shape, "circularSector");
  assert.equal(node?.shapeData?.circularSectorAngle, 72);
  assert.match(result.svg, /tikz-node-circularSector/);
  assert.match(result.svg, /tikz-node-circularSector[^>]+d="[^"]*C/);
  assert.equal(arrows.length, 2);

  const geometry = circularSectorGeometry(node, node.shapeData);
  const west = circularSectorBorderPoint(geometry, { x: -1, y: 0 });
  const east = circularSectorBorderPoint(geometry, { x: 1, y: 0 });
  close(arrows[0].commands.at(-1).x - node.x, west.x, 0.02);
  close(arrows[1].commands.at(-1).x - node.x, east.x, 0.02);
});

test("circular sector incircle mode preserves arbitrary border rotation and numeric anchors", () => {
  const layout = circularSectorLayoutSize(0.9, 0.6, {
    sectorAngle: 80,
    shapeBorderRotate: 27,
    shapeBorderUsesIncircle: true
  });
  const geometry = circularSectorGeometry(layout, {
    ...layout,
    circularSectorOuterSep: 0.05
  });
  const numeric = circularSectorBorderPoint(geometry, {
    x: Math.cos(30 * Math.PI / 180),
    y: Math.sin(30 * Math.PI / 180)
  });

  assert.equal(layout.circularSectorShapeBorderRotate, 27);
  assert.ok(geometry.anchors["sector center"].y > 0);
  assert.ok(geometry.anchors["arc start"].y > geometry.anchors["arc end"].y);
  assert.ok(Math.hypot(numeric.x, numeric.y) > 0);
});
