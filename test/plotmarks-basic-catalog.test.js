import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { interpretTikz, parseTikz } from "../src/index.js";
import { renderPlotMark } from "../src/pgfplots/marks.js";

const FIXTURE = new URL("./fixtures/examples/plotmarks/basic-catalog.tex", import.meta.url);

test("renders the PGF basic plotmark catalog with distinct native geometry", () => {
  const source = readFileSync(FIXTURE, "utf8");
  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const marks = ir.items.filter((item) => item.shape === "plot-mark");
  const byName = new Map(marks.map((item) => [item.mark, item]));

  assert.deepEqual(diagnostics, []);
  assert.equal(marks.length, 13);
  assert.equal(byName.get("asterisk").commands.length, 6);
  assert.equal(byName.get("star").commands.length, 10);
  assert.equal(byName.get("10-pointed star").commands.length, 10);
  assert.ok(byName.get("oplus").commands.some((command) => command.type === "curveTo"));
  assert.ok(byName.get("otimes").commands.some((command) => command.type === "curveTo"));
  assert.equal(byName.get("diamond").commands.length, 5);
  assert.equal(byName.get("pentagon").commands.length, 6);
  assert.equal(byName.get("oplus").style.fill, "none");
  assert.equal(byName.get("oplus*").style.fill, "red");
  assert.equal(byName.get("diamond*").style.fill, "rgb(191 0 64)");
  assert.equal(byName.get("pentagon*").style.fill, "teal");
});

test("lowers the same basic plotmark geometry inside PGFPlots axes", () => {
  const asterisk = renderPlotMark({ x: 0, y: 0 }, { blue: true, mark: "asterisk", "mark size": "7pt" });
  const oplus = renderPlotMark({ x: 0, y: 0 }, { red: true, mark: "oplus*", "mark size": "7pt" });
  const diamond = renderPlotMark({ x: 0, y: 0 }, { purple: true, mark: "diamond", "mark size": "7pt" });
  const pentagon = renderPlotMark({ x: 0, y: 0 }, { teal: true, mark: "pentagon*", "mark size": "7pt" });

  assert.equal((asterisk.match(/ -- /g) || []).length, 3);
  assert.match(oplus, /circle\(0\.246\)/);
  assert.match(oplus, /fill=red/);
  assert.equal((diamond.match(/ -- /g) || []).length, 4);
  assert.match(diamond, /cycle/);
  assert.equal((pentagon.match(/ -- /g) || []).length, 5);
  assert.match(pentagon, /fill=teal/);
});
