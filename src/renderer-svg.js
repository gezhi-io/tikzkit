import katex from "katex";
import { estimateFormulaBox, formulaTotalHeight, parseMathText } from "./math-metrics.js";
import { TIKZKIT_SCOPED_MATH_CSS } from "./math-scoped-css.js";
import { mathFallbackText, normalizeTikzText, replaceTikzHspaceMarkers, splitInlineMathSegments } from "./tex-text.js";
import { parseDimension } from "./math.js";
import {
  TIKZ_ARROW,
  TIKZ_DISPLAY_MATH_FONT_SIZE,
  TIKZ_FONT_FAMILY,
  TIKZ_MARGIN,
  TIKZ_MONOSPACE_FONT_FAMILY,
  TIKZ_TEXT_FONT_SIZE,
  TIKZ_TYPEWRITER_WIDTH_SCALE,
  TIKZ_UNIT,
  createArrowTip,
  lineWidthFromPt
} from "./tikz-metrics.js";

// Claude: 交给 KaTeX 原生渲染的「带标签花括号」宏（替代文档里 \overmat/\undermat 的 \makebox
// 盒子展开，见 preprocess.js 的 KATEX_DELEGATED_MACROS）。\overmat{标签}{矩阵}{颜色} 语义就是
// 在矩阵上方画一个带标签的 \overbrace；这正好是 KaTeX 原生支持的 \overbrace{..}^{..}。
const KATEX_MACROS = {
  "\\overmat": "\\overbrace{#2}^{\\color{#3}\\text{#1}}",
  "\\undermat": "\\underbrace{#2}_{\\color{#3}\\text{#1}}"
};

const MATH_CLASS_ALIASES = new Map([
  ["katex", "root"],
  ["katex-display", "display-root"],
  ["katex-html", "html"],
  ["katex-mathml", "mathml"],
  ["katex-version", "version"]
]);
const KATEX_ROOT_FONT_SCALE = 1.21;
const KATEX_INLINE_LINE_BOX_SCALE = 1.36;
const KATEX_DISPLAY_LINE_BOX_SCALE = 1.62;
const KATEX_INLINE_WIDTH_PAD_EM = 0.65;
const KATEX_DISPLAY_WIDTH_PAD_EM = 0.9;

export function renderSvg(ir, options = {}) {
  const unit = options.unit || TIKZ_UNIT;
  const margin = options.margin ?? TIKZ_MARGIN;
  const bounds = computeBounds(ir.items || [], options);
  const view = {
    x: bounds.minX * unit - margin,
    y: -bounds.maxY * unit - margin,
    width: (bounds.maxX - bounds.minX) * unit + margin * 2,
    height: (bounds.maxY - bounds.minY) * unit + margin * 2
  };
  const viewBox = [format(view.x), format(view.y), format(view.width), format(view.height)].join(" ");

  const body = [];
  const patternDefs = collectPatternDefs(ir.items || []);
  const ballGradientDefs = collectBallGradientDefs(ir.items || []);
  const axisGradientDefs = collectAxisGradientDefs(ir.items || []);
  const radialGradientDefs = collectRadialGradientDefs(ir.items || []);
  const pathFadingDefs = collectPathFadingDefs(ir.items || []);
  const blurShadowDefs = collectBlurShadowDefs(ir.items || [], unit);
  const defs = [
    ...patternDefs.map(renderPatternDef),
    ...ballGradientDefs.map(renderBallGradientDef),
    ...axisGradientDefs.map(renderAxisGradientDef),
    ...radialGradientDefs.map(renderRadialGradientDef),
    ...pathFadingDefs.flatMap(renderPathFadingDefs),
    ...blurShadowDefs.map(renderBlurShadowFilterDef)
  ];
  const background = options.background === undefined ? "white" : options.background;
  if (background && background !== "none") {
    body.push(
      `<rect class="tikz-background" x="${format(view.x)}" y="${format(view.y)}" width="${format(
        view.width
      )}" height="${format(view.height)}" fill="${escapeAttribute(String(background))}" />`
    );
  }
  for (const item of ir.items || []) {
    body.push(renderItem(item, unit, options));
  }
  if (body.some((line) => line && line.includes("tikzkit-math-scope"))) {
    defs.unshift(renderScopedMathStyleDef());
  }
  if (defs.length) body.unshift(`<defs>${defs.join("")}</defs>`);

  return `<svg class="tikz-render-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n${body
    .filter(Boolean)
    .map((line) => `  ${line}`)
    .join("\n")}\n</svg>\n`;
}

function renderItem(item, unit, options = {}) {
  if (item.type === "marker") return renderMarker(item, unit);
  if (item.type === "nodeBox") {
    if (item.shape === "opAmp") return renderNodeBoxWithOverlay(item, renderCircuitikzOpAmpNodeBox(item, unit), unit);
    if (item.shape === "circuitikzTransistor") return renderNodeBoxWithOverlay(item, renderCircuitikzTransistorNodeBox(item, unit), unit);
    if (item.shape === "circuitikzTriode") return renderNodeBoxWithOverlay(item, renderCircuitikzTriodeNodeBox(item, unit), unit);
    if (["circuitikzPentode", "circuitikzTetrode", "circuitikzDiodeTube"].includes(item.shape)) {
      return renderNodeBoxWithOverlay(item, renderCircuitikzTubeNodeBox(item, unit), unit);
    }
    if (item.shape === "circuitikzQuadpole") return renderNodeBoxWithOverlay(item, renderCircuitikzQuadpoleNodeBox(item, unit), unit);
    if (item.shape === "circle" || item.shape === "ellipse") {
      return renderNodeBoxWithOverlay(item, `<ellipse cx="${format(item.x * unit)}" cy="${format(-item.y * unit)}" rx="${format(
        (item.width / 2) * unit
      )}" ry="${format((item.height / 2) * unit)}"${styleAttributes(item.style)} />`, unit);
    }
    if (item.shape === "circleCrossSplit") return renderNodeBoxWithOverlay(item, renderCircleCrossSplitNodeBox(item, unit), unit);
    if (item.shape === "diamond") return renderNodeBoxWithOverlay(item, renderDiamondNodeBox(item, unit), unit);
    if (["regularPolygon", "star", "trapezium", "isoscelesTriangle", "cloud", "superellipse", "singleArrow", "doubleArrow"].includes(item.shape)) {
      return renderNodeBoxWithOverlay(item, renderLibraryShapeNodeBox(item, unit), unit);
    }
    if (["tikzquadsQuad", "tikzquadsBlackBox", "tikzquadsPgLoadLine"].includes(item.shape)) return renderTikzquadsNodeBox(item, unit, options);
    if (item.shape === "rectangleSplit") return renderRectangleSplit(item, unit);
    return renderNodeBoxWithOverlay(item, `<rect x="${format((item.x - item.width / 2) * unit)}" y="${format(
      -(item.y + item.height / 2) * unit
    )}" width="${format(item.width * unit)}" height="${format(item.height * unit)}" rx="${format(
      (item.rx || 0) * unit
    )}"${styleAttributes(item.style)} />`, unit);
  }
  if (item.type === "textNode") {
    const normalized = normalizeTikzText(item.text);
    if (normalized.invisible) return "";
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
        options
      );
    }
    else if (options.mathRenderer !== "svg-text" && hasInlineMath(normalized)) rendered = renderRichTextNode(item, normalized, unit);
    else rendered = renderPlainTextNode(item, normalized, unit);
    rendered = applyTextContour(rendered, normalized.raw || item.text);
    // Claude: 把节点的 rotate 作用到最终文本上（见 interpreter 的 nodeRotation）。
    return wrapNodeRotation(rendered, item, unit);
  }
  if (item.type === "path" && hasPathCommands(item)) return renderPathElement(item, unit);
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

function renderCircuitikzOpAmpNodeBox(item, unit) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const hw = (item.width / 2) * unit;
  const hh = (item.height / 2) * unit;
  const left = cx - hw;
  const right = cx + hw;
  const top = cy - hh;
  const bottom = cy + hh;
  const portWidth = 0.7;
  const triangleLeft = cx - hw * portWidth;
  const triangleRight = cx + hw * portWidth;
  const points = `${format(triangleLeft)},${format(top)} ${format(triangleLeft)},${format(bottom)} ${format(triangleRight)},${format(cy)}`;
  const stroke = item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black";
  const inputYOffset = hh * 0.5;
  const plusY = item.shapeData?.opAmpNoInvInputUp === false ? cy + inputYOffset : cy - inputYOffset;
  const minusY = item.shapeData?.opAmpNoInvInputUp === false ? cy - inputYOffset : cy + inputYOffset;
  const signX = triangleLeft + hw * 0.16;
  const signSize = Math.max(2.4, Math.min(hw, hh) * 0.12);
  const signWidth = Math.max(0.65, (item.style?.lineWidth || 1) * 0.75);
  const signs = [
    `M ${format(left)} ${format(plusY)} L ${format(triangleLeft)} ${format(plusY)}`,
    `M ${format(left)} ${format(minusY)} L ${format(triangleLeft)} ${format(minusY)}`,
    `M ${format(right)} ${format(cy)} L ${format(triangleRight)} ${format(cy)}`,
    `M ${format(signX - signSize)} ${format(plusY)} L ${format(signX + signSize)} ${format(plusY)}`,
    `M ${format(signX)} ${format(plusY - signSize)} L ${format(signX)} ${format(plusY + signSize)}`,
    `M ${format(signX - signSize)} ${format(minusY)} L ${format(signX + signSize)} ${format(minusY)}`
  ].join(" ");
  return [
    `<polygon class="tikz-node-shape tikz-node-opAmp" points="${points}"${styleAttributes(item.style)} />`,
    `<path class="tikz-node-opAmp-polarity" d="${signs}" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${format(
      signWidth
    )}" stroke-linecap="butt" />`
  ].join("");
}

function renderCircuitikzTransistorNodeBox(item, unit) {
  const cx = item.x;
  const cy = item.y;
  const hh = item.height / 2;
  const xSign = item.shapeData?.transistorXScale < 0 ? -1 : 1;
  const kind = item.shapeData?.transistorKind || "npn";
  const scale = hh > 0 ? hh / 0.775 : 1;
  const terminalX = 0;
  const baseX = -xSign * 0.418 * scale;
  const baseLead = { x: -xSign * 0.844 * scale, y: 0 };
  const terminalY = 0.775 * scale;
  const stubY = 0.307 * scale;
  const diagonalY = 0.115 * scale;
  const c = { x: terminalX, y: kind === "pnp" ? -terminalY : terminalY };
  const e = { x: terminalX, y: kind === "pnp" ? terminalY : -terminalY };
  const cStub = { x: terminalX, y: Math.sign(c.y || 1) * stubY };
  const eStub = { x: terminalX, y: Math.sign(e.y || -1) * stubY };
  const cBase = { x: baseX, y: Math.sign(c.y || 1) * diagonalY };
  const eBase = { x: baseX, y: Math.sign(e.y || -1) * diagonalY };
  const body = [
    moveLine(baseLead, { x: baseX, y: 0 }),
    moveLine({ x: baseX, y: -stubY }, { x: baseX, y: stubY }),
    moveLine(c, cStub),
    moveLine(cStub, cBase),
    moveLine(eBase, eStub),
    moveLine(eStub, e)
  ].join(" ");
  const arrow = transistorArrowPolygon(kind === "npn" ? eBase : eStub, kind === "npn" ? eStub : eBase, item);
  const stroke = item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black";
  const arrowPoints = arrow
    .map((point) => `${format((cx + point.x) * unit)},${format(-(cy + point.y) * unit)}`)
    .join(" ");
  return [
    `<g class="tikz-node-shape tikz-node-circuitikzTransistor tikz-node-circuitikzTransistor-${escapeAttribute(kind)}">`,
    `<path d="${localPathData(body, cx, cy, unit)}"${styleAttributes(item.style)} />`,
    `<polygon class="tikz-node-circuitikzTransistor-arrow" points="${arrowPoints}" fill="${escapeAttribute(stroke)}" stroke="none" />`,
    `</g>`
  ].join("");
}

function renderCircuitikzTriodeNodeBox(item, unit) {
  const cx = item.x;
  const cy = item.y;
  const hw = item.width / 2;
  const hh = item.height / 2;
  const stroke = item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black";
  const lineWidth = item.style?.lineWidth || 1;
  const tubeRadius = Math.min(hw * 0.82, hh * 0.62);
  const rx = tubeRadius;
  const ry = tubeRadius;
  const anodeY = hh * 0.4;
  const cathodeY = -hh * 0.4;
  const cathodeX = hw * 0.4;
  const gridX = -hw * 0.18;
  const gridLeft = -hw;
  const gridDashCount = 5;
  const dashGap = (ry * 1.6) / (gridDashCount * 2 - 1);
  const body = [
    moveLine({ x: 0, y: hh }, { x: 0, y: anodeY }),
    moveLine({ x: -hw * 0.28, y: anodeY }, { x: hw * 0.28, y: anodeY }),
    moveLine({ x: cathodeX, y: cathodeY }, { x: cathodeX, y: -hh }),
    moveLine({ x: -hw * 0.25, y: cathodeY }, { x: cathodeX + hw * 0.08, y: cathodeY }),
    moveLine({ x: gridLeft, y: 0 }, { x: gridX - hw * 0.08, y: 0 })
  ];
  for (let index = 0; index < gridDashCount; index += 1) {
    const y = -ry * 0.55 + index * dashGap * 2;
    body.push(moveLine({ x: gridX, y }, { x: gridX, y: y + dashGap }));
  }
  return [
    `<g class="tikz-node-shape tikz-node-circuitikzTriode">`,
    `<ellipse class="tikz-node-circuitikzTriode-outline" cx="${format(cx * unit)}" cy="${format(
      -cy * unit
    )}" rx="${format(rx * unit)}" ry="${format(ry * unit)}" fill="none" stroke="${escapeAttribute(
      stroke
    )}" stroke-width="${format(lineWidth)}" />`,
    `<path class="tikz-node-circuitikzTriode-body" d="${localPathData(body.join(" "), cx, cy, unit)}" fill="none" stroke="${escapeAttribute(
      stroke
    )}" stroke-width="${format(lineWidth)}" stroke-linecap="butt" stroke-linejoin="round" />`,
    `</g>`
  ].join("");
}

function renderCircuitikzTubeNodeBox(item, unit) {
  const cx = item.x;
  const cy = item.y;
  const halfWidth = item.width / 2;
  const halfHeight = item.height / 2;
  const stroke = item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black";
  const fill = item.style?.fill || "none";
  const lineWidth = item.style?.lineWidth || 1;
  const tubeRx = halfWidth * 0.8;
  const tubeRy = halfHeight * 0.8;
  const outline = tubeCapsulePath(tubeRx, tubeRy);
  const partial = item.shapeData?.partialBorders || "none";
  const parts = [
    `<g class="tikz-node-shape tikz-node-circuitikzTube tikz-node-${escapeAttribute(item.shape)}">`,
    `<path class="tikz-node-circuitikzTube-fill" d="${localTubePathData(outline.full, cx, cy, unit)}" fill="${escapeAttribute(
      fill
    )}" stroke="none" />`
  ];
  if (/^[012]{6}$/.test(partial)) {
    for (let index = 0; index < outline.parts.length; index += 1) {
      const styleCode = Number(partial[index]);
      if (styleCode === 0) continue;
      const dash = styleCode === 2 ? ` stroke-dasharray="${format(2 * lineWidth)} ${format(2 * lineWidth)}"` : "";
      parts.push(
        `<path class="tikz-node-circuitikzTube-border" d="${localTubePathData(outline.parts[index], cx, cy, unit)}" fill="none" stroke="${escapeAttribute(
          stroke
        )}" stroke-width="${format(lineWidth)}"${dash} stroke-linecap="butt" stroke-linejoin="round" />`
      );
    }
  } else {
    parts.push(
      `<path class="tikz-node-circuitikzTube-border" d="${localTubePathData(outline.full, cx, cy, unit)}" fill="none" stroke="${escapeAttribute(
        stroke
      )}" stroke-width="${format(lineWidth)}" stroke-linejoin="round" />`
    );
  }
  parts.push(
    `<path class="tikz-node-circuitikzTube-electrodes" d="${localTubePathData(
      circuitikzTubeElectrodePath(item),
      cx,
      cy,
      unit
    )}" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${format(lineWidth)}" stroke-linecap="butt" stroke-linejoin="round" />`,
    `</g>`
  );
  return parts.join("");
}

function renderCircuitikzQuadpoleNodeBox(item, unit) {
  const kind = item.shapeData?.quadpoleKind || "transformer";
  const cx = item.x;
  const cy = item.y;
  const stroke = item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black";
  const lineWidth = item.style?.lineWidth || 1;
  const style = {
    ...item.style,
    stroke,
    fill: "none",
    lineWidth,
    lineCap: "butt",
    lineJoin: "round"
  };
  const commands = kind === "gyrator" ? circuitikzGyratorCommands(item) : circuitikzTransformerCommands(item);
  const body = `<path class="tikz-node-circuitikzQuadpole-body" d="${localTubePathData(commands, cx, cy, unit)}"${styleAttributes(
    style,
    { lineCap: "butt", lineJoin: "round" }
  )} />`;
  const core = kind === "transformer core"
    ? `<path class="tikz-node-circuitikzQuadpole-core" d="${localTubePathData(circuitikzTransformerCoreCommands(item), cx, cy, unit)}" fill="none" stroke="${escapeAttribute(
        stroke
      )}" stroke-width="${format(lineWidth)}" stroke-linecap="butt" stroke-linejoin="round" />`
    : "";
  return `<g class="tikz-node-shape tikz-node-circuitikzQuadpole tikz-node-circuitikzQuadpole-${escapeAttribute(
    kind.replace(/\s+/g, "-")
  )}">${body}${core}</g>`;
}

function circuitikzTransformerCommands(item) {
  const hw = item.width / 2;
  const hh = item.height / 2;
  const terminalY = hh * 0.56;
  const inner = circuitikzQuadpoleInnerRatio(item);
  const leftCoilX = -hw * inner;
  const rightCoilX = hw * inner;
  const leadX = hw * Math.min(0.92, Math.max(0.62, inner * 0.9));
  const leftSpec = item.shapeData?.quadpoleSettings?.coils?.L1 || {};
  const rightSpec = item.shapeData?.quadpoleSettings?.coils?.L2 || {};
  const leftTurns = circuitikzTransformerCoilTurns(leftSpec, 5);
  const rightTurns = circuitikzTransformerCoilTurns(rightSpec, 5);
  const leftAmplitude = -circuitikzTransformerCoilAmplitude(hw, leftSpec);
  const rightAmplitude = circuitikzTransformerCoilAmplitude(hw, rightSpec);
  const leftCoilY = circuitikzTransformerCoilHalfSpan(hh, leftSpec);
  const rightCoilY = circuitikzTransformerCoilHalfSpan(hh, rightSpec);
  return [
    ["M", -hw, terminalY],
    ["L", -hw, -terminalY],
    ["M", hw, terminalY],
    ["L", hw, -terminalY],
    ["M", -hw, terminalY],
    ["L", -leadX, terminalY],
    ["L", leftCoilX, terminalY],
    ["L", leftCoilX, leftCoilY],
    ...verticalCoilCommands(leftCoilX, leftCoilY, -leftCoilY, leftAmplitude, leftTurns),
    ["L", leftCoilX, -terminalY],
    ["L", -leadX, -terminalY],
    ["L", -hw, -terminalY],
    ["M", hw, terminalY],
    ["L", leadX, terminalY],
    ["L", rightCoilX, terminalY],
    ["L", rightCoilX, rightCoilY],
    ...verticalCoilCommands(rightCoilX, rightCoilY, -rightCoilY, rightAmplitude, rightTurns),
    ["L", rightCoilX, -terminalY],
    ["L", leadX, -terminalY],
    ["L", hw, -terminalY]
  ];
}

function circuitikzQuadpoleInnerRatio(item = {}) {
  const raw = Number(item.shapeData?.quadpoleSettings?.inner);
  return Number.isFinite(raw) ? Math.max(0.12, Math.min(1.1, raw)) : 0.4;
}

function circuitikzTransformerCoilTurns(spec = {}, fallback = 5) {
  const raw = Number(spec["inductors/coils"] ?? spec.coils);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(12, Math.round(raw)));
}

function circuitikzTransformerCoilAmplitude(halfWidth, spec = {}) {
  const raw = Number(spec["inductors/width"] ?? spec.width ?? 0.8);
  const widthScale = Number.isFinite(raw) ? Math.max(0.75, Math.min(1.25, raw / 0.8)) : 1;
  return Math.max(halfWidth * 0.12, halfWidth * 0.2 * widthScale);
}

function circuitikzTransformerCoilHalfSpan(halfHeight, spec = {}) {
  const terminalY = halfHeight * 0.56;
  const raw = Number(spec["inductors/width"] ?? spec.width ?? 0.8);
  const ratio = Number.isFinite(raw) ? Math.max(0.14, Math.min(0.7, raw * 0.68)) : 0.54;
  return terminalY * ratio;
}

function circuitikzTransformerCoreCommands(item) {
  const hw = item.width / 2;
  const hh = item.height / 2;
  const x = hw * 0.07;
  const y = hh * 0.48;
  return [
    ["M", -x, y],
    ["L", -x, -y],
    ["M", x, y],
    ["L", x, -y]
  ];
}

function circuitikzGyratorCommands(item) {
  const hw = item.width / 2;
  const hh = item.height / 2;
  const terminalY = hh * 0.56;
  const innerX = hw * 0.34;
  const curveY = terminalY * 0.92;
  return [
    ["M", -hw, terminalY],
    ["L", -innerX, terminalY],
    ["L", -innerX, -terminalY],
    ["L", -hw, -terminalY],
    ["M", hw, terminalY],
    ["L", innerX, terminalY],
    ["L", innerX, -terminalY],
    ["L", hw, -terminalY],
    ["M", -innerX, curveY],
    ["Q", 0, 0, -innerX, -curveY],
    ["M", innerX, -curveY],
    ["Q", 0, 0, innerX, curveY]
  ];
}

function verticalCoilCommands(x, top, bottom, amplitude, turns) {
  const commands = [];
  const step = (top - bottom) / turns;
  for (let index = 0; index < turns; index += 1) {
    const y0 = top - step * index;
    const yMid = top - step * (index + 0.5);
    const y1 = top - step * (index + 1);
    commands.push(["Q", x + amplitude, yMid, x, y1]);
  }
  return commands;
}

