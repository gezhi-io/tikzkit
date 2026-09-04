import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { tikzLibrary as pathreplacingLibrary } from "../src/tikz/libraries/decorations.pathreplacing.js";

test("decorations.pathreplacing registry records fixed-wave boundary transforms", () => {
  assert.ok(pathreplacingLibrary.implements.includes("fixed-radius waves path replacement"));
  assert.match(pathreplacingLibrary.implementedBy, /appendPathReplacingWaves/);
  assert.match(pathreplacingLibrary.notes, /Fixed-radius `waves`/);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the path-replacing fixed waves ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathreplacing-fixed-waves/${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const waveArcs = result.ir.items.flatMap((item) =>
      item.type === "path"
        ? item.commands.filter((command) => command.type === "curveTo")
        : []
    );

    assert.deepEqual(result.diagnostics, []);
    assert.doesNotMatch(result.svg, /\bNaN\b/);
    assert.ok(waveArcs.length >= 3, "expected visible fixed-radius circular arcs");
  });
}
