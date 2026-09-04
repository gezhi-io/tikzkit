import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";
import { tikzLibrary as pathmorphingLibrary } from "../src/tikz/libraries/decorations.pathmorphing.js";

function bumpsPath(decoration, sourcePath = "(0,0) -- (2.5,0)") {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[blue,decorate,decoration={bumps,${decoration}}] ${sourcePath};
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

test("bumps emits the native two-cubic half-ellipse state", () => {
  const path = bumpsPath("segment length=10mm,amplitude=3mm");
  const length = parseDimension("10mm");
  const amplitude = parseDimension("3mm");
  const first = path.commands[1];
  const second = path.commands[2];

  assert.equal(first.type, "curveTo");
  expectClose(first.x1, 0);
  expectClose(first.y1, 0.555 * amplitude);
  expectClose(first.x2, 0.11125 * length);
  expectClose(first.y2, amplitude);
  expectClose(first.x, 0.25 * length);
  expectClose(first.y, amplitude);

  assert.equal(second.type, "curveTo");
  expectClose(second.x1, 0.38875 * length);
  expectClose(second.y1, amplitude);
  expectClose(second.x2, 0.5 * length);
  expectClose(second.y2, 0.5 * amplitude);
  expectClose(second.x, 0.5 * length);
  expectClose(second.y, 0);
});

test("bumps uses the 0.51 segment automatic-end threshold", () => {
  const shortPath = bumpsPath("segment length=10mm,amplitude=3mm", "(0,0) -- (.5,0)");
  const longPath = bumpsPath("segment length=10mm,amplitude=3mm", "(0,0) -- (.52,0)");

  assert.equal(shortPath.commands.some((command) => command.type === "curveTo"), false);
  assert.equal(longPath.commands.filter((command) => command.type === "curveTo").length, 2);
});

test("bumps applies mirror and raise but its final state returns to the raw endpoint", () => {
  const path = bumpsPath("segment length=10mm,amplitude=3mm,mirror,raise=2mm");
  const first = path.commands[1];

  expectClose(first.y1, parseDimension("-3.665mm"));
  expectClose(first.y2, parseDimension("-5mm"));
  expectClose(first.y, parseDimension("-5mm"));
  expectClose(path.commands.at(-2).y, parseDimension("-2mm"));
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 2.5, y: 0 });
});

test("bumps path has corners finishes the short segment before restarting", () => {
  const path = bumpsPath(
    "segment length=10mm,amplitude=2mm,path has corners",
    "(0,0) -- (.4,0) -- (.4,2)"
  );
  const firstCurve = path.commands[2];

  assert.deepEqual(path.commands[1], { type: "lineTo", x: 0.4, y: 0 });
  assert.equal(firstCurve.type, "curveTo");
  expectClose(firstCurve.x1, 0.4 - parseDimension("1.11mm"));
  expectClose(firstCurve.y1, 0);
  expectClose(firstCurve.x, 0.2);
  expectClose(firstCurve.y, 0.25);
});

test("bumps installs the analytic tangent frame at a cubic state origin", () => {
  const path = bumpsPath(
    "segment length=10mm,amplitude=2mm",
    "(0,0) .. controls (0,2) and (2,2) .. (2,0)"
  );
  const first = path.commands[1];

  expectClose(first.x1, parseDimension("-1.11mm"));
  expectClose(first.y1, 0);
  expectClose(first.x2, parseDimension("-2mm"));
  expectClose(first.y2, parseDimension("1.1125mm"));
  expectClose(first.x, parseDimension("-2mm"));
  expectClose(first.y, parseDimension("2.5mm"));
});

test("bumps preserves a signed amplitude", () => {
  const path = bumpsPath("segment length=10mm,amplitude=-2mm");
  expectClose(path.commands[1].y, parseDimension("-2mm"));
});

test("decorations.pathmorphing registry records native bumps support", () => {
  assert.ok(pathmorphingLibrary.implements.includes("bumps pathmorphing subset"));
  assert.match(pathmorphingLibrary.implementedBy, /appendNativeBumpsPolyline/);
  assert.match(pathmorphingLibrary.notes, /0\.51-segment automatic-end/);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the pathmorphing bumps ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathmorphing-bumps/${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const expectedDecoratedPaths = fixture === "physics" ? 1 : 2;
    const decoratedPaths = result.ir.items.filter(
      (item) => item.type === "path" && item.commands.some((command) => command.type === "curveTo")
    );

    assert.deepEqual(result.diagnostics, []);
    assert.doesNotMatch(result.svg, /\bNaN\b/);
    assert.ok(
      decoratedPaths.length >= expectedDecoratedPaths,
      `expected at least ${expectedDecoratedPaths} native bumps paths`
    );
  });
}
