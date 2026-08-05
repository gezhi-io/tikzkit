export const tikzLibrary = {
  "name": "decorations.text",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:addDecorationTextItems; src/renderers/svg/decorationText.js:renderDecorationTextPath",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "features": [
    "text along path",
    "text={|style|content}",
    "signed raise",
    "left/center/right alignment and indents",
    "fit to path and fit-to-path stretching spaces",
    "per-glyph tangent placement",
    "braced inline math groups as single positioned TeX boxes"
  ],
  "implements": [
    "text along path",
    "text={|style|content}",
    "signed raise",
    "left/center/right alignment and indents",
    "fit to path and fit-to-path stretching spaces",
    "per-glyph tangent placement",
    "braced inline math groups as single positioned TeX boxes"
  ],
  "notes": "Text is sampled per glyph on a flattened path. Explicit brace groups containing inline math are measured, rotated, and positioned as one PGF-style text box with simple super/subscripts. Formatting delimiters and basic font/color commands work; text effects, character-specific styles, replacement, repeat text, nested/general TeX grouping, and exact TeX box metrics remain partial."
};
