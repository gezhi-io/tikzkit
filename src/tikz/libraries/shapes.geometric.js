export const tikzLibrary = {
  "name": "shapes.geometric",
  "status": "partial",
  "implementedBy": [
    "src/engine/evaluate.js",
    "src/renderers/svg/nodeShapes.js"
  ],
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex",
  "features": [
    "regular polygon",
    "star",
    "trapezium",
    "cloud",
    "isosceles triangle with apex angle, minimum height, rotation, and named anchors"
  ],
  "implements": [
    "regular polygon",
    "star",
    "trapezium",
    "cloud",
    "isosceles triangle"
  ],
  "notes": "The supported polygonal shapes cover common geometry and flowchart cases. Remaining geometric-library shapes and the full PGF border-anchor algorithm are not implemented."
};
