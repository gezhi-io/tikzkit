import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { lowerLindenmayerSystems } from "../src/tikz/libraries/lindenmayersystems.js";

const FIXTURE = new URL("./fixtures/examples/lindenmayer/koch-snowflake.tex", import.meta.url);

test("lowers the PGF manual Koch curve declaration to one ordinary TikZ path", () => {
  const source = readFileSync(FIXTURE, "utf8");
  const diagnostics = [];
  const lowered = lowerLindenmayerSystems(source, diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.doesNotMatch(lowered, /pgfdeclarelindenmayersystem|lindenmayer system/);
  assert.match(lowered, /\\draw\[blue,line join=round\] \(0,0\) --/);
  assert.match(lowered, /-- cycle;/);
});

test("renders the real PGF manual Koch snowflake without diagnostics", () => {
  const source = readFileSync(FIXTURE, "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /<path/);
  assert.ok(result.ir.items.some((item) => item.type === "path"));
});

test("supports anonymous rule sets and branch-state restoration", () => {
  const source = String.raw`\usetikzlibrary{lindenmayersystems}
\begin{tikzpicture}
  \draw[green] l-system [l-system={rule set={F -> F[+F]F[-F]}, axiom=F, order=2, angle=25, step=3pt}];
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.filter((item) => item.type === "path").length >= 5);
});
