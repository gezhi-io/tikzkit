export const texPackage = {
  name: "sansmath",
  status: "partial",
  implementedBy: [
    "src/tex/fontSpec.js:parseTikzFontPatch",
    "src/pgfplots/fonts.js:pgfplotsRoleFontCommand",
    "src/renderers/svg/mathHtml.js:renderScopedMathHtml"
  ].join(", "),
  features: [
    "\\sansmath / \\unsansmath math-version selection",
    "PGFPlots axis font inheritance for ticks, labels, and legends",
    "KaTeX scoped sans operators, digits, \\mathrm, and \\mathbf"
  ],
  requires: [],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/latex/sansmath/sansmath.sty",
  localDoc: null,
  localSourceReviewed: [
    "/usr/local/texlive/2025/texmf-dist/tex/latex/sansmath/sansmath.sty (instructions and sans version, lines 22-55 and 97-205)"
  ],
  caseCount: 10,
  caseExamples: [
    "LaTeX-examples Countable Sets",
    "LaTeX-examples Bar Chart Military Budget",
    "LaTeX-examples CSV 2D Gaussian Multivariate Distributions"
  ],
  observedOptions: ["eulergreek"],
  notes: "The renderer mirrors sansmath's core hybrid model: math italic letters and symbols remain math fonts, while inherited axis text plus math digits/operators/\\mathrm use the sans family. The eulergreek option is accepted through normal TeX source handling, but exact Euler Greek outlines and every low-level font-encoding branch remain unsupported."
};
