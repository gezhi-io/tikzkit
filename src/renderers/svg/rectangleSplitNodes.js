import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { svgPaint } from "./style.js";

export function isRectangleSplitNodeShape(shape) {
  return shape === "rectangleSplit";
}

export function renderRectangleSplitNodeBox(item, unit) {
  const parts = Math.max(1, Math.round(item.parts || 1));
  const horizontal = item.rectangleSplitHorizontal !== false;
  const x = (item.x - item.width / 2) * unit;
  const y = -(item.y + item.height / 2) * unit;
  const width = item.width * unit;
  const height = item.height * unit;
  const rawPartWidths = Array.isArray(item.partWidths) && item.partWidths.length === parts
    ? item.partWidths.map((value) => Math.max(0, Number(value) || 0))
    : null;
  const rawSeparatorWidth = Math.max(0, Number(item.separatorWidth) || 0) * unit;
  const rawWidth =
    (rawPartWidths?.reduce((sum, value) => sum + value * unit, 0) || 0) +
    rawSeparatorWidth * Math.max(0, parts - 1);
  const layoutScale = rawWidth > 0 ? width / rawWidth : 1;
  const separatorWidth = rawSeparatorWidth * layoutScale;
  const partWidths = rawWidth > 0
    ? rawPartWidths.map((value) => value * unit * layoutScale)
    : Array.from({ length: parts }, () => width / parts);
  const partX = (index) =>
    x + partWidths.slice(0, index).reduce((sum, value) => sum + value, 0) + separatorWidth * index;
  const lineWidth = item.style?.lineWidth ?? 1;
  const stroke = escapeAttribute(svgPaint(item.style?.stroke || "black"));
  const fills = item.partFills || [];
  const usesCustomFill = item.rectangleSplitUsesCustomFill === true;
  const backgroundFill = escapeAttribute(svgPaint(item.style?.fill || "none"));
  const drawSplits = item.rectangleSplitDrawSplits !== false;
  if (!horizontal) {
    const rawPartHeights = Array.isArray(item.partHeights) && item.partHeights.length === parts
      ? item.partHeights.map((value) => Math.max(0, Number(value) || 0))
      : null;
    const rawHeight =
      (rawPartHeights?.reduce((sum, value) => sum + value * unit, 0) || 0) +
      rawSeparatorWidth * Math.max(0, parts - 1);
    const layoutScaleY = rawHeight > 0 ? height / rawHeight : 1;
    const separatorHeight = rawSeparatorWidth * layoutScaleY;
    const partHeights = rawHeight > 0
      ? rawPartHeights.map((value) => value * unit * layoutScaleY)
      : Array.from({ length: parts }, () => height / parts);
    const partY = (index) =>
      y + partHeights.slice(0, index).reduce((sum, value) => sum + value, 0) + separatorHeight * index;
    const background = usesCustomFill ? "" : `<rect class="tikz-split-background" x="${format(x)}" y="${format(
      y
    )}" width="${format(width)}" height="${format(height)}" stroke="none" fill="${backgroundFill}" />`;
    const partRects = usesCustomFill ? Array.from({ length: parts }, (_unused, index) => {
      const fill = escapeAttribute(svgPaint(fills[index] || "none"));
      return `<rect class="tikz-split-part" x="${format(x)}" y="${format(partY(index))}" width="${format(
        width
      )}" height="${format(partHeights[index])}" stroke="none" fill="${fill}" />`;
    }).join("") : "";
    const separators = drawSplits
      ? Array.from({ length: parts - 1 }, (_unused, index) => {
        const lineY = partY(index) + partHeights[index] + separatorHeight / 2;
        return `<path class="tikz-split-separator" d="M ${format(x)} ${format(lineY)} L ${format(
          x + width
        )} ${format(lineY)}" stroke="${stroke}" fill="none" stroke-width="${format(lineWidth)}" />`;
      }).join("")
      : "";
    const outer = `<rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(
      height
    )}" rx="${format((item.rx || 0) * unit)}" stroke="${stroke}" fill="none" stroke-width="${format(lineWidth)}" />`;
    return `<g class="tikz-rectangle-split">${background}${partRects}${separators}${outer}</g>`;
  }
  const background = usesCustomFill ? "" : `<rect class="tikz-split-background" x="${format(x)}" y="${format(
    y
  )}" width="${format(width)}" height="${format(height)}" stroke="none" fill="${backgroundFill}" />`;
  const partRects = usesCustomFill ? Array.from({ length: parts }, (_unused, index) => {
    const fill = escapeAttribute(svgPaint(fills[index] || "none"));
    return `<rect class="tikz-split-part" x="${format(partX(index))}" y="${format(y)}" width="${format(
      partWidths[index]
    )}" height="${format(height)}" stroke="none" fill="${fill}" />`;
  }).join("") : "";
  const separators = drawSplits
    ? Array.from({ length: parts - 1 }, (_unused, index) => {
      const lineX = partX(index) + partWidths[index] + separatorWidth / 2;
      return `<path class="tikz-split-separator" d="M ${format(lineX)} ${format(y)} L ${format(
        lineX
      )} ${format(y + height)}" stroke="${stroke}" fill="none" stroke-width="${format(lineWidth)}" />`;
    }).join("")
    : "";
  const outer = `<rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(
    height
  )}" rx="${format((item.rx || 0) * unit)}" stroke="${stroke}" fill="none" stroke-width="${format(lineWidth)}" />`;
  return `<g class="tikz-rectangle-split">${background}${partRects}${separators}${outer}</g>`;
}
