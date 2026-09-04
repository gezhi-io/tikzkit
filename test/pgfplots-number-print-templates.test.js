import assert from "node:assert/strict";
import test from "node:test";
import {
  axisRenderedTickLabels,
  axisTickNumberFormat,
  renderTickLabelTemplate
} from "../src/pgfplots/ticks.js";

test("PGF number templates distinguish fixed rounding from zero fill", () => {
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[fixed,precision=2]{\tick}`, 4.5),
    "4.5"
  );
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[fixed,fixed zerofill,precision=2]{\tick}`, 4.5),
    "4.50"
  );
});

test("PGF number templates apply comma and explicit separator styles", () => {
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[fixed,fixed zerofill,precision=2,use comma]{\tick}`, 1234.56),
    "1.234,56"
  );
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[fixed,fixed zerofill,precision=1,1000 sep={\,}]{\tick}`, 1250),
    String.raw`1\,250.0`
  );
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[fixed,precision=1,set decimal separator={,}]{\tick}`, 2.5),
    "2,5"
  );
});

test("axis tick templates preserve math wrappers and unit suffixes", () => {
  const labels = axisRenderedTickLabels(
    {},
    "x",
    undefined,
    [0, 1.25],
    {},
    String.raw`{$\pgfmathprintnumber[fixed,fixed zerofill,precision=2]{\tick}\,\mathrm{s}$}`
  );

  assert.deepEqual(labels, [String.raw`$0.00\,\mathrm{s}$`, String.raw`$1.25\,\mathrm{s}$`]);
});

test("axis number-format styles expose custom decimal and thousands separators", () => {
  const options = axisTickNumberFormat({
    "x tick label style": String.raw`{/pgf/number format/fixed,/pgf/number format/fixed zerofill,/pgf/number format/precision=1,/pgf/number format/1000 sep={\,},/pgf/number format/set decimal separator={,}}`
  }, "x");

  assert.deepEqual(options, {
    precision: 1,
    fixed: true,
    fixedZeroFill: true,
    thousandSeparator: String.raw`\,`,
    decimalSeparator: ","
  });
});

test("PGF scientific templates match MacTeX rounding and exponent-zero semantics", () => {
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[sci,precision=2]{\tick}`, 1234.5),
    String.raw`1.23\cdot 10^{3}`
  );
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[sci,precision=2]{\tick}`, 999.9),
    String.raw`1\cdot 10^{3}`
  );
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[sci,precision=2]{\tick}`, 0),
    String.raw`0\cdot 10^{0}`
  );
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[sci,sci zerofill,precision=2]{\tick}`, 1),
    String.raw`1.00\cdot 10^{0}`
  );
});

test("PGF scientific templates support sci precision and e/E presentations", () => {
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[sci,sci zerofill,precision=4,sci precision=1]{\tick}`, 12.345),
    String.raw`1.2\cdot 10^{1}`
  );
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[sci,sci e,sci zerofill,precision=2]{\tick}`, 12.345),
    String.raw`1.23e{+}1`
  );
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[sci,sci E,sci zerofill,precision=2]{\tick}`, 0.012345),
    String.raw`1.23E{-}2`
  );
  assert.equal(
    renderTickLabelTemplate(String.raw`\pgfmathprintnumber[sci,sci zerofill,precision=2,use comma]{\tick}`, 1234.5),
    String.raw`1,23\cdot 10^{3}`
  );
});

test("axis number-format styles expose shared scientific options", () => {
  const options = axisTickNumberFormat({
    "x tick label style": String.raw`{/pgf/number format/sci,/pgf/number format/sci zerofill,/pgf/number format/precision=4,/pgf/number format/sci precision=2,/pgf/number format/sci E}`
  }, "x");

  assert.deepEqual(options, {
    scientific: true,
    scientificZeroFill: true,
    precision: 4,
    scientificPrecision: 2,
    scientificStyle: "E"
  });
  assert.equal(renderTickLabelTemplate(String.raw`\tick`, 0.012345, options), String.raw`1.23E{-}2`);
});
