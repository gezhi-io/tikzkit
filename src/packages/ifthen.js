export const texPackage = {
  "name": "ifthen",
  "status": "partial",
  "implementedBy": "src/frontend/parser.js:parseIfThenElse + src/engine/evaluate.js:evaluateIfThenElseCondition",
  "features": [
    "\\ifthenelse with numeric =, <, and > relations after macro expansion",
    "\\equal{...}{...} and \\lengthtest{...} conditions",
    "\\breakforeach within the innermost TikZ foreach loop"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/base/ifthen.sty",
  "localDoc": null,
  "caseCount": 5,
  "caseExamples": [
    "Graph triangles",
    "Graph v6 e8",
    "Hidden Markov model ABC",
    "Hidden Markov model ABC 2",
    "Hidden Markov model simple"
  ],
  "observedOptions": [],
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/latex/base/ifthen.sty",
  "notes": "Partial interpreter support for real foreach-driven numeric branches. Not yet a full ifthen package: \\newboolean, \\setboolean, \\isodd, \\and, \\or, \\not, \\isundefined, and \\whiledo remain unsupported."
};
