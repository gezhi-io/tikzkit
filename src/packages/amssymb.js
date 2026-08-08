export const texPackage = {
  "name": "amssymb",
  "status": "partial",
  "implementedBy": "src/tikz/text.js + src/tikz/textMetrics.js + src/renderers/svg/mathScriptFallback.js + src/renderers/svg/mathNode.js",
  "features": [
    "SVG-text fallback for common relation symbols (leqslant/geqslant, nleq/ngeq, nsubseteq/nsupseteq, rightsquigarrow/leadsto, therefore/because) and varnothing",
    "other symbols delegated to browser math or SVG text fallback"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/amsfonts/amssymb.sty",
  "localDoc": null,
  "localSourceReviewed": true,
  "caseCount": 17,
  "caseExamples": [
    "A3C execution / a3c_execution",
    "A3C neural network / a3c_neural_network",
    "muxstep pipeline / muxstep_pipeline",
    "Reinforcement learning greedy policy / reinforcement_learning_greedy_policy",
    "disk to plane",
    "ergodic",
    "operator orderings",
    "colorized equation equation",
    "doc ml cnn",
    "doc ml single cnn",
    "ml cnn",
    "ml single cnn"
  ],
  "observedOptions": [],
  "notes": "Reviewed local TeX Live amssymb.sty on 2026-08-08: the implemented relation symbols are declared with \\mathrel and varnothing with \\mathord. Broad AMSa/AMSb symbol coverage remains partial."
};
