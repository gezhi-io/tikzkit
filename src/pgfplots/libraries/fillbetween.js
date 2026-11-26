export const pgfplotsLibrary = {
  name: "fillbetween",
  status: "partial",
  implementationStatus: "partial",
  implementedBy: [
    "src/pgfplots/fillBetween.js", "src/pgfplots/fillBetweenBoundaries.js",
    "src/pgfplots/fillBetweenAssembly.js", "src/pgfplots/fillBetweenSoftClip.js",
    "src/pgfplots/fillBetweenSplit.js"
  ].join("; "),
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.fillbetween.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf",
  localSourceReviewed: [
    "pgfcontrib/pgflibraryfillbetween.code.tex", "pgfcontrib/tikzlibraryfillbetween.code.tex",
    "pgfcontrib/tikzlibrarydecorations.softclip.code.tex", "libs/tikzlibrarypgfplots.fillbetween.code.tex"
  ].map(file => "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/" + file).join("; "),
  features: [
    "named sharp, smooth, and stepped plot boundaries",
    "open named path and draw boundaries with straight and explicit cubic segments",
    "reverse=auto/true/false and inner moveto=connect/keep before clipping",
    "independent numeric x/y soft clips before splitting",
    "split=true for x-monotone 2D paths",
    "ordered polyline intersection regions",
    "automatic opposite-traversal normalization",
    "per-segment numbered/odd/even/last style cascade",
    "pre-main area layering"
  ],
  notes: "Two open named 2D boundaries retain straight segments, step corners and cubic controls. Direction is taken from the first segment before clipping; reverse and inner moveto follow the PGF soft-path rules. Numeric soft clip={domain=a:b}, domain y and per-boundary soft clip first/second cut the actual curves. The finished area is clipped on the pre-main layer. X-monotone split regions support numbered/odd/even/last segment styles. Arbitrary closed TikZ paths, general multivalued or coincident intersections, arbitrary soft-clip shapes and intersection-segment sequences remain partial. Local sources and browser/native evidence: docs/qa/2026-11-26-fill-between-boundaries.md."
};
