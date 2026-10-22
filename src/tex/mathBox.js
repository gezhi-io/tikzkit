import katex from "katex";
import { nativeDelimiter } from "./mathDelimiters.js";
import { nativeMathSize, nativeMathFont, nativeMathFontSize as fontSize, nativeBaselineSkip } from "./mathFonts.js";
import { layoutMathArray } from "./mathArrays.js";

// Renderer-neutral TeX boxes for supported CM formulas. KaTeX supplies syntax;
// TeX's math-list rules and local TFM metrics determine glyph placement.
const cache = new Map();
const symbols = new Map();
const spacing = {
  ord: { op: 3, bin: 4, rel: 5, inner: 3 },
  op: { ord: 3, op: 3, rel: 5, inner: 3 },
  bin: { ord: 4, op: 4, open: 4, inner: 4 },
  rel: { ord: 5, op: 5, open: 5, inner: 5 },
  close: { op: 3, bin: 4, rel: 5, inner: 3 },
  punct: { ord: 3, op: 3, rel: 3, open: 3, close: 3, punct: 3, inner: 3 },
  inner: { ord: 3, op: 3, bin: 4, rel: 5, open: 3, punct: 3, inner: 3 }
};
class UnsupportedMath extends Error {}
const unsupported = () => { throw new UnsupportedMath(); };
const empty = () => ({ width: 0, height: 0, depth: 0, items: [], atom: "ord" });
const parameters = ctx => nativeMathFont(ctx.bold ? "CMBSY" : "CMSY", fontSize(ctx)).parameters;
const parameter = (ctx, name) => parameters(ctx)[name] * fontSize(ctx);
const ruleThickness = ctx => ctx.mathExtension === "ams"
  ? nativeMathFont("CMEX", fontSize(ctx)).parameters.DEFAULTRULETHICKNESS * fontSize(ctx)
  : nativeMathFont("CMEX", 10).parameters.DEFAULTRULETHICKNESS * 10;
const scriptContext = (ctx, cramped = ctx.cramped) => ({ ...ctx, style: ctx.style < 2 ? 2 : 3, cramped });

/** Returns null for unsupported syntax/fonts; never partially drops a formula. */
export function layoutNativeMath(tex, options = {}) {
  const source = String(tex || "");
  const base = nativeMathSize(Number(options.fontSizePt ?? 10));
  if (!base || (options.mathVersion && !["normal", "bold"].includes(options.mathVersion)) ||
      !(options.mathVersion === "bold" || /[\^_]|\\(?:[dt]?frac|sqrt|mathbf|boldsymbol|begin|left|(?:script|scriptscript)style)\b/.test(source))) return null;
  const key = JSON.stringify([source, base, Boolean(options.displayMode), options.mathExtension, options.mathVersion, options.baselineSkipPt]);
  if (cache.has(key)) return cache.get(key);
  let result = null;
  try {
    const ast = katex.__parse(source, { strict: "ignore", trust: false, maxExpand: 1000 });
    result = list(ast, { base, style: options.displayMode ? 0 : 1, cramped: false,
      bold: options.mathVersion === "bold", baselineSkip: options.baselineSkipPt ?? nativeBaselineSkip(base),
      mathExtension: options.mathExtension });
    result = { ...result, fontSizePt: base, measurementKind: "cm-tex-box" };
  } catch (error) {
    if (!(error instanceof UnsupportedMath) && !(error instanceof katex.ParseError)) throw error;
  }
  if (cache.size >= 512) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

function append(box, child, x, y = 0) {
  box.items.push(...child.items.map(item => ({ ...item, x: item.x + x, y: item.y + y })));
  box.height = Math.max(box.height, child.height - y);
  box.depth = Math.max(box.depth, child.depth + y);
}

function list(nodes, ctx) {
  const entries = nodes.map(node => build(node, ctx));
  // TeX converts binary operators to ordinary atoms at boundaries and after
  // operators/opening delimiters. Script styles suppress non-operator glue.
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].atom !== "bin") continue;
    const prev = entries[i - 1]?.atom;
    const next = entries[i + 1]?.atom;
    if (!prev || ["bin", "op", "rel", "open", "punct"].includes(prev) ||
        !next || ["rel", "close", "punct"].includes(next)) entries[i].atom = "ord";
  }
  const box = empty();
  let previous;
  for (const entry of entries) {
    let mu = spacing[previous?.atom]?.[entry.atom] || 0;
    if (ctx.style >= 2 && !(mu === 3 && (previous?.atom === "op" || entry.atom === "op"))) mu = 0;
    box.width += mu * parameter(ctx, "QUAD") / 18;
    if (previous?.glyph && entry.glyph && previous.font === entry.font) {
      const kern = entry.font.kern[previous.glyph]?.[entry.glyph];
      if (kern !== undefined) box.width += kern * fontSize(ctx);
    }
    append(box, entry, box.width);
    box.width += entry.width;
    previous = entry;
  }
  if (entries.length === 1) Object.assign(box, {
    atom: entries[0].atom, character: entries[0].character, italic: entries[0].italic
  });
  return box;
}

