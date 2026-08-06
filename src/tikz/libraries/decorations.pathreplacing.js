export const tikzLibrary = {
  "name": "decorations.pathreplacing",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:applyBraceDecoration",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.pathreplacing.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "features": [
    "brace path replacement",
    "mirror",
    "raise",
    "amplitude",
    "aspect",
    "whole remaining subpath length in the initial tangent direction"
  ],
  "implements": [
    "brace path replacement",
    "mirror",
    "raise",
    "amplitude",
    "aspect",
    "whole remaining subpath length in the initial tangent direction"
  ],
  "notes": "Brace replacement mirrors PGF's remaining-distance state: it measures the complete decorated subpath, then draws the replacement in the initial tangent frame. mirror, raise, amplitude, and aspect are supported. Exact behavior for arbitrary non-linear input paths and the other path-replacing decoration families remains partial."
};
