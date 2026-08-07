export const tikzLibrary = {
  "name": "shadows.blur",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:parseBlurShadow + src/renderers/svg/{paths,nodeOverlays}.js + src/renderers/svg/defs.js:blurShadowStdDeviation + src/renderers/svg/bounds.js:blurShadowBoundsPadding",
  "localSource": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgf-blur/tikzlibraryshadows.blur.code.tex",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/latex/pgf-blur/tikzlibraryshadows.blur.code.tex",
  "features": [
    "blur shadow",
    "shadow blur radius",
    "shadow blur steps metadata",
    "SVG blur filter for node and path shadows",
    "PGF 2r blur canvas extent",
    "continuous SVG blur-radius calibration",
    "every shadow option ordering"
  ],
  "implements": [
    "blur shadow",
    "shadow blur radius",
    "shadow blur steps metadata",
    "SVG blur filter for node and path shadows",
    "PGF 2r blur canvas extent",
    "continuous SVG blur-radius calibration",
    "every shadow option ordering"
  ],
  "notes": "The local pgf-blur library paints a multi-stroke/fading preaction and expands its internal blur canvas by exactly 2r for blur radius r. TikZKit preserves its scale, .5ex/-.5ex offsets, shadow opacity, blur-radius options, and `every shadow` then caller ordering. Its node/path SVG filter now uses sigma=2r/3 so the continuous Gaussian is practically contained by the same 2r margin. `shadow blur steps` is parsed and retained as metadata, but SVG filtering remains continuous rather than the exact TeX stepped stroke/fading ramp. Invert fading, extra path rounding, exact TeX multi-stroke profiles, marker tips, and form-only patterns remain partial."
};