function unicode(text) {
  if ([...text].length === 1 && text !== "-") return text;
  if (symbols.has(text)) return symbols.get(text);
  const tree = katex.__renderToHTMLTree(text, { strict: "ignore", trust: false });
  const glyphs = [];
  const visit = node => {
    if (typeof node.text === "string" && node.text !== "\u200b") glyphs.push(node.text);
    for (const child of node.children || []) visit(child);
  };
  visit(tree);
  const result = glyphs.join("");
  if ([...result].length !== 1) unsupported();
  symbols.set(text, result);
  return result;
}

function glyph(text, ctx, mathItalic, atom = "ord") {
  const char = ctx.textFace ? text : unicode(text);
  // fontmath.ltx assigns math punctuation and /, <, > to the letters family.
  // CMR has similar-looking glyphs, but different small optical-size advances.
  let roles = ["/", ",", ".", "<", ">"].includes(char) ? ["CMMI"]
    : ctx.roman && /^[A-Za-z0-9\u0391-\u03a9]$/.test(char) ? [ctx.roman === "bold" ? "CMBX" : "CMR"]
    : mathItalic ? ["CMMI"] : ["CMR", "CMSY", "CMMI"];
  if (ctx.bold) roles = roles.map(role => ({ CMR: "CMBX", CMMI: "CMMIB", CMSY: "CMBSY" })[role] || role);
  if (ctx.textFace) roles = [ctx.textFace];
  const size = fontSize(ctx);
  const font = roles.map(role => nativeMathFont(role, size)).find(font => font.glyphs[char]);
  if (!font) unsupported();
  const metrics = font;
  const [advance, height, depth, italic] = metrics.glyphs[char].map(value => value * size);
  return { width: advance + (ctx.textFace ? 0 : italic), height, depth, italic, character: true, atom, glyph: char, font,
    items: [{ type: "glyph", text: char, family: metrics.family, style: metrics.style,
      weight: metrics.weight, size, color: ctx.color, x: 0, y: 0 }] };
}

