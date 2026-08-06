import { measurePlainTextTeXBoxPt, parseMathText } from "../../tikz/textMetrics.js";
import { normalizeTikzText } from "../../tikz/text.js";
import {
  TIKZ_FONT_FAMILY,
  TIKZ_HELVETICA_FONT_FAMILY,
  TIKZ_MONOSPACE_FONT_FAMILY,
  TIKZ_SANS_SERIF_FONT_FAMILY,
  TIKZ_TEXT_FONT_SIZE,
  TIKZ_UNIT
} from "../../tikz/metrics.js";
import { measureMathBoxPt, renderMathNode, scopedMathForeignObjectBox } from "./mathNode.js";
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
        : measurePlainTextRequest(request, unit, mathRenderer);
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
  const tex = mathTexForFontStyle(math.tex, font.mathStyle);
  const contentSizeAlreadyResolved = Boolean(request.font && math.explicitFontSize);
  const contentScale = contentSizeAlreadyResolved ? 1 : math.scale || 1;
  const requestedScale = textEngineFontScale(request) * contentScale;
  const physicalBox = measureMathBoxPt(tex, {
    font,
    displayMode: math.displayMode,
    renderer: mathRenderer,
    scale: contentScale
  });
  const pointsToRenderUnits = unit / TEX_PT_PER_CM;
  const renderBox = {
    width: physicalBox.widthPt * pointsToRenderUnits,
    height: (physicalBox.heightPt + physicalBox.depthPt) * pointsToRenderUnits
  };
  const htmlBoxPt = scopedMathForeignObjectBox(
    {
      fontSize: physicalBox.svgFontSize,
      width: physicalBox.rawWidthPt,
      height: physicalBox.rawHeightPt
    },
    math.displayMode,
    tex
  );
  const payloadBox = mathRenderer === "svg-text"
    ? renderBox
    : {
        width: htmlBoxPt.width * pointsToRenderUnits,
        height: htmlBoxPt.height * pointsToRenderUnits
      };
  const color = request.color || "black";
  const fontFamily = textEngineRenderFontFamily(font.family);
  const fontStyle = font.style;
  const fontWeight = font.weight;
  const cacheKey = textEngineCacheKey("math", {
    tex,
    displayMode: math.displayMode,
    requestedScale,
    unit,
    mathRenderer,
    color,
    fontFamily,
    fontStyle,
    fontWeight,
    fontVariant: font.variant,
    mathStyle: font.mathStyle,
    mathVersion: font.mathVersion,
    baselineSkipPt: font.baselineSkipPt
  });
  const metrics = {
    cacheKey,
    width: renderBox.width,
    height: renderBox.height,
    baselineY: physicalBox.baselinePt * pointsToRenderUnits,
    midLineY: renderBox.height / 2,
    paragraphId: null,
    renderSourceText: tex,
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
        text: `$${tex}$`,
        style: {
          fill: color,
          fontFamily,
          fontStyle,
          fontWeight
        },
        font
      };
      const body = renderMathNode(item, { ...math, tex, scale: contentScale }, unit, { mathRenderer });
      return {
        cacheKey,
        viewBox: centeredViewBox(payloadBox.width, payloadBox.height),
        body
      };
    }
  };
}

