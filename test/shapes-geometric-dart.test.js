import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  dartBorderPoint,
  dartGeometry,
  dartLayoutSize
} from "../src/tikz/libraries/shapes.geometric.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("dart layout follows PGF tip/tail-angle construction and minimum scaling", () => {
  const tipHalf = Math.PI / 8;
  const tailHalf = 3 * Math.PI / 8;
  const natural = dartLayoutSize(1.2, 0.8, {
    tipAngle: 45,
    tailAngle: 135
  });
  const expectedDartLength = 0.4 / Math.tan(tipHalf) + 1.2;
  const expectedHalfTailSeparation = expectedDartLength * Math.sin(tipHalf) *
    Math.cos(tipHalf) / Math.sin(tailHalf - tipHalf);
  const expectedTotalLength = expectedHalfTailSeparation / Math.tan(tipHalf);
  const expectedTailLength = expectedTotalLength - expectedDartLength;

  close(natural.dartLength, expectedDartLength);
  close(natural.dartHalfTailSeparation, expectedHalfTailSeparation);
  close(natural.dartTailLength, expectedTailLength);
  close(natural.dartDeltaX, 0.6);
  close(natural.width, expectedTotalLength);
  close(natural.height, expectedHalfTailSeparation * 2);

  const axialMinimum = dartLayoutSize(1.2, 0.8, {
    tipAngle: 45,
    tailAngle: 135,
    minimumHeight: 4
  });
  close(axialMinimum.width, 4);

  const tailMinimum = dartLayoutSize(1.2, 0.8, {
    tipAngle: 45,
    tailAngle: 135,
    minimumWidth: 3
  });
  close(tailMinimum.height, 3);

  const rotated = dartLayoutSize(1.2, 0.8, {
    tipAngle: 45,
    tailAngle: 135,
    shapeBorderRotate: 46
  });
  assert.equal(rotated.dartShapeBorderRotate, 90);
  assert.ok(rotated.height > rotated.width);
});

test("dart geometry separates visible concave paint from mitered anchors", () => {
  const layout = dartLayoutSize(1.2, 0.8, { tipAngle: 50, tailAngle: 130 });
  const geometry = dartGeometry(layout, {
    ...layout,
    dartOuterSep: 0.1,
    dartBaseOffset: -0.08,
    dartMidOffset: 0.12
  });

  close(
    geometry.anchors.tip.x - geometry.visibleAnchors.tip.x,
    0.1 / Math.sin(25 * Math.PI / 180)
  );
  close(
    geometry.visibleAnchors["tail center"].x - geometry.anchors["tail center"].x,
    0.1 / Math.sin(65 * Math.PI / 180)
  );
  close(geometry.anchors["base east"].y, -0.08);
  close(geometry.anchors["base west"].y, -0.08);
  close(geometry.anchors["mid east"].y, 0.12);
  close(geometry.anchors["mid west"].y, 0.12);
  close(
    geometry.anchors["left side"].x,
    (geometry.anchors.tip.x + geometry.anchors["left tail"].x) / 2
  );
});

test("TikZ dart nodes render angle options and clip automatic edges to the concave border", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.geometric,arrows.meta}
\begin{tikzpicture}[>=Latex]
  \node[dart,draw,fill=orange!20,dart tip angle=55,dart tail angle=125,
    minimum height=30mm,minimum width=18mm,outer sep=2pt] (packet) at (0,0) {Send};
  \draw[->] (-3,0) -- (packet);
  \draw[->] (0,3) -- (packet);
  \fill[red] (packet.tip) circle (1pt);
  \fill[green] (packet.left side) circle (1pt);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const node = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "packet");
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(node?.shape, "dart");
  assert.equal(node?.shapeData?.dartTipAngle, 55);
  assert.equal(node?.shapeData?.dartTailAngle, 125);
  assert.match(result.svg, /tikz-node-dart/);
  assert.equal(arrows.length, 2);

  const geometry = dartGeometry(node, node.shapeData);
  const west = dartBorderPoint(geometry, { x: -1, y: 0 });
  const north = dartBorderPoint(geometry, { x: 0, y: 1 });
  close(arrows[0].commands.at(-1).x - node.x, west.x, 0.02);
  close(arrows[1].commands.at(-1).y - node.y, north.y, 0.02);
});

test("dart named anchors and incircle border rotate together", () => {
  const layout = dartLayoutSize(0.9, 0.6, {
    tipAngle: 55,
    tailAngle: 125,
    shapeBorderRotate: 27,
    shapeBorderUsesIncircle: true
  });
  const geometry = dartGeometry(layout, { ...layout, dartOuterSep: 0.05 });

  assert.equal(layout.dartShapeBorderRotate, 27);
  assert.ok(geometry.anchors.tip.y > 0);
  assert.ok(geometry.anchors["left tail"].y > geometry.anchors["right tail"].y);
  assert.notEqual(geometry.anchors["tail center"].x, geometry.visibleAnchors["tail center"].x);
});
