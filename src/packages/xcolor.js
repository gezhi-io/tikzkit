export const texPackage = {
  "name": "xcolor",
  "status": "partial",
  "implementedBy": "src/engine/colors.js + src/frontend/latex-shell.js:collectColorDefinitions + src/frontend/parser.js + src/engine/evaluate.js + src/tikz/text.js + src/renderers/svg/mathNode.js",
  "features": [
    "\\definecolor",
    "\\colorlet aliases",
    "HTML/rgb/RGB/gray color models",
    "natural CMYK defaults for cyan/magenta/yellow/olive and their ! mixes",
    "native darkgray/lightgray intensities and case-sensitive mixing of the supported dvips names",
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
  "notes": "Color definitions, natural-model ! mixes, leading text/math color declarations and scoped color state. Reviewed xcolor.sty, color.sty and dvipsnam.def locally on 2026-10-22: darkgray/lightgray use .25/.75 gray; supported Blue/Green/Red/WildStrawberry/Sepia/LimeGreen names retain case-sensitive CMYK channels through interpolation, then convert once with DeviceCMYK. Shared implementation is isolated in src/engine/colors.js; module-regressions palettes were compared in Chrome against pdflatex/tikztosvg. Status remains partial: complete option-selected named palettes, target-model selection, color series and arbitrary mid-text color-state segmentation are not implemented."
};

texPackage.features.push("SkyBlue/SpringGreen dvips natural-model colors and reusable model-preserving colormap conversion");
texPackage.notes += " On 2026-10-23, dvipsnam.def SkyBlue and SpringGreen and PGFPlots first-stop model conversion were reviewed locally. Colormap stops are converted in xcolor's algebraic model before interpolation; DeviceCMYK display conversion happens only after interpolation. Function plots, fills and pins were checked in Chrome against tikztosvg. Exact fixed-point RGB mixture rounding remains partial (red!90!black retains a one-byte difference); this is not a full color-model certification. See docs/qa/2026-10-23-pgfplots-quiver-colors.md.";
