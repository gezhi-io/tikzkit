export const tikzLibrary = {
  "name": "quotes",
  "status": "builtin",
  "implementedBy": "src/frontend/parser.js:parsePathCommand",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryquotes.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex",
  "localSourceReviewed": "yes",
  "features": [
    "edge labels in supported path syntax",
    "graphs quoted edge labels with basic auto and swap placement"
  ],
  "implements": [
    "edge labels in supported path syntax",
    "graphs quoted edge labels with basic auto and swap placement"
  ],
  "notes": "Reviewed locally on 2026-08-07: the quotes library maps quoted edge text to edge node={node [every edge quotes,...]{text}} and initializes every edge quotes=auto; the apostrophe form adds swap. TikZKit's ordinary edge parser already owns labels in supported paths, and the focused graphs lowering translates common quoted labels to those shared edge nodes. Arbitrary quote styles, direction shorthands, pin/label quote modes, and TeX key callbacks remain partial."
};
