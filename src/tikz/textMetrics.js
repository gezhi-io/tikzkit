import {
  isMathFallbackRelationSymbol,
  mathFallbackOperatorMuAt,
  mathFallbackText,
  normalizeBrowserMathMacros,
  readDollarMathSpan,
  replaceTikzHspaceMarkers,
  stripTikzHspaceMarkers
} from "./text.js";
import { parseExtensibleMathArrow } from "./mathArrows.js";
import { parseInlineMathMatrix } from "./mathMatrixSyntax.js";
import { parseInlinePlotReferenceSample } from "./plotReferenceSamples.js";
import { fontSpecFromSizeCommand } from "../tex/fontSpec.js";

const TEX_PT_PER_CM = 28.45274;
const ENGLISH_LEFT_HYPHEN_MIN = 2;
const ENGLISH_RIGHT_HYPHEN_MIN = 3;
const EXTENSIBLE_ARROW_MIN_WIDTH_PT = 10.90817;
const EXTENSIBLE_ARROW_END_ALLOWANCE_PT = 0.99;
const EXTENSIBLE_ARROW_UPPER_GAP_PT = 6.66873;
const EXTENSIBLE_ARROW_LOWER_GAP_PT = 2.66666;
const EXTENSIBLE_ARROW_SUPERSCRIPT_HEIGHT_PT = 8.14003;
const EXTENSIBLE_ARROW_DOUBLE_STRUCK_CORRECTION_PT = 2.93;

// KaTeX Main-Regular generated TFM data, reduced to printable plain-text glyphs.
// Each entry is [width, height, depth] in em units.
const MAIN_REGULAR_TEX_METRICS = {
  " ": [0.25, 0, 0],
  "!": [0.27778, 0.69444, 0],
  "\"": [0.5, 0.69444, 0],
  "#": [0.83334, 0.69444, 0.19444],
  "$": [0.5, 0.75, 0.05556],
  "%": [0.83334, 0.75, 0.05556],
  "&": [0.77778, 0.69444, 0],
  "'": [0.27778, 0.69444, 0],
  "(": [0.38889, 0.75, 0.25],
  ")": [0.38889, 0.75, 0.25],
  "*": [0.5, 0.75, 0],
  "+": [0.77778, 0.58333, 0.08333],
  ",": [0.27778, 0.10556, 0.19444],
  "-": [0.33333, 0.43056, 0],
  ".": [0.27778, 0.10556, 0],
  "/": [0.5, 0.75, 0.25],
  "0": [0.5, 0.64444, 0],
  "1": [0.5, 0.64444, 0],
  "2": [0.5, 0.64444, 0],
  "3": [0.5, 0.64444, 0],
  "4": [0.5, 0.64444, 0],
  "5": [0.5, 0.64444, 0],
  "6": [0.5, 0.64444, 0],
  "7": [0.5, 0.64444, 0],
  "8": [0.5, 0.64444, 0],
  "9": [0.5, 0.64444, 0],
  "−": [0.77778, 0.58333, 0.08333],
  ":": [0.27778, 0.43056, 0],
  ";": [0.27778, 0.43056, 0.19444],
  "<": [0.77778, 0.5391, 0.0391],
  "=": [0.77778, 0.36687, -0.13313],
  ">": [0.77778, 0.5391, 0.0391],
  "?": [0.47222, 0.69444, 0],
  "@": [0.77778, 0.69444, 0],
  A: [0.75, 0.68333, 0],
  B: [0.70834, 0.68333, 0],
  C: [0.72222, 0.68333, 0],
  D: [0.76389, 0.68333, 0],
  E: [0.68056, 0.68333, 0],
  F: [0.65278, 0.68333, 0],
  G: [0.78472, 0.68333, 0],
  H: [0.75, 0.68333, 0],
  I: [0.36111, 0.68333, 0],
  J: [0.51389, 0.68333, 0],
  K: [0.77778, 0.68333, 0],
  L: [0.625, 0.68333, 0],
  M: [0.91667, 0.68333, 0],
  N: [0.75, 0.68333, 0],
  O: [0.77778, 0.68333, 0],
  P: [0.68056, 0.68333, 0],
  Q: [0.77778, 0.68333, 0.19444],
  R: [0.73611, 0.68333, 0],
  S: [0.55556, 0.68333, 0],
  T: [0.72222, 0.68333, 0],
  U: [0.75, 0.68333, 0],
  V: [0.75, 0.68333, 0],
  W: [1.02778, 0.68333, 0],
  X: [0.75, 0.68333, 0],
  Y: [0.75, 0.68333, 0],
  Z: [0.61111, 0.68333, 0],
  "[": [0.27778, 0.75, 0.25],
  "\\": [0.5, 0.75, 0.25],
  "]": [0.27778, 0.75, 0.25],
  "^": [0.5, 0.69444, 0],
  _: [0.5, 0.12056, 0.31],
  a: [0.5, 0.43056, 0],
  b: [0.55556, 0.69444, 0],
  c: [0.44445, 0.43056, 0],
  d: [0.55556, 0.69444, 0],
  e: [0.44445, 0.43056, 0],
  f: [0.30556, 0.69444, 0],
  g: [0.5, 0.43056, 0.19444],
  h: [0.55556, 0.69444, 0],
  i: [0.27778, 0.66786, 0],
  j: [0.30556, 0.66786, 0.19444],
  k: [0.52778, 0.69444, 0],
  l: [0.27778, 0.69444, 0],
  m: [0.83334, 0.43056, 0],
  n: [0.55556, 0.43056, 0],
  o: [0.5, 0.43056, 0],
  p: [0.55556, 0.43056, 0.19444],
  q: [0.52778, 0.43056, 0.19444],
  r: [0.39167, 0.43056, 0],
  s: [0.39445, 0.43056, 0],
  t: [0.38889, 0.61508, 0],
  u: [0.55556, 0.43056, 0],
  v: [0.52778, 0.43056, 0],
  w: [0.72222, 0.43056, 0],
  x: [0.52778, 0.43056, 0],
  y: [0.52778, 0.43056, 0.19444],
  z: [0.44445, 0.43056, 0],
  "{": [0.5, 0.75, 0.25],
  "|": [0.27778, 0.75, 0.25],
  "}": [0.5, 0.75, 0.25],
  "~": [0.5, 0.31786, 0.35]
};

// phvr7t.tfm (Helvetica Roman, T1 encoding), reduced to numeric tick-label
// glyphs. PGFPlots' sansmath examples use this font for plain axis ticks.
// Each entry is [width, height, depth] in em units.
const SANS_REGULAR_TEX_METRICS = {
  " ": [0.27799, 0, 0],
  "+": [0.583997, 0.502497, 0],
  ",": [0.27799, 0.105994, 0.146997],
  "-": [0.332996, 0.3174925, 0],
  ".": [0.27799, 0.105994, 0],
  "0": [0.555994, 0.704492, 0.016492],
  "1": [0.555994, 0.704492, 0],
  "2": [0.555994, 0.704492, 0],
  "3": [0.555994, 0.704492, 0.016492],
  "4": [0.555994, 0.704492, 0],
  "5": [0.555994, 0.685992, 0.016492],
  "6": [0.555994, 0.704492, 0.016492],
  "7": [0.555994, 0.685992, 0],
  "8": [0.555994, 0.704492, 0.016492],
  "9": [0.555994, 0.704492, 0.016492],
  "−": [0.583997, 0.502497, 0]
};

// KaTeX's generated Computer Modern Math Italic TFM data, reduced to ASCII
// letters. Each entry is [width, height, depth] in em units. Math-mode digits
// and punctuation continue to use Main-Regular, just as TeX assigns them to
// family 0 while ordinary Latin math letters come from family 1.
const MATH_ITALIC_TEX_METRICS = {
  A: [0.75, 0.68333, 0], B: [0.75851, 0.68333, 0], C: [0.71472, 0.68333, 0],
  D: [0.82792, 0.68333, 0], E: [0.7382, 0.68333, 0], F: [0.64306, 0.68333, 0],
  G: [0.78625, 0.68333, 0], H: [0.83125, 0.68333, 0], I: [0.43958, 0.68333, 0],
  J: [0.55451, 0.68333, 0], K: [0.84931, 0.68333, 0], L: [0.68056, 0.68333, 0],
  M: [0.97014, 0.68333, 0], N: [0.80347, 0.68333, 0], O: [0.76278, 0.68333, 0],
  P: [0.64201, 0.68333, 0], Q: [0.79056, 0.68333, 0.19444], R: [0.75929, 0.68333, 0],
  S: [0.6132, 0.68333, 0], T: [0.58438, 0.68333, 0], U: [0.68278, 0.68333, 0],
  V: [0.58333, 0.68333, 0], W: [0.94445, 0.68333, 0], X: [0.82847, 0.68333, 0],
  Y: [0.58056, 0.68333, 0], Z: [0.68264, 0.68333, 0],
  a: [0.52859, 0.43056, 0], b: [0.42917, 0.69444, 0], c: [0.43276, 0.43056, 0],
  d: [0.52049, 0.69444, 0], e: [0.46563, 0.43056, 0], f: [0.48959, 0.69444, 0.19444],
  g: [0.47697, 0.43056, 0.19444], h: [0.57616, 0.69444, 0], i: [0.34451, 0.65952, 0],
  j: [0.41181, 0.65952, 0.19444], k: [0.5206, 0.69444, 0], l: [0.29838, 0.69444, 0],
  m: [0.87801, 0.43056, 0], n: [0.60023, 0.43056, 0], o: [0.48472, 0.43056, 0],
  p: [0.50313, 0.43056, 0.19444], q: [0.44641, 0.43056, 0.19444], r: [0.45116, 0.43056, 0],
  s: [0.46875, 0.43056, 0], t: [0.36111, 0.61508, 0], u: [0.57246, 0.43056, 0],
  v: [0.48472, 0.43056, 0], w: [0.71592, 0.43056, 0], x: [0.57153, 0.43056, 0],
  y: [0.49028, 0.43056, 0.19444], z: [0.46505, 0.43056, 0]
};

