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
