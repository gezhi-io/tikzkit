export const tikzLibrary = {
  "name": "arrows.meta",
  "status": "builtin",
  "implementedBy": "src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex",
  "localSourceReviewed": true,
  "features": [
    "Stealth",
    "Latex",
    "Triangle",
    "arrow tip dimensions"
  ],
  "implements": [
    "Stealth",
    "Latex",
    "Triangle",
    "arrow tip dimensions"
  ],
  "notes": "Reviewed locally: PGF declares Latex with line-width-dependent length=+3pt 4.5 .8, width'=+0pt .75, and an outline width capped at one fifth of the calculated arrow length. TikZKit uses that geometry for Latex[scale=...]; the broader arrows.meta key space remains partial."
};
