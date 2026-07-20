import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const FIXTURE_ROOT = new URL("./fixtures/examples/latex-examples/", import.meta.url);
const LINE_SEGMENT_CASES = [
  ["line-segments-bounding-box", 135.24, 163.59],
  ["line-segments-f1", 220.28, 220.28],
  ["line-segments-f2", 177.76, 170.68],
  ["line-segments-f3", 78.55, 106.9],
  ["line-segments-f4", 106.9, 78.55],
  ["line-segments-f5", 191.94, 191.94],
  ["line-segments-f6", 78.55, 78.55],
  ["line-segments-f7", 135.24, 78.55],
  ["line-segments-f8", 163.59, 135.24],
  ["line-segments-t2", 248.63, 163.59],
  ["line-segments-t3", 78.55, 78.55],
  ["line-segments-t4", 78.55, 135.24],
  ["line-segments-t5", 163.59, 163.59],
  ["line-segments-t6", 220.28, 163.59]
];

function renderFixture(name) {
  const source = readFileSync(new URL(`${name}.tex`, FIXTURE_ROOT), "utf8");
  return tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
}

function svgDocumentSizePt(svg) {
  const match = svg.match(/\bwidth="([\d.]+)pt" height="([\d.]+)pt"/);
  assert.ok(match, "expected SVG document dimensions in TeX points");
  return { width: Number(match[1]), height: Number(match[2]) };
}

function assertSize(result, expectedWidth, expectedHeight) {
  const size = svgDocumentSizePt(result.svg);
  assert.ok(Math.abs(size.width - expectedWidth) <= 0.01, `expected width ${expectedWidth}pt, got ${size.width}pt`);
  assert.ok(Math.abs(size.height - expectedHeight) <= 0.01, `expected height ${expectedHeight}pt, got ${size.height}pt`);
}

test("line-segments new-30 fixtures preserve native bbox, endpoint crosses, grids, and arrows", async (t) => {
  for (const [name, expectedWidth, expectedHeight] of LINE_SEGMENT_CASES) {
    await t.test(name, () => {
      const result = renderFixture(name);
      const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
      const crosses = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "crossOut");
      const gridLines = result.ir.items.filter((item) => item.type === "path" && item.subtype === "grid-line");
      const axis = result.ir.items.find(
        (item) => item.type === "path" && item.style?.stroke === "red" && item.style?.markerStart && item.style?.markerEnd
      );
      const thickSegments = result.ir.items.filter(
        (item) => item.type === "path" && item.commands?.length === 2 && item.style?.lineWidth > 4
      );

      assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
      assertSize(result, expectedWidth, expectedHeight);
      assert.equal(crosses.length, 4);
      assert.ok(gridLines.length >= 10);
      assert.equal(axis?.style.markerStart.kind, "stealth-prime");
      assert.equal(axis?.style.markerEnd.kind, "stealth-prime");
      assert.equal(thickSegments.length, 2);
      assert.match(result.svg, /class="tikz-shape-cross-out"/);
    });
  }
});

test("overlapping segment cases retain TikZ draw order and endpoint multiplicity", () => {
  const t5 = renderFixture("line-segments-t5");
  const t6 = renderFixture("line-segments-t6");
  const thickSegments = (result) => result.ir.items.filter(
    (item) => item.type === "path" && item.commands?.length === 2 && item.style?.lineWidth > 4
  );

  assert.deepEqual(thickSegments(t5).map((item) => item.style.stroke), ["red", "blue"]);
  assert.deepEqual(thickSegments(t6).map((item) => item.style.stroke), ["red", "blue"]);
  assert.deepEqual(
    thickSegments(t6).map((item) => item.commands.map((command) => [command.x, command.y])),
    [
      [[7, -1], [3, 4]],
      [[7, -1], [3, 4]]
    ]
  );
  assert.deepEqual(
    t6.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "crossOut").map((item) => [item.x, item.y]),
    [[7, -1], [3, 4], [7, -1], [3, 4]]
  );
});

test("lines-intersections preserves all 15 segments and 30 to-path endpoint crosses", () => {
  const result = renderFixture("lines-intersections");
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const segments = result.ir.items.filter(
    (item) => item.type === "path" && item.commands?.length === 2 && item.style?.stroke === "black" && item.style?.lineWidth > 4
  );
  const crosses = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "crossOut");

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assertSize(result, 652.37, 255.52);
  assert.equal(segments.length, 15);
  assert.equal(crosses.length, 30);
  assert.deepEqual(segments[0].commands.map((command) => [command.x, command.y]), [[1, 4], [6, 1]]);
  assert.deepEqual(segments.at(-1).commands.map((command) => [command.x, command.y]), [[19, 1], [19, 5]]);
});

test("knot-trefoil preserves the shared cubic path, stroke, and native bbox", () => {
  const result = renderFixture("knot-trefoil");
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assertSize(result, 147.21, 127.75);
  assert.equal(path.style.stroke, "red");
  assert.ok(Math.abs(path.style.lineWidth - 7.029196071653643) < 1e-12);
  assert.equal(path.commands.filter((command) => command.type === "curveTo").length, 6);
  assert.equal(path.commands.length, 11);
});
