export const texPackage = {
  name: "chemmacros",
  status: "partial",
  implementedBy: "src/extensions/chemfig.js:expandChemfigSchemes",
  features: ["chemistry-example reaction-formula fallback used alongside chemfig"],
  requires: ["chemfig"],
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/latex/chemmacros/chemmacros.sty",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/latex/chemmacros/chemmacros-manual.pdf",
  localSourceReviewed: [
    "/usr/local/texlive/2025/texmf-dist/tex/latex/chemmacros/chemmacros.sty (scheme module and current chlewis integration)"
  ],
  caseCount: 1,
  caseExamples: ["latex-examples-chemistry-example"],
  observedOptions: [],
  notes: "Only the inline formula needed by the chemfig scheme slice is lowered. chemmacros environments and reaction modules remain unsupported."
};
