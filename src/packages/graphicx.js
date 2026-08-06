export const texPackage = {
  "name": "graphicx",
  "status": "partial",
  "implementedBy": "src/tikz/text.js + src/frontend/parser.js + src/index.js + src/renderers/svg/renderSvg.js",
  "features": [
    "\\scalebox and text scaling subset",
    "Single-tikzpicture \\resizebox{<width>}{<height>}{...} with explicit physical dimensions"
  ],
  "requires": [],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/graphics/graphicx.sty",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/latex/graphics/graphics.sty",
  "localDoc": null,
  "caseCount": 5,
  "caseExamples": [
    "latex-examples-arc",
    "table comparison many",
    "table comparison med",
    "time angling text 1 timeline foreach learn",
    "time angling text 2 timeline foreach learn",
    "time two courses horizontal timeline foreach learn"
  ],
  "observedOptions": [],
  "notes": "The resizebox slice derives separate width/height scales from the interpreted picture bounds and renders the complete SVG scene in one group transform, so path geometry, text, line widths, and arrow tips scale together. Starred resizebox, ! aspect-ratio inference, multi-picture boxes, and general non-TikZ box content remain unsupported."
};
