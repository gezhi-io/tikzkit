import {
  TIKZ_FONT_FAMILY,
  TIKZ_HELVETICA_FONT_FAMILY,
  TIKZ_MONOSPACE_FONT_FAMILY,
  TIKZ_SANS_SERIF_FONT_FAMILY,
  TIKZ_SMALL_CAPS_FONT_FAMILY
} from "../../tikz/metrics.js";

export function resolvedFontStyle(item = {}) {
  const font = item.font || {};
  return {
    ...(item.style || {}),
    fontFamily: item.style?.fontFamily || font.family || null,
    fontWeight: item.style?.fontWeight || (font.weight && Number(font.weight) !== 400 ? font.weight : null),
    fontStyle: item.style?.fontStyle || (font.style && font.style !== "normal" ? font.style : null),
    fontVariant: item.style?.fontVariant || (font.variant && font.variant !== "normal" ? font.variant : null)
  };
}

export function resolvedFontFamily(item = {}, normalized = {}) {
  const family = item.font?.family || item.style?.fontFamily || normalized.fontFamily;
  return renderFontFamily(family);
}

export function renderFontFamily(family) {
  if (family === "helvetica") return TIKZ_HELVETICA_FONT_FAMILY;
  if (family === "sans-serif") return TIKZ_SANS_SERIF_FONT_FAMILY;
  if (family === "monospace") return TIKZ_MONOSPACE_FONT_FAMILY;
  if (!family || family === "serif") return TIKZ_FONT_FAMILY;
  return family;
}

export function renderFontFamilyForStyle(family, style = {}) {
  const rendered = renderFontFamily(family);
  if (usesDedicatedSmallCapsFace(rendered, style)) return TIKZ_SMALL_CAPS_FONT_FAMILY;
  if (Number(style.fontWeight ?? style.weight) !== 700) return rendered;
  return rendered.replace(/TikZKitCMR(5|6|7|8|9|10|12|17)\b/g, (_match, size) => {
    const boldSize = size === "17" ? "12" : size;
    return `TikZKitCMBX${boldSize}`;
  });
}

export function usesDedicatedSmallCapsFace(family, style = {}) {
  const variant = style.fontVariant ?? style.variant;
  const weight = style.fontWeight ?? style.weight;
  if (variant !== "small-caps" || Number(weight) === 700) return false;
  return /(?:TikZKitCMR|TikZKitCMUSerif|CMU Serif)/.test(renderFontFamily(family));
}
