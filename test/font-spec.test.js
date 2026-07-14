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

test("rejects inherited and unknown size command names", () => {
  for (const command of ["\\toString", "\\constructor", "\\__proto__", "\\unknown"]) {
    assert.equal(fontSpecFromSizeCommand(command), null);
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
  assert.deepEqual(fontSpecFromLegacyScale(0.5), {
    sizePt: 5,
    baselineSkipPt: 6,
    family: "serif",
    weight: 400,
    style: "normal",
    variant: "normal",
    mathStyle: "text",
    source: "legacy-scale"
  });
  assert.deepEqual(fontSpecFromLegacyScale(1), {
    sizePt: 10,
    baselineSkipPt: 12,
    family: "serif",
    weight: 400,
    style: "normal",
    variant: "normal",
    mathStyle: "text",
    source: "legacy-scale"
  });

  const base = createFontSpec({
    sizePt: 12,
    baselineSkipPt: 15,
    family: "sans-serif",
    weight: 700,
    source: "library-role"
  });
  assert.deepEqual(fontSpecFromLegacyScale(0.5, base), {
    ...base,
    sizePt: 6,
    baselineSkipPt: 7.5,
    source: "legacy-scale"
  });
});

test("rejects FontSpec sizes that are not finite positive points", () => {
  const unsupported = [
    0,
    -1,
    Infinity,
    -Infinity,
    NaN,
    true,
    false,
    [],
    [10],
    {},
    Symbol("size"),
    "",
    "not-a-size",
    "10"
  ];

  for (const value of unsupported) {
    assert.throws(
      () => createFontSpec({ sizePt: value }),
      { name: "RangeError", message: "FontSpec sizes must be finite positive TeX points" }
    );
    assert.throws(
      () => createFontSpec({ baselineSkipPt: value }),
      { name: "RangeError", message: "FontSpec sizes must be finite positive TeX points" }
    );
  }

  assert.deepEqual(createFontSpec({ sizePt: 10.5, baselineSkipPt: 13 }), {
    sizePt: 10.5,
    baselineSkipPt: 13,
    family: "serif",
    weight: 400,
    style: "normal",
    variant: "normal",
    mathStyle: "text",
    source: "document"
  });
});
