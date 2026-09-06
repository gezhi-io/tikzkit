export const pgfplotsLibrary = {
  name: "patchplots",
  status: "partial",
  implementationStatus: "partial",
  implementedBy: "src/pgfplots/surface.js:renderAxisLinePatchCoordinatePlot/renderAxisTrianglePatchCoordinatePlot/renderAxisRectanglePatchCoordinatePlot; src/pgfplots/axis3d.js:axis3DAnnotationLayout/projectedOuterNormal; src/renderers/svg/mathGlyphFallback.js:Computer Modern x/y/z axis-label outlines",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.patchplots.code.tex",
  localDoc: "/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf",
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.patchplots.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsmeshplothandler.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex",
  features: [
    "patch type=line",
    "patch type=triangle",
    "patch type=rectangle",
    "two-coordinate open 3D patches",
    "three-coordinate planar 3D patches",
    "four-coordinate planar 3D patches",
    "projected fill, mesh outline, and open line patch",
    "z-buffer depth ordering"
  ],
  notes: "Reviewed locally through 2026-09-06: the base PGFPlots patch handler already supports linear line, triangle, and rectangle patches; this library adds higher-order patch classes. TikZKit implements focused line, triangle, and rectangle paths with consecutive ordered coordinate streams, 3D projection, explicit fill where applicable, native default-hot mapped colors, faceted mesh color, opacity, and painter ordering. Boxed 3D annotations use PGFPlots' normalized sum of the two fixed-axis outward projected vectors, so shared x/y corner tick labels remain distinct. Browser SVG output now paints the rotated z axis label with the same Computer Modern math-italic outline pipeline as x and y instead of a platform text glyph. Built-in hot stops retain PGF's explicit RGB channels instead of passing through document color conversion. Per-vertex interpolation, tables, point meta, shader=interp, quadratic/biquadratic/Coons patches, and PDF shading remain unsupported. Evidence: docs/qa/2026-08-06-pgfplots-patchplots-line.md, docs/qa/2026-09-06-pgfplots-patchplots-rectangle.md, outputs/qa/2026-09-06-pgfplots-patchplots-line-after/, and outputs/qa/2026-09-06-pgfplots-patchplots-rectangle-after/."
};
