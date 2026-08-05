export const pgfplotsLibrary = {
  name: "fillbetween",
  status: "partial",
  implementationStatus: "partial",
  implementedBy: "src/pgfplots/fillBetween.js",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.fillbetween.code.tex",
  localDoc: null,
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.fillbetween.code.tex",
  features: ["named function/coordinate paths", "soft clip domain", "pre-main area layering"],
  notes: "Named 2D function/coordinate paths, soft clip={domain=a:b}, and pre-main area layering are lowered to a closed SVG path. Segment splitting, intersections, and fill between/of arbitrary TikZ paths remain unsupported."
};
