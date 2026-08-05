export const pgfplotsLibrary = {
  name: "patchplots",
  status: "partial",
  implementationStatus: "partial",
  implementedBy: "src/pgfplots/surface.js:renderAxisTrianglePatchCoordinatePlot/renderAxisRectanglePatchCoordinatePlot",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.patchplots.code.tex",
  localDoc: null,
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.patchplots.code.tex",
  features: [
    "patch type=triangle",
    "patch type=rectangle",
    "three-coordinate planar 3D patches",
    "four-coordinate planar 3D patches",
    "projected fill and faceted mesh outline",
    "z-buffer depth ordering"
  ],
  notes: "Reviewed locally: the base PGFPlots patch handler already supports linear line, triangle, and rectangle patches; this library adds higher-order patch classes. TikZKit implements focused triangle and rectangle paths with consecutive ordered coordinate streams, 3D projection, explicit fill, native-style faceted mesh color, opacity, and painter ordering. Line patches, per-vertex interpolation, tables, point meta, shader=interp, quadratic/biquadratic/Coons patches, and PDF shading remain unsupported."
};
