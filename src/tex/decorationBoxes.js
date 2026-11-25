import { unscaledTextFont } from "./fontSpec.js";
import { layoutNativeMath, scaleNativeMathBox } from "./mathBox.js";
import { nativeMathFont, nativeMathSize } from "./mathFonts.js";
import { layoutNativeText, nativeSansFont, nativeTypewriterFont } from "./textBox.js";
import { nativeSpaceFactor } from "./textSpacing.js";

// PGF's ordinary scanchar consumes a token or a balanced argument, not a
// formatted string. Keep source offsets: rejoining tokens would turn e.g.
// "\\alpha x" into a different control word when handing a group to TeX math.
function tokenize(source) {
  if (/[^\x20-\x7e\t\n]|\^\^|\n[ \t]*\n/.test(source)) return null;
  const root = { children: [] }, stack = [root];
  let skipBlanks = false;
  for (const { 0: raw, index: start } of source.matchAll(/\\[A-Za-z]+|\\[^\n]|[ \t\n]+|./gs)) {
    if (raw === "%" || raw === "\\") return null;
    const value = /^[ \t\n]/.test(raw) ? " " : raw === "\\\t" ? "\\ " : raw;
    if (value === " " && skipBlanks) continue;
    skipBlanks = value === "\\ " || /^\\[A-Za-z]/.test(value);
    if (value === "}") {
      if (stack.length === 1) return null;
      stack.pop().end = start + 1;
      continue;
    }
    const token = { value, start, end: start + raw.length };
    stack.at(-1).children.push(token);
    if (value === "{") {
      if (stack.length > 64) return null;
      token.children = [];
      stack.push(token);
    }
  }
  return stack.length === 1 ? root.children : null;
}

const romanSlots = { '"': "\u201d", "<": "\u00a1", ">": "\u00bf", "|": "\u2014" };