// Reduced Computer Modern math-symbol metrics used by formulas that mix
// math-italic letters with upright delimiters and relation glyphs.
const MATH_FALLBACK_SYMBOL_TEX_METRICS = {
  "Ω": [0.72222, 0.68333, 0],
  "∇": [0.83333, 0.68333, 0],
  "ϵ": [0.4059, 0.43056, 0],
  "{": [0.5, 0.75, 0.25],
  "}": [0.5, 0.75, 0.25],
  "|": [0.27778, 0.75, 0.25],
  "∥": [0.5, 0.75, 0.25],
  "≤": [0.77778, 0.63597, 0.13597],
  "≥": [0.77778, 0.63597, 0.13597],
  "≠": [0.77778, 0.71667, 0.21667]
};

// cmmib10.tfm from the local MacTeX 2025 installation. Math-version bold
// selects these glyphs for ordinary Latin math atoms.
const MATH_BOLD_ITALIC_TEX_METRICS = {
  A: [0.86944, 0.686111, 0], B: [0.866404, 0.686111, 0], C: [0.81694, 0.686111, 0],
  D: [0.938121, 0.686111, 0], E: [0.810066, 0.686111, 0], F: [0.688886, 0.686111, 0],
  G: [0.886732, 0.686111, 0], H: [0.982287, 0.686111, 0], I: [0.51111, 0.686111, 0],
  J: [0.631248, 0.686111, 0], K: [0.971176, 0.686111, 0], L: [0.755551, 0.686111, 0],
  M: [1.142009, 0.686111, 0], N: [0.950343, 0.686111, 0], O: [0.836662, 0.686111, 0],
  P: [0.723088, 0.686111, 0], Q: [0.868607, 0.686111, 0.194445], R: [0.87235, 0.686111, 0],
  S: [0.692706, 0.686111, 0], T: [0.636627, 0.686111, 0], U: [0.800275, 0.686111, 0],
  V: [0.677775, 0.686111, 0], W: [1.093051, 0.686111, 0], X: [0.947218, 0.686111, 0],
  Y: [0.674579, 0.686111, 0], Z: [0.772566, 0.686111, 0],
  a: [0.632868, 0.444445, 0], b: [0.52083, 0.694445, 0], c: [0.513423, 0.444445, 0],
  d: [0.60972, 0.694445, 0], e: [0.553609, 0.444445, 0], f: [0.568057, 0.694445, 0.194445],
  g: [0.544904, 0.444445, 0.194445], h: [0.66759, 0.694445, 0], i: [0.404796, 0.693255, 0],
  j: [0.470833, 0.693255, 0.194445], k: [0.603702, 0.694445, 0], l: [0.348147, 0.694445, 0],
  m: [1.032404, 0.444445, 0], n: [0.712961, 0.444445, 0], o: [0.584719, 0.444445, 0],
  p: [0.600924, 0.444445, 0.194445], q: [0.542127, 0.444445, 0.194445], r: [0.528704, 0.444445, 0],
  s: [0.53125, 0.444445, 0], t: [0.415276, 0.634921, 0], u: [0.681017, 0.444445, 0],
  v: [0.566664, 0.444445, 0], w: [0.831479, 0.444445, 0], x: [0.659027, 0.444445, 0],
  y: [0.590276, 0.444445, 0.194445], z: [0.555092, 0.444445, 0]
};

// cmbx10.tfm values used by digits, punctuation, delimiters, relations, and
// binary operators in bold math. Letters still come from cmmib10 above.
const MAIN_BOLD_TEX_METRICS = {
  "(": [0.44722, 0.75, 0.25],
  ")": [0.44722, 0.75, 0.25],
  "*": [0.574997, 0.75, 0],
  "+": [0.89444, 0.633331, 0.133331],
  ",": [0.319443, 0.155556, 0.194445],
  "-": [0.383331, 0.444445, 0],
  ".": [0.319443, 0.155556, 0],
  "/": [0.574997, 0.75, 0.25],
  "0": [0.574997, 0.644444, 0],
  "1": [0.574997, 0.644444, 0],
  "2": [0.574997, 0.644444, 0],
  "3": [0.574997, 0.644444, 0],
  "4": [0.574997, 0.644444, 0],
  "5": [0.574997, 0.644444, 0],
  "6": [0.574997, 0.644444, 0],
  "7": [0.574997, 0.644444, 0],
  "8": [0.574997, 0.644444, 0],
  "9": [0.574997, 0.644444, 0],
  "−": [0.89444, 0.633331, 0.133331],
  ":": [0.319443, 0.444445, 0],
  ";": [0.319443, 0.444445, 0.194445],
  "<": [0.349998, 0.5, 0.194445],
  "=": [0.89444, 0.391111, -0.108889],
  ">": [0.543053, 0.5, 0.194445]
};

// TeX math-list spacing and italic correction make these boxes differ from a
// raw sum of TFM advances. Values are measured from the local MacTeX engine at
// 10pt and then scaled by the resolved FontSpec.
const SIMPLE_BOLD_ASCII_FORMULA_METRICS_PT = {
  x: [6.59027, 4.44445, 0],
  "f(x)": [31.85995 / 1.44, 7.5, 2.5]
};

const CMR10_WIDTH_PT = {
  " ": 3.333,
  "!": 2.778,
  "\"": 5,
  "#": 8.333,
  "$": 5,
  "%": 8.333,
  "&": 7.778,
  "'": 2.778,
  "(": 3.889,
  ")": 3.889,
  "*": 5,
  "+": 7.778,
  ",": 2.778,
  "-": 3.333,
  ".": 2.778,
  "/": 5,
  "0": 5,
  "1": 5,
  "2": 5,
  "3": 5,
  "4": 5,
  "5": 5,
  "6": 5,
  "7": 5,
  "8": 5,
  "9": 5,
  ":": 2.778,
  ";": 2.778,
  "<": 7.778,
  "=": 7.778,
  "≈": 7.778,
  ">": 7.778,
  "?": 4.722,
  "@": 7.778,
  A: 7.5,
  B: 7.083,
  C: 7.222,
  D: 7.639,
  E: 6.806,
  F: 6.528,
  G: 7.847,
  H: 7.5,
  I: 3.611,
  J: 5.139,
  K: 7.778,
  L: 6.25,
  M: 9.167,
  N: 7.5,
  O: 7.778,
  P: 6.806,
  Q: 7.778,
  R: 7.361,
  S: 5.556,
  T: 7.222,
  U: 7.5,
  V: 7.5,
  W: 10.278,
  X: 7.5,
  Y: 7.5,
  Z: 6.111,
  "[": 2.778,
  "\\": 5,
  "]": 2.778,
  "^": 5,
  "_": 5,
  "`": 2.778,
  a: 5,
  b: 5.556,
  c: 4.444,
  d: 5.556,
  e: 4.444,
  f: 3.056,
  g: 5,
  h: 5.556,
  i: 2.778,
  j: 3.056,
  k: 5.278,
  l: 2.778,
  m: 8.333,
  n: 5.556,
  o: 5,
  p: 5.556,
  q: 5.278,
  r: 3.922,
  s: 3.944,
  t: 3.889,
  u: 5.556,
  v: 5.278,
  w: 7.222,
  x: 5.278,
  y: 5.278,
  z: 4.444,
  "{": 5,
  "|": 2.778,
  "}": 5,
  "~": 5,
  // AMSa/AMSb advances measured from the local TeX Live 2025 engine at
  // 10pt. These glyphs otherwise fall through to the generic 5pt fallback.
  "∅": 7.778,
  "⩽": 7.778,
  "⩾": 7.778,
  "≰": 7.778,
  "≱": 7.778,
  "⊈": 7.778,
  "⊉": 7.778,
  "⇝": 10,
  "∴": 6.667,
  "∵": 6.667
};

// cmr10.afm kerning pairs from the local MacTeX 2025 installation. TeX
// applies these adjustments after advancing each glyph; summing widths alone
// makes ordinary labels measurably too wide (for example, "Wahlbeteiligung"
// contains both the negative Wa kern and the positive be kern).
const CMR10_KERNING_EM = Object.freeze(Object.fromEntries([
  [-0.111, ["AW", "AV", "FA", "LW", "LV", "RW", "RV", "VA", "WA"]],
  [-0.083, [
    "AY", "AT", "Fa", "Fr", "Fu", "Fe", "Fo", "LY", "LT", "P,", "P.", "PA",
    "RY", "RT", "Tu", "TA", "Ta", "Tr", "To", "Te", "Va", "Vr", "Vu", "Ve",
    "Vo", "Wa", "Wr", "Wu", "We", "Wo", "Yu", "YA", "Ya", "Yr", "Yo", "Ye",
    "y,", "y."
  ]],
  [-0.027, [
    "AQ", "AU", "AG", "AO", "AC", "At", "DY", "DV", "DA", "DW", "DX", "FQ",
    "FG", "FC", "FO", "KQ", "KG", "KC", "KO", "OY", "OV", "OA", "OW", "OX",
    "Pa", "Pe", "Po", "RQ", "RU", "RG", "RO", "RC", "Rt", "Ty", "VQ", "VG",
    "VC", "VO", "WQ", "WG", "WC", "WO", "XQ", "XG", "XC", "XO", "aw", "ay",
    "av", "bw", "by", "bv", "bx", "ck", "ch", "hw", "hv", "hy", "hb", "hu",
    "ht", "kc", "ko", "ke", "ka", "mw", "mv", "my", "mb", "mu", "mt", "nw",
    "nv", "ny", "nb", "nu", "nt", "ow", "oy", "ov", "ox", "pw", "py", "pv",
    "px", "tw", "ty", "uw", "vc", "vo", "ve", "va", "wc", "wo", "wa", "we",
    "ya", "ye", "yo"
  ]],
  [0.027, ["II", "bq", "bc", "bd", "bo", "be", "gj", "oq", "oc", "od", "oo", "oe", "pq", "pc", "pd", "po", "pe"]],
  [0.055, ["aj", "bj", "oj", "pj"]],
  [0.077, ["f]", "f)", "f!", "f?", "f'"]],
  [0.111, ["'!", "'?"]]
].flatMap(([kern, pairs]) => pairs.map((pair) => [pair, kern]))));

