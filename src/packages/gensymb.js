export const texPackage = {
  name: "gensymb",
  status: "partial",
  implementedBy: "src/tikz/text.js:normalizeBrowserMathMacros",
  features: [
    "math-mode \\degree rendered as the native superscript circle"
  ],
  requires: [],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/latex/gensymb/gensymb.sty",
  localDoc: null,
  localSourceReviewed: [
    "/usr/local/texlive/2025/texmf-dist/tex/latex/gensymb/gensymb.sty (default degree fallback, lines 22-40)"
  ],
  caseCount: 22,
  caseExamples: [
    "LaTeX-examples Dot Product 4"
  ],
  observedOptions: [],
  notes: "The current corpus uses only math-mode \\degree. MacTeX gensymb defaults it to ^\\circ when textcomp is not loaded, which is normalized before KaTeX/SVG fallback. celsius, perthousand, ohm, micro, and gensymb option branches remain unsupported until a real case requires them."
};
