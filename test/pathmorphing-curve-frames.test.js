import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { tikzLibrary as pathmorphingLibrary } from "../src/tikz/libraries/decorations.pathmorphing.js";

function decoratedPath(decoration) {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[blue,decorate,
    decoration={${decoration},segment length=8mm,amplitude=2mm}]
    (0,0) .. controls (0,4) and (6,-4) .. (6,0);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find(
    (item) => item.type === "path" && item.style?.stroke === "blue"
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(path, `expected a blue ${decoration} path`);
  return path;
}

test("zigzag curve states use the tangent frame at each state origin", () => {
  const path = decoratedPath("zigzag");
  const firstApex = path.commands[1];
  const secondApex = path.commands[2];

  // At t=0 the cubic tangent is vertical. PGF's first state draws to local
  // (segment length / 4, amplitude), hence global (-.2,.2).
  assert.equal(firstApex.type, "lineTo");
  assert.ok(Math.abs(firstApex.x + 0.2) < 1e-9, `unexpected apex x ${firstApex.x}`);
  assert.ok(Math.abs(firstApex.y - 0.2) < 1e-9, `unexpected apex y ${firstApex.y}`);

  // The next state includes both recursive curve-length advancement and the
  // analytic tangent frame. These values are the local tikztosvg path values
  // (7.083719pt, 16.156719pt) converted to centimeters.
  assert.ok(Math.abs(secondApex.x - 0.24988) < 2e-4, `unexpected second apex x ${secondApex.x}`);
  assert.ok(Math.abs(secondApex.y - 0.56998) < 2e-4, `unexpected second apex y ${secondApex.y}`);
});

test("snake curve controls use the analytic tangent at the state origin", () => {
  const path = decoratedPath("snake");
  const initial = path.commands[1];

  // The initial native control is local (.125 * .8cm, 0), so the vertical
  // start tangent maps it to exactly (0,.1).
  assert.equal(initial.type, "curveTo");
  assert.ok(Math.abs(initial.x1) < 1e-9, `unexpected control x ${initial.x1}`);
  assert.ok(Math.abs(initial.y1 - 0.1) < 1e-9, `unexpected control y ${initial.y1}`);
});

test("pathmorphing registry records the curve-frame implementation and local PGF sources", () => {
  assert.match(pathmorphingLibrary.implementedBy, /flattenDecorationPath/);
  assert.match(pathmorphingLibrary.implementedBy, /pointOnPolyline/);
  assert.match(pathmorphingLibrary.localSource, /pgflibrarydecorations\.pathmorphing\.code\.tex$/);
  assert.match(pathmorphingLibrary.localSourceReviewed, /pgfmoduledecorations\.code\.tex/);
  assert.match(pathmorphingLibrary.notes, /analytic tangents install each state's local coordinate frame/);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the curved pathmorphing ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathmorphing-curve-${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const decorated = result.ir.items.filter(
      (item) => item.type === "path" && item.commands.length >= 8
    );

    assert.deepEqual(result.diagnostics, []);
    assert.ok(decorated.length >= 1, `expected a detailed decorated path, got ${decorated.length}`);
  });
}
