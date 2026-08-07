export const tikzLibrary = {
  "name": "shapes.misc",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:estimateNodeSize/nodeBorderPoint/nodeOuterSep/scaleNodeOuterSep + src/renderers/svg/nodeOverlays.js:renderMiscOutNodeBox + src/renderers/svg/bounds.js",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex",
  "localSourceReviewed": true,
  "features": ["cross out", "strike out"],
  "implements": ["rectangle-compatible anchors and foreground paths for cross out and strike out"],
  "notes": "Reviewed locally on 2026-08-07 against pgflibraryshapes.misc.code.tex: the default rounded rectangle has convex 180-degree end caps. TikZKit sizes their content chord and clips straight/curved node edges, including terminal arrow padding, to the matching circular cap rather than the outer rectangular corner; latex-examples-class-tree is the visual driver. PGF inherits rectangle anchors for cross out/strike out; their foreground geometry and bounding-box contribution retain scaled outer separation. Empty cross-out/strike-out nodes now use their configured inner/minimum dimensions rather than a normal text line-height floor, matching the local 4pt inner box plus paint-width outer separation used by the path-replacing manual control-marker example. Concave/straight/custom arc modes, other shapes.misc shapes, and full native text-box metrics remain partial."
};