function build(node, ctx) {
  switch (node.type) {
    case "mathord": return glyph(node.text, ctx, true);
    case "textord": return glyph(node.text, ctx, false);
    case "atom": return glyph(node.text, ctx, false, node.family);
    case "ordgroup": return list(node.body, ctx);
    case "color": return list(node.body, { ...ctx, color: node.color });
    case "mclass": return { ...list(node.body, ctx), atom: node.mclass.slice(1), character: false };
    case "font":
      if (!["mathrm", "mathnormal", "mathbf", "boldsymbol"].includes(node.font)) return unsupported();
      if (node.font === "boldsymbol") return { ...build(node.body, { ...ctx, bold: true }), character: false };
      return build(node.body, { ...ctx, roman: node.font === "mathbf" ? "bold" : node.font === "mathrm" });
    case "styling": return list(node.body, { ...ctx,
      style: ["display", "text", "script", "scriptscript"].indexOf(node.style) });
    case "supsub": return scripts(node, ctx);
    case "genfrac": return fraction(node, ctx);
    case "sqrt": return radical(node, ctx);
    case "array": return matrix(node, ctx);
    case "leftright": return delimited(node, ctx);
    case "text": return textBox(node, ctx);
    case "htmlmathml": {
      // KaTeX expands \ne into HTML overlap nodes. TeX instead overlays the
      // zero-advance CMSY negation slash and equals in the relation list.
      if (node.mathml?.length !== 1 || node.mathml[0].mclass !== "mrel"
          || node.mathml[0].body?.length !== 1 || node.mathml[0].body[0].text !== "≠") return unsupported();
      return { ...list([{type:"atom",family:"rel",text:"\u0338"},
        {type:"atom",family:"rel",text:"="}], ctx), atom:"rel", character:false };
    }
    case "kern": return { ...empty(), width: dimension(node.dimension, ctx), atom: null };
    case "spacing":
      if ([" ", "~", "\\ ", "\\space", "\\nobreakspace"].includes(node.text)) return {
        ...empty(), width: nativeMathFont(ctx.textFace || "CMR", fontSize(ctx)).parameters.SPACE * fontSize(ctx), atom: null
      };
      return unsupported();
    case "op": {
      if (node.symbol || !/^\\[a-z]+$/.test(node.name || "")) return unsupported();
      const box = list([...node.name.slice(1)].map(text => ({ type: "textord", text })), { ...ctx, roman: true });
      return { ...box, atom: "op", character: false };
    }
    default: return unsupported();
  }
}

function dimension(value, ctx) {
  const size = fontSize(ctx);
  const text = nativeMathFont("CMR", ctx.base).parameters;
  const units = {pt:1,em:text.QUAD * ctx.base,ex:text.XHEIGHT * ctx.base,
    mu:parameter(ctx,"QUAD") / 18,cm:72.27 / 2.54,mm:72.27 / 25.4};
  if (!(value.unit in units) || !Number.isFinite(value.number) || !size) return unsupported();
  return value.number * units[value.unit];
}

function textBox(node, ctx) {
  if (!["\\text", "\\textrm", "\\textnormal", "\\textbf", "\\mbox"].includes(node.font)) return unsupported();
  const textFace = node.font === "\\textbf" ? "CMBX" : "CMR";
  const textCtx = { ...ctx, textFace, bold: false };
  const font = nativeMathFont(textFace, fontSize(ctx));
  const body = [];
  for (const item of node.body) {
    const previous = body.at(-1);
    const ligature = item.type === "textord" && previous?.type === "textord"
      && font.ligatures[previous.text]?.[item.text];
    if (ligature) previous.text = ligature;
    else body.push({ ...item });
  }
  return { ...list(body, textCtx), atom: "ord", character: false };
}

function radical(node, ctx) {
  const body = build(node.body, { ...ctx, cramped: true });
  const rule = ruleThickness(ctx);
  let clearance = rule + Math.abs(ctx.style === 0 ? parameter(ctx, "XHEIGHT") : rule) / 4;
  const sign = nativeDelimiter("√", ctx, body.height + body.depth + clearance + rule);
  if (!sign) return unsupported();
  clearance += Math.max(0, sign.depth - body.height - body.depth - clearance) / 2;
  const box = empty();
  append(box, sign, 0, -body.height - clearance);
  append(box, body, sign.width);
  box.items.push({ type: "rule", x: sign.width, y: -body.height - clearance - sign.height,
    width: body.width, height: sign.height, color: ctx.color });
  box.width = sign.width + body.width;
  // overbar includes an unpainted rule-thickness kern above the bar.
  box.height = Math.max(box.height, body.height + clearance + 2 * sign.height);
  if (!node.index) return box;
  const index = build(node.index, { ...ctx, style: 3, cramped: false });
  const mu = parameter(ctx, "QUAD") / 18;
  const indexed = empty();
  append(indexed, index, 5 * mu, -0.6 * (box.height - box.depth));
  append(indexed, box, index.width - 5 * mu);
  indexed.width = box.width + index.width - 5 * mu;
  return indexed;
}

