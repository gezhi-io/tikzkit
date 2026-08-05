export const pgfplotsLibrary = {
  name: "groupplots",
  status: "builtin",
  implementationStatus: "builtin",
  implementedBy: "src/frontend/latex-shell.js:expandPgfplotsGroupplots",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.groupplots.code.tex",
  localDoc: null,
  localSourceReviewed: false,
  features: ["groupplot environment", "\\nextgroupplot", "group size", "horizontal/vertical sep"],
  notes: "The focused groupplot layout and nextgroupplot expansion are implemented. Nested group options and the full PGFPlots groupplot key space remain partial."
};
