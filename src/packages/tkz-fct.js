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
    "tkzFct finite-sample pole branch splitting",
    "tkzFctPar sampled parametric functions",
    "tkzFctPolar sampled polar functions"
  ],
  "requires": ["tikz"],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-fct/TKZdoc-fct-polar.tex",
  "caseCount": 17,
  "caseExamples": [
    "manual linear scalar function plots",
    "sampled tangent branches across poles",
    "manual parametric cycloid",
    "manual polar four-petal rose"
  ],
  "observedOptions": ["domain", "samples", "id", "fp", "color", "line width", "style", "xstep", "ystep", "sub", "subxstep", "subystep", "ratio"],
  "localSourceReviewed": true,
  "notes": "tkzInit follows tkz-base's same-sign-range local-origin rule; tkzGrid maps explicit source-coordinate ranges plus major/subgrid x/y steps into the local Cartesian frame; tkzFct samples scalar function expressions in source units, clips each segment to the initialized frame, and breaks a sampled branch that crosses opposite frame bounds across a pole. tkzFctPar evaluates documented x(t)/y(t) expressions in source units with t, uses the native domain=-5:5 and samples=200 defaults, scales x/y independently, clips to tkzInit, and passes ordinary draw style keys through. tkzFctPolar now mirrors its separate native set polar path: domain=0:2*pi, samples=200, radius divided by xstep only, same-sign local-origin shifts, and no implicit clip. Gnuplot file/cache ids, tangents, areas, asymptotes, adaptive sampling, advanced paint keys, and general parametric discontinuity analysis remain deferred."
};
