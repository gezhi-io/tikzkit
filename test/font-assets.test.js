import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { fontFamiliesInMarkup, fontManifest, fontStyleSheet } from "../src/fonts/index.js";
import { renderScopedMathHtml, renderScopedMathStyleDef } from "../src/renderers/svg/mathHtml.js";

test("every packaged font has a MacTeX source, license, and matching digest", async () => {
  assert.ok(fontManifest.length > 30);
  for (const font of fontManifest) {
    assert.match(font.source, /^(fonts\/opentype\/public\/|fonts\/type1\/public\/)/);
    assert.ok(font.license);
    assert.match(font.sourceSha256, /^[a-f0-9]{64}$/);
    const bytes = await readFile(new URL(`../web/fonts/${font.file}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256);
  }
});

test("default SVG text and math fonts are self-contained MacTeX resources", () => {
  const { svg, diagnostics } = tikzToSvg(String.raw`\begin{tikzpicture}\node {Hello $\sum_{i=1}^{n}\mathbb{R}$};\end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  assert.doesNotMatch(svg, /url\(['"]?\/(?:fonts|node_modules)\//);
  assert.match(svg, /url\('data:font\/woff;base64,/);
  assert.match(svg, /font-family:TikZKitMath_AMS/);
});

test("one asset prefix applies to all text and math fonts", () => {
  const { svg } = tikzToSvg(String.raw`\node {Hello $\sum_{i=1}^{n}\mathbb{R}$};`, { fontUrlPrefix: "/manual/assets/fonts" });
  assert.doesNotMatch(svg, /url\(['"]?\/node_modules\//);
  const urls = [...svg.matchAll(/src:url\('([^']+)'\)/g)].map((match) => match[1]);
  assert.ok(urls.length > 2);
  assert.ok(urls.every((url) => url.startsWith("/manual/assets/fonts/") && url.endsWith(".woff")));
});

test("font CSS escapes resource prefixes and exposes a standalone font entry", async () => {
  const css = fontStyleSheet({ fontUrlPrefix: "bad');color:red;/*" });
  assert.doesNotMatch(css, /url\('bad'\)/);
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.exports["./fonts"], "./src/fonts/index.js");
  assert.equal(pkg.exports["./fonts/*"], "./web/fonts/*");
});

test("every math CSS font selector is covered by the family collector and manifest", () => {
  const css = renderScopedMathStyleDef();
  let selectorsChecked = 0;
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declaration = rule[2].match(/(?:^|;)font(?:-family)?:([^;]*)/)?.[1];
    const families = declaration?.match(/\bTikZKit\w+/g) || [];
    if (!families.length) continue;
    const style = rule[2].match(/(?:^|;)font-style:([^;]+)/)?.[1];
    const weight = rule[2].match(/(?:^|;)font-weight:([^;]+)/)?.[1];
    for (const family of families) {
      assert.ok(fontManifest.some((font) => font.family === family &&
        (!style || font.style === style) && (!weight || font.weight === Number(weight))), `${family} ${style || ""} ${weight || ""}`);
    }
    for (const selector of rule[1].split(",")) {
      const classes = [...selector.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
      assert.ok(classes.includes("tikzkit-math-scope"), selector);
      const markup = `<span class="${classes.join(" ")}">x</span>`;
      for (const family of families) {
        assert.ok(fontFamiliesInMarkup(markup).includes(family), `${selector} requires ${family}`);
      }
      selectorsChecked += 1;
    }
  }
  assert.ok(selectorsChecked >= 35, `only checked ${selectorsChecked} font selectors`);
});

const mathFontCases = [
  [String.raw`\mathbb{R}`, "TikZKitMath_AMS"],
  [String.raw`\mathbb{R}`, "TikZKitMath_AMSCaps"],
  [String.raw`\mathcal{A}`, "TikZKitMath_Caligraphic"],
  [String.raw`\mathscr{A}`, "TikZKitMath_Script"],
  [String.raw`\mathfrak{A}`, "TikZKitMath_Fraktur"],
  [String.raw`\mathsf{A}`, "TikZKitMath_SansSerif"],
  [String.raw`\mathsfit{A}`, "TikZKitMath_SansSerif"],
  [String.raw`\mathtt{A}`, "TikZKitMath_Typewriter"],
  [String.raw`\sum_{i=1}^n i`, "TikZKitMath_Size1"],
  [String.raw`\displaystyle\sum_{i=1}^n i`, "TikZKitMath_Size2"],
  [String.raw`\bigl( x \bigr)`, "TikZKitMath_Size1"],
  [String.raw`\Bigl( x \Bigr)`, "TikZKitMath_Size2"],
  [String.raw`\biggl( x \biggr)`, "TikZKitMath_Size3"],
  [String.raw`\Biggl( x \Biggr)`, "TikZKitMath_Size4"],
  [String.raw`\left\langle\begin{matrix}a\\b\\c\\d\\e\\f\end{matrix}\right\rangle`, "TikZKitMath_Size4"],
  [String.raw`\left\uparrow\begin{matrix}a\\b\\c\\d\\e\\f\end{matrix}\right\downarrow`, "TikZKitMath_Size1"],
  [String.raw`\left\lgroup\begin{matrix}a\\b\\c\\d\\e\\f\end{matrix}\right\rgroup`, "TikZKitMath_Size4"]
];

test("actual emitted math HTML collects all specialized fonts", () => {
  for (const [tex, family] of mathFontCases) {
    const html = renderScopedMathHtml(tex);
    assert.ok(fontFamiliesInMarkup(html).includes(family), `${tex} requires ${family}`);
  }
});

test("public SVG includes every font face for its emitted math families", () => {
  for (const [tex, family] of mathFontCases) {
    const { svg } = tikzToSvg(String.raw`\node {$${tex}$};`, { fontUrlPrefix: "/test-fonts" });
    const fontCss = svg.match(/<style class="tikzkit-default-font-style"><!\[CDATA\[([\s\S]*?)\]\]><\/style>/)?.[1];
    assert.ok(fontCss, tex);
    const faces = fontManifest.filter((entry) => entry.family === family);
    assert.ok(faces.length, `${family} has no packaged faces`);
    for (const font of faces) {
      const face = `font-family:${font.family};font-style:${font.style};font-weight:${font.weight};src:url('/test-fonts/${font.file}')`;
      assert.ok(fontCss.includes(face), `${tex} did not embed ${font.file}`);
    }
  }
});

test("AMS selection includes the native capital face and symbol fallback", () => {
  for (const className of ["mathbb", "textbb", "amsrm"]) {
    const markup = `<span class="tikzkit-math-scope tikzkit-math-${className}">R</span>`;
    const families = fontFamiliesInMarkup(markup);
    assert.ok(families.includes("TikZKitMath_AMSCaps"), className);
    assert.ok(families.includes("TikZKitMath_AMS"), className);
  }
  assert.deepEqual(fontFamiliesInMarkup('<span style="font-family:TikZKitMath_AMS">R</span>'),
    ["TikZKitMath_AMS", "TikZKitMath_AMSCaps"]);
  assert.ok(!fontFamiliesInMarkup('<span style="font-family:TikZKitMath_AMSExtra">R</span>')
    .includes("TikZKitMath_AMSCaps"));
});

test("class matching is exact and ignores ordinary script sizing classes", () => {
  const html = '<span class="tikzkit-math-scope"><span class="tikzkit-math-size3 tikzkit-math-smaller tikzkit-math-mathsf-extra">x</span></span>';
  assert.deepEqual(fontFamiliesInMarkup(html), ["TikZKitMath_Main", "TikZKitMath_Math"]);
  assert.deepEqual(fontFamiliesInMarkup('<text>tikzkit-math-scope tikzkit-math-small-op</text>'), []);
  for (const [className, family] of [["small-op", "Size1"], ["large-op", "Size2"], ["delim-size1", "Size1"], ["delim-size4", "Size4"]]) {
    const markup = `<span class='tikzkit-math-scope tikzkit-math-${className}'>x</span>`;
    assert.ok(fontFamiliesInMarkup(markup).includes(`TikZKitMath_${family}`), className);
  }
  const svgOnlyDelimiter = renderScopedMathHtml(String.raw`\left(\rule{0pt}{6em}\right)`);
  assert.ok(svgOnlyDelimiter.includes("<svg"));
  assert.ok(!fontFamiliesInMarkup(svgOnlyDelimiter).some((family) => family.startsWith("TikZKitMath_Size")));
});

test("sansmath and Helvetica overrides retain their packaged text faces", () => {
  for (const [options, family] of [
    [{ mathVersion: "sans" }, "TikZKitCMUSans"],
    [{ mathVersion: "sans", sansFontFamily: "helvetica" }, "TikZKitHeros"]
  ]) {
    const html = renderScopedMathHtml(String.raw`\mathbf{A}+x`, options);
    assert.ok(fontFamiliesInMarkup(html).includes(family));
    const css = fontStyleSheet({ families: fontFamiliesInMarkup(html), fontUrlPrefix: "/test-fonts" });
    for (const font of fontManifest.filter((entry) => entry.family === family)) assert.ok(css.includes(font.file));
  }
});

test("embedded WOFF resources match every packaged font digest", () => {
  const css = fontStyleSheet();
  const data = [...css.matchAll(/src:url\('data:font\/woff;base64,([^']+)'\)/g)];
  assert.equal(data.length, fontManifest.length);
  for (let index = 0; index < fontManifest.length; index += 1) {
    const font = fontManifest[index];
    const bytes = Buffer.from(data[index][1], "base64");
    assert.equal(bytes.toString("ascii", 0, 4), "wOFF", font.file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256, font.file);
  }
});

function woffCodepoints(bytes) {
  let cmap;
  for (let index = 0; index < bytes.readUInt16BE(12); index += 1) {
    const record = 44 + index * 20;
    if (bytes.toString("ascii", record, record + 4) !== "cmap") continue;
    const offset = bytes.readUInt32BE(record + 4);
    const length = bytes.readUInt32BE(record + 8);
    cmap = bytes.subarray(offset, offset + length);
    if (length < bytes.readUInt32BE(record + 12)) cmap = inflateSync(cmap);
  }
  assert.ok(cmap, "font has no cmap");
  const result = new Set();
  for (let index = 0; index < cmap.readUInt16BE(2); index += 1) {
    const record = 4 + index * 8;
    const platform = cmap.readUInt16BE(record);
    const encoding = cmap.readUInt16BE(record + 2);
    if (platform !== 0 && !(platform === 3 && [1, 10].includes(encoding))) continue;
    const offset = cmap.readUInt32BE(record + 4);
    const format = cmap.readUInt16BE(offset);
    if (format === 4) {
      const count = cmap.readUInt16BE(offset + 6) / 2;
      const ends = offset + 14;
      const starts = ends + count * 2 + 2;
      const deltas = starts + count * 2;
      const ranges = deltas + count * 2;
      for (let segment = 0; segment < count; segment += 1) {
        const start = cmap.readUInt16BE(starts + segment * 2);
        const end = cmap.readUInt16BE(ends + segment * 2);
        const delta = cmap.readInt16BE(deltas + segment * 2);
        const rangeAddress = ranges + segment * 2;
        const range = cmap.readUInt16BE(rangeAddress);
        for (let cp = start; cp <= end && cp < 0xffff; cp += 1) {
          const raw = range ? cmap.readUInt16BE(rangeAddress + range + (cp - start) * 2) : cp;
          const glyph = range && raw === 0 ? 0 : (raw + delta) & 0xffff;
          if (glyph) result.add(cp);
        }
      }
    } else if (format === 12) {
      for (let group = 0; group < cmap.readUInt32BE(offset + 12); group += 1) {
        const at = offset + 16 + group * 12;
        const start = cmap.readUInt32BE(at);
        const end = cmap.readUInt32BE(at + 4);
        const glyph = cmap.readUInt32BE(at + 8);
        for (let cp = start; cp <= end; cp += 1) if (glyph + cp - start) result.add(cp);
      }
    }
  }
  return result;
}

test("math private-use slots contain documented native TeX glyphs", async () => {
  const required = {
    "Math-Italic": [0xe131, 0xe237],
    "Math-BoldItalic": [0xe131, 0xe237],
    "Main-Regular": [0xe020],
    "Main-Bold": [0xe020],
    "AMS-Regular": [0xe006, 0xe007, 0xe008, 0xe009, 0xe00c, 0xe00d, 0xe00e, 0xe00f,
      0xe010, 0xe011, 0xe016, 0xe017, 0xe018, 0xe019, 0xe01a, 0xe01b],
    "Size4-Regular": [0xe000, 0xe001, 0xe150, 0xe151, 0xe152, 0xe153]
  };
  for (const [face, codepoints] of Object.entries(required)) {
    const font = fontManifest.find((entry) => entry.file === `TikZKitMath_${face}.woff`);
    const cmap = woffCodepoints(await readFile(new URL(`../web/fonts/${font.file}`, import.meta.url)));
    for (const cp of codepoints) {
      const key = `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
      assert.ok(cmap.has(cp), `${face} lacks ${key}`);
      const alias = font.aliases?.[key];
      assert.match(alias?.source || "", /^fonts\/type1\/public\/amsfonts\//);
      assert.match(alias.sourceSha256, /^[a-f0-9]{64}$/);
      assert.equal(alias.license, "OFL-AMSFonts.txt");
      assert.ok(Number.isInteger(alias.sourceCode));
    }
  }
});

test("role subsets retain metric coverage and explicit unsupported slots", async () => {
  const metricsSource = await readFile(new URL("../node_modules/katex/src/fontMetricsData.js", import.meta.url));
  const { default: metrics } = await import(`data:text/javascript;base64,${metricsSource.toString("base64")}`);
  for (const font of fontManifest.filter((entry) => entry.family.startsWith("TikZKitMath_"))) {
    const cmap = woffCodepoints(await readFile(new URL(`../web/fonts/${font.file}`, import.meta.url)));
    if (font.family === "TikZKitMath_AMSCaps") {
      assert.deepEqual([...cmap].sort((a, b) => a - b), Array.from({ length: 26 }, (_, i) => 65 + i));
      continue;
    }
    assert.ok(font.coverage, `${font.file} has no coverage report`);
    const expectedMissing = font.file === "TikZKitMath_Main-Regular.woff" ? ["U+23B0", "U+23B1"]
      : font.file === "TikZKitMath_AMS-Regular.woff" ? ["U+21E0", "U+21E2"]
      : font.file === "TikZKitMath_Fraktur-Bold.woff" ? ["U+E300", "U+E307"] : [];
    assert.deepEqual(font.coverage.missing, expectedMissing, font.file);
    const required = Object.keys(metrics[font.coverage.metricsFont]).map(Number);
    const missing = required.filter((cp) => !cmap.has(cp)).map((cp) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
    assert.deepEqual(missing, expectedMissing, `${font.file} cmap does not match its coverage report`);
    assert.equal(font.coverage.required, required.length);
    assert.equal(font.coverage.covered + font.coverage.missing.length, font.coverage.required);
    assert.ok(cmap.size < 700, `${font.file} still duplicates the broad LM math cmap`);
  }
});

test("common semantic macros emit the mapped private-use slots", () => {
  const html = renderScopedMathHtml(String.raw`\imath+\jmath+\not\equiv+\lvertneqq+\nshortmid+\varsubsetneqq`);
  for (const cp of [0xe131, 0xe237, 0xe020, 0xe00c, 0xe006, 0xe017]) {
    assert.ok(html.includes(String.fromCodePoint(cp)), `missing emitted U+${cp.toString(16)}`);
  }
});
