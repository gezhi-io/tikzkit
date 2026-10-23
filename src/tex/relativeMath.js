import { LATEX_10PT_FONT_PROFILE } from "./fontProfiles.js";

const classes = { "tikzkit-mathlarger": "larger", "tikzkit-mathsmaller": "smaller" };

// Per-parse macros provide named AST wrappers without registering global KaTeX
// commands. Only inert classes and numeric box-scale data are trusted.
export const relativeMathParseOptions = {
  macros: {
    "\\mathlarger": "\\htmlClass{tikzkit-mathlarger}{#1}",
    "\\mathsmaller": "\\htmlClass{tikzkit-mathsmaller}{#1}",
    "\\tikzkitmathscale": "\\htmlData{tikzkit-scale=#1,tikzkit-size=#2}{#3}"
  },
  trust: context => context.command === "\\htmlClass" && Object.hasOwn(classes, context.class)
    || context.command === "\\htmlData" && scaledMathAttributes(context.attributes) !== null
};

export function scaledMathAttributes(attributes = {}) {
  if (Object.keys(attributes).length !== 2 || !Object.hasOwn(attributes, "data-tikzkit-scale")
      || !Object.hasOwn(attributes, "data-tikzkit-size")) return null;
  const scale = Number(attributes["data-tikzkit-scale"]);
  const size = Number(attributes["data-tikzkit-size"]);
  return Number.isFinite(scale) && scale > 0 && Number.isFinite(size) && size >= 0
    ? { scale, size } : null;
}

// The text normalizer emits this wrapper for a whole inline-math scalebox.
// Keep the source body available for the non-native renderer's scale dispatch.
export function readScaledMath(tex) {
  const source = String(tex).trim();
  const prefix = source.match(/^\\tikzkitmathscale\{([^{}]+)\}\{([^{}]+)\}\{/);
  if (!prefix) return null;
  const attributes = scaledMathAttributes({ "data-tikzkit-scale": prefix[1], "data-tikzkit-size": prefix[2] });
  if (!attributes) return null;
  let depth = 1;
  for (let index = prefix[0].length; index < source.length; index++) {
    if (source[index] === "\\") { index++; continue; }
    if (source[index] === "{") depth++;
    if (source[index] === "}" && --depth === 0) {
      return index === source.length - 1 ? { ...attributes, tex: source.slice(prefix[0].length, index) } : null;
    }
  }
  return null;
}

export function relativeMathContext(node, context) {
  const name = node.attributes?.class;
  const operation = node.type === "html" && Object.hasOwn(classes, name) && classes[name];
  if (!operation) return null;
  if (operation === "smaller") return { ...context, style: Math.min(3, context.style + 1) };
  if (context.style > 0) return { ...context, style: context.style - 1 };
  // relsize.sty's display branch calls \\larger: target 1.2 times the
  // current text size, then the closest NFSS size within 5% tolerance.
  const target = context.base * 1.2;
  const profile = Object.values(LATEX_10PT_FONT_PROFILE).reduce((best, font) =>
    Math.abs(font.sizePt - target) < Math.abs(best.sizePt - target) ? font : best);
  // Arbitrary \\fontsize sizes need their own math-size declarations. Do not
  // silently substitute an unrelated optical font outside our native table.
  if (Math.abs(profile.sizePt - target) / target > 0.05) return null;
  return { ...context, base: profile.sizePt, baselineSkip: profile.baselineSkipPt };
}
