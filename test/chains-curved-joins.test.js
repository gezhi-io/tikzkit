import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { interpretTikz, parseTikz } from "../src/index.js";

const CASES = [
  {
    name: "flowchart convergence",
    fixture: "./fixtures/examples/chains/curved-joins-flowchart.tex",
    colors: ["blue", "red"],
    curveCount: 2
  },
  {
    name: "mathematical dependencies",
    fixture: "./fixtures/examples/chains/curved-joins-math-dependencies.tex",
    colors: ["blue", "rgb(217 108 0)"],
    curveCount: 2
  },
  {
    name: "physical feedback",
    fixture: "./fixtures/examples/chains/curved-joins-physics-feedback.tex",
    colors: ["blue", "rgb(217 108 0)"],
    curveCount: 3
  }
];

for (const scenario of CASES) {
  test(`renders chain joins with native edge geometry for ${scenario.name}`, () => {
    const source = readFileSync(new URL(scenario.fixture, import.meta.url), "utf8");
    const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
    const curved = ir.items.filter((item) => item.type === "path" && item.commands.at(-1)?.type === "curveTo");

    assert.deepEqual(diagnostics, []);
    assert.equal(curved.length, scenario.curveCount);
    assert.deepEqual(
      curved.filter((item) => scenario.colors.includes(item.style.stroke)).map((item) => item.style.stroke),
      scenario.colors
    );
    assert.ok(curved.every((item) => item.subtype === "edge"));
    assert.ok(curved.every((item) => item.style.markerEnd));
  });
}

test("applies every edge before every join and join-local styles", () => {
  const source = String.raw`
\begin{tikzpicture}[
  start chain=nodes going right,
  every edge/.style={red,dashed},
  every join/.style={blue,very thick,->}
]
  \node[draw,on chain] (a) {A};
  \node[draw,on chain,join=by {green,bend left=24}] (b) {B};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const join = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(join.subtype, "edge");
  assert.equal(join.style.stroke, "rgb(0 255 0)");
  assert.ok(join.style.dashArray?.length);
  assert.ok(join.style.markerEnd);
  assert.equal(join.commands.at(-1)?.type, "curveTo");
});