const SCRIPT_CHAR_PATTERN =
  /[₀₁₂₃₄₅₆₇₈₉ₐᵦₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ₊₋₌₍₎⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]/u;
const WIDE_MATH_ALPHA_CHARS = new Set([...("𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵")]);
const ZERO_WIDTH_MATH_ACCENTS = new Set(["\u20d7", "\u0302", "\u0303", "\u0304"]);
const TALL_MATH_ACCENT_BASES = new Set(["b", "d", "f", "h", "k", "l", "t"]);
const SCRIPT_TOKEN_WIDTH_PT = 3.2;
const GREEK_SCRIPT_TOKEN_WIDTH_PT = 4.5;
const SIMPLE_GLYPH_FORMULA_METRICS = {
  "x^2+y^2=1": {
    widthPt: 50.9,
    heightPt: 8.73,
    depthPt: 1.75
  }
};

const MATH_BINARY_SYMBOLS = new Set(["+", "-", "*"]);

// Computer Modern selects design-size TFM files for the standard LaTeX text
// sizes. The figures below were measured from local TeX Live 2025 cmr/cmmi/
// cmsy/cmex output. \arraycolsep is a 5pt register, so its pairwise 10pt
// matrix gap does not scale with \scriptsize or \tiny.
const INLINE_MATRIX_DESIGN_METRICS_PT = new Map([
  [5, {
    italicScale: 1.381501,
    relationScale: 1.321422,
    digitScale: 1.361132,
    fiveMu: 2.04476,
    delimiter: 4.23366,
    // CMMI5/CMSY5 advances include the math italic correction where TeX
    // applies it at the end of an atom. These are not linear 10pt scales.
    mathAdvancePt: { U: 5.2646, "+": 5.13898, "-": 5.41673 }
  }],
  [7, { italicScale: 1.145509, relationScale: 1.127522, digitScale: 1.138895, fiveMu: 2.27624, delimiter: 5.92712 }],
  [8, { italicScale: 1.061127, relationScale: 1.062484, digitScale: 1.062515, fiveMu: 2.36115, delimiter: 6.25704 }],
  [9, {
    italicScale: 1.027563,
    relationScale: 1.027742,
    digitScale: 1.027771,
    fiveMu: 2.56943,
    delimiter: 6.80896,
    // Direct cmmi9/cmsy9/cmr9 advances measured from local MacTeX 2025.
    mathAdvancePt: {
      A: 6.93605,
      b: 3.96387,
      x: 5.24304,
      "Ω": 6.68051,
      "ϵ": 4.29405,
      "{": 4.62497,
      "}": 4.62497,
      "|": 2.56943,
      "∥": 4.62497,
      ":": 2.56943,
      "=": 7.1944,
      "-": 7.1944,
      "≤": 7.1944,
      "≥": 7.1944
    }
  }],
  [10, { italicScale: 1, relationScale: 1, digitScale: 1, fiveMu: 2.77778, delimiter: 7.36116 }]
]);

export function parseMathText(value) {
  const text = String(value).trim();
  const dollar = readDollarMathSpan(text, 0);
  if (dollar && dollar.end === text.length) return parsedMathText(dollar.tex, dollar.displayMode);
  const displayBracket = text.match(/^\\\[([\s\S]+)\\\]$/);
  if (displayBracket) return parsedMathText(displayBracket[1], true);
  const inlineParen = text.match(/^\\\(([\s\S]+)\\\)$/);
  if (inlineParen) return parsedMathText(inlineParen[1], false);
  return null;
}

export function estimateFormulaBox(tex, options = {}) {
  const displayMode = Boolean(options.displayMode);
  const normalized = leadingMathFontSize(normalizeBrowserMathMacros(tex));
  const optionScale = Number(options.scale) > 0 ? Number(options.scale) : 1;
  const scale = optionScale * normalized.scale;
  const baseMinWidth = Number.isFinite(options.minWidth) ? options.minWidth : displayMode ? 0.72 : 0.42;
  const minWidth = baseMinWidth * scale;
  const metric = {
    widthFactor: Number.isFinite(options.widthFactor) ? options.widthFactor : 0.16,
    widthPadding: Number.isFinite(options.widthPadding) ? options.widthPadding : 0.35 * scale,
    texTextMetrics: Boolean(options.texTextMetrics),
    mathVersion: options.mathVersion === "bold" ? "bold" : "normal"
  };
  const compact = estimateFormulaParts(normalized.tex, scale, metric);
  const displayScale = displayMode ? 1.12 : 1;
  return {
    width: round(Math.max(minWidth, compact.width * displayScale)),
    height: round(compact.height * displayScale),
    depth: round(compact.depth * displayScale)
  };
}

function parsedMathText(tex, displayMode) {
  const normalized = leadingMathFontSize(normalizeBrowserMathMacros(tex));
  return {
    tex: normalized.tex,
    displayMode,
    scale: normalized.scale,
    explicitFontSize: normalized.explicitFontSize
  };
}

function leadingMathFontSize(tex) {
  let text = String(tex || "").trim();
  let scale = 1;
  let explicitFontSize = null;

  const group = text.startsWith("{") ? readBalanced(text, 0, "{", "}") : null;
  if (group && group.end === text.length) {
    const inner = leadingMathFontSize(group.content);
    if (inner.scale !== 1 || inner.explicitFontSize) return inner;
  }

  let changed = true;
  while (changed) {
    changed = false;
    const match = text.match(/^\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)(?![A-Za-z])\s*/);
    if (match) {
      const nextScale = fontSpecFromSizeCommand(`\\${match[1]}`).sizePt / 10;
      scale = nextScale;
      explicitFontSize = match[1];
      text = text.slice(match[0].length).trim();
      changed = true;
    }
  }

  return { tex: text, scale, explicitFontSize };
}

export function formulaTotalHeight(box) {
  return (box?.height || 0) + (box?.depth || 0);
}

export function effectiveMathFontScale(tex, scale = 1) {
  const factor = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
  // Standard inline matrices select their own Computer Modern design font in
  // inlineMathMatrixLayoutCm. Do not apply the retired empirical matrix blend.
  return factor;
}

export function hasMatrixEnvironmentTex(tex) {
  return /\\begin\s*\{(?:matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|array|cases)\*?\}/.test(String(tex || ""));
}

