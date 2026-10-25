import { nativeMathFont, nativeMathSize } from "./mathFonts.js";
import { parseTikzFontPatch } from "./fontSpec.js";
import { layoutNativeMath } from "./mathBox.js";
import { nativeSpaceFactor } from "./textSpacing.js";

export function nativeTypewriterFont(font = {}) {
  // The installed browser asset is cmtt10. Other NFSS optical sizes need
  // their own font assets; do not silently stretch this face to replace them.
  return Number(font.sizePt ?? 10) === 10 &&
    /(?:Typewriter|monospace|TikZKitCMTT10)/i.test(String(font.family || ""));
}

export function layoutNativeTextRun(normalized, font = {}) {
  const raw = String(normalized.raw ?? normalized.text ?? "");
  if (normalized.inlineNodes?.length || nativeTypewriterFont(font) && /\\textcolor\b/.test(raw)) {
    return layoutInlineText(normalized, font);
  }
  if (raw === normalized.text && raw.includes("$")) return layoutNativeMixedText(raw, font);
  // Parse supported controls from source, not flattened normalization, to
  // preserve text kerns, escaped symbols and scoped paint. Unknowns fall back.
  if (raw !== normalized.text || raw.includes("\\")) return layoutInlineText(normalized, font);
  return layoutNativeText(normalized.text, font);
}

// Inline formulas and literal text share a TeX hbox baseline. Keep CM math
// script sizes and text spaces intact instead of flattening the source into
// one browser text run. Unsupported content falls back as a complete unit.
export function layoutNativeMixedText(source, font = {}) {
  if (!layoutNativeText(" ", font) || /[\r\n]/.test(source)) return null;
  const parts = String(source).split("$");
  if (parts.length < 3 || parts.length % 2 !== 1 || parts.some((part, i) => i % 2 && !part)) return null;
  const box = { width: 0, height: 0, depth: 0, items: [], measurementKind: "cm-text-box" };
  for (const [index, part] of parts.entries()) {
    if (!part) continue;
    const child = index % 2 ? layoutNativeMath(part, {
      fontSizePt: Number(font.sizePt) || 10, mathVersion: font.mathVersion,
      mathExtension: font.mathExtension, preferNativeMath: true
    }) : layoutNativeText(part.replace(/[ \t]+/g, " "), font);
    if (!child) return null;
    box.items.push(...child.items.map(item => ({ ...item, x: item.x + box.width })));
    box.width += child.width;
    box.height = Math.max(box.height, child.height);
    box.depth = Math.max(box.depth, child.depth);
  }
  return box;
}

