export const tikzLibrary = {
  "name": "patterns",
  "status": "partial",
  "implementedBy": [
    "src/engine/options.js:normalizeOptions",
    "src/frontend/parser.js:collectTikzsetStoredVariables + collectPgfFormOnlyPatternDeclarations",
    "src/engine/evaluate.js:pgfFormOnlyPatternDefinition",
    "src/renderers/svg/defs.js:collectFormOnlyPatternClipDefs",
    "src/renderers/svg/renderSvg.js:renderSvg",
    "src/renderers/svg/formOnlyPatterns.js:renderFormOnlyPatternFill"
  ],
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepatterns.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibrarypatterns.code.tex",
  "features": [
    "tile enumeration inverse-translates the cropped page origin before intersecting shape bounds",
    "pattern fill metadata for supported renderers",
    "form-only pattern declarations with line, circle, rectangle, close, fill, and stroke primitives",
    "preamble tikz /.store in values for parameterized form-only pattern geometry"
  ],
  "implements": [
    "pattern fill metadata for supported renderers",
    "pgfdeclarepatternformonly basic drawing primitives",
    "preamble parameterized form-only pattern declarations using tikz /.store in"
  ],
  "notes": "Form-only patterns keep PGF's paint bounds separate from tile steps. SVG path fills use clipped, explicit tile expansion whose page-relative left/bottom origin follows the cropped SVG view, matching PGF/tikztosvg phase when standalone borders, labels, or crop bounds shift the page. Preamble declarations retain simple TikZ `/.store in` values when their macro names drive tile bounds, repeat steps, path coordinates, or `\\pgfsetlinewidth`; the verified flexible-hatch case matches a 9pt step and 2pt line width. Supported primitives cover line, dots, grid, checkerboard, and bricks families; pattern transforms, mutable/inherently-colored declarations, dynamic changes to declared pattern arguments after declaration, polar paths, and in-pattern color changes remain unsupported."
};

tikzLibrary.localSourceReviewed += "; pgfcorepatterns.code.tex:130-182 resets the CTM and retains separate paint bounds and repeat steps; pgfsys-pdftex.def:186-218 emits PDF BBox, XStep/YStep and Matrix";
tikzLibrary.notes += " Reviewed 2026-10-23: form-only tile enumeration now subtracts the page-relative phase before computing visible tile indices. This restores missing top rows of dots after cropped-page origin shifts. Regression checks cover positive and negative origins and every visible lattice point. Both browser and PNG comparisons show the recovered rows; label font/baseline and raster differences remain, so the complete control figure is not certified. Evidence: docs/qa/2026-10-23-compact-math-anchors.md.";
