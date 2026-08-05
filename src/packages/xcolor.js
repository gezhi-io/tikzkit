export const texPackage = {
  "name": "xcolor",
  "status": "builtin",
  "implementedBy": "src/frontend/latex-shell.js:collectColorDefinitions + src/frontend/parser.js + src/engine/evaluate.js + src/tikz/text.js + src/renderers/svg/mathNode.js",
  "features": [
    "\\definecolor",
    "\\colorlet aliases",
    "HTML/rgb/RGB/gray color models",
    "\\textcolor color-name replacement",
    "leading text/math \\color declarations",
    "scoped standalone \\color{name} state"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/xcolor/xcolor.sty",
  "localDoc": null,
  "localSourceReviewed": true,
  "caseCount": 333,
  "caseExamples": [
    "A3C neural network / a3c_neural_network",
    "Reinforcement learning greedy policy / reinforcement_learning_greedy_policy",
    "3d gradient colored",
    "3d hypersurface 3",
    "ai artificial intelligence aiama arr",
    "ai artificial intelligence jmccarthy arr",
    "ai computational intelligence pool,mackworth arr",
    "elem physics arrows to nodes elem phsyics",
    "impact concentric blocks diagram",
    "impact market sector diagram",
    "nn encoder 2pages 3figs neuralnet",
    "nn 06 manual net color neuralnet foreach style"
  ],
  "observedOptions": [
    "table",
    "usenames,dvipsnames"
  ],
  "notes": "Implemented as color definition/mix normalization plus leading text/math \\color declarations and scoped standalone \\color{name} state. Optional xcolor models and arbitrary mid-text color-state segmentation remain partial."
};
