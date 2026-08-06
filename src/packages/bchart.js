export const texPackage = {
  name: "bchart",
  status: "extension",
  implementedBy: "src/extensions/bchart.js",
  features: [
    "bchart environment with unit, width, range, scale, steps, and plain options",
    "bcbar color, text, label, value, and plain options",
    "the documented \\bcfontstyle hook, including bold or document-default text",
    "bclabel, bcskip, standard skips, and bcxlabel"
  ],
  requires: ["ifthen", "tikz"],
  tikzLibraries: ["calc"],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/latex/bchart/bchart.sty",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/latex/bchart/bchart.pdf",
  caseCount: 2,
  caseExamples: ["bchart-simple", "bchart-font-style"],
  observedOptions: [],
  notes: "Reviewed against TeX Live 2025 bchart.sty/bchart.tex; charts are lowered to ordinary TikZ during preprocessing. bchart scale changes geometry only; the current zero-argument bcfontstyle definition is applied to each chart."
};
