import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";
import { layoutNativeMath } from "../src/tex/mathBox.js";
import { layoutNativeText } from "../src/tex/textBox.js";
import { nativeMathGroups } from "./helpers/native-math-svg.js";

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.001,
  `${label}: ${actual} TeX pt differs from MacTeX ${expected} TeX pt`);

test("ordinary math uses the same native TFM boxes as structured formulas", () => {
  // Independent pdfTeX values: fixtures/compact-math-anchor-metrics.tex.
  for (const [tex, size, width, height, depth] of [
    ["x", 10, 5.71527, 4.30554, 0],
    ["y", 10, 5.26160, 4.30554, 1.94444],
    ["r", 10, 4.78937, 4.30554, 0],
    ["\\alpha", 10, 6.43404, 4.30554, 0],
    ["\\sin x", 10, 19.65970, 6.67859, 0],
    ["x+y", 10, 23.19900, 5.83333, 1.94444],
    ["\\cdot", 10, 2.77779, 4.44444, 0],
    ["\\pi", 10, 6.05905, 4.30554, 0],
    ["x=y", 10, 24.31009, 4.30554, 1.94444],
    ["x", 8, 4.78477, 3.44444, 0],
    ["x", 12, 6.67703, 5.16667, 0]
  ]) {
    const box = layoutNativeMath(tex, { fontSizePt: size });
    assert.ok(box, `${tex}/${size}: native layout must not require a fraction or script`);
    close(box.width, width, `${tex} width`);
    close(box.height, height, `${tex} height`);
    close(box.depth, depth, `${tex} depth`);
  }
  assert.equal(layoutNativeMath("x", { mathVersion: "sans" }), null);
  assert.equal(layoutNativeMath("\\widehat{x}"), null);
});

test("directional anchors use native outer separation and per-axis inner separation", () => {
  for (const [options, x, y] of [
    ["above,thick", 0, 5.88574],
    ["anchor=south,thick", 0, 5.88574],
    ["below,line width=2pt", 0, -6.48575],
    ["anchor=north,line width=2pt", 0, -6.48575],
    ["left,outer sep=3pt", -9.19061, 0],
    ["anchor=east,outer sep=3pt", -9.19061, 0],
    ["above=2pt,rotate=30,inner xsep=5pt,inner ysep=1pt", -1.67638, 4.90358],
    ["anchor=south,yshift=2pt,rotate=30,inner xsep=5pt,inner ysep=1pt", -1.67638, 4.90358],
    ["above,anchor=center", 0, 0],
    ["anchor=center,above", 0, 5.68575]
  ]) {
    const result = tikzToSvg(`\\begin{tikzpicture}\\node[${options}] (probe) at (0,0) {$x$};\\end{tikzpicture}`);
    assert.deepEqual(result.diagnostics, []);
    const node = result.ir.coordinates.probe;
    close(node.x * 72.27 / 2.54, x, `${options} center x`);
    close(node.y * 72.27 / 2.54, y, `${options} center y`);
  }
});

test("default browser and SVG-text paint ordinary formulas from identical native boxes", () => {
  const source = readFileSync(new URL("fixtures/compact-math-anchors/glyphs.tex", import.meta.url), "utf8");
  const browser = tikzToSvg(source);
  const exported = tikzToSvg(source, { mathRenderer: "svg-text" });
  assert.deepEqual(browser.diagnostics, []);
  assert.deepEqual(exported.diagnostics, []);
  const groups = nativeMathGroups(browser.svg);
  assert.equal(groups.length, 11);
  assert.equal(groups.flatMap(group => group.glyphs).length, 18);
  assert.deepEqual(groups, nativeMathGroups(exported.svg));
  assert.ok(!browser.svg.includes("foreignObject"));
});

test("node labels include both parent and label border separation without scaling text", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}[scale=.85]
    \path[rotate=60] (0,0) -- (2.5,0) node[circle,inner sep=1pt,label=above:$P$] (e) {};
  \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  const label = result.ir.items.find(item => item.type === "textNode" && item.text === "$P$");
  const parent = result.ir.coordinates.e;
  // pgfpointanchor returns local coordinates, so undo the picture's inverse CTM.
  const actual = (label.y - parent.y) * 72.27 / 2.54;
  const expected = (71.6719 - 61.59833) * .85;
  assert.ok(Math.abs(actual - expected) < .003, `${actual} vs ${expected} TeX pt`);
});

test("styled math nodes select the optical font before computing their border", () => {
  for (const [shape, tex, width, total] of [
    ["rectangle", String.raw`\log x`, 18.73254, 8],
    ["circle", "x/2", 14.49298, 9]
  ]) {
    const result = tikzToSvg(`\\begin{tikzpicture}\\node[draw,${shape},font=\\small,inner xsep=0pt,inner ysep=1pt,tikzkit datavis legend math metrics] {$${tex}$};\\end{tikzpicture}`);
    const box = result.ir.items.find(item => item.type === "nodeBox");
    const diameter = Math.hypot(width, total + 2);
    close(box.width * 72.27 / 2.54, shape === "circle" ? diameter : width, `${shape} width`);
    close(box.height * 72.27 / 2.54, shape === "circle" ? diameter : total + 2, `${shape} height`);
  }
});

test("painted legend nodes keep the text centered within the actual shape", () => {
  for (const shape of ["rectangle", "circle", "ellipse"]) {
    const render = (legend) => tikzToSvg(`\\begin{tikzpicture}\\node[${legend ? "axis legend," : ""}draw,${shape},anchor=west,font=\\small,inner xsep=0pt,inner ysep=1pt] {$x/2$};\\end{tikzpicture}`);
    const ordinary = render(false);
    const legend = render(true);
    assert.deepEqual(legend.diagnostics, []);
    const node = legend.ir.items.find(item => item.type === "textNode");
    assert.equal(node.svgTextAnchor, undefined, `${shape}: the shape anchor is not the text anchor`);
    assert.deepEqual(nativeMathGroups(legend.svg), nativeMathGroups(ordinary.svg));
  }
});

