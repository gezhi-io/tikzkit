import { TIKZ_TEXT_FONT_SIZE, TIKZ_UNIT } from "../../tikz/metrics.js";
import { normalizeTikzText } from "../../tikz/text.js";
import { parseMathText } from "../../tikz/textMetrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";

export const TIKZQUADS_NODE_SHAPES = ["tikzquadsQuad", "tikzquadsBlackBox", "tikzquadsPgLoadLine"];

export function isTikzquadsNodeShape(shape) {
  return TIKZQUADS_NODE_SHAPES.includes(shape);
}

export function renderTikzquadsNodeBox(item, unit, options = {}, textRenderer = {}) {
  if (item.shape === "tikzquadsPgLoadLine") return renderTikzquadsPgLoadLine(item, unit, options, textRenderer);
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
  group.push(renderTikzquadsLabels(item, { cx, cy, hw, hh, left, right, portY, stroke }, unit, options, textRenderer));
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

function renderTikzquadsLabels(item, box, unit, options = {}, textRenderer = {}) {
  const labels = tikzquadsLabelPositions(item, box);
  return labels
    .filter((label) => label.text !== undefined && label.text !== null && label.text !== "")
    .map((label) => renderTikzquadsText(label.text, label.x, label.y, label.anchor || "middle", label.size || TIKZ_TEXT_FONT_SIZE, box.stroke, unit, options, textRenderer))
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

function renderTikzquadsPgLoadLine(item, unit, options = {}, textRenderer = {}) {
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
    renderTikzquadsText(o["x axis"] ?? "$V$", right + 9, bottom + 2, "start", TIKZ_TEXT_FONT_SIZE, stroke, unit, options, textRenderer),
    renderTikzquadsText(o["y axis"] ?? "$I$", left - 3, top - 7, "end", TIKZ_TEXT_FONT_SIZE, stroke, unit, options, textRenderer),
    renderTikzquadsText(o["x val"] ?? "$V_{th}$", right - 5, bottom - 8, "end", TIKZ_TEXT_FONT_SIZE, stroke, unit, options, textRenderer),
    renderTikzquadsText(o["y val"] ?? "$I_N$", left + 5, top + 9, "start", TIKZ_TEXT_FONT_SIZE, stroke, unit, options, textRenderer),
    "</g>"
  ].join("");
}

function renderTikzquadsText(text, x, y, anchor, size = TIKZ_TEXT_FONT_SIZE, fill, unit = TIKZ_UNIT, options = {}, textRenderer = {}) {
  const normalized = normalizeTikzText(text);
  const scale = size / TIKZ_TEXT_FONT_SIZE;
  const math = parseMathText(normalized.text);
  const color = fill || normalized.color || "black";
  if (math) {
    const mathScale = (normalized.scale || 1) * (math.scale || 1) * scale;
    const normalizedTex = textRenderer.normalizeKatexTex ? textRenderer.normalizeKatexTex(math.tex) : math.tex;
    const box = textRenderer.estimateMathBox
      ? textRenderer.estimateMathBox(normalizedTex, math.displayMode, unit, mathScale)
      : { width: estimateTikzquadsTextWidth([math.tex], size) };
    const centeredX = textCenterForAnchor(x, anchor, box.width);
    if (textRenderer.renderMathNode) {
      return textRenderer.renderMathNode(
        { x: centeredX / unit, y: -y / unit, style: { fill: color, fontScale: scale } },
        { ...math, scale: (normalized.scale || 1) * (math.scale || 1), color: normalized.color || color, explicitFontSize: normalized.explicitFontSize || math.explicitFontSize },
        unit,
        options
      );
    }
    return fallbackTikzquadsText(math.tex, centeredX, y, color, size);
  }
  const lines = normalized.lines.length ? normalized.lines : [normalized.text];
  const width = estimateTikzquadsTextWidth(lines, size * (normalized.scale || 1), textRenderer.formatTextLine);
  const centeredX = textCenterForAnchor(x, anchor, width);
  if (textRenderer.renderPlainTextNode) {
    return textRenderer.renderPlainTextNode(
      {
        x: centeredX / unit,
        y: -y / unit,
        style: { fill: color, fontScale: scale }
      },
      normalized,
      unit
    );
  }
  return fallbackTikzquadsText(lines.join(" "), centeredX, y, color, size);
}

function textCenterForAnchor(x, anchor, width) {
  if (anchor === "end") return x - width / 2;
  if (anchor === "start") return x + width / 2;
  return x;
}

function estimateTikzquadsTextWidth(lines, fontSize, formatTextLine = String) {
  const longest = Math.max(0, ...lines.map((line) => formatTextLine(line).length));
  return Math.max(fontSize, longest * fontSize * 0.52);
}

function fallbackTikzquadsText(text, x, y, fill, size) {
  return `<text x="${format(x)}" y="${format(y)}" fill="${escapeAttribute(fill)}" text-anchor="middle" dominant-baseline="middle" font-size="${format(size)}">${escapeText(text)}</text>`;
}
