import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { interpretTikz, parseTikz } from "../src/index.js";
import { TIKZ_LINE_WIDTHS } from "../src/tikz-metrics.js";

const CASES = [
  {
    name: "flowchart convergence",
    fixture: "./fixtures/examples/chains/multiple-joins-flowchart.tex",
    target: "release",
    targetAlias: "delivery-1",
    sources: [
      ["design-end", "implementation"],
      ["quality-end", "verification"]
    ],
    marker: "stealth",
    lineWidth: TIKZ_LINE_WIDTHS.veryThick,
    joinCount: 4
  },
  {
    name: "mathematical proof convergence",
    fixture: "./fixtures/examples/chains/multiple-joins-proof-chain.tex",
    target: "claim",
    targetAlias: "proof-1",
    sources: [
      ["base-end", "base-result"],
      ["step-end", "step-result"]
    ],
    marker: "latex",
    lineWidth: TIKZ_LINE_WIDTHS.thick,
    joinCount: 4
  },
  {
    name: "physical signal convergence",
    fixture: "./fixtures/examples/chains/multiple-joins-signal-merge.tex",
    target: "mixer",
    targetAlias: "readout-1",
    sources: [
      ["voltage-end", "voltage-filter"],
      ["current-end", "current-filter"]
    ],
    marker: "stealth",
    lineWidth: TIKZ_LINE_WIDTHS.thick,
    joinCount: 5
  }
];

for (const scenario of CASES) {
  test(`keeps every repeated join=with edge for ${scenario.name}`, () => {
    const source = readFileSync(new URL(scenario.fixture, import.meta.url), "utf8");
    const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
    const joins = ir.items.filter((item) => item.type === "path");

    assert.deepEqual(diagnostics, []);
    for (const [alias, terminal] of scenario.sources) {
      assert.deepEqual(
        ir.coordinates[alias],
        ir.coordinates[terminal],
        `expected ${alias} to track the current end of its named chain`
      );
    }
    assert.deepEqual(ir.coordinates[scenario.targetAlias], ir.coordinates[scenario.target]);

    assert.equal(joins.length, scenario.joinCount);
    assert.deepEqual(
      joins.filter((item) => item.style.stroke === "blue" || item.style.stroke === "red")
        .map((item) => item.style.stroke)
        .sort(),
      ["blue", "red"],
      `expected both repeated join=with edges to survive option parsing, got ${JSON.stringify(joins)}`
    );
    assert.ok(joins.every((item) => item.style.markerEnd?.kind === scenario.marker));
    assert.ok(joins.every((item) => item.style.lineWidth === scenario.lineWidth));
    assert.equal(joins.filter((item) => item.style.dashArray?.length).length, 1);
  });
}

test("runs every on chain when on chain comes from every node", () => {
  const source = String.raw`
\begin{tikzpicture}[
  start chain=walk going right,
  every node/.style={on chain},
  every on chain/.style={draw,join}
]
  \node (a) {A};
  \node (b) {B};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");
  const joins = ir.items.filter((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(boxes.length, 2);
  assert.equal(joins.length, 1);
  assert.ok(ir.coordinates.b.x > ir.coordinates.a.x);
});

test("keeps inherited and explicit chainin joins in source order", () => {
  const source = String.raw`
\begin{tikzpicture}[
  start chain=walk going right,
  every chain in/.style={join=by {red,very thick}}
]
  \node[draw,minimum width=4cm] (existing) at (0,2) {E};
  \node[draw,on chain] {A};
  \node[draw,on chain] {B};
  \chainin (existing) [join=by {blue,thick}];
  \node[draw,on chain] (after) {C};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const joins = ir.items.filter((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(joins.map((item) => item.style.stroke), ["red", "blue"]);
  assert.deepEqual(
    joins.map((item) => item.style.lineWidth),
    [TIKZ_LINE_WIDTHS.veryThick, TIKZ_LINE_WIDTHS.thick]
  );
  assert.ok(
    ir.coordinates.after.x - ir.coordinates.existing.x > 2,
    "expected the next node to clear the chained-in node's real half width"
  );
});

test("lets a join-local arrow direction replace every join arrows", () => {
  const source = String.raw`
\begin{tikzpicture}[
  start chain=walk going right,
  every join/.style={->}
]
  \node[draw,on chain] (a) {A};
  \node[draw,on chain,join=by {blue,<-}] (b) {B};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const join = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(join.style.stroke, "blue");
  assert.equal(join.style.markerStart?.kind, "to");
  assert.equal(join.style.markerEnd, undefined);
});
