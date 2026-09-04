import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { tikzLibrary as pathreplacingLibrary } from "../src/tikz/libraries/decorations.pathreplacing.js";

test("decorations.pathreplacing registry records recursive curved-brace metrics", () => {
  assert.ok(pathreplacingLibrary.implements.includes("recursive cubic brace length with exact initial tangent"));
  assert.match(pathreplacingLibrary.implementedBy, /flattenDecorationPath\/pointOnPolyline/);
  assert.match(pathreplacingLibrary.notes, /first support point/);
});

test("brace uses the exact initial cubic tangent and PGF decoration length", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[red,thick,decorate,
    decoration={brace,amplitude=7pt,aspect=.38}]
    (0,0) .. controls (0.01,0) and (5,5) .. (5,0);
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const brace = result.ir.items.find((item) => item.type === "path" && item.style?.stroke === "red");
  const end = brace?.commands.at(-1);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(brace, "expected the decorated brace path");
  assert.equal(brace.commands.filter((command) => command.type === "moveTo").length, 1);
  assert.ok(brace.commands.filter((command) => command.type === "curveTo").length >= 4);
  assert.ok(Math.abs(end.y) < 1e-9, `expected the brace to stay on the initial horizontal tangent, got ${JSON.stringify(end)}`);
  assert.ok(end.x > 7.2 && end.x < 7.35, `expected the recursive PGF curve length, got ${JSON.stringify(end)}`);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the curved-brace ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/decorations/pathreplacing-brace-curves/${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const brace = result.ir.items.find((item) =>
      item.type === "path"
      && item.commands.filter((command) => command.type === "curveTo").length >= 4
      && item.commands.at(-1)?.x > 6
    );

    assert.deepEqual(result.diagnostics, []);
    assert.doesNotMatch(result.svg, /\bNaN\b/);
    assert.ok(brace, "expected the full-length replacement brace");
  });
}