test("horizontal typewriter split anchors retain the CMTT glyph baseline", () => {
  const result = tikzToSvg(String.raw`\tikzset{font=\tt,every picture/.style={thick}}
    \begin{tikzpicture}\node[rectangle split,rectangle split horizontal,rectangle split parts=5,
      rectangle split empty part width=1.5,draw] (a)
      {\nodepart{one}\nodepart{two}7\nodepart{three}\nodepart{four}11\nodepart{five}};
    \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  const box = result.ir.items.find(item => item.type === "nodeBox");
  close(box.height * 72.27 / 2.54, 12.77706, "split height");
  for (const [index, nativeX] of [[1, -18.24365], [3, 7.74376]]) {
    const part = box.shapeData.rectangleSplit.parts[index];
    close(part.originX * 72.27 / 2.54, nativeX, "split text origin x");
    close(part.originY * 72.27 / 2.54, -3.05556, "split text baseline");
  }
});

test("typewriter labels retain their native descenders and font in both renderers", () => {
  const box = layoutNativeText("git pull", { family: "monospace", sizePt: 10 });
  close(box.width, 41.99963, "typewriter width");
  close(box.height + box.depth, 8.33334, "typewriter height and depth");
  assert.equal(layoutNativeText("git pull", { family: "monospace", sizePt: 9 }), null);
  const source = String.raw`\begin{tikzpicture}\draw[very thick](0,0)--node[above]{\tt git pull}(3,0);\end{tikzpicture}`;
  for (const mathRenderer of [undefined, "svg-text"]) {
    const result = tikzToSvg(source, { mathRenderer });
    assert.deepEqual(result.diagnostics, []);
    const node = result.ir.items.find(item => item.type === "textNode");
    close(node.y * 72.27 / 2.54, 8.09964, "typewriter label center");
    assert.match(result.svg, /class="tikz-text-native"/);
    assert.equal([...result.svg.matchAll(/<text[^>]*font-family="TikZKitMath_Typewriter"/g)].length, 7);
  }
});

test("native typewriter dispatch preserves rich colors, inline boxes, and font runs", async () => {
  const source = readFileSync(new URL("fixtures/compact-math-renderer-gene/colors.tex", import.meta.url), "utf8");
  for (const mathRenderer of [undefined, "svg-text"]) {
    for (const convert of [tikzToSvg, tikzToSvgAsync]) {
      const result = await convert(source, { mathRenderer });
      assert.deepEqual(result.diagnostics, []);
      const runs = [...result.svg.matchAll(/<(?:text|tspan)\b([^>]*)>([^<]+)<\/(?:text|tspan)>/g)]
        .map(match => ({ text: match[2], fill: match[1].match(/\bfill="([^"]+)"/)?.[1] }));
      const painted = color => runs.filter(run => run.fill === color).map(run => run.text).join("");
      assert.equal(painted("blue"), "GUGV");
      assert.equal(painted("#006400"), "CAU");
      assert.equal(painted("white"), "UAGSTOP");
      assert.ok(/<rect[^>]*fill="red"/.test(result.svg), "red inline box");
    }
    const mixed = tikzToSvg(String.raw`\begin{tikzpicture}\node{\tt A\textbf{B}C};\end{tikzpicture}`, { mathRenderer });
    assert.ok(/<tspan[^>]*font-weight="700"[^>]*>B<\/tspan>/.test(mixed.svg), "bold B run");
    assert.ok(!mixed.svg.includes("tikz-text-native"), "a uniform TFM run must not flatten mixed font commands");
  }
});

test("typewriter base anchors use the same CMTT height and depth as glyph painting", () => {
  for (const text of ["GTGCATCTGACTCCTGAGGAGTAG", "git pull"]) {
    const box = layoutNativeText(text, { family: "monospace", sizePt: 10 });
    for (const anchor of ["base", "base west", "base east"]) {
      const result = tikzToSvg(`\\begin{tikzpicture}\\node[anchor=${anchor},inner sep=0pt,outer sep=0pt] (n) at (0,0) {\\tt ${text}};\\end{tikzpicture}`);
      assert.deepEqual(result.diagnostics, []);
      const node = result.ir.items.find(item => item.type === "textNode");
      close(node.y * 72.27 / 2.54, (box.height - box.depth) / 2, `${text}/${anchor} center`);
      const [, baseline] = result.svg.match(/class="tikz-text-native"[^>]*transform="translate\([^ ]+ ([-\d.]+)\)/);
      assert.ok(Math.abs(Number(baseline)) < 1e-5, `${text}/${anchor}: the literal hbox baseline must stay at y=0`);
    }
  }
});

test("bare inline math preserves the native arrow picture height", () => {
  const source = readFileSync(new URL("fixtures/path-stroke-bounds/arrow.tex", import.meta.url), "utf8");
  for (const mathRenderer of [undefined, "svg-text"]) {
    const result = tikzToSvg(source, { mathRenderer, margin: 0 });
    assert.deepEqual(result.diagnostics, []);
    const [, width, height] = result.svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/);
    assert.ok(Math.abs(Number(width) - 57.70547 * 72 / 72.27) < 0.01);
    assert.ok(Math.abs(Number(height) - 11.77148 * 72 / 72.27) < 0.01);
  }
});
