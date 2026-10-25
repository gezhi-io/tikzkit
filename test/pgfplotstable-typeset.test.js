import assert from "node:assert/strict";
import { assertNativePlainText } from "./helpers/native-math-svg.js";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseTikz, tikzToSvg } from "../src/index.js";
import { assertNativeText, nativeMathGroups } from "./helpers/native-math-svg.js";

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
const SCIENTIFIC_GENERIC_SOURCE = readFileSync(
  new URL("./fixtures/examples/pgfplots/pgfplotstable-sci-generic.tex", import.meta.url),
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
  for (const text of ["2.50\u00b710\u22121", "1.56\u00b710\u22122", "9.54\u00b710\u22127"]) {
    const group = assertNativeText(result.svg, text);
    const dot = group.glyphs.find(glyph => glyph.text === "\u00b7");
    assert.equal(dot.family, "TikZKitCMSY10");
    const exponent = group.glyphs.slice(-2);
    assert.ok(exponent.every(glyph => glyph.size === 7 && glyph.y < dot.y));
  }
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
  leading.forEach((item, index) => {
    const left = assertNativePlainText(result.svg, item.text);
    const right = assertNativePlainText(result.svg, trailing[index].text);
    // CMR10 digits each advance 5.00002pt. Native paint must end/start
    // at the shared decimal anchor, regardless of SVG serialization.
    assert.ok(Math.abs(left.x + item.text.length * 5.00002 * left.scale - item.x * 100) < .001);
    assert.ok(Math.abs(right.x - item.x * 100) < .001);
    assert.ok(Math.abs(left.y - right.y) < .001);
  });
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
  const groups = nativeMathGroups(result.svg);
  assert.deepEqual(groups.map(group => group.text), ["1", "\u00b710\u22123", "9.8", "\u00b710\u22122", "1.23", "\u00b7102", "1", "\u00b7100"]);
  // Native mantissa advances from compact-math-renderer-metrics.tex, in TeX pt.
  const widths = [5.00002, 12.77782, 17.77783, 5.00002];
  leading.forEach((item, index) => {
    const mantissa = groups[2 * index];
    const exponent = groups[2 * index + 1];
    const anchor = item.x * 100;
    const rightEdge = mantissa.x + widths[index] * mantissa.scale;
    assert.ok(Math.abs(rightEdge - anchor) < 0.001, "native mantissa ends at the shared anchor");
    assert.ok(Math.abs(exponent.x - anchor) < 0.001, "native exponent fragment starts at the shared anchor");
    assert.equal(mantissa.scale, exponent.scale);
    for (const glyph of mantissa.glyphs) {
      // fontmath.ltx declares the decimal point in letters, slot 3A.
      assert.equal(glyph.family, glyph.text === "." ? "TikZKitCMMI10" : "TikZKitCMR10");
      assert.equal(glyph.size, 10);
    }
    assert.equal(exponent.glyphs[0].family, "TikZKitCMSY10");
    assert.ok(exponent.glyphs.slice(3).every(glyph => glyph.size === 7 && glyph.y < 0));
  });
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

test("formats pgfplotstable sci generic templates and the hidden-unit-mantissa branch", () => {
  const result = tikzToSvg(SCIENTIFIC_GENERIC_SOURCE, { mathRenderer: "svg-text" });
  const tabularText = result.ir.items.filter((item) => item.subtype === "tabular-text");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    tabularText.map((item) => item.text),
    [
      "Sample", "Generic", "Unit mantissa false", "Generic align",
      "A", String.raw`$1.00\,\times\,10^{-3}$`, String.raw`$10^{-3}$`, String.raw`$1.00\,\times\,10^{-3}$`,
      "B", String.raw`$1.23\,\times\,10^{2}$`, String.raw`$1.23\,\times\,10^{2}$`, String.raw`$1.23\,\times\,10^{2}$`,
      "C", String.raw`$1.00\,\times\,10^{0}$`, String.raw`$10^{0}$`, String.raw`$1.00\,\times\,10^{0}$`,
      "D", String.raw`$0.00\,\times\,10^{0}$`, String.raw`$0.00\,\times\,10^{0}$`, String.raw`$0.00\,\times\,10^{0}$`,
      "E", String.raw`$-1.00\,\times\,10^{-3}$`, String.raw`$-10^{-3}$`, String.raw`$-1.00\,\times\,10^{-3}$`
    ]
  );
  assert.equal(result.ir.items.some((item) => item.subtype?.startsWith("tabular-scientific-")), false);
});