function tubeCapsulePath(rx, ry) {
  if (rx > ry) {
    const straight = Math.max(0, rx - ry);
    return {
      full: [
        ["M", -straight, ry],
        ["L", straight, ry],
        ["Q", rx, ry, rx, 0],
        ["Q", rx, -ry, straight, -ry],
        ["L", -straight, -ry],
        ["Q", -rx, -ry, -rx, 0],
        ["Q", -rx, ry, -straight, ry],
        ["Z"]
      ],
      parts: [
        [["M", -rx, 0], ["Q", -rx, ry, -straight, ry]],
        [["M", -straight, ry], ["L", straight, ry]],
        [["M", straight, ry], ["Q", rx, ry, rx, 0]],
        [["M", rx, 0], ["Q", rx, -ry, straight, -ry]],
        [["M", straight, -ry], ["L", -straight, -ry]],
        [["M", -straight, -ry], ["Q", -rx, -ry, -rx, 0]]
      ]
    };
  }
  const straight = Math.max(0, ry - rx);
  return {
    full: [
      ["M", -rx, straight],
      ["Q", -rx, ry, 0, ry],
      ["Q", rx, ry, rx, straight],
      ["L", rx, -straight],
      ["Q", rx, -ry, 0, -ry],
      ["Q", -rx, -ry, -rx, -straight],
      ["L", -rx, straight],
      ["Z"]
    ],
    parts: [
      [["M", 0, ry], ["Q", rx, ry, rx, straight]],
      [["M", rx, straight], ["L", rx, -straight]],
      [["M", rx, -straight], ["Q", rx, -ry, 0, -ry]],
      [["M", 0, -ry], ["Q", -rx, -ry, -rx, -straight]],
      [["M", -rx, -straight], ["L", -rx, straight]],
      [["M", -rx, straight], ["Q", -rx, ry, 0, ry]]
    ]
  };
}

function circuitikzTubeElectrodePath(item) {
  const halfWidth = item.width / 2;
  const halfHeight = item.height / 2;
  const kind = item.shapeData?.tubeKind || "pentode";
  const grids = kind === "pentode" ? [-0.2, 0, 0.2] : kind === "tetrode" ? [-0.1, 0.1] : kind === "triode" ? [0] : [];
  const commands = [
    ["M", 0, halfHeight],
    ["L", 0, halfHeight * 0.4],
    ["M", -halfWidth * 0.4, halfHeight * 0.4],
    ["L", halfWidth * 0.4, halfHeight * 0.4],
    ["M", -halfWidth * 0.4, -halfHeight],
    ["L", -halfWidth * 0.4, -halfHeight * 0.4],
    ["L", halfWidth * 0.4, -halfHeight * 0.4],
    ["L", halfWidth * 0.4, -halfHeight * 0.475]
  ];
  for (const grid of grids) {
    const y = grid * halfHeight;
    const left = -halfWidth * 0.65;
    const right = halfWidth * 0.4;
    commands.push(["M", -halfWidth, y], ["L", left, y]);
    for (let index = 0; index < 5; index += 1) {
      const x1 = left + (right - left) * ((index * 2 + 1) / 11);
      const x2 = left + (right - left) * ((index * 2 + 2) / 11);
      commands.push(["M", x1, y], ["L", x2, y]);
    }
  }
  return commands;
}

function localTubePathData(commands, cx, cy, unit) {
  return commands
    .map((command) => {
      if (command[0] === "Z") return "Z";
      if (command[0] === "M" || command[0] === "L") return `${command[0]} ${format((cx + command[1]) * unit)} ${format(-(cy + command[2]) * unit)}`;
      if (command[0] === "Q") {
        return `Q ${format((cx + command[1]) * unit)} ${format(-(cy + command[2]) * unit)} ${format((cx + command[3]) * unit)} ${format(
          -(cy + command[4]) * unit
        )}`;
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function moveLine(from, to) {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

function localPathData(data, cx, cy, unit) {
  return data.replace(/([ML])\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/gi, (_match, command, x, y) => {
    const px = (cx + Number(x)) * unit;
    const py = -(cy + Number(y)) * unit;
    return `${command} ${format(px)} ${format(py)}`;
  });
}

function transistorArrowPolygon(from, to, item) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const size = Math.max(0.075, Math.min(item.width || 0.6, item.height || 1.1) * 0.14);
  const tip = {
    x: from.x + dx * 0.72,
    y: from.y + dy * 0.72
  };
  const base = {
    x: tip.x - ux * size * 1.2,
    y: tip.y - uy * size * 1.2
  };
  return [
    tip,
    { x: base.x + nx * size * 0.62, y: base.y + ny * size * 0.62 },
    { x: base.x - nx * size * 0.62, y: base.y - ny * size * 0.62 }
  ];
}

function renderCircleCrossSplitNodeBox(item, unit) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const rx = (item.width / 2) * unit;
  const ry = (item.height / 2) * unit;
  const stroke = item.style?.stroke || "black";
  const width = item.style?.lineWidth || 1;
  return `<g class="tikz-node-shape tikz-node-circleCrossSplit"><ellipse cx="${format(cx)}" cy="${format(cy)}" rx="${format(rx)}" ry="${format(
    ry
  )}"${styleAttributes(item.style)} /><path d="M ${format(cx - rx)} ${format(cy)} L ${format(cx + rx)} ${format(cy)} M ${format(
    cx
  )} ${format(cy - ry)} L ${format(cx)} ${format(cy + ry)}" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${format(
    width
  )}" /></g>`;
}

function renderDiamondNodeBox(item, unit) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const hw = (item.width / 2) * unit;
  const hh = (item.height / 2) * unit;
  const points = [
    [cx, cy - hh],
    [cx + hw, cy],
    [cx, cy + hh],
    [cx - hw, cy]
  ]
    .map(([x, y]) => `${format(x)},${format(y)}`)
    .join(" ");
  return `<polygon points="${points}"${styleAttributes(item.style)} />`;
}

function renderLibraryShapeNodeBox(item, unit) {
  const commands = nodeShapeCommands(item);
  return `<path class="tikz-node-shape tikz-node-${escapeAttribute(item.shape)}" d="${pathData(commands, unit)}"${styleAttributes(
    item.style
  )} />`;
}

function nodeShapeCommands(item) {
  const center = { x: item.x, y: item.y };
  const halfWidth = item.width / 2;
  const halfHeight = item.height / 2;
  if (item.shape === "regularPolygon") {
    return closedPolygonCommands(regularPolygonNodePoints(center, halfWidth, halfHeight, item.shapeData?.regularPolygonSides || 5, 90));
  }
  if (item.shape === "star") {
    return closedPolygonCommands(starNodePoints(center, halfWidth, halfHeight, item.shapeData?.starPoints || 5, item.shapeData?.starPointRatio || 1.5));
  }
  if (item.shape === "trapezium") {
    return closedPolygonCommands(trapeziumNodePoints(center, halfWidth, halfHeight, item.shapeData || {}));
  }
  if (item.shape === "isoscelesTriangle") {
    return closedPolygonCommands(isoscelesTriangleNodePoints(center, halfWidth, halfHeight));
  }
  if (item.shape === "cloud") {
    return cloudNodeCommands(center, halfWidth, halfHeight);
  }
  if (item.shape === "superellipse") {
    return superellipseNodeCommands(center, halfWidth, halfHeight);
  }
  if (item.shape === "singleArrow" || item.shape === "doubleArrow") {
    return closedPolygonCommands(arrowNodePoints(center, halfWidth, halfHeight, item.shape, item.shapeData || {}));
  }
  return closedPolygonCommands(rectangleNodePoints(center, halfWidth, halfHeight));
}

function superellipseNodeCommands(center, halfWidth, halfHeight) {
  const k = 0.42;
  return [
    { type: "moveTo", x: center.x, y: center.y + halfHeight },
    { type: "curveTo", x1: center.x + halfWidth * k, y1: center.y + halfHeight, x2: center.x + halfWidth, y2: center.y + halfHeight * k, x: center.x + halfWidth, y: center.y },
    { type: "curveTo", x1: center.x + halfWidth, y1: center.y - halfHeight * k, x2: center.x + halfWidth * k, y2: center.y - halfHeight, x: center.x, y: center.y - halfHeight },
    { type: "curveTo", x1: center.x - halfWidth * k, y1: center.y - halfHeight, x2: center.x - halfWidth, y2: center.y - halfHeight * k, x: center.x - halfWidth, y: center.y },
    { type: "curveTo", x1: center.x - halfWidth, y1: center.y + halfHeight * k, x2: center.x - halfWidth * k, y2: center.y + halfHeight, x: center.x, y: center.y + halfHeight },
    { type: "closePath" }
  ];
}

function closedPolygonCommands(points) {
  if (!points.length) return [];
  return [
    { type: "moveTo", x: points[0].x, y: points[0].y },
    ...points.slice(1).map((point) => ({ type: "lineTo", x: point.x, y: point.y })),
    { type: "closePath" }
  ];
}

function regularPolygonNodePoints(center, halfWidth, halfHeight, sides, startAngle) {
  const count = Math.max(3, Math.round(sides));
  return Array.from({ length: count }, (_unused, index) => {
    const angle = ((startAngle + (360 * index) / count) * Math.PI) / 180;
    return {
      x: center.x + Math.cos(angle) * halfWidth,
      y: center.y + Math.sin(angle) * halfHeight
    };
  });
}

function starNodePoints(center, halfWidth, halfHeight, points, ratio) {
  const count = Math.max(3, Math.round(points));
  const innerRatio = 1 / Math.max(1.05, Number(ratio) || 1.5);
  return Array.from({ length: count * 2 }, (_unused, index) => {
    const angle = ((90 + (360 * index) / (count * 2)) * Math.PI) / 180;
    const scale = index % 2 === 0 ? 1 : innerRatio;
    return {
      x: center.x + Math.cos(angle) * halfWidth * scale,
      y: center.y + Math.sin(angle) * halfHeight * scale
    };
  });
}

function trapeziumNodePoints(center, halfWidth, halfHeight, data = {}) {
  const left = Math.max(10, Math.min(170, data.trapeziumLeftAngle || 60));
  const right = Math.max(10, Math.min(170, data.trapeziumRightAngle || 60));
  const leftInset = Math.cos((left * Math.PI) / 180) * halfHeight * 0.7;
  const rightInset = Math.cos((right * Math.PI) / 180) * halfHeight * 0.7;
  return [
    { x: center.x - halfWidth + leftInset, y: center.y + halfHeight },
    { x: center.x + halfWidth - rightInset, y: center.y + halfHeight },
    { x: center.x + halfWidth + rightInset, y: center.y - halfHeight },
    { x: center.x - halfWidth - leftInset, y: center.y - halfHeight }
  ];
}

function isoscelesTriangleNodePoints(center, halfWidth, halfHeight) {
  return [
    { x: center.x + halfWidth, y: center.y },
    { x: center.x - halfWidth, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y - halfHeight }
  ];
}

function rectangleNodePoints(center, halfWidth, halfHeight) {
  return [
    { x: center.x - halfWidth, y: center.y + halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x - halfWidth, y: center.y - halfHeight }
  ];
}

function arrowNodePoints(center, halfWidth, halfHeight, shape, data = {}) {
  const headExtend = Math.max(0, Number(data.arrowHeadExtend) || 0.25);
  const headIndent = Math.max(0, Number(data.arrowHeadIndent) || 0);
  const headLength = Math.min(halfWidth * 0.82, Math.max(halfHeight * 0.82, headExtend * 1.15, 0.12));
  const bodyHalf = Math.max(0.02, Math.min(halfHeight * 0.72, halfHeight - Math.min(headExtend, halfHeight * 0.48)));
  const indent = Math.min(headIndent, headLength * 0.7);
  const rightBase = halfWidth - headLength;
  const rightNeck = rightBase + indent;
  const local = shape === "doubleArrow"
    ? (() => {
        const leftBase = -rightBase;
        const leftNeck = -rightNeck;
        return [
          { x: halfWidth, y: 0 },
          { x: rightBase, y: halfHeight },
          { x: rightNeck, y: bodyHalf },
          { x: leftNeck, y: bodyHalf },
          { x: leftBase, y: halfHeight },
          { x: -halfWidth, y: 0 },
          { x: leftBase, y: -halfHeight },
          { x: leftNeck, y: -bodyHalf },
          { x: rightNeck, y: -bodyHalf },
          { x: rightBase, y: -halfHeight }
        ];
      })()
    : [
        { x: halfWidth, y: 0 },
        { x: rightBase, y: halfHeight },
        { x: rightNeck, y: bodyHalf },
        { x: -halfWidth, y: bodyHalf },
        { x: -halfWidth, y: -bodyHalf },
        { x: rightNeck, y: -bodyHalf },
        { x: rightBase, y: -halfHeight }
      ];
  const rotate = Number(data.shapeBorderRotate) || 0;
  return local.map((point) => {
    const rotated = rotate ? rotatePoint(point, rotate) : point;
    return { x: center.x + rotated.x, y: center.y + rotated.y };
  });
}

function rotatePoint(point, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos
  };
}

function cloudNodeCommands(center, halfWidth, halfHeight) {
  const steps = 24;
  const commands = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    const ripple = 1 + 0.11 * Math.sin(angle * 7);
    const point = {
      x: center.x + Math.cos(angle) * halfWidth * ripple,
      y: center.y + Math.sin(angle) * halfHeight * ripple
    };
    commands.push(index === 0 ? { type: "moveTo", ...point } : { type: "lineTo", ...point });
  }
  commands.push({ type: "closePath" });
  return commands;
}

function renderNodeBoxWithOverlay(item, baseSvg, unit) {
  const shadows = renderNodeBoxShadows(item, unit);
  const overlay = renderNodeBoxOverlay(item, unit);
  const grouped = shadows || overlay ? `<g>${shadows}${baseSvg}${overlay}</g>` : baseSvg;
  return wrapNodeRotation(grouped, item, unit);
}

function renderNodeBoxShadows(item, unit) {
  if (!Array.isArray(item.shadows) || !item.shadows.length) return "";
  return item.shadows.map((shadow) => renderNodeBoxShadow(item, shadow, unit)).join("");
}

function renderNodeBoxShadow(item, shadow, unit) {
  const scale = Number(shadow.scale) > 0 ? Number(shadow.scale) : 1;
  const shadowStyle = {
    ...(shadow.style || item.style || {}),
    filter: shadow.blur ? `url(#${blurShadowFilterId(shadow)})` : shadow.style?.filter
  };
  const shadowItem = {
    ...item,
    x: item.x + (Number(shadow.xshift) || 0),
    y: item.y + (Number(shadow.yshift) || 0),
    width: item.width * scale,
    height: item.height * scale,
    rx: (item.rx || 0) * scale,
    style: shadowStyle
  };
  if (shadowItem.shape === "circle" || shadowItem.shape === "ellipse") {
    return `<ellipse class="tikz-node-shadow" cx="${format(shadowItem.x * unit)}" cy="${format(-shadowItem.y * unit)}" rx="${format(
      (shadowItem.width / 2) * unit
    )}" ry="${format((shadowItem.height / 2) * unit)}"${styleAttributes(shadowItem.style)} />`;
  }
  if (shadowItem.shape === "diamond") {
    const cx = shadowItem.x * unit;
    const cy = -shadowItem.y * unit;
    const hw = (shadowItem.width / 2) * unit;
    const hh = (shadowItem.height / 2) * unit;
    const points = [
      [cx, cy - hh],
      [cx + hw, cy],
      [cx, cy + hh],
      [cx - hw, cy]
    ]
      .map(([x, y]) => `${format(x)},${format(y)}`)
      .join(" ");
    return `<polygon class="tikz-node-shadow" points="${points}"${styleAttributes(shadowItem.style)} />`;
  }
  if (["regularPolygon", "star", "trapezium", "isoscelesTriangle", "cloud", "superellipse", "singleArrow", "doubleArrow"].includes(shadowItem.shape)) {
    return `<path class="tikz-node-shadow" d="${pathData(nodeShapeCommands(shadowItem), unit)}"${styleAttributes(shadowItem.style)} />`;
  }
  return `<rect class="tikz-node-shadow" x="${format((shadowItem.x - shadowItem.width / 2) * unit)}" y="${format(
    -(shadowItem.y + shadowItem.height / 2) * unit
  )}" width="${format(shadowItem.width * unit)}" height="${format(shadowItem.height * unit)}" rx="${format(
    (shadowItem.rx || 0) * unit
  )}"${styleAttributes(shadowItem.style)} />`;
}

function renderNodeBoxOverlay(item, unit) {
  const overlays = [];
  if (item.doubleColor !== undefined) overlays.push(renderDoubleNodeOutline(item, unit));
  if (String(item.pathPicture || "").includes("path picture bounding box")) overlays.push(renderPathPictureOverlay(item, unit));
  if (item.bpmnIcon) overlays.push(renderBpmnIcon(item, unit));
  if (item.bpmnMarker) overlays.push(renderBpmnMarker(item, unit));
  return overlays.filter(Boolean).join("");
}

function renderPathPictureOverlay(item, unit) {
  const x1 = (item.x - item.width / 2) * unit;
  const x2 = (item.x + item.width / 2) * unit;
  const y1 = -(item.y + item.height / 2) * unit;
  const y2 = -(item.y - item.height / 2) * unit;
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const width = format(Math.max(1, item.style?.lineWidth ?? 1));
  return `<path d="M ${format(x1)} ${format(y2)} L ${format(x2)} ${format(y1)} M ${format(x1)} ${format(y1)} L ${format(
    x2
  )} ${format(y2)}" stroke="${stroke}" fill="none" stroke-width="${width}" />`;
}

function renderPathElement(item, unit) {
  if (!item.style?.markerStart && !item.style?.markerEnd) {
    if (item.style?.doubleColor !== undefined) {
      if (usesCompactDashedDoubleStroke(item.style)) {
        return renderCompactDashedDoublePath(item.commands || [], item.style, unit);
      }
      return renderDoublePath(item.commands || [], item.style, unit);
    }
    if (item.subtype === "bagua-line") {
      return `<path d="${pathData(item.commands, unit)}"${styleAttributes(item.style, { lineCap: "butt", lineJoin: "miter" })} />`;
    }
    return `<path d="${pathData(item.commands, unit)}"${styleAttributes(item.style)} />`;
  }
  return renderArrowedPath(item, unit);
}

function renderArrowedPath(item, unit) {
  const style = item.style || {};
  const terminal = pathTerminalSegments(item.commands || []);
  const startTip = style.markerStart ? resolveInlineArrowTip(style.markerStart, style) : null;
  const endTip = style.markerEnd ? resolveInlineArrowTip(style.markerEnd, style) : null;
  const startShorten = startTip && terminal.first?.shortenable ? startTip.geometry.shorten / unit : 0;
  const endShorten = endTip && terminal.last?.shortenable ? endTip.geometry.shorten / unit : 0;
  const commands = shortenPathTerminals(item.commands || [], terminal, startShorten, endShorten);
  const pathStyle = { ...style, markerStart: undefined, markerEnd: undefined };
  const pieces = [
    pathStyle.doubleColor !== undefined
      ? renderDoublePath(commands, pathStyle, unit, { lineCap: "butt", lineJoin: "miter", omitWrapper: true })
      : `<path d="${pathData(commands, unit)}"${styleAttributes(pathStyle, { omitMarkers: true, lineCap: "butt", lineJoin: "miter" })} />`
  ];

  if (startTip && terminal.first) {
    pieces.push(renderInlineArrowTip(startTip, terminal.first.start, terminal.first.angle + 180, unit));
  }
  if (endTip && terminal.last) {
    pieces.push(renderInlineArrowTip(endTip, terminal.last.end, terminal.last.angle, unit));
  }
  return `<g class="tikz-arrowed-path${pathStyle.doubleColor !== undefined ? " tikz-double-path" : ""}">${pieces.join("")}</g>`;
}

function renderDoublePath(commands, style = {}, unit, options = {}) {
  const { outerStyle, innerStyle } = doubleStrokeStyles(style);
  const data = pathData(commands, unit);
  const strokeOptions = { omitMarkers: true, lineCap: options.lineCap, lineJoin: options.lineJoin };
  const paths = [
    `<path class="tikz-double-outer" d="${data}"${styleAttributes(outerStyle, strokeOptions)} />`,
    `<path class="tikz-double-inner" d="${data}"${styleAttributes(innerStyle, strokeOptions)} />`
  ].join("");
  if (options.omitWrapper) return paths;
  return `<g class="tikz-double-path">${paths}</g>`;
}

function renderCompactDashedDoublePath(commands, style = {}, unit) {
  const compactStyle = {
    ...style,
    fill: "none",
    markerStart: undefined,
    markerEnd: undefined,
    doubleColor: undefined,
    doubleDistance: undefined
  };
  return `<path class="tikz-compact-dashed-double" d="${pathData(commands, unit)}"${styleAttributes(compactStyle, {
    omitMarkers: true,
    lineCap: "butt",
    lineJoin: "miter"
  })} />`;
}

function usesCompactDashedDoubleStroke(style = {}) {
  if (!Array.isArray(style.dashArray) || !style.dashArray.length) return false;
  const stroke = String(style.stroke || "").trim().toLowerCase();
  return stroke === "gray" || stroke === "grey" || stroke === "#808080" || stroke === "rgb(128 128 128)" || stroke === "rgb(50% 50% 50%)";
}

function doubleStrokeStyles(style = {}) {
  const lineWidth = Number(style.lineWidth) || 1;
  const innerWidth = Number.isFinite(style.doubleDistance) ? style.doubleDistance : lineWidthFromPt(0.6);
  return {
    outerStyle: {
      ...style,
      fill: "none",
      markerStart: undefined,
      markerEnd: undefined,
      lineWidth: lineWidth * 2 + innerWidth
    },
    innerStyle: {
      ...style,
      stroke: style.doubleColor || "white",
      fill: "none",
      markerStart: undefined,
      markerEnd: undefined,
      lineWidth: innerWidth
    }
  };
}

function pathTerminalSegments(commands) {
  let current = null;
  let currentIndex = -1;
  let first = null;
  let last = null;
  commands.forEach((command, index) => {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      currentIndex = index;
      return;
    }
    if (!current) return;
    if (command.type === "lineTo") {
      const end = { x: command.x, y: command.y };
      const segment = terminalSegment(current, end, currentIndex, index, true);
      if (segment) {
        first ||= segment;
        last = segment;
      }
      current = end;
      currentIndex = index;
      return;
    }
    if (command.type === "quadTo") {
      const end = { x: command.x, y: command.y };
      const control = { x: command.x1, y: command.y1 };
      const segment = terminalSegment(current, end, currentIndex, index, true, control, control);
      if (segment) {
        first ||= segment;
        last = segment;
      }
      current = end;
      currentIndex = index;
      return;
    }
    if (command.type === "curveTo") {
      const end = { x: command.x, y: command.y };
      const segment = terminalSegment(current, end, currentIndex, index, true, { x: command.x1, y: command.y1 }, { x: command.x2, y: command.y2 });
      if (segment) {
        first ||= segment;
        last = segment;
      }
      current = end;
      currentIndex = index;
    }
  });
  return { first, last };
}

