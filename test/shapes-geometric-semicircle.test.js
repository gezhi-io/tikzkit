import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  semicircleBorderPoint,
  semicircleGeometry,
  semicircleLayoutSize
} from "../src/tikz/libraries/shapes.geometric.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("semicircle layout follows PGF radius, minimum-size, and quarter-turn rules", () => {
  const natural = semicircleLayoutSize(1.2, 0.6);
  const enlarged = semicircleLayoutSize(1.2, 0.6, { minimumWidth: 3 });
  const tall = semicircleLayoutSize(1.2, 0.6, { minimumHeight: 2 });
  const rotated = semicircleLayoutSize(1.2, 0.6, { shapeBorderRotate: 46 });

  close(natural.semicircleRadius, Math.hypot(0.6, 0.6));
  close(natural.width, natural.semicircleRadius * 2);
  close(natural.height, natural.semicircleRadius);
  close(enlarged.semicircleRadius, 1.5);
  close(enlarged.semicircleCenterY, -0.3 - 0.4 * (1.5 - natural.semicircleRadius));
  close(tall.semicircleRadius, 2);
  assert.equal(rotated.semicircleShapeBorderRotate, 90);
  close(rotated.width, rotated.semicircleRadius);
  close(rotated.height, rotated.semicircleRadius * 2);
});

test("semicircle geometry separates painted and outer-separation anchor boundaries", () => {
  const layout = semicircleLayoutSize(1.2, 0.6, { minimumWidth: 3 });
  const geometry = semicircleGeometry(layout, {
    ...layout,
    semicircleOuterSep: 0.1,
    semicircleBaseOffset: -0.08,
    semicircleMidOffset: 0.12
  });

  close(geometry.bounds.maxX - geometry.bounds.minX, 3);
  close(geometry.bounds.maxY - geometry.bounds.minY, 1.5);
  close(geometry.anchors["chord center"].x, 0);
  close(geometry.anchors["chord center"].y, layout.semicircleCenterY - 0.1);
  close(geometry.anchors.apex.y, layout.semicircleCenterY + 1.6);
  assert.ok(geometry.anchors["arc start"].x > geometry.bounds.maxX);
  assert.ok(geometry.anchors["arc end"].x < geometry.bounds.minX);
  close(geometry.anchors["base east"].y, -0.08);
  close(geometry.anchors["base west"].y, -0.08);
  close(geometry.anchors["mid east"].y, 0.12);
  close(geometry.anchors["mid west"].y, 0.12);
});

test("TikZ semicircle nodes render an arc and clip automatic edges to arc and chord", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.geometric,arrows.meta}
\begin{tikzpicture}[>=Latex]
  \node[semicircle,draw,fill=blue!15,minimum width=24mm,
    minimum height=12mm,outer sep=2pt] (gate) at (0,0) {Gate};
  \draw[->] (0,2.5) -- (gate);
  \draw[->] (0,-2.5) -- (gate);
  \fill[red] (gate.apex) circle (1pt);
  \fill[green] (gate.chord center) circle (1pt);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const node = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "gate");
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(node?.shape, "semicircle");
  assert.match(result.svg, /tikz-node-semicircle/);
  assert.ok(result.svg.match(/tikz-node-semicircle[^>]+d="[^"]*C[^"]*C/));
  assert.equal(arrows.length, 2);

  const geometry = semicircleGeometry(node, node.shapeData);
  const fromNorth = semicircleBorderPoint(geometry, { x: 0, y: 1 });
  const fromSouth = semicircleBorderPoint(geometry, { x: 0, y: -1 });
  close(arrows[0].commands.at(-1).y - node.y, fromNorth.y, 0.02);
  close(arrows[1].commands.at(-1).y - node.y, fromSouth.y, 0.02);
  assert.ok(fromNorth.y > fromSouth.y);
});

test("semicircle named anchors rotate with shape border rotate", () => {
  const layout = semicircleLayoutSize(0.8, 0.5, {
    minimumWidth: 2.4,
    shapeBorderRotate: 90
  });
  const geometry = semicircleGeometry(layout, { ...layout, semicircleOuterSep: 0.05 });

  assert.equal(layout.semicircleShapeBorderRotate, 90);
  close(geometry.anchors.apex.x, layout.semicircleCenterX - (layout.semicircleRadius + 0.05));
  close(geometry.anchors.apex.y, 0);
  assert.ok(geometry.anchors["arc start"].y > geometry.anchors["arc end"].y);
});
