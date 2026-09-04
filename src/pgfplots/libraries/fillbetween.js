export const pgfplotsLibrary = {
  name: "fillbetween",
  status: "partial",
  implementationStatus: "partial",
  implementedBy: "src/pgfplots/fillBetween.js",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.fillbetween.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.fillbetween.code.tex",
  features: [
    "named function/coordinate paths",
    "soft clip domain before splitting",
    "split=true for x-monotone 2D paths",
    "ordered polyline intersection regions",
    "automatic opposite-traversal normalization",
    "per-segment numbered/odd/even/last style cascade",
    "pre-main area layering"
  ],
  notes: "Reviewed the PGFPlots wrapper plus tikzlibraryfillbetween.code.tex, pgflibraryfillbetween.code.tex, and the local manual on 2026-09-05. Named single-valued x-monotone 2D function/coordinate paths support soft clip={domain=a:b}, split=true intersection regions, native segment-style precedence, bare fill colors, and pre-main layering. Self-intersecting or multivalued paths, coincident/tangent overlap semantics, precise cubic subdivision, arbitrary closed TikZ paths, intersection segments sequences, and inner moveto remain unsupported."
};
