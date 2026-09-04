import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { tikzLibrary as pathreplacingLibrary } from "../src/tikz/libraries/decorations.pathreplacing.js";

test("decorations.pathreplacing registry records border terminal-state behavior", () => {
  assert.ok(pathreplacingLibrary.implements.includes("border path replacement"));
  assert.match(pathreplacingLibrary.implementedBy, /appendBorderOnPolyline/);
  assert.match(pathreplacingLibrary.notes, /border.*last/i);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the path-replacing border states ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathreplacing-border-states/${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const tickLines = result.ir.items.flatMap((item) =>
      item.type === "path"
        ? item.commands.filter((command) => command.type === "lineTo")
        : []
    );

    assert.deepEqual(result.diagnostics, []);
    assert.doesNotMatch(result.svg, /\bNaN\b/);
    assert.ok(tickLines.length >= 5, "expected visible border state strokes");
  });
}
