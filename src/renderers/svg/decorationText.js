import { flattenPath, pathLength, pointAtLength } from "../../engine/geometry.js";
import { mathFallbackText, normalizeTikzText, splitInlineMathSegments } from "../../tikz/text.js";
import { estimateFormulaBox, measurePlainTextTeXBoxPt } from "../../tikz/textMetrics.js";
import { TIKZ_FONT_FAMILY, TIKZ_MATH_ITALIC_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { renderUnitScale, textFontSizeForUnit } from "./layout.js";
import { formatTextLine } from "./textLineContent.js";
import { scriptedMathFallback } from "./mathScriptFallback.js";
import { svgPaint } from "./style.js";
import { textFontScale } from "./textLayout.js";

export function renderDecorationTextPath(item, unit) {
  const normalized = normalizeTikzText(item.text);
  if (normalized.invisible) return "";
  const sourceLine = normalized.lines?.[0] || normalized.text || "";
  // The display-normalized line intentionally drops ordinary TeX braces.
  // Decorations need the raw braces because PGF gives an explicit group one
  // positionable text box instead of scanning it character by character.
  const rawSourceLine = normalized.raw || sourceLine;
  const formattedLine = formatTextLine(sourceLine);
  const fontSize = textFontSizeForUnit(unit) * (normalized.scale || 1) * textFontScale(item, normalized);
  const flat = flattenPath(item.pathCommands, 0.01);
  const totalLength = pathLength(flat);
  if (flat.length < 2 || totalLength <= 1e-9) return "";
  const color = escapeAttribute(normalized.color || item.style?.fill || "black");
  const fontFamily = escapeAttribute(item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY);
  const glyphs = decorationGlyphs(rawSourceLine, formattedLine, unit, fontSize, item.pathTextCharacterReplacements);
  if (item.pathTextReverse) glyphs.reverse();
  if (!glyphs.length) return "";
  const em = fontSize / unit;
  const textLength = glyphs.reduce((sum, glyph) => sum + em * glyph.advance, 0);
  let distance = decorationTextStartDistance(item, totalLength, textLength);
  const fitShift = decorationTextFitShift(item, glyphs, totalLength, textLength);
  const raise = finiteDistance(item.pathRaise);
  const rendered = [];
  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index];
    const advance = em * glyph.advance;
    const center = Math.min(totalLength, distance + advance / 2);
    if (glyph.text !== " " || glyph.replacement) {
      const point = pointAtLength(flat, totalLength > 0 ? center / totalLength : 0);
      const radians = (point.angle * Math.PI) / 180;
      const normalOffset = raise + glyph.normalOffset;
      const x = (point.x - Math.sin(radians) * normalOffset) * unit;
      const y = -(point.y + Math.cos(radians) * normalOffset) * unit;
      if (glyph.replacement?.type === "circle") {
        rendered.push(renderDecorationReplacementCircle(glyph.replacement, x, y, unit));
      } else {
        const glyphFontSize = fontSize * glyph.fontScale;
        const glyphFontFamily = escapeAttribute(glyph.fontFamily || fontFamily);
        const fontStyle = glyph.fontStyle ? ` font-style="${glyph.fontStyle}"` : "";
        const className = glyph.kind === "math-box" ? "tikz-decoration-math-box" : "tikz-decoration-glyph";
        const content = glyph.kind === "math-box" ? renderDecorationMathBoxContent(glyph.tex, glyphFontSize) : escapeText(glyph.text);
        rendered.push(`<text class="${className}" x="${format(x)}" y="${format(y)}" fill="${color}" text-anchor="middle" dominant-baseline="alphabetic" xml:space="preserve" font-size="${format(
          glyphFontSize
        )}" font-family="${glyphFontFamily}"${fontStyle} transform="rotate(${format(-point.angle)} ${format(x)} ${format(y)})">${content}</text>`);
      }
    }
    distance += advance;
    if (index + 1 < glyphs.length) distance += fitShift(glyph);
  }
  return `<g class="tikz-decoration-text">${rendered.join("")}</g>`;
}

function renderDecorationReplacementCircle(replacement, x, y, unit) {
  const radius = Math.max(0, finiteDistance(replacement.radius)) * unit;
  const lineWidth = Math.max(0, finiteDistance(replacement.lineWidth)) * renderUnitScale(unit);
  const opacity = Number.isFinite(replacement.opacity) ? ` opacity="${format(replacement.opacity)}"` : "";
  const fillOpacity = Number.isFinite(replacement.fillOpacity) ? ` fill-opacity="${format(replacement.fillOpacity)}"` : "";
  const strokeOpacity = Number.isFinite(replacement.strokeOpacity) ? ` stroke-opacity="${format(replacement.strokeOpacity)}"` : "";
  return `<circle class="tikz-decoration-replacement" cx="${format(x)}" cy="${format(y)}" r="${format(radius)}" fill="${escapeAttribute(
    svgPaint(replacement.fill || "none")
  )}" stroke="${escapeAttribute(svgPaint(replacement.stroke || "none"))}" stroke-width="${format(lineWidth)}"${opacity}${fillOpacity}${strokeOpacity} />`;
}