function terminalSegment(start, end, startIndex, commandIndex, shortenable, startControl = end, endControl = start) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return null;
  const tangentStart = Math.hypot(startControl.x - start.x, startControl.y - start.y)
    ? { x: startControl.x - start.x, y: startControl.y - start.y }
    : { x: dx, y: dy };
  const tangentEnd = Math.hypot(end.x - endControl.x, end.y - endControl.y)
    ? { x: end.x - endControl.x, y: end.y - endControl.y }
    : { x: dx, y: dy };
  const startLength = Math.hypot(tangentStart.x, tangentStart.y) || length;
  const endLength = Math.hypot(tangentEnd.x, tangentEnd.y) || length;
  return {
    start,
    end,
    startIndex,
    commandIndex,
    shortenable,
    ux: dx / length,
    uy: dy / length,
    startUx: tangentStart.x / startLength,
    startUy: tangentStart.y / startLength,
    endUx: tangentEnd.x / endLength,
    endUy: tangentEnd.y / endLength,
    angle: svgAngle(tangentEnd)
  };
}

function shortenPathTerminals(commands, terminal, startAmount, endAmount) {
  if (!startAmount && !endAmount) return commands;
  const adjusted = commands.map((command) => ({ ...command }));
  if (startAmount && terminal.first) {
    const command = adjusted[terminal.first.startIndex];
    if (command && Number.isFinite(command.x) && Number.isFinite(command.y)) {
      command.x += (terminal.first.startUx ?? terminal.first.ux) * startAmount;
      command.y += (terminal.first.startUy ?? terminal.first.uy) * startAmount;
    }
  }
  if (endAmount && terminal.last) {
    const command = adjusted[terminal.last.commandIndex];
    if (command && Number.isFinite(command.x) && Number.isFinite(command.y)) {
      command.x -= (terminal.last.endUx ?? terminal.last.ux) * endAmount;
      command.y -= (terminal.last.endUy ?? terminal.last.uy) * endAmount;
    }
  }
  return adjusted;
}

function svgAngle(vector) {
  return (Math.atan2(-vector.y, vector.x) * 180) / Math.PI;
}

function resolveInlineArrowTip(tip, style = {}) {
  const source = typeof tip === "string" ? {} : tip || {};
  const raw = typeof tip === "string" ? createArrowTip(tip === "arrow" ? "to" : tip) : createArrowTip(tip?.kind, source);
  const baseStroke = style.stroke === "none" ? "black" : style.stroke || "black";
  const explicitStroke = source.stroke && source.stroke !== "context-stroke";
  const fill = raw.fill && raw.fill !== "context-stroke" ? raw.fill : baseStroke;
  const geometry = inlineArrowGeometry(raw, style, {
    customLength: usesCustomArrowDimension(source, raw, "length"),
    customWidth: usesCustomArrowDimension(source, raw, "width")
  });
  const openTip = raw.kind === "to" || raw.kind === "hook" || raw.kind === "two-heads" || raw.kind === "open-circle" || raw.kind === "open-triangle";
  const barTip = raw.kind === "bar";
  const filledStrokedTip = raw.kind === "dimline" || raw.kind === "dimline reverse";
  return {
    kind: raw.kind,
    geometry,
    stroke: openTip || barTip || filledStrokedTip || explicitStroke ? (raw.stroke === "context-stroke" ? baseStroke : raw.stroke || baseStroke) : "none",
    fill: openTip || barTip ? "none" : fill,
    strokeWidth: barTip
      ? raw.lineWidth || style.lineWidth || 1
      : openTip
      ? style.lineWidth ?? 1
      : filledStrokedTip
        ? Math.max(0.2, (style.lineWidth ?? 1) * 0.5)
        : explicitStroke
          ? Math.max(0.8, (style.lineWidth ?? 1) * 0.45)
          : 0
  };
}

function usesCustomArrowDimension(source = {}, raw = {}, key) {
  if (source[`custom${key[0].toUpperCase()}${key.slice(1)}`] || source[`${key}Explicit`]) return true;
  if (!Number.isFinite(source[key])) return false;
  const defaultTip = createArrowTip(raw.kind || source.kind || "to");
  return Math.abs(source[key] - defaultTip[key]) > 1e-6;
}

function inlineArrowGeometry(tip, style = {}, flags = {}) {
  const lineWidth = Math.max(0.01, style.lineWidth ?? 1);
  const lineWidthPt = lineWidth / lineWidthFromPt(1);
  if (tip.kind === "stealth") {
    const length = flags.customLength ? tip.length : lineWidthFromPt(3 + 1.25 * lineWidthPt);
    const halfWidth = flags.customWidth ? tip.width / 2 : length * 0.5;
    return {
      path: `M 0 0 L ${format(-length)} ${format(-halfWidth)} L ${format(-length * 0.625)} 0 L ${format(-length)} ${format(halfWidth)} Z`,
      shorten: length * 0.625
    };
  }
  if (tip.kind === "latex") {
    const length = flags.customLength ? tip.length : lineWidthFromPt(3.2 + 2.4 * lineWidthPt);
    const halfWidth = flags.customWidth ? tip.width / 2 : lineWidthFromPt(1.2 + 0.9 * lineWidthPt);
    return {
      path: [
        `M 0 0`,
        `C ${format(-length * 0.266)} ${format(-halfWidth * 0.132)} ${format(-length * 0.7)} ${format(-halfWidth * 0.533)} ${format(-length)} ${format(-halfWidth)}`,
        `L ${format(-length)} ${format(halfWidth)}`,
        `C ${format(-length * 0.7)} ${format(halfWidth * 0.533)} ${format(-length * 0.266)} ${format(halfWidth * 0.132)} 0 0 Z`
      ].join(" "),
      shorten: length * 0.9
    };
  }
  if (tip.kind === "two-heads") {
    const length = tip.length;
    const halfWidth = tip.width / 2;
    return {
      path: `M 0 0 L ${format(-length * 0.56)} ${format(-halfWidth)} M 0 0 L ${format(-length * 0.56)} ${format(halfWidth)} M ${format(
        -length * 0.44
      )} 0 L ${format(-length)} ${format(-halfWidth)} M ${format(-length * 0.44)} 0 L ${format(-length)} ${format(halfWidth)}`,
      shorten: lineWidth
    };
  }
  if (tip.kind === "hook") {
    const length = tip.length;
    const halfWidth = tip.width / 2;
    const curl = length * 0.34;
    return {
      path: `M 0 ${format(halfWidth)} C ${format(curl * 0.55)} ${format(halfWidth)} ${format(curl)} ${format(halfWidth * 0.52)} ${format(
        curl
      )} ${format(halfWidth * 0.25)} C ${format(curl)} ${format(halfWidth * 0.05)} ${format(curl * 0.45)} 0 0 0`,
      shorten: 0
    };
  }
  if (tip.kind === "open-circle") {
    const radius = tip.width / 2;
    return {
      path: `M ${format(-radius)} 0 A ${format(radius)} ${format(radius)} 0 1 0 ${format(radius)} 0 A ${format(radius)} ${format(radius)} 0 1 0 ${format(
        -radius
      )} 0`,
      shorten: radius
    };
  }
  if (tip.kind === "circle") {
    const radius = tip.width / 2;
    return {
      path: `M ${format(-radius)} 0 A ${format(radius)} ${format(radius)} 0 1 0 ${format(radius)} 0 A ${format(radius)} ${format(radius)} 0 1 0 ${format(
        -radius
      )} 0`,
      shorten: radius
    };
  }
  if (tip.kind === "open-triangle") {
    const length = tip.length;
    const halfWidth = tip.width / 2;
    return {
      path: `M 0 0 L ${format(-length)} ${format(-halfWidth)} L ${format(-length)} ${format(halfWidth)} Z`,
      shorten: length
    };
  }
  if (tip.kind === "bar") {
    const halfWidth = tip.width / 2;
    return {
      path: `M 0 ${format(-halfWidth)} L 0 ${format(halfWidth)}`,
      shorten: 0
    };
  }
  if (tip.kind === "dimline" || tip.kind === "dimline reverse") {
    const scale = lineWidth;
    const sign = tip.kind === "dimline reverse" ? 1 : -1;
    return {
      path: [
        `M 0 ${format(3 * scale)}`,
        `L 0 ${format(-3 * scale)}`,
        `M 0 0`,
        `L ${format(sign * 7.5 * scale)} ${format(2 * scale)}`,
        `L ${format(sign * 7.5 * scale)} ${format(-2 * scale)}`,
        "Z"
      ].join(" "),
      shorten: lineWidth * 0.2
    };
  }
  const back = flags.customLength ? tip.length : lineWidthFromPt(0.280535 + 2.289088 * lineWidthPt);
  const halfWidth = flags.customWidth ? tip.width / 2 : lineWidthFromPt(0.474889 + 2.796962 * lineWidthPt);
  return {
    path: [
      `M ${format(-back)} ${format(halfWidth)}`,
      `C ${format(-back * 0.817)} ${format(halfWidth * 0.4)} ${format(-back * 0.409)} ${format(halfWidth * 0.116)} 0 0`,
      `C ${format(-back * 0.409)} ${format(-halfWidth * 0.116)} ${format(-back * 0.817)} ${format(-halfWidth * 0.4)} ${format(-back)} ${format(
        -halfWidth
      )}`
    ].join(" "),
    shorten: lineWidth
  };
}

function renderInlineArrowTip(tip, point, angle, unit) {
  const strokePart = tip.strokeWidth > 0 ? ` stroke="${escapeAttribute(tip.stroke)}" stroke-width="${format(tip.strokeWidth)}"` : ` stroke="none"`;
  const lineStyle = tip.strokeWidth > 0 ? ` stroke-linecap="round" stroke-linejoin="round"` : "";
  return `<path class="tikz-arrow-tip tikz-arrow-${escapeAttribute(tip.kind)}" d="${tip.geometry.path}" fill="${escapeAttribute(
    tip.fill
  )}"${strokePart}${lineStyle} transform="translate(${format(point.x * unit)} ${format(-point.y * unit)}) rotate(${format(angle)})" />`;
}

function renderTikzquadsNodeBox(item, unit, options = {}) {
  if (item.shape === "tikzquadsPgLoadLine") return renderTikzquadsPgLoadLine(item, unit, options);
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const hw = (item.width / 2) * unit;
  const hh = (item.height / 2) * unit;
  const terminal = Math.max(5, hw * (item.shape === "tikzquadsBlackBox" ? 5 / 19 : 5 / 33));
  const left = cx - hw + terminal;
  const right = cx + hw - terminal;
  const top = cy - hh;
  const bottom = cy + hh;
  const portY = hh * (5 / 7);
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const fill = escapeAttribute(item.style?.fill || "none");
  const lineWidth = format(item.style?.lineWidth || 1);
  const group = [`<g class="tikz-node-shape tikz-node-${escapeAttribute(item.shape)}">`];
  group.push(
    `<rect x="${format(left)}" y="${format(top)}" width="${format(right - left)}" height="${format(
      bottom - top
    )}" fill="${fill}" stroke="${stroke}" stroke-width="${lineWidth}" />`
  );
  group.push(renderTikzquadsPorts(item, { cx, cy, hw, hh, left, right, portY, terminal, stroke, lineWidth }));
  group.push(renderTikzquadsInternals(item, { cx, cy, hw, hh, left, right, portY, stroke, lineWidth }));
  group.push(renderTikzquadsLabels(item, { cx, cy, hw, hh, left, right, portY, stroke }, unit, options));
  group.push("</g>");
  return group.filter(Boolean).join("");
}

function renderTikzquadsPorts(item, box) {
  const { cx, cy, hw, left, right, portY, stroke, lineWidth } = box;
  const leftOuter = cx - hw;
  const pieces = [
    `<path d="M ${format(leftOuter)} ${format(cy - portY)} L ${format(left)} ${format(cy - portY)} M ${format(leftOuter)} ${format(
      cy + portY
    )} L ${format(left)} ${format(cy + portY)}" fill="none" stroke="${stroke}" stroke-width="${lineWidth}" />`,
    renderTikzquadsPolarity(leftOuter + (left - leftOuter) * 0.55, cy - portY + 6, stroke, 1),
    renderTikzquadsPolarity(leftOuter + (left - leftOuter) * 0.55, cy + portY - 6, stroke, -1),
    renderTikzquadsArrow(leftOuter + (left - leftOuter) * 0.55, cy - portY, -1, stroke)
  ];
  if (item.shape === "tikzquadsQuad") {
    const rightOuter = cx + hw;
    pieces.push(
      `<path d="M ${format(right)} ${format(cy - portY)} L ${format(rightOuter)} ${format(cy - portY)} M ${format(right)} ${format(
        cy + portY
      )} L ${format(rightOuter)} ${format(cy + portY)}" fill="none" stroke="${stroke}" stroke-width="${lineWidth}" />`,
      renderTikzquadsPolarity(rightOuter - (rightOuter - right) * 0.55, cy - portY + 6, stroke, 1),
      renderTikzquadsPolarity(rightOuter - (rightOuter - right) * 0.55, cy + portY - 6, stroke, -1),
      renderTikzquadsArrow(rightOuter - (rightOuter - right) * 0.55, cy - portY, 1, stroke),
      `<path d="M ${format(left)} ${format(cy + portY)} L ${format(right)} ${format(cy + portY)}" fill="none" stroke="${stroke}" stroke-width="${format(
        Math.max(0.5, Number(lineWidth) * 0.55)
      )}" stroke-dasharray="1.1 1.4" />`
    );
  }
  return pieces.join("");
}

function renderTikzquadsPolarity(x, y, stroke, sign) {
  const size = 3.2;
  const horizontal = `M ${format(x - size)} ${format(y)} L ${format(x + size)} ${format(y)}`;
  const vertical = sign > 0 ? ` M ${format(x)} ${format(y - size)} L ${format(x)} ${format(y + size)}` : "";
  return `<path d="${horizontal}${vertical}" fill="none" stroke="${stroke}" stroke-width="0.8" />`;
}

function renderTikzquadsArrow(x, y, direction, stroke) {
  const tip = direction > 0 ? x + 6 : x - 6;
  const tail = direction > 0 ? x - 5 : x + 5;
  const wing = direction > 0 ? -1 : 1;
  return `<path d="M ${format(tail)} ${format(y)} L ${format(tip)} ${format(y)} M ${format(tip)} ${format(y)} L ${format(
    tip + wing * 4
  )} ${format(y - 3)} M ${format(tip)} ${format(y)} L ${format(tip + wing * 4)} ${format(y + 3)}" fill="none" stroke="${stroke}" stroke-width="0.8" />`;
}

function renderTikzquadsInternals(item, box) {
  const kind = String(item.tikzquadsKind || "").toLowerCase();
  const { cx, cy, hw, hh, left, right, portY, stroke, lineWidth } = box;
  if (kind === "quad" || kind === "black box") return "";
  if (kind === "thevenin") {
    const x = (left + right) / 2;
    return [
      renderTikzquadsResistor(x, cy - portY * 0.52, hw * 0.18, stroke, lineWidth),
      renderTikzquadsVoltageSource(x, cy + portY * 0.52, Math.min(hw, hh) * 0.15, stroke, lineWidth)
    ].join("");
  }
  if (kind === "norton") {
    const x = (left + right) / 2;
    return [
      renderTikzquadsResistor(x - hw * 0.12, cy, hw * 0.16, stroke, lineWidth, true),
      renderTikzquadsCurrentSource(x + hw * 0.14, cy, Math.min(hw, hh) * 0.15, stroke, lineWidth)
    ].join("");
  }
  if (!kind.startsWith("quad ")) return "";
  const leftX = left + (right - left) * 0.32;
  const rightX = right - (right - left) * 0.32;
  const mode = kind.replace(/^quad\s+/, "");
  const leftBlock = mode === "y" || mode === "g" ? renderTikzquadsShunt(leftX, cy, portY, stroke, lineWidth) : renderTikzquadsSeries(leftX, cy, portY, stroke, lineWidth);
  const rightBlock = mode === "z" || mode === "h" ? renderTikzquadsSeries(rightX, cy, portY, stroke, lineWidth) : renderTikzquadsShunt(rightX, cy, portY, stroke, lineWidth);
  return `${leftBlock}${rightBlock}`;
}

function renderTikzquadsSeries(x, cy, portY, stroke, lineWidth) {
  return [
    renderTikzquadsResistor(x, cy - portY * 0.52, 9, stroke, lineWidth),
    renderTikzquadsVoltageSource(x, cy + portY * 0.52, 6, stroke, lineWidth)
  ].join("");
}

function renderTikzquadsShunt(x, cy, portY, stroke, lineWidth) {
  return [
    renderTikzquadsResistor(x - 5, cy, 8, stroke, lineWidth, true),
    renderTikzquadsCurrentSource(x + 8, cy, 6, stroke, lineWidth)
  ].join("");
}

function renderTikzquadsResistor(x, y, size, stroke, lineWidth, vertical = false) {
  if (vertical) {
    return `<rect x="${format(x - size * 0.35)}" y="${format(y - size)}" width="${format(size * 0.7)}" height="${format(
      size * 2
    )}" fill="white" stroke="${stroke}" stroke-width="${lineWidth}" />`;
  }
  return `<rect x="${format(x - size)}" y="${format(y - size * 0.35)}" width="${format(size * 2)}" height="${format(
    size * 0.7
  )}" fill="white" stroke="${stroke}" stroke-width="${lineWidth}" />`;
}

function renderTikzquadsVoltageSource(x, y, radius, stroke, lineWidth) {
  return `<g><circle cx="${format(x)}" cy="${format(y)}" r="${format(radius)}" fill="white" stroke="${stroke}" stroke-width="${lineWidth}" />${renderTikzquadsPolarity(
    x,
    y - radius * 0.35,
    stroke,
    1
  )}${renderTikzquadsPolarity(x, y + radius * 0.45, stroke, -1)}</g>`;
}

function renderTikzquadsCurrentSource(x, y, radius, stroke, lineWidth) {
  return `<g><circle cx="${format(x)}" cy="${format(y)}" r="${format(radius)}" fill="white" stroke="${stroke}" stroke-width="${lineWidth}" />${renderTikzquadsArrow(
    x,
    y + radius * 0.1,
    1,
    stroke
  )}</g>`;
}

function renderTikzquadsLabels(item, box, unit, options = {}) {
  const labels = tikzquadsLabelPositions(item, box);
  return labels
    .filter((label) => label.text !== undefined && label.text !== null && label.text !== "")
    .map((label) => renderTikzquadsText(label.text, label.x, label.y, label.anchor || "middle", label.size || TIKZ_TEXT_FONT_SIZE, box.stroke, unit, options))
    .join("");
}

function tikzquadsLabelPositions(item, box) {
  const o = item.tikzquadsOptions || {};
  const kind = String(item.tikzquadsKind || "").toLowerCase();
  const { cx, cy, hw, hh, left, right, portY } = box;
  const labels = tikzquadsTextAnchorLabels(o, { cx, cy, hw, hh, left, right });
  if (item.shape === "tikzquadsBlackBox") {
    labels.push(
      { text: o.I1 ?? "$I_1$", x: left - 4, y: cy - portY - 10, anchor: "end" },
      { text: o.V1 ?? "$V_1$", x: left - 6, y: cy, anchor: "end" }
    );
    if (kind === "thevenin") labels.push({ text: o.Zth ?? "$Z_{th}$", x: cx, y: cy - portY * 0.52 - 8 }, { text: o.Vth ?? "$V_{th}$", x: cx, y: cy + portY * 0.52 + 12 });
    if (kind === "norton") labels.push({ text: o.Yn ?? "$Y_N$", x: cx - hw * 0.1, y: cy - 14 }, { text: o.In ?? "$I_N$", x: cx + hw * 0.16, y: cy + 14 });
    return labels;
  }
  labels.push(
    { text: o.I1 ?? "$I_1$", x: left - 4, y: cy - portY - 10, anchor: "end" },
    { text: o.V1 ?? "$V_1$", x: left - 6, y: cy, anchor: "end" },
    { text: o.I2 ?? "$I_2$", x: right + 4, y: cy - portY - 10, anchor: "start" },
    { text: o.V2 ?? "$V_2$", x: right + 6, y: cy, anchor: "start" }
  );
  const prefix = kind.endsWith(" y") ? "Y" : kind.endsWith(" g") ? "G" : kind.endsWith(" h") ? "H" : kind.endsWith(" z") ? "Z" : "";
  if (prefix) {
    labels.push(
      { text: o[`${prefix}11`] ?? `$${prefix}_{11}$`, x: left + (right - left) * 0.28, y: cy - hh * 0.18 },
      { text: o[`${prefix}12`] ?? `$${prefix}_{12}$`, x: left + (right - left) * 0.43, y: cy + hh * 0.18 },
      { text: o[`${prefix}21`] ?? `$${prefix}_{21}$`, x: right - (right - left) * 0.43, y: cy - hh * 0.18 },
      { text: o[`${prefix}22`] ?? `$${prefix}_{22}$`, x: right - (right - left) * 0.28, y: cy + hh * 0.18 }
    );
  }
  return labels;
}

function tikzquadsTextAnchorLabels(options, box) {
  const { cx, cy, hw, hh, left, right } = box;
  const innerLeft = left + hw / 16;
  const innerRight = right - hw / 16;
  const top = cy - hh;
  const bottom = cy + hh;
  const topY = top + Math.max(9, hh * 0.14);
  const bottomY = bottom - Math.max(9, hh * 0.14);
  const positions = {
    "label top left": { x: innerLeft, y: topY, anchor: "start" },
    "label top center": { x: cx, y: topY, anchor: "middle" },
    "label top right": { x: innerRight, y: topY, anchor: "end" },
    "label inner top left": { x: innerLeft, y: cy - hh * 0.36, anchor: "start" },
    "label inner top center": { x: cx, y: cy - hh * 0.36, anchor: "middle" },
    "label inner top right": { x: innerRight, y: cy - hh * 0.36, anchor: "end" },
    "label bottom left": { x: innerLeft, y: bottomY, anchor: "start" },
    "label bottom center": { x: cx, y: bottomY, anchor: "middle" },
    "label bottom right": { x: innerRight, y: bottomY, anchor: "end" },
    "label inner bottom left": { x: innerLeft, y: cy + hh * 0.36, anchor: "start" },
    "label inner bottom center": { x: cx, y: cy + hh * 0.36, anchor: "middle" },
    "label inner bottom right": { x: innerRight, y: cy + hh * 0.36, anchor: "end" }
  };
  return Object.entries(positions)
    .filter(([key]) => options[key] !== undefined && options[key] !== "")
    .map(([key, position]) => ({ text: options[key], ...position }));
}

