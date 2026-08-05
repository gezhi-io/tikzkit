export const pgfplotsLibrary = {
  name: "patchplots",
  status: "partial",
  implementationStatus: "partial",
  implementedBy: "src/pgfplots/surface.js:renderAxisLinePatchCoordinatePlot/renderAxisTrianglePatchCoordinatePlot/renderAxisRectanglePatchCoordinatePlot",
  localSource: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.patchplots.code.tex",
  localDoc: null,
  localSourceReviewed: "/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.patchplots.code.tex",
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
  notes: "Reviewed locally: the base PGFPlots patch handler already supports linear line, triangle, and rectangle patches; this library adds higher-order patch classes. TikZKit implements focused line, triangle, and rectangle paths with consecutive ordered coordinate streams, 3D projection, explicit fill where applicable, native default-hot mapped colors, faceted mesh color, opacity, and painter ordering. Per-vertex interpolation, tables, point meta, shader=interp, quadratic/biquadratic/Coons patches, and PDF shading remain unsupported."
};
