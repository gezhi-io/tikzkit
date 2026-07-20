import { TIKZ_FONT_FAMILY } from "../../tikz/metrics.js";
import { escapeAttribute, escapeText } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";

export function renderBpmnIcon(item, unit) {
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

export function renderBpmnMarker(item, unit) {
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