function renderTikzquadsPgLoadLine(item, unit, options = {}) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const hw = (item.width / 2) * unit;
  const hh = (item.height / 2) * unit;
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const lineWidth = format(item.style?.lineWidth || 1);
  const left = cx - hw * 0.78;
  const right = cx + hw * 0.78;
  const bottom = cy + hh * 0.72;
  const top = cy - hh * 0.72;
  const o = item.tikzquadsOptions || {};
  return [
    `<g class="tikz-node-shape tikz-node-${escapeAttribute(item.shape)}">`,
    `<path d="M ${format(left)} ${format(bottom)} L ${format(right)} ${format(bottom)} M ${format(left)} ${format(bottom)} L ${format(
      left
    )} ${format(top)} M ${format(left)} ${format(top)} L ${format(left - 3)} ${format(top + 7)} M ${format(left)} ${format(top)} L ${format(
      left + 3
    )} ${format(top + 7)} M ${format(right)} ${format(bottom)} L ${format(right - 7)} ${format(bottom - 3)} M ${format(right)} ${format(
      bottom
    )} L ${format(right - 7)} ${format(bottom + 3)} M ${format(left)} ${format(top + hh * 0.2)} L ${format(right - hw * 0.18)} ${format(
      bottom
    )}" fill="none" stroke="${stroke}" stroke-width="${lineWidth}" stroke-linecap="round" />`,
    renderTikzquadsText(o["x axis"] ?? "$V$", right + 9, bottom + 2, "start", TIKZ_TEXT_FONT_SIZE, stroke, unit, options),
    renderTikzquadsText(o["y axis"] ?? "$I$", left - 3, top - 7, "end", TIKZ_TEXT_FONT_SIZE, stroke, unit, options),
    renderTikzquadsText(o["x val"] ?? "$V_{th}$", right - 5, bottom - 8, "end", TIKZ_TEXT_FONT_SIZE, stroke, unit, options),
    renderTikzquadsText(o["y val"] ?? "$I_N$", left + 5, top + 9, "start", TIKZ_TEXT_FONT_SIZE, stroke, unit, options),
    "</g>"
  ].join("");
}

function renderTikzquadsText(text, x, y, anchor, size = TIKZ_TEXT_FONT_SIZE, fill, unit = TIKZ_UNIT, options = {}) {
  const normalized = normalizeTikzText(text);
  const scale = size / TIKZ_TEXT_FONT_SIZE;
  const math = parseMathText(normalized.text);
  const color = fill || normalized.color || "black";
  if (math) {
    const mathScale = (normalized.scale || 1) * (math.scale || 1) * scale;
    const box = estimateMathBox(normalizeKatexTex(math.tex), math.displayMode, unit, mathScale);
    const centeredX = textCenterForAnchor(x, anchor, box.width);
    return renderMathNode(
      { x: centeredX / unit, y: -y / unit, style: { fill: color, fontScale: scale } },
      { ...math, scale: (normalized.scale || 1) * (math.scale || 1), color: normalized.color || color, explicitFontSize: normalized.explicitFontSize || math.explicitFontSize },
      unit,
      options
    );
  }
  const lines = normalized.lines.length ? normalized.lines : [normalized.text];
  const width = estimateTikzquadsTextWidth(lines, size * (normalized.scale || 1));
  const centeredX = textCenterForAnchor(x, anchor, width);
  return renderPlainTextNode(
    {
      x: centeredX / unit,
      y: -y / unit,
      style: { fill: color, fontScale: scale }
    },
    normalized,
    unit
  );
}

function textCenterForAnchor(x, anchor, width) {
  if (anchor === "end") return x - width / 2;
  if (anchor === "start") return x + width / 2;
  return x;
}

function estimateTikzquadsTextWidth(lines, fontSize) {
  const longest = Math.max(0, ...lines.map((line) => formatTextLine(line).length));
  return Math.max(fontSize, longest * fontSize * 0.52);
}

function renderDoubleNodeOutline(item, unit) {
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const width = Math.max(1, item.style?.lineWidth ?? 1);
  const inset = Math.max(width * 1.8, 2.2);
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const halfWidth = (item.width * unit) / 2;
  const halfHeight = (item.height * unit) / 2;
  if (item.shape === "circle" || item.shape === "ellipse") {
    return `<ellipse class="tikz-bpmn-double" cx="${format(cx)}" cy="${format(cy)}" rx="${format(
      Math.max(0, halfWidth - inset)
    )}" ry="${format(Math.max(0, halfHeight - inset))}" stroke="${stroke}" fill="none" stroke-width="${format(width)}" />`;
  }
  const x = cx - halfWidth + inset;
  const y = cy - halfHeight + inset;
  return `<rect class="tikz-bpmn-double" x="${format(x)}" y="${format(y)}" width="${format(
    Math.max(0, item.width * unit - inset * 2)
  )}" height="${format(Math.max(0, item.height * unit - inset * 2))}" rx="${format(
    Math.max(0, (item.rx || 0) * unit - inset)
  )}" stroke="${stroke}" fill="none" stroke-width="${format(width)}" />`;
}

function renderBpmnIcon(item, unit) {
  const icon = String(item.bpmnIcon || "").trim();
  const box = nodePixelBox(item, unit);
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const fill = icon.endsWith("-fill") || icon === "terminate" ? stroke : "none";
  const width = format(Math.max(1, (item.style?.lineWidth ?? 1) * 0.85));
  const className = `tikz-bpmn-icon tikz-bpmn-${escapeAttribute(icon.replace(/-fill$/, ""))}`;
  if (icon.startsWith("message")) return renderBpmnMessageIcon(box, stroke, fill, width, className);
  if (icon === "timer") return renderBpmnTimerIcon(box, stroke, width, className);
  if (icon.startsWith("signal")) return renderBpmnSignalIcon(box, stroke, fill, width, className);
  if (icon === "xor") return renderBpmnXorIcon(box, stroke, width, className);
  if (icon === "inclusive") return renderBpmnInclusiveIcon(box, stroke, width, className);
  if (icon === "eventbased") return renderBpmnEventBasedIcon(box, stroke, width, className);
  if (icon.startsWith("compensation")) return renderBpmnCompensationIcon(box, stroke, fill, width, className);
  if (icon === "error") return renderBpmnErrorIcon(box, stroke, width, className);
  if (icon === "terminate") return `<circle class="${className}" cx="${format(box.cx)}" cy="${format(box.cy)}" r="${format(
    Math.min(box.width, box.height) * 0.24
  )}" stroke="${stroke}" fill="${fill}" stroke-width="${width}" />`;
  if (icon === "data-object") return renderBpmnDataObjectIcon(box, stroke, width, className);
  if (icon === "data-store") return renderBpmnDataStoreIcon(box, stroke, width, className);
  if (["manual", "script", "service", "user", "pool-label"].includes(icon)) {
    return renderBpmnSmallGlyph(box, stroke, icon, className);
  }
  return "";
}

function renderBpmnMarker(item, unit) {
  const marker = String(item.bpmnMarker || "").trim();
  const box = nodePixelBox(item, unit);
  const stroke = escapeAttribute(item.style?.stroke && item.style.stroke !== "none" ? item.style.stroke : "black");
  const width = format(Math.max(1, (item.style?.lineWidth ?? 1) * 0.75));
  const size = Math.min(box.width, box.height) * 0.2;
  const cx = box.cx;
  const cy = box.y2 - Math.max(size * 0.8, 8);
  const className = `tikz-bpmn-marker tikz-bpmn-${escapeAttribute(marker)}`;
  if (marker === "subprocess") {
    return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${width}"><rect x="${format(
      cx - size / 2
    )}" y="${format(cy - size / 2)}" width="${format(size)}" height="${format(size)}"/><path d="M ${format(
      cx - size * 0.3
    )} ${format(cy)} H ${format(cx + size * 0.3)} M ${format(cx)} ${format(cy - size * 0.3)} V ${format(
      cy + size * 0.3
    )}"/></g>`;
  }
  if (marker === "multiinstance") {
    return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${width}"><path d="M ${format(
      cx - size * 0.35
    )} ${format(cy - size / 2)} V ${format(cy + size / 2)} M ${format(cx)} ${format(cy - size / 2)} V ${format(
      cy + size / 2
    )} M ${format(cx + size * 0.35)} ${format(cy - size / 2)} V ${format(cy + size / 2)}"/></g>`;
  }
  if (marker === "loop") {
    return `<path class="${className}" d="M ${format(cx + size * 0.45)} ${format(cy)} A ${format(size * 0.45)} ${format(
      size * 0.45
    )} 0 1 1 ${format(cx - size * 0.3)} ${format(cy - size * 0.28)} M ${format(cx - size * 0.3)} ${format(
      cy - size * 0.28
    )} L ${format(cx - size * 0.08)} ${format(cy - size * 0.32)} L ${format(cx - size * 0.18)} ${format(
      cy - size * 0.08
    )}" stroke="${stroke}" fill="none" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`;
  }
  if (marker === "compensation") return renderBpmnCompensationIcon({ ...box, cx, cy, width: size * 2, height: size * 1.1 }, stroke, "none", width, className);
  if (marker === "adhoc") return renderBpmnSmallGlyph({ ...box, cx, cy, width: size * 2, height: size }, stroke, "adhoc", className);
  return "";
}

function nodePixelBox(item, unit) {
  const width = item.width * unit;
  const height = item.height * unit;
  const cx = item.x * unit;
  const cy = -item.y * unit;
  return {
    cx,
    cy,
    width,
    height,
    x1: cx - width / 2,
    x2: cx + width / 2,
    y1: cy - height / 2,
    y2: cy + height / 2
  };
}

function renderBpmnMessageIcon(box, stroke, fill, width, className) {
  const w = box.width * 0.45;
  const h = box.height * 0.3;
  const x = box.cx - w / 2;
  const y = box.cy - h / 2;
  return `<g class="${className}" stroke="${stroke}" fill="${fill}" stroke-width="${width}" stroke-linejoin="round"><rect x="${format(
    x
  )}" y="${format(y)}" width="${format(w)}" height="${format(h)}"/><path d="M ${format(x)} ${format(y)} L ${format(
    box.cx
  )} ${format(y + h * 0.58)} L ${format(x + w)} ${format(y)} M ${format(x)} ${format(y + h)} L ${format(
    box.cx
  )} ${format(y + h * 0.42)} L ${format(x + w)} ${format(y + h)}"/></g>`;
}

function renderBpmnTimerIcon(box, stroke, width, className) {
  const r = Math.min(box.width, box.height) * 0.27;
  const ticks = [];
  for (let angle = 0; angle < 360; angle += 30) {
    const rad = (angle * Math.PI) / 180;
    ticks.push(`M ${format(box.cx + Math.cos(rad) * r * 0.78)} ${format(box.cy + Math.sin(rad) * r * 0.78)} L ${format(
      box.cx + Math.cos(rad) * r
    )} ${format(box.cy + Math.sin(rad) * r)}`);
  }
  return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${width}" stroke-linecap="round"><circle cx="${format(
    box.cx
  )}" cy="${format(box.cy)}" r="${format(r)}"/><path d="${ticks.join(" ")} M ${format(box.cx)} ${format(box.cy)} L ${format(
    box.cx
  )} ${format(box.cy - r * 0.55)} M ${format(box.cx)} ${format(box.cy)} L ${format(box.cx + r * 0.5)} ${format(
    box.cy
  )}"/></g>`;
}

function renderBpmnSignalIcon(box, stroke, fill, width, className) {
  const r = Math.min(box.width, box.height) * 0.33;
  const points = [
    [box.cx, box.cy - r],
    [box.cx - r * 0.87, box.cy + r * 0.5],
    [box.cx + r * 0.87, box.cy + r * 0.5]
  ];
  return `<polygon class="${className}" points="${points.map(([x, y]) => `${format(x)},${format(y)}`).join(" ")}" stroke="${stroke}" fill="${fill}" stroke-width="${width}" stroke-linejoin="round" />`;
}

function renderBpmnInclusiveIcon(box, stroke, width, className) {
  const r = Math.min(box.width, box.height) * 0.24;
  return `<circle class="${className}" cx="${format(box.cx)}" cy="${format(box.cy)}" r="${format(r)}" stroke="${stroke}" fill="none" stroke-width="${width}" />`;
}

function renderBpmnXorIcon(box, stroke, width, className) {
  const r = Math.min(box.width, box.height) * 0.18;
  return `<path class="${className}" d="M ${format(box.cx - r)} ${format(box.cy - r)} L ${format(box.cx + r)} ${format(box.cy + r)} M ${format(
    box.cx - r
  )} ${format(box.cy + r)} L ${format(box.cx + r)} ${format(box.cy - r)}" stroke="${stroke}" fill="none" stroke-width="${width}" stroke-linecap="round" />`;
}

function renderBpmnEventBasedIcon(box, stroke, width, className) {
  const r = Math.min(box.width, box.height) * 0.29;
  const pentagon = Array.from({ length: 5 }, (_unused, index) => {
    const a = (-90 + index * 72) * Math.PI / 180;
    return `${format(box.cx + Math.cos(a) * r * 0.58)},${format(box.cy + Math.sin(a) * r * 0.58)}`;
  }).join(" ");
  return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${width}"><circle cx="${format(box.cx)}" cy="${format(
    box.cy
  )}" r="${format(r)}"/><circle cx="${format(box.cx)}" cy="${format(box.cy)}" r="${format(r * 0.78)}"/><polygon points="${pentagon}"/></g>`;
}

function renderBpmnCompensationIcon(box, stroke, fill, width, className) {
  const w = Math.min(box.width, box.height) * 0.34;
  const h = w * 0.78;
  const left = `M ${format(box.cx - w * 0.75)} ${format(box.cy)} L ${format(box.cx - w * 0.05)} ${format(
    box.cy - h / 2
  )} L ${format(box.cx - w * 0.05)} ${format(box.cy + h / 2)} Z`;
  const right = `M ${format(box.cx - w * 0.05)} ${format(box.cy)} L ${format(box.cx + w * 0.65)} ${format(
    box.cy - h / 2
  )} L ${format(box.cx + w * 0.65)} ${format(box.cy + h / 2)} Z`;
  return `<g class="${className}" stroke="${stroke}" fill="${fill}" stroke-width="${width}" stroke-linejoin="round"><path d="${left}"/><path d="${right}"/></g>`;
}

function renderBpmnErrorIcon(box, stroke, width, className) {
  const r = Math.min(box.width, box.height) * 0.3;
  return `<path class="${className}" d="M ${format(box.cx - r * 0.55)} ${format(box.cy - r)} L ${format(
    box.cx + r * 0.05
  )} ${format(box.cy - r * 0.15)} L ${format(box.cx - r * 0.25)} ${format(box.cy - r * 0.15)} L ${format(
    box.cx + r * 0.55
  )} ${format(box.cy + r)} L ${format(box.cx - r * 0.05)} ${format(box.cy + r * 0.15)} L ${format(
    box.cx + r * 0.25
  )} ${format(box.cy + r * 0.15)} Z" stroke="${stroke}" fill="none" stroke-width="${width}" stroke-linejoin="round" />`;
}

function renderBpmnDataObjectIcon(box, stroke, width, className) {
  const fold = Math.min(box.width, box.height) * 0.22;
  return `<path class="${className}" d="M ${format(box.x1)} ${format(box.y1)} V ${format(box.y2)} H ${format(
    box.x2
  )} V ${format(box.y1 + fold)} L ${format(box.x2 - fold)} ${format(box.y1)} Z M ${format(box.x2 - fold)} ${format(
    box.y1
  )} V ${format(box.y1 + fold)} H ${format(box.x2)}" stroke="${stroke}" fill="none" stroke-width="${width}" stroke-linejoin="round" />`;
}

function renderBpmnDataStoreIcon(box, stroke, width, className) {
  const rx = box.width * 0.38;
  const ry = box.height * 0.12;
  return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${width}"><ellipse cx="${format(box.cx)}" cy="${format(
    box.y1 + ry
  )}" rx="${format(rx)}" ry="${format(ry)}"/><path d="M ${format(box.cx - rx)} ${format(box.y1 + ry)} V ${format(
    box.y2 - ry
  )} A ${format(rx)} ${format(ry)} 0 0 0 ${format(box.cx + rx)} ${format(box.y2 - ry)} V ${format(
    box.y1 + ry
  )} M ${format(box.cx - rx)} ${format(box.cy)} A ${format(rx)} ${format(ry)} 0 0 0 ${format(box.cx + rx)} ${format(
    box.cy
  )}"/></g>`;
}

function renderBpmnSmallGlyph(box, stroke, glyph, className) {
  if (glyph === "manual") return renderBpmnManualGlyph(box, stroke, className);
  const text = glyph === "adhoc" ? "~" : glyph === "script" ? "S" : glyph === "service" ? "G" : glyph === "user" ? "U" : glyph === "manual" ? "M" : "|";
  const x = glyph === "pool-label" ? box.x1 + box.width * 0.12 : box.x1 + box.width * 0.18;
  const y = glyph === "pool-label" ? box.cy : box.y1 + box.height * 0.25;
  return `<text class="${className}" x="${format(x)}" y="${format(y)}" fill="${stroke}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    Math.max(8, Math.min(box.width, box.height) * 0.24)
  )}" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(text)}</text>`;
}

function renderBpmnManualGlyph(box, stroke, className) {
  const scale = Math.min(box.width, box.height) * 0.11;
  const x = box.x1 + box.width * 0.14;
  const y = box.y1 + box.height * 0.14;
  const fingers = [0, 0.28, 0.56, 0.84]
    .map((offset) => `M ${format(x + scale * offset)} ${format(y + scale * 0.95)} V ${format(y)}`)
    .join(" ");
  const palm = [
    `M ${format(x - scale * 0.12)} ${format(y + scale * 0.92)}`,
    `L ${format(x + scale * 1.12)} ${format(y + scale * 0.92)}`,
    `L ${format(x + scale * 1.02)} ${format(y + scale * 1.35)}`,
    `L ${format(x + scale * 0.12)} ${format(y + scale * 1.35)}`,
    `Z`
  ].join(" ");
  return `<g class="${className}" stroke="${stroke}" fill="none" stroke-width="${format(Math.max(0.65, scale * 0.12))}" stroke-linecap="round" stroke-linejoin="round"><path d="${fingers}"/><path d="${palm}"/></g>`;
}

// Claude: 用一个 <g transform="rotate(...)"> 包住文本，实现 \node[rotate=θ]{...} 的文字旋转。
// TikZ 的 rotate 是数学坐标系下逆时针为正；而 SVG 的 y 轴向下、rotate 顺时针为正，故取负号。
// 旋转中心取节点锚点 (item.x, -item.y)，与文本的定位中心一致。
function wrapNodeRotation(svg, item, unit) {
  if (!item.rotation) return svg;
  const cx = format(item.x * unit);
  const cy = format(-item.y * unit);
  return `<g transform="rotate(${format(-item.rotation)} ${cx} ${cy})">${svg}</g>`;
}

function applyTextContour(svg, rawText) {
  const color = readContourColor(rawText);
  if (!color || !svg.includes("<text")) return svg;
  const stroke = escapeAttribute(svgPaint(color));
  return svg.replace(/<text\b(?![^>]*\bstroke=)([^>]*)>/g, `<text stroke="${stroke}" stroke-width="1.4" paint-order="stroke fill" stroke-linejoin="round"$1>`);
}

function readContourColor(value) {
  const raw = String(value || "");
  const match = /\\contour\b/.exec(raw);
  if (!match) return null;
  let cursor = skipInlineWhitespace(raw, match.index + match[0].length);
  const color = readBalancedGroup(raw, cursor);
  if (!color) return null;
  return color.content.trim() || null;
}

function renderPlainTextNode(item, normalized, unit) {
  if (!normalized.color && hasTextColorSegments(normalized.raw)) return renderSegmentedTextNode(item, normalized, unit);
  const color = escapeAttribute(normalized.color || item.style?.fill || "black");
  const rawFontFamily = item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY;
  const fontFamily = escapeAttribute(rawFontFamily);
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1) * textFontScale(item, normalized);
  const sourceLines = normalized.lines.length ? normalized.lines : [normalized.text];
  const formattedLines = sourceLines.map(formatTextLine);
  const sourceLineStyles = textLineStyles(normalized, sourceLines.length);
  const wrappedText = wrapStyledSvgTextLines(sourceLines, formattedLines, sourceLineStyles, item.wrapWidth, unit, baseFontSize);
  const lines = wrappedText.lines;
  const contentLines = wrappedText.contentLines;
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, lines);
  const lineStyles = wrappedText.lineStyles;
  const align = normalizedTextAlign(item.textAlign);
  const x = format(alignedTextX(item, unit, align));
  const textAnchor = textAnchorForAlign(align);
  const y = format(-item.y * unit);
  const widthScale = typewriterWidthScale(rawFontFamily);
  if (lines.length <= 1) {
    const lineStyle = lineStyles[0] || {};
    const lineFontSize = fontSize * (lineStyle.scale || 1);
    const content = renderSvgTextLineContent(contentLines[0], lines[0] || "", lineFontSize, unit);
    const lineFontStyle = fontStyleAttribute(lineStyle) || mathLineFontStyleAttribute(contentLines[0]);
    const text = `<text x="${x}" y="${y}" fill="${color}" text-anchor="${textAnchor}" dominant-baseline="middle" xml:space="preserve" font-size="${format(
      lineFontSize
    )}"${fontWeightAttribute(lineStyle)}${lineFontStyle} font-family="${fontFamily}">${content}</text>`;
    return wrapTypewriterWidth(text, item, unit, widthScale);
  }
  const lineOffsets = baselineOffsets(fontSize, lineStyles);
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? lineOffsets[0] : lineOffsets[index] - lineOffsets[index - 1];
      const lineStyle = lineStyles[index] || {};
      const lineFontSize = fontSize * (lineStyle.scale || 1);
      return `<tspan x="${x}" dy="${format(dy)}"${lineFontAttributes(
        lineStyle,
        fontSize,
        contentLines[index]
      )}>${renderSvgTextLineContent(
        contentLines[index],
        line,
        lineFontSize,
        unit
      )}</tspan>`;
    })
    .join("");
  const text = `<text x="${x}" y="${y}" fill="${color}" text-anchor="${textAnchor}" dominant-baseline="middle" xml:space="preserve" font-size="${format(
    fontSize
  )}" font-family="${fontFamily}">${tspans}</text>`;
  return wrapTypewriterWidth(text, item, unit, widthScale);
}

function normalizedTextAlign(value) {
  const align = String(value || "").trim().toLowerCase();
  if (align === "left" || align === "right") return align;
  return "center";
}

