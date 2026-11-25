export const tikzLibrary = {
  "name": "angles",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:createAnglePic + buildAnglePic",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryangles.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-angles.tex",
  "localSourceReviewed": "yes",
  "features": [
    "angle pic",
    "right angle pic",
    "counterclockwise reflex-angle sweep",
    "angle radius",
    "angle eccentricity",
    "quote labels",
    "independent background fill and foreground draw actions",
    "native 0.6 label eccentricity including zero and negative overrides",
    "12pt nonpositive radius fallback"
  ],
  "implements": [
    "angle pic",
    "right angle pic",
    "counterclockwise reflex-angle sweep",
    "angle radius",
    "angle eccentricity",
    "quote labels",
    "independent background fill and foreground draw actions",
    "native 0.6 label eccentricity including zero and negative overrides",
    "12pt nonpositive radius fallback"
  ],
  "notes": "Reviewed tikzlibraryangles.code.tex, tikz.code.tex pic layer boxes and the local angles manual on 2026-10-28. Standalone and inline angle/right-angle pics share normalized radius, quote labels and native eccentricity. Closed fills paint behind parent paths and edges; only the arc or outer square sides are stroked in the foreground. Fill-only and draw=none do not invent outlines. Four browser glyph origins and seven real-diagram strokes pass unchanged geometry gates. Native PDF raster acceptance remains open. Named pic definitions, bare default angle bodies, shade-only actions, arbitrary pic text options and general pic transforms remain partial. Evidence: docs/qa/2026-10-28-native-math-angles.md."
};
