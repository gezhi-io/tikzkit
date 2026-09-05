export const tikzLibrary = {
  "name": "spy",
  "status": "partial",
  "implementedBy": "src/frontend/parser.js:parseSpy + src/engine/evaluate.js:createSpy",
  "features": [
    "spy using outlines",
    "spy using overlays",
    "\\spy on ... in node ... at ...",
    "connect spies",
    "circle and rectangle lens shapes",
    "clipped magnified simple paths"
  ],
  "implements": [
    "spy using outlines",
    "spy using overlays",
    "\\spy on ... in node ... at ...",
    "connect spies",
    "circle and rectangle lens shapes",
    "clipped magnified simple paths"
  ],
  "localSourceReviewed": true,
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryspy.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-spy.tex",
  "notes": "Reviewed against the TeX Live 2025 spy library and manual. Scope and command options own the spy-on node shape; in-node options may independently override the spy-in shape. Circle and rectangle lenses honor size or independent width/height, scale the source window by inverse magnification, clip magnified stroked paths to the target boundary, and use the native outline or translucent overlay defaults. Arbitrary lens transforms, nested spy scopes, magnified text/nodes/fills, non-circle/non-rectangle clipping, custom connection code, and deferred references remain partial."
};
