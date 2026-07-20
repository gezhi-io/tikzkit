import {
  createFontSpec,
  fontSpecFromSizeCommand,
  mergeFontSpec,
  parseTikzFontPatch
} from "./fontSpec.js";

const PGFPLOTS_DEFAULT_ROLES = Object.freeze({
  tick: "normalsize",
  axisLabel: "normalsize",
  legend: "normalsize",
  title: "normalsize",
  colorbarTick: "normalsize"
});

const DATAVISUALIZATION_DEFAULT_ROLES = Object.freeze({
  tick: "footnotesize",
  axisLabel: "small",
  dataSetLabel: "small",
  pinLabel: "normalsize",
  insideLegend: "footnotesize",
  outsideLegend: "small"
});

// Circuitikz labels and annotations inherit the surrounding TikZ font. Only
// internal symbols with explicit absolute sizes belong in this policy.
const CIRCUITIKZ_DEFAULT_ROLES = Object.freeze({
  tinySymbol: Object.freeze({ sizePt: 5, baselineSkipPt: 6 }),
  sixPointSymbol: Object.freeze({ sizePt: 6, baselineSkipPt: 7 }),
  normalSymbol: Object.freeze({ sizePt: 10, baselineSkipPt: 12 }),
  largeSymbol: Object.freeze({ sizePt: 12, baselineSkipPt: 14 })
});

const FONT_POLICIES = Object.freeze({
  pgfplots: Object.freeze({
    default: PGFPLOTS_DEFAULT_ROLES,
    normalsize: PGFPLOTS_DEFAULT_ROLES,
    small: Object.freeze({
      ...PGFPLOTS_DEFAULT_ROLES,
      tick: "footnotesize",
      axisLabel: "small",
      colorbarTick: "footnotesize"
    }),
    footnotesize: Object.freeze({
      ...PGFPLOTS_DEFAULT_ROLES,
      tick: "footnotesize",
      axisLabel: "small",
      legend: "footnotesize",
      title: "small",
      colorbarTick: "footnotesize"
    }),
    tiny: Object.freeze({
      ...PGFPLOTS_DEFAULT_ROLES,
      tick: "tiny",
      axisLabel: "tiny",
      legend: "tiny",
      title: "footnotesize",
      colorbarTick: "tiny"
    })
  }),
  datavisualization: Object.freeze({
    default: DATAVISUALIZATION_DEFAULT_ROLES
  }),
  circuitikz: Object.freeze({
    default: CIRCUITIKZ_DEFAULT_ROLES
  })
});

const CANONICAL_SIZE_COMMANDS = Object.freeze([
  [5, "tiny"],
  [7, "scriptsize"],
  [8, "footnotesize"],
  [9, "small"],
  [10, "normalsize"],
  [12, "large"],
  [14.4, "Large"],
  [17.28, "LARGE"],
  [20.74, "huge"],
  [24.88, "Huge"]
]);

const PGFPLOTS_PROFILES = new Set(["normalsize", "small", "footnotesize", "tiny"]);

export function resolveLibraryFont(library, role, options = {}) {
  const inherited = createFontSpec(options.inherited || {});
  const libraryPolicies = FONT_POLICIES[library];
  const profileName = String(options.profile || "default");
  const profile = libraryPolicies?.[profileName] || libraryPolicies?.default;
  const policy = profile?.[role] ?? libraryPolicies?.default?.[role];
  const rolePatch = libraryRolePatch(policy, options.documentProfile);
  const explicitPatch = explicitFontPatch(options.explicit, options.explicitSource || "node-option");
  const withRole = rolePatch ? mergeFontSpec(inherited, rolePatch) : inherited;
  return Object.keys(explicitPatch).length ? mergeFontSpec(withRole, explicitPatch) : withRole;
}

export function fontSpecToTikzSizeCommand(font) {
  const resolved = createFontSpec(font || {});
  const exact = CANONICAL_SIZE_COMMANDS.find(([size]) => Math.abs(size - resolved.sizePt) < 1e-6);
  if (exact) return `\\${exact[1]}`;
  return `\\fontsize{${formatFontNumber(resolved.sizePt)}}{${formatFontNumber(resolved.baselineSkipPt)}}\\selectfont`;
}

export function libraryFontProfile(library, options = {}) {
  if (library !== "pgfplots") return "default";
  let profile = "default";
  for (const [key, value] of Object.entries(options || {})) {
    if (PGFPLOTS_PROFILES.has(key) && optionEnabled(value)) profile = key;
  }
  return profile;
}

export function libraryRoleFontCommand(library, role, options = {}) {
  const explicit = normalizeExplicitFont(options.explicit);
  const resolved = resolveLibraryFont(library, role, { ...options, explicit });
  const scale = positiveFontScale(options.scale);
  if (Math.abs(scale - 1) > 1e-9) {
    const scaled = mergeFontSpec(resolved, {
      sizePt: resolved.sizePt * scale,
      baselineSkipPt: resolved.baselineSkipPt * scale,
      source: resolved.source
    });
    return `${fontSpecToTikzSizeCommand(scaled)}${stripFontSizeCommands(explicit)}`;
  }
  if (!explicit) return fontSpecToTikzSizeCommand(resolved);
  const patch = parseTikzFontPatch(explicit, { source: options.explicitSource || "node-option" });
  return Object.hasOwn(patch, "sizePt")
    ? explicit
    : `${fontSpecToTikzSizeCommand(resolved)}${explicit}`;
}

function libraryRolePatch(policy, documentProfile = "10pt") {
  if (typeof policy === "string") {
    const font = fontSpecFromSizeCommand(`\\${policy}`, {
      profile: documentProfile,
      source: "library-role"
    });
    return font
      ? { sizePt: font.sizePt, baselineSkipPt: font.baselineSkipPt, source: "library-role" }
      : null;
  }
  if (!policy || typeof policy !== "object") return null;
  return { ...policy, source: policy.source || "library-role" };
}

function explicitFontPatch(explicit, source) {
  if (!explicit) return {};
  if (typeof explicit === "object") return { ...explicit, source: explicit.source || source };
  return parseTikzFontPatch(normalizeExplicitFont(explicit), { source });
}

function normalizeExplicitFont(value) {
  return String(value || "").trim().replace(/^font\s*=\s*/, "").trim();
}

function positiveFontScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function stripFontSizeCommands(value) {
  return String(value || "")
    .replace(/\\(?:Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g, "")
    .replace(/\\fontsize\s*\{[^{}]+\}\s*\{[^{}]+\}\s*\\selectfont\b/g, "")
    .trim();
}

function optionEnabled(value) {
  if (value === false || value === null || value === undefined) return false;
  const text = String(value).trim().toLowerCase();
  return text !== "false" && text !== "0" && text !== "none";
}

function formatFontNumber(value) {
  return Number(Number(value).toFixed(6)).toString();
}
