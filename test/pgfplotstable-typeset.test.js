import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseTikz, tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/pgfplots/pgfplotstable-inline-typeset.tex", import.meta.url),
  "utf8"
);

test("lowers pgfplotstable typeset into a measured text table", () => {
  const parsed = parseTikz(SOURCE);
  const result = tikzToSvg(SOURCE, { mathRenderer: "svg-text" });
  const text = result.ir.items.filter((item) => item.subtype === "tabular-text");

  assert.deepEqual(parsed.diagnostics, []);
  assert.equal(parsed.ast.tabularLayouts.length, 1);
  assert.deepEqual(parsed.ast.tabularLayouts[0].columns.map((column) => column.align), ["c", "c"]);
  assert.deepEqual(parsed.ast.tabularLayouts[0].rows.map((row) => row.cells.map((cell) => cell.text)), [
    ["Year", "Vehicles"],
    ["2,021", "642"],
    ["2,022", "904"],
    ["2,023", "1,402"]
  ]);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(text.map((item) => item.text), ["Year", "Vehicles", "2,021", "642", "2,022", "904", "2,023", "1,402"]);
  // The table's 82.34pt by 47.81pt TeX layout box plus the source's 2pt
  // standalone border on every edge keeps the SVG crop at 86.34pt by 51.81pt.
  assert.match(result.svg, /width="86\.34pt"/);
  assert.match(result.svg, /height="51\.81pt"/);
  assert.ok(!result.svg.includes("pgfplotstabletypeset"));
});

test("supports inline comma-separated pgfplotstable data with selected columns", () => {
  const result = tikzToSvg(String.raw`\documentclass{standalone}
\usepackage{pgfplotstable}
\begin{document}
\pgfplotstabletypeset[col sep=comma,columns={name,value}]{
name,value,discard
A,12,first
B,24,second
}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.ir.items.filter((item) => item.subtype === "tabular-text").map((item) => item.text),
    ["name", "value", "A", "12", "B", "24"]
  );
});
