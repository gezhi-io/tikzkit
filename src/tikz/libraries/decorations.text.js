export const tikzLibrary = {
  "name": "decorations.text",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:addDecorationTextItems/decorationTextRepeatCount/decorationTextCharacterReplacements; src/renderers/svg/decorationText.js:renderDecorationTextPath/renderRepeatedDecorationText",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "features": [
    "text along path",
    "text={|style|content}",
    "signed raise",
    "left/center/right alignment and indents",
    "fit to path and fit-to-path stretching spaces",
    "per-glyph tangent placement",
    "text effects along path with reverse text and circle character replacements",
    "text effects repeat text with finite or path-filling cycles",
    "braced inline math groups as single positioned TeX boxes"
  ],
  "implements": [
    "text along path",
    "text={|style|content}",
    "signed raise",
    "left/center/right alignment and indents",
    "fit to path and fit-to-path stretching spaces",
    "per-glyph tangent placement",
    "text effects along path with reverse text and circle character replacements",
    "text effects repeat text with finite or path-filling cycles",
    "braced inline math groups as single positioned TeX boxes"
  ],
  "notes": "Text is sampled per glyph on a flattened path. The text-effects variant honors reverse text before character placement. `repeat text` follows the local PGF counter state: a bare or negative value repeats until a complete next glyph box will not fit, while a positive integer adds that many full source-text copies. Explicit text braces preserve terminal spaces so repeat-cycle gaps remain real glyph boxes. Repeated replace characters mappings preserve the native per-character registration for documented fill/draw/path circle payloads, including radius and paint options. Explicit brace groups containing inline math are measured, rotated, and positioned as one PGF-style text box with simple super/subscripts. Formatting delimiters and basic font/color commands work; arbitrary replacement TikZ code, character-specific styles, grouping, scale/fit text effects, nested/general TeX grouping, and exact TeX box metrics remain partial."
};
