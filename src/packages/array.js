export const texPackage = {
  "name": "array",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/tikzmark.js:lowerInlineTabularTikzmarks",
  "localSourceReviewed": true,
  "features": [
    "marked top-level tabular lowered to a TikZ matrix",
    "vertical rules and single/double hline rules",
    "tikzmark anchors for a same-picture overlay"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/tools/array.sty",
  "localDoc": null,
  "caseCount": 2,
  "caseExamples": [
    "flow direction of arrival diagram matrrix table",
    "table color"
  ],
  "observedOptions": [],
  "notes": "Only the focused top-level tabular plus tikzmark overlay slice is implemented. General array column preambles, p/m/b columns, multicolumn, multirow, arbitrary table content, and native cross-picture remember-picture crop semantics remain unsupported."
};
