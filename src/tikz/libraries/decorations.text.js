const CONTROL_SPACE_MARKER = "\uE10A";

export function normalizeDecorationTextKeyValue(value = "") {
  return String(value ?? "")
    .replace(/\\ /g, CONTROL_SPACE_MARKER)
    .trim()
    .replaceAll(CONTROL_SPACE_MARKER, "\\ ");
}

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
  "implementedBy": "src/tikz/libraries/decorations.text.js:normalizeDecorationTextKeyValue/parseDefaultDecorationTextFormatRuns; src/engine/evaluate.js:addDecorationTextItems/textAlongPathDecorationsFromOptions/decorationTextPayload/resolvedDecorationTextFormatRuns/decorationTextEffects/decorationTextCounterVariable/decorationTextStyleFollowsPath/decorationTextRepeatCount/decorationTextCharacterReplacements/computerModernOpticalTextFamily; src/renderers/svg/decorationText.js:renderDecorationTextPath/formattedDecorationGlyphs/groupDecorationTextGlyphs/sizeDecorationTextReplacements/scaleDecorationTextCharacters/padDecorationTextNodeBoxes/ordinaryDecorationTextBaselineOffset/renderRepeatedDecorationText/decorationTextEffectsScale/decorationTextEffectsFitShift",
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
    "text effects repeat text with finite or path-filling cycles, pgfkeys boundary-space trimming, explicit control spaces, character counters, and per-character scale expressions",
    "decoration text current-color inheritance independent of draw/fill paint",
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
    "text effects repeat text with finite or path-filling cycles, pgfkeys boundary-space trimming, explicit control spaces, character counters, and per-character scale expressions",
    "decoration text current-color inheritance independent of draw/fill paint",
    "braced inline math groups as single positioned TeX boxes"
  ],
  "notes": "Text is sampled on a flattened path. Multiple `postaction` values retain their source order and each reuses the original path, matching the local TikZ action loop; a bare `postaction={decorate}` inherits the enclosing path's `decoration=...` keys. Individual text decorations retain their `text color` and reverse their sampling direction only for `reverse path`, independently of `reverse text`. Default serif decoration text now resolves to the same Computer Modern optical design face as ordinary TikZ nodes, keeping CMR path advances and painted grouped-word glyphs in one metric system. The default `|...|` format delimiters now follow PGF's state machine: a plain format replaces the current character-box format, a leading `+` appends to it, and `||` resets it. Font size, family, weight, style, and `\\color` are attached to each affected glyph run rather than painted as literal control text; explicit `text color` still supplies the decoration-wide fallback. The text-effects variant retains source-order `reverse text` and `group letters` transforms: simple plain-text runs become whole-word node boxes, `group letters into words` is an alias, and `word separator` accepts the documented space/default or a single separator character. Reviewed on 2026-09-06 against the local decorations.text, pgfkeys, and PGF decoration-state sources: text-effects characters are ordinary centered TikZ nodes with the default `.3333em` horizontal padding. `characters={text along path}`, its append/every-character forms, and `text effects={text along path}` switch to zero horizontal padding, a base anchor, and tangent rotation. Grouping happens before node-box measurement, so grouped words inherit one pair of node paddings. Replacement TikZ code is measured as its own PGF picture: the supported circle replacement advances by its diameter and bypasses ordinary character-node padding. `fit text to path` keeps the first and last half glyph boxes fixed and proportionally changes only the internal centers; `scale text to path` uses the local path/text-width factor for both advances and glyph font scale. `repeat text` follows the local PGF pre/token/post state sequence: a bare or negative value restarts the character count until the next prewidth no longer fits, while a positive integer adds that many source-text copies. pgfkeys trims soft outer value spaces, whereas an explicit `\\ ` remains one padded control-space token. `character count` and `character total` variables are rebound for every source copy and can drive the documented per-character `scale` expression. `draw=<color>` and `fill=<color>` no longer leak into decoration text; only current-color options, `text=<color>`, `text color`, or inline format colors change it. Repeated replace-character mappings preserve the native per-character registration for documented fill/draw/path circle payloads, including radius and paint options. Explicit brace groups containing inline math are measured, rotated, and positioned as one PGF-style text box with simple super/subscripts. Custom `text format delimiters`, arbitrary replacement TikZ code, arbitrary character-specific styles, word grouping across rich/math/replacement boxes, nested/general TeX grouping, asymmetric native node pre/post widths, exact decoration-text painted bounding boxes, exact bold/italic TeX advance metrics, and native-undefined repeat plus scaling/fitting combinations remain partial. Evidence is in docs/qa/2026-09-06-decorations-text-character-node-styles.md, docs/qa/2026-09-06-decorations-text-replacement-spacing.md, and docs/qa/2026-09-06-decorations-text-repeat-state-machine.md."
};
