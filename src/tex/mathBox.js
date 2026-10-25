import katex from "katex";
import { nativeDelimiter } from "./mathDelimiters.js";
import { nativeMathSize, nativeMathFont, nativeMathFontSize as fontSize, nativeBaselineSkip } from "./mathFonts.js";
import { layoutMathArray } from "./mathArrays.js";
import { relativeMathContext, relativeMathParseOptions, scaledMathAttributes } from "./relativeMath.js";

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
  // TeX measures an ordinary math atom with the same TFM rules as a fraction
  // or script. Formula complexity must not select a different font/box model.
  if (!base || (options.mathVersion && !["normal", "bold"].includes(options.mathVersion))) return null;
  const key = JSON.stringify([source, base, Boolean(options.displayMode), options.mathExtension, options.mathVersion, options.baselineSkipPt]);
  if (cache.has(key)) return cache.get(key);
  let result = null;
  try {
    const ast = katex.__parse(source, { strict: "ignore", maxExpand: 1000, ...relativeMathParseOptions });
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

export function scaleNativeMathBox(box, scale) {
  if (scale === 1) return box;
  return { ...box, width: box.width * scale, height: box.height * scale, depth: box.depth * scale,
    italic: (box.italic || 0) * scale,
    items: box.items.map(item => ({ ...item, x: item.x * scale, y: item.y * scale,
      ...(item.type === "glyph" ? { size: item.size * scale }
        : { width: item.width * scale, height: item.height * scale }) })) };
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
  for (const [index, entry] of entries.entries()) {
    let mu = spacing[previous?.atom]?.[entry.atom] || 0;
    if (ctx.style >= 2 && !(mu === 3 && (previous?.atom === "op" || entry.atom === "op"))) mu = 0;
    // Top-level math glue remains stretchable in an inline paragraph. Nested
    // fraction/script boxes are already packed and do not contribute glue.
    if (mu >= 4) (box.paragraphGlues ||= []).push({ itemIndex: box.items.length,
      stretch: (mu === 4 ? 2 : 5) * parameter(ctx, "QUAD") / 18,
      shrink: (mu === 4 ? 4 : 0) * parameter(ctx, "QUAD") / 18 });
    box.width += mu * parameter(ctx, "QUAD") / 18;
    if (previous?.glyph && entry.glyph && previous.font === entry.font) {
      const kern = entry.font.kern[previous.glyph]?.[entry.glyph];
      if (kern !== undefined) box.width += kern * fontSize(ctx);
    }
    if (["styling", "color"].includes(nodes[index].type) && entry.paragraphGlues) {
      (box.paragraphGlues ||= []).push(...entry.paragraphGlues.map(glue => ({
        ...glue, itemIndex: glue.itemIndex + box.items.length
      })));
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
  const codepoint = ctx.textFace ? text : unicode(text);
  // fontmath.ltx maps \cdot to CMSY slot 01. Our MacTeX font subset
  // encodes that outline as periodcentered, while KaTeX returns U+22C5.
  const char = !ctx.textFace && codepoint === "\u22c5" ? "\u00b7" : codepoint;
  // fontmath.ltx's mathcal selects the symbols alphabet. Capitals keep
  // their ASCII slots in CMSY; they are not Unicode script characters in CMMI.
  // Non-capital variable slots need their own symbol mapping, not a roman
  // lookalike. Retain the complete fallback until that mapping is available.
  if (ctx.calligraphic && /^[a-z0-9]$/.test(char)) unsupported();
  // fontmath.ltx assigns math punctuation and /, <, > to the letters family.
  // CMR has similar-looking glyphs, but different small optical-size advances.
  let roles = ctx.calligraphic && /^[A-Z]$/.test(char) ? ["CMSY"]
    : ["/", ",", ".", "<", ">"].includes(char) ? ["CMMI"]
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
      if (!["mathrm", "mathnormal", "mathbf", "boldsymbol", "mathcal"].includes(node.font)) return unsupported();
      if (node.font === "boldsymbol") return { ...build(node.body, { ...ctx, bold: true }), character: false };
      return build(node.body, { ...ctx, calligraphic: node.font === "mathcal",
        roman: node.font === "mathbf" ? "bold" : node.font === "mathrm" });
    case "styling": return list(node.body, { ...ctx,
      style: ["display", "text", "script", "scriptscript"].indexOf(node.style) });
    case "html": {
      const scaled = scaledMathAttributes(node.attributes);
      if (scaled) {
        const base = scaled.size ? nativeMathSize(scaled.size) : ctx.base;
        if (!base) return unsupported();
        // graphicx first typesets an hbox, then transforms its finished glyphs
        // and rules. It must not select the optical font at the scaled size.
        const body = list(node.body, { ...ctx, base, style: 1, cramped: false,
          baselineSkip: scaled.size ? nativeBaselineSkip(base) : ctx.baselineSkip });
        return { ...scaleNativeMathBox(body, scaled.scale), atom: "ord", character: false };
      }
      const relative = relativeMathContext(node, ctx);
      if (!relative) return unsupported();
      // relsize wraps its result in a group: neighboring atoms retain their
      // original font and glue, even when this atom changes math style.
      return { ...list(node.body, relative), atom: "ord", character: false };
    }
    case "supsub": return scripts(node, ctx);
    case "accent": return accent(node, ctx);
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

function singleAccentCharacter(node, ctx) {
  if (node.type === "ordgroup" && node.body.length === 1) return singleAccentCharacter(node.body[0], ctx);
  if (node.type === "font" && ["mathrm", "mathbf", "mathnormal"].includes(node.font)) {
    return singleAccentCharacter(node.body, { ...ctx,
      roman: node.font === "mathbf" ? "bold" : node.font === "mathrm" });
  }
  return ["mathord", "textord"].includes(node.type) || (node.type === "atom" && node.family === "ord")
    ? build(node, ctx) : null;
}

function accent(node, ctx, attachedScripts = null) {
  // fontmath.ltx: ordinary hat is operators slot 5E. Wide/other accents
  // have different families or size chains and must keep their fallback.
  if (node.label !== "\\hat" || node.isStretchy || ctx.roman === false) return unsupported();
  // TeX section 1165 lets a mathalpha accent use the current family:
  // \mathbf{\hat{x}} selects CMBX, unlike \hat{\mathbf{x}}. An outer
  // \mathnormal selects CMMI slot 5E, not the ordinary hat supported here.
  const role = ctx.bold || ctx.roman === "bold" ? "CMBX" : "CMR";
  const font = nativeMathFont(role, fontSize(ctx));
  const mark = glyph("\u02c6", { ...ctx, textFace: role }, false);
  const cramped = { ...ctx, cramped: true };
  const nucleus = build(node.base, cramped);
  const character = singleAccentCharacter(node.base, cramped);
  const skew = character ? (character.font.skewKern?.[character.glyph] || 0) * fontSize(ctx) : 0;
  let body = nucleus;
  let delta = Math.min(nucleus.height, font.parameters.XHEIGHT * fontSize(ctx));
  // TeX sections 738-742: scripts on a character accentee move inside the
  // nucleus box, but the accent stays centered on its original clean width.
  if (attachedScripts && character) {
    body = scripts({ ...attachedScripts, base: node.base }, ctx);
    delta += body.height - nucleus.height;
  }
  const box = empty();
  append(box, mark, skew + (nucleus.width - mark.width) / 2, delta - body.height - mark.depth);
  append(box, body, 0);
  box.width = body.width;
  box.character = false;
  return box;
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
  let accentee = node.base;
  // TeX section 1186 removes braces around a lone accent noad before
  // attaching scripts; KaTeX retains an ordgroup in that spelling.
  while (accentee?.type === "ordgroup" && accentee.body.length === 1) accentee = accentee.body[0];
  if (accentee?.type === "accent" && accentee.label === "\\hat" && singleAccentCharacter(accentee.base, ctx)) {
    return accent(accentee, ctx, node);
  }
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