export function mathTextMetricUnits(line) {
  const chars = [...String(line || "").trim()];
  let units = 0;
  let scriptMode = null;
  for (const char of chars) {
    if (ZERO_WIDTH_MATH_ACCENTS.has(char)) continue;
    if (char === "^") {
      scriptMode = "super";
      units += 0.1;
      continue;
    }
    if (char === "_") {
      scriptMode = "sub";
      units += 0.1;
      continue;
    }
    if (SCRIPT_CHAR_PATTERN.test(char)) {
      units += 0.45;
      continue;
    }
    if (WIDE_MATH_ALPHA_CHARS.has(char)) {
      units += 2.05;
      continue;
    }
    if (scriptMode) {
      if (/\s/.test(char)) {
        scriptMode = null;
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

export function texTextWidthCm(line, scale = 1) {
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  let widthPt = relativeTikzHspaceWidthPt(line);
  const chars = [...stripTikzHspaceMarkers(line)];
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (char === "\u00ad") continue;
    if (ZERO_WIDTH_MATH_ACCENTS.has(char)) continue;
    if (char === "_" || char === "^") {
      const consumed = consumeFallbackScriptWidth(chars, index + 1);
      if (consumed) {
        widthPt += consumed.widthPt;
        index += consumed.count;
        continue;
      }
    }
    widthPt += CMR10_WIDTH_PT[char] ?? (SCRIPT_CHAR_PATTERN.test(char) ? 3.2 : WIDE_MATH_ALPHA_CHARS.has(char) ? 8.2 : 5);
  }
  return (widthPt / TEX_PT_PER_CM) * factor;
}

function relativeTikzHspaceWidthPt(value, emSizePt = 10) {
  let widthPt = 0;
  replaceTikzHspaceMarkers(value, (dimension) => {
    const match = String(dimension || "").trim().match(/^([-+]?[0-9.]+)\s*(em|ex)$/);
    if (!match) return "";
    const amount = Number(match[1]);
    if (Number.isFinite(amount)) widthPt += amount * emSizePt * (match[2] === "em" ? 1 : 0.430554);
    return "";
  });
  return widthPt;
}

export function wrapTeXTextLineByWidth(line, maxWidthCm, scale = 1, options = {}) {
  const text = String(line || "").trim();
  const limit = Number(maxWidthCm);
  if (!text || !Number.isFinite(limit) || limit <= 0) return [stripDiscretionaryHyphens(text)];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return splitOverfullDiscretionaryWords(words, limit, scale, 1.02);
  if (options.lineBreakMode === "flush") return wrapTeXWordsFlush(words.map(stripDiscretionaryHyphens), limit, scale);
  const centeredParagraph = options.lineBreakMode === "center";
  const tolerance = Number.isFinite(Number(options.overfullTolerance))
    ? Math.max(1, Number(options.overfullTolerance))
    : centeredParagraph
      ? 1
      : 1.02;
  const lastLineWeight = Number.isFinite(Number(options.lastLineWeight))
    ? Math.max(0, Number(options.lastLineWeight))
    : centeredParagraph
      ? 1
      : 0.05;
  const best = Array.from({ length: words.length + 1 }, () => ({ cost: Infinity, next: words.length }));
  best[words.length] = { cost: 0, next: words.length };
  for (let start = words.length - 1; start >= 0; start -= 1) {
    for (let end = start; end < words.length; end += 1) {
      const candidate = words.slice(start, end + 1).join(" ");
      const width = texTextWidthCm(candidate, scale);
      if (width > limit * tolerance && end > start) break;
      const isLast = end === words.length - 1;
      const overfull = Math.max(0, width - limit);
      const remaining = Math.max(0, limit - width);
      const lineCost = overfull > 0
        ? overfull * overfull * 70
        : remaining * remaining * (isLast ? lastLineWeight : 1);
      const cost = lineCost + best[end + 1].cost;
      if (cost < best[start].cost) best[start] = { cost, next: end + 1 };
    }
  }
  const lines = [];
  for (let cursor = 0; cursor < words.length;) {
    const next = Math.max(cursor + 1, Math.min(words.length, best[cursor].next));
    lines.push(words.slice(cursor, next).join(" "));
    cursor = next;
  }
  const discretionaryLines = splitOverfullDiscretionaryLines(lines, limit, scale, tolerance);
  // A manually declared TeX breakpoint outranks our fallback English
  // hyphenator. Re-hyphenating its suffix would turn `pro\\-gramming` into
  // unrelated fragments such as `gram-` and `ming`.
  if (text.includes("\u00ad") || options.hyphenate === false) return discretionaryLines;
  return applyConservativeEnglishHyphenation(discretionaryLines, limit, scale, tolerance);
}

function splitOverfullDiscretionaryWords(words, maxWidthCm, scale, tolerance) {
  return splitOverfullDiscretionaryLines([words.join(" ")], maxWidthCm, scale, tolerance);
}

function splitOverfullDiscretionaryLines(lines, maxWidthCm, scale, tolerance) {
  const expanded = [];
  for (const sourceLine of lines) {
    let current = [];
    for (const rawWord of String(sourceLine || "").split(/\s+/).filter(Boolean)) {
      const pieces = discretionaryWordPieces(rawWord, maxWidthCm, scale, tolerance);
      if (pieces.length === 1) {
        current.push(pieces[0]);
        continue;
      }
      if (current.length) expanded.push(current.join(" "));
      expanded.push(...pieces.slice(0, -1));
      current = [pieces.at(-1)];
    }
    if (current.length) expanded.push(current.join(" "));
  }
  return expanded;
}

function discretionaryWordPieces(rawWord, maxWidthCm, scale, tolerance) {
  const word = String(rawWord || "");
  const plain = stripDiscretionaryHyphens(word);
  if (!word.includes("\u00ad") || texTextWidthCm(plain, scale) <= maxWidthCm * tolerance) return [plain];
  const parts = word.split("\u00ad");
  for (let index = parts.length - 1; index >= 1; index -= 1) {
    const prefix = `${parts.slice(0, index).join("")}-`;
    const suffix = parts.slice(index).join("");
    if (suffix && texTextWidthCm(prefix, scale) <= maxWidthCm * tolerance) return [prefix, suffix];
  }
  return [plain];
}

function stripDiscretionaryHyphens(value) {
  return String(value || "").replace(/\u00ad/g, "");
}

function applyConservativeEnglishHyphenation(lines, maxWidthCm, scale, tolerance) {
  const wrapped = lines
    .map((line) => String(line || "").trim().split(/\s+/).filter(Boolean))
    .filter((words) => words.length);
  if (wrapped.length < 2) return wrapped.map((words) => words.join(" "));

  let introducedHyphenation = false;
  for (let lineIndex = 0; lineIndex < wrapped.length - 1; lineIndex += 1) {
    const current = wrapped[lineIndex];
    const following = wrapped[lineIndex + 1];
    const nextWord = following[0];
    const split = longestHyphenationThatFits(current, nextWord, maxWidthCm, scale, tolerance);
    if (!split) continue;
    current.push(split.prefix);
    following[0] = split.suffix;
    introducedHyphenation = true;
  }
  if (!introducedHyphenation) return wrapped.map((words) => words.join(" "));

  // TeX repacks subsequent words after inserting a discretionary hyphen. Keep the
  // existing balanced breaks unless a whole word now fits into the preceding line.
  for (let lineIndex = 1; lineIndex < wrapped.length - 1; lineIndex += 1) {
    const current = wrapped[lineIndex];
    const following = wrapped[lineIndex + 1];
    while (following.length && lineFitsWidth([...current, following[0]], maxWidthCm, scale, tolerance)) {
      current.push(following.shift());
    }
  }
  return wrapped.filter((words) => words.length).map((words) => words.join(" "));
}

function longestHyphenationThatFits(previousWords, word, maxWidthCm, scale, tolerance) {
  if (lineFitsWidth([...previousWords, word], maxWidthCm, scale, tolerance)) return null;
  const candidates = englishHyphenationCandidates(word);
  for (const candidate of candidates) {
    if (lineFitsWidth([...previousWords, candidate.prefix], maxWidthCm, scale, tolerance)) return candidate;
  }
  return null;
}

function lineFitsWidth(words, maxWidthCm, scale, tolerance) {
  return texTextWidthCm(words.join(" "), scale) <= maxWidthCm * tolerance;
}

// This is deliberately a small fallback rather than a dictionary-backed TeX
// hyphenation engine. Renderers use it only to recover a safe, visible split
// when a fixed-width paragraph can retain a useful word prefix on the prior
// line.
export function englishHyphenationCandidates(rawWord) {
  const match = String(rawWord || "").match(/^([A-Za-z]+)([),.;:!?]*)$/);
  if (!match) return [];
  const [, original, trailingPunctuation] = match;
  if (
    original.length < ENGLISH_LEFT_HYPHEN_MIN + ENGLISH_RIGHT_HYPHEN_MIN ||
    /^[A-Z]{2,}$/.test(original)
  ) {
    return [];
  }
  const word = original.toLowerCase();
  const points = new Set();
  for (let index = ENGLISH_LEFT_HYPHEN_MIN; index <= word.length - ENGLISH_RIGHT_HYPHEN_MIN; index += 1) {
    const before = word[index - 1];
    const beforeBefore = word[index - 2];
    const after = word[index];
    const afterAfter = word[index + 1];
    if (englishDigraph(before, after)) continue;
    if (isEnglishVowel(before) && isEnglishConsonant(after) && isEnglishVowel(afterAfter)) {
      points.add(`${index}:1`);
    }
    if (
      isEnglishVowel(beforeBefore) &&
      isEnglishConsonant(before) &&
      isEnglishConsonant(after) &&
      isEnglishVowel(afterAfter)
    ) {
      // A VCCV boundary (for example Or|dering) is a stronger English
      // syllable boundary than a later VCV candidate in the same word.
      points.add(`${index}:2`);
    }
  }
  return [...points]
    .map((point) => {
      const [index, priority] = point.split(":").map(Number);
      return { index, priority };
    })
    // For equally safe syllable boundaries, retain the earlier prefix. TeX's
    // paragraph breaker weighs the later lines as well as the current line;
    // blindly choosing the longest fitting prefix creates a visibly different
    // ragged paragraph (for example `rela- / tion` instead of TeX's
    // `re- / lation`).
    .sort((left, right) => right.priority - left.priority || left.index - right.index)
    .map(({ index }) => ({
      prefix: `${original.slice(0, index)}-`,
      suffix: `${original.slice(index)}${trailingPunctuation}`
    }));
}

function isEnglishVowel(char) {
  return /^[aeiouy]$/i.test(char || "");
}

function isEnglishConsonant(char) {
  return /^[a-z]$/i.test(char || "") && !isEnglishVowel(char);
}

function englishDigraph(left, right) {
  return ["ch", "sh", "th", "ph", "wh", "qu", "ck"].includes(`${left || ""}${right || ""}`.toLowerCase());
}

function wrapTeXWordsFlush(words, maxWidthCm, scale) {
  const count = words.length;
  const best = Array.from({ length: count + 1 }, () => ({ cost: Infinity, next: count }));
  best[count] = { cost: 0, next: count };
  const fontSizePt = 10 * scale;
  const maxWidthPt = maxWidthCm * TEX_PT_PER_CM;
  const spaceShrinkPt = (10 / 9) * scale;
  for (let start = count - 1; start >= 0; start -= 1) {
    for (let end = start; end < count; end += 1) {
      const candidate = words.slice(start, end + 1).join(" ");
      const metric = measurePlainTextTeXBoxPt(candidate, { fontSizePt });
      const widthPt = metric?.width ?? texTextWidthCm(candidate, scale) * TEX_PT_PER_CM;
      const overflowPt = Math.max(0, widthPt - maxWidthPt);
      const shrinkPt = Math.max(0, end - start) * spaceShrinkPt;
      if (end > start && overflowPt > shrinkPt) break;
      const badness = overflowPt > 0 && shrinkPt > 0
        ? Math.min(10000, 100 * (overflowPt / shrinkPt) ** 3)
        : overflowPt > 0
          ? 10000
          : 0;
      const cost = (10 + badness) ** 2 + best[end + 1].cost;
      if (cost < best[start].cost || (Math.abs(cost - best[start].cost) < 1e-9 && end + 1 > best[start].next)) {
        best[start] = { cost, next: end + 1 };
      }
    }
  }
  const lines = [];
  let cursor = 0;
  while (cursor < count) {
    const next = Math.max(cursor + 1, Math.min(count, best[cursor].next));
    lines.push(words.slice(cursor, next).join(" "));
    cursor = next;
  }
  return lines;
}

export function measurePlainTextTeXBoxPt(text, options = {}) {
  const fontSizePt = Number(options.fontSizePt);
  const source = String(text ?? "");
  const chars = [...replaceTikzHspaceMarkers(source, () => "")];
  if (!Number.isFinite(fontSizePt) || fontSizePt <= 0 || chars.length === 0) return null;
  const sans = /sans/i.test(String(options.fontFamily || ""));
  const metrics = sans ? SANS_REGULAR_TEX_METRICS : MAIN_REGULAR_TEX_METRICS;

  let width = relativeTikzHspaceWidthPt(source, fontSizePt) / fontSizePt;
  let height = 0;
  let depth = -Infinity;
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const metric = metrics[char];
    if (!metric) return null;
    if (sans) {
      width += metric[0];
    } else {
      const widthPt = CMR10_WIDTH_PT[char] ?? metric[0] * 10;
      width += widthPt / 10;
      if (index > 0) width += CMR10_KERNING_EM[`${chars[index - 1]}${char}`] || 0;
    }
    height = Math.max(height, metric[1]);
    depth = Math.max(depth, metric[2]);
  }
  return {
    width: width * fontSizePt,
    height: height * fontSizePt,
    depth: depth * fontSizePt
  };
}

function consumeFallbackScriptWidth(chars, start) {
  let count = 0;
  let widthPt = 0;
  for (let cursor = start; cursor < chars.length && isFallbackScriptTokenChar(chars[cursor]); cursor += 1) {
    widthPt += fallbackScriptTokenWidthPt(chars[cursor]);
    count += 1;
  }
  return count > 0 ? { count, widthPt } : 0;
}

function isFallbackScriptTokenChar(char) {
  return /[A-Za-z0-9+\-=()]/.test(char) || SCRIPT_CHAR_PATTERN.test(char) || isGreekFallbackToken(char) || /^\p{Letter}$/u.test(char);
}

function fallbackScriptTokenWidthPt(char) {
  return isGreekFallbackToken(char) ? GREEK_SCRIPT_TOKEN_WIDTH_PT : SCRIPT_TOKEN_WIDTH_PT;
}

function isGreekFallbackToken(char) {
  return /^[\p{Script=Greek}]$/u.test(char);
}

function estimateFormulaParts(tex, scale, metric) {
  const simpleScriptMetric = simpleScriptFormulaMetric(tex, scale, metric);
  if (simpleScriptMetric) return simpleScriptMetric;

  const scriptSequenceMetric = simpleScriptSequenceFormulaMetric(tex, scale, metric);
  if (scriptSequenceMetric) return scriptSequenceMetric;

  const glyphMetric = simpleGlyphFormulaMetric(tex, scale, metric);
  if (glyphMetric) return glyphMetric;

  const asciiMetric = simpleAsciiFormulaMetric(tex, scale, metric);
  if (asciiMetric) return asciiMetric;

  const alignedBox = estimateAlignedFormulaParts(tex, scale, metric);
  if (alignedBox) return alignedBox;

  const tensorMatrixBox = estimateTensorMatrixParts(tex, scale);
  if (tensorMatrixBox) return tensorMatrixBox;

  const inlineMatrixBox = estimateInlineMatrixFormulaParts(tex, scale);
  if (inlineMatrixBox) return inlineMatrixBox;

  const extensibleArrowBox = estimateExtensibleArrowFormulaParts(tex, scale, metric);
  if (extensibleArrowBox) return extensibleArrowBox;

  // Claude: 原版完全没有 \begin{matrix} 的尺寸感知 —— 矩阵的宽度按「所有单元格摊平成一行」
  // 来算（巨宽），高度只按一行算（巨扁），结果 display 矩阵的 SVG 盒子被估成又宽又扁，
  // 矩阵被压成一条细线。这里先做矩阵感知估算（按行列、支持嵌套），估到了就用它。
  const matrixBox = estimateMatrixParts(tex, scale, metric);
  if (matrixBox) return matrixBox;

  let width = fallbackWidth(tex, scale, metric);
  let height = 0.25 * scale;
  let depth = 0.04 * scale;

  const niceFractions = readBrowserNiceFractionParts(tex);
  if (niceFractions.length) {
    width += niceFractions.reduce((sum, fraction) => sum + niceFractionWidthAdjustment(fraction, scale, metric), 0);
    const em = 10 / TEX_PT_PER_CM;
    height = Math.max(height, em * 0.75 * scale);
    depth = Math.max(depth, em * 0.25 * scale);
  }

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
    if (hasSubscript(tex)) depth = Math.max(depth, 0.085 * scale);
  }

  const vectorSubscript = tex.match(/\\vec\s*\{\s*([A-Za-z])[\s\S]*?\}\s*_/);
  const wideTildeVectorSubscript = tex.match(/\\vec\s*\{\s*\\(?:wide)?tilde\s*\{\s*([A-Za-z])[\s\S]*?\}\s*\}\s*_/);
  const tallVectorBase = vectorSubscript?.[1] || wideTildeVectorSubscript?.[1];
  if (tallVectorBase && TALL_MATH_ACCENT_BASES.has(tallVectorBase)) {
    width = Math.max(width, fallbackWidth(tex, scale, metric) + 0.05 * scale);
    height = Math.max(height, 0.32 * scale);
    depth = Math.max(depth, 0.08 * scale);
  }

  if (/\\(?:wide)?tilde(?![A-Za-z])/.test(tex)) {
    width = Math.max(width, fallbackWidth(tex, scale, metric) + 0.2 * scale);
  }

  if (/\\(?:int|oint)(?![A-Za-z])/.test(tex)) {
    height = Math.max(height, 0.43 * scale);
    depth = Math.max(depth, hasSubscript(tex) ? 0.24 * scale : 0.16 * scale);
  }

  return { width, height, depth };
}

