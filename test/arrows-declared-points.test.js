import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { lowerDeclaredArrowTips, resolveDeclaredArrowGeometry } from "../src/tikz/libraries/arrows.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

const FIXTURE_ROOT = new URL("./fixtures/examples/arrows/", import.meta.url);

function source(name) {
  return readFileSync(new URL(name, FIXTURE_ROOT), "utf8");
}

function declaredPayload(input) {
  const lowered = lowerDeclaredArrowTips(input);
  const match = lowered.match(/tikzkit declared arrow=([0-9a-f]+)/i);
  assert.ok(match, "expected a lowered declared-arrow payload");
  const encoded = match[1].match(/../g).map((byte) => String.fromCharCode(Number.parseInt(byte, 16))).join("");
  return JSON.parse(decodeURIComponent(encoded));
}

function pathPoints(path) {
  return [...path.matchAll(/[ML]\s+(-?[0-9.]+)\s+(-?[0-9.]+)/gu)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2])
  }));
}

function assertPoint(actual, expected, unitsPerPt) {
  assert.ok(Math.abs(actual.x / unitsPerPt - expected.x) < 1e-5, `${actual.x / unitsPerPt} != ${expected.x}`);
  assert.ok(Math.abs(actual.y / unitsPerPt - expected.y) < 1e-5, `${actual.y / unitsPerPt} != ${expected.y}`);
}

test("adds nested Cartesian and quick-polar points in declared arrow paths", () => {
  const declaration = declaredPayload(source("declared-pointadd-flowchart.tex"));
  const geometry = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(1));
  const unitsPerPt = lineWidthFromPt(1);
  const points = pathPoints(geometry.path);

  assert.equal(points.length, 3);
  assertPoint(points[0], { x: 0.275 + 4.95 * Math.cos(150 * Math.PI / 180), y: -2.475 }, unitsPerPt);
  assertPoint(points[1], { x: 0.275, y: 0 }, unitsPerPt);
  assertPoint(points[2], { x: 0.275 + 4.95 * Math.cos(150 * Math.PI / 180), y: 2.475 }, unitsPerPt);
  assert.equal(geometry.paint, "stroke");
  assert.equal(geometry.lineCap, "round");
  assert.equal(geometry.lineJoin, "miter");
});

test("evaluates quick polar points around the declared-arrow origin", () => {
  const declaration = declaredPayload(source("declared-polar-math.tex"));
  const geometry = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(1));
  const unitsPerPt = lineWidthFromPt(1);
  const points = pathPoints(geometry.path);

  assert.equal(points.length, 3);
  assertPoint(points[0], { x: 6.75 * Math.cos(30 * Math.PI / 180), y: -3.375 }, unitsPerPt);
  assertPoint(points[1], { x: 0, y: 0 }, unitsPerPt);
  assertPoint(points[2], { x: 6.75 * Math.cos(30 * Math.PI / 180), y: 3.375 }, unitsPerPt);
  assert.match(geometry.path, / Z$/u);
});

test("evaluates ordinary elliptical polar points with independent radii", () => {
  const declaration = declaredPayload(source("declared-polar-physics.tex"));
  const thin = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(0.4));
  const geometry = resolveDeclaredArrowGeometry(declaration, lineWidthFromPt(1));
  const unitsPerPt = lineWidthFromPt(1);
  const points = pathPoints(geometry.path);

  assert.equal(points.length, 3);
  assertPoint(points[0], {
    x: 5.25 * Math.cos(145 * Math.PI / 180),
    y: -3.75 * Math.sin(145 * Math.PI / 180)
  }, unitsPerPt);
  assertPoint(points[1], { x: 0.75, y: 0 }, unitsPerPt);
  assertPoint(points[2], {
    x: 5.25 * Math.cos(145 * Math.PI / 180),
    y: 3.75 * Math.sin(145 * Math.PI / 180)
  }, unitsPerPt);
  assert.equal(geometry.paint, "fillstroke");
  assert.notEqual(thin.path, geometry.path);
});

test("renders recursive point expressions in all three domain fixtures", () => {
  for (const fixture of ["declared-pointadd-flowchart.tex", "declared-polar-math.tex", "declared-polar-physics.tex"]) {
    const result = tikzToSvg(source(fixture), { mathRenderer: "svg-text" });
    assert.deepEqual(result.diagnostics, [], fixture);
    assert.equal((result.svg.match(/class="tikz-arrow-tip/g) || []).length, 3, fixture);
  }
});
