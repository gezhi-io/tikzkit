export const tikzLibrary = {
  "name": "mindmap",
  "status": "partial",
  "implementedBy": "src/frontend/parser.js:parsePathCommand + src/engine/evaluate.js:applyConceptNodeOptions/createNodeTreeChildren/addTreeEdge + src/tikz/textMetrics.js + src/renderers/svg/{defs,style,plainTextNode,textEngine}.js",
  "features": [
    "concept/root/level styles",
    "documented path-node-child mindmap syntax",
    "concept color inheritance",
    "parent-to-child gradient connection bars",
    "concept text width paragraph wrapping",
    "grow cyclic",
    "clockwise/counterclockwise from",
    "sibling angle"
  ],
  "implements": [
    "concept/root/level styles",
    "documented path-node-child mindmap syntax",
    "concept color inheritance",
    "parent-to-child gradient connection bars",
    "concept text width paragraph wrapping",
    "grow cyclic",
    "clockwise/counterclockwise from",
    "sibling angle"
  ],
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarymindmap.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-mindmaps.tex",
  "localSourceReviewed": "yes",
  "notes": "The documented path-node-child syntax, root/level circle sizing, concept-color inheritance, nested clockwise placement, TeX text-width wrapping, and filled parent-to-child gradient bars are covered. The bar's Bezier control points are an approximation of PGF's circle connection bar switch color; annotations, extra concepts, and arbitrary custom connection paths remain partial."
};