function simpleScriptSequenceFormulaMetric(tex, scale, metric) {
  if (!metric.texTextMetrics) return null;
  const parts = String(tex || "").trim().split(/\s*,\s*/);
  if (parts.length < 2) return null;

  const atoms = parts.map((part) => {
    const script = part.match(/^([A-Za-z])\s*_\s*(?:\{\s*([A-Za-z0-9]+)\s*\}|([A-Za-z0-9]))$/);
    if (script) {
      const baseSpec = (metric.mathVersion === "bold" ? MATH_BOLD_ITALIC_TEX_METRICS : MATH_ITALIC_TEX_METRICS)[script[1]];
      const scriptBox = measurePlainTextTeXBoxPt(script[2] || script[3], { fontSizePt: 7 * scale });
      if (!baseSpec || !scriptBox) return null;
      return {
        kind: "script",
        widthPt: baseSpec[0] * 10 * scale + scriptBox.width + 0.98613 * scale,
        heightPt: baseSpec[1] * 10 * scale,
        depthPt: Math.max(baseSpec[2] * 10 * scale, scriptBox.depth)
      };
    }
    if (/^(?:\\(?:l?dots)(?![A-Za-z])|[.…])$/.test(part)) {
      return { kind: "dots", widthPt: 11.66661 * scale, heightPt: 1.23 * scale, depthPt: 0 };
    }
    return null;
  });
  if (atoms.some((atom) => !atom) || !atoms.some((atom) => atom.kind === "dots")) return null;

  const commaWidthPt = MAIN_REGULAR_TEX_METRICS[","][0] * 10 * scale;
  const punctuationSpacePt = 3 * (10 / 18) * scale;
  return {
    width: (atoms.reduce((sum, atom) => sum + atom.widthPt, 0) + (parts.length - 1) * (commaWidthPt + punctuationSpacePt)) / TEX_PT_PER_CM,
    height: Math.max(...atoms.map((atom) => atom.heightPt), 0) / TEX_PT_PER_CM,
    depth: Math.max(...atoms.map((atom) => atom.depthPt), MAIN_REGULAR_TEX_METRICS[","][2] * 10 * scale) / TEX_PT_PER_CM
  };
}

function simpleScriptFormulaMetric(tex, scale, metric) {
  if (!metric.texTextMetrics) return null;
  const match = String(tex || "").trim().match(/^([A-Za-z])\s*_\s*(?:\{\s*([A-Za-z0-9]+)\s*\}|([A-Za-z0-9]))$/);
  if (!match) return null;

  // Math letters use the math-italic family, while a digit subscript stays in
  // the text family at script size. Measuring the base as CMR text widened
  // compact formulas such as $q_0$, which in turn made geometric node shapes
  // (notably automata's `initial by diamond`) visibly too large.
  const baseSpec = (metric.mathVersion === "bold" ? MATH_BOLD_ITALIC_TEX_METRICS : MATH_ITALIC_TEX_METRICS)[match[1]];
  const base = baseSpec
    ? {
        width: baseSpec[0] * 10 * scale,
        height: baseSpec[1] * 10 * scale,
        depth: baseSpec[2] * 10 * scale
      }
    : null;
  const script = measurePlainTextTeXBoxPt(match[2] || match[3], { fontSizePt: 7 * scale });
  if (!base || !script) return null;

  // TeX keeps a one-letter math atom and its scriptstyle subscript tight.
  // The math-italic advance already includes the needed placement; adding a
  // generic italic-width multiplier would grow the surrounding TikZ node.
  const scriptDropPt = 1.55 * scale;
  return {
    width: (base.width + script.width) / TEX_PT_PER_CM,
    height: base.height / TEX_PT_PER_CM,
    depth: Math.max(base.depth, Math.max(0, script.height - scriptDropPt) + script.depth) / TEX_PT_PER_CM
  };
}

