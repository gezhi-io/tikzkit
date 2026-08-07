export const tikzLibrary = {
  "name": "shapes.arrows",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:arrowNodeShapeLayout/arrowNodeShapeGeometry/arrowNodeLocalPoints + src/renderers/svg/nodeShapes.js:arrowNodePoints",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.arrows.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "features": [
    "single arrow",
    "double arrow",
    "minimum width and minimum height",
    "tip angle",
    "head extend",
    "head indent",
    "single/double-arrow named anchors"
  ],
  "implements": [
    "single arrow",
    "double arrow"
  ],
  "notes": "Reviewed locally on 2026-08-07 against pgflibraryshapes.arrows.code.tex and the PGF shapes manual. `single arrow` and `double arrow` share one source-derived geometry record between SVG polygon rendering, border clipping, and named anchors. The implemented keys include physical `minimum height`/transverse `minimum width`, `tip angle`, `head extend`, and `head indent`; `before tip`, `before head`, tips, tails, and the ordinary cardinal anchors resolve from the same vertices. The permanent three-way driver is shapes/arrows-single-double.tex, with evidence in docs/qa/2026-08-07-shapes-arrows-single-double.md. Arrow box, all radial border-anchor variants, text-metric parity, outer-separation parity, and every rotation/shape option remain partial."
};
