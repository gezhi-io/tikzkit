export const pgfplotsLibrary = {
  name: "fillbetween",
  status: "partial",
  implementationStatus: "partial",
  implementedBy: [
    "src/pgfplots/fillBetween.js", "src/pgfplots/fillBetweenBoundaries.js",
    "src/pgfplots/fillBetweenAssembly.js", "src/pgfplots/fillBetweenSoftClip.js",
    "src/pgfplots/fillBetweenSplit.js", "src/pgfplots/fillBetweenClipSelectors.js",
    "src/pgfplots/fillBetweenBox.js", "src/pgfplots/fillBetweenCorner.js",
    "src/pgfplots/fillBetweenNamedClips.js", "src/pgfplots/fillBetweenSurvey.js"
  ].join("; "),
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.fillbetween.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf",
  localSourceReviewed: [
    "pgfplots/pgfcontrib/pgflibraryfillbetween.code.tex", "pgfplots/pgfcontrib/tikzlibraryfillbetween.code.tex",
    "pgfplots/pgfcontrib/tikzlibrarydecorations.softclip.code.tex", "pgf/libraries/pgflibraryintersections.code.tex",
    "pgfplots/pgfplots.scaling.code.tex", "pgfplots/pgfplots.code.tex", "pgf/frontendlayer/tikz/tikz.code.tex",
    "pgfplots/libs/tikzlibrarypgfplots.fillbetween.code.tex"
  ].map(file => "/usr/local/texlive/2025/texmf-dist/tex/generic/" + file).join("; "),
  features: [
    "named sharp, smooth, and stepped plot boundaries",
    "open named path and draw boundaries with straight and explicit cubic segments",
    "reverse=auto/true/false and inner moveto=connect/keep before clipping",
    "finite numeric x/y soft clips using the axis survey",
    "independent explicit and named 2D rectangular soft clips before splitting",
    "split=true for x-monotone 2D paths",
    "ordered polyline intersection regions",
    "automatic opposite-traversal normalization",
    "per-segment numbered/odd/even/last style cascade",
    "pre-main area layering"
  ],
  notes: "Two open named 2D boundaries retain straight segments, step corners and cubic controls. Direction, reverse and inner moveto are resolved before clipping. Numeric soft clip={domain=a:b} and domain y use finite axis/survey bounds. Direct rectangles, path= and saved rectangle names can clip the two boundaries independently. The finished area is drawn on the pre-main layer. X-monotone split regions support numbered/odd/even/last styles. Arbitrary clip contours, general multivalued or coincident intersections and intersection-segment sequences remain partial. Local sources and browser/native evidence: docs/qa/2026-11-26-fill-between-rectangles.md."
};
