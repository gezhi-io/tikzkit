const source = "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.statistics.code.tex";

export const pgfplotsLibrary = {
  name: "statistics",
  status: "partial",
  implementationStatus: "partial",
  implementedBy: "src/pgfplots/boxplots.js; src/pgfplots/boxplotStatistics.js; src/pgfplots/boxplotPaint.js; src/pgfplots/histogram.js; src/pgfplots/histogramBins.js",
  localSource: source,
  localSourceReviewed: source + "; pgfplotsplothandlers.code.tex:1638-1960; pgfplots.libs.statistics.tex (histogram examples)",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf",
  features: ["prepared and calculated 2D boxplots", "sample quantiles and outliers", "horizontal and vertical boxes", "numeric histogram manual examples"],
  notes: "Prepared summaries and scalar samples share whisker, quartile, median, average and outlier placement in 2D. The statistics manual's numeric histograms use a core PGFPlots handler: counts, density, cumulative counts and cumulative density work for supplied samples. Custom TeX callbacks and boxplot coordinate systems in overlaid user paths remain unsupported."
};
