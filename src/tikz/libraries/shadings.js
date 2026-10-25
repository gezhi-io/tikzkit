export const tikzLibrary = {
  "name": "shadings",
  "status": "partial",
  "implementedBy": [
    "src/engine/options.js:normalizeOptions",
    "src/engine/evaluate.js:pathShadingStyle",
    "src/renderers/svg/defs.js:renderAxisGradientDef/renderBallGradientDef/withAxisShadingAspect",
    "src/engine/colors.js:normalizeShadingColor"
  ],
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoreshade.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshadings.code.tex",
  "features": [
    "axis shading with top/middle/bottom color stops",
    "left/right color shortcuts through 90 degree axis shading",
    "shading angle on paths and node fills",
    "ball and supported declared radial shadings"
  ],
  "implements": [
    "TikZ axis shading color keys",
    "SVG linear gradient projection for shading angle",
    "ball and declared radial shading approximations"
  ],
  "notes": "TikZ declares axis shading as bottom/bottom/middle/top/top at 0/25/50/75/100 percent; pgfshadepath maps the path onto its central interval. Reviewed 2026-10-25: oblique gradients use physical path bounds and PGF's angle-dependent scaling before conversion to SVG bounding-box coordinates; different aspect ratios retain separate definitions. Ball radii are 0/9/18/25/50bp, with the full final black stop, and xcolor CMYK names convert to ideal RGB for shading rather than solid DeviceCMYK display colors. Actual Chrome, MacTeX PNG and tikztosvg comparisons cover yellow/black spheres and a rotated nonsquare gradient. Bilinear, functional, and arbitrary declared axial shadings remain unsupported; declared radial shading parsing is intentionally limited. Evidence: docs/qa/2026-10-25-scoped-fonts-failures.md."
};
