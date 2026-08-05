export const texPackage = {
  name: "helvet",
  status: "partial",
  implementedBy: [
    "src/frontend/latex-shell.js:applyDocumentFontPackageAliases",
    "src/tex/fontSpec.js:parseTikzFontPatch",
    "src/renderers/svg/textEngine.js:textEngineRenderFontFamily"
  ].join(", "),
  features: [
    "helvet's \\sfdefault -> phv mapping for \\sffamily and \\sf",
    "Helvetica/Arial SVG font selection for text and sansmath roman glyphs"
  ],
  requires: [],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/latex/psnfss/helvet.sty",
  localDoc: null,
  localSourceReviewed: [
    "/usr/local/texlive/2025/texmf-dist/tex/latex/psnfss/helvet.sty (lines 24-52: scaled option and \\sfdefault=phv)"
  ],
  caseCount: 9,
  caseExamples: [
    "LaTeX-examples CSV 2D Gaussian Multivariate Distributions",
    "LaTeX-examples Bar Chart Military Budget",
    "LaTeX-examples Hyperbolic Triangle Interior Angles"
  ],
  observedOptions: ["scaled"],
  notes: "Implements the package's practical document-level effect only: explicit sans-family switches select the browser's Helvetica/Arial fallback. The optional scaled factor, exact TeX phv metrics, and arbitrary PSNFSS font series remain deferred."
};