function textAnchorForAlign(align) {
  if (align === "left") return "start";
  if (align === "right") return "end";
  return "middle";
}

function alignedTextX(item, unit, align) {
  const center = item.x * unit;
  const wrapWidth = Number(item.wrapWidth);
  if (!Number.isFinite(wrapWidth) || wrapWidth <= 0) return center;
  if (align === "left") return center - (wrapWidth * unit) / 2;
  if (align === "right") return center + (wrapWidth * unit) / 2;
  return center;
}

function textLineStyles(normalized, count) {
  const styles = Array.isArray(normalized.lineStyles) ? normalized.lineStyles : [];
  return Array.from({ length: count }, (_unused, index) => ({
    scale: Number(styles[index]?.scale) || 1,
    fontWeight: styles[index]?.fontWeight || null,
    fontStyle: styles[index]?.fontStyle || normalized.fontStyle || null
  }));
}

function wrapStyledSvgTextLines(sourceLines, formattedLines, sourceLineStyles, wrapWidth, unit, baseFontSize) {
  const lines = [];
  const contentLines = [];
  const lineStyles = [];
  for (let index = 0; index < formattedLines.length; index += 1) {
    const style = sourceLineStyles[index] || {};
    const lineFontSize = baseFontSize * (Number(style.scale) || 1);
    const wrapped = wrapSvgTextLines([formattedLines[index]], wrapWidth, unit, lineFontSize);
    for (const line of wrapped) {
      lines.push(line);
      contentLines.push(wrapped.length === 1 ? sourceLines[index] : line);
      lineStyles.push(style);
    }
  }
  return { lines, contentLines, lineStyles };
}

function baselineOffsets(baseFontSize, lineStyles) {
  if (lineStyles.length <= 1) return [0];
  const gaps = [];
  for (let index = 0; index < lineStyles.length - 1; index += 1) {
    gaps.push(lineBaselineGap(baseFontSize, lineStyles[index], lineStyles[index + 1]));
  }
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  const offsets = [-total / 2];
  for (const gap of gaps) offsets.push(offsets.at(-1) + gap);
  return offsets;
}

function lineBaselineGap(baseFontSize, first = {}, second = {}) {
  const firstScale = Number(first.scale) || 1;
  const secondScale = Number(second.scale) || 1;
  if (Math.abs(firstScale - secondScale) < 0.05) {
    return baseFontSize * Math.max(firstScale, secondScale) * 1.15;
  }
  return baseFontSize * (firstScale + secondScale) * 0.43;
}

function lineFontAttributes(lineStyle, baseFontSize, sourceLine = "") {
  const fontStyle = fontStyleAttribute(lineStyle) || mathLineFontStyleAttribute(sourceLine);
  return `${lineStyle.scale && lineStyle.scale !== 1 ? ` font-size="${format(baseFontSize * lineStyle.scale)}"` : ""}${fontWeightAttribute(
    lineStyle
  )}${fontStyle}`;
}

function fontWeightAttribute(lineStyle) {
  return lineStyle.fontWeight ? ` font-weight="${escapeAttribute(String(lineStyle.fontWeight))}"` : "";
}

function fontStyleAttribute(lineStyle) {
  return lineStyle.fontStyle ? ` font-style="${escapeAttribute(String(lineStyle.fontStyle))}"` : "";
}

function mathLineFontStyleAttribute(sourceLine) {
  const tex = mathOnlySourceLineTex(sourceLine);
  const style = tex ? mathFallbackFontStyle(tex) : "";
  return style ? ` font-style="${escapeAttribute(style)}"` : "";
}

function mathOnlySourceLineTex(sourceLine) {
  const source = String(sourceLine || "").trim();
  const direct = parseMathText(source);
  if (direct?.tex) return direct.tex;
  const segments = splitInlineMathSegments(source);
  const mathSpans = segments.filter((segment) => segment.type === "math").map((segment) => segment.tex);
  if (!mathSpans.length) return "";
  const nonMath = segments
    .filter((segment) => segment.type !== "math")
    .map((segment) => segment.text)
    .join("")
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/[{}\s]/g, "");
  return nonMath ? "" : mathSpans.join(" ");
}

function textFontScale(item, normalized = null) {
  const key = normalized?.explicitFontSize ? item.style?.fontSizeBaseScale : item.style?.fontScale;
  const scale = Number(key);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function wrapSvgTextLines(lines, wrapWidth, unit, fontSize) {
  const width = Number(wrapWidth) * unit;
  if (!Number.isFinite(width) || width <= 0) return lines;
  const maxChars = Math.max(1, Math.floor(width / Math.max(1, fontSize * 0.49)));
  return lines.flatMap((line) => wrapSvgTextLine(line, maxChars));
}

function wrapSvgTextLine(line, maxChars) {
  const text = String(line || "").trim();
  if (!text || text.length <= maxChars || !/\s/.test(text)) return [text];
  const output = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
    } else {
      output.push(current);
      current = word;
    }
  }
  if (current) output.push(current);
  return output.length ? output : [text];
}

function renderSegmentedTextNode(item, normalized, unit) {
  const lines = splitTextLines(normalized.raw || normalized.text);
  const fallbackLines = (normalized.lines.length ? normalized.lines : lines).map(formatTextLine);
  const color = escapeAttribute(item.style?.fill || "black");
  const rawFontFamily = item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY;
  const fontFamily = escapeAttribute(rawFontFamily);
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1) * textFontScale(item, normalized);
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, fallbackLines);
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  const widthScale = typewriterWidthScale(rawFontFamily);
  const lineHeight = fontSize * 1.15;
  const startDy = -((lines.length - 1) * lineHeight) / 2;
  const rects = [];
  let baseline = 0;
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? startDy : lineHeight;
      baseline += dy;
      const parsedSegments = parseTextColorSegments(line);
      rects.push(...inlineBoxRects(parsedSegments, item.x * unit, -item.y * unit + baseline, fontSize));
      const segments = parsedSegments
        .map((segment) => {
          const text = escapeText(formatTextLine(segment.text));
          if (!text) return "";
          const fill = segment.background ? "white" : segment.color;
          return fill ? `<tspan fill="${escapeAttribute(fill)}">${text}</tspan>` : text;
        })
        .join("");
      return `<tspan x="${x}" dy="${format(dy)}">${segments}</tspan>`;
    })
    .join("");
  const text = `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" xml:space="preserve" font-size="${format(
    fontSize
  )}" font-family="${fontFamily}">${tspans}</text>`;
  return wrapTypewriterWidth(rects.length ? `<g>${rects.join("")}${text}</g>` : text, item, unit, widthScale);
}

function typewriterWidthScale(fontFamily) {
  const text = String(fontFamily || "");
  return /(?:Typewriter|mono|Menlo|Monaco|Consolas|Courier)/i.test(text) ? TIKZ_TYPEWRITER_WIDTH_SCALE : 1;
}

function wrapTypewriterWidth(svg, item, unit, scale) {
  if (!Number.isFinite(scale) || Math.abs(scale - 1) < 1e-6) return svg;
  const cx = format(item.x * unit);
  return `<g class="tikz-typewriter-text" transform="translate(${cx} 0) scale(${format(scale)} 1) translate(${format(-item.x * unit)} 0)">${svg}</g>`;
}

function hasTextColorSegments(source) {
  return /\\(?:textcolor|tikzinlinebox)\s*\{[^{}]+\}\s*\{[^{}]*\}/.test(String(source || ""));
}

function splitTextLines(source) {
  return String(source || "")
    .trim()
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/\\(?:tt|rm|sf|bf|bfseries|itshape|slshape|scshape)\b/g, "")
    .split(/\\\\|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length);
}

function parseTextColorSegments(line) {
  const segments = [];
  const pattern = /\\(textcolor|tikzinlinebox)\s*\{([^{}]+)\}\s*\{([^{}]*)\}/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(line))) {
    if (match.index > cursor) segments.push({ text: line.slice(cursor, match.index) });
    const kind = match[1];
    const color = match[2].trim();
    const text = match[3];
    if (kind === "tikzinlinebox") segments.push({ background: color, text });
    else segments.push({ color, text });
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) segments.push({ text: line.slice(cursor) });
  return segments.length ? segments : [{ text: line }];
}

function inlineBoxRects(segments, centerX, baselineY, fontSize) {
  const charWidth = fontSize * 0.55;
  const widths = segments.map((segment) => Math.max(segment.text.length * charWidth, segment.background ? fontSize * 0.9 : 0));
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const rects = [];
  let cursor = centerX - totalWidth / 2;
  segments.forEach((segment, index) => {
    const width = widths[index];
    if (segment.background) {
      const padX = fontSize * 0.12;
      const height = fontSize * 0.92;
      rects.push(
        `<rect x="${format(cursor - padX)}" y="${format(baselineY - height * 0.55)}" width="${format(
          width + padX * 2
        )}" height="${format(height)}" fill="${escapeAttribute(segment.background)}" />`
      );
    }
    cursor += width;
  });
  return rects;
}

function formatTextLine(line) {
  const math = parseMathText(line);
  if (math) return mathFallbackText(math.tex);
  const segments = splitInlineMathSegments(line);
  if (segments.some((segment) => segment.type === "math")) {
    return segments.map((segment) => (segment.type === "math" ? mathFallbackText(segment.tex) : formatPlainTexText(segment.text))).join("");
  }
  return formatPlainTexText(line);
}

function renderSvgTextLineContent(sourceLine, formattedLine, fontSize, unit = TIKZ_UNIT) {
  const source = String(sourceLine ?? formattedLine ?? "").trim();
  const math = parseMathText(source);
  if (math) return renderSvgMathFallbackContent(normalizeKatexTex(math.tex), fontSize);
  if (hasInlineMathSource(source)) return renderInlineSvgMathContent(source, formattedLine, fontSize, unit);
  return renderPlainSvgTextContent(formattedLine ?? source, unit);
}

function renderInlineSvgMathContent(source, formattedLine, fontSize, unit = TIKZ_UNIT) {
  const parts = [];
  for (const segment of splitInlineMathSegments(source)) {
    if (segment.type === "math") {
      parts.push(renderSvgMathFallbackContent(normalizeKatexTex(segment.tex.trim()), fontSize));
    } else if (segment.text) {
      parts.push(renderPlainSvgTextContent(formatPlainTexText(segment.text), unit));
    }
  }
  if (!parts.length) return renderPlainSvgTextContent(formattedLine ?? source, unit);
  return parts.join("");
}

function hasInlineMathSource(source) {
  return splitInlineMathSegments(source).some((segment) => segment.type === "math");
}

function formatPlainTexText(value) {
  return String(value ?? "")
    .replace(/\\strut(?![A-Za-z])\s*/g, "")
    .replace(/\\\$\s*/g, "$")
    .replace(/\\[,;:]\s*/g, " ")
    .replace(/\\!\s*/g, "");
}

function renderPlainSvgTextContent(value, unit = TIKZ_UNIT) {
  const text = String(value ?? "");
  if (!text.includes("\uE100")) return escapeText(text);
  let output = "";
  let cursor = 0;
  let openTspan = false;
  replaceTikzHspaceMarkers(text, (dimension) => {
    const marker = `${"\uE100"}${encodeURIComponent(dimension)}${"\uE101"}`;
    const index = text.indexOf(marker, cursor);
    if (index >= cursor) {
      output += escapeText(text.slice(cursor, index));
      if (openTspan) output += "</tspan>";
      const width = parseDimension(dimension, {});
      const dx = Number.isFinite(width) ? width * unit : 0;
      output += `<tspan dx="${format(dx)}">`;
      openTspan = true;
      cursor = index + marker.length;
    }
    return "";
  });
  output += escapeText(text.slice(cursor));
  if (openTspan) output += "</tspan>";
  return output;
}

function renderSvgMathFallbackContent(tex, fontSize) {
  const leadingScript = leadingScriptFallback(tex);
  if (leadingScript) return renderLeadingScriptContent(leadingScript, fontSize);
  const simple = simpleNumericSubscriptFallback(tex);
  if (simple) return renderSimpleSubscriptContent(simple, fontSize);
  const scripted = scriptedMathFallback(tex, { allowSimpleScripts: true });
  if (scripted) return renderScriptedSegmentsContent(scripted, fontSize);
  const mixed = mixedAlphabeticSubscriptFallback(tex);
  if (mixed) return renderMixedSubscriptContent(mixed, fontSize);
  return escapeText(mathFallbackText(tex));
}

function hasInlineMath(normalized) {
  const source = String(normalized.raw || normalized.text || "");
  return hasInlineMathSource(source);
}

function scopedMathClassName(name) {
  return `tikzkit-math-${MATH_CLASS_ALIASES.get(name) || name}`;
}

function scopeMathHtml(html) {
  return String(html).replace(/\bclass="([^"]*)"/g, (_match, value) => {
    const scoped = value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(scopedMathClassName)
      .join(" ");
    return `class="${scoped}"`;
  });
}

function renderScopedMathHtml(tex, options = {}) {
  const html = scopeMathHtml(
    katex.renderToString(tex, {
      displayMode: false,
      output: "html",
      throwOnError: false,
      strict: "ignore",
      trust: false,
      macros: KATEX_MACROS,
      ...options
    })
  );
  return `<span class="tikzkit-math-scope">${html}</span>`;
}

function renderScopedMathStyleDef() {
  return `<style class="tikzkit-math-style"><![CDATA[${TIKZKIT_SCOPED_MATH_CSS}]]></style>`;
}

function renderRichTextNode(item, normalized, unit) {
  const source = cleanRichTextSource(normalized.text || normalized.raw || "");
  const rawLines = source.split(/\\\\|\n/).map((line) => line.trim()).filter((line) => line.length);
  const lines = rawLines.length ? rawLines : normalized.lines.length ? normalized.lines : [normalized.text];
  const fallback = renderPlainTextNode(item, normalized, unit);
  const color = escapeAttribute(normalized.color || item.style?.fill || "black");
  const fontFamily = escapeAttribute(item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY);
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1) * textFontScale(item, normalized);
  const lineStyles = textLineStyles(normalized, lines.length);
  const fontSize = fitRichFontSizeToBox(baseFontSize, item.fitBox, unit, lines, lineStyles);
  const box = estimateRichTextBox(lines, fontSize, lineStyles);
  const x = item.x * unit - box.width / 2;
  const y = -item.y * unit - box.height / 2;
  const htmlLines = lines
    .map((line, index) => {
      const lineStyle = lineStyles[index] || {};
      const lineFontSize = fontSize * (lineStyle.scale || 1);
      return `<div class="tikz-rich-line"${fontWeightAttribute(lineStyle)} style="font-size:${format(
        lineFontSize
      )}px;">${renderInlineMathHtml(line)}</div>`;
    })
    .join("");
  const foreignObject = `<foreignObject x="${format(x)}" y="${format(
    y
  )}" width="${format(box.width)}" height="${format(
    box.height
  )}"><div xmlns="http://www.w3.org/1999/xhtml" class="tikz-rich-text" style="width:${format(
    box.width
  )}px;height:${format(
    box.height
  )}px;color:${color};font-size:${format(
    fontSize
  )}px;line-height:1.05;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;white-space:nowrap;overflow:visible;font-family:${escapeAttribute(
    fontFamily
  )};">${htmlLines}</div></foreignObject>`;
  return `<switch>${foreignObject}${fallback}</switch>`;
}

function cleanRichTextSource(source) {
  return String(source)
    .trim()
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/\\(?:tt|rm|sf|bfseries|itshape|slshape|scshape)\b/g, "")
    .replace(/\\dots/g, "…")
    .replace(/[ \t]+/g, " ");
}

function renderInlineMathHtml(line) {
  const parts = [];
  const pattern = /\$([^$]+)\$/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(line))) {
    if (match.index > cursor) parts.push(escapeHtml(line.slice(cursor, match.index)));
    parts.push(
      renderScopedMathHtml(normalizeKatexTex(match[1].trim()), {
        displayMode: false
      })
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) parts.push(escapeHtml(line.slice(cursor)));
  return parts.join("");
}

function estimateRichTextBox(lines, fontSize, lineStyles = []) {
  const fallbackLines = lines.map(formatTextLine);
  const width = Math.max(
    42,
    Math.max(
      ...fallbackLines.map((line, index) => {
        const scale = Number(lineStyles[index]?.scale) || 1;
        return String(line).length * fontSize * scale * 0.52 + 18;
      }),
      0
    )
  );
  const height = Math.max(
    fontSize * 1.15,
    lineStyles.reduce((sum, style) => sum + fontSize * (Number(style?.scale) || 1) * 1.12, 0) || lines.length * fontSize * 1.12
  );
  return { width, height };
}

function renderRectangleSplit(item, unit) {
  const parts = Math.max(1, Math.round(item.parts || 1));
  const x = (item.x - item.width / 2) * unit;
  const y = -(item.y + item.height / 2) * unit;
  const width = item.width * unit;
  const height = item.height * unit;
  const partWidth = width / parts;
  const lineWidth = item.style?.lineWidth ?? 1;
  const stroke = escapeAttribute(item.style?.stroke || "black");
  const fills = item.partFills || [];
  const partRects = Array.from({ length: parts }, (_, index) => {
    const fill = escapeAttribute(fills[index] || "none");
    return `<rect class="tikz-split-part" x="${format(x + index * partWidth)}" y="${format(y)}" width="${format(
      partWidth
    )}" height="${format(height)}" stroke="none" fill="${fill}" />`;
  }).join("");
  const separators = Array.from({ length: parts - 1 }, (_, index) => {
    const lineX = x + (index + 1) * partWidth;
    return `<path d="M ${format(lineX)} ${format(y)} L ${format(lineX)} ${format(
      y + height
    )}" stroke="${stroke}" fill="none" stroke-width="${format(lineWidth)}" />`;
  }).join("");
  const outer = `<rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(
    height
  )}" rx="${format((item.rx || 0) * unit)}" stroke="${stroke}" fill="none" stroke-width="${format(lineWidth)}" />`;
  return `<g class="tikz-rectangle-split">${partRects}${separators}${outer}</g>`;
}

