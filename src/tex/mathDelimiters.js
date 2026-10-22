import { nativeMathFont, nativeMathLevels } from "./mathFonts.js";

const largeSlots = { "(": 0, ")": 1, "[": 2, "]": 3, "⌊": 4, "⌋": 5,
  "⌈": 6, "⌉": 7, "{": 8, "}": 9, "⟨": 10, "⟩": 11, "|": 12, "‖": 13,
  "/": 14, "\\": 15, "√": 112 };
const aliases = { "\\{": "{", "\\}": "}", "\\lbrace": "{", "\\rbrace": "}",
  "\\langle": "⟨", "\\rangle": "⟩", "\\lvert": "|", "\\rvert": "|", "\\vert": "|",
  "\\lVert": "‖", "\\rVert": "‖", "\\Vert": "‖", "\\|": "‖",
  "\\lfloor": "⌊", "\\rfloor": "⌋", "\\lceil": "⌈", "\\rceil": "⌉" };

function character(font, text, size, metrics, color) {
  const [width, height, depth, italic] = metrics.map(v => v * size);
  return { width: width + italic, height, depth, items: [{ type: "glyph", text,
    family: font.family, style: font.style, weight: font.weight, size, x: 0, y: 0, color }] };
}

function extension(font, slot, size, color) {
  const m = font.slots[slot];
  return character(font, String.fromCodePoint(0xE000 + slot), size,
    [m.width || 0, m.height || 0, m.depth || 0, m.italic || 0], color);
}

// TeX's var_delimiter searches small-to-large optical fonts, then a TFM
// nextlarger chain, and finally a top/middle/repeat/bottom recipe.
export function nativeDelimiter(input, ctx, required) {
  const char = aliases[input] || input;
  if (char === ".") return { width: 1.2, height: 0, depth: 0, items: [] };
  if (!(char in largeSlots)) return null;
  const levels = nativeMathLevels(ctx.base).slice(0, Math.max(0, ctx.style - 1) + 1).reverse();
  let best;
  for (const size of levels) {
    const roles = ctx.bold ? ["CMBX", "CMBSY"] : ["CMR", "CMSY"];
    for (const role of roles) {
      const font = nativeMathFont(role, size);
      if (!font.glyphs[char]) continue;
      const box = character(font, char, size, font.glyphs[char], ctx.color);
      if (!best || box.height + box.depth > best.height + best.depth) best = box;
      if (box.height + box.depth >= required) return box;
      break;
    }
  }
  for (const opticalSize of levels) {
    const size = ctx.mathExtension === "ams" ? opticalSize : 10;
    const font = nativeMathFont("CMEX", size);
    for (let slot = largeSlots[char]; slot !== undefined; slot = font.slots[slot].nextlarger) {
      const box = extension(font, slot, size, ctx.color);
      const recipe = font.slots[slot].varchar;
      if (recipe) {
        const total = s => { const b = extension(font, s, size); return b.height + b.depth; };
        const repeatHeight = total(recipe.rep);
        const ends = [recipe.top, recipe.mid, recipe.bot].filter(s => s !== undefined);
        const fixed = ends.reduce((sum, s) => sum + total(s), 0);
        const count = repeatHeight > 0 ? Math.max(0, Math.ceil((required - fixed) / (repeatHeight * (recipe.mid ? 2 : 1)))) : 0;
        if (count > 1000) return null;
        const pieces = [recipe.top, ...Array(count).fill(recipe.rep), recipe.mid,
          ...(recipe.mid ? Array(count).fill(recipe.rep) : []), recipe.bot].filter(s => s !== undefined);
        if (!pieces.length) return null;
        const first = extension(font, pieces[0], size, ctx.color);
        const built = { width: extension(font, recipe.rep, size).width, height: first.height, depth: 0, items: [] };
        let y = -first.height;
        for (const s of pieces) {
          const part = extension(font, s, size, ctx.color);
          built.items.push(...part.items.map(item => ({ ...item, y: y + part.height })));
          y += part.height + part.depth;
        }
        built.depth = y;
        return built;
      }
      if (!best || box.height + box.depth > best.height + best.depth) best = box;
      if (box.height + box.depth >= required) return box;
    }
  }
  return best;
}
