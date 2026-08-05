export const texPackage = {
  name: "chemfig",
  status: "partial",
  implementedBy: "src/extensions/chemfig.js:expandChemfigSchemes",
  features: [
    "scheme environments with horizontal reaction arrows",
    "six-member aromatic rings with alternating double bonds",
    "single and double carbonyl bonds",
    "legacy setatomsep and lewis notation used by the corpus chemistry example"
  ],
  requires: ["tikz"],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/chemfig/chemfig.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/generic/chemfig/chemfig-en.pdf",
  localSourceReviewed: [
    "/usr/local/texlive/2025/texmf-dist/tex/generic/chemfig/chemfig.tex (schemestart setup, lines 2818-2904)",
    "/usr/local/texlive/2025/texmf-dist/doc/generic/chemfig/chemfig-en.tex (bond types, atom sep, branches, rings)"
  ],
  caseCount: 1,
  caseExamples: ["latex-examples-chemistry-example"],
  observedOptions: [],
  notes: "This is a deliberately bounded pure-JS compatibility slice. General chemfig atom grammars, Cram bonds, distant hooks, chemmove, and arbitrary scheme layouts remain unsupported. The captured example uses deprecated setatomsep and lewis commands that need a compatibility shim in current TeX Live."
};
