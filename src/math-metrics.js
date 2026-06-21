import { mathFallbackText } from "./tex-text.js";

const SCRIPT_CHAR_PATTERN =
  /[₀₁₂₃₄₅₆₇₈₉ₐᵦₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ₊₋₌₍₎⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]/u;

export function parseMathText(value) {
  const text = String(value).trim();
  const displayDollar = text.match(/^\$\$([\s\S]+)\$\$$/);
  if (displayDollar) return { tex: displayDollar[1].trim(), displayMode: true };
  const inlineDollar = text.match(/^\$([^$]+)\$$/);
  if (inlineDollar) return { tex: inlineDollar[1].trim(), displayMode: false };
  const displayBracket = text.match(/^\\\[([\s\S]+)\\\]$/);
  if (displayBracket) return { tex: displayBracket[1].trim(), displayMode: true };
  const inlineParen = text.match(/^\\\(([\s\S]+)\\\)$/);
  if (inlineParen) return { tex: inlineParen[1].trim(), displayMode: false };
  return null;
}

export function estimateFormulaBox(tex, options = {}) {
  const displayMode = Boolean(options.displayMode);
  const scale = Number(options.scale) > 0 ? Number(options.scale) : 1;
  const minWidth = Number.isFinite(options.minWidth) ? options.minWidth : displayMode ? 0.72 : 0.42;
  const metric = {
    widthFactor: Number.isFinite(options.widthFactor) ? options.widthFactor : 0.16,
    widthPadding: Number.isFinite(options.widthPadding) ? options.widthPadding : 0.35 * scale
  };
  const compact = estimateFormulaParts(String(tex || "").trim(), scale, metric);
  const displayScale = displayMode ? 1.12 : 1;
  return {
    width: round(Math.max(minWidth, compact.width * displayScale)),
    height: round(compact.height * displayScale),
    depth: round(compact.depth * displayScale)
  };
}

export function formulaTotalHeight(box) {
  return (box?.height || 0) + (box?.depth || 0);
}

export function mathTextMetricUnits(line) {
  const chars = [...String(line || "").trim()];
  let units = 0;
  let superscript = false;
  for (const char of chars) {
    if (char === "\u20d7" || char === "\u0302" || char === "\u0304") continue;
    if (char === "^") {
      superscript = true;
      units += 0.1;
      continue;
    }
    if (SCRIPT_CHAR_PATTERN.test(char)) {
      units += 0.45;
      continue;
    }
    if (superscript) {
      if (/\s/.test(char)) {
        superscript = false;
        units += 0.25;
      } else {
        units += 0.45;
      }
      continue;
    }
    if (char === "→" || char === "←" || char === "⇒" || char === "⇐") {
      units += 0.9;
      continue;
    }
    units += /\s/.test(char) ? 0.35 : 1;
  }
  return units;
}

function estimateFormulaParts(tex, scale, metric) {
  let width = fallbackWidth(tex, scale, metric);
  let height = 0.26 * scale;
  let depth = 0.09 * scale;

  for (const fraction of readCommandPairs(tex, ["frac", "dfrac", "tfrac"])) {
    const numerator = estimateFormulaParts(fraction.first, scale * 0.9, metric);
    const denominator = estimateFormulaParts(fraction.second, scale * 0.9, metric);
    width = Math.max(width, Math.max(numerator.width, denominator.width) + 0.28 * scale);
    height = Math.max(height, numerator.height + numerator.depth + 0.18 * scale);
    depth = Math.max(depth, denominator.height + denominator.depth + 0.14 * scale);
  }

  for (const radical of readCommandGroups(tex, ["sqrt"])) {
    const body = estimateFormulaParts(radical, scale, metric);
    width = Math.max(width, body.width + 0.28 * scale);
    height = Math.max(height, body.height + 0.16 * scale);
    depth = Math.max(depth, body.depth);
  }

  if (/\\(?:sum|prod|bigcup|bigcap)(?![A-Za-z])/.test(tex)) {
    width = Math.max(width, fallbackWidth(tex, scale, metric) + 0.08 * scale);
    if (hasSubscript(tex)) depth = Math.max(depth, 0.26 * scale);
    if (hasSuperscript(tex)) height = Math.max(height, 0.43 * scale);
    if (hasSubscript(tex) && hasSuperscript(tex)) {
      height = Math.max(height, 0.46 * scale);
      depth = Math.max(depth, 0.28 * scale);
    }
  } else if (/[^^]\\?[_^]|^\\?[_^]/.test(tex)) {
    if (hasSuperscript(tex)) height = Math.max(height, 0.34 * scale);
    if (hasSubscript(tex)) depth = Math.max(depth, 0.14 * scale);
  }

  if (/\\(?:int|oint)(?![A-Za-z])/.test(tex)) {
    height = Math.max(height, 0.43 * scale);
    depth = Math.max(depth, hasSubscript(tex) ? 0.24 * scale : 0.16 * scale);
  }

  return { width, height, depth };
}

function fallbackWidth(tex, scale, metric) {
  return mathTextMetricUnits(mathFallbackText(tex)) * metric.widthFactor * scale + metric.widthPadding;
}

function hasSubscript(tex) {
  return /_\s*(?:\{|[A-Za-z0-9\\])/.test(tex);
}

function hasSuperscript(tex) {
  return /\^\s*(?:\{|[A-Za-z0-9\\])/.test(tex);
}

function readCommandGroups(tex, names) {
  const groups = [];
  for (const name of names) {
    let cursor = 0;
    const needle = `\\${name}`;
    while ((cursor = tex.indexOf(needle, cursor)) !== -1) {
      let groupStart = cursor + needle.length;
      while (/\s/.test(tex[groupStart] || "")) groupStart += 1;
      if (tex[groupStart] === "[") {
        const optional = readBalanced(tex, groupStart, "[", "]");
        if (optional) groupStart = optional.end;
        while (/\s/.test(tex[groupStart] || "")) groupStart += 1;
      }
      const group = readBalanced(tex, groupStart, "{", "}");
      if (group) {
        groups.push(group.content);
        cursor = group.end;
      } else {
        cursor += needle.length;
      }
    }
  }
  return groups;
}

function readCommandPairs(tex, names) {
  const pairs = [];
  for (const name of names) {
    let cursor = 0;
    const needle = `\\${name}`;
    while ((cursor = tex.indexOf(needle, cursor)) !== -1) {
      let firstStart = cursor + needle.length;
      while (/\s/.test(tex[firstStart] || "")) firstStart += 1;
      const first = readBalanced(tex, firstStart, "{", "}");
      if (!first) {
        cursor += needle.length;
        continue;
      }
      let secondStart = first.end;
      while (/\s/.test(tex[secondStart] || "")) secondStart += 1;
      const second = readBalanced(tex, secondStart, "{", "}");
      if (second) {
        pairs.push({ first: first.content, second: second.content });
        cursor = second.end;
      } else {
        cursor = first.end;
      }
    }
  }
  return pairs;
}

function readBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return { content: text.slice(start + 1, index), end: index + 1 };
      }
    }
  }
  return null;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}
