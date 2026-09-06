import katex from "katex";
import { scopeMathHtml, TIKZKIT_SCOPED_MATH_CSS } from "./mathScopedCss.js";

// KaTeX-native equivalents for TikZKit's labeled matrix brace helpers.
const KATEX_MACROS = {
  "\\overmat": "\\overbrace{#2}^{\\color{#3}\\text{#1}}",
  "\\undermat": "\\underbrace{#2}_{\\color{#3}\\text{#1}}"
};

const measurementCache = new Map();

export function measureScopedMathExtents(tex, displayMode = false) {
  const key = JSON.stringify([tex, displayMode]);
  if (measurementCache.has(key)) return measurementCache.get(key);
  let result = { height: 0, depth: 0 };
  try {
    const tree = katex.__renderToHTMLTree(tex, {
      displayMode, strict: "ignore", trust: false, macros: KATEX_MACROS
    });
    result = { height: Math.max(0, tree.height || 0), depth: Math.max(0, tree.depth || 0) };
  } catch {
    // Invalid TeX is reported by the conversion pipeline; keep fallback metrics.
  }
  if (measurementCache.size >= 512) measurementCache.delete(measurementCache.keys().next().value);
  measurementCache.set(key, result);
  return result;
}

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
  ".tikzkit-math-scope .tikzkit-math-root .tikzkit-math-mathbb,.tikzkit-math-scope .tikzkit-math-root .tikzkit-math-textbb,.tikzkit-math-scope .tikzkit-math-root .tikzkit-math-amsrm{font-family:TikZKitMath_AMSCaps,TikZKitMath_AMS}" +
  ".tikzkit-math-scope .tikzkit-math-root.tikzkit-math-sans{font-family:TikZKitCMUSans,'CMU Sans Serif',sans-serif}" +
  ".tikzkit-math-scope .tikzkit-math-root.tikzkit-math-sans .tikzkit-math-mathboldsf{font-family:TikZKitCMUSans,'CMU Sans Serif',sans-serif;font-style:normal}" +
  ".tikzkit-math-scope .tikzkit-math-root.tikzkit-math-helvetica{font-family:TikZKitHeros,sans-serif}" +
  ".tikzkit-math-scope .tikzkit-math-root.tikzkit-math-helvetica .tikzkit-math-mathboldsf{font-family:TikZKitHeros,sans-serif;font-style:normal}";