function estimateExtensibleArrowFormulaParts(tex, scale, metric) {
  const parts = parseExtensibleMathArrow(tex);
  if (!parts) return null;

  const compactMetric = { ...metric, widthPadding: 0 };
  const prefix = parts.prefix.trim() ? estimateFormulaParts(parts.prefix, scale, compactMetric) : null;
  const suffix = parts.suffix.trim() ? estimateFormulaParts(parts.suffix, scale, compactMetric) : null;
  if (prefix) Object.assign(prefix, extensibleArrowFragmentMetrics(parts.prefix, prefix, scale));
  if (suffix) Object.assign(suffix, extensibleArrowFragmentMetrics(parts.suffix, suffix, scale));
  const scriptScale = scale * 0.7;
  // The cmr7 design-size font is wider than a geometrically scaled cmr10.
  const aboveWidth = texTextWidthCm(mathFallbackText(parts.above).replace(/\s+/g, ""), scriptScale) * 1.14;
  const belowWidth = texTextWidthCm(mathFallbackText(parts.below).replace(/\s+/g, ""), scriptScale) * 1.14;
  // amsmath's \ext@arrow uses scriptstyle labels padded by 14mu (5mu + 9mu).
  const scriptPadding = ((14 * 7) / 18 / TEX_PT_PER_CM) * scale;
  const arrowEndAllowance = (EXTENSIBLE_ARROW_END_ALLOWANCE_PT / TEX_PT_PER_CM) * scale;
  const minimumArrowWidth = (EXTENSIBLE_ARROW_MIN_WIDTH_PT / TEX_PT_PER_CM) * scale;
  const arrowWidth = Math.max(
    minimumArrowWidth,
    aboveWidth + scriptPadding + arrowEndAllowance,
    belowWidth + scriptPadding + arrowEndAllowance
  );
  const relationGap = ((5 * 10) / 18 / TEX_PT_PER_CM) * scale;
  const width =
    (prefix?.width || 0) +
    (prefix ? relationGap : 0) +
    arrowWidth +
    (suffix ? relationGap : 0) +
    (suffix?.width || 0) +
    metric.widthPadding;
  const aboveMetric = extensibleArrowScriptMetric(parts.above, scale);
  const belowMetric = extensibleArrowScriptMetric(parts.below, scale);
  const scriptHeight = aboveMetric
    ? (aboveMetric.height + EXTENSIBLE_ARROW_UPPER_GAP_PT * scale) / TEX_PT_PER_CM
    : 0;
  const scriptDepth = belowMetric
    ? (belowMetric.height + Math.max(0, belowMetric.depth) + EXTENSIBLE_ARROW_LOWER_GAP_PT * scale) / TEX_PT_PER_CM
    : 0;

  return {
    width,
    height: Math.max(prefix?.height || 0, suffix?.height || 0, 0.25 * scale, scriptHeight),
    depth: Math.max(prefix?.depth || 0, suffix?.depth || 0, 0.04 * scale, scriptDepth)
  };
}

function extensibleArrowFragmentWidthCorrection(tex, scale) {
  const fallback = mathFallbackText(tex).replace(/\s+/g, "");
  const doubleStruckCount = [...fallback].filter((char) => "ℂℍℕℙℚℝℤ".includes(char)).length;
  const scriptCount = (fallback.match(/[_^](?:[A-Za-z0-9]|[₀-₉⁰-⁹])/g) || []).length;
  return ((doubleStruckCount * EXTENSIBLE_ARROW_DOUBLE_STRUCK_CORRECTION_PT + scriptCount * 0.3) / TEX_PT_PER_CM) * scale;
}

function extensibleArrowFragmentMetrics(tex, fallbackMetric, scale) {
  const fallback = mathFallbackText(tex).replace(/\s+/g, "");
  const width = texTextWidthCm(fallback, scale) + extensibleArrowFragmentWidthCorrection(tex, scale);
  const base = [...fallback]
    .map((char) => doubleStruckBaseChar(char))
    .filter((char) => !/[₀-₉⁰-⁹]/.test(char))
    .join("");
  const plain = measurePlainTextTeXBoxPt(base, { fontSizePt: 10 * scale });
  const hasSuperscript = /\^|[⁰-⁹]/.test(String(tex)) || /[⁰-⁹]/.test(fallback);
  const hasSubscript = /_|[₀-₉]/.test(String(tex)) || /[₀-₉]/.test(fallback);
  return {
    width,
    height: Math.max(
      Number(fallbackMetric?.height) || 0,
      (Number(plain?.height) || 0) / TEX_PT_PER_CM,
      hasSuperscript ? (EXTENSIBLE_ARROW_SUPERSCRIPT_HEIGHT_PT / TEX_PT_PER_CM) * scale : 0
    ),
    depth: Math.max(
      Number(fallbackMetric?.depth) || 0,
      Math.max(0, Number(plain?.depth) || 0) / TEX_PT_PER_CM,
      hasSubscript ? (2.5 / TEX_PT_PER_CM) * scale : 0
    )
  };
}

function extensibleArrowScriptMetric(tex, scale) {
  const text = mathFallbackText(tex).replace(/\s+/g, "");
  if (!text) return null;
  return measurePlainTextTeXBoxPt(
    [...text].map((char) => doubleStruckBaseChar(char)).join(""),
    { fontSizePt: 7 * scale }
  ) || { height: 4.86108 * scale, depth: 0 };
}

function doubleStruckBaseChar(char) {
  const index = "ℂℍℕℙℚℝℤ".indexOf(char);
  return index >= 0 ? "CHNPQRZ"[index] : char;
}

