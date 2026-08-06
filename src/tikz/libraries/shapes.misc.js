export const tikzLibrary = {
  "name": "shapes.misc",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:nodeOuterSep/scaleNodeOuterSep + src/renderers/svg/nodeOverlays.js:renderMiscOutNodeBox + src/renderers/svg/bounds.js",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "features": ["cross out", "strike out"],
  "implements": ["rectangle-compatible anchors and foreground paths for cross out and strike out"],
  "notes": "Reviewed locally on 2026-08-06: PGF inherits rectangle anchors, then draws cross out from southwest to northeast and northwest to southeast; strike out keeps only southwest to northeast. Those inherited anchor corners include explicit or automatic outer sep, so the SVG foreground geometry and its bounding-box contribution use the same scaled outer separation. Other shapes.misc shapes and full native text-box metrics remain partial."
};
