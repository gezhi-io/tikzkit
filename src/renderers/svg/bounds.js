import { includePathCommandBounds } from "../../scene/index.js";
import { isEmptyNormalizedTikzText, mathFallbackText, normalizeTikzText } from "../../tikz/text.js";
import { parseMathText } from "../../tikz/textMetrics.js";
import { TIKZ_UNIT } from "../../tikz/metrics.js";
import { imagePlaceholderScale } from "./imagePlaceholders.js";
import { estimateMathBox, mathStyleScale, measureMathBoxPt } from "./mathNode.js";
import { estimatePlainTextRenderBounds } from "./plainTextNode.js";
import { estimateRichTextRenderBounds } from "./richTextNode.js";
import { fitFontSizeToBox } from "./textFit.js";
import { formatTextLine, hasInlineMath } from "./textLineContent.js";
import { svgTextAnchorForItem, textFontScale } from "./textLayout.js";
import { pathTerminalSegments, resolveInlineArrowTip } from "./paths.js";

export function computeSvgBounds(items, options = {}) {
  const unit = options.unit || TIKZ_UNIT;
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  for (const item of items) {
    if (item.overlay || item.excludeFromBounds) continue;
    if (item.type === "nodeBox") {
      const strokePad = nodeBoxStrokePadding(item, unit);
      includeRotatedRectangleBounds(
        item.x - item.width / 2 - strokePad,
        item.y - item.height / 2 - strokePad,
        item.x + item.width / 2 + strokePad,
        item.y + item.height / 2 + strokePad,
        item.rotation,
        item.x,
        item.y,
        include
      );
      for (const shadow of item.shadows || []) {
        const scale = Number(shadow.scale) > 0 ? Number(shadow.scale) : 1;
        const blurPad = shadow.blur ? (Number(shadow.blurRadius) || 0.06) * 3 : 0;
        const sx = item.x + (Number(shadow.xshift) || 0);
        const sy = item.y + (Number(shadow.yshift) || 0);
        const sw = item.width * scale;
        const sh = item.height * scale;
        includeRotatedRectangleBounds(
          sx - sw / 2 - blurPad,
          sy - sh / 2 - blurPad,
          sx + sw / 2 + blurPad,
          sy + sh / 2 + blurPad,
          item.rotation,
          item.x,
          item.y,
          include
        );
      }
    } else if ((item.type === "path" || item.type === "bbox") && hasPathCommands(item)) {
      includePathBounds(item, include, unit);
    } else if (item.shape === "circle") {
      include(item.cx - item.r, item.cy - item.r);
      include(item.cx + item.r, item.cy + item.r);
    } else if (item.shape === "ellipse") {
      include(item.cx - item.rx, item.cy - item.ry);
      include(item.cx + item.rx, item.cy + item.ry);
    } else if (item.type === "rasterImage") {
      const x = Number(item.x) || 0;
      const y = Number(item.y) || 0;
      const width = Number(item.width) || 0;
      const height = Number(item.height) || 0;
      include(x, y);
      include(x + width, y + height);
    } else if (item.type === "textNode") {
      if (item.subtype === "decoration-text" && hasPathCommands({ commands: item.pathCommands })) {
        includePathBounds({ type: "path", commands: item.pathCommands, style: item.style || {} }, include, unit);
        continue;
      }
      const normalized = normalizeTikzText(item.text, options);
      if (normalized.invisible) continue;
      if (isEmptyNormalizedTikzText(normalized)) continue;
      if (normalized.kind === "image") {
        const scale = imagePlaceholderScale(item, normalized);
        include(item.x - (normalized.width * scale) / 2, item.y - (normalized.height * scale) / 2);
        include(item.x + (normalized.width * scale) / 2, item.y + (normalized.height * scale) / 2);
        continue;
      }
      const math = parseMathText(normalized.text);
      if (math) {
        const mathVersion = item?.font?.mathVersion === "bold" ? "bold" : "normal";
        const contentScale = (normalized.scale || 1) * (math.scale || 1) * textFontScale(item, math);
        const scale = contentScale * mathStyleScale(math.tex, 10 * contentScale);
        const box = estimateMathBox(math.tex, math.displayMode, unit, scale, { mathVersion });
        const originalFontSize = box.fontSize;
        box.fontSize = fitFontSizeToBox(box.fontSize, item.fitBox, unit, [mathFallbackText(math.tex)]);
        const fitScale = originalFontSize > 0 ? box.fontSize / originalFontSize : 1;
        const hasResolvedFont = Number.isFinite(Number(item?.font?.sizePt)) && Number(item.font.sizePt) > 0;
        const physicalBox = measureMathBoxPt(math.tex, {
          font: hasResolvedFont ? item.font : undefined,
          mathVersion,
          displayMode: math.displayMode,
          renderer: options.mathRenderer,
          scale: (hasResolvedFont ? 1 : contentScale) * (Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1)
        });
        const usePaintBox = options.mathRenderer === "svg-text";
        const widthPt = usePaintBox ? physicalBox.paintWidthPt : physicalBox.widthPt;
        const heightPt = usePaintBox
          ? physicalBox.paintHeightPt
          : physicalBox.heightPt + physicalBox.depthPt;
        const width = widthPt / 28.4527559;
        const height = heightPt / 28.4527559;
        includeTextRenderBounds(item, width, height, include);
      } else if (options.mathRenderer !== "svg-text" && hasInlineMath(normalized)) {
        const { width, height } = estimateRichTextRenderBounds(item, normalized, unit, { formatTextLine });
        includeTextRenderBounds(item, width, height, include);
      } else {
        const { width, height } = estimatePlainTextRenderBounds(item, normalized, unit, { fitFontSizeToBox, formatTextLine });
        includeTextRenderBounds(item, width, height, include);
      }
      includeTextNodeLayoutBounds(item, include);
    } else if (item.type === "marker") {
      include(item.x, item.y);
    }
  }

  if (!Number.isFinite(bounds.minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  if (bounds.minX === bounds.maxX) bounds.maxX += 1;
  if (bounds.minY === bounds.maxY) bounds.maxY += 1;
  return bounds;
}

function includeTextNodeLayoutBounds(item, include) {
  const width = Number(item.nodeLayoutWidth);
  const height = Number(item.nodeLayoutHeight);
  if (!(width > 0) || !(height > 0)) return;
  includeRotatedRectangleBounds(
    item.x - width / 2,
    item.y - height / 2,
    item.x + width / 2,
    item.y + height / 2,
    item.rotation,
    item.x,
    item.y,
    include
  );
}

export function includeTextRenderBounds(item, width, height, include) {
  const anchor = svgTextAnchorForItem(item);
  const rawAnchorX = Number(item.svgTextX);
  const anchorX = anchor ? (Number.isFinite(rawAnchorX) ? rawAnchorX : item.x) : item.x;
  let minX = anchorX - width / 2;
  let maxX = anchorX + width / 2;
  if (anchor === "start") {
    minX = anchorX;
    maxX = anchorX + width;
  } else if (anchor === "end") {
    minX = anchorX - width;
    maxX = anchorX;
  }
  includeRotatedRectangleBounds(
    minX,
    item.y - height / 2,
    maxX,
    item.y + height / 2,
    item.rotation,
    item.x,
    item.y,
    include
  );
}

function includeRotatedRectangleBounds(minX, minY, maxX, maxY, rotation, originX, originY, include) {
  const angle = Number(rotation) || 0;
  if (Math.abs(angle % 360) < 1e-12) {
    include(minX, minY);
    include(maxX, maxY);
    return;
  }
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  for (const [x, y] of [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]) {
    const dx = x - originX;
    const dy = y - originY;
    include(originX + dx * cos - dy * sin, originY + dx * sin + dy * cos);
  }
}

function includePathBounds(item, include, unit) {
  const pathBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const includeLocal = (x, y) => {
    pathBounds.minX = Math.min(pathBounds.minX, x);
    pathBounds.minY = Math.min(pathBounds.minY, y);
    pathBounds.maxX = Math.max(pathBounds.maxX, x);
    pathBounds.maxY = Math.max(pathBounds.maxY, y);
  };
  includePathCommandBounds(item.commands || [], includeLocal, { tightBezierBounds: item.tightBezierBounds });
  if (!Number.isFinite(pathBounds.minX)) return;
  const pad = item.type === "path" || item.includeStrokeBounds ? pathStrokePadding(item, unit) : 0;
  const paintedBounds = {
    minX: pathBounds.minX - pad,
    minY: pathBounds.minY - pad,
    maxX: pathBounds.maxX + pad,
    maxY: pathBounds.maxY + pad
  };
  const clippedBounds = intersectPathClipBounds(paintedBounds, item.clipRect);
  if (!clippedBounds) return;
  include(clippedBounds.minX, clippedBounds.minY);
  include(clippedBounds.maxX, clippedBounds.maxY);
  includeInlineArrowBounds(item, include, unit);
}

function intersectPathClipBounds(bounds, clipRect) {
  if (!clipRect) return bounds;
  const minX = Math.max(bounds.minX, Number(clipRect.minX));
  const minY = Math.max(bounds.minY, Number(clipRect.minY));
  const maxX = Math.min(bounds.maxX, Number(clipRect.maxX));
  const maxY = Math.min(bounds.maxY, Number(clipRect.maxY));
  if (![minX, minY, maxX, maxY].every(Number.isFinite) || minX > maxX || minY > maxY) return null;
  return { minX, minY, maxX, maxY };
}

function includeInlineArrowBounds(item, include, unit) {
  const style = item.style || {};
  if (!style.markerStart && !style.markerEnd) return;
  const terminal = pathTerminalSegments(item.commands || []);
  if (style.markerStart && terminal.first) {
    const ux = -(terminal.first.startUx ?? terminal.first.ux);
    const uy = -(terminal.first.startUy ?? terminal.first.uy);
    includeArrowTipBounds(style.markerStart, style, terminal.first.start, ux, uy, include, unit);
  }
  if (style.markerEnd && terminal.last) {
    const ux = terminal.last.endUx ?? terminal.last.ux;
    const uy = terminal.last.endUy ?? terminal.last.uy;
    includeArrowTipBounds(style.markerEnd, style, terminal.last.end, ux, uy, include, unit);
  }
}

function includeArrowTipBounds(rawTip, style, endpoint, ux, uy, include, unit) {
  const tip = resolveInlineArrowTip(rawTip, style);
  const bounds = tip.geometry?.bounds;
  if (!bounds) return;
  const placement = (Number(tip.geometry.placement) || 0) / unit;
  const origin = {
    x: endpoint.x - ux * placement,
    y: endpoint.y - uy * placement
  };
  const strokePad = (Number(tip.strokeWidth) || 0) / unit / 2;
  const perpendicular = { x: -uy, y: ux };
  for (const x of [bounds.minX / unit - strokePad, bounds.maxX / unit + strokePad]) {
    for (const y of [bounds.minY / unit - strokePad, bounds.maxY / unit + strokePad]) {
      include(
        origin.x + ux * x + perpendicular.x * y,
        origin.y + uy * x + perpendicular.y * y
      );
    }
  }
}

function pathStrokePadding(item, unit) {
  if (item.type === "bbox" && !item.includeStrokeBounds) return 0;
  const style = item.style || {};
  if (style.stroke === "none") return 0;
  const lineWidth = Number(style.lineWidth);
  if (!Number.isFinite(lineWidth) || lineWidth <= 0) return 0;
  return lineWidth / unit / 2;
}

function nodeBoxStrokePadding(item, unit) {
  const style = item.style || {};
  if (style.stroke === "none") return 0;
  const lineWidth = Number(style.lineWidth);
  if (!Number.isFinite(lineWidth) || lineWidth <= 0) return 0;
  return lineWidth / unit / 2;
}

function hasPathCommands(item) {
  return Array.isArray(item.commands) && item.commands.length > 0;
}
