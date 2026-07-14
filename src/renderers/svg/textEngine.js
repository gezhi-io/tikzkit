import { measurePlainTextTeXBoxPt, parseMathText } from "../../tikz/textMetrics.js";
import { normalizeTikzText } from "../../tikz/text.js";
import {
  TIKZ_FONT_FAMILY,
  TIKZ_MONOSPACE_FONT_FAMILY,
  TIKZ_SANS_SERIF_FONT_FAMILY,
  TIKZ_TEXT_FONT_SIZE,
  TIKZ_UNIT
} from "../../tikz/metrics.js";
import { estimateMathBox, mathStyleScale, renderMathNode, scopedMathForeignObjectBox } from "./mathNode.js";
import { estimatePlainTextRenderBounds, renderPlainTextNode } from "./plainTextNode.js";
import { normalizedTextAlign } from "./textLayout.js";
import { formatTextLine, renderSvgTextLineContent } from "./textLineContent.js";

const TEX_PT_PER_CM = 28.4527559;

export function createSvgTextEngine(options = {}) {
  const unit = Number(options.unit) > 0 ? Number(options.unit) : TIKZ_UNIT;
  const mathRenderer = options.mathRenderer || "katex";
  const cache = new Map();

  return {
    validate() {
      return null;
    },
    measure(request = {}) {
      const parsedMath = parseTextEngineMathRequest(request);
      const entry = parsedMath
        ? measureMathRequest(parsedMath, request, unit, mathRenderer)
        : measurePlainTextRequest(request, unit);
      cache.set(entry.cacheKey, entry);
      return entry.metrics;
    },
    renderFromCache(cacheKey) {
      const entry = cache.get(String(cacheKey || ""));
      if (!entry) return null;
      return entry.payload();
    },
    async flushPending() {
      return [];
    }
  };
}

function parseTextEngineMathRequest(request) {
  const text = String(request.text ?? "").trim();
  const parsed = parseMathText(text);
  if (parsed) return parsed;
  if (request.mode === "math") {
    return {
      tex: text.replace(/^\$|\$$/g, ""),
      displayMode: Boolean(request.displayMode),
      scale: 1,
      explicitFontSize: null
    };
  }
  return null;
}

function measureMathRequest(math, request, unit, mathRenderer) {
  const font = textEngineFont(request);
  const contentSizeAlreadyResolved = Boolean(request.font && math.explicitFontSize);
  const requestedScale = textEngineFontScale(request) * (contentSizeAlreadyResolved ? 1 : math.scale || 1);
  const effectiveScale = requestedScale * mathStyleScale(math.tex);
  const box = estimateMathBox(math.tex, math.displayMode, unit, effectiveScale);
  const renderBox = mathRenderer === "svg-text" ? box : scopedMathForeignObjectBox(box, math.displayMode, math.tex);
  const color = request.color || "black";
  const fontFamily = textEngineRenderFontFamily(font.family);
  const fontStyle = font.style;
  const fontWeight = font.weight;
  const cacheKey = textEngineCacheKey("math", {
    tex: math.tex,
    displayMode: math.displayMode,
    requestedScale,
    unit,
    mathRenderer,
    color,
    fontFamily,
    fontStyle,
    fontWeight,
    baselineSkipPt: font.baselineSkipPt
  });
  const metrics = {
    cacheKey,
    width: renderBox.width,
    height: renderBox.height,
    baselineY: renderBox.height * 0.62,
    midLineY: renderBox.height / 2,
    paragraphId: null,
    renderSourceText: math.tex,
    ...textEngineFontMetrics(font)
  };
  return {
    cacheKey,
    metrics,
    payload: () => {
      const item = {
        type: "textNode",
        x: 0,
        y: 0,
        text: `$${math.tex}$`,
        style: {
          fill: color,
          fontFamily,
          fontStyle,
          fontWeight
        },
        font
      };
      const body = renderMathNode(item, { ...math, scale: requestedScale }, unit, { mathRenderer });
      return {
        cacheKey,
        viewBox: centeredViewBox(renderBox.width, renderBox.height),
        body
      };
    }
  };
}

