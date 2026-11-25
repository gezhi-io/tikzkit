import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { nativePlotSuite } from "./helpers/native-plot-trace.js";

nativePlotSuite("step", new URL("./fixtures/native-step-plot-tests/", import.meta.url), ["observations.table"]);

test("step corners and jump moves do not create observations in the marker replay", () => {
  function marks(source) {
    const { ir, diagnostics } = tikzToSvg(source);
    assert.deepEqual(diagnostics, []);
    return ir.items.filter(p => p.shape === "plot-mark").map(p => p.commands);
  }
  const samples = "(0,1)(1,3)(4,-1)(5,2)";
  const selected = marks(String.raw`\tikz \draw plot[only marks,mark=x] coordinates {(1,3)(5,2)};`);
  assert.equal(selected.length, 2);
  for (const handler of ["const plot mark right", "jump mark mid"]) {
    assert.deepEqual(marks(String.raw`\tikz \draw plot[${handler},mark=x,mark phase=2,mark repeat=2]
      coordinates {${samples}};`), selected);
  }
});
