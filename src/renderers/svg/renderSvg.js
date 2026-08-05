import { parseMathText } from "../../tikz/textMetrics.js";
import { isEmptyNormalizedTikzText, normalizeTikzText } from "../../tikz/text.js";
import { computeSvgBounds } from "./bounds.js";
import { renderDecorationTextPath } from "./decorationText.js";
import { renderDefaultFontStyleDef } from "./defaultFontCss.js";
import { clipCircleId, clipRectId, collectSvgDefs, formOnlyPatternClipId } from "./defs.js";
import { createSvgView, renderSvgBackground, renderSvgDocument, svgViewBox } from "./document.js";
import { renderCircuitikzNodeBox } from "./circuitikzNodes.js";
import { renderCircleSplitNodeBox } from "./circleSplitNodes.js";
import { formatSvgNumber as format } from "./format.js";
import { renderImagePlaceholder } from "./imagePlaceholders.js";
import { scaleItemsForRenderUnit } from "./layout.js";
import { renderMarker } from "./markers.js";
import {
  normalizeKatexTex
} from "./mathFallbackSyntax.js";
import { escapeAttribute } from "./escape.js";
import { renderScopedMathStyleDef } from "./mathHtml.js";
import {
  estimateMathBox,
  renderMathNode
} from "./mathNode.js";
import {
  LIBRARY_NODE_SHAPES,
  renderCircleCrossSplitNodeBox,
  renderDiamondNodeBox,
  renderLibraryShapeNodeBox
} from "./nodeShapes.js";
import { renderMiscOutNodeBox, renderNodeBoxWithOverlay } from "./nodeOverlays.js";
import { renderPathElement } from "./paths.js";
import { hasRenderableFormOnlyPattern, renderFormOnlyPatternFill } from "./formOnlyPatterns.js";
import { renderPlainTextNode, renderPlainTextNodeWithTextEngine } from "./plainTextNode.js";
import { isRectangleSplitNodeShape, renderRectangleSplitNodeBox } from "./rectangleSplitNodes.js";
import { renderRichTextNode } from "./richTextNode.js";
import {
  styleAttributes
} from "./style.js";
import { formatTextLine, hasInlineMath, renderSvgTextLineContent } from "./textLineContent.js";
import { fitFontSizeToBox } from "./textFit.js";
import { applyTextContour } from "./textContour.js";
import { isTikzquadsNodeShape, renderTikzquadsNodeBox } from "./tikzquadsNodes.js";
import { wrapNodeRotation } from "./transforms.js";
import {
  TIKZ_MARGIN,
  TIKZ_UNIT
} from "../../tikz/metrics.js";

export function renderSvg(ir, options = {}) {
  const unit = options.unit || TIKZ_UNIT;
  const sourceMargin = Number(ir.previewBorder);
  const margin = options.margin ?? (Number.isFinite(sourceMargin) ? sourceMargin * unit : TIKZ_MARGIN);
  const items = scaleItemsForRenderUnit(ir.items || [], unit);
  const bounds = computeSvgBounds(items, options);
  const view = createSvgView(bounds, unit, margin);
  const viewBox = svgViewBox(view);

  const body = [];
  const defs = collectSvgDefs(items, unit);
  const defaultFontStyleDef = renderDefaultFontStyleDef({ fontUrlPrefix: options.fontUrlPrefix || "/fonts/" });
  const background = options.background === undefined ? "white" : options.background;
  body.push(renderSvgBackground(view, background));
  for (let index = 0; index < items.length; index += 1) {
    body.push(renderItem(items[index], unit, options, index));
  }
  if (body.some((line) => line && line.includes("tikzkit-math-scope"))) {
    defs.unshift(renderScopedMathStyleDef());
  }
  defs.unshift(defaultFontStyleDef);
  return renderSvgDocument(viewBox, body, defs, svgDocumentSize(view, unit));
}

function svgDocumentSize(view, unit) {
  const ptPerCm = 72 / 2.54;
  return {
    widthPt: (view.width / unit) * ptPerCm,
    heightPt: (view.height / unit) * ptPerCm
  };
}

