export const tikzLibrary = {
  "name": "shadows.blur",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:parseBlurShadow + src/renderers/svg/{paths,nodeOverlays,defs}.js",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgf-blur/tikzlibraryshadows.blur.code.tex",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgf-blur/tikzlibraryshadows.blur.code.tex",
  "features": [
    "blur shadow",
    "shadow blur radius",
    "shadow blur steps metadata",
    "SVG blur filter for node and path shadows",
    "every shadow option ordering"
  ],
  "implements": [
    "blur shadow",
    "shadow blur radius",
    "shadow blur steps metadata",
    "SVG blur filter for node and path shadows",
    "every shadow option ordering"
  ],
  "notes": "The local pgf-blur library paints a multi-stroke/fading preaction. TikZKit preserves its scale, .5ex/-.5ex offsets, shadow opacity, blur-radius options, and `every shadow` then caller ordering, then approximates the fading with an SVG feGaussianBlur for ordinary path and node shadows. shadow blur steps is retained as metadata but does not control SVG filter sampling. Invert fading, extra path rounding, exact TeX multi-stroke profiles, marker tips, and form-only patterns remain partial."
};
