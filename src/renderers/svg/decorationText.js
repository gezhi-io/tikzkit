import { flattenPath, pathLength, pointAtLength } from "../../engine/geometry.js";
import { normalizeTikzText } from "../../tikz/text.js";
import { measurePlainTextTeXBoxPt } from "../../tikz/textMetrics.js";
import { TIKZ_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { textFontSizeForUnit } from "./layout.js";
import { formatTextLine } from "./textLineContent.js";
import { textFontScale } from "./textLayout.js";

export function renderDecorationTextPath(item, unit) {
  const normalized = normalizeTikzText(item.text);
  if (normalized.invisible) return "";
  const sourceLine = normalized.lines?.[0] || normalized.text || "";
  const formattedLine = formatTextLine(sourceLine);
  const fontSize = textFontSizeForUnit(unit) * (normalized.scale || 1) * textFontScale(item, normalized);
  const flat = flattenPath(item.pathCommands, 0.01);
  const totalLength = pathLength(flat);
  if (flat.length < 2 || totalLength <= 1e-9) return "";
  const color = escapeAttribute(normalized.color || item.style?.fill || "black");
  const fontFamily = escapeAttribute(item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY);
  const glyphs = decorationGlyphs(formattedLine);
  if (!glyphs.length) return "";
  const em = fontSize / unit;
  const textLength = glyphs.reduce((sum, glyph) => sum + em * glyph.advance, 0);
  let distance = Math.max(0, totalLength / 2 - textLength / 2);
  const raise = Math.max(0, Number(item.pathRaise) || 0);
  const rendered = [];
  for (const glyph of glyphs) {
    const advance = em * glyph.advance;
    const center = Math.min(totalLength, distance + advance / 2);
    if (glyph.text !== " ") {
      const point = pointAtLength(flat, totalLength > 0 ? center / totalLength : 0);
      const radians = (point.angle * Math.PI) / 180;
      const x = (point.x - Math.sin(radians) * raise) * unit;
      const y = -(point.y + Math.cos(radians) * raise) * unit;
      rendered.push(`<text class="tikz-decoration-glyph" x="${format(x)}" y="${format(y)}" fill="${color}" text-anchor="middle" dominant-baseline="alphabetic" xml:space="preserve" font-size="${format(
        fontSize
      )}" font-family="${fontFamily}" transform="rotate(${format(-point.angle)} ${format(x)} ${format(y)})">${escapeText(glyph.text)}</text>`);
    }
    distance += advance;
  }
  return `<g class="tikz-decoration-text">${rendered.join("")}</g>`;
}

function decorationGlyphs(text) {
  return String(text || "")
    .replace(/_([A-Za-z0-9])/g, (_match, value) => subscriptGlyph(value))
    .replace(/[{}]/g, "")
    .split("")
    .map((text) => ({ text, advance: decorationGlyphAdvance(text) }));
}

function decorationGlyphAdvance(glyph) {
  const texMetric = measurePlainTextTeXBoxPt(glyph, { fontSizePt: 10 });
  if (texMetric) return texMetric.width / 10;
  if (glyph === " ") return 0.3;
  if (/^[ilI|]$/.test(glyph)) return 0.22;
  if (/^[fjrt]$/.test(glyph)) return 0.32;
  if (/^[mw]$/.test(glyph)) return 0.62;
  if (/^[MW]$/.test(glyph)) return 0.78;
  if (/^[A-Z]$/.test(glyph)) return 0.58;
  if (/^[₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]$/.test(glyph)) return 0.28;
  if (".,;:!?()[]$/+*=<>-".includes(glyph)) return 0.28;
  return 0.48;
}

function subscriptGlyph(value) {
  const map = {
    "0": "₀",
    "1": "₁",
    "2": "₂",
    "3": "₃",
    "4": "₄",
    "5": "₅",
    "6": "₆",
    "7": "₇",
    "8": "₈",
    "9": "₉",
    a: "ₐ",
    e: "ₑ",
    h: "ₕ",
    i: "ᵢ",
    j: "ⱼ",
    k: "ₖ",
    l: "ₗ",
    m: "ₘ",
    n: "ₙ",
    o: "ₒ",
    p: "ₚ",
    r: "ᵣ",
    s: "ₛ",
    t: "ₜ",
    u: "ᵤ",
    v: "ᵥ",
    x: "ₓ"
  };
  return map[value] || `_${value}`;
}
