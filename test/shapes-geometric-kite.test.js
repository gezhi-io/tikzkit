import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  kiteBorderPoint,
  kiteGeometry,
  kiteLayoutSize
} from "../src/tikz/libraries/shapes.geometric.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("kite layout follows PGF upper/lower-angle content construction and minimum scaling", () => {
  const natural = kiteLayoutSize(1.2, 0.8, {
    upperVertexAngle: 120,
    lowerVertexAngle: 60
  });
  const expectedUpperContent = 0.2;
  const expectedLowerContent = 0.6;
  const expectedHalfWidth = 0.6 + Math.tan(Math.PI / 3) * expectedUpperContent;
  const expectedHeight = expectedUpperContent + 0.6 / Math.tan(Math.PI / 3);
  const expectedDepth = expectedLowerContent + 0.6 / Math.tan(Math.PI / 6);

  close(natural.kiteHalfWidth, expectedHalfWidth);
  close(natural.kiteHeight, expectedHeight);
  close(natural.kiteDepth, expectedDepth);
  close(natural.kiteDeltaY, 0.2);
  close(natural.width, expectedHalfWidth * 2);
  close(natural.height, expectedHeight + expectedDepth);

  const enlarged = kiteLayoutSize(1.2, 0.8, {
    upperVertexAngle: 120,
    lowerVertexAngle: 60,
    minimumHeight: 4
  });
  close(enlarged.height, 4);
  close(enlarged.kiteDeltaY, natural.kiteDeltaY);
  assert.ok(enlarged.width > natural.width);

  const rotated = kiteLayoutSize(1.2, 0.8, {
    upperVertexAngle: 120,
    lowerVertexAngle: 60,
    shapeBorderRotate: 46
  });
  assert.equal(rotated.kiteShapeBorderRotate, 90);
  assert.ok(rotated.width > rotated.height);
});

test("kite geometry keeps visible vertices separate from mitered anchor vertices", () => {
  const layout = kiteLayoutSize(1.2, 0.8, {
    upperVertexAngle: 120,
    lowerVertexAngle: 60
  });
  const geometry = kiteGeometry(layout, {
    ...layout,
    kiteOuterSep: 0.1,
    kiteBaseOffset: -0.08,
    kiteMidOffset: 0.12
  });

  close(geometry.bounds.maxX - geometry.bounds.minX, layout.width);
  close(geometry.bounds.maxY - geometry.bounds.minY, layout.height);
  close(
    geometry.anchors["upper vertex"].y - geometry.visibleAnchors["upper vertex"].y,
    0.1 / Math.sin(Math.PI / 3)
  );
  close(
    geometry.visibleAnchors["lower vertex"].y - geometry.anchors["lower vertex"].y,
    0.1 / Math.sin(Math.PI / 6)
  );
  close(geometry.anchors["base east"].y, -0.08);
  close(geometry.anchors["base west"].y, -0.08);
  close(geometry.anchors["mid east"].y, 0.12);
  close(geometry.anchors["mid west"].y, 0.12);
  close(
    geometry.anchors["upper left side"].x,
    (geometry.anchors["upper vertex"].x + geometry.anchors["left vertex"].x) / 2
  );
});

test("TikZ kite nodes render angle options and clip automatic edges to the polygon", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.geometric,arrows.meta}
\begin{tikzpicture}[>=Latex]
  \node[kite,draw,fill=blue!15,kite vertex angles=100 and 50,
    minimum width=24mm,minimum height=18mm,outer sep=2pt] (gate) at (0,0) {Gate};
  \draw[->] (0,3) -- (gate);
  \draw[->] (-3,0) -- (gate);
  \fill[red] (gate.upper vertex) circle (1pt);
  \fill[green] (gate.lower right side) circle (1pt);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const node = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "gate");
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(node?.shape, "kite");
  assert.equal(node?.shapeData?.kiteUpperVertexAngle, 100);
  assert.equal(node?.shapeData?.kiteLowerVertexAngle, 50);
  assert.match(result.svg, /tikz-node-kite/);
  assert.equal(arrows.length, 2);

  const geometry = kiteGeometry(node, node.shapeData);
  const north = kiteBorderPoint(geometry, { x: 0, y: 1 });
  const west = kiteBorderPoint(geometry, { x: -1, y: 0 });
  close(arrows[0].commands.at(-1).y - node.y, north.y, 0.02);
  close(arrows[1].commands.at(-1).x - node.x, west.x, 0.02);
});

test("kite named anchors and border rotate together", () => {
  const layout = kiteLayoutSize(0.9, 0.6, {
    upperVertexAngle: 100,
    lowerVertexAngle: 50,
    shapeBorderRotate: 90
  });
  const geometry = kiteGeometry(layout, { ...layout, kiteOuterSep: 0.05 });

  assert.equal(layout.kiteShapeBorderRotate, 90);
  assert.ok(geometry.anchors["upper vertex"].x < geometry.anchors["lower vertex"].x);
  close(geometry.anchors["upper vertex"].y, 0);
  close(geometry.anchors["lower vertex"].y, 0);
});