function layoutInlineText(normalized, font) {
  const inlineNodes = normalized.inlineNodes || [];
  let nodeIndex = 0;
  const append = (target, source, dx = target.width, dy = 0) => {
    target.items.push(...source.items.map(item => ({ ...item, x: item.x + dx, y: item.y + dy })));
    target.width = dx + source.width;
    target.height = Math.max(target.height, source.height - dy);
    target.depth = Math.max(target.depth, source.depth + dy);
  };
  const lengthPt = (length, font) => {
    const size = Number(font.sizePt || 10);
    const family = nativeTypewriterFont(font) ? "CMTT" : ["bold", "700"].includes(String(font.weight)) ? "CMBX" : "CMR";
    const metrics = nativeMathFont(family, size);
    // TeX em is fontdimen6 (the quad), not the nominal font size. cmtt10's
    // quad is 10.4999pt, which affects even PGF's default .3333em inner sep.
    return length.value * ({ pt: 1, cm: 72.27 / 2.54, mm: 72.27 / 25.4,
      em: metrics?.parameters.QUAD * size, ex: metrics?.parameters.XHEIGHT * size }[length.unit]);
  };
  const parse = (source, inherited, color, depth = 0) => {
    if (depth > 32) return null;
    const box = { width: 0, height: 0, depth: 0, items: [], measurementKind: "cm-text-box" };
    let font = { ...inherited };
    let cursor = 0;
    const group = () => {
      while (/\s/.test(source[cursor] || "")) cursor++;
      if (source[cursor++] !== "{") return null;
      const start = cursor;
      let level = 1;
      while (cursor < source.length && level) {
        const char = source[cursor++];
        if (char === "\\") cursor++;
        else if (char === "{") level++;
        else if (char === "}") level--;
      }
      return level ? null : source.slice(start, cursor - 1);
    };
    while (cursor < source.length) {
      let part = null;
      if (source[cursor] === "{") {
        const contents = group();
        if (contents === null) return null;
        part = parse(contents, font, color, depth + 1);
      } else if (source[cursor] === "\\") {
        const symbol = source[cursor + 1];
        if (",!:;".includes(symbol || "") && symbol) {
          // LaTeX's text-mode tmspace uses the selected font's quad. In
          // cmr8 one em is 8.50012pt, not the nominal 8pt font size.
          const em = { ",": 0.16667, "!": -0.16667, ":": 0.2222, ";": 0.2777 }[symbol];
          const width = lengthPt({ value: em, unit: "em" }, font);
          if (!Number.isFinite(width)) return null;
          box.width += width;
          cursor += 2;
          continue;
        }
        if ("%$#& ".includes(symbol || "") && symbol) {
          part = layoutNativeText(symbol, font);
          if (!part) return null;
          if (color) part.items = part.items.map(item => ({ ...item, color }));
          append(box, part);
          cursor += 2;
          continue;
        }
        const command = source.slice(cursor).match(/^\\([A-Za-z]+)/)?.[1];
        if (!command) return null;
        cursor += command.length + 1;
        while (/\s/.test(source[cursor] || "")) cursor++;
        if (/^(?:tt|ttfamily|rm|rmfamily)$/.test(command)) {
          font = { ...font, ...parseTikzFontPatch(`\\${command}`) };
          continue;
        }
        if (command === "textcolor") {
          const paint = group();
          const contents = group();
          if (paint === null || contents === null) return null;
          part = parse(contents, font, paint.trim(), depth + 1);
        } else if (command === "tikzinlinebox") {
          const paint = group();
          const ignoredFallback = group();
          const node = inlineNodes[nodeIndex++];
          if (paint === null || ignoredFallback === null || !node) return null;
          const nodeFont = { ...font, ...parseTikzFontPatch(node.font) };
          const content = parse(node.text, nodeFont, node.color || color, depth + 1);
          if (!content) return null;
          const px = lengthPt(node.paddingX, nodeFont);
          const py = lengthPt(node.paddingY, nodeFont);
          if (!Number.isFinite(px + py)) return null;
          // PGF packs the original node text hbox at its base anchor, then
          // grows its rectangle by inner x/ysep. A baseline=0 picture retains
          // that depth; a center anchor shifts the entire hbox, not its glyphs.
          const dy = node.anchor === "base" ? 0 : (content.height - content.depth) / 2;
          const height = content.height + py - dy;
          const width = content.width + 2 * px;
          part = { width, height, depth: content.depth + py + dy, items: [
            { type: "rule", x: 0, y: -height, width, height: content.height + content.depth + 2 * py, color: node.fill },
            ...content.items.map(item => ({ ...item, x: item.x + px, y: item.y + dy }))
          ] };
        } else return null;
      } else {
        const literal = source.slice(cursor).match(/^[^\\{}$]+/)?.[0];
        if (!literal) return null;
        cursor += literal.length;
        part = layoutNativeText(literal.replace(/\s+/g, " "), font);
        if (part && color) part.items = part.items.map(item => ({ ...item, color }));
      }
      if (!part) return null;
      append(box, part);
    }
    return box;
  };
  const result = parse(String(normalized.raw || "").trim(), font, null);
  return nodeIndex === inlineNodes.length ? result : null;
}

// A single literal TeX hbox. Reuse the packaged MacTeX TFM data rather than
// deriving node anchors from browser font bounds or a fitted width multiplier.
// Paragraphs, control sequences and non-CM faces keep their existing renderer.
export function layoutNativeText(text, font = {}) {
  const source = String(text ?? "");
  const size = nativeMathSize(Number(font.sizePt ?? 10));
  const family = String(font.family || "serif");
  const weight = String(font.weight ?? 400);
  const typewriter = nativeTypewriterFont(font);
  if (!source || /[\\${}\r\n]/.test(source) || !size ||
      (!typewriter && !/^(?:serif|TikZKitCM(?:R|BX)\d+|TikZKitCMUSerif)(?:,|$)/.test(family)) ||
      (typewriter && !["normal", "400"].includes(weight)) ||
      !["normal", "400", "bold", "700"].includes(weight) ||
      (font.style && font.style !== "normal") || (font.variant && font.variant !== "normal")) return null;
  const bold = ["bold", "700"].includes(weight) || /^TikZKitCMBX/.test(family);
  const metrics = nativeMathFont(typewriter ? "CMTT" : bold ? "CMBX" : "CMR", size);
  const chars = [];
  for (const char of source) {
    const ligature = metrics.ligatures[chars.at(-1)]?.[char];
    if (ligature) chars[chars.length - 1] = ligature;
    else chars.push(char);
  }
  const box = { width: 0, height: 0, depth: 0, items: [], measurementKind: "cm-text-box" };
  let spaceFactor = 1000;
  for (const [index, char] of chars.entries()) {
    if (char === " " || char === "\u00a0") {
      box.width += (metrics.parameters.SPACE +
        (char === " " && spaceFactor >= 2000 ? metrics.parameters.EXTRASPACE : 0)) * size;
      continue;
    }
    const glyph = metrics.glyphs[char];
    if (!glyph) return null;
    box.width += (metrics.kern[chars[index - 1]]?.[char] || 0) * size;
    box.items.push({ type: "glyph", text: char, x: box.width, y: 0, size,
      family: metrics.family, style: metrics.style, weight: metrics.weight });
    box.width += glyph[0] * size;
    box.height = Math.max(box.height, glyph[1] * size);
    box.depth = Math.max(box.depth, glyph[2] * size);
    spaceFactor = nativeSpaceFactor(spaceFactor, char);
  }
  return box;
}