function delimited(node, ctx) {
  const body = list(node.body, ctx);
  const axis = parameter(ctx, "AXISHEIGHT");
  const extent = Math.max(body.height - axis, body.depth + axis);
  const target = Math.max(2 * extent * 0.901, 2 * extent - 5);
  const left = nativeDelimiter(node.left, ctx, target);
  const right = nativeDelimiter(node.right, ctx, target);
  if (!left || !right) return unsupported();
  const box = empty();
  append(box, left, 0, (left.height - left.depth) / 2 - axis);
  append(box, body, left.width);
  append(box, right, left.width + body.width, (right.height - right.depth) / 2 - axis);
  box.width = left.width + body.width + right.width;
  box.atom = "inner";
  return box;
}

function matrix(node, ctx) {
  return layoutMathArray(node, ctx, { build, append, empty, unsupported, dimension, axis:parameter(ctx,"AXISHEIGHT") });
}

function fraction(node, ctx) {
  if (!node.hasBarLine || node.barSize || node.leftDelim || node.rightDelim || node.continued) return unsupported();
  const childStyle = ctx.style === 0 ? 1 : Math.min(3, ctx.style + 1);
  const num = build(node.numer, { ...ctx, style: childStyle });
  const den = build(node.denom, { ...ctx, style: childStyle, cramped: true });
  const rule = ruleThickness(ctx);
  const axis = parameter(ctx, "AXISHEIGHT");
  const clearance = (ctx.style === 0 ? 3 : 1) * rule;
  const up = Math.max(parameter(ctx, ctx.style === 0 ? "NUM1" : "NUM2"), num.depth + axis + rule / 2 + clearance);
  const down = Math.max(parameter(ctx, ctx.style === 0 ? "DENOM1" : "DENOM2"), den.height - axis + rule / 2 + clearance);
  const width = Math.max(num.width, den.width);
  const box = empty();
  // TeX inserts \nulldelimiterspace (1.2pt) at each end of an ordinary \over.
  box.width = width + 2.4;
  append(box, num, 1.2 + (width - num.width) / 2, -up);
  append(box, den, 1.2 + (width - den.width) / 2, down);
  box.items.push({ type: "rule", x: 1.2, y: -axis - rule / 2, width, height: rule, color: ctx.color });
  return box;
}

function scripts(node, ctx) {
  const base = node.base ? build(node.base, ctx) : empty();
  if (base.atom === "op") return unsupported();
  const subCtx = scriptContext(ctx, true);
  const supCtx = scriptContext(ctx);
  const sub = node.sub ? build(node.sub, subCtx) : null;
  const sup = node.sup ? build(node.sup, supCtx) : null;
  let up = base.character ? 0 : base.height - parameter(supCtx, "SUPDROP");
  let down = base.character ? 0 : base.depth + parameter(subCtx, "SUBDROP");
  const xHeight = parameter(ctx, "XHEIGHT");
  if (sup) up = Math.max(up, parameter(ctx, ctx.cramped ? "SUP3" : ctx.style === 0 ? "SUP1" : "SUP2"), sup.depth + xHeight / 4);
  if (sub && !sup) down = Math.max(down, parameter(ctx, "SUB1"), sub.height - 0.8 * xHeight);
  if (sub && sup) {
    down = Math.max(down, parameter(ctx, "SUB2"));
    const gap = (up - sup.depth) - (sub.height - down);
    const minGap = 4 * ruleThickness(ctx);
    if (gap < minGap) {
      down += minGap - gap;
      const correction = 0.8 * xHeight - (up - sup.depth);
      if (correction > 0) { up += correction; down -= correction; }
    }
  }
  const italic = base.character ? base.italic || 0 : 0;
  const box = empty();
  append(box, base, 0);
  if (sup) append(box, sup, base.width, -up);
  if (sub) append(box, sub, base.width - italic, down);
  box.width = base.width + Math.max(sup ? sup.width : -italic, sub ? sub.width - italic : 0) + 0.5;
  box.atom = base.atom;
  return box;
}
