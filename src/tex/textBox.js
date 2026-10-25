import { nativeMathFont, nativeMathSize } from "./mathFonts.js";
import { parseTikzFontPatch, unscaledTextFont } from "./fontSpec.js";
import { layoutNativeMath, scaleNativeMathBox } from "./mathBox.js";
import { nativeSpaceFactor } from "./textSpacing.js";

export function nativeTypewriterFont(font = {}) {
  return Boolean(nativeMathSize(Number(unscaledTextFont(font).sizePt ?? 10))) &&
    /(?:Typewriter|monospace|TikZKitCMTT\d+)/i.test(String(font.family || ""));
}

export function layoutNativeTextRun(normalized, font = {}) {
  if (font.geometricScale && font.geometricScale !== 1) {
    const box = layoutNativeTextRun(normalized, unscaledTextFont(font));
    return box && scaleNativeMathBox(box, font.geometricScale);
  }
  const raw = String(normalized.raw ?? normalized.text ?? "");
  if (normalized.inlineNodes?.length || nativeTypewriterFont(font) && /\\textcolor\b/.test(raw)) {
    return layoutInlineText(normalized, font);
  }
  if (raw === normalized.text && raw.includes("$")) return layoutNativeMixedText(raw, font);
  // Parse supported controls from source, not flattened normalization, to
  // preserve text kerns, escaped symbols and scoped paint. Unknowns fall back.
  if (raw !== normalized.text || /[\\{}]/.test(raw)) return layoutInlineText(normalized, font);
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
    const bold = ["bold", "700"].includes(String(font.weight));
    const family = nativeTypewriterFont(font) ? "CMTT" : nativeSansFont(font)
      ? (bold ? "CMSSBX" : "CMSS") : bold ? "CMBX" : "CMR";
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
        if (/^(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny|tt|ttfamily|sf|sffamily|rm|rmfamily|bf|bfseries|mdseries|upshape|normalfont)$/.test(command)) {
          // The old LaTeX declarations reset family/series/shape first;
          // NFSS declarations such as bfseries change only their own axis.
          if (/^(?:tt|sf|rm|bf|normalfont)$/.test(command)) {
            font = { ...font, family: "serif", weight: 400, style: "normal", variant: "normal" };
          }
          font = { ...font, ...parseTikzFontPatch(`\\${command}`) };
          continue;
        }
        if (command === "color") {
          const paint = group();
          if (paint === null) return null;
          color = paint.trim();
          continue;
        }
        if (/^(?:textbf|textmd|textrm|texttt|textsf|textnormal)$/.test(command)) {
          const contents = group();
          if (contents === null) return null;
          const patch = command === "textnormal"
            ? { family: "serif", weight: 400, style: "normal", variant: "normal" }
            : parseTikzFontPatch(`\\${{ textbf: "bfseries", textmd: "mdseries", textrm: "rmfamily", texttt: "ttfamily", textsf: "sffamily" }[command]}`);
          part = parse(contents, { ...font, ...patch }, color, depth + 1);
        } else if (command === "textcolor") {
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
  if (font.geometricScale && font.geometricScale !== 1) {
    const box = layoutNativeText(text, unscaledTextFont(font));
    return box && scaleNativeMathBox(box, font.geometricScale);
  }
  const source = String(text ?? "");
  const size = nativeMathSize(Number(font.sizePt ?? 10));
  const family = String(font.family || "serif");
  const weight = String(font.weight ?? 400);
  const typewriter = nativeTypewriterFont(font);
  const sans = nativeSansFont(font);
  if (!source || /[\\${}\r\n]/.test(source) || !size ||
      (!typewriter && !sans && !/^(?:serif|TikZKitCM(?:R|BX)\d+|TikZKitCMUSerif)(?:,|$)/.test(family)) ||
      !["normal", "400", "bold", "700"].includes(weight) ||
      (font.style && font.style !== "normal") || (font.variant && font.variant !== "normal")) return null;
  const bold = ["bold", "700"].includes(weight) || /^TikZKitCM(?:BX|SSBX)/.test(family);
  const metrics = nativeMathFont(typewriter ? "CMTT" : sans ? (bold ? "CMSSBX" : "CMSS") : bold ? "CMBX" : "CMR", size);
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
      // A nonzero TeX spaceskip is a physical glue width: an inner font
      // declaration must not rescale it. Sentence spaces prefer xspaceskip.
      const sentence = char === " " && spaceFactor >= 2000;
      box.width += sentence && font.extraSpaceSkipPt > 0 ? font.extraSpaceSkipPt :
        (font.spaceSkipPt > 0 ? font.spaceSkipPt : metrics.parameters.SPACE * size) +
        (sentence ? metrics.parameters.EXTRASPACE * size : 0);
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

export function nativeSansFont(font = {}) {
  return /^(?:sans-serif|TikZKitCMSS(?:BX)?\d+|TikZKitCMUSans)(?:,|$)/.test(String(font.family || ""));
}
