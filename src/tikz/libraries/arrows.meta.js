export const tikzLibrary = {
  "name": "arrows.meta",
  "status": "builtin",
  "implementedBy": "src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/latexArrowGeometryFromLineWidth + src/renderers/svg/paths.js:renderArrowedPath/inlineArrowGeometry",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex",
  "localSourceReviewed": true,
  "features": [
    "Stealth",
    "Latex",
    "Triangle",
    "arrow tip dimensions",
    "scale",
    "scale length",
    "scale width"
  ],
  "implements": [
    "Stealth",
    "Latex",
    "Triangle",
    "arrow tip dimensions",
    "scale",
    "scale length",
    "scale width"
  ],
  "notes": "Reviewed locally on 2026-08-06 and 2026-08-07: PGF declares capitalized Latex with line-width-dependent length=+3pt 4.5 .8, width'=+0pt .75, and an outline width capped at one fifth of the calculated arrow length. TikZKit applies scale, scale length, and scale width separately to capitalized Latex and Stealth, while keeping lower-case core latex separate. Latex now retains PGF's distinct arrow assembly base, covered line end, and visible point rather than treating either terminal as a generic SVG marker; the real feed-forward-perceptron case confirms `Latex[scale=0.5]-` at circular nodes. Stroked circular and elliptical nodes retain their outer half-stroke in Scene Graph bounds, so these edge diagrams keep the native physical canvas instead of shrinking during SVG rasterization. Composite tips, arbitrary setup-code keys, padding/separation, bend, and declaration-time TeX arithmetic remain partial."
};
