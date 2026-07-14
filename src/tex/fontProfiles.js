export const LATEX_10PT_FONT_PROFILE = Object.freeze({
  tiny: Object.freeze({ sizePt: 5, baselineSkipPt: 6 }),
  scriptsize: Object.freeze({ sizePt: 7, baselineSkipPt: 8 }),
  footnotesize: Object.freeze({ sizePt: 8, baselineSkipPt: 9.5 }),
  small: Object.freeze({ sizePt: 9, baselineSkipPt: 11 }),
  normalsize: Object.freeze({ sizePt: 10, baselineSkipPt: 12 }),
  large: Object.freeze({ sizePt: 12, baselineSkipPt: 14 }),
  Large: Object.freeze({ sizePt: 14.4, baselineSkipPt: 18 }),
  LARGE: Object.freeze({ sizePt: 17.28, baselineSkipPt: 22 }),
  huge: Object.freeze({ sizePt: 20.74, baselineSkipPt: 25 }),
  Huge: Object.freeze({ sizePt: 24.88, baselineSkipPt: 30 })
});

export function documentFontProfile(name = "10pt") {
  if (name !== "10pt") {
    throw new RangeError(`Unsupported document font profile: ${name}`);
  }
  return LATEX_10PT_FONT_PROFILE;
}