function decorationTextStartDistance(item, totalLength, textLength) {
  const leftIndent = finiteDistance(item.pathLeftIndent);
  const rightIndent = finiteDistance(item.pathRightIndent);
  const align = String(item.pathTextAlign || "left").trim().toLowerCase();

  if (align === "right") return totalLength - rightIndent - textLength;
  if (align === "center") return leftIndent + (totalLength - leftIndent - rightIndent - textLength) / 2;
  return leftIndent;
}

function decorationTextFitShift(item, glyphs, totalLength, textLength) {
  if (!item.pathTextFitToPath) return () => 0;
  const leftIndent = finiteDistance(item.pathLeftIndent);
  const rightIndent = finiteDistance(item.pathRightIndent);
  const availableLength = totalLength - leftIndent - rightIndent;
  const extra = availableLength - textLength;
  if (extra < 0) return () => 0;

  if (item.pathTextFitToPathStretchingSpaces) {
    const spaces = glyphs.filter((glyph) => glyph.text === " ").length;
    if (!spaces) return () => 0;
    const shift = extra / spaces;
    return (glyph) => glyph.text === " " ? shift : 0;
  }

  const gaps = glyphs.length - 1;
  if (gaps <= 0) return () => 0;
  const shift = extra / gaps;
  return () => shift;
}

function finiteDistance(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decorationGlyphs(source, formattedLine, unit, fontSize, replacements = {}) {
  const segments = splitInlineMathSegments(String(source || ""));
  if (!segments.some((segment) => segment.type === "math")) return plainDecorationGlyphs(formattedLine, replacements);
  const glyphs = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment.type !== "math") {
      glyphs.push(...plainDecorationGlyphs(formatTextLine(segment.text), replacements));
      continue;
    }

    const previous = segments[index - 1];
    const following = segments[index + 1];
    const grouped = previous?.type === "text" && following?.type === "text" && previous.text.endsWith("{") && following.text.startsWith("}");
    if (!grouped) {
      // Unbraced math is scanned atom-by-atom by PGF. Preserve the existing
      // simple fallback here; explicit groups are the TeX boxes below.
      glyphs.push(...plainDecorationGlyphs(formatTextLine(segment.raw), replacements));
      continue;
    }

    const trailingBrace = glyphs.pop();
    if (trailingBrace?.text !== "{") glyphs.push(trailingBrace);
    glyphs.push(mathDecorationBox(segment.tex, unit, fontSize));
    segments[index + 1] = { ...following, text: following.text.slice(1) };
  }
  return glyphs;
}

function plainDecorationGlyphs(text, replacements = {}) {
  return String(text || "")
    .replace(/[{}]/g, "")
    .split("")
    .map((text) => baseDecorationGlyph(text, replacements));
}

function mathDecorationBox(tex, unit, fontSize) {
  const formula = estimateFormulaBox(tex, { texTextMetrics: true, minWidth: 0, widthPadding: 0 });
  const advance = formula.width / Math.max(1e-9, fontSize / unit);
  return {
    kind: "math-box",
    tex,
    text: mathFallbackText(tex),
    advance,
    fontScale: 1,
    normalOffset: 0,
    fontFamily: TIKZ_MATH_ITALIC_FONT_FAMILY,
    fontStyle: "italic"
  };
}

function renderDecorationMathBoxContent(tex, fontSize) {
  const scripts = scriptedMathFallback(tex, { allowSimpleScripts: true });
  if (!scripts) return escapeText(mathFallbackText(tex));
  const scriptSize = fontSize * 0.66;
  return scripts
    .map((segment) => {
      if (segment.kind === "text") return escapeText(mathFallbackText(segment.text));
      if (segment.kind !== "script") return "";
      const base = escapeText(mathFallbackText(segment.base));
      const superscript = segment.superscript
        ? `<tspan font-size="${format(scriptSize)}" baseline-shift="super">${escapeText(mathFallbackText(segment.superscript))}</tspan>`
        : "";
      const subscript = segment.subscript
        ? `<tspan font-size="${format(scriptSize)}" baseline-shift="sub">${escapeText(mathFallbackText(segment.subscript))}</tspan>`
        : "";
      return `${base}${superscript}${subscript}`;
    })
    .join("");
}

function baseDecorationGlyph(text, replacements = {}) {
  return {
    text,
    advance: decorationGlyphAdvance(text),
    fontScale: 1,
    normalOffset: 0,
    fontFamily: "",
    fontStyle: "",
    replacement: replacements?.[text] || null
  };
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