function renderImagePlaceholder(item, image, unit) {
  const scale = imagePlaceholderScale(item, image);
  const width = image.width * unit * scale;
  const height = image.height * unit * scale;
  const x = item.x * unit - width / 2;
  const y = -item.y * unit - height / 2;
  // Claude: 真实折线（如 case 038 的 ReLU 形状）。把归一化坐标映射回框内、按比例绘制；
  // y 轴翻转(1-y)对应 SVG 向下为正。节点边框由 nodeBox 单独画，这里只画线。
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
  const rectangles = (image.rectangles || []).map((rect, index) => {
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

function imagePlaceholderScale(item, image = {}) {
  const imageScale = Number(image.scale);
  const nodeScale = Number(item?.style?.fontScale);
  const scale = (Number.isFinite(imageScale) && imageScale > 0 ? imageScale : 1) * (Number.isFinite(nodeScale) && nodeScale > 0 ? nodeScale : 1);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
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

function renderMathNode(item, math, unit, options = {}) {
  const tex = normalizeKatexTex(math.tex);
  const box = estimateMathBox(tex, math.displayMode, unit, (math.scale || 1) * textFontScale(item, math) * mathStyleScale(tex));
  box.fontSize = fitFontSizeToBox(box.fontSize, item.fitBox, unit, [mathFallbackText(tex)]);
  const htmlBox = scopedMathForeignObjectBox(box, math.displayMode);
  const x = item.x * unit - htmlBox.width / 2;
  const y = -item.y * unit - htmlBox.height / 2;
  const color = escapeAttribute(math.color || item.style?.fill || "black");
  const fontStyle = mathFallbackFontStyle(tex);
  const fontWeight = math.fontWeight || mathFallbackFontWeight(tex);
  const fallbackFontSize = box.fontSize;
  const plainFallback = `<text x="${format(item.x * unit)}" y="${format(-item.y * unit)}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    fallbackFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}">${escapeText(
    mathFallbackText(tex)
  )}</text>`;
  const fractionFallback = simpleFractionFallback(tex);
  if (fractionFallback && options.mathRenderer === "svg-text") {
    return renderFractionMathFallback(item, fractionFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const compoundFractionFallback = inlineFractionFallback(tex);
  if (compoundFractionFallback && options.mathRenderer === "svg-text") {
    return renderInlineFractionMathFallback(item, compoundFractionFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  if (options.mathRenderer === "svg-text" && /\\(?:frac|dfrac|tfrac)\s*\{/.test(tex)) {
    return plainFallback;
  }
  const sumLimitsFallback = sumLimitsInlineFallback(tex);
  if (sumLimitsFallback && options.mathRenderer === "svg-text") {
    return renderSumLimitsInlineFallback(item, sumLimitsFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const tensorMatrixFallback = tensorMatrixFallbackParts(tex);
  if (tensorMatrixFallback && options.mathRenderer === "svg-text") {
    return renderTensorMatrixFallback(item, tensorMatrixFallback, box.fontSize, unit, color);
  }
  const coloredMathFallback = coloredMathTextFallback(tex);
  if (coloredMathFallback && options.mathRenderer === "svg-text") {
    return renderColoredMathTextFallback(item, coloredMathFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const hatSubscriptFallback = hatAccentSubscriptFallback(tex);
  if (hatSubscriptFallback && options.mathRenderer === "svg-text") {
    return renderHatSubscriptMathFallback(item, hatSubscriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const subscriptFallback = simpleNumericSubscriptFallback(tex);
  if (subscriptFallback && options.mathRenderer === "svg-text") {
    return renderSimpleSubscriptMathFallback(item, subscriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const scriptedFallback = scriptedMathFallback(tex, { allowSimpleScripts: texNeedsOperatorSpacing(tex) });
  if (scriptedFallback && options.mathRenderer === "svg-text") {
    return renderScriptedMathFallback(item, scriptedFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const styledScriptFallback = styledScriptedMathFallback(tex);
  if (styledScriptFallback && options.mathRenderer === "svg-text") {
    return renderScriptedMathFallback(item, styledScriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  const mixedSubscriptFallback = mixedAlphabeticSubscriptFallback(tex);
  if (mixedSubscriptFallback && options.mathRenderer === "svg-text") {
    return renderMixedSubscriptMathFallback(item, mixedSubscriptFallback, fallbackFontSize, unit, color, fontStyle, fontWeight);
  }
  if (options.mathRenderer === "svg-text") return plainFallback;

  const html = renderScopedMathHtml(tex, {
    displayMode: math.displayMode,
  });
  const foreignObject = `<foreignObject x="${format(x)}" y="${format(
    y
  )}" width="${format(htmlBox.width)}" height="${format(
    htmlBox.height
  )}"><div xmlns="http://www.w3.org/1999/xhtml" class="tikz-math${
    math.displayMode ? " display" : ""
  }" style="width:${format(htmlBox.width)}px;height:${format(
    htmlBox.height
  )}px;color:${color};font-size:${format(
    scopedMathHostFontSize(box.fontSize)
  )}px;line-height:1;display:flex;align-items:center;justify-content:center;overflow:visible;white-space:nowrap;font-family:${escapeAttribute(
    TIKZ_FONT_FAMILY
  )};">${html}</div></foreignObject>`;
  return `<switch>${foreignObject}${plainFallback}</switch>`;
}

function scopedMathHostFontSize(fontSize) {
  return fontSize / KATEX_ROOT_FONT_SCALE;
}

function scopedMathForeignObjectBox(box, displayMode = false) {
  const fontSize = Number(box.fontSize) || TIKZ_TEXT_FONT_SIZE;
  const lineBoxScale = displayMode ? KATEX_DISPLAY_LINE_BOX_SCALE : KATEX_INLINE_LINE_BOX_SCALE;
  const widthPad = fontSize * (displayMode ? KATEX_DISPLAY_WIDTH_PAD_EM : KATEX_INLINE_WIDTH_PAD_EM);
  return {
    width: box.width + widthPad,
    height: Math.max(box.height, fontSize * lineBoxScale)
  };
}

function tensorMatrixFallbackParts(tex) {
  const source = String(tex || "");
  if (!/\\(?:overmat|undermat)\b/.test(source) || !/\\begin\{matrix\}/.test(source)) return null;
  const blocks = [];
  const pattern = /\\(overmat|undermat)\b/g;
  let match;
  while ((match = pattern.exec(source))) {
    const parsed = readTensorMatrixMacro(source, match.index, match[1]);
    if (!parsed) continue;
    pattern.lastIndex = parsed.end;
    const matrix = parseSmallMatrixBody(parsed.matrix);
    if (!matrix.length) continue;
    blocks.push({
      labelPosition: parsed.kind === "overmat" ? "top" : "bottom",
      label: tensorMatrixLabelText(parsed.label),
      color: tensorMatrixColor(parsed.color),
      matrix
    });
  }
  return blocks.length >= 2 ? blocks.slice(0, 4) : null;
}

function readTensorMatrixMacro(source, start, kind) {
  let cursor = start + kind.length + 1;
  const label = readBalancedGroup(source, skipInlineWhitespace(source, cursor));
  if (!label) return null;
  cursor = label.end;
  const matrix = readBalancedGroup(source, skipInlineWhitespace(source, cursor));
  if (!matrix) return null;
  cursor = matrix.end;
  const color = readBalancedGroup(source, skipInlineWhitespace(source, cursor));
  if (!color) return null;
  return {
    kind,
    label: label.content,
    matrix: matrix.content,
    color: color.content,
    end: color.end
  };
}

function tensorMatrixLabelText(value) {
  return formatTextLine(value)
    .replace(/\\textcolor\s*\{[^{}]+\}\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:text|mathrm|mathbf|bf)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\$/g, "")
    .trim();
}

function parseSmallMatrixBody(source) {
  const match = String(source || "").match(/\\begin\{matrix\}([\s\S]*?)\\end\{matrix\}/);
  if (!match) return [];
  return match[1]
    .split(/\\\\/)
    .map((row) =>
      row
        .split("&")
        .map((cell) => mathFallbackText(cell).trim())
        .filter(Boolean)
    )
    .filter((row) => row.length);
}

function tensorMatrixColor(value) {
  const raw = String(value || "").trim();
  if (/^#?[0-9a-f]{6}$/i.test(raw)) return raw.startsWith("#") ? raw : `#${raw}`;
  if (/echodrk/i.test(raw)) return "#0099cc";
  if (/red/i.test(raw)) return "red";
  if (/gray|grey/i.test(raw)) return "gray";
  return "black";
}

function renderTensorMatrixFallback(item, blocks, baseFontSize, unit, color) {
  const cx = item.x * unit;
  const cy = -item.y * unit;
  const fontSize = Math.max(6, Math.min(36, baseFontSize));
  const cell = fontSize * 0.82;
  const rowCell = fontSize * 0.94;
  const labelHeight = fontSize * 0.8;
  const matrixWidth = cell * 3.25;
  const matrixHeight = rowCell * 3.05;
  const bracketPad = fontSize * 0.32;
  const blockWidth = matrixWidth + bracketPad * 2 + fontSize * 0.2;
  const blockHeight = matrixHeight + labelHeight + fontSize * 0.42;
  const gapX = fontSize;
  const gapY = fontSize * 0.1;
  const prefixWidth = fontSize * 2.1;
  const gridWidth = blockWidth * 2 + gapX;
  const gridHeight = blockHeight * 2 + gapY;
  const totalWidth = prefixWidth + gridWidth + fontSize * 0.8;
  const startX = cx - totalWidth / 2;
  const startY = cy - gridHeight / 2;
  const parts = [
    `<g class="tikz-tensor-matrix" font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}" fill="${color}">`,
    `<text x="${format(startX)}" y="${format(cy)}" text-anchor="start" dominant-baseline="middle" font-size="${format(
      fontSize * 1.2
    )}">M =</text>`,
    `<path d="M ${format(startX + prefixWidth - fontSize * 0.2)} ${format(startY - fontSize * 0.1)} L ${format(
      startX + prefixWidth - fontSize * 0.55
    )} ${format(startY - fontSize * 0.1)} L ${format(startX + prefixWidth - fontSize * 0.55)} ${format(startY + gridHeight + fontSize * 0.1)} L ${format(
      startX + prefixWidth - fontSize * 0.2
    )} ${format(startY + gridHeight + fontSize * 0.1)} M ${format(startX + totalWidth - fontSize * 0.45)} ${format(startY - fontSize * 0.1)} L ${format(
      startX + totalWidth - fontSize * 0.1
    )} ${format(startY - fontSize * 0.1)} L ${format(startX + totalWidth - fontSize * 0.1)} ${format(
      startY + gridHeight + fontSize * 0.1
    )} L ${format(startX + totalWidth - fontSize * 0.45)} ${format(startY + gridHeight + fontSize * 0.1)}" stroke="${color}" fill="none" stroke-width="${format(
      Math.max(0.55, fontSize * 0.08)
    )}" />`
  ];
  blocks.forEach((block, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = startX + prefixWidth + col * (blockWidth + gapX);
    const y = startY + row * (blockHeight + gapY);
    parts.push(renderTensorMatrixBlock(block, x, y, { fontSize, cell, rowCell, matrixWidth, matrixHeight, blockWidth, labelHeight, bracketPad }));
  });
  parts.push("</g>");
  return parts.join("");
}

function renderTensorMatrixBlock(block, x, y, metrics) {
  const { fontSize, cell, rowCell = cell, matrixWidth, matrixHeight, blockWidth, labelHeight, bracketPad } = metrics;
  const matrixX = x + (blockWidth - matrixWidth) / 2;
  const matrixY = y + (block.labelPosition === "top" ? labelHeight + fontSize * 0.08 : 0);
  const braceY = block.labelPosition === "top" ? matrixY - fontSize * 0.22 : matrixY + matrixHeight + fontSize * 0.22;
  const labelY = block.labelPosition === "top" ? braceY - fontSize * 0.42 : braceY + fontSize * 0.5;
  const stroke = escapeAttribute(block.color || "black");
  const bracketLeft = matrixX - bracketPad * 0.72;
  const bracketRight = matrixX + matrixWidth + bracketPad * 0.72;
  const bracketTop = matrixY - fontSize * 0.05;
  const bracketBottom = matrixY + matrixHeight + fontSize * 0.05;
  const parts = [
    `<text x="${format(x + blockWidth / 2)}" y="${format(labelY)}" fill="${stroke}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
      fontSize * 0.72
    )}">${escapeText(block.label)}</text>`,
    `<path class="tikz-tensor-brace" d="${tensorBracePath(matrixX, matrixX + matrixWidth, braceY, fontSize * 0.18, block.labelPosition)}" stroke="${stroke}" fill="none" stroke-width="${format(
      Math.max(0.45, fontSize * 0.045)
    )}" stroke-linecap="round" stroke-linejoin="round" />`,
    `<path class="tikz-tensor-inner-bracket" d="${squareBracketPath(
      bracketLeft,
      bracketRight,
      bracketTop,
      bracketBottom,
      fontSize * 0.18
    )}" stroke="black" fill="none" stroke-width="${format(Math.max(0.45, fontSize * 0.045))}" stroke-linecap="square" />`
  ];
  const rows = block.matrix;
  rows.forEach((row, rowIndex) => {
    row.forEach((cellText, colIndex) => {
      parts.push(
        `<text x="${format(matrixX + cell * (0.58 + colIndex))}" y="${format(matrixY + rowCell * (0.62 + rowIndex))}" fill="black" text-anchor="middle" dominant-baseline="middle" font-size="${format(
          fontSize * 0.78
        )}">${escapeText(cellText)}</text>`
      );
    });
  });
  return `<g class="tikz-tensor-matrix-block">${parts.join("")}</g>`;
}

function squareBracketPath(left, right, top, bottom, tick) {
  return [
    `M ${format(left + tick)} ${format(top)}`,
    `L ${format(left)} ${format(top)}`,
    `L ${format(left)} ${format(bottom)}`,
    `L ${format(left + tick)} ${format(bottom)}`,
    `M ${format(right - tick)} ${format(top)}`,
    `L ${format(right)} ${format(top)}`,
    `L ${format(right)} ${format(bottom)}`,
    `L ${format(right - tick)} ${format(bottom)}`
  ].join(" ");
}

function tensorBracePath(left, right, y, amplitude, labelPosition) {
  const width = right - left;
  const mid = (left + right) / 2;
  const sign = labelPosition === "top" ? -1 : 1;
  const outerY = y;
  const innerY = y + amplitude * sign;
  const cuspY = y + amplitude * 1.25 * sign;
  return [
    `M ${format(left)} ${format(outerY)}`,
    `C ${format(left + width * 0.08)} ${format(innerY)} ${format(mid - width * 0.18)} ${format(innerY)} ${format(mid - width * 0.06)} ${format(cuspY)}`,
    `C ${format(mid - width * 0.02)} ${format(y + amplitude * 0.55 * sign)} ${format(mid + width * 0.02)} ${format(y + amplitude * 0.55 * sign)} ${format(mid + width * 0.06)} ${format(cuspY)}`,
    `C ${format(mid + width * 0.18)} ${format(innerY)} ${format(right - width * 0.08)} ${format(innerY)} ${format(right)} ${format(outerY)}`
  ].join(" ");
}

function renderSimpleSubscriptMathFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const subFontSize = baseFontSize * 0.7;
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}">${renderMathBaseText(parts.base)}<tspan font-size="${format(
    subFontSize
  )}" font-style="normal" baseline-shift="sub">${escapeText(parts.subscript)}</tspan></text>`;
}

function renderHatSubscriptMathFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const subFontSize = baseFontSize * 0.7;
  const x = item.x * unit;
  const y = -item.y * unit;
  const baseWidth = Math.max(baseFontSize * 0.42, parts.base.length * baseFontSize * 0.44);
  const hatWidth = Math.max(baseFontSize * 0.28, baseWidth * 0.72);
  const hatX = x - baseWidth * 0.08;
  const hatY = y - baseFontSize * 0.44;
  const text = `<text x="${format(x)}" y="${format(y)}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}">${renderMathBaseText(parts.base)}<tspan font-size="${format(
    subFontSize
  )}" font-style="normal" baseline-shift="sub">${escapeText(parts.subscript)}</tspan></text>`;
  const hat = `<path d="M ${format(hatX - hatWidth / 2)} ${format(hatY + baseFontSize * 0.07)} L ${format(hatX)} ${format(
    hatY - baseFontSize * 0.08
  )} L ${format(hatX + hatWidth / 2)} ${format(hatY + baseFontSize * 0.07)}" stroke="${color}" fill="none" stroke-width="${format(
    Math.max(0.45, baseFontSize * 0.06)
  )}" stroke-linecap="round" stroke-linejoin="round" />`;
  return `<g class="tikz-math-hat">${text}${hat}</g>`;
}

function renderFractionMathFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const fractionFontSize = baseFontSize * 0.78;
  const x = item.x * unit;
  const y = -item.y * unit;
  const numerator = renderFractionPartContent(parts.numerator, fractionFontSize);
  const denominator = renderFractionPartContent(parts.denominator, fractionFontSize);
  const width = Math.max(
    fractionTextWidth(parts.numerator, fractionFontSize),
    fractionTextWidth(parts.denominator, fractionFontSize),
    fractionFontSize * 0.9
  );
  const commonTextAttrs = `fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    fractionFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}"`;
  return `<g class="tikz-fraction"><text x="${format(x)}" y="${format(y - fractionFontSize * 0.42)}" ${commonTextAttrs}>${numerator}</text><line x1="${format(
    x - width / 2
  )}" y1="${format(y + fractionFontSize * 0.08)}" x2="${format(x + width / 2)}" y2="${format(
    y + fractionFontSize * 0.08
  )}" stroke="${color}" stroke-width="${format(Math.max(0.45, fractionFontSize * 0.055))}" /><text x="${format(
    x
  )}" y="${format(y + fractionFontSize * 0.58)}" ${commonTextAttrs}>${denominator}</text></g>`;
}

function renderInlineFractionMathFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const fractionFontSize = baseFontSize * 0.78;
  const inlineFontSize = baseFontSize;
  const x = item.x * unit;
  const y = -item.y * unit;
  const gap = inlineFontSize * 0.28;
  const prefixWidth = parts.prefix ? fractionTextWidth(parts.prefix, inlineFontSize) : 0;
  const suffixWidth = parts.suffix ? fractionTextWidth(parts.suffix, inlineFontSize) : 0;
  const fractionWidth = Math.max(
    fractionTextWidth(parts.numerator, fractionFontSize),
    fractionTextWidth(parts.denominator, fractionFontSize),
    fractionFontSize * 0.9
  );
  const totalWidth = prefixWidth + fractionWidth + suffixWidth + (prefixWidth ? gap : 0) + (suffixWidth ? gap : 0);
  let cursor = x - totalWidth / 2;
  const textAttrs = `fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    inlineFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}"`;
  const fractionTextAttrs = `fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    fractionFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}"`;
  const output = [`<g class="tikz-inline-fraction">`];
  if (prefixWidth) {
    output.push(`<text x="${format(cursor + prefixWidth / 2)}" y="${format(y)}" ${textAttrs}>${renderFractionPartContent(parts.prefix, inlineFontSize)}</text>`);
    cursor += prefixWidth + gap;
  }
  const fractionX = cursor + fractionWidth / 2;
  output.push(`<text x="${format(fractionX)}" y="${format(y - fractionFontSize * 0.46)}" ${fractionTextAttrs}>${renderFractionPartContent(
    parts.numerator,
    fractionFontSize
  )}</text>`);
  output.push(`<line x1="${format(fractionX - fractionWidth / 2)}" y1="${format(y + fractionFontSize * 0.08)}" x2="${format(
    fractionX + fractionWidth / 2
  )}" y2="${format(y + fractionFontSize * 0.08)}" stroke="${color}" stroke-width="${format(Math.max(0.45, fractionFontSize * 0.055))}" />`);
  output.push(`<text x="${format(fractionX)}" y="${format(y + fractionFontSize * 0.6)}" ${fractionTextAttrs}>${renderFractionPartContent(
    parts.denominator,
    fractionFontSize
  )}</text>`);
  cursor += fractionWidth + (suffixWidth ? gap : 0);
  if (suffixWidth) {
    output.push(`<text x="${format(cursor + suffixWidth / 2)}" y="${format(y)}" ${textAttrs}>${renderFractionPartContent(parts.suffix, inlineFontSize)}</text>`);
  }
  output.push("</g>");
  return output.join("");
}

function sumLimitsInlineFallback(tex) {
  const raw = String(tex || "");
  const sumIndex = raw.indexOf("\\sum");
  if (sumIndex === -1) return null;
  let cursor = sumIndex + "\\sum".length;
  cursor = skipInlineWhitespace(raw, cursor);
  if (raw.startsWith("\\limits", cursor)) {
    cursor += "\\limits".length;
    cursor = skipInlineWhitespace(raw, cursor);
  }
  if (raw[cursor] !== "_") return null;
  const lower = readMathScriptArgument(raw, cursor + 1);
  if (!lower) return null;
  cursor = skipInlineWhitespace(raw, lower.end);
  if (raw[cursor] !== "^") return null;
  const upper = readMathScriptArgument(raw, cursor + 1);
  if (!upper) return null;
  cursor = skipInlineWhitespace(raw, upper.end);
  let term = "";
  const termGroup = readBalancedGroup(raw, cursor);
  if (termGroup) {
    term = termGroup.content;
    cursor = termGroup.end;
  }
  return {
    prefix: raw.slice(0, sumIndex),
    lower: lower.content,
    upper: upper.content,
    term,
    suffix: raw.slice(cursor)
  };
}

function readMathScriptArgument(raw, cursor) {
  cursor = skipInlineWhitespace(raw, cursor);
  const group = readBalancedGroup(raw, cursor);
  if (group) return group;
  const match = String(raw || "").slice(cursor).match(/^\\?[A-Za-z0-9+\-=()]+/);
  if (!match) return null;
  return { content: match[0], end: cursor + match[0].length };
}

function renderSumLimitsInlineFallback(item, parts, baseFontSize, unit, color, fontStyle, fontWeight) {
  const fontSize = baseFontSize;
  const limitFontSize = fontSize * 0.52;
  const sumFontSize = fontSize * 1.08;
  const gap = fontSize * 0.04;
  const prefixWidth = parts.prefix ? sumLimitsPartWidth(parts.prefix, fontSize) : 0;
  const termWidth = parts.term ? sumLimitsPartWidth(parts.term, fontSize) : 0;
  const suffixWidth = parts.suffix ? sumLimitsPartWidth(parts.suffix, fontSize) : 0;
  const limitWidth = Math.max(
    sumLimitsPartWidth(parts.upper, limitFontSize),
    sumLimitsPartWidth(parts.lower, limitFontSize),
    sumFontSize * 0.46
  );
  const totalWidth = prefixWidth + limitWidth + termWidth + suffixWidth + gap * 3;
  const x = item.x * unit;
  const y = -item.y * unit;
  let cursor = x - totalWidth / 2;
  const textAttrs = `fill="${color}" text-anchor="middle" dominant-baseline="middle"${fontStyle ? ` font-style="${fontStyle}"` : ""}${
    fontWeight ? ` font-weight="${fontWeight}"` : ""
  } font-family="${escapeAttribute(TIKZ_FONT_FAMILY)}"`;
  const partsOut = [`<g class="tikz-sum-limits-inline">`];
  if (prefixWidth) {
    partsOut.push(`<text x="${format(cursor + prefixWidth / 2)}" y="${format(y)}" ${textAttrs} font-size="${format(fontSize)}">${renderFractionPartContent(
      parts.prefix,
      fontSize
    )}</text>`);
    cursor += prefixWidth + gap;
  }
  const sumX = cursor + limitWidth / 2;
  partsOut.push(`<text x="${format(sumX)}" y="${format(y + fontSize * 0.08)}" ${textAttrs} font-size="${format(sumFontSize)}">∑</text>`);
  partsOut.push(`<text x="${format(sumX)}" y="${format(y - fontSize * 0.66)}" ${textAttrs} font-size="${format(limitFontSize)}">${renderFractionPartContent(
    parts.upper,
    limitFontSize
  )}</text>`);
  partsOut.push(`<text x="${format(sumX)}" y="${format(y + fontSize * 0.72)}" ${textAttrs} font-size="${format(limitFontSize)}">${renderFractionPartContent(
    parts.lower,
    limitFontSize
  )}</text>`);
  cursor += limitWidth + gap;
  if (termWidth) {
    partsOut.push(`<text x="${format(cursor + termWidth / 2)}" y="${format(y)}" ${textAttrs} font-size="${format(fontSize)}">${renderFractionPartContent(
      parts.term,
      fontSize
    )}</text>`);
    cursor += termWidth + gap;
  }
  if (suffixWidth) {
    partsOut.push(`<text x="${format(cursor + suffixWidth / 2)}" y="${format(y)}" ${textAttrs} font-size="${format(fontSize)}">${renderFractionPartContent(
      parts.suffix,
      fontSize
    )}</text>`);
  }
  partsOut.push("</g>");
  return partsOut.join("");
}

function sumLimitsPartWidth(tex, fontSize) {
  const fallback = mathFallbackText(tex).replace(/\s+/g, "");
  return Math.max(fontSize * 0.18, [...fallback].length * fontSize * 0.38);
}

function renderFractionPartContent(tex, fontSize) {
  if (/\\(?:frac|dfrac|tfrac)\s*\{/.test(String(tex || ""))) {
    return `<tspan>${escapeText(mathFallbackText(tex))}</tspan>`;
  }
  const mixed = mixedAlphabeticSubscriptFallback(tex);
  if (mixed) {
    const subFontSize = fontSize * 0.7;
    return mixed
      .map((segment) => {
        if (segment.kind === "text") return `<tspan>${escapeText(segment.text)}</tspan>`;
        return `${renderMathBaseText(segment.base)}<tspan font-size="${format(
          subFontSize
        )}" font-style="normal" baseline-shift="sub">${escapeText(segment.subscript)}</tspan>`;
      })
      .join("");
  }
  const scripted = scriptedMathFallback(tex);
  if (scripted) {
    const scriptFontSize = fontSize * 0.66;
    return scripted
      .map((segment) => {
        if (segment.kind === "text") return `<tspan>${escapeText(segment.text)}</tspan>`;
        return `${renderMathBaseText(segment.base)}${
          segment.superscript
            ? `<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="super">${renderNestedScriptText(
                segment.superscript,
                scriptFontSize
              )}</tspan>`
            : ""
        }${
          segment.subscript
            ? `<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="sub">${renderNestedScriptText(
                segment.subscript,
                scriptFontSize
              )}</tspan>`
            : ""
        }`;
      })
      .join("");
  }
  return `<tspan>${escapeText(mathFallbackText(tex))}</tspan>`;
}

function coloredMathTextFallback(tex) {
  const raw = String(tex || "");
  if (!raw.includes("\\textcolor")) return null;
  const segments = [];
  let cursor = 0;
  while (cursor < raw.length) {
    const index = raw.indexOf("\\textcolor", cursor);
    if (index === -1) {
      const texPart = raw.slice(cursor);
      if (texPart) segments.push({ tex: texPart, color: null });
      break;
    }
    if (index > cursor) segments.push({ tex: raw.slice(cursor, index), color: null });
    const read = readTextColorCommand(raw, index);
    if (!read) {
      segments.push({ tex: raw.slice(index, index + "\\textcolor".length), color: null });
      cursor = index + "\\textcolor".length;
      continue;
    }
    segments.push({ tex: read.body, color: read.color });
    cursor = read.end;
  }
  return segments.some((segment) => segment.color) ? segments : null;
}

function readTextColorCommand(raw, start) {
  if (!raw.startsWith("\\textcolor", start)) return null;
  let cursor = start + "\\textcolor".length;
  cursor = skipInlineWhitespace(raw, cursor);
  const color = readBalancedGroup(raw, cursor);
  if (!color) return null;
  cursor = skipInlineWhitespace(raw, color.end);
  const body = readBalancedGroup(raw, cursor);
  if (!body) return null;
  return { color: color.content.trim(), body: body.content, end: body.end };
}

function renderColoredMathTextFallback(item, segments, baseFontSize, unit, color, fontStyle, fontWeight) {
  const x = item.x * unit;
  const y = -item.y * unit;
  const textAttrs = `fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}"`;
  const content = segments
    .map((segment) => {
      const rendered = renderFractionPartContent(segment.tex, baseFontSize);
      if (!segment.color) return rendered;
      return `<tspan fill="${escapeAttribute(segment.color)}">${rendered}</tspan>`;
    })
    .join("");
  return `<text x="${format(x)}" y="${format(y)}" ${textAttrs}>${content}</text>`;
}

function fractionTextWidth(tex, fontSize) {
  return Math.max(1, mathFallbackText(tex).length) * fontSize * 0.56;
}

function renderMixedSubscriptMathFallback(item, segments, baseFontSize, unit, color, fontStyle, fontWeight) {
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  const content = renderMixedSubscriptContent(segments, baseFontSize);
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}">${content}</text>`;
}

function renderScriptedMathFallback(item, segments, baseFontSize, unit, color, fontStyle, fontWeight) {
  const x = format(item.x * unit);
  const y = format(-item.y * unit);
  const content = renderScriptedSegmentsContent(segments, baseFontSize);
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-size="${format(
    baseFontSize
  )}"${fontStyle ? ` font-style="${fontStyle}"` : ""}${fontWeight ? ` font-weight="${fontWeight}"` : ""} font-family="${escapeAttribute(
    TIKZ_FONT_FAMILY
  )}">${content}</text>`;
}

function renderSimpleSubscriptContent(parts, baseFontSize) {
  const subFontSize = baseFontSize * 0.7;
  return `${renderMathBaseText(parts.base)}<tspan font-size="${format(
    subFontSize
  )}" font-style="normal" baseline-shift="sub">${escapeText(parts.subscript)}</tspan>`;
}

function renderMixedSubscriptContent(segments, baseFontSize) {
  const subFontSize = baseFontSize * 0.7;
  return segments
    .map((segment) => {
      if (segment.kind === "text") return escapeText(segment.text);
      return `${renderMathBaseText(segment.base)}<tspan font-size="${format(
        subFontSize
      )}" font-style="normal" baseline-shift="sub">${escapeText(segment.subscript)}</tspan>`;
    })
    .join("");
}

function renderLeadingScriptContent(parts, baseFontSize) {
  const scriptFontSize = baseFontSize * 0.66;
  const shift = parts.kind === "super" ? "super" : "sub";
  return `<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="${shift}">${renderNestedScriptText(
    parts.text,
    scriptFontSize
  )}</tspan>`;
}

function renderScriptedSegmentsContent(segments, baseFontSize) {
  const scriptFontSize = baseFontSize * 0.66;
  const operatorSpacing =
    segments.some((segment) => segment.operatorSpacing) ||
    segments.some((segment) => segment.kind === "text" && /[=+≤≥≠≈]/.test(segment.text));
  return segments
    .map((segment) => {
      if (segment.kind === "text") return operatorSpacing ? renderMathOperatorSpacedText(segment.text, baseFontSize) : escapeText(segment.text);
      if (segment.kind === "bold") return `<tspan font-weight="700" font-style="normal">${escapeText(segment.text)}</tspan>`;
      const base = renderMathBaseText(segment.base);
      if (segment.superscript && segment.subscript) {
        const backtrack = Math.max(0, estimateScriptTextWidth(segment.superscript, scriptFontSize));
        return `${base}<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="super">${renderNestedScriptText(
          segment.superscript,
          scriptFontSize
        )}</tspan><tspan dx="${format(-backtrack)}" font-size="${format(
          scriptFontSize
        )}" font-style="normal" baseline-shift="sub">${renderNestedScriptText(segment.subscript, scriptFontSize)}</tspan>`;
      }
      if (segment.superscript) {
        return `${base}<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="super">${renderNestedScriptText(
          segment.superscript,
          scriptFontSize
        )}</tspan>`;
      }
      return `${base}<tspan font-size="${format(scriptFontSize)}" font-style="normal" baseline-shift="sub">${renderNestedScriptText(
        segment.subscript,
        scriptFontSize
      )}</tspan>`;
    })
    .join("");
}

function renderMathBaseText(text) {
  const raw = String(text || "");
  if (!raw.includes("\u0304")) return `<tspan>${escapeText(raw)}</tspan>`;
  const parts = [];
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (raw[index + 1] === "\u0304") {
      parts.push(`<tspan text-decoration="overline">${escapeText(char)}</tspan>`);
      index += 1;
    } else {
      parts.push(`<tspan>${escapeText(char)}</tspan>`);
    }
  }
  return parts.join("");
}

function texNeedsOperatorSpacing(tex) {
  return /\\(?:leq|le|geq|ge|neq|approx)(?![A-Za-z])|[=<>]/.test(String(tex || ""));
}

function renderMathOperatorSpacedText(text, baseFontSize) {
  const source = String(text || "");
  if (!/[=+≤≥≠≈]/.test(source)) return escapeText(source);
  const spacing = Math.max(1.5, baseFontSize * 0.12);
  return [...source]
    .map((char) => {
      if (/[=+≤≥≠≈]/.test(char)) {
        return `<tspan dx="${format(spacing)}" font-style="normal">${escapeText(char)}</tspan><tspan dx="${format(spacing)}"></tspan>`;
      }
      return escapeText(char);
    })
    .join("");
}

function estimateScriptTextWidth(text, fontSize) {
  return String(text || "").length * fontSize * 0.52;
}

function simpleFractionFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const command = raw.match(/^\\(?:frac|dfrac|tfrac)\b/);
  if (!command) return null;
  let cursor = skipInlineWhitespace(raw, command[0].length);
  const numerator = readBalancedGroup(raw, cursor);
  if (!numerator) return null;
  cursor = skipInlineWhitespace(raw, numerator.end);
  const denominator = readBalancedGroup(raw, cursor);
  if (!denominator) return null;
  cursor = skipInlineWhitespace(raw, denominator.end);
  if (cursor !== raw.length) return null;
  return { numerator: numerator.content, denominator: denominator.content };
}

function inlineFractionFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "")
    .replace(/\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)(?![A-Za-z])\s*/g, "");
  const pattern = /\\(?:frac|dfrac|tfrac)\b/g;
  let match;
  while ((match = pattern.exec(raw))) {
    let cursor = skipInlineWhitespace(raw, match.index + match[0].length);
    const numerator = readBalancedGroup(raw, cursor);
    if (!numerator) continue;
    cursor = skipInlineWhitespace(raw, numerator.end);
    const denominator = readBalancedGroup(raw, cursor);
    if (!denominator) continue;
    cursor = skipInlineWhitespace(raw, denominator.end);
    const prefix = raw.slice(0, match.index).trim();
    const suffix = raw.slice(cursor).trim();
    if (!prefix && !suffix) return null;
    return { prefix, numerator: numerator.content, denominator: denominator.content, suffix };
  }
  return null;
}

function mathStyleScale(tex) {
  const raw = String(tex || "");
  if (/\\displaystyle(?![A-Za-z])/.test(raw)) return 1.18;
  if (/\\(?:scriptstyle|scriptscriptstyle)(?![A-Za-z])/.test(raw)) return 0.78;
  return 1;
}

function renderNestedScriptText(text, fontSize) {
  const raw = String(text || "");
  const nestedFontSize = fontSize * 0.74;
  let output = "";
  let cursor = 0;
  const pattern = /_([A-Za-z0-9+\-=()]+)/g;
  let match;
  while ((match = pattern.exec(raw))) {
    output += escapeText(raw.slice(cursor, match.index));
    output += `<tspan font-size="${format(nestedFontSize)}" baseline-shift="sub">${escapeText(match[1])}</tspan>`;
    cursor = pattern.lastIndex;
  }
  output += escapeText(raw.slice(cursor));
  return output;
}

function simpleNumericSubscriptFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const match = raw.match(/^((?:\\[A-Za-z]+(?:\s*\{[^{}]*\})?)|[A-Za-z])\s*_\s*(?:\{([A-Za-z0-9]+)\}|([A-Za-z0-9]+))$/);
  if (!match) return null;
  const base = mathFallbackText(match[1]);
  const subscript = match[2] || match[3];
  if (!base || !subscript) return null;
  return { base, subscript };
}

function hatAccentSubscriptFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const match = raw.match(/^\\hat\s*(?:\{([^{}]+)\}|([A-Za-z]))\s*_\s*(?:\{([^{}]+)\}|([A-Za-z0-9]+))$/);
  if (!match) return null;
  const base = mathFallbackText(match[1] || match[2]);
  const subscript = mathScriptFallbackText(match[3] || match[4]);
  if (!base || !subscript) return null;
  return { base, subscript };
}

function mixedAlphabeticSubscriptFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const pattern = /((?:\\[A-Za-z]+(?:\s*\{[^{}]*\})?)|[A-Za-z])\s*_\s*(?:\{([A-Za-z0-9+\-=,]+)\}|([A-Za-z0-9+\-=,]))/g;
  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(raw))) {
    const before = raw.slice(lastIndex, match.index);
    const beforeText = mathFallbackSegmentText(before);
    if (beforeText) segments.push({ kind: "text", text: beforeText });
    const base = mathFallbackText(match[1]);
    const subscript = mathScriptFallbackText(match[2] || match[3]);
    if (!base || !subscript) return null;
    segments.push({ kind: "subscript", base, subscript });
    lastIndex = pattern.lastIndex;
  }
  if (!segments.some((segment) => segment.kind === "subscript")) return null;
  const afterText = mathFallbackSegmentText(raw.slice(lastIndex));
  if (afterText) segments.push({ kind: "text", text: afterText });
  return segments;
}

function scriptedMathFallback(tex, options = {}) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const segments = [];
  let cursor = 0;
  let lastIndex = 0;
  let hasScript = false;
  let hasSuperscript = false;
  let hasCommandScriptValue = false;
  let hasAccentBaseScript = false;
  let hasParenthesizedSuperscript = false;
  while (cursor < raw.length) {
    const atom = readMathScriptAtom(raw, cursor);
    if (!atom) {
      cursor += 1;
      continue;
    }
    let next = atom.end;
    let subscript = null;
    let superscript = null;
    for (let i = 0; i < 2; i += 1) {
      next = skipInlineWhitespace(raw, next);
      const marker = raw[next];
      if (marker !== "_" && marker !== "^") break;
      const script = readMathScriptValue(raw, next + 1);
      if (!script) break;
      if (marker === "_") subscript = script.value;
      else {
        superscript = script.value;
        hasSuperscript = true;
      }
      if (/^\\[A-Za-z]+/.test(script.value)) hasCommandScriptValue = true;
      next = script.end;
    }
    if (!subscript && !superscript) {
      cursor = atom.end;
      continue;
    }
    const before = mathFallbackSegmentText(raw.slice(lastIndex, cursor));
    if (before) segments.push({ kind: "text", text: before });
    const base = mathFallbackText(atom.source);
    if (!base) return null;
    if (subscript && isAccentMathAtom(atom.source)) hasAccentBaseScript = true;
    if (superscript && atom.parenthesized) hasParenthesizedSuperscript = true;
    segments.push({
      kind: "script",
      base,
      subscript: subscript ? mathScriptFallbackText(subscript) : null,
      superscript: superscript ? mathScriptFallbackText(superscript) : null,
      operatorSpacing: Boolean(superscript && atom.parenthesized)
    });
    hasScript = true;
    lastIndex = next;
    cursor = next;
  }
  if (
    !hasScript ||
    (!options.allowSimpleScripts && !hasSuperscript && !hasCommandScriptValue && !hasAccentBaseScript && !hasParenthesizedSuperscript)
  ) {
    return null;
  }
  const after = mathFallbackSegmentText(raw.slice(lastIndex));
  if (after) segments.push({ kind: "text", text: after });
  return segments;
}

function styledScriptedMathFallback(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\\(?:bf|bfseries)\b\s*/, "");
  const segments = [];
  let cursor = 0;
  let lastIndex = 0;
  let matched = false;
  while (cursor < raw.length) {
    const bold = readScopedBoldSegment(raw, cursor);
    if (bold) {
      const before = mathFallbackSegmentText(raw.slice(lastIndex, cursor));
      if (before) segments.push({ kind: "text", text: before });
      if (bold.text) segments.push({ kind: "bold", text: bold.text });
      lastIndex = bold.end;
      cursor = bold.end;
      matched = true;
      continue;
    }
    const atom = readMathScriptAtom(raw, cursor);
    if (!atom) {
      cursor += 1;
      continue;
    }
    let next = atom.end;
    let subscript = null;
    let superscript = null;
    for (let i = 0; i < 2; i += 1) {
      next = skipInlineWhitespace(raw, next);
      const marker = raw[next];
      if (marker !== "_" && marker !== "^") break;
      const script = readMathScriptValue(raw, next + 1);
      if (!script) break;
      if (marker === "_") subscript = script.value;
      else superscript = script.value;
      next = script.end;
    }
    if (!subscript && !superscript) {
      cursor = atom.end;
      continue;
    }
    const before = mathFallbackSegmentText(raw.slice(lastIndex, cursor));
    if (before) segments.push({ kind: "text", text: before });
    const base = mathFallbackText(atom.source);
    if (!base) return null;
    segments.push({
      kind: "script",
      base,
      subscript: subscript ? mathScriptFallbackText(subscript) : null,
      superscript: superscript ? mathScriptFallbackText(superscript) : null
    });
    lastIndex = next;
    cursor = next;
    matched = true;
  }
  if (!matched) return null;
  const after = mathFallbackSegmentText(raw.slice(lastIndex));
  if (after) segments.push({ kind: "text", text: after });
  return segments;
}

function mathFallbackSegmentText(source) {
  const raw = String(source || "");
  const fallback = mathFallbackText(raw);
  if (!fallback) return "";
  const leading = /^\s/.test(raw) ? " " : "";
  const trailing = /\s$/.test(raw) ? " " : "";
  return `${leading}${fallback}${trailing}`;
}

function readScopedBoldSegment(raw, start) {
  if (raw[start] === "{") {
    const group = readBalancedGroup(raw, start);
    const content = group?.content.trim() || "";
    if (!/^\\(?:bf|bfseries)\b/.test(content)) return null;
    const text = mathFallbackText(group.content);
    return text ? { text, end: group.end } : null;
  }
  const command = raw.slice(start).match(/^\\(?:mathbf|boldsymbol|textbf)\b\s*/);
  if (!command) return null;
  const group = readBalancedGroup(raw, start + command[0].length);
  if (!group) return null;
  const text = mathFallbackText(group.content);
  return text ? { text, end: group.end } : null;
}

function leadingScriptFallback(tex) {
  const raw = String(tex || "").trim();
  const marker = raw[0];
  if (marker !== "_" && marker !== "^") return null;
  const script = readMathScriptValue(raw, 1);
  if (!script) return null;
  if (skipInlineWhitespace(raw, script.end) < raw.length) return null;
  const text = mathScriptFallbackText(script.value);
  if (!text) return null;
  return { kind: marker === "^" ? "super" : "sub", text };
}

function readMathScriptAtom(raw, start) {
  const char = raw[start];
  if (!char || /\s/.test(char)) return null;
  if (char === "{") {
    const group = readBalancedGroup(raw, start);
    if (!group || !/^\\(?:bf|bfseries|mathbf|boldsymbol)\b/.test(group.content.trim())) return null;
    return { source: raw.slice(start, group.end), end: group.end };
  }
  if (char === "(") {
    const end = readBalancedParenthesis(raw, start);
    const next = end ? skipInlineWhitespace(raw, end) : null;
    if (end && (raw[next] === "_" || raw[next] === "^")) return { source: raw.slice(start, end), end, parenthesized: true };
  }
  const command = raw.slice(start).match(/^\\[A-Za-z]+/);
  if (command) {
    let end = start + command[0].length;
    if (mathAtomCommandTakesGroup(command[0]) && raw[end] === "{") {
      const group = readBalancedGroup(raw, end);
      if (group) end = group.end;
    }
    return { source: raw.slice(start, end), end };
  }
  if (/[A-Za-z]/.test(char)) {
    let end = start + 1;
    if (raw[end] === "'") end += 1;
    return { source: raw.slice(start, end), end };
  }
  return null;
}

function readBalancedParenthesis(raw, start) {
  let depth = 0;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return null;
}

function mathAtomCommandTakesGroup(command) {
  return /^\\(?:bar|overline|hat|check|vec|overrightarrow|sqrt|mathbf|boldsymbol|mathcal|text|textnormal|mathrm|textrm|texttt|textbf|emph)$/.test(
    command
  );
}

function isAccentMathAtom(source) {
  return /^\\(?:bar|overline|hat|check|vec|overrightarrow|widetilde|tilde)\b/.test(String(source || "").trim());
}

function readMathScriptValue(raw, start) {
  let cursor = skipInlineWhitespace(raw, start);
  if (raw[cursor] === "{") {
    const group = readBalancedGroup(raw, cursor);
    if (!group) return null;
    return { value: group.content, end: group.end };
  }
  const command = raw.slice(cursor).match(/^\\[A-Za-z]+/);
  if (command) {
    let end = cursor + command[0].length;
    if (mathAtomCommandTakesGroup(command[0]) && raw[end] === "{") {
      const group = readBalancedGroup(raw, end);
      if (group) end = group.end;
    }
    return { value: raw.slice(cursor, end), end };
  }
  if (!raw[cursor]) return null;
  return { value: raw[cursor], end: cursor + 1 };
}

function readBalancedGroup(raw, start) {
  if (raw[start] !== "{") return null;
  let depth = 0;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return { content: raw.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function skipInlineWhitespace(raw, start) {
  let cursor = start;
  while (/\s/.test(raw[cursor] || "")) cursor += 1;
  return cursor;
}

function mathScriptFallbackText(value) {
  return mathFallbackText(value).replace(/^_/, "");
}

function mathFallbackFontStyle(tex) {
  const raw = String(tex || "");
  if (/\\(?:text|mathrm|operatorname|mathsf|mathtt)\b/.test(raw) || hasWholeMathBoldCommand(raw)) return "";
  const fallback = mathFallbackText(raw);
  if (!/[A-Za-z]/.test(fallback)) return "";
  return "italic";
}

function mathFallbackFontWeight(tex) {
  return hasWholeMathBoldCommand(tex) ? "700" : "";
}

function hasWholeMathBoldCommand(tex) {
  const raw = String(tex || "")
    .trim()
    .replace(/^\$\$([\s\S]*)\$\$$/, "$1")
    .replace(/^\$([\s\S]*)\$$/, "$1")
    .trim();
  return /^(?:\\(?:bf|bfseries)\b|\\(?:mathbf|boldsymbol|textbf)\s*(?:\{[\s\S]*\}|\\[A-Za-z]+|[A-Za-z])\s*$)/.test(raw);
}

function normalizeKatexTex(tex) {
  return String(tex || "").replace(/\\mathcal\s*([A-Za-z])/g, String.raw`\mathcal{$1}`);
}

function renderMarker(item, unit) {
  const x = item.x * unit;
  const y = -item.y * unit;
  const angle = -item.angle;
  const fill = escapeAttribute(item.style?.fill || "black");
  return `<path d="${TIKZ_ARROW.standalonePath}" fill="${fill}" transform="translate(${format(x)} ${format(y)}) rotate(${format(angle)})" />`;
}

function pathData(commands, unit) {
  return commands
    .map((command) => {
      if (command.type === "moveTo") return `M ${format(command.x * unit)} ${format(-command.y * unit)}`;
      if (command.type === "lineTo") return `L ${format(command.x * unit)} ${format(-command.y * unit)}`;
      if (command.type === "quadTo") {
        return `Q ${format(command.x1 * unit)} ${format(-command.y1 * unit)} ${format(command.x * unit)} ${format(
          -command.y * unit
        )}`;
      }
      if (command.type === "curveTo") {
        return `C ${format(command.x1 * unit)} ${format(-command.y1 * unit)} ${format(command.x2 * unit)} ${format(
          -command.y2 * unit
        )} ${format(command.x * unit)} ${format(-command.y * unit)}`;
      }
      if (command.type === "closePath") return "Z";
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function estimateMathBox(tex, displayMode, unit, scale = 1) {
  const fontSize = (displayMode ? TIKZ_DISPLAY_MATH_FONT_SIZE : TIKZ_TEXT_FONT_SIZE) * scale;
  const box = estimateFormulaBox(tex, { displayMode, scale });
  const width = Math.max((displayMode ? 72 : 42) * scale, box.width * unit + 12 * scale);
  const height = Math.max((displayMode ? 46 : 30) * scale, formulaTotalHeight(box) * unit + 8 * scale);
  return {
    fontSize,
    width: Math.min(unit * 8, width),
    height
  };
}

function fitFontSizeToBox(baseFontSize, fitBox, unit, lines = [""]) {
  if (!fitBox) return baseFontSize;
  const boxWidth = Number(fitBox.width) * unit;
  const boxHeight = Number(fitBox.height) * unit;
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || boxWidth <= 0 || boxHeight <= 0) return baseFontSize;

  const lineCount = Math.max(1, lines.length);
  const maxLineLength = Math.max(1, ...lines.map((line) => String(line || "").trim().length));
  const heightLimit = (boxHeight * 0.78) / lineCount;
  const widthLimit = boxWidth / (maxLineLength * 0.62);
  return Math.max(6, Math.min(baseFontSize, heightLimit, widthLimit));
}

function fitRichFontSizeToBox(baseFontSize, fitBox, unit, lines = [""], lineStyles = []) {
  if (!fitBox) return baseFontSize;
  const boxWidth = Number(fitBox.width) * unit;
  const boxHeight = Number(fitBox.height) * unit;
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || boxWidth <= 0 || boxHeight <= 0) return baseFontSize;

  const weightedHeight = Math.max(
    1,
    lineStyles.reduce((sum, style) => sum + (Number(style?.scale) || 1), 0) || lines.length
  );
  const widthDemand = Math.max(
    1,
    ...lines.map((line, index) => {
      const scale = Number(lineStyles[index]?.scale) || 1;
      return String(formatTextLine(line) || "").trim().length * scale;
    })
  );
  const heightLimit = (boxHeight * 0.82) / weightedHeight;
  const widthLimit = boxWidth / (widthDemand * 0.58);
  return Math.max(6, Math.min(baseFontSize, heightLimit, widthLimit));
}

function styleAttributes(style = {}, options = {}) {
  const fill = style.pattern
    ? `url(#${patternId(style)})`
    : style.shading === "ball"
      ? `url(#${ballGradientId(style)})`
      : style.shading === "axis"
        ? `url(#${axisGradientId(style)})`
        : style.shading === "radial"
          ? `url(#${radialGradientId(style)})`
          : svgPaint(style.fill || "none");
  const attrs = [
    ["stroke", svgPaint(style.stroke || "none")],
    ["fill", fill],
    ["stroke-width", style.lineWidth ?? 1]
  ];
  if (style.dashArray) attrs.push(["stroke-dasharray", style.dashArray.join(" ")]);
  if ((style.stroke || "none") !== "none") {
    attrs.push(["stroke-linecap", options.lineCap || style.lineCap || (style.dashArray ? style.dashLineCap || "butt" : "butt")]);
    attrs.push(["stroke-linejoin", options.lineJoin || style.lineJoin || "miter"]);
  }
  if (Number.isFinite(style.opacity)) attrs.push(["opacity", style.opacity]);
  if (Number.isFinite(style.fillOpacity)) attrs.push(["fill-opacity", style.fillOpacity]);
  if (Number.isFinite(style.strokeOpacity)) attrs.push(["stroke-opacity", style.strokeOpacity]);
  if (style.fillRule) attrs.push(["fill-rule", style.fillRule]);
  if (style.filter) attrs.push(["filter", style.filter]);
  if (pathFadingName(style.pathFading)) attrs.push(["mask", `url(#${pathFadingMaskId(style.pathFading)})`]);
  if (!options.omitMarkers && style.markerStart) attrs.push(["marker-start", `url(#${arrowMarkerId(style.markerStart, style)})`]);
  if (!options.omitMarkers && style.markerEnd) attrs.push(["marker-end", `url(#${arrowMarkerId(style.markerEnd, style)})`]);
  return attrs.map(([key, value]) => ` ${key}="${escapeAttribute(String(value))}"`).join("");
}

function svgPaint(value) {
  const text = String(value ?? "").trim();
  if (text.toLowerCase() === "green") return "rgb(0 255 0)";
  return text;
}

function collectPatternDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (!item.style?.pattern) continue;
    const id = patternId(item.style);
    defs.set(id, {
      id,
      kind: String(item.style.pattern).trim(),
      color: item.style.patternColor || item.style.stroke || "black"
    });
  }
  return [...defs.values()];
}

function renderPatternDef(def) {
  const color = escapeAttribute(svgPaint(def.color || "black"));
  const path = patternPathData(def.kind);
  return `<pattern id="${escapeAttribute(def.id)}" patternUnits="userSpaceOnUse" width="8" height="8"><path d="${path}" stroke="${color}" stroke-width="0.7" fill="none" /></pattern>`;
}

function collectBallGradientDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (item.style?.shading !== "ball") continue;
    const id = ballGradientId(item.style);
    defs.set(id, {
      id,
      color: item.style.ballColor || item.style.fill || "gray"
    });
  }
  return [...defs.values()];
}

function renderBallGradientDef(def) {
  const base = svgPaint(def.color || "gray");
  const stops = [
    { offset: 0, color: mixPaint(base, "white", 0.15) },
    { offset: 36, color: mixPaint(base, "white", 0.75) },
    { offset: 72, color: mixPaint(base, "black", 0.7) },
    { offset: 100, color: mixPaint(base, "black", 0.5) }
  ];
  return `<radialGradient id="${escapeAttribute(
    def.id
  )}" cx="50%" cy="50%" r="70%" fx="30%" fy="30%">${stops
    .map((stop) => `<stop offset="${format(stop.offset)}%" stop-color="${escapeAttribute(stop.color)}" />`)
    .join("")}</radialGradient>`;
}

function collectAxisGradientDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (item.style?.shading !== "axis") continue;
    const id = axisGradientId(item.style);
    defs.set(id, {
      id,
      topColor: item.style.topColor || "white",
      bottomColor: item.style.bottomColor || item.style.fill || "black"
    });
  }
  return [...defs.values()];
}

