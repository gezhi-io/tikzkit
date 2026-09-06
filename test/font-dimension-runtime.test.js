import assert from "node:assert/strict";
import test from "node:test";
import { fontDimensionMetrics, parseDimension, parseDimensionResult, withDimensionFont, withMathDiagnostics } from "../src/engine/math.js";
import { createFontSpec, mergeFontSpec, parseTikzFontPatch } from "../src/tex/fontSpec.js";

const PT_PER_CM = 28.4527559;

test("R6 dimension metrics reproduce native CMR10/CMR12 fontdimens, not nominal size", () => {
  const normal = createFontSpec();
  const large = mergeFontSpec(normal, parseTikzFontPatch(String.raw`\large`, { source: "content-command" }));
  assert.equal(large.sizePt, 12);
  assert.deepEqual(fontDimensionMetrics(normal), { emPt: 655361 / 65536, exPt: 282168 / 65536 });
  assert.deepEqual(fontDimensionMetrics(large), { emPt: 770040 / 65536, exPt: 338603 / 65536 });
  assert.equal(parseDimension("1em", {}, { font: large }), (770040 / 65536) / PT_PER_CM);
  assert.equal(parseDimension("1ex", {}, { font: large }), (338603 / 65536) / PT_PER_CM);
  assert.notEqual(parseDimension("1em", {}, { font: large }), 12 / PT_PER_CM);
});

test("font-relative units honor supported optical sizes, families, weights and styles", () => {
  // Native pdfTeX fontdimen values recorded in scaled points from TeX Live 2025.
  for (const [font, emPt, exPt] of [
    [{ sizePt: 5 }, 6.8056488037109375, 2.15277099609375],
    [{ sizePt: 12, weight: 700 }, 13.5, 5.33331298828125],
    [{ sizePt: 12, family: "monospace" }, 12.350006103515625, 5.1666717529296875],
    [{ sizePt: 12, family: "sans-serif" }, 11.7498779296875, 5.33331298828125],
    [{ sizePt: 12, style: "italic" }, 12.0001220703125, 5.1666717529296875],
    [{ sizePt: 10, family: "helvetica" }, 10, 342751 / 65536],
    [{ sizePt: 10, family: "helvetica", weight: 700 }, 10, 348648 / 65536],
    [{ sizePt: 17.28 }, 15.849853515625, 7.4388885498046875]
  ]) assert.deepEqual(fontDimensionMetrics(font), { emPt, exPt }, JSON.stringify(font));
});

test("dimension arithmetic and length registers use the active font without scaling physical units", () => {
  const font = { sizePt: 12 };
  const metrics = fontDimensionMetrics(font);
  const em = metrics.emPt / PT_PER_CM, ex = metrics.exPt / PT_PER_CM;
  assert.equal(parseDimension("{2em+3ex}", {}, { font }), 2 * em + 3 * ex);
  assert.equal(parseDimension(String.raw`\length+1ex`, { length: "2em" }, { font }), 2 * em + ex);
  assert.equal(parseDimension("(2+3)em", {}, { font }), 5 * em);
  assert.equal(parseDimension("10mm", {}, { font }), 1);
  assert.equal(parseDimension("1cm", {}, { font }), 1);
  assert.equal(parseDimension("12pt", {}, { font }), 12 / PT_PER_CM);
  assert.equal(parseDimension("2", {}, { font }), 2);
});

test("the parent bridge scopes real TeX font declarations independently of TikZ node font options", () => {
  const env = { currentFont: createFontSpec(), pictureOptions: { font: String.raw`\Huge` } };
  const base = parseDimension("1em");
  withDimensionFont(() => env.currentFont, () => {
    assert.equal(parseDimension("1em"), fontDimensionMetrics(env.currentFont).emPt / PT_PER_CM);
    env.currentFont = mergeFontSpec(env.currentFont, parseTikzFontPatch(String.raw`\large`));
    const outer = parseDimension("1em");
    const child = { ...env, currentFont: mergeFontSpec(env.currentFont, parseTikzFontPatch(String.raw`\tiny`)) };
    withDimensionFont(() => child.currentFont, () => {
      assert.equal(parseDimension("1em"), fontDimensionMetrics(child.currentFont).emPt / PT_PER_CM);
      assert.notEqual(parseDimension("1em"), outer);
    });
    assert.equal(parseDimension("1em"), outer);
    assert.throws(() => withDimensionFont({ sizePt: 9 }, () => { throw new Error("test restoration"); }));
    assert.equal(parseDimension("1em"), outer);
  });
  assert.equal(parseDimension("1em"), base);
});

test("unknown font metrics are explicit failures, with an override for measured external fonts", () => {
  const diagnostics = [];
  for (const font of [{ sizePt: 13 }, { family: "unavailable" }, { sizePt: -1 }, { emPt: 0, exPt: 3 }]) {
    const result = parseDimensionResult("1em", {}, { font });
    assert.equal(result.ok, false);
    assert.equal(result.diagnostic.code, "math-font-metrics");
    assert.equal(result.diagnostic.expression, "1em");
  }
  withMathDiagnostics(diagnostics, () => parseDimension("1em", {}, { font: { family: "unavailable" } }));
  assert.equal(diagnostics[0].code, "math-font-metrics");
  assert.equal(parseDimension("1cm", {}, { font: { family: "unavailable" } }), 1);
  assert.equal(parseDimension("2em", {}, { font: { emPt: 13.2, exPt: 5.1 } }), 2 * (13.2 / PT_PER_CM));
  assert.ok(Number.isFinite(parseDimension("1em", {}, { font: { sizePt: 13, tfm: "cmr12" } })));
});
