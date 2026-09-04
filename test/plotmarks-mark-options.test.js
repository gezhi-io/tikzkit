import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const fixture = (name) => readFileSync(
  new URL(`./fixtures/examples/plotmarks/${name}.tex`, import.meta.url),
  "utf8"
);

function commandBounds(item) {
  const points = [];
  for (const command of item.commands || []) {
    for (const [xKey, yKey] of [["x", "y"], ["x1", "y1"], ["x2", "y2"]]) {
      if (Number.isFinite(command[xKey]) && Number.isFinite(command[yKey])) {
        points.push({ x: command[xKey], y: command[yKey] });
      }
    }
  }
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y))
  };
}

test("applies complete mark options to direct flowchart plot marks", () => {
  const result = tikzToSvg(fixture("mark-options-flowchart"), { mathRenderer: "svg-text" });
  const marks = result.ir.items.filter((item) => item.shape === "plot-mark");
  const first = commandBounds(marks[0]);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 2);
  assert.notEqual(marks[0].style.stroke, "black");
  assert.notEqual(marks[0].style.fill, "black");
  assert.ok(marks[0].style.lineWidth > 2.5, "expected the local .9pt line width");
  assert.ok((first.minX + first.maxX) / 2 > 1.57, "expected transformed xshift at the first gate");
  assert.ok((first.minY + first.maxY) / 2 > 0.03, "expected transformed yshift at the first gate");
});

test("applies plot-local every-mark style and replacing PGFPlots mark options", () => {
  const result = tikzToSvg(fixture("mark-options-math"), { mathRenderer: "svg-text" });
  const diamonds = result.ir.items.filter((item) => item.type === "path" && item.style?.stroke === "rgb(0 0 179)");
  const triangles = result.ir.items.filter((item) => item.type === "path" && item.style?.stroke === "rgb(204 0 0)");
  const diamond = commandBounds(diamonds[0]);
  const triangle = commandBounds(triangles[0]);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(diamonds.length, 6, "expected five data marks and one legend sample");
  assert.equal(triangles.length, 6, "expected five data marks and one legend sample");
  assert.ok(diamond.maxY - diamond.minY > 0.34, "expected plot-local every mark scale=1.35");
  assert.equal(diamonds[0].style.fill, "rgb(204 204 255)");
  assert.equal(triangles[0].style.fill, "rgb(255 210 166)");
  assert.ok(diamonds[0].style.lineWidth > 2.4, "expected plot-local every mark line width=.7pt");
  assert.ok(triangles[0].style.lineWidth > 2.8, "expected replacing mark options line width=.8pt");
  assert.ok(triangle.maxX - triangle.minX > 1.8 * (triangle.maxY - triangle.minY), "expected anisotropic triangle geometry");
});

test("deforms open-circle physics samples with every mark transformations", () => {
  const result = tikzToSvg(fixture("mark-options-physics"), { mathRenderer: "svg-text" });
  const marks = result.ir.items.filter((item) => item.shape === "plot-mark" && item.mark === "o");
  const bounds = commandBounds(marks[0]);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 7);
  assert.notEqual(marks[0].style.stroke, "black");
  assert.equal(marks[0].style.fill, "none", "open marks must remain stroke-only");
  assert.ok(marks[0].style.lineWidth > 2.5, "expected every mark line width=1pt");
  assert.ok(bounds.maxX - bounds.minX > 1.8 * (bounds.maxY - bounds.minY), "expected rotated uncertainty ellipses");
});