function renderAxisGradientDef(def) {
  const top = svgPaint(def.topColor || "white");
  const bottom = svgPaint(def.bottomColor || "black");
  return `<linearGradient id="${escapeAttribute(def.id)}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="${escapeAttribute(
    top
  )}" /><stop offset="100%" stop-color="${escapeAttribute(bottom)}" /></linearGradient>`;
}

function collectRadialGradientDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    if (item.style?.shading !== "radial") continue;
    const id = radialGradientId(item.style);
    defs.set(id, {
      id,
      stops: Array.isArray(item.style.radialStops) ? item.style.radialStops : []
    });
  }
  return [...defs.values()];
}

function renderRadialGradientDef(def) {
  const stops = def.stops.length
    ? def.stops
    : [
        { offset: 0, color: "white", opacity: 1 },
        { offset: 1, color: "black", opacity: 1 }
      ];
  const stopElements = stops.map((stop) => {
    const offset = `${format(Math.max(0, Math.min(1, Number(stop.offset) || 0)) * 100)}%`;
    const color = escapeAttribute(svgPaint(stop.color || "black"));
    const opacity = Math.max(0, Math.min(1, Number(stop.opacity ?? 1)));
    return `<stop offset="${offset}" stop-color="${color}" stop-opacity="${format(opacity)}" />`;
  });
  return `<radialGradient id="${escapeAttribute(def.id)}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">${stopElements.join("")}</radialGradient>`;
}

