import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { tikzLibrary as pathmorphingLibrary } from "../src/tikz/libraries/decorations.pathmorphing.js";

function straightZigzagPath(decoration, sourcePath = "(0,0) -- (4.5,0)") {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[blue,decorate,decoration={straight zigzag,${decoration}}] ${sourcePath};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find(
    (item) => item.type === "path" && item.style?.stroke === "blue"
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(path, "expected the decorated blue path");
  return path;
}

function expectPoint(actual, x, y, tolerance = 1e-8) {
  assert.ok(Math.abs(actual.x - x) <= tolerance, `expected x=${x}, got ${actual.x}`);
  assert.ok(Math.abs(actual.y - y) <= tolerance, `expected y=${y}, got ${actual.y}`);
}

test("straight zigzag alternates native curveto and zigzag meta states", () => {
  const path = straightZigzagPath(
    "meta-segment length=10mm,segment length=4mm,amplitude=2mm"
  );
  const expected = [
    [0, 0],
    [0.99, 0],
    [1.09, 0.2],
    [1.29, -0.2],
    [1.49, 0.2],
    [1.69, -0.2],
    [1.89, 0.2],
    [1.99, 0],
    [2.98, 0],
    [3.08, 0.2],
    [3.28, -0.2],
    [3.48, 0.2],
    [3.68, -0.2],
    [3.88, 0.2],
    [3.98, 0],
    [4.5, 0]
  ];

  assert.equal(path.commands.length, expected.length);
  path.commands.forEach((command, index) => expectPoint(command, ...expected[index]));
});

test("straight zigzag preserves native child-state remainders", () => {
  const path = straightZigzagPath(
    "meta-segment length=11mm,segment length=4mm,amplitude=2mm"
  );
  const expected = [
    [1.08, 0],
    [1.18, 0.2],
    [2.08, 0],
    [3.16, 0],
    [3.26, 0.2],
    [4.16, 0],
    [4.5, 0]
  ];

  let fromIndex = 0;
  for (const [x, y] of expected) {
    const index = path.commands.findIndex(
      (command, candidate) => candidate >= fromIndex
        && Math.abs(command.x - x) <= 1e-8
        && Math.abs(command.y - y) <= 1e-8
    );
    assert.ok(index >= fromIndex, `expected native state point (${x}, ${y})`);
    fromIndex = index + 1;
  }
});

test("straight zigzag matches native direct-meta transform and pre/post behavior", () => {
  const path = straightZigzagPath(
    "meta-segment length=10mm,segment length=4mm,amplitude=2mm,"
      + "pre length=3mm,post length=4mm,mirror,raise=1mm"
  );

  expectPoint(path.commands[1], 0, -0.1);
  expectPoint(path.commands[2], 0.945, -0.1);
  expectPoint(path.commands[3], 0.99, 0);
  expectPoint(path.commands[4], 1.09, 0.2);
  expectPoint(path.commands.at(-1), 4.5, 0);
  assert.equal(path.commands.some((command) => Math.abs(command.x - 0.3) <= 1e-8), false);
});

test("straight zigzag follows curved input during each curveto child", () => {
  const path = straightZigzagPath(
    "meta-segment length=8mm,segment length=3mm,amplitude=1mm",
    "(0,0) .. controls (0,1.5) and (2,1.5) .. (2,0)"
  );

  assert.ok(path.commands.length > 20);
  assert.ok(path.commands.some((command) => command.y > 1));
  expectPoint(path.commands.at(-1), 2, 0);
});

test("decorations.pathmorphing registry records native straight zigzag support", () => {
  assert.ok(pathmorphingLibrary.implements.includes("straight zigzag metadecoration subset"));
  assert.match(pathmorphingLibrary.implementedBy, /appendNativeStraightZigzagPolyline/);
  assert.match(pathmorphingLibrary.notes, /alternates curveto and zigzag child decorations/);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the pathmorphing straight zigzag ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathmorphing-straight-zigzag/${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const decorated = result.ir.items.filter(
      (item) => item.type === "path" && item.commands.length >= 5
    );

    assert.deepEqual(result.diagnostics, []);
    assert.doesNotMatch(result.svg, /\bNaN\b/);
    assert.ok(decorated.length >= 1);
  });
}
