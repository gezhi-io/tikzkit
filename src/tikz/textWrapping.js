import { nativeMathFont, nativeMathSize } from "../tex/mathFonts.js";

// A paragraph's font runs belong to source characters, not to every output
// line. Consume them monotonically so repeated words and discretionary
// hyphens retain their scopes in both node measurement and SVG painting.
export function wrappedTextLineStyles(style = {}, lines = []) {
  const segments = style.fontSegments || [];
  if (!segments.length) return lines.map(() => style);
  const characters = [];
  for (const segment of segments) {
    for (const char of segment.text || "") {
      if (char === "\u00ad") continue;
      if (/\s/u.test(char)) {
        if (characters.length && characters.at(-1).char !== " ") characters.push({ char: " ", segment });
      } else characters.push({ char, segment });
    }
  }
  if (characters.at(-1)?.char === " ") characters.pop();
  let cursor = 0;
  return lines.map(line => {
    while (characters[cursor]?.char === " ") cursor++;
    const runs = [];
    let previousSegment = null;
    const chars = [...String(line)];
    for (const [index, char] of chars.entries()) {
      let current = characters[cursor];
      if (char === "-" && index === chars.length - 1 && current?.char !== "-") {
        current = { char, segment: characters[cursor - 1]?.segment || current?.segment };
      } else if (current?.char === char) cursor++;
      else {
        // A different formatter (for example math fallback) may have changed
        // the text. Let that formatter paint the line, never the full paragraph.
        return { ...style, fontSegments: [] };
      }
      if (!current?.segment) return { ...style, fontSegments: [] };
      if (current.segment === previousSegment) runs.at(-1).text += char;
      else runs.push({ ...current.segment, text: char });
      previousSegment = current.segment;
    }
    return { ...style, fontSegments: runs };
  });
}
// TikZ's minipage first asks TeX for a paragraph without automatic hyphens.
// Its finite side glue, pretolerance=100, linepenalty=10 and adjdemerits=10000
// come from tikz.code.tex and latex.ltx. A failed pass falls back to the
// hyphenating path; a successful pass must not acquire extra word fragments.
export function wrapNativeTextFirstPass(text, widthPt, scale, options = {}) {
  const style = options.lineStyle;
  if (!style || options.lineBreakMode === "flush" || /[\\${}\u00ad]/u.test(text)) return null;
  const words = [...text.matchAll(/\S+/gu)];
  if (!words.length) return null;
  const paragraphSize = nativeMathSize(10 * scale / (Number(style.scale) || 1));
  if (!paragraphSize) return null;
  const quad = nativeMathFont("CMR", paragraphSize)?.parameters.QUAD * paragraphSize;
  if (!Number.isFinite(quad)) return null;
  const space = Math.round(0.3333 * quad * 65536) / 65536;
  const centered = options.lineBreakMode === "center";
  const stretch = quad * (centered ? 4 : 2);
  const best = Array.from({ length: words.length + 1 }, () => new Map());
  best[0].set(2, { cost: 0, fitness: 2, lines: [] });
  for (let start = 0; start < words.length; start++) {
    if (!best[start].size) continue;
    for (let end = start + 1; end <= words.length; end++) {
      const line = words.slice(start, end).map(word => word[0]).join(" ");
      const prefix = text.slice(0, words[start].index).trim();
      const ranges = prefix ? [prefix, line] : [line];
      const selected = wrappedTextLineStyles(style, ranges).at(-1);
      const runs = selected.fontSegments?.length ? selected.fontSegments : [{ text: line }];
      let width = 0;
      for (const run of runs) {
        const part = nativeFontRunWidth(run, style, 10 * scale, space);
        if (part === null) return null;
        width += part;
      }
      if (width > widthPt + 1 / 65536) break;
      const remaining = widthPt - width;
      const badness = !centered && end === words.length ? 0 : Math.round(100 * (remaining / stretch) ** 3);
      if (badness > 100) continue;
      const fitness = badness > 99 ? 0 : badness > 12 ? 1 : 2;
      for (const previous of best[start].values()) {
        const cost = previous.cost + (10 + badness) ** 2 + (Math.abs(fitness - previous.fitness) > 1 ? 10000 : 0);
        if (cost < (best[end].get(fitness)?.cost ?? Infinity)) {
          best[end].set(fitness, { cost, fitness, lines: [...previous.lines, line] });
        }
      }
    }
  }
  return [...best.at(-1).values()].sort((a, b) => a.cost - b.cost)[0]?.lines || null;
}

function nativeFontRunWidth(run, style, sizePt, space) {
  const size = nativeMathSize(sizePt * (Number(run.scale) || 1));
  const family = String(run.family || style.fontFamily || "serif");
  const weight = String(run.weight ?? style.fontWeight ?? 400);
  const fontStyle = run.style || style.fontStyle || "normal";
  const italic = fontStyle === "italic";
  const variant = run.variant || style.fontVariant;
  const mono = /monospace|Typewriter|CMTT|CMUMono/i.test(family);
  if (!size || (variant && variant !== "normal") || !["400", "normal", "700", "bold"].includes(weight)
      || !["normal", "italic"].includes(fontStyle)) return null;
  if (!mono && !/^(?:serif|TikZKitCMR\d+|TikZKitCMUSerif)(?:,|$)/.test(family)) return null;
  const bold = ["700", "bold"].includes(weight);
  if ((mono && italic) || (italic && (size !== 10 || bold))) return null;
  const metrics = nativeMathFont(mono ? "CMTT" : italic ? "CMTI" : bold ? "CMBX" : "CMR", size);
  if (!metrics) return null;
  const chars = [];
  for (const char of run.text) {
    const ligature = metrics.ligatures[chars.at(-1)]?.[char];
    if (ligature) chars[chars.length - 1] = ligature;
    else chars.push(char);
  }
  let width = 0;
  for (const [i, char] of chars.entries()) {
    if (/\s/u.test(char)) width += space;
    else {
      const glyph = metrics.glyphs[char];
      if (!glyph) return null;
      width += (glyph[0] + (metrics.kern[chars[i - 1]]?.[char] || 0)) * size;
    }
  }
  return width;
}
