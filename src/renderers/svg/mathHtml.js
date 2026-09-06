import katex from "katex";
import { scopeMathHtml, TIKZKIT_SCOPED_MATH_CSS } from "./mathScopedCss.js";

// KaTeX-native equivalents for TikZKit's labeled matrix brace helpers.
const KATEX_MACROS = {
  "\\overmat": "\\overbrace{#2}^{\\color{#3}\\text{#1}}",
  "\\undermat": "\\underbrace{#2}_{\\color{#3}\\text{#1}}"
};

export function renderScopedMathHtml(tex, options = {}) {
  let html = scopeMathHtml(
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
  if (options.mathVersion === "sans") {
    html = html.replace(
      /class="([^\"]*\btikzkit-math-root\b[^\"]*)"/,
      'class="$1 tikzkit-math-sans"'
    );
    if (options.sansFontFamily === "helvetica") {
      html = html.replace(
        /class="([^\"]*\btikzkit-math-sans\b[^\"]*)"/,
        'class="$1 tikzkit-math-helvetica"'
      );
    }
  }
  const scopeClass = options.inlineText
    ? "tikzkit-math-scope tikzkit-math-inline-text"
    : "tikzkit-math-scope";
  return `<span class="${scopeClass}">${html}</span>`;
}

export function renderScopedMathStyleDef() {
  return `<style class="tikzkit-math-style"><![CDATA[${TIKZKIT_SCOPED_MATH_CSS}${TIKZKIT_SANS_MATH_CSS}]]></style>`;
}

// sansmath leaves math italic letters and symbols alone, but maps operators,
// digits, and \mathrm (including the \mathbf replacement) to \sfdefault.
const TIKZKIT_SANS_MATH_CSS =
  ".tikzkit-math-scope.tikzkit-math-inline-text .tikzkit-math-root{font-size:1em}" +
  ".tikzkit-math-scope .tikzkit-math-root.tikzkit-math-sans{font-family:TikZKitCMUSans,'CMU Sans Serif',sans-serif}" +
  ".tikzkit-math-scope .tikzkit-math-root.tikzkit-math-sans .tikzkit-math-mathboldsf{font-family:TikZKitCMUSans,'CMU Sans Serif',sans-serif;font-style:normal}" +
  ".tikzkit-math-scope .tikzkit-math-root.tikzkit-math-helvetica{font-family:Helvetica,Arial,sans-serif}" +
  ".tikzkit-math-scope .tikzkit-math-root.tikzkit-math-helvetica .tikzkit-math-mathboldsf{font-family:Helvetica,Arial,sans-serif;font-style:normal}";
