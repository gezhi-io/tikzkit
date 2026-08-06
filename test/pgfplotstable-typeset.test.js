import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseTikz, tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/pgfplots/pgfplotstable-inline-typeset.tex", import.meta.url),
  "utf8"
);
const NUMBER_FORMAT_SOURCE = readFileSync(
  new URL("./fixtures/examples/pgfplots/pgfplotstable-number-formats.tex", import.meta.url),
  "utf8"
);
const DECIMAL_ALIGNMENT_SOURCE = readFileSync(
  new URL("./fixtures/examples/pgfplots/pgfplotstable-dec-sep-align.tex", import.meta.url),
  "utf8"
);
const SCIENTIFIC_ALIGNMENT_SOURCE = readFileSync(
  new URL("./fixtures/examples/pgfplots/pgfplotstable-sci-sep-align.tex", import.meta.url),
  "utf8"
);
const SCIENTIFIC_SUBSCRIPT_SOURCE = readFileSync(
  new URL("./fixtures/examples/pgfplots/pgfplotstable-sci-subscript.tex", import.meta.url),
  "utf8"
);
const SCIENTIFIC_SUPERSCRIPT_SOURCE = readFileSync(
  new URL("./fixtures/examples/pgfplots/pgfplotstable-sci-superscript.tex", import.meta.url),
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

test("formats per-column fixed and scientific pgfplotstable values", () => {
  const result = tikzToSvg(NUMBER_FORMAT_SOURCE, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.ir.items.filter((item) => item.subtype === "tabular-text").map((item) => item.text),
    [
      "DoF", "Fixed", "Scientific",
      "4", "0.250", String.raw`$2.50\cdot 10^{-1}$`,
      "1,024", "0.063", String.raw`$1.56\cdot 10^{-2}$`,
      "1,048,576", "0.001", String.raw`$9.54\cdot 10^{-7}$`
    ]
  );
  assert.match(result.svg, /2\.50/);
  assert.match(result.svg, /9\.54/);
});

test("uses comma decimal and period thousands separators for fixed tables", () => {
  const result = tikzToSvg(String.raw`\documentclass{standalone}
\usepackage{pgfplotstable}
\begin{document}
\pgfplotstabletypeset[
  columns={value},
  columns/value/.style={fixed,fixed zerofill,precision=2,use comma}
]{
value
1234.5
}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.ir.items.filter((item) => item.subtype === "tabular-text").map((item) => item.text),
    ["value", "1.234,50"]
  );
});

test("aligns supported fixed pgfplotstable values on one decimal anchor", () => {
  const result = tikzToSvg(DECIMAL_ALIGNMENT_SOURCE, { mathRenderer: "svg-text" });
  const leading = result.ir.items.filter((item) => item.subtype === "tabular-decimal-leading");
  const trailing = result.ir.items.filter((item) => item.subtype === "tabular-decimal-trailing");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(leading.map((item) => item.text), ["1", "12", "123"]);
  assert.deepEqual(trailing.map((item) => item.text), [".20", ".34", ".40"]);
  assert.ok(leading.every((item) => item.x === leading[0].x));
  assert.ok(trailing.every((item) => item.x === trailing[0].x));
  assert.ok(leading.every((item, index) => item.x === trailing[index].x));
  assert.match(result.svg, /text-anchor="end"/);
  assert.match(result.svg, /text-anchor="start"/);
});

test("aligns supported pgfplotstable scientific exponents on one shared anchor", () => {
  const result = tikzToSvg(SCIENTIFIC_ALIGNMENT_SOURCE, { mathRenderer: "svg-text" });
  const leading = result.ir.items.filter((item) => item.subtype === "tabular-scientific-leading");
  const trailing = result.ir.items.filter((item) => item.subtype === "tabular-scientific-trailing");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(leading.map((item) => item.text), ["$1$", "$9.8$", "$1.23$", "$1$"]);
  assert.deepEqual(trailing.map((item) => item.text), ["$\\cdot 10^{-3}$", "$\\cdot 10^{-2}$", "$\\cdot 10^{2}$", "$\\cdot 10^{0}$"]);
  assert.ok(leading.every((item) => item.x === leading[0].x));
  assert.ok(trailing.every((item) => item.x === trailing[0].x));
  assert.ok(trailing.every((item) => item.x === leading[0].x));
  assert.match(result.svg, /text-anchor="end"/);
  assert.match(result.svg, /text-anchor="start"/);
});

test("formats pgfplotstable scientific subscripts without inventing sci sep alignment", () => {
  const result = tikzToSvg(SCIENTIFIC_SUBSCRIPT_SOURCE, { mathRenderer: "svg-text" });
  const tabularText = result.ir.items.filter((item) => item.subtype === "tabular-text");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    tabularText.map((item) => item.text),
    [
      "Sample", "Subscript", "Subscript align",
      "A", String.raw`$1.00_{-3}$`, String.raw`$1.00_{-3}$`,
      "B", String.raw`$9.80_{-2}$`, String.raw`$9.80_{-2}$`,
      "C", String.raw`$1.23_{2}$`, String.raw`$1.23_{2}$`,
      "D", String.raw`$1.00_{0}$`, String.raw`$1.00_{0}$`,
      "E", String.raw`$0.00_{0}$`, String.raw`$0.00_{0}$`
    ]
  );
  assert.equal(result.ir.items.some((item) => item.subtype?.startsWith("tabular-scientific-")), false);
});

test("formats pgfplotstable scientific superscripts without inventing sci sep alignment", () => {
  const result = tikzToSvg(SCIENTIFIC_SUPERSCRIPT_SOURCE, { mathRenderer: "svg-text" });
  const tabularText = result.ir.items.filter((item) => item.subtype === "tabular-text");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    tabularText.map((item) => item.text),
    [
      "Sample", "Superscript", "Superscript align",
      "A", String.raw`$1.00^{-3}$`, String.raw`$1.00^{-3}$`,
      "B", String.raw`$9.80^{-2}$`, String.raw`$9.80^{-2}$`,
      "C", String.raw`$1.23^{2}$`, String.raw`$1.23^{2}$`,
      "D", String.raw`$1.00^{0}$`, String.raw`$1.00^{0}$`,
      "E", String.raw`$0.00^{0}$`, String.raw`$0.00^{0}$`
    ]
  );
  assert.equal(result.ir.items.some((item) => item.subtype?.startsWith("tabular-scientific-")), false);
});
