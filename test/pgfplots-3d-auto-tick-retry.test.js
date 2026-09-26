import assert from "node:assert/strict";
import test from "node:test";

import { renderAxis3DGrid, renderAxis3DTicks } from "../src/pgfplots/axis3d.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";

function scene(min, max, options = {}, axis = "z") {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1,
    [`${axis}Min`]: min, [`${axis}Max`]: max };
  const axisOptions = {
    width: "8cm", height: "5.5cm", view: "{35}{30}",
    "pgfplots 3d surface": true, "scaled ticks": false,
    ...Object.fromEntries(["x", "y", "z"].filter((name) => name !== axis)
      .map((name) => [`${name}tick`, "\\empty"])),
    ...options
  };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const labels = renderAxis3DTicks(axisOptions, ranges, geometry)
    .filter((command) => command.includes("axis tick label"))
    .map((command) => Number(command.match(/\{([^{}]*)\};$/)?.[1].replaceAll("\u2212", "-")));
  return { axisOptions, ranges, geometry, labels };
}

test("compact signed 3D axes retry a rounded interval that leaves only zero", () => {
  for (const axis of ["x", "y", "z"]) {
    const { labels } = scene(-4.4, 4.4, { "max space between ticks": "100pt" }, axis);
    assert.deepEqual(labels, [-4, -2, 0, 2, 4], axis);
  }
});

test("automatic 3D ticks preserve PGF's asymmetric truncation-based retry check", () => {
  // Confirmed by local pgfplotsticks.code.tex and a pdfLaTeX probe.
  assert.deepEqual(scene(-2.99, -1.01).labels, [-2.5, -2, -1.5]);
  assert.deepEqual(scene(1.01, 2.99).labels, [2]);
  assert.deepEqual(scene(0, 6).labels, [0, 2, 4, 6]);
});

test("3D tick retry respects the requested minimum without forcing that many labels", () => {
  assert.deepEqual(scene(-4.4, 4.4, { "try min ticks": "2" }).labels, [-4, -2, 0, 2, 4]);
  assert.deepEqual(scene(-4.4, 4.4, { "try min ticks": "10" }).labels, [-4, -3, -2, -1, 0, 1, 2, 3, 4]);
});

test("explicit 3D ticks, distances and disabled ticks bypass automatic retries", () => {
  assert.deepEqual(scene(-4.4, 4.4, { ztick: "{0}" }).labels, [0]);
  assert.deepEqual(scene(-4.4, 4.4, { "ztick distance": "5" }).labels, [0]);
  assert.deepEqual(scene(-4.4, 4.4, { ztick: "\\empty" }).labels, []);
});

test("3D major grids share the retried major tick positions", () => {
  const { axisOptions, ranges, geometry } = scene(-4.4, 4.4, { grid: "major" });
  const automatic = renderAxis3DGrid(axisOptions, ranges, geometry);
  const explicit = renderAxis3DGrid({ ...axisOptions, ztick: "{-4,-2,0,2,4}" }, ranges, geometry);
  assert.deepEqual(automatic, explicit);
  assert.equal(automatic.length, 10);
});

test("logarithmic 3D tick planning remains separate from linear retries", () => {
  assert.deepEqual(scene(1, 100, { zmode: "log", zticklabel: "\\tick", "max space between ticks": "100pt" }).labels, [0, 1, 2]);
});