function renderItem(item, unit, options = {}, index = 0) {
  if (item.type === "bbox") return "";
  if (item.type === "marker") return renderMarker(item, unit);
  if (item.type === "rasterImage") return renderRasterImage(item, unit);
  if (item.type === "nodeBox") {
    const circuitikzNodeBox = renderCircuitikzNodeBox(item, unit);
    if (circuitikzNodeBox) return renderNodeBoxWithOverlay(item, circuitikzNodeBox, unit);
    if (item.shape === "crossOut" || item.shape === "strikeOut") {
      return renderNodeBoxWithOverlay(item, renderMiscOutNodeBox(item, unit), unit);
    }
    if (item.shape === "circle" || item.shape === "ellipse") {
      return renderNodeBoxWithOverlay(item, `<ellipse cx="${format(item.x * unit)}" cy="${format(-item.y * unit)}" rx="${format(
        (item.width / 2) * unit
      )}" ry="${format((item.height / 2) * unit)}"${styleAttributes(item.style)} />`, unit);
    }
    if (item.shape === "circleSplit") return renderNodeBoxWithOverlay(item, renderCircleSplitNodeBox(item, unit), unit);
    if (item.shape === "circleCrossSplit") return renderNodeBoxWithOverlay(item, renderCircleCrossSplitNodeBox(item, unit), unit);
    if (item.shape === "diamond") return renderNodeBoxWithOverlay(item, renderDiamondNodeBox(item, unit), unit);
    if (LIBRARY_NODE_SHAPES.includes(item.shape)) {
      return renderNodeBoxWithOverlay(item, renderLibraryShapeNodeBox(item, unit), unit);
    }
    if (isTikzquadsNodeShape(item.shape)) {
      return renderTikzquadsNodeBox(item, unit, options, {
        estimateMathBox,
        formatTextLine,
        normalizeKatexTex,
        renderMathNode: (mathItem, math, renderUnit, renderOptions) =>
          renderMathNode(mathItem, math, renderUnit, renderOptions, { fitFontSizeToBox }),
        renderPlainTextNode
      });
    }
    if (isRectangleSplitNodeShape(item.shape)) return renderRectangleSplitNodeBox(item, unit);
    return renderNodeBoxWithOverlay(item, renderRectangleNodeBox(item, unit), unit);
  }
  if (item.type === "textNode") {
    if (item.subtype === "decoration-text" && Array.isArray(item.pathCommands) && item.pathCommands.length) {
      return renderDecorationTextPath(item, unit, index);
    }
    const normalized = normalizeTikzText(item.text, options);
    if (normalized.invisible) return "";
    if (isEmptyNormalizedTikzText(normalized)) return "";
    if (normalized.kind === "image") return renderImagePlaceholder(item, normalized, unit);
    const math = parseMathText(normalized.text);
    let rendered;
    if (math) {
      const mathScale = (normalized.scale || 1) * (math.scale || 1);
      rendered = renderMathNode(
        item,
        {
          ...math,
          scale: mathScale,
          color: normalized.color,
          fontWeight: normalized.fontWeight,
          explicitFontSize: normalized.explicitFontSize || math.explicitFontSize
        },
        unit,
        options,
        { fitFontSizeToBox }
      );
    }
    else if (options.mathRenderer !== "svg-text" && hasInlineMath(normalized)) {
      rendered = renderRichTextNode(item, normalized, unit, { fitFontSizeToBox, formatTextLine, renderSvgTextLineContent });
    }
    else {
      rendered =
        renderPlainTextNodeWithTextEngine(item, normalized, unit, options) ||
        renderPlainTextNode(item, normalized, unit, { fitFontSizeToBox, formatTextLine, renderSvgTextLineContent });
    }
    rendered = applyTextContour(rendered, normalized.raw || item.text);
    // Claude: 把节点的 rotate 作用到最终文本上（见 interpreter 的 nodeRotation）。
    return wrapNodeRotation(rendered, item, unit);
  }
  if (item.type === "path" && hasPathCommands(item)) {
    const rendered = hasRenderableFormOnlyPattern(item)
      ? `${renderFormOnlyPatternFill(item, unit, formOnlyPatternClipId(index))}${renderPathElement({
        ...item,
        style: { ...item.style, pattern: undefined, patternDefinition: undefined, fill: "none" }
      }, unit)}`
      : renderPathElement(item, unit);
    const clip = item.clipCircle
      ? clipCircleId(item.clipCircle)
      : item.clipRect
        ? clipRectId(item.clipRect)
        : null;
    return clip ? `<g clip-path="url(#${escapeAttribute(clip)})">${rendered}</g>` : rendered;
  }
  if (item.shape === "circle") {
    return `<circle cx="${format(item.cx * unit)}" cy="${format(-item.cy * unit)}" r="${format(
      item.r * unit
    )}"${styleAttributes(item.style)} />`;
  }
  if (item.shape === "ellipse") {
    return `<ellipse cx="${format(item.cx * unit)}" cy="${format(-item.cy * unit)}" rx="${format(
      item.rx * unit
    )}" ry="${format(item.ry * unit)}"${styleAttributes(item.style)} />`;
  }
  return "";
}

