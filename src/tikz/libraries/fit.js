export const tikzLibrary = {
  name: "fit",
  status: "builtin",
  implementedBy: "src/engine/evaluate.js:resolveFitNodeLayout",
  localSourceReviewed: "yes",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryfit.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-fit.tex",
  notes: "Reviewed locally on 2026-08-07: fit unions named-node or explicit coordinate anchors, adds normal node separation, preserves minimum width/height/size, and expands ellipse/circle fit shapes. rotate fit and arbitrary affine fit transforms remain partial.",
  features: [
    "fit bounds from named-node and coordinate anchors",
    "minimum width, height, and size",
    "rectangle, ellipse, and circle fit shapes"
  ],
  implements: [
    "fit bounds from named-node and coordinate anchors",
    "minimum width, height, and size",
    "rectangle, ellipse, and circle fit shapes"
  ]
};
