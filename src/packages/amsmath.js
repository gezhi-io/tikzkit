export const texPackage = {
  "name": "amsmath",
  "status": "partial",
  "implementedBy": "src/tikz/text.js + src/tikz/textMetrics.js + src/renderers/svg/mathNode.js + src/renderers/svg/mathScriptFallback.js + src/renderers/svg/renderSvg.js + src/frontend/latex-shell.js:parseDeclareMathOperator + web/workbench.js",
  "features": [
    "KaTeX delegated environments/macros",
    "SVG-text aligned display fallback with amsmath \\jot row spacing",
    "explicit paired superscript/subscript cursor restoration in SVG-text fallback",
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
  "notes": "Reviewed TeX Live 2025 amsmath.sty: align rows are constructed by align@preamble/start@align and inherit opened-up display spacing. TikZKit uses scoped browser math for interactive previews and calibrated Computer Modern script advances plus explicit paired-script baseline/cursor restoration for the SVG-text fallback. Tags, intertext, split, gathered, multline, and full TeX macro expansion remain unsupported or partial."
};
