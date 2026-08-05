export const tikzLibrary = {
  "name": "patterns",
  "status": "partial",
  "implementedBy": [
    "src/engine/options.js:normalizeOptions",
    "src/engine/evaluate.js:pgfFormOnlyPatternDefinition",
    "src/renderers/svg/defs.js:collectFormOnlyPatternClipDefs",
    "src/renderers/svg/formOnlyPatterns.js:renderFormOnlyPatternFill"
  ],
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepatterns.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibrarypatterns.code.tex",
  "features": [
    "pattern fill metadata for supported renderers",
    "form-only pattern declarations with line, circle, rectangle, close, fill, and stroke primitives"
  ],
  "implements": [
    "pattern fill metadata for supported renderers",
    "pgfdeclarepatternformonly basic drawing primitives"
  ],
  "notes": "Form-only patterns keep PGF's paint bounds separate from tile steps. SVG path fills use clipped, explicit tile expansion so the y-axis direction and overhanging tile seams match PGF/tikztosvg. Supported primitives cover line, dots, grid, checkerboard, and bricks families; pattern transforms, polar paths, mutable/inherently-colored declarations, and in-pattern color changes remain unsupported."
};
