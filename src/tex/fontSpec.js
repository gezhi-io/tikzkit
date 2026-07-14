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

export function parseTikzFontPatch(source, options = {}) {
  const text = String(source || "");
  const patch = {};

  const sizeCommands = text.matchAll(
    /\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b|\\fontsize\s*\{([^{}]+)\}\s*\{([^{}]+)\}\s*\\selectfont\b/g
  );
  for (const match of sizeCommands) {
    if (match[1]) {
      const profile = documentFontProfile(options.profile || "10pt");
      Object.assign(patch, profile[match[1]]);
      continue;
    }
    const sizePt = Number(match[2]);
    const baselineSkipPt = Number(match[3]);
    if (!isFinitePositiveNumber(sizePt) || !isFinitePositiveNumber(baselineSkipPt)) continue;
    patch.sizePt = sizePt;
    patch.baselineSkipPt = baselineSkipPt;
  }

  const family = lastFontCommand(text, /\\(rmfamily|sffamily|ttfamily|normalfont|rm|sf|tt)\b/g);
  if (family) {
    patch.family = family === "sffamily" || family === "sf"
      ? "sans-serif"
      : family === "ttfamily" || family === "tt"
        ? "monospace"
        : "serif";
  }

  const weight = lastFontCommand(text, /\\(mdseries|bfseries|bf)\b/g);
  if (weight) patch.weight = weight === "mdseries" ? 400 : 700;

  const style = lastFontCommand(text, /\\(upshape|itshape|slshape)\b/g);
  if (style) patch.style = style === "upshape" ? "normal" : "italic";

  if (/\\scshape\b/.test(text)) patch.variant = "small-caps";

  if (Object.keys(patch).length) patch.source = options.source || "node-option";
  return patch;
}

export function resolveFontSpec(layers = {}) {
  return ["document", "scope", "libraryRole", "nodeOption", "contentCommand"]
    .reduce((font, key) => layers[key] ? mergeFontSpec(font, layers[key]) : font, createFontSpec());
}

function definedProperties(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, item]) => item !== undefined && item !== null)
  );
}

function lastFontCommand(text, pattern) {
  const matches = [...text.matchAll(pattern)];
  return matches.at(-1)?.[1] || null;
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
