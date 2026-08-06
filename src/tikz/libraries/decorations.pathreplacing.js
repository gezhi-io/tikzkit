export const tikzLibrary = {
  "name": "decorations.pathreplacing",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:applyBraceDecoration + applyTicksDecoration",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.pathreplacing.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "features": [
    "brace path replacement",
    "mirror",
    "raise",
    "amplitude",
    "aspect",
    "whole remaining subpath length in the initial tangent direction",
    "ticks path replacement",
    "ticks segment length",
    "ticks amplitude",
    "ticks local line and curve tangents",
    "ticks final complete state origin"
  ],
  "implements": [
    "brace path replacement",
    "mirror",
    "raise",
    "amplitude",
    "aspect",
    "whole remaining subpath length in the initial tangent direction",
    "ticks path replacement",
    "ticks segment length",
    "ticks amplitude",
    "ticks local line and curve tangents",
    "ticks final complete state origin"
  ],
  "notes": "Brace replacement mirrors PGF's remaining-distance state: it measures the complete decorated subpath, then draws the replacement in the initial tangent frame. mirror, raise, amplitude, and aspect are supported. `ticks` replaces a complete decorated line/curve subpath with independent normal strokes at each full segment-length state origin; amplitude is the half-length and the final partial path remainder does not receive an endpoint tick. Exact behavior for arbitrary non-linear brace input and the other path-replacing decoration families (border, waves, expanding waves, show path construction) remains partial."
};