function measurePlainTextRequest(request, unit, mathRenderer) {
  // SVG-text math owns constructs such as array's @{...} preamble. Keep the
  // normalization mode identical to the main renderer so cached text cannot
  // silently flatten a structured formula during tikzToSvgAsync().
  const normalized = normalizeTikzText(String(request.text ?? ""), { mathRenderer });
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
    textWrapMode: request.lineBreakMode,
    textWrapHyphenation: request.hyphenate,
    font,
    style: {
      fill: color,
      fontFamily,
      fontScale: textEngineFontScale(request),
      fontStyle,
      fontWeight,
      textWidthScale: request.textWidthScale,
      textWidthScaleExplicit: Boolean(request.textWidthScaleExplicit)
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
    mathRenderer,
    width: renderWidth,
    height: renderHeight,
    fontScale: item.style.fontScale,
    color,
    fontFamily,
    fontStyle: fontStyle || null,
    fontWeight: fontWeight || null,
    fontVariant: font.variant,
    mathStyle: font.mathStyle,
    textStyle: normalizedTextRenderStyleSignature(normalized),
    alignment,
    lineBreakMode: request.lineBreakMode || null,
    hyphenate: request.hyphenate === false ? false : null,
    textWidthPt: request.textWidthPt ?? null,
    textWidthScale: request.textWidthScaleExplicit ? request.textWidthScale : null
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

function normalizedTextRenderStyleSignature(normalized = {}) {
  return {
    scale: finiteStyleScale(normalized.scale),
    family: normalized.fontFamily || null,
    weight: normalized.fontWeight ?? null,
    style: normalized.fontStyle || null,
    variant: normalized.fontVariant || null,
    lines: (Array.isArray(normalized.lineStyles) ? normalized.lineStyles : []).map((line = {}) => ({
      scale: finiteStyleScale(line.scale),
      family: line.fontFamily || null,
      weight: line.fontWeight ?? null,
      style: line.fontStyle || null,
      variant: line.fontVariant || null,
      segments: (Array.isArray(line.fontSegments) ? line.fontSegments : []).map((segment = {}) => ({
        text: String(segment.text ?? ""),
        scale: finiteStyleScale(segment.scale),
        family: segment.family || null,
        weight: segment.weight ?? null,
        style: segment.style || null,
        variant: segment.variant || null
      }))
    }))
  };
}

function finiteStyleScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function logicalPlainTextBox(request, normalized, fontFamily, fontStyle, fontWeight) {
  const raw = String(request.text ?? "");
  const textWidthPt = Number(request.textWidthPt);
  if (Number.isFinite(textWidthPt) && textWidthPt > 0) return null;
  if (/[\r\n\\$]/.test(raw)) return null;
  if (fontStyle || fontWeight || normalized.fontStyle || normalized.fontWeight || normalized.fontVariant) return null;
  if (normalized.explicitFontSize || Number(normalized.scale) !== 1) return null;
  const sans = isSansSerifFontFamily(fontFamily);
  if (!sans && (!isMainRegularFontFamily(fontFamily) || !isMainRegularFontFamily(normalized.fontFamily))) return null;
  if (sans && normalized.fontFamily && !isSansSerifFontFamily(normalized.fontFamily)) return null;
  if (!Array.isArray(normalized.lines) || normalized.lines.length !== 1) return null;
  const lineStyle = normalized.lineStyles?.[0];
  if (lineStyle && (lineStyle.fontStyle || lineStyle.fontWeight || lineStyle.fontVariant || Number(lineStyle.scale) !== 1)) return null;
  const fontSizePt = textFontSizePt() * textEngineFontScale(request);
  const box = measurePlainTextTeXBoxPt(normalized.text, {
    fontSizePt,
    fontFamily: sans ? "sans-serif" : "serif"
  });
  return box;
}

function isMainRegularFontFamily(value) {
  const family = String(value || "").trim();
  return !family || family === "serif" || family === TIKZ_FONT_FAMILY || /^['"]?KaTeX_Main['"]?(?:\s*,|$)/.test(family);
}

function isPhysicalSerifFamily(value) {
  const family = String(value || "").trim();
  return family === TIKZ_FONT_FAMILY || /(?:TikZKitCMR|TikZKitCMUSerif|KaTeX_Main|CMU Serif)/.test(family);
}

function isSansSerifFontFamily(value) {
  return /(?:CMUSans|sans-serif|sans\b|Helvetica|Arial)/i.test(String(value || ""));
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
    // The generic default `serif` does not name a physical face. Preserve a
    // caller's CMR design-size family for that case, while explicit semantic
    // choices such as sans-serif and helvetica remain authoritative.
    family: requested.family && requested.family !== "serif"
      ? requested.family
      : isPhysicalSerifFamily(request.fontFamily)
        ? request.fontFamily
        : requested.family || request.fontFamily || TIKZ_FONT_FAMILY,
    weight: requested.weight ?? request.fontWeight ?? "normal",
    style: requested.style || request.fontStyle || "normal",
    variant: requested.variant || "normal",
    mathStyle: requested.mathStyle || "text",
    mathVersion: requested.mathVersion === "bold" || requested.mathVersion === "sans"
      ? requested.mathVersion
      : "normal",
    source: requested.source || "legacy-request"
  };
}

function textEngineFontMetrics(font) {
  return {
    fontSizePt: font.sizePt,
    baselineSkipPt: font.baselineSkipPt,
    fontFamily: font.family,
    fontWeight: font.weight,
    fontStyle: font.style,
    fontVariant: font.variant,
    mathStyle: font.mathStyle,
    mathVersion: font.mathVersion
  };
}

function mathTexForFontStyle(tex, mathStyle) {
  const source = String(tex || "");
  if (/\\(?:display|text|script|scriptscript)style(?![A-Za-z])/.test(source)) return source;
  if (mathStyle === "display") return `\\displaystyle ${source}`;
  if (mathStyle === "script") return `\\scriptstyle ${source}`;
  if (mathStyle === "scriptscript") return `\\scriptscriptstyle ${source}`;
  return source;
}

function textEngineRenderFontFamily(family) {
  if (family === "helvetica") return TIKZ_HELVETICA_FONT_FAMILY;
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
