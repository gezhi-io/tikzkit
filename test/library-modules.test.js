import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  calcLibrary,
  matrixLibrary,
  positioningLibrary,
  builtinTikzLibraries,
  knownTikzLibraries,
  supportedTikzLibraries,
  tikzLibraryCatalog
} from "../src/libraries/index.js";
import { isMatrixNodeOptions, matrixCellText } from "../src/libraries/matrix.js";
import { defaultPositioningDistance, positioningDelta, scalePositioningDistance } from "../src/libraries/positioning.js";

const OBSERVED_TIKZ_LIBRARIES = [
  "3d",
  "angles",
  "arrows",
  "arrows.meta",
  "automata",
  "babel",
  "backgrounds",
  "bayesnet",
  "bending",
  "bpmn",
  "calc",
  "calendar",
  "chains",
  "circuits",
  "circuits.ee.IEC",
  "circuits.pid",
  "circuits.pid.ISO14617",
  "decorations",
  "decorations.markings",
  "decorations.pathmorphing",
  "decorations.pathreplacing",
  "decorations.text",
  "ext.paths.arcto",
  "ext.paths.ortho",
  "ext.shapes.circlecrosssplit",
  "ext.shapes.superellipse",
  "ext.topaths.arcthrough",
  "ext.transformations.mirror",
  "fadings",
  "fit",
  "folding",
  "fpu",
  "graphs",
  "hobby",
  "intersections",
  "matrix",
  "mindmap",
  "patterns",
  "petri",
  "plotmarks",
  "positioning",
  "quotes",
  "scopes",
  "shadings",
  "shadows",
  "shadows.blur",
  "shapes",
  "shapes.arrows",
  "shapes.geometric",
  "shapes.misc",
  "shapes.multipart",
  "shapes.symbols",
  "snakes",
  "spline",
  "spy",
  "through",
  "tikzmark",
  "tqft",
  "trees",
  "unitcircle"
];

test("keeps observed TikZ libraries in one module per library name", () => {
  assert.deepEqual(builtinTikzLibraries, OBSERVED_TIKZ_LIBRARIES);
  assert.deepEqual(knownTikzLibraries, OBSERVED_TIKZ_LIBRARIES);
  assert.ok(supportedTikzLibraries.includes("calc"));
  assert.ok(supportedTikzLibraries.includes("positioning"));
  assert.ok(supportedTikzLibraries.includes("matrix"));
  assert.equal(tikzLibraryCatalog["3d"].status, "unsupported");
  assert.equal(calcLibrary.name, "calc");
  assert.equal(positioningLibrary.name, "positioning");
  assert.equal(matrixLibrary.name, "matrix");
  assert.equal(calcLibrary.status, "builtin");
  assert.equal(positioningLibrary.status, "builtin");
  assert.equal(matrixLibrary.status, "builtin");
});

test("matrix library exposes semantic helpers used by interpreter", () => {
  assert.equal(isMatrixNodeOptions({ "matrix of math nodes": true }), true);
  assert.equal(isMatrixNodeOptions({ draw: true }), false);
  assert.equal(matrixCellText("\\theta_0", { "matrix of math nodes": true }), "$\\theta_0$");
  assert.equal(matrixCellText("$\\theta_0$", { "matrix of math nodes": true }), "$\\theta_0$");
  assert.equal(matrixCellText("plain", { "matrix of nodes": true }), "plain");
});

test("positioning library exposes node-distance edge spacing helpers", () => {
  const env = { variables: {}, pictureOptions: { "node distance": "1.1cm and 1.6cm" } };
  const helpers = { canvasLengthScale: () => 1 };
  const distance = scalePositioningDistance(defaultPositioningDistance(env), env, helpers);
  const reference = { point: { x: 0, y: 0 }, width: 2, height: 1 };
  const selfSize = { width: 1, height: 0.5 };

  assert.equal(Number(distance.x.toFixed(2)), 1.6);
  assert.equal(Number(distance.y.toFixed(2)), 1.1);
  assert.equal(Number(positioningDelta("right", "x", distance, reference, selfSize).toFixed(2)), 3.1);
  assert.equal(Number(positioningDelta("above", "y", distance, reference, selfSize).toFixed(2)), 1.85);
});

test("has one source file for each observed usetikzlibrary name", () => {
  for (const library of OBSERVED_TIKZ_LIBRARIES) {
    assert.equal(
      existsSync(path.resolve("src", "libraries", `${library}.js`)),
      true,
      `missing src/libraries/${library}.js`
    );
  }
});
