import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { cmMathMetrics } from "../src/tex/cmMathMetrics.js";
import { nativeMathGroups } from "./helpers/native-math-svg.js";

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.001,
  `${label}: ${actual} TeX pt differs from native ${expected} TeX pt`);

test("ordinary hats use native TeX accent boxes at optical sizes and math styles", () => {
  // Independent pdfTeX values from fixtures/native-math-hat-metrics.tex.
  const probes = [
    ["\\hat{\\theta}", {}, 4.97223, 9.58334, 0],
    ["\\hat{\\theta}_1", {}, 9.18057, 9.58334, 1.49998],
    ["\\hat{\\theta}^2_1", {}, 9.45836, 9.58334, 2.48210],
    ["\\hat{\\theta_1}", {}, 9.18057, 9.58334, 1.49998],
    ["{\\hat{\\theta}}_1", {}, 9.18057, 9.58334, 1.49998],
    ["\\hat{x}", {}, 5.71527, 6.94444, 0],
    ["\\hat{f}", {}, 5.97226, 9.58334, 1.94444],
    ["\\hat{xy}", {}, 10.97687, 6.94444, 1.94444],
    ["\\hat{\\hat{x}}", {}, 5.71527, 9.58334, 0],
    ["\\hat{{x}}", {}, 5.71527, 6.94444, 0],
    ["\\scriptstyle\\hat{\\theta}_1", {}, 7.71184, 6.70831, 1],
    ["\\scriptscriptstyle\\hat{\\theta}_2", {}, 7.28827, 4.79166, 1.5],
    ["\\hat{\\theta}_1", { fontSizePt: 8 }, 8.13193, 7.66667, 1.11110],
    ["\\hat{\\theta}_1", { fontSizePt: 12 }, 10.22570, 11.49995, 1.79999],
    ["\\hat{\\theta}_1", { mathVersion: "bold" }, 10.64857, 9.44444, 1.49998],
    ["\\mathbf{\\hat{x}}", {}, 6.06941, 6.94444, 0],
    ["\\hat{\\mathbf{x}}", {}, 6.06941, 7.08334, 0],
    ["\\hat{\\frac{x}{y}}", {}, 6.93472, 9.59010, 4.80951]
  ];
  for (const [source, options, width, height, depth] of probes) {
    const box = layoutNativeMath(source, options);
    assert.ok(box, `${source}: ordinary hat must not fall back`);
    close(box.width, width, `${source} width`);
    close(box.height, height, `${source} height`);
    close(box.depth, depth, `${source} depth`);
    assert.ok(box.items.some(item => item.type === "glyph" && item.text === "\u02c6"));
  }
});

test("hat skew comes from the accentee TFM and scripts remain attached to the nucleus", () => {
  // OML/cmm's skewchar is 127, not a Unicode glyph in the exported font.
  close(cmMathMetrics.CMMI10.skewKern?.["\u03b8"] * 10, 0.8333587646484375, "theta skew kern");
  const box = layoutNativeMath("\\hat{\\theta}_1");
  assert.ok(box);
  const [hat, theta, sub] = box.items;
  assert.equal(hat.text, "\u02c6");
  assert.equal(hat.family, "TikZKitCMR10");
  close(hat.x, 0.81947, "hat horizontal shift");
  close(hat.y, -2.63890, "hat baseline");
  assert.equal(theta.text, "\u03b8");
  close(theta.x, 0, "nucleus x");
  close(theta.y, 0, "nucleus baseline");
  close(sub.x, 4.69444, "subscript starts before italic correction");
  close(sub.y, 1.49998, "subscript baseline");
  assert.equal(sub.family, "TikZKitCMR7");
  const inside = layoutNativeMath("\\hat{\\theta_1}");
  close(inside.items[0].x, 2.09029, "composite nucleus receives no single-character skew");
  const nested = layoutNativeMath("\\hat{\\hat{x}}");
  close(nested.items[0].x, 0.35764, "plain TeX nested outer hat has no single-character skew");
  close(nested.items[1].x, 0.63542, "inner hat retains the x skew kern");
  assert.deepEqual(layoutNativeMath("\\hat{\\mathbf{{x}}}_1"),
    layoutNativeMath("\\hat{\\mathbf{x}}_1"), "nested single-character groups retain the nucleus font");
});

