import {
  TIKZ_FONT_FAMILY,
  TIKZ_MONOSPACE_FONT_FAMILY,
  TIKZ_TEXT_FONT_SIZE,
  lineWidthFromPt
} from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";

export function renderImagePlaceholder(item, image, unit) {
  const scale = imagePlaceholderScale(item, image);
  const width = image.width * unit * scale;
  const height = image.height * unit * scale;
  const x = item.x * unit - width / 2;
  const y = -item.y * unit - height / 2;
  if (image.href) {
    return `<image class="tikz-raster-image tikz-included-graphic" x="${format(x)}" y="${format(y)}" width="${format(
      width
    )}" height="${format(height)}" href="${escapeAttribute(image.href)}" preserveAspectRatio="none" />`;
  }
  if (image.plot === "polyline") {
    const stroke = escapeAttribute(item.style?.fill || "black");
    const data = (image.polylines || [])
      .map((line) =>
        line
          .map((point, index) => `${index === 0 ? "M" : "L"} ${format(x + point.x * width)} ${format(y + (1 - point.y) * height)}`)
          .join(" ")
      )
      .join(" ");
    const labelHeight = Number(image.labelHeight || 0) * unit;
    const label = image.label
      ? `<text x="${format(item.x * unit)}" y="${format(y + height - labelHeight / 2)}" fill="${stroke}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
          Math.max(10, labelHeight * 0.9)
        )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(image.label)}</text>`
      : "";
    return `<g class="tikz-image-placeholder tikz-inline-polyline"><path d="${data}" stroke="${stroke}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />${label}</g>`;
  }
  if (image.plot === "boxed-text") {
    const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
    const fill = escapeAttribute(item.style?.fill && item.style.fill !== "black" ? item.style.fill : "none");
    const cx = item.x * unit;
    const cy = -item.y * unit;
    const rotate = Number(image.rotate) || 0;
    const labelRotate = rotate ? ` transform="rotate(${format(-rotate)} ${format(cx)} ${format(cy)})"` : "";
    const label = image.label
      ? `<text x="${format(cx)}" y="${format(cy)}" fill="${escapeAttribute(
          item.style?.fill || "black"
        )}" text-anchor="middle" dominant-baseline="middle" font-size="${format(TIKZ_TEXT_FONT_SIZE)}" font-family="${escapeAttribute(
          TIKZ_FONT_FAMILY
        )}"${labelRotate}>${escapeText(image.label)}</text>`
      : "";
    return `<g class="tikz-image-placeholder tikz-boxed-text"><rect x="${format(x)}" y="${format(y)}" width="${format(
      width
    )}" height="${format(height)}" stroke="${stroke}" fill="${fill}" stroke-width="${format(lineWidthFromPt(0.4))}" />${label}</g>`;
  }
  if (image.plot === "network-device") {
    return renderNetworkDeviceGraphic(item, image, unit, scale, x, y, width, height);
  }
  if (image.plot === "mini-tikz") {
    return renderMiniTikzGraphic(item, image, unit, scale, x, y);
  }
  if (image.plot === "mini-node-stack") {
    return renderMiniNodeStackGraphic(item, image, unit, scale, x, y);
  }
  if (image.plot === "gaussian") {
    const samples = 44;
    const points = Array.from({ length: samples }, (_unused, index) => {
      const t = index / (samples - 1);
      const domain = -3 + t * 6;
      const value = Math.exp(-domain * domain);
      return {
        x: x + width * (0.08 + t * 0.84),
        y: y + height * (0.82 - value * 0.64)
      };
    });
    const data = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${format(point.x)} ${format(point.y)}`)
      .join(" ");
    const grid = image.grid ? renderAxisPlaceholderGrid(x, y, width, height, unit) : "";
    const axisLeft = x + width * 0.08;
    const axisRight = x + width * 0.92;
    const axisTop = y + height * 0.08;
    const axisBase = y + height * 0.82;
    const fillData = `M ${format(points[0].x)} ${format(axisBase)} ${data} L ${format(points.at(-1).x)} ${format(axisBase)} Z`;
    const fill = gaussianPlaceholderFill(image.raw);
    const axisData = `M ${format(axisLeft)} ${format(axisBase)} L ${format(axisRight)} ${format(axisBase)} M ${format(axisLeft)} ${format(
      axisBase
    )} L ${format(axisLeft)} ${format(axisTop)}`;
    const axisArrows = [
      `M ${format(axisRight)} ${format(axisBase)} l ${format(-width * 0.035)} ${format(-height * 0.018)} l 0 ${format(height * 0.036)} Z`,
      `M ${format(axisLeft)} ${format(axisTop)} l ${format(-width * 0.018)} ${format(height * 0.035)} l ${format(width * 0.036)} 0 Z`
    ].join(" ");
    return `<g class="tikz-axis-placeholder tikz-gaussian">${grid}<path class="tikz-gaussian-fill" d="${fillData}" fill="${fill}" stroke="none" /><path d="${data}" stroke="black" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /><path class="tikz-gaussian-axis" d="${axisData}" stroke="black" fill="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" /><path class="tikz-gaussian-axis-arrows" d="${axisArrows}" fill="black" stroke="none" /></g>`;
  }
  if (image.plot === "fm-wave") {
    const explicitLabelHeight = Number(image.labelHeight) > 0 ? Number(image.labelHeight) * unit * scale : null;
    const labelHeight = image.label ? explicitLabelHeight ?? Math.max(14, height * 0.28) : 0;
    const waveHeight = Math.max(18, height - labelHeight);
    const samples = 120;
    const points = Array.from({ length: samples }, (_unused, index) => {
      const t = index / (samples - 1);
      const carrier = Math.sin(t * Math.PI * 2 * 16 - 2.5 * Math.cos(t * Math.PI * 2));
      const envelope = 0.35 + 0.65 * Math.sin(t * Math.PI * 2) ** 2;
      return {
        x: x + width * (0.04 + t * 0.92),
        y: y + waveHeight * 0.5 - carrier * envelope * waveHeight * 0.34
      };
    });
    const data = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${format(point.x)} ${format(point.y)}`)
      .join(" ");
    const label = image.label
      ? `<text x="${format(item.x * unit)}" y="${format(y + waveHeight + labelHeight * 0.72)}" fill="${escapeAttribute(
          item.style?.fill || "black"
        )}" text-anchor="middle" dominant-baseline="middle" font-size="${format(labelHeight * 0.72)}" font-family="${escapeAttribute(
          TIKZ_FONT_FAMILY
        )}">${escapeText(image.label)}</text>`
      : "";
    return `<g class="tikz-axis-placeholder tikz-fm-wave"><path d="${data}" stroke="black" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />${label}</g>`;
  }
  if (image.plot === "wave") {
    const labelHeight = image.label ? Math.max(12, height * 0.32) : 0;
    const waveHeight = Math.max(8, height - labelHeight);
    const waveCount = Math.max(1, Math.round(image.waveCount || 1));
    const samples = 40;
    const waves = Array.from({ length: waveCount }, (_unused, waveIndex) => {
      const bandTop = y + (waveHeight * waveIndex) / waveCount;
      const bandHeight = waveHeight / waveCount;
      const waveY = bandTop + bandHeight * 0.5;
      const points = Array.from({ length: samples }, (_unused2, index) => {
        const t = index / (samples - 1);
        return {
          x: x + width * (0.06 + t * 0.88),
          y: waveY - Math.sin(t * Math.PI * 4) * bandHeight * 0.28
        };
      });
      const data = points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${format(point.x)} ${format(point.y)}`)
        .join(" ");
      return `<path d="${data}" stroke="black" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
    }).join("");
    const label = image.label
      ? `<text x="${format(item.x * unit)}" y="${format(y + waveHeight + labelHeight * 0.72)}" fill="${escapeAttribute(
          item.style?.fill || "black"
        )}" text-anchor="middle" dominant-baseline="middle" font-size="${format(labelHeight * 0.75)}" font-family="${escapeAttribute(
          TIKZ_FONT_FAMILY
        )}">${escapeText(image.label)}</text>`
      : "";
    return `<g class="tikz-image-placeholder tikz-inline-wave">${waves}${label}</g>`;
  }
  const label = image.fileName.replace(/\.[^.]+$/, "");
  return `<g class="tikz-image-placeholder"><rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(
    height
  )}" rx="${format(Math.min(width, height) * 0.08)}" stroke="#335c85" fill="#edf5ff" stroke-width="1.2" /><text x="${format(
    item.x * unit
  )}" y="${format(-item.y * unit)}" fill="#254b73" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    Math.max(10, Math.min(16, height * 0.22))
  )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(label)}</text></g>`;
}

