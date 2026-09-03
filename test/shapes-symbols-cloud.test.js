import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  cloudBorderPoint,
  cloudGeometry,
  cloudLayoutSize
} from "../src/tikz/libraries/shapes.symbols.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("cloud layout follows PGF aspect fitting and circum-ellipse sizing", () => {
  const wide = cloudLayoutSize(3, 1, {
    puffs: 10,
    puffArc: 150,
    aspect: 2
  });
  const ignored = cloudLayoutSize(3, 1, {
    puffs: 10,
    puffArc: 150,
    aspect: 2,
    ignoresAspect: true
  });

  assert.ok(wide.width / wide.height > 1.4);
  assert.ok(ignored.width / ignored.height > wide.width / wide.height);
  assert.ok(wide.width > 3);
  assert.ok(wide.height > 1);
});

test("cloud geometry builds two circular Bezier arcs per puff", () => {
  const size = cloudLayoutSize(2.4, 1.1, {
    puffs: 7,
    puffArc: 125,
    aspect: 2.2
  });
  const geometry = cloudGeometry(size, {
    cloudPuffs: 7,
    cloudPuffArc: 125,
    cloudOuterSep: 0.08
  });

  assert.equal(geometry.puffs.length, 7);
  assert.equal(geometry.outlineCommands.filter((command) => command.type === "curveTo").length, 14);
  assert.equal(geometry.outlineCommands.at(-1).type, "closePath");
  assert.ok(geometry.anchors["puff 1"].y > size.height / 2);
  close(
    cloudBorderPoint(geometry, { x: 10, y: 0 }).x,
    geometry.anchors.east.x,
    0.015
  );
});

test("TikZ cloud nodes share puff geometry across paint, anchors, and edge clipping", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{arrows.meta,shapes.symbols}
\begin{tikzpicture}[>=Stealth]
  \node[cloud,cloud puffs=7,cloud puff arc=125,aspect=2.2,
    minimum width=42mm,minimum height=18mm,outer sep=2pt,draw] (set) {$\mathcal U$};
  \fill (set.puff 1) circle (1pt);
  \draw[->] (-3,0) -- (set);
  \draw[->] (set) -- (3,0);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const cloud = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "set");
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);
  const geometry = cloudGeometry(cloud, cloud.shapeData);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(cloud.shape, "cloud");
  assert.equal(cloud.shapeData.cloudPuffs, 7);
  assert.equal(cloud.shapeData.cloudPuffArc, 125);
  assert.match(result.svg, /tikz-node-cloud/);
  assert.match(result.svg, /C [^Z]+ C /);
  assert.equal(paths.length, 2);
  close(paths[0].commands.at(-1).x, cloud.x + geometry.anchors.west.x, 0.04);
  close(paths[1].commands[0].x, cloud.x + geometry.anchors.east.x, 0.04);
});

test("cloud anchors may explicitly use the circum-ellipse", () => {
  const geometry = cloudGeometry({ width: 4, height: 2 }, {
    cloudPuffs: 10,
    cloudPuffArc: 150,
    cloudOuterSep: 0.2,
    cloudAnchorsUseEllipse: true
  });
  const east = cloudBorderPoint(geometry, { x: 1, y: 0 });

  close(east.x, 2);
  close(east.y, 0);
});

test("empty cloud nodes still honor minimum dimensions", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.symbols}
\begin{tikzpicture}
  \node[cloud,cloud puffs=10,minimum width=30mm,minimum height=20mm,draw] (empty) {};
\end{tikzpicture}`);
  const cloud = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "empty");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(cloud.width >= 3);
  assert.ok(cloud.height >= 2);
  assert.equal(cloudGeometry(cloud, cloud.shapeData).puffs.length, 10);
});
