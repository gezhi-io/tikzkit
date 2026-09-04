import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createPgfRandom, tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";
import { tikzLibrary as pathmorphingLibrary } from "../src/tikz/libraries/decorations.pathmorphing.js";

function randomStepsPath(source, stroke = "blue") {
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const path = result.ir.items.find(
    (item) => item.type === "path" && item.style?.stroke === stroke
  );
  assert.deepEqual(result.diagnostics, []);
  assert.ok(path, `expected the decorated ${stroke} path`);
  return { path, result };
}

function expectPoint(actual, x, y, tolerance = 1e-8) {
  assert.ok(Math.abs(actual.x - x) <= tolerance, `expected x=${x}, got ${actual.x}`);
  assert.ok(Math.abs(actual.y - y) <= tolerance, `expected y=${y}, got ${actual.y}`);
}

test("shared PGF random generator reproduces TeX Live 2025 rand values", () => {
  const random = createPgfRandom(100);
  assert.equal(random.rand(), 0.62066);
  assert.equal(random.rand(), 0.35903);
  assert.equal(random.rand(), -0.03277);
  assert.equal(random.getSeed(), 865501050);
});

test("random steps reproduces the seeded native straight-path vertices", () => {
  const { path, result } = randomStepsPath(String.raw`
\pgfmathsetseed{100}
\begin{tikzpicture}
  \draw[blue,decorate,decoration={random steps,segment length=5mm,amplitude=2mm}]
    (0,0) -- (4,0);
\end{tikzpicture}`);

  assert.deepEqual(result.ast.pictures[0].pgfMathSeedsBefore, ["100"]);
  const expected = [
    [0, 0],
    [0.624132, 0.071806],
    [0.993446, 0.093706],
    [1.603494, -0.111324],
    [1.981356, -0.168498],
    [2.660932, -0.114322],
    [2.849412, 0.113054],
    [3.477636, 0.033114],
    [4, 0]
  ];
  assert.equal(path.commands.length, expected.length);
  path.commands.forEach((command, index) => expectPoint(command, ...expected[index]));
});

test("pgfmathsetseed inside a picture resets the shared stream in statement order", () => {
  const source = String.raw`
\begin{tikzpicture}
  \pgfmathsetseed{100}
  \draw[blue,decorate,decoration={random steps,segment length=5mm,amplitude=2mm}] (0,0)--(2,0);
  \pgfmathsetseed{100}
  \draw[red,decorate,decoration={random steps,segment length=5mm,amplitude=2mm}] (0,1)--(2,1);
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const blue = result.ir.items.find((item) => item.type === "path" && item.style?.stroke === "blue");
  const red = result.ir.items.find((item) => item.type === "path" && item.style?.stroke === "red");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.pictures[0].statements[0].type, "pgfmathsetseed");
  expectPoint(blue.commands[1], 0.624132, 0.071806);
  expectPoint(red.commands[1], 0.624132, 1.071806);
});

test("random steps always uses the native automatic-corner threshold", () => {
  const { path } = randomStepsPath(String.raw`
\pgfmathsetseed{100}
\begin{tikzpicture}
  \draw[red,decorate,decoration={random steps,segment length=5mm,amplitude=2mm}]
    (0,1) -- (2,1) -- (2,2.8) -- (4.5,2.8);
\end{tikzpicture}`, "red");
  const cornerIndex = path.commands.findIndex((command) =>
    Math.abs(command.x - 2) < 1e-8 && Math.abs(command.y - 1) < 1e-8
  );
  assert.ok(cornerIndex > 1, "expected an unperturbed automatic-corner endpoint");
  assert.ok(path.commands[cornerIndex + 1].y > 1, "expected the next state to restart on the vertical segment");
});

test("random steps applies pre/post lengths and mirror-before-raise", () => {
  const { path } = randomStepsPath(String.raw`
\pgfmathsetseed{100}
\begin{tikzpicture}
  \draw[blue,decorate,decoration={random steps,segment length=5mm,amplitude=2mm,
    pre length=4mm,post length=6mm,mirror,raise=1mm}] (0,0)--(4,0);
\end{tikzpicture}`);

  expectPoint(path.commands[1], parseDimension("4mm"), 0);
  expectPoint(path.commands[2], parseDimension("10.24132mm"), parseDimension("-1.71806mm"));
  expectPoint(path.commands.at(-2), parseDimension("34mm"), parseDimension("-1mm"));
  expectPoint(path.commands.at(-1), 4, 0);
});

test("decorations.pathmorphing registry records native random steps support", () => {
  assert.ok(pathmorphingLibrary.implements.includes("random steps pathmorphing subset"));
  assert.match(pathmorphingLibrary.implementedBy, /appendNativeRandomStepsPolyline/);
  assert.match(pathmorphingLibrary.notes, /two independent PGF rand values/);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the pathmorphing random steps ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathmorphing-random-steps/${fixture}.tex`, import.meta.url),
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
