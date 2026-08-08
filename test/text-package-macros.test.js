import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import {
  mathFallbackText,
  normalizeBrowserMathMacros,
  tikzHspaceText,
  normalizeTikzText
} from "../src/tikz/text.js";
import { estimateFormulaBox, parseMathText, wrapTeXTextLineByWidth } from "../src/tikz/textMetrics.js";

test("normalizes mathtools and nicefrac macros to browser math primitives", () => {
  const relation = normalizeTikzText(String.raw`$x \coloneqq s$`);
  assert.equal(relation.text, String.raw`$x \mathrel{≔} s$`);
  assert.equal(mathFallbackText(relation.text), "x ≔ s");
  assert.equal(mathFallbackText(String.raw`A~B`), "A B");

  const fraction = normalizeBrowserMathMacros(String.raw`\nicefrac[\mathrm]{a+b}{c_{d+1}}`);
  assert.doesNotMatch(fraction, /\\nicefrac/);
  assert.match(fraction, /\\raisebox\{0\.2em\}/);
  assert.match(fraction, /\\scriptsize\{\}\\mathrm\{a\+b\}/);
  assert.equal(mathFallbackText(fraction), "(a+b)/(c_d+1)");
});

test("normalizes units package math commands through upright units and nice fractions", () => {
  const normalized = normalizeBrowserMathMacros(String.raw`d=\unit[12]{m},\quad v=\unitfrac[36]{km}{h}`);

  assert.doesNotMatch(normalized, /\\unit(?:frac)?/);
  assert.match(normalized, /12\\,\\mathrm\{m\}/);
  assert.match(normalized, /36\\,\\mathord\{\\raisebox\{0\.2em\}/);
  assert.match(normalized, /\\scriptsize\{\}\\mathrm\{km\}/);
  assert.match(normalized, /\\scriptsize\{\}\\mathrm\{h\}/);

  const result = tikzToSvg(String.raw`
    \documentclass{standalone}
    \usepackage{units}
    \begin{document}
    \begin{tikzpicture}
      \node {$d=\unit[12]{m},\quad v=\unitfrac[36]{km}{h}$};
    \end{tikzpicture}
    \end{document}
  `, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.doesNotMatch(result.svg, /\\unit(?:frac)?/);
  assert.match(result.svg, /font-style="italic"[^>]*>[\s\S]*tikz-math-upright[^>]*>m<\/tspan>/);
  assert.match(result.svg, /tikz-math-upright[^>]*font-style="normal"[^>]*>m<\/tspan>/);
  assert.match(result.svg, /tikz-nicefrac-numerator[^>]*>km<\/tspan>/);
  assert.match(result.svg, /tikz-nicefrac-denominator[^>]*>h<\/tspan>/);
});

test("keeps variables italic and units upright in multi-line units nodes", () => {
  const source = readFileSync(new URL("./fixtures/examples/units/math-mode-units.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /<tspan[^>]*font-style="italic"[^>]*>d = 12<tspan class="tikz-math-thin-space"[^>]*><\/tspan><tspan class="tikz-math-upright"/);
  assert.match(result.svg, /tikz-nicefrac-prefix">v = 36<\/tspan>/);
  assert.match(result.svg, /tikz-nicefrac-denominator[^>]*><tspan>s<\/tspan><tspan[^>]*baseline-shift="super"[^>]*>2<\/tspan><\/tspan>/);
});

test("normalizes gensymb default math symbols to their TeX Live fallbacks", () => {
  const degree = normalizeBrowserMathMacros(String.raw`63 \degree`);
  assert.equal(degree, String.raw`63^\circ`);
  assert.equal(mathFallbackText(degree), "63°");

  const symbols = normalizeBrowserMathMacros(String.raw`T=25\celsius,\quad R=10\ohm`);
  assert.equal(symbols, String.raw`T=25^\circ\mathrm{C},\quad R=10\Omega`);
  assert.equal(mathFallbackText(symbols), `T = 25°C,${tikzHspaceText("1em")}R = 10Ω`);
  assert.equal(mathFallbackText(String.raw`a\qquad b`), `a${tikzHspaceText("2em")}b`);

  const result = tikzToSvg(String.raw`\begin{tikzpicture}\node {$T=25\celsius,\quad R=10\ohm,\quad \scriptscriptstyle \varphi = 63 \degree$};\end{tikzpicture}`, {
    mathRenderer: "svg-text"
  });
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /baseline-shift="super"[^>]*>°<\/tspan>/);
  assert.match(result.svg, /tikz-math-upright[^>]*>C<\/tspan>/);
  assert.match(result.svg, /10Ω,/);
  assert.doesNotMatch(result.svg, />degree|>celsius|>ohm|>quad</);
  assert.match(result.svg, /class="tikz-math-hspace" dx="[^"]+"/);
});

test("normalizes common amssymb relation and empty-set symbols for SVG text", () => {
  const source = String.raw`A\leqslant B,\quad B\nleq C,\quad \varnothing\nsubseteq A,\quad A\rightsquigarrow B,\quad P\therefore Q,\quad Q\because P`;

  assert.equal(mathFallbackText(source), `A ⩽ B,${tikzHspaceText("1em")}B ≰ C,${tikzHspaceText("1em")}∅ ⊈ A,${tikzHspaceText("1em")}A ⇝ B,${tikzHspaceText("1em")}P ∴ Q,${tikzHspaceText("1em")}Q ∵ P`);

  const result = tikzToSvg(String.raw`\begin{tikzpicture}\node {$${source}$};\end{tikzpicture}`, {
    mathRenderer: "svg-text"
  });
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /⩽/);
  assert.match(result.svg, /≰/);
  assert.match(result.svg, /∅/);
  assert.match(result.svg, /⊈/);
  assert.match(result.svg, /⇝/);
  assert.match(result.svg, /∴/);
  assert.match(result.svg, /∵/);
  assert.doesNotMatch(result.svg, />leqslant|>nleq|>varnothing|>nsubseteq|>rightsquigarrow|>therefore|>because/);
});

test("keeps scoped textbf formatting off later matrix-node lines", () => {
  const normalized = normalizeTikzText(String.raw`\textbf{Enum}\\{\small (), Bool, Char}`);

  assert.equal(normalized.fontWeight, null);
  assert.equal(normalized.lineStyles[0].fontWeight, 700);
  assert.equal(normalized.lineStyles[1].fontWeight, null);
  assert.equal(normalized.lineStyles[1].scale, 0.9);
  assert.equal(normalized.lineStyles[1].fontSizePt, 9);
  assert.equal(normalized.lineStyles[1].baselineSkipPt, 11);
});

test("measures scoped text-width nodes as TeX minipage paragraphs", () => {
  const scoped = tikzToSvg(String.raw`
    \begin{tikzpicture}
      \node[ellipse,thick,draw,inner sep=0pt,text width=3cm,align=center]
        {\textbf{Enum}\\{\small (), Bool, Char, Ordering, Int, Integer, Float, Double}};
    \end{tikzpicture}
  `);
  const normal = tikzToSvg(String.raw`
    \begin{tikzpicture}
      \node[ellipse,thick,draw,inner sep=0pt,text width=3cm,align=center]
        {\textbf{Enum}\\(), Bool, Char, Ordering, Int, Integer, Float, Double};
    \end{tikzpicture}
  `);
  const scopedBox = scoped.ir.items.find((item) => item.type === "nodeBox");
  const normalBox = normal.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(scoped.diagnostics, []);
  assert.deepEqual(normal.diagnostics, []);
  // Local TeX measures this box at 44.61111pt before the ellipse's sqrt(2)
  // expansion, which yields a 2.218cm painted ellipse (plus stroke details).
  assert.ok(scopedBox.height > 2.21 && scopedBox.height < 2.23, `expected TeX minipage height for scoped text, got ${scopedBox.height}`);
  assert.ok(normalBox.height > scopedBox.height + 0.45, `expected normal text to need one extra wrapped line, got ${scopedBox.height} -> ${normalBox.height}`);
});

test("uses conservative English hyphenation for constrained TeX paragraphs", () => {
  const lines = wrapTeXTextLineByWidth(
    "(), Bool, Char, Ordering, Int, Integer, Float, Double",
    3,
    0.9
  );

  assert.deepEqual(lines, [
    "(), Bool, Char, Or-",
    "dering, Int, Integer,",
    "Float, Double"
  ]);
});

test("uses strict, balanced line breaking for centered TikZ text widths", () => {
  assert.deepEqual(
    wrapTeXTextLineByWidth("All except IO, (->), IOError", 3, 1, { lineBreakMode: "center" }),
    ["All except IO,", "(->), IOError"]
  );
  assert.deepEqual(
    wrapTeXTextLineByWidth("Int, Integer, Float, Double", 3, 1, { lineBreakMode: "center" }),
    ["Int, Integer,", "Float, Double"]
  );
  assert.deepEqual(
    wrapTeXTextLineByWidth("Int, Char, Bool, (), Ordering, tuples", 3, 1, { lineBreakMode: "center" }),
    ["Int, Char, Bool, (),", "Ordering, tuples"]
  );
});

test("does not hyphenate TeX commands, URLs, or acronyms while wrapping text", () => {
  const command = wrapTeXTextLineByWidth(String.raw`before \\textbf{Ordering} after words`, 2, 0.9);
  const url = wrapTeXTextLineByWidth("before https://example.com/Ordering after words", 2, 0.9);
  const acronym = wrapTeXTextLineByWidth("before ORDERING after words", 2, 0.9);

  assert.ok(command.every((line) => !line.includes("Or-")));
  assert.ok(url.every((line) => !line.includes("Or-")));
  assert.ok(acronym.every((line) => !line.includes("OR-")));
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

  const inline = tikzToSvg(String.raw`\begin{tikzpicture}\node[align=left] {$A~\nicefrac{6}{10}$\\$B~\nicefrac{2}{10}$};\end{tikzpicture}`, {
    mathRenderer: "svg-text"
  });
  assert.match(inline.svg, /tikz-nicefrac-prefix">A\u00a0<\/tspan>/);
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
    assert.doesNotMatch(result.svg, /coloneqq|\\nicefrac/, fixture.name);
    for (const expected of fixture.expected) {
      if (!expected.includes("/")) {
        assert.ok(result.svg.includes(expected), `${fixture.name}: expected ${expected}`);
        continue;
      }
      const [numerator, denominator] = expected.split("/");
      const opticalFraction = new RegExp(
        `tikz-nicefrac-numerator[^>]*>${numerator}</tspan>[\\s\\S]*tikz-nicefrac-denominator[^>]*>${denominator}</tspan>`
      );
      assert.ok(result.svg.includes(expected) || opticalFraction.test(result.svg), `${fixture.name}: expected ${expected}`);
    }
  }
});
