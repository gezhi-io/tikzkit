import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import {
  mathFallbackText,
  normalizeBrowserMathMacros,
  normalizeTikzText
} from "../src/tikz/text.js";
import { estimateFormulaBox, parseMathText } from "../src/tikz/textMetrics.js";

test("normalizes mathtools and nicefrac macros to browser math primitives", () => {
  const relation = normalizeTikzText(String.raw`$x \coloneqq s$`);
  assert.equal(relation.text, String.raw`$x \mathrel{≔} s$`);
  assert.equal(mathFallbackText(relation.text), "x ≔ s");

  const fraction = normalizeBrowserMathMacros(String.raw`\nicefrac[\mathrm]{a+b}{c_{d+1}}`);
  assert.doesNotMatch(fraction, /\\nicefrac/);
  assert.match(fraction, /\\raisebox\{0\.2em\}/);
  assert.match(fraction, /\\scriptsize\{\}\\mathrm\{a\+b\}/);
  assert.equal(mathFallbackText(fraction), "(a+b)/(c_d+1)");
});

test("measures nicefrac as a compact script-sized slash fraction", () => {
  const options = { texTextMetrics: true, widthPadding: 0, minWidth: 0 };
  const nice = estimateFormulaBox(String.raw`\nicefrac{1}{10}`, options);
  const plain = estimateFormulaBox("1/10", options);
  const stacked = estimateFormulaBox(String.raw`\frac{1}{10}`, options);

  assert.ok(nice.width < plain.width);
  assert.ok(nice.height + nice.depth < stacked.height + stacked.depth);
  assert.ok(nice.depth >= plain.depth);

  const parsed = parseMathText(String.raw`$\nicefrac{1}{3}$`);
  assert.ok(parsed);
  assert.doesNotMatch(parsed.tex, /\\nicefrac/);
  assert.match(parsed.tex, /\\raisebox\{0\.2em\}/);
});

test("renders nicefrac with optical script glyphs and TeX mu kerns", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \node {$\nicefrac{1}{2} \cdot x$};
  \end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /class="tikz-nicefrac"/);
  assert.match(result.svg, /class="tikz-nicefrac-numerator"[^>]*font-family="TikZKitCMR7, TikZKitCMUSerif, serif"/);
  assert.match(result.svg, /class="tikz-nicefrac-solidus"[^>]*dx="-/);
  assert.match(result.svg, /class="tikz-nicefrac-denominator"[^>]*dx="-[^"]*"[^>]*font-family="TikZKitCMR7, TikZKitCMUSerif, serif"/);
  assert.match(result.svg, /class="tikz-nicefrac-suffix"/);
  assert.match(result.svg, />⋅<\/tspan><tspan dx="[^"]+"><\/tspan>x/);
  assert.doesNotMatch(result.svg, />1\/2\s/);
});

test("measures simple ASCII math with Computer Modern height and depth", () => {
  const options = { texTextMetrics: true, widthPadding: 0, minWidth: 0 };
  const x = estimateFormulaBox("x", options);
  const fx = estimateFormulaBox("f(x)", options);
  const ptPerCm = 28.45274;

  assert.ok(Math.abs(x.height * ptPerCm - 4.3056) < 0.01, `unexpected x height: ${x.height * ptPerCm}pt`);
  assert.ok(Math.abs(x.depth * ptPerCm) < 0.01, `unexpected x depth: ${x.depth * ptPerCm}pt`);
  assert.ok(Math.abs((fx.height + fx.depth) * ptPerCm - 10) < 0.01, `unexpected f(x) total height: ${(fx.height + fx.depth) * ptPerCm}pt`);
  assert.ok(fx.height + fx.depth > x.height + x.depth);
});

test("renders the force-distance and hidden-markov fixtures without package macro leaks", () => {
  const cases = [
    { name: "force-distance-diagram", expected: ["≔"] },
    { name: "force-distance-diagram-constant", expected: ["≔"] },
    { name: "hidden-markov-model-abc", expected: ["1/3", "9/10"] },
    { name: "hidden-markov-model-abc-2", expected: ["6/10", "8/10"] }
  ];

  for (const fixture of cases) {
    const source = readFileSync(
      new URL(`./fixtures/examples/latex-examples/${fixture.name}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source);
    assert.deepEqual(result.diagnostics, [], fixture.name);
    assert.doesNotMatch(result.svg, /coloneqq|nicefrac/, fixture.name);
    for (const expected of fixture.expected) {
      assert.ok(result.svg.includes(expected), `${fixture.name}: expected ${expected}`);
    }
  }
});
