const source = "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.statistics.code.tex";

export const pgfplotsLibrary = {
  name: "statistics",
  status: "partial",
  implementationStatus: "partial",
  implementedBy: "src/pgfplots/boxplots.js; src/pgfplots/boxplotStatistics.js; src/pgfplots/boxplotPaint.js",
  localSource: source,
  localSourceReviewed: source,
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf",
  features: ["prepared and calculated 2D boxplots", "sample quantiles and outliers", "horizontal and vertical boxes"],
  notes: "Reviewed the installed statistics library and its manual examples. Prepared summaries and scalar samples share native whisker, quartile, median, average and outlier placement in 2D. Custom TeX draw callbacks and boxplot coordinate systems in overlaid user paths are not implemented."
};
