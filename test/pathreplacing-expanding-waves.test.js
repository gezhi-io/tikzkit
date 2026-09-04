import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { tikzLibrary as pathreplacingLibrary } from "../src/tikz/libraries/decorations.pathreplacing.js";

test("decorations.pathreplacing registry records transformed expanding-wave states", () => {
  assert.ok(pathreplacingLibrary.implements.includes("expanding waves path replacement"));
  assert.match(pathreplacingLibrary.implementedBy, /applyWavesDecoration/);
  assert.match(pathreplacingLibrary.notes, /strictly before the main-section endpoint/);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the path-replacing expanding waves ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathreplacing-expanding-waves/${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const growingArcs = result.ir.items.flatMap((item) =>
      item.type === "path"
        ? item.commands.filter((command) => command.type === "curveTo")
        : []
    );

    assert.deepEqual(result.diagnostics, []);
    assert.doesNotMatch(result.svg, /\bNaN\b/);
    assert.ok(growingArcs.length >= 3, "expected visible expanding circular arcs");
  });
}
