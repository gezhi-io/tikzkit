const TEX_CSS_CONFLICT_COLOR_NAMES = new Set([
  "darkgray",
  "lightgray",
  "green",
  "brown",
  "cyan",
  "magenta",
  "yellow",
  "olive",
  "lime",
  "orange",
  "pink",
  "purple",
  "violet"
]);

const NAMED_COLORS = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "cyan",
  "magenta",
  "yellow",
  "gray",
  "grey",
  "orange",
  "purple",
  "brown",
  "pink"
]);

for (const color of [
  "aqua",
  "aquamarine",
  "blueviolet",
  "chartreuse",
  "coral",
  "cornflowerblue",
  "crimson",
  "darkblue",
  "darkcyan",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkmagenta",
  "darkorange",
  "darkred",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "fuchsia",
  "gold",
  "goldenrod",
  "greenyellow",
  "indigo",
  "lightblue",
  "lightcyan",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsteelblue",
  "lime",
  "limegreen",
  "maroon",
  "navy",
  "none",
  "olive",
  "orchid",
  "plum",
  "rebeccapurple",
  "salmon",
  "silver",
  "skyblue",
  "springgreen",
  "teal",
  "transparent",
  "turquoise",
  "violet",
  "yellowgreen"
]) {
  NAMED_COLORS.add(color);
}

export function isColorToken(value) {
  const text = String(value).trim();
  return isPlainColor(text) || text.includes("!");
}

export function normalizeColor(value) {
  const text = String(value).trim();
  const rgb = text.match(/^rgb\s*:\s*red\s*,\s*(\d+)\s*;\s*green\s*,\s*(\d+)\s*;\s*blue\s*,\s*(\d+)$/);
  if (rgb) return `rgb(${rgb[1]} ${rgb[2]} ${rgb[3]})`;
  if (!text.includes("!")) {
    const texNamed = dvipsColorSpec(text);
    if (texNamed) return colorSpecToCss(texNamed);
    const lower = text.toLowerCase();
    const natural = xcolorNaturalColorSpec(lower);
    if (natural && TEX_CSS_CONFLICT_COLOR_NAMES.has(lower)) {
      return colorSpecToCss(natural);
    }
    return isPlainColor(text) ? text : "black";
  }
  const spec = resolveColorSpec(text);
  const first = text.split("!", 1)[0].trim();
  return spec ? colorSpecToCss(spec) : isPlainColor(first) ? first : "black";
}

// Keep xcolor's algebra separate from DeviceCMYK display conversion. PGFPlots
// converts a whole color sequence before interpolation; path paint does not.
export function resolveColorSpec(value, targetModel) {
  const parts = String(value).trim().split("!").map(part => part.trim()).filter(Boolean);
  let current = colorToSpec(parts[0] || "");
  if (!current) return null;
  for (let index = 1; index < parts.length; index += 2) {
    const amount = Number(parts[index]);
    if (!Number.isFinite(amount)) break;
    const target = colorToSpec(parts[index + 1] || "white");
    if (!target) break;
    const convertedTarget = convertColorSpec(target, current.model);
    current = {
      model: current.model,
      channels: mixChannels(current.channels, convertedTarget.channels, amount / 100)
    };
  }
  return targetModel ? convertColorSpec(current, targetModel) : current;
}