export function imagePlaceholderScale(item, image = {}) {
  const imageScale = Number(image.scale);
  const nodeScale = Number(item?.style?.fontScale);
  const scale = (Number.isFinite(imageScale) && imageScale > 0 ? imageScale : 1) * (Number.isFinite(nodeScale) && nodeScale > 0 ? nodeScale : 1);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function renderNetworkDeviceGraphic(item, image, unit, scale, x, y, width, height) {
  const device = image.device === "switch" ? "switch" : "router";
  const colors = device === "switch"
    ? { fill: "rgb(224 255 224)", stroke: "rgb(0 128 0)", text: "rgb(0 89 0)" }
    : { fill: "rgb(224 224 255)", stroke: "rgb(0 0 179)", text: "rgb(0 0 153)" };
  const strokeWidth = lineWidthFromPt(1.2) * scale;
  const innerStrokeWidth = lineWidthFromPt(0.8) * scale;
  const rx = Math.max(3, Math.min(width, height) * 0.08);
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const toX = (localX) => cx + localX * (width / 2);
  const toY = (localY) => cy - localY * (height / 1.1);
  const textSize = Math.min(11 * scale, height * 0.28);
  const common = `stroke="${colors.stroke}" stroke-width="${format(innerStrokeWidth)}" stroke-linecap="round" stroke-linejoin="round"`;
  const content = device === "switch"
    ? [-0.6, -0.2, 0.2, 0.6]
        .map((localX) => {
          const x1 = toX(localX);
          return `<path d="M ${format(x1)} ${format(toY(-0.25))} L ${format(x1)} ${format(toY(0.25))}" ${common} fill="none" /><circle cx="${format(
            x1
          )}" cy="${format(toY(0.28))}" r="${format(Math.max(1.2, width * 0.0175))}" fill="${colors.stroke}" />`;
        })
        .join("")
    : [
        [-0.65, 0.1, -0.25, 0.1, -0.25, 0.35],
        [0.65, 0.1, 0.25, 0.1, 0.25, 0.35],
        [-0.65, -0.1, -0.25, -0.1, -0.25, -0.35],
        [0.65, -0.1, 0.25, -0.1, 0.25, -0.35]
      ]
        .map(([x1, y1, x2, y2, x3, y3]) =>
          `<path d="M ${format(toX(x1))} ${format(toY(y1))} L ${format(toX(x2))} ${format(toY(y2))} L ${format(toX(x3))} ${format(toY(y3))}" ${common} fill="none" />`
        )
        .join("");
  return `<g class="tikz-image-placeholder tikz-network-device tikz-network-device-${device}"><rect x="${format(x)}" y="${format(y)}" width="${format(
    width
  )}" height="${format(height)}" rx="${format(rx)}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="${format(
    strokeWidth
  )}" />${content}<text x="${format(cx)}" y="${format(cy)}" fill="${colors.text}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    textSize
  )}" font-family="${escapeAttribute(TIKZ_MONOSPACE_FONT_FAMILY)}">${device}</text></g>`;
}

function renderMiniTikzGraphic(item, image, unit, scale, x, y) {
  const minX = Number(image.minX) || 0;
  const maxY = Number(image.maxY) || 0;
  const toX = (value) => x + (Number(value) - minX) * unit * scale;
  const toY = (value) => y + (maxY - Number(value)) * unit * scale;
  const safeId = `mini-ball-${Math.abs(Math.round((item.x || 0) * 997))}-${Math.abs(Math.round((item.y || 0) * 991))}`;
  const defs = [];
  const polylines = (image.polylines || []).map((polyline) => {
    const points = polyline.points || [];
    if (points.length < 2) return "";
    const data = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${format(toX(point.x))} ${format(toY(point.y))}`)
      .join(" ");
    return `<path class="tikz-mini-unit-cell" d="${data}" stroke="${escapeAttribute(polyline.stroke || "black")}" fill="none" stroke-width="${format(
      polyline.lineWidth || 0.8
    )}" stroke-linecap="butt" stroke-linejoin="miter" />`;
  }).join("");
  const rectangles = (image.rectangles || []).map((rect) => {
    const left = Math.min(toX(rect.x1), toX(rect.x2));
    const right = Math.max(toX(rect.x1), toX(rect.x2));
    const top = Math.min(toY(rect.y1), toY(rect.y2));
    const bottom = Math.max(toY(rect.y1), toY(rect.y2));
    return `<rect class="tikz-mini-unit-cell" x="${format(left)}" y="${format(top)}" width="${format(right - left)}" height="${format(
      bottom - top
    )}" stroke="${escapeAttribute(rect.stroke || "black")}" fill="none" stroke-width="${format(rect.lineWidth || 0.8)}" />`;
  }).join("");
  const circles = (image.circles || []).map((circle, index) => {
    const cx = toX(circle.x);
    const cy = toY(circle.y);
    const r = Math.max(0.5, Number(circle.r) * unit * scale);
    let fill = escapeAttribute(circle.fill || "black");
    if (circle.shading === "ball") {
      const id = `${safeId}-${index}`;
      defs.push(`<radialGradient id="${id}" cx="32%" cy="28%" r="72%"><stop offset="0%" stop-color="white" /><stop offset="34%" stop-color="${fill}" /><stop offset="100%" stop-color="black" stop-opacity="0.62" /></radialGradient>`);
      fill = `url(#${id})`;
    }
    return `<circle class="tikz-mini-circle" cx="${format(cx)}" cy="${format(cy)}" r="${format(r)}" fill="${fill}" stroke="none" />`;
  }).join("");
  return `<g class="tikz-image-placeholder tikz-mini-graphic">${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${polylines}${rectangles}${circles}</g>`;
}

