import { tikzBoolean } from "../../engine/options.js";

const CONTROL_SPACE_MARKER = "\uE10A";

export function isTextAlongPathDecoration(decoration = {}) {
  return tikzBoolean(decoration["text along path"]) || tikzBoolean(decoration["text effects along path"]);
}

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
    // Distinguish a final format scan from ordinary end-of-text without
    // adding a character to the text or its measured width.
    if (index === source.length && runs.length) runs.push({ text: "", format });
  }
  push();
  return runs;
}

export const tikzLibrary = {
  "name": "decorations.text",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/decorations.text.js:isTextAlongPathDecoration/normalizeDecorationTextKeyValue/parseDefaultDecorationTextFormatRuns; src/engine/evaluate.js:addDecorationTextItems/textAlongPathDecorationsFromOptions/decorationTextPayload/resolvedDecorationTextFormatRuns/decorationTextEffects/decorationTextCounterVariable/decorationTextStyleFollowsPath/decorationTextRepeatCount/decorationTextCharacterReplacements/computerModernOpticalTextFamily; src/renderers/svg/decorationText.js:renderDecorationTextPath/formattedDecorationGlyphs/groupDecorationTextGlyphs/sizeDecorationTextReplacements/scaleDecorationTextCharacters/padDecorationTextNodeBoxes/ordinaryDecorationTextBaselineOffset/layoutDecorationText/includeDecorationTextNodeBounds/decorationReplacementRadius/decorationTextEffectsScale/decorationTextEffectsFitShift; src/tikz/decorations/path.js:applyPathDecoration; src/renderers/svg/bounds.js:computeSvgBounds",
  "localSourceReviewed": "/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex; /usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex (finish, rectB, extra postaction); /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorescopes.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathconstruct.code.tex; /usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex",
  "localDoc": "/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex",
  "features": [
    "text along path",
    "half-box exhaustion of a single-pass text run and optical CMTT advances",
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
    "ordinary decoration text color reset and text-effects current-color inheritance",
    "direct text decorations replace input paths; postactions retain them and paint afterwards",
    "edge-local text decorations and native rectangle traversal",
    "braced inline math groups as single positioned TeX boxes",
    "text-effects picture bounds from rotated padded character nodes, including spaces, repeats, scale, raise and overlay",
    "replacement circles use their own picture origin, stroked advance and rotated cubic-control bounding box"
  ],
  "implements": [
    "text along path",
    "half-box exhaustion of a single-pass text run and optical CMTT advances",
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
    "ordinary decoration text color reset and text-effects current-color inheritance",
    "direct text decorations replace input paths; postactions retain them and paint afterwards",
    "edge-local text decorations and native rectangle traversal",
    "braced inline math groups as single positioned TeX boxes",
    "text-effects picture bounds from rotated padded character nodes, including spaces, repeats, scale, raise and overlay",
    "replacement circles use their own picture origin, stroked advance and rotated cubic-control bounding box"
  ],
  "notes": "Text is sampled on a flattened path. Multiple `postaction` values retain their source order and each reuses the saved main path, matching the local TikZ action loop; a bare `postaction={decorate}` inherits the enclosing path's `decoration=...` keys. Individual text decorations retain their `text color` and reverse their sampling direction only for `reverse path`, independently of `reverse text`. Default serif decoration text now resolves to the same Computer Modern optical design face as ordinary TikZ nodes, keeping CMR path advances and painted grouped-word glyphs in one metric system. The default `|...|` format delimiters now follow PGF's state machine: a plain format replaces the current character-box format, a leading `+` appends to it, and `||` resets it. Font size, family, weight, style, and `\\color` are attached to each affected glyph run rather than painted as literal control text; explicit `text color` still supplies the decoration-wide fallback. The text-effects variant retains source-order `reverse text` and `group letters` transforms: simple plain-text runs become whole-word node boxes, `group letters into words` is an alias, and `word separator` accepts the documented space/default or a single separator character. Reviewed on 2026-09-06 against the local decorations.text, pgfkeys, and PGF decoration-state sources: text-effects characters are ordinary centered TikZ nodes with the default `.3333em` horizontal padding. `characters={text along path}`, its append/every-character forms, and `text effects={text along path}` switch to zero horizontal padding, a base anchor, and tangent rotation. Grouping happens before node-box measurement, so grouped words inherit one pair of node paddings. Replacement TikZ code is measured as its own PGF picture: the supported circle replacement advances by its measured painted diameter and bypasses ordinary character-node padding. `fit text to path` keeps the first and last half glyph boxes fixed and proportionally changes only the internal centers; `scale text to path` uses the local path/text-width factor for both advances and glyph font scale. `repeat text` follows the local PGF pre/token/post state sequence: a bare or negative value restarts the character count until the next prewidth no longer fits, while a positive integer adds that many source-text copies. pgfkeys trims soft outer value spaces, whereas an explicit `\\ ` remains one padded control-space token. `character count` and `character total` variables are rebound for every source copy and can drive the documented per-character `scale` expression. Ordinary text-along-path boxes reset to black or explicit decoration text color before applying inline formatting; text-effects nodes retain current/text color inheritance. Repeated replace-character mappings preserve the native per-character registration for documented fill/draw/path circle payloads, including radius and paint options. Explicit brace groups containing inline math are measured, rotated, and positioned as one PGF-style text box with simple super/subscripts. Custom `text format delimiters`, arbitrary replacement TikZ code, arbitrary character-specific styles, word grouping across rich/math/replacement boxes, nested/general TeX grouping, asymmetric native node pre/post widths, general styled/math character-node bounding boxes, exact bold/italic TeX advance metrics, and native-undefined repeat plus scaling/fitting combinations remain partial. Evidence is in docs/qa/2026-09-06-decorations-text-character-node-styles.md, docs/qa/2026-09-06-decorations-text-replacement-spacing.md, and docs/qa/2026-09-06-decorations-text-repeat-state-machine.md. Reviewed 2026-11-07: direct text decorations replace the painted input path, including empty text, curves, circles and independent edges. Postactions retain the main path and paint their text afterwards. Edge-local decoration options do not leak to siblings. TikZ rectangles follow rectB's vertical-first traversal, which also determines text direction. Native and actual Chrome evidence is recorded in docs/qa/2026-11-07-text-path-replacement.md. Nonzero pre/post decoration segments, preactions, arrow tips on empty decorated paths, exact curve-length arithmetic and whole-image acceptance remain partial. Reviewed 2026-11-07: text-effects node backgrounds contribute transformed padded bounds even without paint; base-anchored text retains vertical .3333em padding. Ordinary text along path instead uses pgfqboxsynced and must not enlarge picture bounds. Repeated and single-pass glyphs share one placement routine with the bounds calculation. Circle replacements have no character baseline offset, include stroke width when measured, and follow pgfpathellipse cubic-control bounds under rotation. Overlay decorations remain outside picture-size tracking. Independent native picture-register probes and Chrome comparisons are recorded in docs/qa/2026-11-07-text-effects-bounds.md. The manual spiral clipping is repaired; exact native curve-distance arithmetic, arbitrary character styles, rich/math box bounds and whole-image raster equivalence remain partial."
};
tikzLibrary.implementedBy += "; src/tex/decorationBoxes.js:layoutDecorationRun; src/renderers/svg/decorationBox.js:renderDecorationBox; src/renderers/svg/decorationText.js:decorationGlyphAdvance";
tikzLibrary.localSourceReviewed += "; pgfmoduledecorations.code.tex (state widths), ot1cmtt.fd (optical typewriter faces), pgflibrarydecorations.text.code.tex (scanchar, collectrestoftextgrp, dobox, before/after typeset), cmr10.pfb (Computer Modern Roman outlines)";
tikzLibrary.notes += " A single-pass decoration stops at the first exhausted prewidth. Regular typewriter runs use CMTT advances; a trailing format change retains PGF's final character box. See docs/qa/2026-11-18-project-review-fixes.md.";
tikzLibrary.features.push("ordinary path hboxes with TeX ligatures, explicit kerns, and grouped inline formulas");
tikzLibrary.notes += " Ordinary path text distinguishes separate tokens from rigid groups, including PGF's saved-remainder grouping. Native TFM advances, ligatures, explicit pt kerns, inline fractions, scripts and radicals share one tangent and a TeX baseline. Control spaces are not stretchable scanner spaces. Default CMR10 uses reusable native outlines; other supported faces use the packaged MacTeX fonts. General macro expansion, state across format changes and exact curve-distance arithmetic remain partial. See docs/qa/2026-11-25-native-decoration-boxes.md.";
