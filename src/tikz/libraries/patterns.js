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