function renderMiniNodeStackGraphic(item, image, unit, scale, x, y) {
  const minX = Number(image.minX) || 0;
  const maxY = Number(image.maxY) || 0;
  const toX = (value) => x + (Number(value) - minX) * unit * scale;
  const toY = (value) => y + (maxY - Number(value)) * unit * scale;
  const defaultFill = escapeAttribute(item.style?.fill || "black");
  const strokeWidth = lineWidthFromPt(0.4);
  const label = image.label
    ? `<text class="tikz-mini-node-stack-label" x="${format(toX(image.labelX || 0))}" y="${format(
        toY(image.labelY || 0)
      )}" fill="${defaultFill}" text-anchor="middle" dominant-baseline="middle" xml:space="preserve" font-size="${format(
        Math.min(TIKZ_TEXT_FONT_SIZE * 0.92 * scale, Math.max(10, Number(image.labelHeight || 0.32) * unit * scale * 0.95))
      )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(image.label)}</text>`
    : "";
  const boxes = (image.boxes || []).map((box) => {
    const left = toX(Number(box.x) - Number(box.width) / 2);
    const top = toY(Number(box.y) + Number(box.height) / 2);
    const width = Math.max(0, Number(box.width) * unit * scale);
    const height = Math.max(0, Number(box.height) * unit * scale);
    const stroke = escapeAttribute(box.stroke || item.style?.stroke || "black");
    const fill = escapeAttribute(box.fill || "none");
    const textFill = escapeAttribute(box.textColor || box.stroke || item.style?.fill || "black");
    const rx = Math.max(0, Number(box.rx || 0) * unit * scale);
    const fontSize = Math.min(TIKZ_TEXT_FONT_SIZE * 0.78 * scale, Math.max(10, height * 0.68));
    return `<g class="tikz-mini-node"><rect class="tikz-mini-node-box" x="${format(left)}" y="${format(top)}" width="${format(
      width
    )}" height="${format(height)}" rx="${format(rx)}" stroke="${stroke}" fill="${fill}" stroke-width="${format(
      strokeWidth
    )}" stroke-linecap="butt" stroke-linejoin="miter" /><text class="tikz-mini-node-label" x="${format(
      toX(box.x)
    )}" y="${format(toY(box.y))}" fill="${textFill}" text-anchor="middle" dominant-baseline="middle" xml:space="preserve" font-size="${format(
      fontSize
    )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(box.label || "")}</text></g>`;
  }).join("");
  return `<g class="tikz-image-placeholder tikz-mini-node-stack">${label}${boxes}</g>`;
}

function renderAxisPlaceholderGrid(x, y, width, height, unit) {
  const step = Math.max(6, unit * 0.2);
  const stroke = "rgb(140 140 140)";
  const lines = [];
  for (let gx = x + step; gx < x + width - 1e-6; gx += step) {
    lines.push(`M ${format(gx)} ${format(y)} L ${format(gx)} ${format(y + height)}`);
  }
  for (let gy = y + step; gy < y + height - 1e-6; gy += step) {
    lines.push(`M ${format(x)} ${format(gy)} L ${format(x + width)} ${format(gy)}`);
  }
  if (!lines.length) return "";
  return `<path class="tikz-axis-grid" d="${lines.join(" ")}" stroke="${stroke}" fill="none" stroke-width="0.45" stroke-dasharray="1 1.2" />`;
}

function gaussianPlaceholderFill(raw) {
  const text = String(raw || "");
  if (/fill\s*=\s*red\b/i.test(text)) return "rgb(255 230 230)";
  if (/fill\s*=\s*(?:blue|echodrk)\b/i.test(text)) return "rgb(230 246 250)";
  return "rgb(238 238 238)";
}