function isPlainColor(value) {
  const text = String(value).trim();
  return (
    Object.hasOwn(DVIPS_COLOR_SPECS, text) ||
    NAMED_COLORS.has(text.toLowerCase()) ||
    /^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i.test(text) ||
    /^rgba?\s*\(/i.test(text) ||
    /^hsla?\s*\(/i.test(text)
  );
}

const BASIC_COLOR_RGB = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
  yellow: [255, 255, 0],
  aqua: [0, 255, 255],
  aquamarine: [127, 255, 212],
  blueviolet: [138, 43, 226],
  orange: [255, 128, 0],
  purple: [191, 0, 64],
  violet: [238, 130, 238],
  teal: [0, 128, 128],
  brown: [191, 128, 64],
  chartreuse: [127, 255, 0],
  coral: [255, 127, 80],
  cornflowerblue: [100, 149, 237],
  crimson: [220, 20, 60],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  lightgray: [211, 211, 211],
  darkgray: [169, 169, 169],
  darkgrey: [169, 169, 169],
  darkblue: [0, 0, 139],
  darkcyan: [0, 139, 139],
  darkgreen: [0, 100, 0],
  darkmagenta: [139, 0, 139],
  darkorange: [255, 140, 0],
  darkred: [139, 0, 0],
  darkviolet: [148, 0, 211],
  deeppink: [255, 20, 147],
  deepskyblue: [0, 191, 255],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  fuchsia: [255, 0, 255],
  gold: [255, 215, 0],
  goldenrod: [218, 165, 32],
  greenyellow: [173, 255, 47],
  indigo: [75, 0, 130],
  lightblue: [173, 216, 230],
  lightcyan: [224, 255, 255],
  lightgreen: [144, 238, 144],
  lightpink: [255, 182, 193],
  lightsteelblue: [176, 196, 222],
  lime: [191, 255, 0],
  limegreen: [50, 205, 50],
  maroon: [128, 0, 0],
  navy: [0, 0, 128],
  olive: [128, 128, 0],
  orchid: [218, 112, 214],
  pink: [255, 192, 203],
  plum: [221, 160, 221],
  rebeccapurple: [102, 51, 153],
  salmon: [250, 128, 114],
  silver: [192, 192, 192],
  skyblue: [97, 255, 224],
  springgreen: [189, 255, 61],
  turquoise: [64, 224, 208],
  yellowgreen: [154, 205, 50]
};

const XCOLOR_NATURAL_COLOR_SPECS = {
  red: { model: "rgb", channels: [1, 0, 0] },
  green: { model: "rgb", channels: [0, 1, 0] },
  blue: { model: "rgb", channels: [0, 0, 1] },
  brown: { model: "rgb", channels: [0.75, 0.5, 0.25] },
  lime: { model: "rgb", channels: [0.75, 1, 0] },
  orange: { model: "rgb", channels: [1, 0.5, 0] },
  pink: { model: "rgb", channels: [1, 0.75, 0.75] },
  purple: { model: "rgb", channels: [0.75, 0, 0.25] },
  teal: { model: "rgb", channels: [0, 0.5, 0.5] },
  violet: { model: "rgb", channels: [0.5, 0, 0.5] },
  // color.sty defines these four defaults in CMYK. xcolor preserves that
  // natural model until a document explicitly selects another target model,
  // so `cyan!50!black` mixes the CMYK channels before the SVG conversion.
  cyan: { model: "cmyk", channels: [1, 0, 0, 0] },
  magenta: { model: "cmyk", channels: [0, 1, 0, 0] },
  yellow: { model: "cmyk", channels: [0, 0, 1, 0] },
  olive: { model: "cmyk", channels: [0, 0, 1, 0.5] },
  black: { model: "gray", channels: [0] },
  darkgray: { model: "gray", channels: [0.25] },
  gray: { model: "gray", channels: [0.5] },
  grey: { model: "gray", channels: [0.5] },
  lightgray: { model: "gray", channels: [0.75] },
  white: { model: "gray", channels: [1] }
};

// dvipsnam.def names are case-sensitive: Green (CMYK) is not green (RGB).
// Keep the original channels so a mix converts to the base color's model
// before interpolation; converting both endpoints to display RGB is wrong.
const DVIPS_COLOR_SPECS = {
  Blue: { model: "cmyk", channels: [1, 1, 0, 0] },
  WildStrawberry: { model: "cmyk", channels: [0, 0.96, 0.39, 0] },
  Green: { model: "cmyk", channels: [1, 0, 1, 0] },
  Sepia: { model: "cmyk", channels: [0, 0.83, 1, 0.7] },
  Red: { model: "cmyk", channels: [0, 1, 1, 0] },
  LimeGreen: { model: "cmyk", channels: [0.5, 0, 1, 0] },
  SkyBlue: { model: "cmyk", channels: [0.62, 0, 0.12, 0] },
  SpringGreen: { model: "cmyk", channels: [0.26, 0, 0.76, 0] }
};

export function colorToRgb(value) {
  const spec = colorToSpec(value);
  if (!spec) return null;
  return colorSpecToRgb(spec).map((channel) => Math.round(channel * 255));
}

function colorToSpec(value) {
  const name = String(value).trim();
  const dvips = dvipsColorSpec(name);
  if (dvips) return dvips;
  const text = name.toLowerCase();
  const natural = xcolorNaturalColorSpec(text);
  if (natural) return natural;
  if (Object.hasOwn(BASIC_COLOR_RGB, text)) {
    return { model: "rgb", channels: BASIC_COLOR_RGB[text].map((channel) => channel / 255) };
  }
  const rgbSpace = text.match(/^rgb\((\d+)\s+(\d+)\s+(\d+)\)$/);
  if (rgbSpace) return { model: "rgb", channels: rgbSpace.slice(1).map(Number).map((channel) => channel / 255) };
  const rgbComma = text.match(/^rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)$/);
  if (rgbComma) return { model: "rgb", channels: rgbComma.slice(1).map(Number).map((channel) => channel / 255) };
  const hex = text.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return {
      model: "rgb",
      channels: [hex[1].slice(0, 2), hex[1].slice(2, 4), hex[1].slice(4, 6)]
        .map((part) => Number.parseInt(part, 16) / 255)
    };
  }
  return null;
}

