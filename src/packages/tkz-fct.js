export const texPackage = {
  "name": "tkz-fct",
  "status": "partial",
  "implementedBy": "src/extensions/tkz-fct.js",
  "features": [
    "tkzInit Cartesian bounds",
    "tkzGrid major grid",
    "tkzGrid subgrid, explicit range, and independent x/y steps",
    "tkzAxeXY axes, ticks, and labels",
    "tkzFct sampled scalar functions",
    "tkzFct finite-sample pole branch splitting"
  ],
  "requires": ["tikz"],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-fct/TKZdoc-fct-fonctions.tex",
  "caseCount": 17,
  "caseExamples": [
    "manual linear scalar function plots",
    "sampled tangent branches across poles"
  ],
  "observedOptions": ["domain", "samples", "color", "line width", "style", "xstep", "ystep", "sub", "subxstep", "subystep", "ratio"],
  "localSourceReviewed": true,
  "notes": "tkzInit follows tkz-base's same-sign-range local-origin rule; tkzGrid maps explicit source-coordinate ranges plus major/subgrid x/y steps into the local Cartesian frame; tkzFct samples scalar function expressions in source units, clips each segment to the initialized frame, and breaks a sampled branch that crosses opposite frame bounds across a pole. tkzFctPar, tkzFctPolar, gnuplot file/cache ids, tangents, areas, asymptotes, adaptive sampling, and general discontinuity analysis remain deferred."
};
