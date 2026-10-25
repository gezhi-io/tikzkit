import { nativeBaselineSkip, nativeMathFont } from "./mathFonts.js";
import { layoutNativeMath } from "./mathBox.js";
import { layoutNativeText, nativeTypewriterFont } from "./textBox.js";
import { breakNativeParagraph } from "./paragraphBreaking.js";

export function nativeParagraphLines(source, font, widthPt, options = {}) {
  const size = Number(font.sizePt) || 10;
  return breakNativeParagraph(source, widthPt, line => paragraphLine(line, font, widthPt, false, false),
    { ...options, emergencyStretch: 3 * size });
}

// Pack already-broken lines as TeX hboxes in a vbox. Line breaking is a
// separate operation: this owns physical font glue, baselines and paint.
export function layoutNativeParagraph(lines, font, widthPt, alignment = "justify") {
  const size = Number(font.sizePt) || 10;
  const baselineSkip = Number(font.baselineSkipPt) || nativeBaselineSkip(size);
  if (!lines.length || !(widthPt > 0) || !(baselineSkip > 0)) return null;
  const boxes = lines.map((line, i) => paragraphLine(line, font, widthPt,
    alignment === "justify" && i < lines.length - 1));
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
  const role = nativeTypewriterFont(font) ? "CMTT" : ["bold", "700"].includes(String(font.weight)) ? "CMBX" : "CMR";
  const parameters = nativeMathFont(role, size).parameters;
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
          pieces.push({ width: size * (parameters.SPACE + (spaceFactor >= 2000 ? parameters.EXTRASPACE : 0)),
            stretch: size * parameters.STRETCH * spaceFactor / 1000,
            shrink: size * parameters.SHRINK * 1000 / spaceFactor, glue: true });
        } else {
          const box = layoutNativeText(token, font);
          if (!box) return null;
          pieces.push(box);
          for (const char of token) {
            const next = /[A-Z]/.test(char) ? 999 : ({ ".": 3000, "?": 3000, "!": 3000, ":": 2000, ";": 1500, ",": 1250 }[char] || 1000);
            // TeX suppresses sentence space after an uppercase abbreviation.
            spaceFactor = next > 1000 && spaceFactor < 1000 ? 1000 : next;
          }
        }
      }
    }
  }
  const stretch = pieces.reduce((sum, box) => sum + (box.stretch || 0) +
    (box.paragraphGlues || []).reduce((value, glue) => value + glue.stretch, 0), 0);
  const shrink = pieces.reduce((sum, box) => sum + (box.shrink || 0) +
    (box.paragraphGlues || []).reduce((value, glue) => value + glue.shrink, 0), 0);
  const naturalWidth = pieces.reduce((sum, box) => sum + box.width, 0);
  // Infinite flush glue stretches short ragged/centered lines, but cannot
  // shrink. TeX still shrinks ordinary word/math glue on an overwide line.
  const delta = pack && (justify || naturalWidth > widthPt) ? widthPt - naturalWidth : 0;
  const glueKind = delta < 0 ? "shrink" : "stretch";
  const available = delta < 0 ? shrink : stretch;
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
