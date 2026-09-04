import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { tikzLibrary as pathmorphingLibrary } from "../src/tikz/libraries/decorations.pathmorphing.js";

function coilPath(path, decoration = "coil,aspect=.5,segment length=8mm,amplitude=3mm") {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[blue,decorate,decoration={${decoration}}] ${path};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const item = result.ir.items.find(
    (candidate) => candidate.type === "path" && candidate.style?.stroke === "blue"
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(item, "expected a blue coil path");
  return item;
}

function expectClose(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be close to ${expected}`);
}

test("coil emits the native four-cubic full state and projected controls", () => {
  const path = coilPath("(0,0) -- (6,0)");
  const first = path.commands[1];
  const second = path.commands[2];

  assert.equal(first.type, "curveTo");
  expectClose(first.x1, 0.8 / 12);
  expectClose(first.y1, 0.555 * 0.3);
  expectClose(first.x2, 0.445 * 0.5 * 0.3 + 2 * 0.8 / 12);
  expectClose(first.y2, 0.3);
  expectClose(first.x, 0.5 * 0.3 + 3 * 0.8 / 12);
  expectClose(first.y, 0.3);

  assert.equal(second.type, "curveTo");
  expectClose(second.x, 2 * 0.5 * 0.3 + 6 * 0.8 / 12);
  expectClose(second.y, 0);
  assert.equal(path.commands.filter((command) => command.type === "curveTo").length, 26);
  expectClose(path.commands.at(-1).x, 6);
});

test("coil installs the analytic cubic tangent frame at each state origin", () => {
  const path = coilPath("(0,0) .. controls (0,4) and (6,-4) .. (6,0)");
  const first = path.commands[1];

  assert.equal(first.type, "curveTo");
  expectClose(first.x1, -0.555 * 0.3);
  expectClose(first.y1, 0.8 / 12);
  expectClose(first.x, -0.3);
  expectClose(first.y, 0.5 * 0.3 + 3 * 0.8 / 12);
});

test("coil advances later curved states with PGF's iterative distance search", () => {
  const path = coilPath(
    "(0,0) .. controls (1,2.6) and (4,-2.2) .. (5.8,.25)",
    "coil,aspect=.35,segment length=6mm,amplitude=2mm"
  );
  const secondStateFirstCurve = path.commands[5];

  assert.equal(secondStateFirstCurve.type, "curveTo");
  // Local TeX Live/tikztosvg reference: (7.151844bp, 17.791031bp).
  expectClose(secondStateFirstCurve.x1, 0.252301163333, 0.00006);
  expectClose(secondStateFirstCurve.y1, 0.627628038056, 0.00006);
});

test("coil aspect zero removes the projected longitudinal radius", () => {
  const path = coilPath(
    "(0,0) -- (2,0)",
    "coil,aspect=0,segment length=8mm,amplitude=3mm"
  );
  const first = path.commands[1];

  expectClose(first.x, 3 * 0.8 / 12);
  expectClose(first.y, 0.3);
});

test("coil preserves explicit pre and post line sections", () => {
  const path = coilPath(
    "(0,0) -- (4,0)",
    "coil,aspect=.5,segment length=8mm,amplitude=3mm,pre length=2mm,post length=4mm"
  );

  assert.equal(path.commands[1].type, "lineTo");
  expectClose(path.commands[1].x, 0.2);
  expectClose(path.commands.at(-2).x, 3.6);
  expectClose(path.commands.at(-1).x, 4);
});

test("pathmorphing registry records the coil state machine and reviewed PGF source", () => {
  assert.match(pathmorphingLibrary.implementedBy, /appendNativeCoilPolyline/);
  assert.match(pathmorphingLibrary.implementedBy, /pgfDecorationCurveTimeAfterDistance/);
  assert.ok(pathmorphingLibrary.implements.includes("coil pathmorphing subset"));
  assert.match(pathmorphingLibrary.localSourceReviewed, /pgfmoduledecorations\.code\.tex/);
  assert.match(pathmorphingLibrary.notes, /four-cubic cycle and two-cubic final state/);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the pathmorphing coil ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathmorphing-coil-${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const coil = result.ir.items.find(
      (item) => item.type === "path"
        && item.commands.filter((command) => command.type === "curveTo").length >= 2
    );

    assert.deepEqual(result.diagnostics, []);
    assert.ok(coil, "expected a rendered coil path");
  });
}
