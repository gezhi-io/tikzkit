import katex from "katex";
import { scopeMathHtml, TIKZKIT_SCOPED_MATH_CSS } from "./mathScopedCss.js";

// KaTeX-native equivalents for TikZKit's labeled matrix brace helpers.
const KATEX_MACROS = {
  "\\overmat": "\\overbrace{#2}^{\\color{#3}\\text{#1}}",
  "\\undermat": "\\underbrace{#2}_{\\color{#3}\\text{#1}}"
};

export function renderScopedMathHtml(tex, options = {}) {
  const html = scopeMathHtml(
    katex.renderToString(tex, {
      displayMode: false,
      output: "html",
      throwOnError: false,
      strict: "ignore",
      trust: false,
      macros: KATEX_MACROS,
      ...options
    })
  );
  return `<span class="tikzkit-math-scope">${html}</span>`;
}

export function renderScopedMathStyleDef() {
  return `<style class="tikzkit-math-style"><![CDATA[${TIKZKIT_SCOPED_MATH_CSS}]]></style>`;
}