function textChar(value, font) {
  if (value.length !== 1 || /[\\$#%&^_~]/.test(value)) return null;
  // Literal OT1 character slots, not the Unicode numbers of their paint glyphs.
  if (value === "'") return "\u2019";
  if (value === "`") return "\u2018";
  return romanSlots[value] && !nativeTypewriterFont(font) ? romanSlots[value] : value;
}

function textSpace(font, factor = 1000) {
  const box = layoutNativeText(" ", font);
  if (!box || factor < 2000) return box;
  // A text group does not reset TeX's spacefactor, even though its braces
  // interrupt ligaturing. Only the natural glue width matters inside an hbox.
  const bold = ["bold", "700"].includes(String(font.weight)) || /^TikZKitCM(?:BX|SSBX)/.test(font.family);
  const role = nativeTypewriterFont(font) ? "CMTT" : nativeSansFont(font)
    ? (bold ? "CMSSBX" : "CMSS") : (bold ? "CMBX" : "CMR");
  const size = nativeMathSize(Number(font.sizePt ?? 10));
  const extra = nativeMathFont(role, size).parameters.EXTRASPACE * size;
  return { ...box, width: font.extraSpaceSkipPt > 0 ? font.extraSpaceSkipPt : box.width + extra };
}

// Allow these argument-taking constructs, plus controls that are themselves
// paintable native math symbols/operators. In particular a macro definition
// or an argument-discarding command must not hide unknown source from us.
const mathConstruct = /^\\(?:frac|sqrt|hat|left|right|mathrm|mathbf|mathcal|mathnormal|boldsymbol|math(?:op|ord|bin|rel|open|close|punct|inner)|operatorname|limits|nolimits|(?:display|text|script|scriptscript)style|[,!:;]|quad|qquad|kern|mkern)$/;

function mathBox(tex, font) {
  const options = { fontSizePt: font.sizePt, mathVersion: font.mathVersion,
    mathExtension: font.mathExtension, baselineSkipPt: font.baselineSkipPt };
  const controls = new Set(tex.match(/\\(?:[A-Za-z]+|[^\n])/g));
  let prefix = "";
  for (const cs of controls) {
    // KaTeX normally treats both spellings as math glue. In TeX, \\space
    // expands to a blank, while control-space inserts *outer text font* glue,
    // even in a fraction. Local macros keep each spelling one argument token.
    if (cs === "\\space") prefix += "\\def\\space{ }";
    else if (cs === "\\ " || cs === "\\\t") {
      const blank = textSpace(font);
      if (!blank) return null;
      prefix += `\\def\\ {\\kern${blank.width.toFixed(6)}pt}`;
    } else if (!mathConstruct.test(cs) && !layoutNativeMath(cs, options)?.items.length) return null;
  }
  const box = layoutNativeMath(prefix + tex, options);
  return box && { kind: "math-box", text: tex, tex, box };
}

function groupBox(group, source, font) {
  const box = { width: 0, height: 0, depth: 0, items: [], measurementKind: "cm-text-box" };
  let factor = 1000, word = "";
  const append = child => {
    if (!child) return false;
    for (const item of child.items) box.items.push({ ...item, x: item.x + box.width });
    box.width += child.width;
    box.height = Math.max(box.height, child.height);
    box.depth = Math.max(box.depth, child.depth);
    return true;
  };
  const flush = () => {
    if (!word) return true;
    const ok = append(layoutNativeText(word, font));
    word = "";
    return ok;
  };
  const pack = tokens => {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i], v = token.value;
      if (token.children) {
        if (!flush() || !pack(token.children)) return false;
      } else if (v === "$") {
        if (!flush()) return false;
        const start = token.end;
        i++;
        while (i < tokens.length && tokens[i].value !== "$") i++;
        if (i === tokens.length || tokens[i].start === start) return false;
        const math = mathBox(source.slice(start, tokens[i].start), font);
        if (!math || !append(math.box)) return false;
        factor = 1000;
      } else if (v === " " || v === "\\ " || v === "\\space") {
        if (!flush() || !append(textSpace(font, v === "\\ " ? 1000 : factor))) return false;
      } else if (v === "\\kern") {
        if (!flush()) return false;
        const dim = /^[ \t\n]*([+-]?(?:\d+(?:\.\d*)?|\.\d+))[ \t\n]*pt[ \t\n]*/i.exec(source.slice(token.end));
        if (!dim || Math.abs(Number(dim[1])) >= 16384) return false;
        const end = token.end + dim[0].length;
        while (i + 1 < tokens.length && tokens[i + 1].start < end) i++;
        const pt = Number(dim[1]);
        box.width += Math.sign(pt) * Math.round(Math.abs(pt) * 65536) / 65536;
      } else {
        const char = /^\\[%#&]$/.test(v) ? v[1] : textChar(v, font);
        if (char === null) return false;
        word += char;
        factor = nativeSpaceFactor(factor, char);
      }
    }
    return flush();
  };
  const tokens = group.children;
  const text = source.slice(group.start + 1, group.end - 1);
  if (tokens[0]?.value === "$" && tokens.at(-1).value === "$" &&
      tokens.filter(t => t.value === "$").length === 2) {
    const tex = text.slice(1, -1);
    return tex.length ? mathBox(tex, font) : null;
  }
  return pack(tokens) ? { kind: "group", text, box } : null;
}

/**
 * Measure one complete, already font-resolved ordinary PGF decoration run.
 * The box origin is the left end of the baseline; all dimensions are TeX pt.
 * Only glyph " " without tex is a PGF stretchable scanner space. Math tex
 * excludes the shifts; group text is the source between its outer braces.
 * Unsupported input invalidates the whole run; no renderer fallback here.
 */
export function layoutDecorationRun(source, font = {}) {
  if (typeof source !== "string") return null;
  source = source.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n");
  const tokens = tokenize(source);
  if (!tokens) return null;
  const scale = font.geometricScale ?? 1;
  font = unscaledTextFont(font);
  const result = [];
  let math = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i], v = token.value;
    let entry;
    if (v === "$") {
      if (tokens[i + 1]?.value === "$") return null;
      math = !math;
      continue;
    } else if (v === " " || v === "\\ " || v === "\\space") {
      const box = math && v !== "\\ " ? mathBox(" ", font)?.box : textSpace(font);
      entry = { kind: "glyph", text: " ", ...(v !== " " ? { tex: v } : {}), box };
    } else if (token.children) {
      entry = math ? mathBox(source.slice(token.start + 1, token.end - 1), font) : groupBox(token, source, font);
    } else if (v === "|" || v.startsWith("\\")) {
      return null; // Formatting and general control-sequence expansion belong to the caller.
    } else if (math) {
      if ("^_#&~".includes(v)) return null;
      entry = mathBox(v, font);
    } else {
      const char = textChar(v, font);
      if (char === null) return null;
      entry = { kind: "glyph", text: v, box: layoutNativeText(char, font) };
    }
    if (!entry?.box) return null;
    result.push(scale === 1 ? entry : { ...entry, box: scaleNativeMathBox(entry.box, scale) });

    // collectrestoftextgrp#1#2\\pgf@stop re-wraps #1, but TeX strips one
    // brace pair from #2 if that parameter consists of exactly one group.
    if (i + 3 === tokens.length && tokens[i + 1].children && tokens[i + 2].children) {
      for (const child of tokens.pop().children) tokens.push(child);
    }
  }
  return math ? null : result;
}
