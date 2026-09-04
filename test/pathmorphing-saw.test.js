import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";
import { tikzLibrary as pathmorphingLibrary } from "../src/tikz/libraries/decorations.pathmorphing.js";

function sawPath(decoration, sourcePath = "(0,0) -- (2.5,0)") {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[blue,decorate,decoration={saw,${decoration}}] ${sourcePath};
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

test("saw follows the native full-tooth and automatic-end states", () => {
  const path = sawPath("segment length=10mm,amplitude=3mm");
  const length = parseDimension("10mm");
  const amplitude = parseDimension("3mm");

  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: 0 });
  expectClose(path.commands[1].x, length);
  expectClose(path.commands[1].y, amplitude);
  expectClose(path.commands[2].x, length);
  expectClose(path.commands[2].y, 0);
  expectClose(path.commands[3].x, 2 * length);
  expectClose(path.commands[3].y, amplitude);
  expectClose(path.commands[4].x, 2 * length);
  expectClose(path.commands[4].y, 0);
  assert.deepEqual(path.commands[5], { type: "lineTo", x: 2.5, y: 0 });
});

test("saw applies mirror then raise to teeth, baselines, and its automatic end", () => {
  const path = sawPath("segment length=10mm,amplitude=3mm,mirror,raise=2mm");

  expectClose(path.commands[1].y, parseDimension("-5mm"));
  expectClose(path.commands[2].y, parseDimension("-2mm"));
  expectClose(path.commands.at(-1).x, 2.5);
  expectClose(path.commands.at(-1).y, parseDimension("-2mm"));
});

test("saw keeps raw pre and post sections around its transformed states", () => {
  const path = sawPath(
    "segment length=10mm,amplitude=3mm,raise=2mm,pre length=2mm,post length=3mm",
    "(0,0) -- (3,0)"
  );

  assert.deepEqual(path.commands[1], { type: "lineTo", x: 0.2, y: 0 });
  expectClose(path.commands[2].x, 1.2);
  expectClose(path.commands[2].y, 0.5);
  expectClose(path.commands.at(-2).x, 2.7);
  expectClose(path.commands.at(-2).y, 0.2);
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 3, y: 0 });
});

test("saw path has corners finishes the current input segment before restarting", () => {
  const path = sawPath(
    "segment length=10mm,amplitude=2mm,path has corners",
    "(0,0) -- (.6,0) -- (.6,2)"
  );

  assert.deepEqual(path.commands[1], { type: "lineTo", x: 0.6, y: 0 });
  expectClose(path.commands[2].x, 0.4);
  expectClose(path.commands[2].y, 1);
  expectClose(path.commands[3].x, 0.6);
  expectClose(path.commands[3].y, 1);
  assert.deepEqual(path.commands[4], { type: "lineTo", x: 0.6, y: 2 });
});

test("saw installs the analytic tangent frame at a cubic state origin", () => {
  const path = sawPath(
    "segment length=10mm,amplitude=2mm",
    "(0,0) .. controls (0,2) and (2,2) .. (2,0)"
  );

  expectClose(path.commands[1].x, parseDimension("-2mm"));
  expectClose(path.commands[1].y, parseDimension("10mm"));
  expectClose(path.commands[2].x, 0);
  expectClose(path.commands[2].y, parseDimension("10mm"));
});

test("saw preserves a signed amplitude", () => {
  const path = sawPath("segment length=10mm,amplitude=-2mm");
  expectClose(path.commands[1].y, parseDimension("-2mm"));
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the pathmorphing saw ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathmorphing-saw/${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const decoratedPaths = result.ir.items.filter(
      (item) => item.type === "path" && item.commands.length > 4
    );

    assert.deepEqual(result.diagnostics, []);
    assert.ok(decoratedPaths.length >= 2, "expected the native saw state paths");
  });
}

test("pathmorphing registry records the native saw state slice", () => {
  assert.ok(pathmorphingLibrary.implements.includes("saw pathmorphing subset"));
  assert.match(pathmorphingLibrary.implementedBy, /appendNativeSawPolyline/);
  assert.match(pathmorphingLibrary.notes, /full-tooth state and automatic short final state/);
  assert.match(pathmorphingLibrary.notes, /path has corners/);
});
