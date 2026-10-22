import { cmMathMetrics } from "./cmMathMetrics.js";
import { LATEX_10PT_FONT_PROFILE } from "./fontProfiles.js";

// fontmath.ltx's DeclareMathSizes and the CM NFSS .fd design-size mappings.
const sizes = {5:[5,5,5],6:[6,5,5],7:[7,5,5],8:[8,6,5],9:[9,6,5],
  10:[10,7,5],10.95:[10.95,8,6],12:[12,8,6],14.4:[14.4,10,7],
  17.28:[17.28,12,10],20.74:[20.74,14.4,12],24.88:[24.88,20.74,17.28]};

export function nativeMathSize(size) {
  return Object.keys(sizes).map(Number).find(value => Math.abs(value - size) < 1e-6);
}

export function nativeMathLevels(base) { return sizes[base]; }
export function nativeMathFontSize(ctx) { return sizes[ctx.base][Math.max(0, ctx.style - 1)]; }
export function nativeBaselineSkip(base) {
  return Object.values(LATEX_10PT_FONT_PROFILE).find(font => font.sizePt === base)?.baselineSkipPt
    ?? ({6:7,10.95:13.6})[base];
}

export function nativeMathFont(role, size) {
  const design = role === "CMEX" ? (size < 8 ? 7 : size < 10 ? size : 10)
    : size <= 10 ? size : role === "CMR" ? (size < 12 ? 10 : size < 17 ? 12 : 17)
    : ["CMMI", "CMBX"].includes(role) ? (size < 12 ? 10 : 12) : 10;
  return cmMathMetrics[`${role}${design}`];
}
