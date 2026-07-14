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
  const profile = documentFontProfile(options.profile || "10pt");
  if (!Object.hasOwn(profile, name)) return null;
  const size = profile[name];
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
  const { sizePt, baselineSkipPt } = spec;
  if (!isFinitePositiveNumber(sizePt) || !isFinitePositiveNumber(baselineSkipPt)) {
    throw new RangeError("FontSpec sizes must be finite positive TeX points");
  }
  return { ...spec };
}

function isFinitePositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
