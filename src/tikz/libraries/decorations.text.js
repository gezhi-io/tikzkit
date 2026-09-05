export function parseDefaultDecorationTextFormatRuns(value = "") {
  const source = String(value ?? "");
  const runs = [];
  let format = "";
  let buffer = "";

  const push = () => {
    if (!buffer) return;
    const previous = runs.at(-1);
    if (previous?.format === format) previous.text += buffer;
    else runs.push({ text: buffer, format });
    buffer = "";
  };

  for (let index = 0; index < source.length;) {
    if (source[index] !== "|" || source[index - 1] === "\\") {
      buffer += source[index];
      index += 1;
      continue;
    }
    const end = source.indexOf("|", index + 1);
    if (end === -1) {
      buffer += source.slice(index);
      break;
    }
    push();
    const next = source.slice(index + 1, end).trim();
    if (next.startsWith("+")) format = `${format} ${next.slice(1).trim()}`.trim();
    else format = next;
    index = end + 1;
  }
  push();
  return runs;
}

export const tikzLibrary = {
  "name": "decorations.text",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/decorations.text.js:parseDefaultDecorationTextFormatRuns; src/engine/evaluate.js:addDecorationTextItems/textAlongPathDecorationsFromOptions/decorationTextPayload/resolvedDecorationTextFormatRuns/decorationTextEffects/decorationTextStyleFollowsPath/decorationTextRepeatCount/decorationTextCharacterReplacements/computerModernOpticalTextFamily; src/renderers/svg/decorationText.js:renderDecorationTextPath/formattedDecorationGlyphs/groupDecorationTextGlyphs/sizeDecorationTextReplacements/padDecorationTextNodeBoxes/ordinaryDecorationTextBaselineOffset/renderRepeatedDecorationText/decorationTextEffectsScale/decorationTextEffectsFitShift",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "features": [
    "text along path",
    "text={|style|content}",
    "default format delimiters with replace, append, and reset state",
    "per-run font size, weight, style, family, and color",
    "signed raise",
    "left/center/right alignment and indents",
    "fit to path and fit-to-path stretching spaces",
    "per-glyph tangent placement",
    "ordered postaction text decorations with per-decoration text color",
    "reverse path sampling independent of reverse text",
    "text effects along path with reverse text and circle character replacements using replacement bounds",
    "text effects fit text to path with fixed outer half-boxes",
    "text effects scale text to path",
    "outer decoration inherited by postaction={decorate}",
    "text effects group letters/group letters into words with word separator and source-order reverse/group transforms",
    "ordinary padded text-effects nodes and explicit text-along-path character styles",
    "text effects repeat text with finite or path-filling cycles",
    "braced inline math groups as single positioned TeX boxes"
  ],
  "implements": [
    "text along path",
    "text={|style|content}",
    "default format delimiters with replace, append, and reset state",
    "per-run font size, weight, style, family, and color",
    "signed raise",
    "left/center/right alignment and indents",
    "fit to path and fit-to-path stretching spaces",
    "per-glyph tangent placement",
    "ordered postaction text decorations with per-decoration text color",
    "reverse path sampling independent of reverse text",
    "text effects along path with reverse text and circle character replacements using replacement bounds",
    "text effects fit text to path with fixed outer half-boxes",
    "text effects scale text to path",
    "outer decoration inherited by postaction={decorate}",
    "text effects group letters/group letters into words with word separator and source-order reverse/group transforms",
    "ordinary padded text-effects nodes and explicit text-along-path character styles",
    "text effects repeat text with finite or path-filling cycles",
    "braced inline math groups as single positioned TeX boxes"
  ],
  "notes": "Text is sampled on a flattened path. Multiple `postaction` values retain their source order and each reuses the original path, matching the local TikZ action loop; a bare `postaction={decorate}` inherits the enclosing path's `decoration=...` keys. Individual text decorations retain their `text color` and reverse their sampling direction only for `reverse path`, independently of `reverse text`. Default serif decoration text now resolves to the same Computer Modern optical design face as ordinary TikZ nodes, keeping CMR path advances and painted grouped-word glyphs in one metric system. The default `|...|` format delimiters now follow PGF's state machine: a plain format replaces the current character-box format, a leading `+` appends to it, and `||` resets it. Font size, family, weight, style, and `\\color` are attached to each affected glyph run rather than painted as literal control text; explicit `text color` still supplies the decoration-wide fallback. The text-effects variant retains source-order `reverse text` and `group letters` transforms: simple plain-text runs become whole-word node boxes, `group letters into words` is an alias, and `word separator` accepts the documented space/default or a single separator character. Reviewed on 2026-09-06 against the local decorations.text and PGF node-shape sources: text-effects characters are ordinary centered TikZ nodes with the default `.3333em` horizontal padding. `characters={text along path}`, its append/every-character forms, and `text effects={text along path}` switch to zero horizontal padding, a base anchor, and tangent rotation. Grouping happens before node-box measurement, so grouped words inherit one pair of node paddings. Replacement TikZ code is measured as its own PGF picture: the supported circle replacement advances by its diameter and bypasses ordinary character-node padding, preventing centered replacement sequences from collapsing at path endpoints. `fit text to path` keeps the first and last half glyph boxes fixed and proportionally changes only the internal centers; `scale text to path` uses the local path/text-width factor for both advances and glyph font scale. `repeat text` follows the local PGF counter state: a bare or negative value repeats until a complete next glyph box will not fit, while a positive integer adds that many full source-text copies. Explicit text braces preserve terminal spaces so repeat-cycle gaps remain real glyph boxes. Repeated replace characters mappings preserve the native per-character registration for documented fill/draw/path circle payloads, including radius and paint options. Explicit brace groups containing inline math are measured, rotated, and positioned as one PGF-style text box with simple super/subscripts. Custom `text format delimiters`, arbitrary replacement TikZ code, character-specific styles, word grouping across rich/math/replacement boxes, nested/general TeX grouping, exact vertical metrics for arbitrary math/rich nodes, exact bold/italic TeX advance metrics, and native-undefined repeat plus scaling/fitting combinations remain partial. Evidence is in docs/qa/2026-09-06-decorations-text-character-node-styles.md and docs/qa/2026-09-06-decorations-text-replacement-spacing.md."
};
