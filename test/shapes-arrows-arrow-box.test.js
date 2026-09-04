import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  arrowBoxArrowSpecsFromOptions,
  arrowBoxBorderPoint,
  arrowBoxGeometry,
  arrowBoxLayoutSize,
  parseArrowBoxArrowSpecs
} from "../src/tikz/libraries/shapes.arrows.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("arrow box list resets directions and reuses the most recent length", () => {
  const specs = parseArrowBoxArrowSpecs("north:1cm,west,east:2cm from center");
  assert.deepEqual(specs, {
    north: "1cm",
    south: "0pt",
    east: "2cm from center",
    west: "1cm"
  });
});

test("directional arrow options override the arrow box shorthand in source order", () => {
  assert.deepEqual(arrowBoxArrowSpecsFromOptions({
    "arrow box arrows": "east:1cm,north",
    "arrow box west arrow": "2cm",
    "arrow box north arrow": "3cm from center"
  }), {
    north: "3cm from center",
    south: "0pt",
    east: "1cm",
    west: "2cm"
  });
});

test("arrow box layout distinguishes border and center relative lengths", () => {
  const layout = arrowBoxLayoutSize(2, 1, {
    minimumWidth: 2.4,
    minimumHeight: 1.2,
    outerXSep: 0.1,
    outerYSep: 0.05,
    shaftWidth: 0.4,
    headExtend: 0.25,
    headIndent: 0.1,
    tipAngle: 90,
    arrows: {
      east: { length: 1.1, fromCenter: true },
      west: { length: 0.7, fromCenter: false },
      north: { length: 0.5, fromCenter: false },
      south: { length: 0, fromCenter: false }
    }
  });

  close(layout.arrowBoxBodyHalfWidth, 1.2);
  close(layout.arrowBoxBodyHalfHeight, 0.6);
  close(layout.arrowBoxEastExtend, 1.1);
  close(layout.arrowBoxWestExtend, 2);
  close(layout.arrowBoxNorthExtend, 1.15);
  close(layout.arrowBoxSouthExtend, 0);
  close(layout.minX, -2);
  close(layout.maxX, 1.2);
});

test("arrow box geometry exposes directional vertices and numeric border anchors", () => {
  const layout = arrowBoxLayoutSize(2.2, 1, {
    outerXSep: 0.08,
    outerYSep: 0.06,
    shaftWidth: 0.35,
    headExtend: 0.22,
    headIndent: 0.08,
    tipAngle: 70,
    arrows: {
      east: { length: 0.8, fromCenter: false },
      west: { length: 0.6, fromCenter: false },
      north: { length: 1.4, fromCenter: true },
      south: { length: 0.5, fromCenter: false }
    }
  });
  const geometry = arrowBoxGeometry(layout, {
    ...layout,
    arrowBoxBaseOffset: -0.12,
    arrowBoxMidOffset: 0.16
  });

  assert.equal(geometry.visibleBoundaryPoints.length, 32);
  assert.ok(geometry.anchors["north arrow tip"].y > geometry.anchors["north east"].y);
  assert.ok(geometry.anchors["before east arrow head"].x < geometry.anchors["east arrow tip"].x);
  close(
    geometry.anchors["after south arrow tip"].y,
    -geometry.anchors["before north arrow tip"].y
  );
  assert.ok(
    geometry.anchors["after south arrow tip"].y > geometry.anchors["south arrow tip"].y,
    "PGF's south special anchor must differ from the south arrow's painted shoulder"
  );
  for (const direction of ["north", "south", "east", "west"]) {
    for (const name of [
      `${direction} arrow tip`,
      `before ${direction} arrow`,
      `before ${direction} arrow head`,
      `before ${direction} arrow tip`,
      `after ${direction} arrow tip`,
      `after ${direction} arrow head`,
      `after ${direction} arrow`
    ]) {
      assert.ok(Number.isFinite(geometry.anchors[name]?.x), `${name} x anchor is missing`);
      assert.ok(Number.isFinite(geometry.anchors[name]?.y), `${name} y anchor is missing`);
    }
  }
  close(geometry.anchors["base east"].y, -0.12);
  close(geometry.anchors["mid west"].y, 0.16);

  const numeric = arrowBoxBorderPoint(geometry, { x: -1, y: 1 });
  assert.ok(numeric.x < 0);
  assert.ok(numeric.y > 0);
});

test("arrow box preserves PGF's hidden-south anchor fallbacks", () => {
  const layout = arrowBoxLayoutSize(2, 1, {
    arrows: {
      east: { length: 0.8, fromCenter: true },
      west: { length: 0, fromCenter: false },
      north: { length: 0, fromCenter: false },
      south: { length: 0, fromCenter: false }
    }
  });
  const geometry = arrowBoxGeometry(layout, layout);

  assert.deepEqual(geometry.anchors["before south arrow tip"], geometry.anchors.south);
  assert.deepEqual(geometry.anchors["after south arrow head"], geometry.anchors.south);
  assert.deepEqual(geometry.anchors["south arrow tip"], geometry.anchors.east);
});

test("arrow box border follows PGF's hidden-south angular sectors", () => {
  const layout = arrowBoxLayoutSize(2.4, 1, {
    arrows: {
      east: { length: 0.8, fromCenter: false },
      west: { length: 0.6, fromCenter: false },
      north: { length: 0, fromCenter: false },
      south: { length: 0, fromCenter: false }
    }
  });
  const geometry = arrowBoxGeometry(layout, layout);
  const westward = arrowBoxBorderPoint(geometry, { x: -10, y: 0 });

  // This is intentionally not the nearest visible polygon intersection.
  // PGF's 2025 arrow-box border selector routes the 180-degree sector through
  // the hidden south-tip fallback, whose anchor is the east side.
  close(westward.x, geometry.anchors.east.x);
  close(westward.y, geometry.anchors.east.y);
});

test("TikZ arrow box rendering shares geometry with anchors and clipping", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{arrows.meta,shapes.arrows}
\begin{tikzpicture}[>=Latex]
  \node[shape=arrow box,draw,fill=cyan!18,minimum width=24mm,minimum height=10mm,
    arrow box arrows={north:14mm from center,south:5mm,east:8mm,west:6mm},
    arrow box shaft width=4mm,arrow box head extend=2.5mm,
    arrow box head indent=1mm,arrow box tip angle=70,outer sep=2pt] (hub) at (0,0) {Hub};
  \draw[->] (-4,1.2) -- (hub);
  \draw[->] (4,-1.2) -- (hub);
  \fill[red] (hub.before east arrow head) circle (1pt);
  \fill[blue] (hub.145) circle (1pt);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const node = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "hub");
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(node?.shape, "arrowBox");
  assert.match(result.svg, /tikz-node-arrowBox/);
  assert.equal(arrows.length, 2);

  const geometry = arrowBoxGeometry(node, node.shapeData);
  const northwest = arrowBoxBorderPoint(geometry, { x: -4, y: 1.2 });
  const southeast = arrowBoxBorderPoint(geometry, { x: 4, y: -1.2 });
  close(arrows[0].commands.at(-1).x - node.x, northwest.x, 0.03);
  close(arrows[0].commands.at(-1).y - node.y, northwest.y, 0.03);
  close(arrows[1].commands.at(-1).x - node.x, southeast.x, 0.03);
  close(arrows[1].commands.at(-1).y - node.y, southeast.y, 0.03);
});
