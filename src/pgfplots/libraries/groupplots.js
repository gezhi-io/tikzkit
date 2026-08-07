export const pgfplotsLibrary = {
  name: "groupplots",
  status: "partial",
  implementationStatus: "partial",
  implementedBy: "src/frontend/latex-shell.js:expandPgfplotsGroupplots/renderGroupplotAsAxes; src/pgfplots/axisTikzLowering.js:renderCurrentAxisCoordinates",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.groupplots.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.groupplots.code.tex",
  features: [
    "groupplot environment",
    "\\nextgroupplot",
    "group size",
    "horizontal/vertical sep",
    "group name cCrR anchors",
    "group/every plot style",
    "group/plot cCrR style",
    "group/empty plot",
    "x/y labels and ticklabels at edge",
    "x/y descriptions at edge"
  ],
  notes: "Reviewed locally on 2026-08-07: the source places each new column from the previous axis east anchor plus horizontal sep and each new row from the axis above south anchor minus vertical sep; descriptions-at-edge suppresses both inner labels and tick labels. TikZKit lowers the focused 2D grid/layout subset using measured plot boxes, exposes group cCrR anchors, accepts group/every plot and per-cell styles, and scopes the native try min ticks=4 default to these axes. trim axis group, arbitrary nested group styles, full shared-label modes, and general cross-group coordinate manipulation remain partial."
};
