import { includePathCommandBounds } from "../../scene/index.js";
import { blurShadowBoundsPadding } from "./defs.js";
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
import { pathTerminalSegments, placeResolvedInlineArrowTips, resolveInlineArrowTipSequence } from "./paths.js";
import { circularSectorGeometry, cylinderGeometry, dartGeometry, kiteGeometry, semicircleGeometry } from "../../tikz/libraries/shapes.geometric.js";
import { chamferedRectangleGeometry } from "../../tikz/libraries/shapes.misc.js";
import { magneticTapeGeometry, signalGeometry, starburstGeometry, tapeGeometry } from "../../tikz/libraries/shapes.symbols.js";
import { curvedArrowPaint } from "./arrowBending.js";

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
      const strokePad = item.strokeBoundsIncluded ? 0 : nodeBoxStrokePadding(item, unit);
      const foregroundOuterX = Math.max(0, Number(item.foregroundOuterSep?.x) || 0);
      const foregroundOuterY = Math.max(0, Number(item.foregroundOuterSep?.y) || 0);
      const geometricBounds = item.shape === "cylinder"
        ? cylinderGeometry(item, item.shapeData || {}).bounds
        : item.shape === "semicircle"
          ? semicircleGeometry(item, item.shapeData || {}).bounds
          : item.shape === "circularSector"
            ? circularSectorGeometry(item, item.shapeData || {}).bounds
          : item.shape === "chamferedRectangle"
            ? chamferedRectangleGeometry(item, item.shapeData || {}).bounds
          : item.shape === "kite"
            ? kiteGeometry(item, item.shapeData || {}).bounds
          : item.shape === "dart"
            ? dartGeometry(item, item.shapeData || {}).bounds
            : null;
      const symbolBounds = item.shape === "signal"
        ? signalGeometry(item, item.shapeData || {}).bounds
        : item.shape === "magneticTape"
          ? magneticTapeGeometry(item, item.shapeData || {}).bounds
          : item.shape === "tape"
            ? tapeGeometry(item, item.shapeData || {}).bounds
          : item.shape === "starburst"
            ? starburstGeometry(item, item.shapeData || {}).bounds
          : geometricBounds;
      includeRotatedRectangleBounds(
        symbolBounds ? item.x + symbolBounds.minX - strokePad - foregroundOuterX : item.x - item.width / 2 - strokePad - foregroundOuterX,
        symbolBounds ? item.y + symbolBounds.minY - strokePad - foregroundOuterY : item.y - item.height / 2 - strokePad - foregroundOuterY,
        symbolBounds ? item.x + symbolBounds.maxX + strokePad + foregroundOuterX : item.x + item.width / 2 + strokePad + foregroundOuterX,
        symbolBounds ? item.y + symbolBounds.maxY + strokePad + foregroundOuterY : item.y + item.height / 2 + strokePad + foregroundOuterY,
        item.rotation,
        item.x,
        item.y,
        include
      );
      for (const shadow of item.shadows || []) {
        const scale = Number(shadow.scale) > 0 ? Number(shadow.scale) : 1;
        const blurPad = shadow.blur ? blurShadowBoundsPadding(shadow.blurRadius) : 0;
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
  const includeStrokeBounds = item.includeStrokeBounds ?? item.type === "path";
  const pad = includeStrokeBounds ? pathStrokePadding(item, unit) : 0;
  const paintedBounds = {
    minX: pathBounds.minX - pad,
    minY: pathBounds.minY - pad,
    maxX: pathBounds.maxX + pad,
    maxY: pathBounds.maxY + pad
  };
  const rectangularBounds = intersectPathClipBounds(paintedBounds, item.clipRect);
  const clippedBounds = intersectPathClipCircleBounds(rectangularBounds, item.clipCircle);
  if (!clippedBounds) return;
  include(clippedBounds.minX, clippedBounds.minY);
  include(clippedBounds.maxX, clippedBounds.maxY);
  if (item.includeArrowBounds !== false) includeInlineArrowBounds(item, include, unit);
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

function intersectPathClipCircleBounds(bounds, clipCircle) {
  if (!bounds || !clipCircle) return bounds;
  const radius = Number(clipCircle.radius);
  const x = Number(clipCircle.x);
  const y = Number(clipCircle.y);
  if (![radius, x, y].every(Number.isFinite) || radius <= 0) return bounds;
  return intersectPathClipBounds(bounds, {
    minX: x - radius,
    minY: y - radius,
    maxX: x + radius,
    maxY: y + radius
  });
}

function includeInlineArrowBounds(item, include, unit) {
  const style = item.style || {};
  if (!style.markerStart && !style.markerEnd) return;
  const terminal = pathTerminalSegments(item.commands || []);
  if (style.markerStart && terminal.first) {
    const ux = -(terminal.first.startUx ?? terminal.first.ux);
    const uy = -(terminal.first.startUy ?? terminal.first.uy);
    const tips = resolveInlineArrowTipSequence(style.markerStart, style, "start");
    for (const placed of placeResolvedInlineArrowTips(tips, terminal.first.start, -ux, -uy, unit)) {
      if (!includeCurvedArrowTipBounds(placed, style, terminal.first, "start", include, unit)) {
        includeResolvedArrowTipBounds(placed.tip, style, placed.point, ux, uy, include, unit, item.includeArrowNormalBounds);
      }
    }
  }
  if (style.markerEnd && terminal.last) {
    const ux = terminal.last.endUx ?? terminal.last.ux;
    const uy = terminal.last.endUy ?? terminal.last.uy;
    const tips = resolveInlineArrowTipSequence(style.markerEnd, style, "end");
    for (const placed of placeResolvedInlineArrowTips(tips, terminal.last.end, -ux, -uy, unit)) {
      if (!includeCurvedArrowTipBounds(placed, style, terminal.last, "end", include, unit)) {
        includeResolvedArrowTipBounds(placed.tip, style, placed.point, ux, uy, include, unit, item.includeArrowNormalBounds);
      }
    }
  }
}

function includeCurvedArrowTipBounds(placed, style, terminal, side, include, unit) {
  const paint = curvedArrowPaint(placed.tip, placed, terminal, side, unit);
  if (!paint?.bounds) return false;
  const pad = (Number(placed.tip.strokeWidth) || Number(style.lineWidth) || 0) / 2;
  include((paint.bounds.minX - pad) / unit, -(paint.bounds.maxY + pad) / unit);
  include((paint.bounds.maxX + pad) / unit, -(paint.bounds.minY - pad) / unit);
  return true;
}

function includeResolvedArrowTipBounds(tip, style, origin, ux, uy, include, unit, includeNormalBounds = true) {
  if (tip.geometry?.includeBounds === false) return;
  const bounds = tip.geometry?.bounds;
  if (!bounds) return;
  // Legacy PGF arrow declarations include half the current line width in
  // `\pgfarrowsrightextend`. The emitted tip geometry carries that extension
  // already, so only its remaining stroke half-width belongs outside it.
  const terminalPad = (Number(tip.strokeWidth) || Number(style.lineWidth) || 0) / unit / 2;
  const strokePad = (Number(tip.strokeWidth) || 0) / unit / 2;
  const perpendicular = { x: -uy, y: ux };
  for (const x of [bounds.minX / unit, bounds.maxX / unit + terminalPad]) {
    // PGF's picture bounds include the tip's terminal extension, while the
    // stroked path already accounts for its normal-direction footprint.
    // Mirroring that rule avoids vertically inflating horizontal stealth tips.
    const normalOffsets = includeNormalBounds
      ? [bounds.minY / unit - strokePad, bounds.maxY / unit + strokePad]
      : [0];
    for (const y of normalOffsets) {
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
