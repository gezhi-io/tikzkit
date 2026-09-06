import { createArrowTip, latexSlimArrowGeometryFromLineWidth, TIKZ_ARROW } from "../../tikz/metrics.js";
import { escapeAttribute } from "./escape.js";
import { formatSvgNumber as format } from "./format.js";
import { svgDefinitionId } from "./definitionScope.js";

export function renderMarker(item, unit) {
  const x = item.x * unit;
  const y = -item.y * unit;
  const angle = -item.angle;
  const fill = escapeAttribute(item.style?.fill || "black");
  return `<path d="${TIKZ_ARROW.standalonePath}" fill="${fill}" transform="translate(${format(x)} ${format(y)}) rotate(${format(angle)})" />`;
}

export function collectArrowMarkerDefs(items) {
  const defs = new Map();
  for (const item of items) {
    for (const key of ["markerStart", "markerEnd"]) {
      if (!item.style?.[key]) continue;
      if (item.style[key]?.kind === "sequence") continue;
      const marker = resolvedArrowMarker(item.style[key], item.style);
      defs.set(marker.id, marker);
    }
  }
  return [...defs.values()];
}

export function renderArrowMarkerDef(marker) {
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
      : marker.kind === "latexslim"
        ? (() => {
            const d = marker.unit;
            return `M ${format(marker.length)} ${format(halfWidth)} C ${format(marker.length - 2.5 * d)} ${format(halfWidth - 0.5 * d)} ${format(marker.length - 7 * d)} ${format(halfWidth - 1.5 * d)} 0 0 C ${format(marker.length - 7.5 * d)} ${format(halfWidth - d)} ${format(marker.length - 7.5 * d)} ${format(halfWidth + d)} 0 ${format(marker.width)} C ${format(marker.length - 7 * d)} ${format(halfWidth + 1.5 * d)} ${format(marker.length - 2.5 * d)} ${format(halfWidth + 0.5 * d)} ${format(marker.length)} ${format(halfWidth)} Z`;
          })()
      : `M 0 0 L ${format(marker.length)} ${format(halfWidth)} L 0 ${format(marker.width)}`;
  const openTip = marker.kind === "to" || marker.kind === "hook" || marker.kind === "two-heads";
  const filledSlimTip = marker.kind === "latexslim";
  const fill = openTip ? "none" : marker.fill;
  const stroke = filledSlimTip ? "none" : marker.stroke;
  const strokeWidth = filledSlimTip ? 0 : openTip ? Math.max(1, marker.lineWidth * 0.85) : Math.max(0.8, marker.lineWidth * 0.45);
  return `<marker id="${escapeAttribute(marker.id)}" markerWidth="${format(marker.length)}" markerHeight="${format(
    marker.width
  )}" refX="${format(marker.length)}" refY="${format(halfWidth)}" orient="auto-start-reverse" markerUnits="userSpaceOnUse" viewBox="0 0 ${format(
    marker.length
  )} ${format(marker.width)}"><path d="${path}" stroke="${escapeAttribute(stroke)}" fill="${escapeAttribute(
    fill
  )}" stroke-width="${format(strokeWidth)}" stroke-linejoin="round" stroke-linecap="round"/></marker>`;
}

export function arrowMarkerId(tip, style = {}) {
  return resolvedArrowMarker(tip, style).id;
}

export function resolvedArrowMarker(tip, style = {}) {
  const raw = typeof tip === "string" ? createArrowTip(tip === "arrow" ? "to" : tip) : createArrowTip(tip?.kind, tip || {});
  const stroke = raw.stroke || (style.stroke === "none" ? "black" : style.stroke) || "black";
  const fill = raw.fill && raw.fill !== "context-stroke" ? raw.fill : stroke;
  const slim = raw.kind === "latexslim" ? latexSlimArrowGeometryFromLineWidth(style.lineWidth ?? 1) : null;
  const marker = {
    kind: raw.kind,
    length: slim?.back ?? raw.length,
    width: slim ? slim.halfWidth * 2 : raw.width,
    unit: slim?.unit,
    lineWidth: style.lineWidth ?? 1,
    stroke,
    fill
  };
  marker.id = svgDefinitionId([
    "arrow",
    marker.kind,
    format(marker.length),
    format(marker.width),
    markerColorId(marker.stroke),
    markerColorId(marker.fill)
  ].join("-"), style);
  return marker;
}

function markerColorId(value) {
  return String(value || "none")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