function renderRasterImage(item, unit) {
  const x = (Number(item.x) || 0) * unit;
  const y = -((Number(item.y) || 0) + (Number(item.height) || 0)) * unit;
  const width = Math.max(0, (Number(item.width) || 0) * unit);
  const height = Math.max(0, (Number(item.height) || 0) * unit);
  const href = String(item.href || "");
  const preserveAspectRatio = item.preserveAspectRatio || "none";
  const imageRendering = item.imageRendering ? ` image-rendering="${escapeAttribute(String(item.imageRendering))}"` : "";
  const opacity = Number.isFinite(Number(item.opacity)) ? ` opacity="${format(Number(item.opacity))}"` : "";
  return `<image class="tikz-raster-image" x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(
    height
  )}" href="${escapeAttribute(href)}" preserveAspectRatio="${escapeAttribute(preserveAspectRatio)}"${imageRendering}${opacity} />`;
}

function renderRectangleNodeBox(item, unit) {
  const inset = nodeBoxStrokeInset(item);
  const x = (item.x - item.width / 2) * unit + inset;
  const y = -(item.y + item.height / 2) * unit + inset;
  const width = Math.max(0, item.width * unit - inset * 2);
  const height = Math.max(0, item.height * unit - inset * 2);
  const radius = Math.min(Math.max(0, Number(item.rx) || 0) * unit, width / 2, height / 2);
  if (radius <= 0) {
    return `<rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(height)}"${styleAttributes(item.style)} />`;
  }
  const right = x + width;
  const bottom = y + height;
  const control = radius * 0.5522847498307936;
  const d = [
    `M ${format(right - radius)} ${format(y)}`,
    `L ${format(x + radius)} ${format(y)}`,
    `C ${format(x + radius - control)} ${format(y)} ${format(x)} ${format(y + radius - control)} ${format(x)} ${format(y + radius)}`,
    `L ${format(x)} ${format(bottom - radius)}`,
    `C ${format(x)} ${format(bottom - radius + control)} ${format(x + radius - control)} ${format(bottom)} ${format(x + radius)} ${format(bottom)}`,
    `L ${format(right - radius)} ${format(bottom)}`,
    `C ${format(right - radius + control)} ${format(bottom)} ${format(right)} ${format(bottom - radius + control)} ${format(right)} ${format(bottom - radius)}`,
    `L ${format(right)} ${format(y + radius)}`,
    `C ${format(right)} ${format(y + radius - control)} ${format(right - radius + control)} ${format(y)} ${format(right - radius)} ${format(y)}`,
    "Z"
  ].join(" ");
  return `<path class="tikz-node-box tikz-rounded-rectangle" d="${d}"${styleAttributes(item.style)} />`;
}

function nodeBoxStrokeInset(item) {
  const style = item.style || {};
  if (style.stroke === "none") return 0;
  const lineWidth = Number(style.lineWidth);
  return Number.isFinite(lineWidth) && lineWidth > 0 ? lineWidth / 2 : 0;
}

function hasPathCommands(item) {
  return Array.isArray(item.commands) && item.commands.length > 0;
}
