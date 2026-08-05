export const tikzLibrary = {
  name: "pgfplots.dateplot",
  status: "partial",
  implementedBy: "src/pgfplots/libraries/dateplot.js + src/pgfplots/dateCoordinates.js",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.dateplot.code.tex",
  localDoc: null,
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.dateplot.code.tex",
  features: [
    "date coordinates in=x/y/z",
    "date ZERO",
    "ISO date tick labels with year/month/day/hour/minute templates"
  ],
  implements: [
    "date coordinates in=x/y/z",
    "date ZERO",
    "ISO date tick labels with year/month/day/hour/minute templates"
  ],
  notes: "TikZ's pgfplots.dateplot loader is registered separately from the PGFPlots dateplot declaration. It shares the focused ISO-date coordinate lowering; complete PGF calendar formatting and all inverse-template hooks remain partial."
};
