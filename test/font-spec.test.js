import assert from "node:assert/strict";
import test from "node:test";
import {
  createFontSpec,
  fontSpecFromLegacyScale,
  fontSpecFromSizeCommand,
  mergeFontSpec
} from "../src/tex/fontSpec.js";

test("matches the MacTeX size10.clo font table", () => {
  const expected = {
    tiny: [5, 6],
    scriptsize: [7, 8],
    footnotesize: [8, 9.5],
    small: [9, 11],
    normalsize: [10, 12],
    large: [12, 14],
    Large: [14.4, 18],
    LARGE: [17.28, 22],
    huge: [20.74, 25],
    Huge: [24.88, 30]
  };

  for (const [name, [sizePt, baselineSkipPt]] of Object.entries(expected)) {
    assert.deepEqual(fontSpecFromSizeCommand(`\\${name}`), {
      ...createFontSpec(),
      sizePt,
      baselineSkipPt,
      source: "content-command"
    });
  }
});

test("merges property patches without resetting inherited size", () => {
  const small = fontSpecFromSizeCommand("\\small", { source: "library-role" });

  assert.deepEqual(mergeFontSpec(small, { weight: 700, source: "node-option" }), {
    ...small,
    weight: 700,
    source: "node-option"
  });
});

test("converts legacy scales through the canonical 10pt profile", () => {
  assert.equal(fontSpecFromLegacyScale(0.5).sizePt, 5);
  assert.equal(fontSpecFromLegacyScale(1).sizePt, 10);
});

test("rejects FontSpec sizes that are not finite positive points", () => {
  for (const value of [0, -1, Infinity, -Infinity, NaN, "not-a-size"]) {
    assert.throws(
      () => createFontSpec({ sizePt: value }),
      { name: "RangeError", message: "FontSpec sizes must be finite positive TeX points" }
    );
    assert.throws(
      () => createFontSpec({ baselineSkipPt: value }),
      { name: "RangeError", message: "FontSpec sizes must be finite positive TeX points" }
    );
  }
});
