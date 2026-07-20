import { TIKZ_TEXT_FONT_SIZE, TIKZ_UNIT } from "../../tikz/metrics.js";

export function renderUnitScale(unit) {
  const value = Number(unit);
  return Number.isFinite(value) && value > 0 ? value / TIKZ_UNIT : 1;
}

export function textFontSizeForUnit(unit) {
  return TIKZ_TEXT_FONT_SIZE * renderUnitScale(unit);
}

export function scaleItemsForRenderUnit(items, unit) {
  const scale = renderUnitScale(unit);
  if (Math.abs(scale - 1) < 1e-12) return items;
  return items.map((item) => scaleItemForRenderUnit(item, scale));
}

export function scaleItemForRenderUnit(item, scale) {
  if (!item || typeof item !== "object") return item;
  const next = { ...item };
  if (item.style) next.style = scaleStyleForRenderUnit(item.style, scale);
  return next;
}

export function scaleStyleForRenderUnit(style, scale) {
  const next = { ...style };
  next.lineWidth = scaleNumeric(style.lineWidth, scale);
  next.doubleDistance = scaleNumeric(style.doubleDistance, scale);
  if (Array.isArray(style.dashArray)) {
    next.dashArray = style.dashArray.map((value) => scaleNumeric(value, scale));
  }
  return next;
}

export function scaleNumeric(value, scale) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric * scale : value;
}
