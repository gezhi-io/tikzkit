export const texPackage = {
  "name": "tkz-fct",
  "status": "partial",
  "implementedBy": "src/extensions/tkz-fct.js",
  "features": ["tkzInit Cartesian bounds", "tkzGrid major grid", "tkzAxeXY axes, ticks, and labels"],
  "requires": ["tikz"],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty",
  "localDoc": null,
  "caseCount": 1,
  "caseExamples": [
    "plot shading regions geometry pgf command def"
  ],
  "observedOptions": [],
  "notes": "The function plotting commands remain deferred; the shared tkz-base Cartesian frame used by imported examples is implemented."
};
