export const tikzLibrary = {
  "name": "arrows.meta",
  "status": "builtin",
  "implementedBy": "src/engine/options.js:parseArrowOption + src/tikz/metrics.js:createArrowTip/latexArrowGeometryFromLineWidth/stealthMetaArrowGeometryFromLineWidth + src/renderers/svg/paths.js:renderArrowedPath/inlineArrowGeometry",
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
    "scale width",
    "Stealth open",
    "Stealth harpoon",
    "Stealth swap",
    "Stealth reversed"
  ],
  "implements": [
    "Stealth",
    "Latex",
    "Triangle",
    "arrow tip dimensions",
    "scale",
    "scale length",
    "scale width",
    "Stealth open",
    "Stealth harpoon",
    "Stealth swap",
    "Stealth reversed"
  ],
  "notes": "Reviewed locally on 2026-08-06 through 2026-08-08 against TeX Live 2025. Capitalized Latex uses line-width-dependent length=+3pt 4.5 .8, width'=+0pt .75, and a capped miter outline. Capitalized Stealth now independently resolves length, width', and inset' before applying scale/scale length/scale width, then follows PGF's front/back/inset miter, tip-end, line-end, and qfillstroke construction. `Stealth[open]` changes that construction to qstroke; `harpoon` omits one outer corner and derives its tip-end/line-end from the harpoon miter; `swap` reflects it across the shaft; and `reversed` turns the mitered tip around while retaining its original attachment endpoint. Lower-case core latex and stealth remain distinct classic tips. Latex retains its distinct arrow assembly base, covered line end, and visible point; feed-forward-perceptron confirms `Latex[scale=0.5]-` at circular nodes. The 2026-08-08 `arrows-meta-tip-scaling` and `arrows-meta-stealth-variants` QA fixtures validate scaling, open, harpoon, swap, reversed, and native/tikztosvg artifacts. Composite tips, arbitrary setup-code keys, padding/separation, bend/flex, repeated `reversed` cancellation, double-line outer-factor arithmetic, and declaration-time TeX arithmetic remain partial."
};
