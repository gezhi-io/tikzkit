export const texPackage = {
  "name": "array",
  "status": "partial",
  "implementedBy": "src/frontend/parser.js:extractTabularPictureLayouts, src/engine/evaluate.js:appendTabularPictureLayouts, src/tikz/libraries/tikzmark.js:lowerInlineTabularTikzmarks",
  "localSourceReviewed": true,
  "features": [
    "marked top-level tabular lowered to a TikZ matrix",
    "vertical rules and single/double hline rules",
    "tikzmark anchors for a same-picture overlay",
    "document tabular layout for nested tikzpictures with l/c/r columns",
    "explicit blank rows, hline rules, and inter-picture cell text"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/tools/array.sty",
  "localDoc": null,
  "caseCount": 3,
  "caseExamples": [
    "flow direction of arrival diagram matrrix table",
    "table color",
    "LaTeX-examples B-tree 3 evolution"
  ],
  "observedOptions": [],
  "notes": "Supports focused document tabular layouts containing nested TikZ pictures: l/c/r columns, internal vertical rules, hline rules, explicit blank strut rows, and ordinary cell text are measured before SVG placement. General array column preambles, p/m/b columns, multicolumn, multirow, arbitrary rich table content, row-height arguments, tabular*, and native cross-picture remember-picture crop semantics remain unsupported."
};
