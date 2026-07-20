export const texPackage = {
  name: "bchart",
  status: "extension",
  implementedBy: "src/extensions/bchart.js",
  features: [
    "bchart environment with unit, width, range, scale, steps, and plain options",
    "bcbar color, text, label, value, and plain options",
    "bclabel, bcskip, standard skips, and bcxlabel"
  ],
  requires: ["ifthen", "tikz"],
  tikzLibraries: ["calc"],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/latex/bchart/bchart.sty",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/latex/bchart/bchart.pdf",
  caseCount: 1,
  caseExamples: ["bchart-simple"],
  observedOptions: [],
  notes: "Reviewed against TeX Live 2025 bchart.sty; charts are lowered to ordinary TikZ during preprocessing."
};
