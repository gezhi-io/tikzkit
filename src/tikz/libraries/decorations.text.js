export const tikzLibrary = {
  "name": "decorations.text",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:addDecorationTextItems/textAlongPathDecorationsFromOptions/resolvedPostactionOptionsList/decorationTextEffects/decorationTextRepeatCount/decorationTextCharacterReplacements; src/renderers/svg/decorationText.js:renderDecorationTextPath/groupDecorationTextGlyphs/renderRepeatedDecorationText",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "features": [
    "text along path",
    "text={|style|content}",
    "signed raise",
    "left/center/right alignment and indents",
    "fit to path and fit-to-path stretching spaces",
    "per-glyph tangent placement",
    "ordered postaction text decorations with per-decoration text color",
    "reverse path sampling independent of reverse text",
    "text effects along path with reverse text and circle character replacements",
    "text effects group letters/group letters into words with word separator and source-order reverse/group transforms",
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
    "ordered postaction text decorations with per-decoration text color",
    "reverse path sampling independent of reverse text",
    "text effects along path with reverse text and circle character replacements",
    "text effects group letters/group letters into words with word separator and source-order reverse/group transforms",
    "text effects repeat text with finite or path-filling cycles",
    "braced inline math groups as single positioned TeX boxes"
  ],
  "notes": "Text is sampled on a flattened path. Multiple `postaction` values retain their source order and each reuses the original path, matching the local TikZ action loop; individual text decorations retain their `text color` and reverse their sampling direction only for `reverse path`, independently of `reverse text`. The text-effects variant retains source-order `reverse text` and `group letters` transforms: simple plain-text runs become whole-word tangent-aligned boxes, `group letters into words` is an alias, and `word separator` accepts the documented space/default or a single separator character. `repeat text` follows the local PGF counter state: a bare or negative value repeats until a complete next glyph box will not fit, while a positive integer adds that many full source-text copies. Explicit text braces preserve terminal spaces so repeat-cycle gaps remain real glyph boxes. Repeated replace characters mappings preserve the native per-character registration for documented fill/draw/path circle payloads, including radius and paint options. Explicit brace groups containing inline math are measured, rotated, and positioned as one PGF-style text box with simple super/subscripts. Formatting delimiters and basic font/color commands work; arbitrary replacement TikZ code, character-specific styles, word grouping across rich/math/replacement boxes, scale/fit text effects, nested/general TeX grouping, and exact TeX box metrics remain partial."
};
