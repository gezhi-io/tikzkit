export const texPackage = {
  "name": "amsmath",
  "status": "partial",
  "implementedBy": "src/tikz/text.js + src/tikz/textMetrics.js + src/renderers/svg/mathNode.js + src/renderers/svg/renderSvg.js + src/frontend/latex-shell.js:parseDeclareMathOperator",
  "features": [
    "KaTeX delegated environments/macros",
    "SVG-text aligned display fallback with amsmath \\jot row spacing",
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
  "notes": "Partial amsmath subset: align/aligned display rows, common scripts, color groups, matrices, and math fallback layout. Tags, intertext, split, gathered, multline, and full TeX macro expansion remain unsupported or partial."
};
