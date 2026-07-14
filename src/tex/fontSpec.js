import { documentFontProfile } from "./fontProfiles.js";

const DEFAULT_FONT_SPEC = Object.freeze({
  sizePt: 10,
  baselineSkipPt: 12,
  family: "serif",
  weight: 400,
  style: "normal",
  variant: "normal",
  mathStyle: "text",
  source: "document"
});

export function createFontSpec(patch = {}) {
  return validateFontSpec({ ...DEFAULT_FONT_SPEC, ...definedProperties(patch) });
}

export function mergeFontSpec(base = DEFAULT_FONT_SPEC, patch = {}) {
  return validateFontSpec({ ...createFontSpec(base), ...definedProperties(patch) });
}

export function fontSpecFromSizeCommand(command, options = {}) {
  const name = String(command || "").trim().replace(/^\\/, "");
  const size = documentFontProfile(options.profile || "10pt")[name];
  if (!size) return null;
  return createFontSpec({ ...size, source: options.source || "content-command" });
}

export function fontSpecFromLegacyScale(scale, base = DEFAULT_FONT_SPEC) {
  const value = Number(scale);
  const multiplier = Number.isFinite(value) && value > 0 ? value : 1;
  return mergeFontSpec(base, {
    sizePt: base.sizePt * multiplier,
    baselineSkipPt: base.baselineSkipPt * multiplier,
    source: "legacy-scale"
  });
}

function definedProperties(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, item]) => item !== undefined && item !== null)
  );
}

function validateFontSpec(spec) {
  const sizePt = Number(spec.sizePt);
  const baselineSkipPt = Number(spec.baselineSkipPt);
  if (
    !Number.isFinite(sizePt) ||
    sizePt <= 0 ||
    !Number.isFinite(baselineSkipPt) ||
    baselineSkipPt <= 0
  ) {
    throw new RangeError("FontSpec sizes must be finite positive TeX points");
  }
  return { ...spec, sizePt, baselineSkipPt };
}