test("real pin hats share native measurement and glyph painting in default and export modes", () => {
  const source = readFileSync(new URL("fixtures/pgfplots-function-colors/pins.tex", import.meta.url), "utf8");
  const standard = tikzToSvg(source);
  const exported = tikzToSvg(source, { mathRenderer: "svg-text" });
  assert.deepEqual(standard.diagnostics, []);
  assert.deepEqual(exported.diagnostics, []);
  const groups = nativeMathGroups(standard.svg);
  assert.equal(groups.length, 2);
  assert.deepEqual(nativeMathGroups(exported.svg), groups);
  assert.deepEqual(groups.map(group => group.glyphs.map(g => g.text)), [
    ["\u02c6", "\u03b8", "1"], ["\u02c6", "\u03b8", "2"]
  ]);
  for (const result of [standard, exported]) {
    assert.ok(!result.svg.includes("foreignObject"));
    assert.equal(result.ir.items.filter(item => item.type === "textNode" && item.text).length, 2);
  }
});

test("accent family follows TeX mathalpha selection, not the nucleus font alone", () => {
  // fixtures/native-math-hat-families.tex traces the actual shipped fonts.
  const probes = [
    ["\\mathbf{\\hat{x}}", {}, 6.06941, 6.94444, "CMBX", "CMBX", 0.15973],
    ["\\hat{\\mathbf{x}}", {}, 6.06941, 7.08334, "CMR", "CMBX", 0.53470],
    ["\\boldsymbol{\\hat{x}}", {}, 6.59027, 6.94444, "CMBX", "CMMIB", 0.73960],
    ["\\hat{\\boldsymbol{x}}", {}, 6.59027, 7.08334, "CMR", "CMMIB", 0.79514],
    ["\\hat{x}", { mathVersion: "bold" }, 6.59027, 6.94444, "CMBX", "CMMIB", 0.73960],
    ["\\hat{\\mathnormal{x}}", {}, 5.71527, 6.94444, "CMR", "CMMI", 0.63542],
    ["\\mathnormal{\\mathrm{\\hat{x}}}", {}, 5.27780, 6.94444, "CMR", "CMR", 0.13890],
    ["\\mathnormal{\\mathbf{\\hat{x}}}", {}, 6.06941, 6.94444, "CMBX", "CMBX", 0.15973]
  ];
  for (const [source, options, width, height, accentRole, nucleusRole, shift] of probes) {
    const box = layoutNativeMath(source, options);
    assert.ok(box, source);
    close(box.width, width, `${source} width`);
    close(box.height, height, `${source} height`);
    close(box.depth, 0, `${source} depth`);
    assert.equal(box.items[0].family, `TikZKit${accentRole}10`, `${source} accent family`);
    assert.equal(box.items[1].family, `TikZKit${nucleusRole}10`, `${source} nucleus family`);
    close(box.items[0].x, shift, `${source} accent horizontal shift`);
  }
  for (const source of ["\\mathnormal{\\hat{x}}", "\\mathbf{\\mathnormal{\\hat{x}}}"])
    assert.equal(layoutNativeMath(source), null, "CMMI slot 5E must not be replaced by a CMR hat");
  assert.equal(layoutNativeMath("\\mathnormal{\\hat{x}}", { mathVersion: "bold" }), null);
});

test("unimplemented wide and other accents do not silently use the ordinary hat rule", () => {
  for (const source of ["\\widehat{x}", "\\widetilde{x}", "\\bar{x}", "\\vec{x}", "\\hat{\\widehat{x}}"])
    assert.equal(layoutNativeMath(source, { preferNativeMath: true }), null, source);
});
