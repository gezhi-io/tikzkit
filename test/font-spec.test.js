import assert from "node:assert/strict";
import test from "node:test";
import {
  createFontSpec,
  fontSpecFromLegacyScale,
  fontSpecFromSizeCommand,
  mergeFontSpec,
  parseTikzFontPatch,
  resolveFontSpec
} from "../src/tex/fontSpec.js";
import { fontScaleFromTikzFont, normalizeTikzText } from "../src/tikz/text.js";
import { parseMathText } from "../src/tikz/textMetrics.js";
import { tikzToSvg } from "../src/index.js";

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

test("resolves document scope library node and content font layers in order", () => {
  const resolved = resolveFontSpec({
    document: createFontSpec(),
    scope: parseTikzFontPatch(String.raw`\sffamily\large`, { source: "scope" }),
    libraryRole: parseTikzFontPatch(String.raw`\small\bfseries`, { source: "library-role" }),
    nodeOption: parseTikzFontPatch(String.raw`\Large\mdseries\itshape`, { source: "node-option" }),
    contentCommand: parseTikzFontPatch(String.raw`\fontsize{6}{7}\selectfont\scshape`, {
      source: "content-command"
    })
  });

  assert.deepEqual(resolved, {
    sizePt: 6,
    baselineSkipPt: 7,
    family: "sans-serif",
    weight: 400,
    style: "italic",
    variant: "small-caps",
    mathStyle: "text",
    source: "content-command"
  });
});

test("parses explicit fontsize commands and keeps the last valid size", () => {
  assert.deepEqual(parseTikzFontPatch(String.raw`\fontsize{6}{7}\selectfont`, { source: "content-command" }), {
    sizePt: 6,
    baselineSkipPt: 7,
    source: "content-command"
  });
  assert.deepEqual(
    parseTikzFontPatch(
      String.raw`\tiny\fontsize{8}{9.5}\selectfont\fontsize{0}{12}\selectfont\fontsize{NaN}{7}\selectfont`
    ),
    { sizePt: 8, baselineSkipPt: 9.5, source: "node-option" }
  );
  assert.deepEqual(parseTikzFontPatch(String.raw`\fontsize{-1}{7}\selectfont`), {});
  assert.deepEqual(parseTikzFontPatch(String.raw`\fontsize{Infinity}{7}\selectfont`), {});
});

test("keeps the last valid size command in source order", () => {
  assert.deepEqual(parseTikzFontPatch(String.raw`\small\fontsize{6}{7}\selectfont`), {
    sizePt: 6,
    baselineSkipPt: 7,
    source: "node-option"
  });
  assert.deepEqual(parseTikzFontPatch(String.raw`\fontsize{6}{7}\selectfont\Large`), {
    sizePt: 14.4,
    baselineSkipPt: 18,
    source: "node-option"
  });
  assert.deepEqual(parseTikzFontPatch(String.raw`\small\fontsize{0}{7}\selectfont`), {
    sizePt: 9,
    baselineSkipPt: 11,
    source: "node-option"
  });
});

test("parses the last named size from the document font profile", () => {
  assert.deepEqual(parseTikzFontPatch(String.raw`\tiny\Large\small`, { source: "scope" }), {
    sizePt: 9,
    baselineSkipPt: 11,
    source: "scope"
  });
});

test("merges font family weight style and variant without resetting inherited size", () => {
  const inherited = fontSpecFromSizeCommand(String.raw`\small`, { source: "library-role" });
  const patch = parseTikzFontPatch(String.raw`\sffamily\bfseries\itshape\scshape`, {
    source: "node-option"
  });

  assert.deepEqual(mergeFontSpec(inherited, patch), {
    ...inherited,
    family: "sans-serif",
    weight: 700,
    style: "italic",
    variant: "small-caps",
    source: "node-option"
  });
});

test("ignores empty and irrelevant font text without changing the source", () => {
  assert.deepEqual(parseTikzFontPatch(""), {});
  assert.deepEqual(parseTikzFontPatch(String.raw`\color{red} ordinary text`, { source: "content-command" }), {});

  const inherited = fontSpecFromSizeCommand(String.raw`\small`, { source: "library-role" });
  assert.deepEqual(
    resolveFontSpec({
      document: createFontSpec(),
      libraryRole: inherited,
      contentCommand: parseTikzFontPatch(String.raw`\color{red}`, { source: "content-command" })
    }),
    inherited
  );
});

test("uses the canonical tiny scale in TikZ font parsing and text normalization", () => {
  assert.equal(fontScaleFromTikzFont(String.raw`\tiny`), 0.5);
  assert.equal(normalizeTikzText(String.raw`\tiny x`).scale, 0.5);
});

test("uses the canonical named size table for leading math font commands", () => {
  const parsed = parseMathText(String.raw`$\tiny x$`);

  assert.equal(parsed.scale, 0.5);
  assert.equal(parsed.explicitFontSize, "tiny");
  assert.equal(parsed.tex, "x");
});

test("treats consecutive leading math sizes as absolute selections", () => {
  const tinyThenLarge = parseMathText(String.raw`$\tiny\Large x$`);
  const largeThenTiny = parseMathText(String.raw`$\Large\tiny x$`);

  assert.equal(tinyThenLarge.scale, 1.44);
  assert.equal(tinyThenLarge.explicitFontSize, "Large");
  assert.equal(tinyThenLarge.tex, "x");
  assert.equal(largeThenTiny.scale, 0.5);
  assert.equal(largeThenTiny.explicitFontSize, "tiny");
  assert.equal(largeThenTiny.tex, "x");
});

test("uses the last consecutive leading size in plain text without a line multiplier", () => {
  for (const [source, expectedScale] of [
    [String.raw`\tiny\Large x`, 1.44],
    [String.raw`\Large\tiny x`, 0.5]
  ]) {
    const normalized = normalizeTikzText(source);

    assert.equal(normalized.scale, expectedScale);
    assert.equal(normalized.explicitFontSize, true);
    assert.deepEqual(normalized.lines, ["x"]);
    assert.equal(normalized.lineStyles[0].scale, 1);
    assert.equal(normalized.lineStyles[0].explicitFontSize, false);
  }
});

test("renders tiny plain node text at half the normal size through the public API", () => {
  const normal = renderedPlainTextFontSize(String.raw`\begin{tikzpicture}\node {x};\end{tikzpicture}`);
  const tiny = renderedPlainTextFontSize(String.raw`\begin{tikzpicture}\node {\tiny x};\end{tikzpicture}`);

  assert.ok(Math.abs(tiny / normal - 0.5) < 1e-6);
});

function renderedPlainTextFontSize(source) {
  const { svg } = tikzToSvg(source, { mathRenderer: "svg-text" });
  const sizes = [...svg.matchAll(/<text\b[^>]*\bfont-size="([^"]+)"/g)].map((match) => Number(match[1]));
  assert.equal(sizes.length, 1);
  assert.ok(Number.isFinite(sizes[0]));
  return sizes[0];
}
