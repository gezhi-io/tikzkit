export const texPackage = {
  "name": "xcolor",
  "status": "builtin",
  "implementedBy": "src/frontend/latex-shell.js:collectColorDefinitions + src/frontend/parser.js + src/engine/options.js:normalizeColor + src/engine/evaluate.js + src/tikz/text.js + src/renderers/svg/mathNode.js",
  "features": [
    "\\definecolor",
    "\\colorlet aliases",
    "HTML/rgb/RGB/gray color models",
    "natural CMYK defaults for cyan/magenta/yellow/olive and their ! mixes",
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
  "notes": "Implemented as color definition/mix normalization plus leading text/math \\color declarations and scoped standalone \\color{name} state. Reviewed locally on 2026-08-06: color.sty declares cyan, magenta, yellow, and olive in CMYK, and xcolor preserves their natural model while applying ! mixes. TikZKit therefore blends their CMYK channels before the SVG DeviceCMYK conversion; xcolor-natural-cmyk and csv-2d-gaussian-multivarate-distributions verify the result. Optional xcolor target-model selection, color series, and arbitrary mid-text color-state segmentation remain partial."
};