function measurePlainTextRequest(request, unit) {
  const normalized = normalizeTikzText(String(request.text ?? ""));
  const font = textEngineFont(request);
  const alignment = normalizedTextAlign(request.alignment);
  const color = request.color || "black";
  const fontFamily = textEngineRenderFontFamily(font.family);
  const fontStyle = normalTextAttribute(font.style);
  const fontWeight = normalTextAttribute(font.weight);
  const item = {
    type: "textNode",
    x: 0,
    y: 0,
    text: normalized.text,
    textAlign: alignment,
    font,
    style: {
      fill: color,
      fontFamily,
      fontScale: textEngineFontScale(request),
      fontStyle,
      fontWeight
    },
    wrapWidth: textWidthPtToCm(request.textWidthPt)
  };
  const estimated = estimatePlainTextRenderBounds(item, normalized, unit, {
    formatTextLine
  });
  const renderWidth = estimated.width * unit;
  const renderHeight = estimated.height * unit;
  const logical = logicalPlainTextBox(request, normalized, fontFamily, fontStyle, fontWeight);
  const width = logical ? (logical.width / TEX_PT_PER_CM) * unit : renderWidth;
  const height = logical ? ((logical.height + logical.depth) / TEX_PT_PER_CM) * unit : renderHeight;
  const baselineY = logical ? (logical.height / TEX_PT_PER_CM) * unit : height * 0.62;
  const cacheKey = textEngineCacheKey("plain", {
    text: normalized.text,
    unit,
    width: renderWidth,
    height: renderHeight,
    fontScale: item.style.fontScale,
    color,
    fontFamily,
    fontStyle: fontStyle || null,
    fontWeight: fontWeight || null,
    alignment,
    textWidthPt: request.textWidthPt ?? null
  });
  const metrics = {
    cacheKey,
    width,
    height,
    baselineY,
    midLineY: height / 2,
    paragraphId: null,
    renderSourceText: normalized.text,
    ...textEngineFontMetrics(font),
    ...(logical ? { measurementKind: "tex-box" } : {})
  };
  return {
    cacheKey,
    metrics,
    payload: () => ({
      cacheKey,
      viewBox: centeredViewBox(renderWidth, renderHeight),
      body: renderPlainTextNode(item, normalized, unit, {
        formatTextLine,
        renderSvgTextLineContent
      })
    })
  };
}

function logicalPlainTextBox(request, normalized, fontFamily, fontStyle, fontWeight) {
  const raw = String(request.text ?? "");
  const textWidthPt = Number(request.textWidthPt);
  if (Number.isFinite(textWidthPt) && textWidthPt > 0) return null;
  if (/[\r\n\\$]/.test(raw)) return null;
  if (fontStyle || fontWeight || normalized.fontStyle || normalized.fontWeight || normalized.fontVariant) return null;
  if (normalized.explicitFontSize || Number(normalized.scale) !== 1) return null;
  if (!isMainRegularFontFamily(fontFamily) || !isMainRegularFontFamily(normalized.fontFamily)) return null;
  if (!Array.isArray(normalized.lines) || normalized.lines.length !== 1) return null;
  const lineStyle = normalized.lineStyles?.[0];
  if (lineStyle && (lineStyle.fontStyle || lineStyle.fontWeight || lineStyle.fontVariant || Number(lineStyle.scale) !== 1)) return null;
  const fontSizePt = textFontSizePt() * textEngineFontScale(request);
  return measurePlainTextTeXBoxPt(normalized.text, { fontSizePt });
}

function isMainRegularFontFamily(value) {
  const family = String(value || "").trim();
  return !family || family === "serif" || family === TIKZ_FONT_FAMILY || /^['"]?KaTeX_Main['"]?(?:\s*,|$)/.test(family);
}

function normalTextAttribute(value) {
  const text = String(value || "").trim();
  return text && text !== "normal" && text !== "400" ? text : undefined;
}

function textEngineFontScale(request = {}) {
  const fontSizePt = Number(request.font?.sizePt ?? request.fontSizePt);
  if (!Number.isFinite(fontSizePt) || fontSizePt <= 0) return 1;
  return fontSizePt / textFontSizePt();
}

function textEngineFont(request = {}) {
  const requested = request.font && typeof request.font === "object" ? request.font : {};
  const sizePt = finitePositive(requested.sizePt) || finitePositive(request.fontSizePt) || textFontSizePt();
  const baselineSkipPt = finitePositive(requested.baselineSkipPt) || sizePt * 1.2;
  return {
    sizePt,
    baselineSkipPt,
    family: requested.family || request.fontFamily || TIKZ_FONT_FAMILY,
    weight: requested.weight ?? request.fontWeight ?? "normal",
    style: requested.style || request.fontStyle || "normal",
    variant: requested.variant || "normal",
    mathStyle: requested.mathStyle || "text",
    source: requested.source || "legacy-request"
  };
}

function textEngineFontMetrics(font) {
  return {
    fontSizePt: font.sizePt,
    baselineSkipPt: font.baselineSkipPt,
    fontFamily: font.family,
    fontWeight: font.weight,
    fontStyle: font.style
  };
}

function textEngineRenderFontFamily(family) {
  if (family === "sans-serif") return TIKZ_SANS_SERIF_FONT_FAMILY;
  if (family === "monospace") return TIKZ_MONOSPACE_FONT_FAMILY;
  if (!family || family === "serif") return TIKZ_FONT_FAMILY;
  return family;
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function textFontSizePt() {
  return (TIKZ_TEXT_FONT_SIZE / TIKZ_UNIT) * 28.4527559;
}

function textWidthPtToCm(textWidthPt) {
  const width = Number(textWidthPt);
  return Number.isFinite(width) && width > 0 ? width / TEX_PT_PER_CM : undefined;
}

function centeredViewBox(width, height) {
  return {
    x: -width / 2,
    y: -height / 2,
    width,
    height
  };
}

function textEngineCacheKey(kind, value) {
  return `svg-text-engine:${kind}:${hashString(JSON.stringify(value))}`;
}

function hashString(value) {
  let hash = 5381;
  for (const char of String(value)) {
    hash = ((hash << 5) + hash) ^ char.codePointAt(0);
  }
  return (hash >>> 0).toString(36);
}
