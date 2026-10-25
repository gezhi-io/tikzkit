import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTikzText } from "../src/tikz/text.js";
import { layoutMultilineTeXText } from "../src/tikz/textMetrics.js";
import { layoutNativeTextRun } from "../src/tex/textBox.js";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { nativeWrappedParagraphBox } from "../src/renderers/svg/paragraphText.js";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";
import { assertNativeText } from "./helpers/native-math-svg.js";

const text = String.raw`{\huge\bf IF}\\{\scriptsize Instruction fetch}`;
const font = { family: "serif", sizePt: 10, baselineSkipPt: 12, weight: 400 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .001,
  `${actual} vs independent MacTeX ${expected} pt`);

test("degree symbols retain the CMSY outline and local math style changes", () => {
  const box = layoutNativeMath(String.raw`T=25^\circ\mathrm{C},\quad R=10\Omega,\quad \scriptscriptstyle\varphi=63^\circ`);
  assert.ok(box, "a degree symbol must not send the entire formula to fallback");
  const glyphs = box.items.filter(item => item.type === "glyph");
  assert.equal(glyphs[0].size, 10);
  const degrees = glyphs.filter(g => g.text === "\u25e6");
  assert.deepEqual(degrees.map(g => [g.family, g.size]), [["TikZKitCMSY7", 7], ["TikZKitCMSY5", 5]]);
  assert.equal(glyphs.find(g => g.text === "C").family, "TikZKitCMR10");
  assert.equal(glyphs.find(g => g.text === "φ").size, 5);
  // An explicit kern does not erase TeX's pending punctuation atom.
  close(layoutNativeMath(String.raw`a,\quad b`).width, layoutNativeMath("a,b").width + 10);
});

test("scoped CM hboxes preserve native optical widths, heights and descenders", () => {
  // Independent values from fixtures/scoped-node-font-metrics.tex.
  for (const [source, width, height, depth] of [
    [String.raw`\huge\bf IF`, 23.35652, 14.22995, 0],
    [String.raw`\scriptsize Instruction fetch`, 58.0989, 4.8611, 0],
    [String.raw`A{\large B{\bfseries C}D}E{\scriptsize fg}H`, 55.3152, 8.23334, 1.3611],
    [String.raw`a\textbf{Bold}b{\color{red}\Large XY}c`, 59.6536, 9.84, 0]
  ]) {
    const box = layoutNativeTextRun(normalizeTikzText(source), font);
    assert.ok(box, source);
    close(box.width, width);
    close(box.height, height);
    close(box.depth, depth);
  }
});

test("native font groups restore size, series and color after nested declarations", () => {
  const source = String.raw`A{\large B{\bfseries C}D}E{\scriptsize fg}H`;
  const box = layoutNativeTextRun(normalizeTikzText(source), font);
  assert.ok(box);
  assert.deepEqual(box.items.map(g => g.size), [10, 12, 12, 12, 10, 7, 7, 10]);
  assert.deepEqual(box.items.map(g => g.weight), [400, 400, 700, 400, 400, 400, 400, 400]);
  assert.ok(box.items.every(g => g.y === 0), "font changes share one TeX baseline");
  const color = layoutNativeTextRun(normalizeTikzText(String.raw`a{\color{red}\Large XY}b`), font);
  assert.deepEqual(color.items.map(g => g.color || null), [null, "red", "red", null]);
});

test("aligned scoped fonts use the outer baseline grid and native lineskip", () => {
  for (const [source, width, height, depth, baselines] of [
    [text, 58.0989, 26.22995, 0, [0, 12]],
    [String.raw`{\small\bfseries gyp}\\{\Large ABC}\\{\tiny pq}XYZ`, 30.738, 28, .97221, [0, 12, 24]]
  ]) {
    const box = layoutMultilineTeXText(normalizeTikzText(source), font);
    assert.ok(box);
    close(box.width, width);
    close(box.height, height);
    close(box.depth, depth);
    assert.deepEqual(box.rows.map(row => row.baseline), baselines);
  }
});

test("explicit short text-width rows retain mixed native fonts and centered hboxes", () => {
  const box = nativeWrappedParagraphBox({ text, wrapWidth: 65 / (72.27 / 2.54),
    textWrapMode: "flush", textAlign: "center", font }, normalizeTikzText(text));
  assert.ok(box);
  close(box.width, 65);
  close(box.height + box.depth, 26.22995);
  close(box.items[0].x, (65 - 23.35652) / 2);
});

test("TikZ paragraph word glue keeps the outer font's fixed spaces across scoped sizes", () => {
  const centered = nativeWrappedParagraphBox({ text, wrapWidth: 65 / (72.27 / 2.54),
    textWrapMode: "center", textAlign: "center", font }, normalizeTikzText(text));
  const flush = nativeWrappedParagraphBox({ text, wrapWidth: 65 / (72.27 / 2.54),
    textWrapMode: "flush", textAlign: "center", font }, normalizeTikzText(text));
  close(centered.rows[1].width, 58.73743);
  close(flush.rows[1].width, 58.0989);
  close(centered.items[2].x, (65 - 58.73743) / 2);
  const sentence = layoutNativeTextRun(normalizeTikzText(String.raw`\scriptsize End. Next`),
    { ...font, spaceSkipPt: 3.333, extraSpaceSkipPt: 5 });
  close(sentence.width, 38.25711);
});