function xcolorNaturalColorSpec(name) {
  return copyColorSpec(XCOLOR_NATURAL_COLOR_SPECS, name);
}

function dvipsColorSpec(name) {
  return copyColorSpec(DVIPS_COLOR_SPECS, name);
}

function copyColorSpec(palette, name) {
  if (!Object.hasOwn(palette, name)) return null;
  const spec = palette[name];
  return { model: spec.model, channels: [...spec.channels] };
}

function mixChannels(base, target, amount) {
  const clamped = Math.max(0, Math.min(1, amount));
  return base.map((channel, index) => channel * clamped + target[index] * (1 - clamped));
}

export function convertColorSpec(spec, targetModel) {
  if (spec.model === targetModel) return { model: targetModel, channels: [...spec.channels] };
  const rgb = xcolorSpecToRgb(spec);
  if (targetModel === "rgb") return { model: "rgb", channels: rgb };
  if (targetModel === "gray") {
    return { model: "gray", channels: [0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]] };
  }
  const cmy = rgb.map((channel) => 1 - channel);
  const k = Math.min(...cmy);
  return { model: "cmyk", channels: [...cmy.map((channel) => channel - k), k] };
}

function xcolorSpecToRgb(spec) {
  if (spec.model === "rgb") return [...spec.channels];
  if (spec.model === "gray") return [spec.channels[0], spec.channels[0], spec.channels[0]];
  const [c, m, y, k] = spec.channels;
  return [c, m, y].map((channel) => 1 - Math.min(1, channel + k));
}

export function colorSpecToRgb(spec) {
  if (spec.model === "cmyk") return cmykToRgb(spec.channels);
  return xcolorSpecToRgb(spec);
}

function colorSpecToCss(spec) {
  return rgbToCss(colorSpecToRgb(spec).map((channel) => channel * 255));
}

// pdf2svg uses Poppler's DeviceCMYK matrix. Matching it keeps browser SVG
// colors aligned with the local tikztosvg reference rather than a naive mix.
export function cmykToRgb(channels) {
  const [c, m, y, k] = channels.map((channel) => Math.max(0, Math.min(1, Number(channel) || 0)));
  const c1 = 1 - c;
  const m1 = 1 - m;
  const y1 = 1 - y;
  const k1 = 1 - k;
  let r = c1 * m1 * y1 * k1;
  let g = r;
  let b = r;
  let x = c1 * m1 * y1 * k;
  r += 0.1373 * x; g += 0.1216 * x; b += 0.1255 * x;
  x = c1 * m1 * y * k1;
  r += x; g += 0.949 * x;
  x = c1 * m1 * y * k;
  r += 0.1098 * x; g += 0.102 * x;
  x = c1 * m * y1 * k1;
  r += 0.9255 * x; b += 0.549 * x;
  x = c1 * m * y1 * k;
  r += 0.1412 * x;
  x = c1 * m * y * k1;
  r += 0.9294 * x; g += 0.1098 * x; b += 0.1412 * x;
  x = c1 * m * y * k;
  r += 0.1333 * x;
  x = c * m1 * y1 * k1;
  g += 0.6784 * x; b += 0.9373 * x;
  x = c * m1 * y1 * k;
  g += 0.0588 * x; b += 0.1412 * x;
  x = c * m1 * y * k1;
  g += 0.651 * x; b += 0.3137 * x;
  x = c * m1 * y * k;
  g += 0.0745 * x;
  x = c * m * y1 * k1;
  r += 0.1804 * x; g += 0.1922 * x; b += 0.5725 * x;
  x = c * m * y1 * k;
  b += 0.0078 * x;
  x = c * m * y * k1;
  r += 0.2118 * x; g += 0.2119 * x; b += 0.2235 * x;
  return [r, g, b].map((channel) => Math.max(0, Math.min(1, channel)));
}

export function cmykToCss(channels) {
  return rgbToCss(cmykToRgb(channels).map((channel) => channel * 255));
}

function rgbToCss(rgb) {
  return `rgb(${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))).join(" ")})`;
}
