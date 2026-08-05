import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { parseTikz, tikzToSvg } from "../src/index.js";

const B_TREE_EVOLUTION = "test/fixtures/examples/latex-examples/b-tree-3-evolution.tex";

test("records a document tabular as structural picture layout metadata", () => {
  const source = fs.readFileSync(B_TREE_EVOLUTION, "utf8");
  const parsed = parseTikz(source);
  const layout = parsed.ast.tabularLayouts[0];

  assert.deepEqual(parsed.diagnostics, []);
  assert.ok(layout, "expected the B-tree evolution table to be recognized");
  assert.deepEqual(layout.columns.map((column) => column.align), ["c", "c"]);
  assert.equal(layout.columns[0].rightRule, true, "expected the c|c column separator");
  assert.equal(layout.rows.length, 7);
  assert.deepEqual(layout.rows[0].cells.map((cell) => cell.pictureIndices), [[0], [1]]);
  assert.equal(layout.rows[1].blank, true, "expected the explicit row after the first hline");
  assert.equal(layout.rows[3].blank, true, "expected the explicit row after the second hline");
  assert.deepEqual(layout.rows[6].cells.map((cell) => cell.pictureIndices), [[6], [7]]);
  assert.equal(layout.rows[5].cells[0].text, "Node is full $\\rightarrow$ first split node");
  assert.equal(layout.rows[1].rulesBefore, 1);
  assert.equal(layout.rows[3].rulesBefore, 1);
  assert.equal(layout.rows[5].rulesBefore, 1);
});

test("lays out tabular tikzpictures into rows and columns rather than inline source order", () => {
  const source = fs.readFileSync(B_TREE_EVOLUTION, "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const verticalRules = result.ir.items.filter((item) => item.subtype === "tabular-vrule");
  const horizontalRules = result.ir.items.filter((item) => item.subtype === "tabular-hline");
  const tableText = result.ir.items.find((item) => item.subtype === "tabular-text");
  const viewBox = result.svg.match(/\bviewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(verticalRules.length, 1, "expected the c|c separator");
  assert.equal(horizontalRules.length, 3, "expected each source hline");
  assert.equal(tableText?.text, "Node is full $\\rightarrow$ first split node");
  assert.ok(viewBox, "expected an SVG viewBox");
  assert.ok(viewBox[3] > viewBox[2] * 0.45, `expected a multi-row table, got ${viewBox[2]} x ${viewBox[3]}`);
  assert.doesNotMatch(result.svg, /\\hline/, "table rules must be painted paths, not literal text");
});

test("keeps a selected figure independent from its enclosing document tabular", () => {
  const source = fs.readFileSync(B_TREE_EVOLUTION, "utf8");
  const parsed = parseTikz(source, { activeFigureId: "figure:0" });

  assert.equal(parsed.ast.pictures.length, 1);
  assert.deepEqual(parsed.ast.tabularLayouts, []);
  assert.equal(parsed.ast.pictures[0].tabularLayout, null);
});