function collectPathFadingDefs(items) {
  const defs = new Map();
  for (const item of items || []) {
    const fading = pathFadingName(item.style?.pathFading);
    if (!fading) continue;
    defs.set(fading, { name: fading });
  }
  return [...defs.values()];
}

function renderPathFadingDefs(def) {
  const gradientId = pathFadingGradientId(def.name);
  const maskId = pathFadingMaskId(def.name);
  const axis = pathFadingAxis(def.name);
  const stops = pathFadingStops(def.name)
    .map(
      (stop) =>
        `<stop offset="${stop.offset}" stop-color="${stop.color}" />`
    )
    .join("");
  const gradient = `<linearGradient id="${escapeAttribute(gradientId)}" x1="${axis.x1}" y1="${axis.y1}" x2="${axis.x2}" y2="${axis.y2}">${stops}</linearGradient>`;
  const mask = `<mask id="${escapeAttribute(maskId)}" maskContentUnits="objectBoundingBox"><rect x="0" y="0" width="1" height="1" fill="url(#${escapeAttribute(
    gradientId
  )})" /></mask>`;
  return [gradient, mask];
}

function pathFadingName(value) {
  const name = String(value || "").trim().toLowerCase();
  if (["west", "east", "north", "south"].includes(name)) return name;
  return "";
}

function pathFadingAxis(name) {
  if (name === "north" || name === "south") return { x1: "0%", y1: "0%", x2: "0%", y2: "100%" };
  return { x1: "0%", y1: "0%", x2: "100%", y2: "0%" };
}

function pathFadingStops(name) {
  if (name === "west" || name === "north") {
    return [
      { offset: "0%", color: "black" },
      { offset: "25%", color: "black" },
      { offset: "75%", color: "white" },
      { offset: "100%", color: "white" }
    ];
  }
  return [
    { offset: "0%", color: "white" },
    { offset: "25%", color: "white" },
    { offset: "75%", color: "black" },
    { offset: "100%", color: "black" }
  ];
}

function pathFadingGradientId(name) {
  return `tikz-fading-gradient-${pathFadingName(name) || "custom"}-linear`;
}

function pathFadingMaskId(name) {
  return `tikz-fading-${pathFadingName(name) || "custom"}-mask`;
}

function collectBlurShadowDefs(items, unit) {
  const defs = new Map();
  for (const item of items || []) {
    for (const shadow of item.shadows || []) {
      if (!shadow.blur) continue;
      const id = blurShadowFilterId(shadow);
      const radius = Math.max(0.8, (Number(shadow.blurRadius) || 0.06) * unit);
      defs.set(id, { id, radius });
    }
  }
  return [...defs.values()];
}

function renderBlurShadowFilterDef(def) {
  return `<filter id="${escapeAttribute(def.id)}" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="${format(
    def.radius
  )}" /></filter>`;
}

function blurShadowFilterId(shadow = {}) {
  const radius = Math.max(1, Math.round((Number(shadow.blurRadius) || 0.06) * 1000));
  return `tikzkit-blur-shadow-${radius}`;
}

function axisGradientId(style = {}) {
  const top = String(style.topColor || "white").trim();
  const bottom = String(style.bottomColor || style.fill || "black").trim();
  const key = `${top}-${bottom}`
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "axis";
  return `tikz-axis-${key}`;
}

function ballGradientId(style = {}) {
  const color = String(style.ballColor || style.fill || "gray")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "gray";
  return `tikz-ball-${color}`;
}

function radialGradientId(style = {}) {
  const name = String(style.shadingName || style.fill || "radial")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "radial";
  return `tikz-radial-${name}`;
}

function mixPaint(color, target, baseAmount) {
  const rgb = paintToRgb(color);
  const targetRgb = paintToRgb(target);
  if (rgb && targetRgb) return rgbToCss(mixRgb(rgb, targetRgb, baseAmount));
  const percent = format(Math.max(0, Math.min(1, Number(baseAmount) || 0)) * 100);
  return `color-mix(in srgb, ${svgPaint(color)} ${percent}%, ${target})`;
}

function paintToRgb(color) {
  const text = svgPaint(color).trim().toLowerCase();
  const named = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    green: [0, 255, 0],
    blue: [0, 0, 255],
    yellow: [255, 255, 0],
    orange: [255, 165, 0],
    gray: [128, 128, 128],
    grey: [128, 128, 128]
  };
  if (named[text]) return named[text];
  const rgb = text.match(/^rgb\((\d+)\s+(\d+)\s+(\d+)\)$/);
  if (rgb) return rgb.slice(1).map(Number);
  const hex = text.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return [hex[1].slice(0, 2), hex[1].slice(2, 4), hex[1].slice(4, 6)].map((part) => Number.parseInt(part, 16));
  }
  return null;
}

function mixRgb(base, target, amount) {
  const clamped = Math.max(0, Math.min(1, amount));
  return base.map((channel, index) => Math.round(channel * clamped + target[index] * (1 - clamped)));
}

function rgbToCss(rgb) {
  return `rgb(${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))).join(" ")})`;
}

function patternPathData(kind) {
  const normalized = String(kind || "").toLowerCase().replace(/-/g, " ").trim();
  if (normalized === "north west lines") return "M 0 -4 L 12 8 M -4 0 L 8 12";
  return "M -4 8 L 8 -4 M 0 12 L 12 0";
}

function patternId(style = {}) {
  const kind = String(style.pattern || "lines").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lines";
  const color = String(style.patternColor || style.stroke || "black").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "black";
  return `tikz-pattern-${kind}-${color}`;
}

function collectArrowMarkerDefs(items) {
  const defs = new Map();
  for (const item of items) {
    for (const key of ["markerStart", "markerEnd"]) {
      if (!item.style?.[key]) continue;
      const marker = resolvedArrowMarker(item.style[key], item.style);
      defs.set(marker.id, marker);
    }
  }
  return [...defs.values()];
}

function renderArrowMarkerDef(marker) {
  const halfWidth = marker.width / 2;
  const path =
    marker.kind === "stealth"
      ? `M 0 0 L ${format(marker.length)} ${format(halfWidth)} L 0 ${format(marker.width)} C ${format(
          marker.length * 0.22
        )} ${format(marker.width * 0.62)} ${format(marker.length * 0.22)} ${format(marker.width * 0.38)} 0 0 Z`
      : marker.kind === "two-heads"
        ? `M 0 0 L ${format(marker.length * 0.48)} ${format(halfWidth)} L 0 ${format(marker.width)} M ${format(
            marker.length * 0.44
          )} 0 L ${format(marker.length)} ${format(halfWidth)} L ${format(marker.length * 0.44)} ${format(marker.width)}`
      : marker.kind === "hook"
        ? `M ${format(marker.length)} ${format(halfWidth)} C ${format(marker.length * 0.45)} ${format(
            halfWidth
          )} ${format(marker.length * 0.55)} ${format(marker.width)} ${format(marker.length * 0.12)} ${format(
            marker.width
          )} C ${format(-marker.length * 0.18)} ${format(marker.width)} ${format(-marker.length * 0.18)} 0 ${format(
            marker.length * 0.12
          )} 0`
      : marker.kind === "latex"
        ? `M ${format(marker.length)} ${format(halfWidth)} C ${format(marker.length * 0.62)} ${format(
            marker.width * 0.56
          )} ${format(marker.length * 0.18)} ${format(marker.width * 0.82)} 0 ${format(marker.width)} C ${format(
            marker.length * 0.3
          )} ${format(marker.width * 0.57)} ${format(marker.length * 0.3)} ${format(marker.width * 0.43)} 0 0 C ${format(
            marker.length * 0.18
          )} ${format(marker.width * 0.18)} ${format(marker.length * 0.62)} ${format(
            marker.width * 0.44
          )} ${format(marker.length)} ${format(halfWidth)} Z`
      : `M 0 0 L ${format(marker.length)} ${format(halfWidth)} L 0 ${format(marker.width)}`;
  const openTip = marker.kind === "to" || marker.kind === "hook" || marker.kind === "two-heads";
  const fill = openTip ? "none" : marker.fill;
  const strokeWidth =
    openTip ? Math.max(1, marker.lineWidth * 0.85) : Math.max(0.8, marker.lineWidth * 0.45);
  return `<marker id="${escapeAttribute(marker.id)}" markerWidth="${format(marker.length)}" markerHeight="${format(
    marker.width
  )}" refX="${format(marker.length)}" refY="${format(halfWidth)}" orient="auto-start-reverse" markerUnits="userSpaceOnUse" viewBox="0 0 ${format(
    marker.length
  )} ${format(marker.width)}"><path d="${path}" stroke="${escapeAttribute(marker.stroke)}" fill="${escapeAttribute(
    fill
  )}" stroke-width="${format(strokeWidth)}" stroke-linejoin="round" stroke-linecap="round"/></marker>`;
}

function arrowMarkerId(tip, style = {}) {
  return resolvedArrowMarker(tip, style).id;
}

function resolvedArrowMarker(tip, style = {}) {
  const raw = typeof tip === "string" ? createArrowTip(tip === "arrow" ? "to" : tip) : createArrowTip(tip?.kind, tip || {});
  const stroke = raw.stroke || (style.stroke === "none" ? "black" : style.stroke) || "black";
  const fill = raw.fill && raw.fill !== "context-stroke" ? raw.fill : stroke;
  const marker = {
    kind: raw.kind,
    length: raw.length,
    width: raw.width,
    lineWidth: style.lineWidth ?? 1,
    stroke,
    fill
  };
  marker.id = [
    "arrow",
    marker.kind,
    format(marker.length),
    format(marker.width),
    markerColorId(marker.stroke),
    markerColorId(marker.fill)
  ].join("-");
  return marker;
}

function markerColorId(value) {
  return String(value || "none")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function computeBounds(items, options = {}) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  for (const item of items) {
    if (item.type === "nodeBox") {
      include(item.x - item.width / 2, item.y - item.height / 2);
      include(item.x + item.width / 2, item.y + item.height / 2);
      for (const shadow of item.shadows || []) {
        const scale = Number(shadow.scale) > 0 ? Number(shadow.scale) : 1;
        const blurPad = shadow.blur ? (Number(shadow.blurRadius) || 0.06) * 3 : 0;
        const sx = item.x + (Number(shadow.xshift) || 0);
        const sy = item.y + (Number(shadow.yshift) || 0);
        const sw = item.width * scale;
        const sh = item.height * scale;
        include(sx - sw / 2 - blurPad, sy - sh / 2 - blurPad);
        include(sx + sw / 2 + blurPad, sy + sh / 2 + blurPad);
      }
    } else if (item.type === "path" && hasPathCommands(item)) {
      includePathBounds(item, include);
    } else if (item.shape === "circle") {
      include(item.cx - item.r, item.cy - item.r);
      include(item.cx + item.r, item.cy + item.r);
    } else if (item.shape === "ellipse") {
      include(item.cx - item.rx, item.cy - item.ry);
      include(item.cx + item.rx, item.cy + item.ry);
    } else if (item.type === "textNode") {
      const normalized = normalizeTikzText(item.text);
      if (normalized.invisible) continue;
      if (normalized.kind === "image") {
        const scale = imagePlaceholderScale(item, normalized);
        include(item.x - (normalized.width * scale) / 2, item.y - (normalized.height * scale) / 2);
        include(item.x + (normalized.width * scale) / 2, item.y + (normalized.height * scale) / 2);
        continue;
      }
      const math = parseMathText(normalized.text);
      if (math) {
        const scale = (normalized.scale || 1) * (math.scale || 1) * textFontScale(item, normalized) * mathStyleScale(math.tex);
        const box = estimateMathBox(math.tex, math.displayMode, TIKZ_UNIT, scale);
        box.fontSize = fitFontSizeToBox(box.fontSize, item.fitBox, TIKZ_UNIT, [mathFallbackText(math.tex)]);
        const htmlBox = scopedMathForeignObjectBox(box, math.displayMode);
        const svgTextFallback = options.mathRenderer === "svg-text";
        const width = (svgTextFallback ? box.width : htmlBox.width) / TIKZ_UNIT;
        const height = (svgTextFallback ? box.height : htmlBox.height) / TIKZ_UNIT;
        include(item.x - width / 2, item.y - height / 2);
        include(item.x + width / 2, item.y + height / 2);
      } else {
        const { width, height } = estimatePlainTextRenderBounds(item, normalized, TIKZ_UNIT);
        include(item.x - width / 2, item.y - height / 2);
        include(item.x + width / 2, item.y + height / 2);
      }
    } else if (item.type === "marker") {
      include(item.x, item.y);
    }
  }

  if (!Number.isFinite(bounds.minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  if (bounds.minX === bounds.maxX) bounds.maxX += 1;
  if (bounds.minY === bounds.maxY) bounds.maxY += 1;
  return bounds;
}

function estimatePlainTextRenderBounds(item, normalized, unit) {
  const rawFontFamily = item.style?.fontFamily || normalized.fontFamily || TIKZ_FONT_FAMILY;
  const baseFontSize = TIKZ_TEXT_FONT_SIZE * (normalized.scale || 1) * textFontScale(item, normalized);
  const sourceLines = normalized.lines.length ? normalized.lines : [normalized.text];
  const formattedLines = sourceLines.map(formatTextLine);
  const sourceLineStyles = textLineStyles(normalized, sourceLines.length);
  const wrapped = wrapStyledSvgTextLines(sourceLines, formattedLines, sourceLineStyles, item.wrapWidth, unit, baseFontSize);
  const fontSize = fitFontSizeToBox(baseFontSize, item.fitBox, unit, wrapped.lines);
  const wrapWidth = Number(item.wrapWidth);
  const typewriter = typewriterWidthScale(rawFontFamily) !== 1;
  const width = Number.isFinite(wrapWidth) && wrapWidth > 0
    ? wrapWidth
    : Math.max(...wrapped.lines.map((line) => line.length), 0) * (typewriter ? 0.187 : 0.15) * (fontSize / TIKZ_TEXT_FONT_SIZE);
  const offsets = baselineOffsets(fontSize, wrapped.lineStyles);
  const lineSizes = wrapped.lineStyles.map((style) => fontSize * (Number(style?.scale) || 1));
  const maxLineSize = Math.max(fontSize, ...lineSizes);
  const heightPx = offsets.length
    ? Math.max(...offsets) - Math.min(...offsets) + maxLineSize * 1.15
    : maxLineSize * 1.15;
  return {
    width: Math.max(0.08, width),
    height: Math.max(0.08, heightPx / unit)
  };
}

function hasPathCommands(item) {
  return Array.isArray(item.commands) && item.commands.length > 0;
}

function includePathBounds(item, include) {
  let current = null;
  let start = null;
  for (const command of item.commands || []) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = current;
      include(command.x, command.y);
      continue;
    }
    if (command.type === "lineTo") {
      current = { x: command.x, y: command.y };
      include(command.x, command.y);
      continue;
    }
    if (command.type === "curveTo") {
      if (current && item.tightBezierBounds) {
        includeCubicBezierBounds(current, command, include);
      } else {
        if ("x1" in command && "y1" in command) include(command.x1, command.y1);
        if ("x2" in command && "y2" in command) include(command.x2, command.y2);
        if ("x" in command && "y" in command) include(command.x, command.y);
      }
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "quadTo") {
      if ("x1" in command && "y1" in command) include(command.x1, command.y1);
      if ("x" in command && "y" in command) include(command.x, command.y);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && start) {
      include(start.x, start.y);
      current = start;
      continue;
    }
    if ("x" in command && "y" in command) {
      include(command.x, command.y);
      current = { x: command.x, y: command.y };
    }
  }
}

function includeCubicBezierBounds(from, curve, include) {
  const p0 = from;
  const p1 = { x: curve.x1, y: curve.y1 };
  const p2 = { x: curve.x2, y: curve.y2 };
  const p3 = { x: curve.x, y: curve.y };
  include(p0.x, p0.y);
  include(p3.x, p3.y);
  for (const t of cubicExtremaParameters(p0.x, p1.x, p2.x, p3.x)) {
    const point = cubicBezierPoint(p0, p1, p2, p3, t);
    include(point.x, point.y);
  }
  for (const t of cubicExtremaParameters(p0.y, p1.y, p2.y, p3.y)) {
    const point = cubicBezierPoint(p0, p1, p2, p3, t);
    include(point.x, point.y);
  }
}

function cubicExtremaParameters(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) >= 1e-12) roots.push(-c / b);
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= -1e-12) {
      const sqrt = Math.sqrt(Math.max(0, discriminant));
      roots.push((-b - sqrt) / (2 * a), (-b + sqrt) / (2 * a));
    }
  }
  return roots.filter((t) => t > 1e-9 && t < 1 - 1e-9);
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: p0.x * a + p1.x * b + p2.x * c + p3.x * d,
    y: p0.y * a + p1.y * b + p2.y * c + p3.y * d
  };
}

function format(value) {
  const rounded = Math.round((value + Number.EPSILON) * 1e6) / 1e6;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}
