import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";
import { tikzLibrary as pathmorphingLibrary } from "../src/tikz/libraries/decorations.pathmorphing.js";

function bentPath(decoration, sourcePath = "(0,0) -- (4,0)") {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[blue,decorate,decoration={bent,${decoration}}] ${sourcePath};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find(
    (item) => item.type === "path" && item.style?.stroke === "blue"
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(path, "expected the decorated blue path");
  return path;
}

function expectClose(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be close to ${expected}`);
}

test("bent emits the native aspect-controlled cubic", () => {
  const path = bentPath("aspect=.3,amplitude=4mm");
  const curve = path.commands[1];

  assert.equal(curve.type, "curveTo");
  expectClose(curve.x1, 1.2);
  expectClose(curve.y1, parseDimension("4mm"));
  expectClose(curve.x2, 2.8);
  expectClose(curve.y2, parseDimension("4mm"));
  expectClose(curve.x, 4);
  expectClose(curve.y, 0);
});

test("bent defaults both cubic controls to aspect one half", () => {
  const path = bentPath("amplitude=2mm");
  const curve = path.commands[1];

  expectClose(curve.x1, 2);
  expectClose(curve.x2, 2);
  expectClose(curve.y1, parseDimension("2mm"));
  expectClose(curve.y2, parseDimension("2mm"));
});

test("bent restarts in each straight input segment frame", () => {
  const path = bentPath("aspect=.25,amplitude=2mm", "(0,0) -- (2,0) -- (2,2)");
  const [first, second] = path.commands.slice(1);

  assert.equal(first.type, "curveTo");
  assert.equal(second.type, "curveTo");
  expectClose(first.x, 2);
  expectClose(first.y, 0);
  expectClose(second.x1, 2 - parseDimension("2mm"));
  expectClose(second.y1, 0.5);
  expectClose(second.x2, 2 - parseDimension("2mm"));
  expectClose(second.y2, 1.5);
  expectClose(second.x, 2);
  expectClose(second.y, 2);
});

test("bent applies mirror before raise and leaves its transformed final endpoint", () => {
  const path = bentPath("aspect=.3,amplitude=3mm,mirror,raise=2mm");
  const curve = path.commands[1];

  expectClose(curve.y1, parseDimension("-5mm"));
  expectClose(curve.y2, parseDimension("-5mm"));
  expectClose(curve.y, parseDimension("-2mm"));
  assert.equal(path.commands.length, 2);
});

test("bent pre length shortens only the first input segment", () => {
  const path = bentPath("aspect=.3,amplitude=3mm,pre length=3mm");
  const preEnd = path.commands[1];
  const curve = path.commands[2];

  expectClose(preEnd.x, parseDimension("3mm"));
  expectClose(curve.x1, 1.41);
  expectClose(curve.x2, 2.89);
  expectClose(curve.x, 4);
});

test("bent post length prevents an oversized single-segment state", () => {
  const path = bentPath("aspect=.3,amplitude=3mm,post length=4mm");

  assert.equal(path.commands.some((command) => command.type === "curveTo"), false);
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 4, y: 0 });
});

test("bent preserves a signed amplitude", () => {
  const path = bentPath("aspect=.3,amplitude=-2mm");
  expectClose(path.commands[1].y1, parseDimension("-2mm"));
});

test("decorations.pathmorphing registry records native bent support", () => {
  assert.ok(pathmorphingLibrary.implements.includes("bent straight-segment pathmorphing subset"));
  assert.match(pathmorphingLibrary.implementedBy, /appendNativeBentPolyline/);
  assert.match(pathmorphingLibrary.notes, /one-cubic state over each remaining straight input segment/);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the pathmorphing bent ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathmorphing-bent/${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const expectedBentPaths = { flowchart: 3, math: 2, physics: 1 }[fixture];
    const bentPaths = result.ir.items.filter(
      (item) => item.type === "path" && item.commands.some((command) => command.type === "curveTo")
    );

    assert.deepEqual(result.diagnostics, []);
    assert.doesNotMatch(result.svg, /\bNaN\b/);
    assert.ok(
      bentPaths.length >= expectedBentPaths,
      `expected at least ${expectedBentPaths} cubic bent paths`
    );
  });
}
