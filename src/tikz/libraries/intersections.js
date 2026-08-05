export const tikzLibrary = {
  "name": "intersections",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:materializeIntersections; src/engine/geometry.js:pathIntersectionDetails",
  "features": [
    "name path",
    "name intersections",
    "by aliases (including optional coordinate options)",
    "total",
    "sort by named path",
    "line/flattened curve intersections"
  ],
  "implements": [
    "name path",
    "name intersections",
    "by aliases (including optional coordinate options)",
    "total",
    "sort by named path",
    "line/flattened curve intersections"
  ],
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryintersections.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryintersections.code.tex",
  "notes": "Named paths, curve/line intersections, generic coordinates, aliases, totals, and sort-by-first/second-path are implemented. Alias coordinate labels and box-like styles such as by={[intersection mark]C} (with a TikZ style) reuse the shared coordinate/node paths. Arbitrary non-node alias coordinate option handlers remain partial."
};
