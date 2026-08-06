export const texPackage = {
  "name": "amsmath",
  "status": "partial",
  "implementedBy": "src/tikz/text.js + src/tikz/textMetrics.js + src/tikz/mathMatrixSyntax.js + src/renderers/svg/mathMatrixFallback.js + src/renderers/svg/mathNode.js + src/renderers/svg/textEngine.js + src/renderers/svg/mathScriptFallback.js + src/renderers/svg/renderSvg.js + src/frontend/latex-shell.js:parseDeclareMathOperator + web/workbench.js",
  "features": [
    "KaTeX delegated environments/macros",
    "SVG-text aligned display fallback with amsmath \\jot row spacing",
    "explicit paired superscript/subscript cursor restoration in SVG-text fallback",
    "SVG-text array fallback: l/c/r columns, @{} zero intercolumn gaps, basic *{n}{...} repeat, and \\left...\\right delimiters",
    "inline matrix formula metrics use local Computer Modern 5/7/8/9/10pt design-size advances",
    "\\DeclareMathOperator macro expansion"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty",
  "localDoc": null,
  "caseCount": 38,
  "caseExamples": [
    "A3C execution / a3c_execution",
    "A3C neural network / a3c_neural_network",
    "Multilayer network / multilayer_network",
    "muxstep pipeline / muxstep_pipeline",
    "Reinforcement learning greedy policy / reinforcement_learning_greedy_policy",
    "Complex roots - tangent real solution",
    "Complex roots - two real solutions",
    "Complex roots - imaginary solutions",
    "Complex roots - shifted complex solutions",
    "Complex roots - imaginary roots extended graph",
    "Complex roots - shifted extended graph",
    "Complex roots - equation text block"
  ],
  "observedOptions": [],
  "localSourceReviewed": true,
  "notes": "Reviewed TeX Live 2025 amsmath.sty and array.sty: align rows are constructed by align@preamble/start@align and inherit opened-up display spacing; matrix uses array with arraycolsep compensation. On 2026-08-07, local cmr/cmmi/cmsy/cmex TFM design sizes were checked for 5/7/8/9/10pt: inline pmatrix layout now uses fixed arraycolsep and design-size digit, relation, delimiter, italic-correction, and common binary-operator advances rather than an empirical small-font blend. TikZKit uses scoped browser math for interactive previews and calibrated Computer Modern script advances plus explicit paired-script baseline/cursor restoration for the SVG-text fallback. The portable fallback structurally lays out array l/c/r columns, @{} zero gaps, basic *{n}{...} repetition, and \\left...\\right delimiters. Tags, intertext, split, gathered, multline, nonempty/custom array preambles, cross-reference expansion, and full TeX macro expansion remain unsupported or partial."
};