function estimateAlignedFormulaParts(tex, scale, metric) {
  const match = String(tex || "").trim().match(/^\\begin\s*\{(?:aligned|alignedat\*?)\}([\s\S]*)\\end\s*\{(?:aligned|alignedat\*?)\}$/);
  if (!match) return null;
  const rows = splitMatrixTopLevel(match[1], "row")
    .map((row) => splitMatrixTopLevel(row, "col").map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
  if (!rows.length) return null;
  const columnCount = Math.max(...rows.map((row) => row.length));
  const columnWidths = Array.from({ length: columnCount }, (_value, columnIndex) =>
    Math.max(
      0,
      ...rows.map((row) => estimateFormulaParts(row[columnIndex] || "", scale, metric).width)
    )
  );
  const columnGap = 0.12 * scale;
  const width = columnWidths.reduce((sum, value) => sum + value, 0) + columnGap * Math.max(0, columnCount - 1);
  const rowBoxes = rows.map((row) => {
    const parts = row.map((cell) => estimateFormulaParts(cell, scale, metric));
    return {
      height: Math.max(...parts.map((part) => part.height), 0.25 * scale),
      depth: Math.max(...parts.map((part) => part.depth), 0.04 * scale)
    };
  });
  const rowGap = 0.13 * scale;
  const extraTallRows = Math.max(0, rows.length - 2) * 0.2 * scale;
  const totalHeight =
    rowBoxes.reduce((sum, row) => sum + row.height + row.depth, 0) +
    rowGap * Math.max(0, rows.length - 1) +
    extraTallRows;
  return {
    width,
    height: totalHeight / 2,
    depth: totalHeight / 2
  };
}

function simpleGlyphFormulaMetric(tex, scale, metric) {
  if (!metric.texTextMetrics) return null;
  const key = String(tex || "").replace(/\s+/g, "");
  const spec = SIMPLE_GLYPH_FORMULA_METRICS[key];
  if (!spec) return null;
  return {
    width: (spec.widthPt / TEX_PT_PER_CM) * scale,
    height: (spec.heightPt / TEX_PT_PER_CM) * scale,
    depth: (spec.depthPt / TEX_PT_PER_CM) * scale
  };
}

function simpleAsciiFormulaMetric(tex, scale, metric) {
  if (!metric.texTextMetrics) return null;
  const text = String(tex || "").trim();
  if (!text || /[\\{}_^]/.test(text) || !/^[A-Za-z0-9()+\-*=.,/:;<>\s]+$/.test(text)) return null;

  if (metric.mathVersion === "bold") {
    const exact = SIMPLE_BOLD_ASCII_FORMULA_METRICS_PT[text.replace(/\s+/g, "")];
    if (exact) {
      return {
        width: (exact[0] * scale) / TEX_PT_PER_CM,
        height: (exact[1] * scale) / TEX_PT_PER_CM,
        depth: (exact[2] * scale) / TEX_PT_PER_CM
      };
    }
  }

  let width = 0;
  let height = 0;
  let depth = 0;
  for (const char of text) {
    if (/\s/.test(char)) continue;
    const visibleChar = char === "-" ? "−" : char;
    const spec = /[A-Za-z]/.test(char)
      ? (metric.mathVersion === "bold" ? MATH_BOLD_ITALIC_TEX_METRICS : MATH_ITALIC_TEX_METRICS)[char]
      : (metric.mathVersion === "bold" ? MAIN_BOLD_TEX_METRICS : MAIN_REGULAR_TEX_METRICS)[visibleChar];
    if (!spec) return null;
    width += spec[0];
    height = Math.max(height, spec[1]);
    depth = Math.max(depth, spec[2]);
    if ("=<>".includes(char)) width += 10 / 18;
    else if ("+-*".includes(char)) width += 8 / 18;
  }

  const fontSizePt = 10 * scale;
  return {
    width: (width * fontSizePt) / TEX_PT_PER_CM,
    height: (height * fontSizePt) / TEX_PT_PER_CM,
    depth: (depth * fontSizePt) / TEX_PT_PER_CM
  };
}

function estimateInlineMatrixFormulaParts(tex, scale) {
  const parts = extractInlineMatrixFormula(tex);
  if (!parts || (!parts.prefix.trim() && !parts.suffix.trim())) return null;

  const baseFont = (10 / TEX_PT_PER_CM) * scale;
  const layout = inlineMathMatrixLayoutCm(parts, baseFont);
  const width = layout.prefixWidth + layout.prefixGap + layout.matrixWidth + layout.suffixGap + layout.suffixWidth;
  const height = Math.max(baseFont * 0.34, layout.matrixHeight / 2);
  const depth = Math.max(baseFont * 0.16, layout.matrixHeight / 2);
  return { width, height, depth };
}

// amsmath's \env@matrix starts and ends with a compensating -\arraycolsep.
// Consequently the matrix variants (matrix, pmatrix, bmatrix, ...) have no
// residual outer array bearing. Delimiter, text, and mu metrics are selected
// from the surrounding TeX textstyle instead of geometrically scaling 10pt.
export function inlineMathMatrixLayoutCm(parts, fontSizeCm) {
  const font = Number.isFinite(Number(fontSizeCm)) && Number(fontSizeCm) > 0 ? Number(fontSizeCm) : 10 / TEX_PT_PER_CM;
  const design = inlineMatrixDesignMetrics(font * TEX_PT_PER_CM);
  const prefix = mathFallbackText(parts.prefix).trim();
  const suffix = mathFallbackText(parts.suffix).trim();
  const colCount = Math.max(...parts.rows.map((row) => row.length));
  const rowGap = font * 0.1;
  const rowHeight = font * 1.16;
  const colWidths = Array.from({ length: colCount }, (_value, colIndex) =>
    Math.max(
      font * 0.44,
      ...(parts.rawRows || parts.rows).map((row) => inlineMatrixMathFragmentWidthCm(row[colIndex] || "", font))
    )
  );
  const interColumnGaps = Array.from({ length: Math.max(0, colCount - 1) }, (_value, index) =>
    parts.interColumnGaps?.[index] === 0 ? 0 : 10 / TEX_PT_PER_CM
  );
  const contentWidth = colWidths.reduce((sum, value) => sum + value, 0) + interColumnGaps.reduce((sum, value) => sum + value, 0);
  const delimiters = parts.delimiters || { left: null, right: null };
  const delimiterWidth = design?.delimiter / TEX_PT_PER_CM || font * 0.736116;
  const leftDelimiterWidth = delimiters.left ? delimiterWidth : 0;
  const rightDelimiterWidth = delimiters.right ? delimiterWidth : 0;
  // Plain LaTeX arrays have separate outer \arraycolsep semantics. Preserve
  // their existing fallback bearing here; amsmath matrix variants use none.
  const arrayDelimiterPad = parts.env === "array" ? font * 0.1 : 0;
  const leftDelimiterPad = delimiters.left ? arrayDelimiterPad : 0;
  const rightDelimiterPad = delimiters.right ? arrayDelimiterPad : 0;
  const matrixWidth = contentWidth + leftDelimiterWidth + rightDelimiterWidth + leftDelimiterPad + rightDelimiterPad;
  const matrixHeight = rowHeight * parts.rows.length + rowGap * Math.max(0, parts.rows.length - 1);
  return {
    prefix,
    suffix,
    prefixWidth: prefix ? inlineMatrixMathFragmentWidthCm(parts.prefix, font) : 0,
    suffixWidth: suffix ? inlineMatrixMathFragmentWidthCm(parts.suffix, font) : 0,
    prefixGap: prefix ? inlineMatrixBoundarySpacingCm(parts.prefix, "trailing", font) : 0,
    suffixGap: suffix ? inlineMatrixBoundarySpacingCm(parts.suffix, "leading", font) : 0,
    colWidths,
    interColumnGaps,
    rowGap,
    rowHeight,
    matrixWidth,
    matrixHeight,
    leftDelimiterWidth,
    rightDelimiterWidth,
    leftDelimiterPad,
    rightDelimiterPad
  };
}

function inlineMatrixMathFragmentWidthCm(value, fontSizeCm) {
  const sample = parseInlinePlotReferenceSample(value);
  if (sample) return sample.reservedWidthCm;
  const text = compactMathMetricText(mathFallbackText(value));
  const scale = (fontSizeCm * TEX_PT_PER_CM) / 10;
  return texTextWidthCm(text, scale) + inlineMatrixDesignAdvanceAdjustmentCm(text, scale) + inlineMatrixInternalMathSpacingCm(text, fontSizeCm);
}

function inlineMatrixDesignAdvanceAdjustmentCm(text, scale) {
  const design = inlineMatrixDesignMetrics(10 * scale);
  if (!design) return 0;
  let adjustment = 0;
  for (const char of String(text || "")) {
    const targetAdvancePt = design.mathAdvancePt?.[char];
    if (Number.isFinite(targetAdvancePt)) {
      adjustment += targetAdvancePt / TEX_PT_PER_CM - texTextWidthCm(char, scale);
    } else if (/\d/.test(char)) adjustment += texTextWidthCm(char, scale) * (design.digitScale - 1);
    else if (/[A-Za-zα-ωΑ-Ω]/u.test(char)) adjustment += texTextWidthCm(char, scale) * (design.italicScale - 1);
    else if (isMathFallbackRelationSymbol(char)) adjustment += texTextWidthCm(char, scale) * (design.relationScale - 1);
  }
  return adjustment;
}

function inlineMatrixInternalMathSpacingCm(text, fontSizeCm) {
  const chars = [...String(text || "")];
  let width = 0;
  for (let index = 0; index < chars.length; index += 1) {
    const mu = inlineMatrixOperatorMu(chars[index], chars[index - 1], chars[index + 1]);
    if (!mu) continue;
    if (index > 0) width += inlineMatrixMuToCm(mu, fontSizeCm);
    if (index < chars.length - 1) width += inlineMatrixMuToCm(mu, fontSizeCm);
  }
  return width;
}

function inlineMatrixBoundarySpacingCm(value, side, fontSizeCm) {
  const text = compactMathMetricText(mathFallbackText(value));
  if (!text) return 0;
  const chars = [...text];
  const index = side === "leading" ? 0 : chars.length - 1;
  return inlineMatrixMuToCm(inlineMatrixOperatorMu(chars[index], chars[index - 1], chars[index + 1]), fontSizeCm);
}

function inlineMatrixOperatorMu(char, previous, next) {
  if (isMathFallbackRelationSymbol(char)) return 5;
  if (!MATH_BINARY_SYMBOLS.has(char)) return 0;
  // A leading minus is unary rather than a binary operator in TeX math lists.
  if (char === "-" && (!previous || /[(\[{=+\-*/]/.test(previous))) return 0;
  return next || previous ? 4 : 0;
}

function inlineMatrixMuToCm(mu, fontSizeCm) {
  const design = inlineMatrixDesignMetrics(fontSizeCm * TEX_PT_PER_CM);
  if (design) return (Number(mu) * design.fiveMu / 5) / TEX_PT_PER_CM;
  return (Number(mu) * (fontSizeCm * TEX_PT_PER_CM) / 18) / TEX_PT_PER_CM;
}

function inlineMatrixDesignMetrics(fontSizePt) {
  const size = Number(fontSizePt);
  if (!Number.isFinite(size)) return null;
  for (const [designSize, metrics] of INLINE_MATRIX_DESIGN_METRICS_PT) {
    if (Math.abs(size - designSize) < 0.01) return metrics;
  }
  return null;
}

function extractInlineMatrixFormula(tex) {
  const parts = parseInlineMathMatrix(tex);
  if (!parts) return null;
  return {
    ...parts,
    rawRows: parts.rows,
    rows: parts.rows.map((row) => row.map((cell) => parseInlinePlotReferenceSample(cell) ? "" : mathFallbackText(cell).trim()))
  };
}

function estimateTensorMatrixParts(tex, scale) {
  const text = String(tex || "");
  if (!/\\(?:overmat|undermat)\b/.test(text) || !/\\begin\{matrix\}/.test(text)) return null;
  const blocks = readTensorMatrixMetricBlocks(text);
  if (blocks.length < 2) return null;

  // Keep this in sync with renderers/svg/renderSvg.js renderTensorMatrixFallback: the
  // anchor box must describe the same compact 2x2 tensor fallback we draw.
  const font = 0.34 * scale;
  const cell = font * 0.82;
  const rowCell = font * 0.94;
  const labelHeight = font * 0.8;
  const matrixWidth = cell * 3.25;
  const matrixHeight = rowCell * 3.05;
  const bracketPad = font * 0.32;
  const blockWidth = matrixWidth + bracketPad * 2 + font * 0.2;
  const blockHeight = matrixHeight + labelHeight + font * 0.42;
  const gapX = font;
  const gapY = font * 0.1;
  const prefixWidth = font * 2.1;
  const gridWidth = blockWidth * 2 + gapX;
  const gridHeight = blockHeight * 2 + gapY;
  return {
    width: prefixWidth + gridWidth + font * 0.8,
    height: gridHeight / 2,
    depth: gridHeight / 2
  };
}

function readTensorMatrixMetricBlocks(text) {
  const blocks = [];
  const pattern = /\\(overmat|undermat)\b/g;
  let match;
  while ((match = pattern.exec(text))) {
    let cursor = match.index + match[1].length + 1;
    const label = readBalanced(text, skipWhitespace(text, cursor), "{", "}");
    if (!label) continue;
    cursor = label.end;
    const matrix = readBalanced(text, skipWhitespace(text, cursor), "{", "}");
    if (!matrix) continue;
    cursor = matrix.end;
    const color = readBalanced(text, skipWhitespace(text, cursor), "{", "}");
    if (!color) continue;
    blocks.push({ label, matrix, color });
    pattern.lastIndex = color.end;
  }
  return blocks;
}

function fallbackWidth(tex, scale, metric) {
  return fallbackBodyWidth(tex, scale, metric) + metric.widthPadding;
}

function fallbackBodyWidth(tex, scale, metric) {
  const fallback = metric.texTextMetrics ? compactMathMetricText(tex) : mathFallbackText(tex);
  if (!metric.texTextMetrics) return mathTextMetricUnits(fallback) * metric.widthFactor * scale;
  return measuredMathFallbackWidthCm(fallback, scale, metric) ?? (
    texTextWidthCm(fallback, scale) + texMathRelationSpacingCm(fallback, scale) + texMathPunctuationSpacingCm(fallback, scale)
  );
}

function measuredMathFallbackWidthCm(text, scale, metric) {
  const chars = [...String(text || "")].filter((char) => !/\s/.test(char));
  const source = chars.join("");
  const design = inlineMatrixDesignMetrics(10 * scale);
  let widthPt = 0;
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const directAdvance = design?.mathAdvancePt?.[char];
    if (Number.isFinite(directAdvance)) {
      widthPt += directAdvance;
    } else {
      const visibleChar = char === "-" ? "−" : char;
      const spec = /[A-Za-z]/.test(char)
        ? (metric.mathVersion === "bold" ? MATH_BOLD_ITALIC_TEX_METRICS : MATH_ITALIC_TEX_METRICS)[char]
        : MATH_FALLBACK_SYMBOL_TEX_METRICS[char]
          || (metric.mathVersion === "bold" ? MAIN_BOLD_TEX_METRICS : MAIN_REGULAR_TEX_METRICS)[visibleChar];
      if (!spec) return null;
      const designScale = /[A-Za-zϵ]/u.test(char)
        ? design?.italicScale || 1
        : isMathFallbackRelationSymbol(char)
          ? design?.relationScale || 1
          : /\d/.test(char)
            ? design?.digitScale || 1
            : 1;
      widthPt += spec[0] * 10 * scale * designScale;
    }

    const mu = mathFallbackOperatorMuAt(source, index);
    if (mu && index > 0) widthPt += mathFallbackMuPt(mu, scale, design);
    if (mu && index < chars.length - 1) widthPt += mathFallbackMuPt(mu, scale, design);
    if (char === "," && index < chars.length - 1) widthPt += mathFallbackMuPt(3, scale, design);
  }
  return widthPt / TEX_PT_PER_CM;
}

function mathFallbackMuPt(mu, scale, design) {
  return Number(mu) * (design?.fiveMu ? design.fiveMu / 5 : (10 * scale) / 18);
}

function texMathRelationSpacingCm(text, scale) {
  const relationCount = [...String(text || "")].filter((char) => isMathFallbackRelationSymbol(char)).length;
  if (!relationCount) return 0;
  // Plain TeX surrounds relation atoms with \thickmuskip (5mu) on both
  // sides. At the 10pt math size, 1mu is 1/18em.
  const relationSpacingPt = relationCount * 2 * 5 * (10 / 18) * scale;
  return relationSpacingPt / TEX_PT_PER_CM;
}

function texMathPunctuationSpacingCm(text, scale) {
  const chars = [...String(text || "")];
  let punctuationCount = 0;
  for (let index = 0; index < chars.length; index += 1) {
    if (chars[index] !== ",") continue;
    if (chars.slice(index + 1).some((char) => !/\s/.test(char))) punctuationCount += 1;
  }
  if (!punctuationCount) return 0;
  // TeX's comma is \mathpunct: its following spacing is \thinmuskip (3mu).
  const punctuationSpacingPt = punctuationCount * 3 * (10 / 18) * scale;
  return punctuationSpacingPt / TEX_PT_PER_CM;
}

function readBrowserNiceFractionParts(tex) {
  return readCommandGroups(String(tex || ""), ["mathord"])
    .map(parseBrowserNiceFractionGroup)
    .filter(Boolean);
}

function parseBrowserNiceFractionGroup(value) {
  const source = String(value || "");
  let cursor = skipWhitespace(source, 0);
  const raisebox = String.raw`\raisebox`;
  if (!source.startsWith(raisebox, cursor)) return null;
  cursor = skipWhitespace(source, cursor + raisebox.length);
  const raise = readBalanced(source, cursor, "{", "}");
  if (!raise || raise.content.trim() !== "0.2em") return null;
  cursor = skipWhitespace(source, raise.end);
  const numerator = readBalanced(source, cursor, "{", "}");
  if (!numerator) return null;
  cursor = skipWhitespace(source, numerator.end);
  const separator = source.slice(cursor).match(/^\\mkern\s*-2mu\s*\/\s*\\mkern\s*-1mu\s*/);
  if (!separator) return null;
  cursor = skipWhitespace(source, cursor + separator[0].length);
  const denominator = readBalanced(source, cursor, "{", "}");
  if (!denominator || source.slice(denominator.end).trim()) return null;
  return {
    numerator: stripBrowserNiceFractionSize(numerator.content),
    denominator: stripBrowserNiceFractionSize(denominator.content)
  };
}

function stripBrowserNiceFractionSize(value) {
  return String(value || "").replace(/^\s*\\scriptsize(?![A-Za-z])\s*(?:\{\})?/, "");
}

function niceFractionWidthAdjustment(fraction, scale, metric) {
  const numerator = mathFallbackText(fraction.numerator);
  const denominator = mathFallbackText(fraction.denominator);
  const unscaledWidth = fallbackBodyWidth(`${numerator}/${denominator}`, scale, metric);
  const scriptWidth = fallbackBodyWidth(numerator, scale * 0.7, metric)
    + fallbackBodyWidth(denominator, scale * 0.7, metric);
  const kernedSolidusWidth = fallbackBodyWidth("/", scale, metric) * (2 / 3);
  return scriptWidth + kernedSolidusWidth - unscaledWidth;
}

function compactMathMetricText(tex) {
  return mathFallbackText(tex)
    .replace(/\s*([=+≔≤≥≠≈∼<>⩽⩾≰≱⊈⊉⇝∴∵])\s*/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const MATRIX_ENV_NAMES = ["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "array", "cases"];

// Claude: 估算最外层 matrix/array 环境的盒子。按「矩阵嵌套深度」感知地把内容切成行(\\)和列(&)，
// 对每个单元格递归调用 estimateFormulaParts（从而正确处理单元格里再嵌套的矩阵/上下花括号标签），
// 然后行高累加、列宽取各行最大，得到接近真实渲染的尺寸。没有矩阵就返回 null，走原有逻辑。
function estimateMatrixParts(tex, scale, metric) {
  const outer = extractOutermostMatrix(tex);
  if (!outer) return null;
  const rows = splitMatrixTopLevel(outer.body, "row").map((row) => row.trim()).filter((row) => row.length);
  if (!rows.length) return null;

  const rowGap = 0.35 * scale;
  const colGap = 0.6 * scale;
  let totalHeight = 0;
  let maxRowWidth = 0;
  for (const row of rows) {
    const cells = splitMatrixTopLevel(row, "col");
    let rowHeight = 0.5 * scale;
    let rowWidth = 0;
    for (const cell of cells) {
      const part = estimateFormulaParts(cell, scale, metric);
      rowHeight = Math.max(rowHeight, part.height + part.depth);
      rowWidth += part.width;
    }
    rowWidth += colGap * Math.max(0, cells.length - 1);
    totalHeight += rowHeight + rowGap;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
  }
  totalHeight = Math.max(totalHeight, 0.6 * scale);
  // 外层定界符(\left[ \right] 等)的左右留白
  const width = maxRowWidth + 0.6 * scale;
  return { width, height: totalHeight / 2 + 0.05 * scale, depth: totalHeight / 2 };
}

function extractOutermostMatrix(tex) {
  const text = String(tex);
  for (let index = 0; index < text.length; index += 1) {
    const begin = matchEnvToken(text, index, "begin");
    if (!begin || !MATRIX_ENV_NAMES.includes(begin.env)) continue;
    let depth = 0;
    let cursor = index;
    while (cursor < text.length) {
      const open = matchEnvToken(text, cursor, "begin");
      const close = matchEnvToken(text, cursor, "end");
      if (open && MATRIX_ENV_NAMES.includes(open.env)) {
        depth += 1;
        cursor = open.end;
        continue;
      }
      if (close && MATRIX_ENV_NAMES.includes(close.env)) {
        depth -= 1;
        if (depth === 0) return { body: text.slice(begin.end, cursor), env: begin.env };
        cursor = close.end;
        continue;
      }
      cursor += 1;
    }
    return null;
  }
  return null;
}

function matchEnvToken(text, index, kind) {
  if (text[index] !== "\\") return null;
  const match = text.slice(index).match(new RegExp(`^\\\\${kind}\\{([a-zA-Z*]+)\\}`));
  if (!match) return null;
  return { env: match[1].replace(/\*$/, ""), end: index + match[0].length };
}

// 按矩阵嵌套深度(matrix begin/end)与花括号深度都为 0 时, 才在 \\(行)或 &(列)处切分。
function splitMatrixTopLevel(body, mode) {
  const parts = [];
  let current = "";
  let envDepth = 0;
  let brace = 0;
  let index = 0;
  while (index < body.length) {
    const begin = matchEnvToken(body, index, "begin");
    const end = matchEnvToken(body, index, "end");
    if (begin && MATRIX_ENV_NAMES.includes(begin.env)) {
      envDepth += 1;
      current += body.slice(index, begin.end);
      index = begin.end;
      continue;
    }
    if (end && MATRIX_ENV_NAMES.includes(end.env)) {
      envDepth -= 1;
      current += body.slice(index, end.end);
      index = end.end;
      continue;
    }
    const char = body[index];
    if (char === "{") brace += 1;
    else if (char === "}") brace -= 1;
    if (envDepth === 0 && brace === 0) {
      if (mode === "row" && char === "\\" && body[index + 1] === "\\") {
        parts.push(current);
        current = "";
        index += 2;
        continue;
      }
      if (mode === "col" && char === "&") {
        parts.push(current);
        current = "";
        index += 1;
        continue;
      }
    }
    current += char;
    index += 1;
  }
  parts.push(current);
  return parts;
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

function skipWhitespace(text, start) {
  let cursor = start;
  while (/\s/.test(text[cursor] || "")) cursor += 1;
  return cursor;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}
