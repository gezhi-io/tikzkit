export const texPackage = {
  "name": "color",
  "status": "builtin",
  "implementedBy": "src/preprocess.js:collectColorDefinitions + src/tex-text.js",
  "features": [
    "basic color package compatibility",
    "\\textcolor subset"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/graphics/color.sty",
  "localDoc": null,
  "caseCount": 3,
  "caseExamples": [
    "colorized equation equation",
    "table comparison many",
    "table comparison med"
  ],
  "observedOptions": [],
  "notes": "Handled through the same color normalization path as xcolor."
};
