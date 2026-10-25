import { nativeBaselineSkip, nativeMathFont } from "./mathFonts.js";
import { layoutNativeMath } from "./mathBox.js";
import { layoutNativeText, layoutNativeTextRun, nativeTypewriterFont, nativeSansFont } from "./textBox.js";
import { breakNativeParagraph, breakMeasuredParagraph } from "./paragraphBreaking.js";
import { nativeSpaceFactor } from "./textSpacing.js";

export function nativeParagraphLines(source, font, widthPt, options = {}) {
  const size = Number(font.sizePt) || 10;
  return breakNativeParagraph(source, widthPt, line => paragraphLine(line, font, widthPt, false, false),
    { ...options, emergencyStretch: 3 * size });
}

// Pack already-broken lines as TeX hboxes in a vbox. Line breaking is a
// separate operation: this owns physical font glue, baselines and paint.
export function layoutNativeParagraph(lines, font, widthPt, alignment = "justify", options = {}) {
  const size = Number(font.sizePt) || 10;
  const baselineSkip = Number(font.baselineSkipPt) || nativeBaselineSkip(size);
  if (!lines.length || !(widthPt > 0) || !(baselineSkip > 0)) return null;
  const boxes = lines.map((line, i) => Array.isArray(line)
    ? packParagraphPieces(line, widthPt, alignment === "justify" && i < lines.length - 1, true,
      i < lines.length - 1 || options.lastLineStretch === false ? options.backgroundStretch || 0 : 0)
    : paragraphLine(line, font, widthPt, alignment === "justify" && i < lines.length - 1));
  if (boxes.some(box => !box)) return null;
  const rows = [];
  let baseline = 0;
  for (const [i, box] of boxes.entries()) {
    if (i) {
      const clearance = baselineSkip - boxes[i - 1].depth - box.height;
      baseline += clearance < 0 ? boxes[i - 1].depth + box.height + 1 : baselineSkip;
    }
    rows.push({ width: box.width, height: box.height, depth: box.depth, baseline });
  }
  return { width: widthPt, height: boxes[0].height + baseline, depth: boxes.at(-1).depth,
    measurementKind: "cm-text-box", rows,
    items: boxes.flatMap((box, i) => {
      const remaining = Math.max(0, widthPt - box.width);
      const dx = alignment === "right" ? remaining : alignment === "center" ? remaining / 2 : 0;
      return box.items.map(item => ({ ...item, x: item.x + dx, y: item.y + rows[i].baseline - baseline }));
    })
  };
}

function paragraphLine(source, font, widthPt, justify, pack = true) {
  if (!layoutNativeText(" ", font)) return null;
  const size = Number(font.sizePt) || 10;
  const parameters = paragraphFontMetrics(font, size).parameters;
  const parts = String(source).split("$");
  if (parts.length % 2 !== 1 || parts.some((part, i) => i % 2 && !part)) return null;
  const pieces = [];
  let spaceFactor = 1000;
  for (const [i, part] of parts.entries()) {
    if (i % 2) {
      const box = layoutNativeMath(part, { fontSizePt: size, mathVersion: font.mathVersion,
        mathExtension: font.mathExtension, preferNativeMath: true });
      if (!box) return null;
      pieces.push(box);
      spaceFactor = 1000;
    } else {
      // Unknown text controls must fall back as a unit, not lose their scopes.
      if (/[\\{}~\r\n]/.test(part)) return null;
      for (const token of part.match(/\s+|\S+/gu) || []) {
        if (/^\s/u.test(token)) {
          const fixed = Number.isFinite(font.spaceSkipPt);
          pieces.push({ width: fixed
            ? spaceFactor >= 2000 && font.extraSpaceSkipPt ? font.extraSpaceSkipPt : font.spaceSkipPt
            : size * (parameters.SPACE + (spaceFactor >= 2000 ? parameters.EXTRASPACE : 0)),
            stretch: fixed ? 0 : size * parameters.STRETCH * spaceFactor / 1000,
            shrink: fixed ? 0 : size * parameters.SHRINK * 1000 / spaceFactor, glue: true });
        } else {
          const box = layoutNativeText(token, font);
          if (!box) return null;
          pieces.push(box);
          for (const char of token) {
            spaceFactor = nativeSpaceFactor(spaceFactor, char);
          }
        }
      }
    }
  }
  return packParagraphPieces(pieces, widthPt, justify, pack);
}

