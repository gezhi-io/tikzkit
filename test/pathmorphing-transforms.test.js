import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";
import { tikzLibrary as pathmorphingLibrary } from "../src/tikz/libraries/decorations.pathmorphing.js";

function decoratedPath(decoration, path = "(0,0) -- (5,0)") {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[blue,decorate,decoration={${decoration}}] ${path};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const item = result.ir.items.find(
    (candidate) => candidate.type === "path" && candidate.style?.stroke === "blue"
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(item, "expected the decorated blue path");
  return item;
}

function expectClose(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be close to ${expected}`);
}

test("zigzag applies mirror and raise in PGF transformation order", () => {
  const segmentLength = parseDimension("10mm");
  const amplitude = parseDimension("3mm");
  const raise = parseDimension("4mm");
  const mirror = decoratedPath("zigzag,segment length=10mm,amplitude=3mm,mirror");
  const raised = decoratedPath("zigzag,segment length=10mm,amplitude=3mm,raise=4mm");
  const combined = decoratedPath("zigzag,segment length=10mm,amplitude=3mm,mirror,raise=4mm");

  expectClose(mirror.commands[1].x, segmentLength / 4);
  expectClose(mirror.commands[1].y, -amplitude);
  expectClose(raised.commands[1].y, raise + amplitude);
  expectClose(combined.commands[1].y, -(raise + amplitude));
  expectClose(combined.commands.at(-2).y, -raise);
  assert.deepEqual(combined.commands.at(-1), { type: "lineTo", x: 5, y: 0 });
});

test("zigzag keeps pre and post lineto sections on the input path", () => {
  const path = decoratedPath(
    "zigzag,segment length=10mm,amplitude=3mm,raise=4mm,pre length=2mm,post length=3mm"
  );

  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: 0 });
  assert.deepEqual(path.commands[1], { type: "lineTo", x: 0.2, y: 0 });
  expectClose(path.commands[2].y, parseDimension("7mm"));
  assert.deepEqual(path.commands.at(-2), { type: "lineTo", x: 4.7, y: 0 });
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 5, y: 0 });
});

test("snake mirrors and raises its native state-frame controls", () => {
  const path = decoratedPath(
    "snake,segment length=8mm,amplitude=2mm,mirror,raise=3mm",
    "(0,0) -- (5,0)"
  );
  const first = path.commands[1];

  assert.equal(first.type, "curveTo");
  expectClose(first.x1, parseDimension("1mm"));
  expectClose(first.y1, parseDimension("-3mm"));
  expectClose(first.x2, parseDimension("1.5mm"));
  expectClose(first.y2, parseDimension("-5mm"));
  expectClose(first.x, parseDimension("2.5mm"));
  expectClose(first.y, parseDimension("-5mm"));
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 5, y: 0 });
});

test("coil mirrors and raises every native cubic state", () => {
  const path = decoratedPath(
    "coil,segment length=9mm,amplitude=2.5mm,aspect=.45,mirror,raise=3mm",
    "(0,0) -- (5,0)"
  );
  const first = path.commands[1];

  assert.equal(first.type, "curveTo");
  expectClose(first.x1, 0.9 / 12);
  expectClose(first.y1, -(0.3 + 0.555 * 0.25));
  expectClose(first.x2, 0.445 * 0.45 * 0.25 + 2 * 0.9 / 12);
  expectClose(first.y2, -0.55);
  expectClose(first.x, 0.45 * 0.25 + 3 * 0.9 / 12);
  expectClose(first.y, -0.55);
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 5, y: 0 });
});

test("curved coil installs mirror and raise in the analytic tangent frame", () => {
  const path = decoratedPath(
    "coil,segment length=9mm,amplitude=2.5mm,aspect=.45,mirror,raise=3mm",
    "(0,0) .. controls (0,4) and (5,-3) .. (5,1)"
  );
  const first = path.commands[1];

  assert.equal(first.type, "curveTo");
  expectClose(first.x1, 0.3 + 0.555 * 0.25);
  expectClose(first.y1, 0.9 / 12);
  expectClose(first.x, 0.55);
  expectClose(first.y, 0.45 * 0.25 + 3 * 0.9 / 12);
});

test("pathmorphing registry records the shared mirror and raise transform", () => {
  assert.ok(pathmorphingLibrary.features.includes("shared mirror and raise state transforms for snake, zigzag, and coil"));
  assert.ok(pathmorphingLibrary.implements.includes("mirror/raise transform subset"));
  assert.match(pathmorphingLibrary.localSourceReviewed, /tikzlibrarydecorations\.code\.tex/);
  assert.match(pathmorphingLibrary.localSourceReviewed, /pgfcoretransformations\.code\.tex/);
  assert.match(pathmorphingLibrary.notes, /mirror and raise keys now use PGF's segment-transform order/);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the pathmorphing transform ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathmorphing-transforms/${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const decoratedPaths = result.ir.items.filter(
      (item) => item.type === "path" && item.commands.length > 3
    );

    assert.deepEqual(result.diagnostics, []);
    assert.ok(decoratedPaths.length >= 2, "expected both transformed decoration paths");
  });
}
