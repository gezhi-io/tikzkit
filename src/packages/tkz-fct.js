export const texPackage = {
  "name": "tkz-fct",
  "status": "partial",
  "implementedBy": "src/extensions/tkz-fct.js",
  "features": [
    "tkzInit Cartesian bounds",
    "tkzGrid major grid",
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
  "observedOptions": ["domain", "samples", "color", "line width", "style", "xstep", "ystep"],
  "notes": "tkzFct samples scalar function expressions in source units, maps them through tkzInit xstep/ystep, clips each segment to the initialized frame, and breaks a sampled branch that crosses opposite frame bounds across a pole. tkzFctPar, tkzFctPolar, gnuplot file/cache ids, tangents, areas, asymptotes, adaptive sampling, and general discontinuity analysis remain deferred."
};