test("NFSS typewriter sizes use the MacTeX 8pt, 9pt and 12pt design faces", () => {
  for (const [sizePt, face, width, height] of [[7, 8, 29.75037, 4.27777],
    [9, 9, 37.79956, 5.49998], [12, 12, 49.40002, 7.33333]]) {
    const box = layoutNativeTextRun({ raw: "AGTAAG-A", text: "AGTAAG-A" },
      { ...font, family: "monospace", sizePt });
    assert.ok(box, `expected native cmtt${face} at ${sizePt}pt`);
    close(box.width, width);
    close(box.height, height);
    assert.ok(box.items.every(glyph => glyph.family === `TikZKitCMTT${face}`));
  }
});

test("geometric node scaling preserves the selected optical face and scoped font sizes", () => {
  const source = String.raw`AT{\scriptsize AT}`;
  const box = layoutNativeTextRun(normalizeTikzText(source),
    { ...font, family: "monospace", sizePt: 7, baselineSkipPt: 8.4, geometricScale: .7 });
  assert.ok(box);
  assert.deepEqual(box.items.map(g => g.family), ["TikZKitCMTT10", "TikZKitCMTT10", "TikZKitCMTT8", "TikZKitCMTT8"]);
  box.items.forEach((g, i) => close(g.size, i < 2 ? 7 : 4.9));
  close(box.width, (10.49991 + 7.43759) * .7);
});

test("TikZ node font keys replace the picture font program before typesetting", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}[font=\ttfamily]
    \node[font=\scriptsize] {AT};
    \node[font=\scriptsize\ttfamily] at (1,0) {AT};
  \end{tikzpicture}`);
  const nodes = result.ir.items.filter(item => item.type === "textNode");
  assert.deepEqual(nodes.map(n => [n.font.family, n.font.sizePt]), [["serif", 7], ["monospace", 7]]);
});

test("literal TeX groups in aligned rows are not flattened or rejected", () => {
  const box = layoutMultilineTeXText(normalizeTikzText(String.raw`AC{-}{-}A\\CC{-}{-}A`),
    { ...font, family: "monospace", sizePt: 7, baselineSkipPt: 8 });
  assert.ok(box);
  assert.equal(box.items.map(g => g.text).join(""), "AC--ACC--A");
  assert.ok(box.items.every(g => g.family === "TikZKitCMTT8"));
  close(box.rows[1].baseline, 8);
});

test("scoped node dimensions and sync/async paint use the same native hbox", async () => {
  const source = `\\begin{tikzpicture}\\node[draw,inner sep=0pt,outer sep=0pt] {${text}};\\end{tikzpicture}`;
  for (const mathRenderer of [undefined, "svg-text"]) {
    for (const result of [tikzToSvg(source, { mathRenderer }), await tikzToSvgAsync(source, { mathRenderer })]) {
      assert.deepEqual(result.diagnostics, []);
      const node = result.ir.items.find(item => item.type === "nodeBox");
      close(node.width * 72.27 / 2.54, 81.45543);
      close(node.height * 72.27 / 2.54, 14.22995);
      assert.ok(result.svg.includes('class="tikz-text-native"'));
      assert.ok(!result.svg.includes('dominant-baseline="middle"'));
    }
  }
});

test("native aligned and text-width base anchors use the last and first row respectively", () => {
  for (const [options, height, depth] of [["align=center", 26.22995, 0],
    ["text width=65pt,text centered", 14.22995, 12]]) {
    const source = `\\begin{tikzpicture}\\node[draw,inner sep=0pt,outer sep=0pt,anchor=base,${options}] {${text}};\\end{tikzpicture}`;
    const result = tikzToSvg(source);
    const node = result.ir.items.find(item => item.type === "nodeBox");
    close(node.height * 72.27 / 2.54, height + depth);
    close(node.y * 72.27 / 2.54, (height - depth) / 2);
  }
});

test("unsupported scoped text remains a complete fallback instead of losing controls", () => {
  for (const source of [String.raw`A\unknown{B}C`, String.raw`A{\itshape B}C`,
    String.raw`\fontsize{13}{16}\selectfont ABC`, String.raw`A{\large B`]) {
    assert.equal(layoutNativeTextRun(normalizeTikzText(source), font), null);
  }
});

test("an aligned row's ungrouped size declaration does not change the next row or outer baselineskip", () => {
  for (const [body, width] of [[String.raw`\small A\\B`, 7.08336], [String.raw`\small A\\\tiny B`, 6.93605]]) {
    const result = tikzToSvg(`\\begin{tikzpicture}\\node[draw,align=center,inner sep=0pt] {${body}};\\end{tikzpicture}`);
    const node = result.ir.items.find(item => item.type === "nodeBox");
    close(node.width * 72.27 / 2.54, width);
    close(node.height * 72.27 / 2.54, 18.14998);
  }
  const result = tikzToSvg(String.raw`\begin{tikzpicture}\node[align=center] {\bfseries\color{red}A\\B};\end{tikzpicture}`);
  const group = assertNativeText(result.svg, "AB");
  assert.deepEqual(group.glyphs.map(g => g.weight), [700, 400]);
  assert.deepEqual(group.glyphs.map(g => g.fill), ["red", "black"]);
});