function packParagraphPieces(pieces, widthPt, justify, pack = true, backgroundStretch = 0) {
  const stretch = pieces.reduce((sum, box) => sum + (box.stretch || 0) +
    (box.paragraphGlues || []).reduce((value, glue) => value + glue.stretch, 0), 0);
  const shrink = pieces.reduce((sum, box) => sum + (box.shrink || 0) +
    (box.paragraphGlues || []).reduce((value, glue) => value + glue.shrink, 0), 0);
  const naturalWidth = pieces.reduce((sum, box) => sum + box.width, 0);
  // Infinite flush glue stretches short ragged/centered lines, but cannot
  // shrink. TeX still shrinks ordinary word/math glue on an overwide line.
  const delta = pack && (justify || backgroundStretch || naturalWidth > widthPt) ? widthPt - naturalWidth : 0;
  const glueKind = delta < 0 ? "shrink" : "stretch";
  const available = delta < 0 ? shrink : stretch + backgroundStretch;
  const ratio = available ? delta < 0 ? Math.max(-1, delta / available) : delta / available : 0;
  const line = { width: 0, height: 0, depth: 0, stretch, shrink, items: [] };
  for (const box of pieces) {
    if (box.glue) line.width += box.width + ratio * box[glueKind];
    else {
      const glues = box.paragraphGlues || [];
      line.items.push(...box.items.map((item, index) => ({ ...item, x: item.x + line.width +
        ratio * glues.filter(glue => glue.itemIndex <= index).reduce((sum, glue) => sum + glue[glueKind], 0) })));
      line.width += box.width + ratio * glues.reduce((sum, glue) => sum + glue[glueKind], 0);
      line.height = Math.max(line.height, box.height);
      line.depth = Math.max(line.depth, box.depth);
    }
  }
  return line;
}

// Preserve native math noads across paragraph breaks, rather than slicing
// TeX source and asking a different formula parser to lay out each half.
export function layoutNativeMixedParagraph(source, font, widthPt, alignment, options = {}) {
  const text = source.trim().replace(/\s+/g, " ");
  const size = Number(font.sizePt) || 10;
  const metrics = paragraphFontMetrics(font, size);
  if (!layoutNativeText(" ", font) || text.length > 4096) return null;
  const parts = text.split("$");
  if (parts.length < 3 || parts.length % 2 !== 1) return null;
  const pieces = [], breaks = [{ end: 0, next: 0 }];
  let spaceFactor = 1000;
  for (const [index, part] of parts.entries()) {
    if (index % 2) {
      const math = layoutNativeMath(part, { fontSizePt: size, mathVersion: font.mathVersion,
        mathExtension: font.mathExtension });
      if (!math) return null;
      for (const piece of math.paragraphParts) {
        // Glue following a chosen math penalty is discarded at line start.
        if (piece.glue && breaks.at(-1).next === pieces.length) breaks.at(-1).next++;
        pieces.push(piece.glue ? piece : { width: piece.width, height: piece.height,
          depth: piece.depth, items: piece.items });
        if (piece.breakPenalty !== undefined) breaks.push({ end: pieces.length,
          next: pieces.length, penalty: piece.breakPenalty });
      }
      spaceFactor = 1000;
    } else {
      for (const token of part.match(/\s+|\S+/g) || []) {
        if (/^\s/.test(token)) {
          breaks.push({ end: pieces.length, next: pieces.length + 1 });
          const fixed = Number.isFinite(font.spaceSkipPt), p = metrics.parameters;
          pieces.push({ width: fixed ? spaceFactor >= 2000 && font.extraSpaceSkipPt
            ? font.extraSpaceSkipPt : font.spaceSkipPt
            : size * (p.SPACE + (spaceFactor >= 2000 ? p.EXTRASPACE : 0)),
            stretch: fixed ? 0 : size * p.STRETCH * spaceFactor / 1000,
            shrink: fixed ? 0 : size * p.SHRINK * 1000 / spaceFactor, glue: true });
        } else {
          const box = layoutNativeTextRun({ raw: token, text: token }, font);
          if (!box) return null;
          pieces.push(box);
          for (const char of token.replace(/\\[,!:;]/g, "")) spaceFactor = nativeSpaceFactor(spaceFactor, char);
        }
      }
    }
  }
  breaks.push({ end: pieces.length, next: pieces.length });
  const cache = new Map();
  const lines = breakMeasuredParagraph(breaks, widthPt, (start, end) => {
    const key = `${start}:${end}`;
    if (!cache.has(key)) {
      const line = pieces.slice(breaks[start].next, breaks[end].end);
      cache.set(key, { line, box: packParagraphPieces(line, widthPt, false, false) });
    }
    return cache.get(key);
  }, { ...options, emergencyStretch: 3 * size });
  return lines && layoutNativeParagraph(lines, font, widthPt, alignment, options);
}

function paragraphFontMetrics(font, size) {
  const bold = font.weight === "bold" || Number(font.weight) >= 700;
  const role = nativeTypewriterFont(font) ? "CMTT" : nativeSansFont(font)
    ? bold ? "CMSSBX" : "CMSS" : bold ? "CMBX" : "CMR";
  return nativeMathFont(role, size);
}
