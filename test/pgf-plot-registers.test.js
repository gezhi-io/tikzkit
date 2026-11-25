import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { pgfPointExpressionCm } from "../src/engine/units.js";

const ptInCm = 2.54 / 72.27;
function points(actual, expected) {
  assert.ok(Math.abs(actual / ptInCm - expected) < 4 / 65536, String(actual / ptInCm) + "pt vs " + expected + "pt");
}

test("plot baselines follow the enclosing group, not the last rendered picture", () => {
  const picture = "\\begin{tikzpicture}\\draw plot[ycomb] coordinates {(1pt,7pt)};\\end{tikzpicture}";
  const source = "\\pgfplotyzerolevelstreamconstant{-2pt}\n" +
    "% \\pgfplotyzerolevelstreamconstant{60pt}\n" +
    "\\begingroup\\pgfplotyzerolevelstreamconstant{3pt}" + picture + "\\endgroup\n" + picture;
  for (const [i, baseline] of [3, -2].entries()) {
    const result = tikzToSvg(source, { activeFigureId: "figure:" + i });
    assert.deepEqual(result.diagnostics, []);
    const [start, end] = result.ir.items.find(p => p.type === "path").commands;
    points(start.y, baseline);
    points(end.y, 7);
  }
});

test("bar dimensions convert physical units before doing point arithmetic", () => {
  const env = { variables: { w: "1pc" } };
  points(pgfPointExpressionCm("{2+max(3pt,\\w/2)}", env), 8);
  points(pgfPointExpressionCm("16sp", env), 16 / 65536);
});

test("a custom per-bar callback is reported once per plot that invokes it", () => {
  const source = "\\begin{tikzpicture}"+
    "\\fill[/pgf/at begin bar={\\myhook},ybar interval] plot coordinates {(1,1)};" +
    "\\fill[ybar,/pgf/at begin bar={\\myhook},at end bar={\\relax}] plot coordinates {(1,1)(2,2)};" +
    "\\end{tikzpicture}";
  const { ir, diagnostics } = tikzToSvg(source);
  assert.deepEqual(diagnostics.map(d => d.code), ["tikz-bar-hook-unsupported"]);
  assert.equal(ir.items.flatMap(p => p.commands ?? []).filter(c => c.type === "closePath").length, 2);
});
