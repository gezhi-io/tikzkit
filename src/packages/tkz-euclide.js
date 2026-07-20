export const texPackage = {
  name: "tkz-euclide",
  status: "extension",
  implementedBy: "src/extensions/tkz-euclide.js",
  features: [
    "selected point, line, segment, intersection, label, and polygon macros",
    "parallel and perpendicular lines through named TikZ coordinates",
    "explicit-radius angle arcs via tkzDrawArc[R]"
  ],
  requires: ["tikz"],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-euclide.sty",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-euclide/tkz-euclide.pdf",
  caseCount: 8,
  caseExamples: [
    "LaTeX-examples Geometry 3",
    "LaTeX-examples Geometry 4",
    "LaTeX-examples Geometry 5",
    "LaTeX-examples Geometry 6",
    "LaTeX-examples Geometry 7",
    "LaTeX-examples Geometry 8",
    "LaTeX-examples Geometry 9",
    "LaTeX-examples Hyperbolische Geometrie Axiom 1 2"
  ],
  observedOptions: [],
  notes: "Reviewed tkz-obj-eu-lines.tex and tkz-draw-eu-arcs.tex from TeX Live 2025. Angles and segment marks remain deferred."
};
