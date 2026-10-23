import assert from "node:assert/strict";
import test from "node:test";
import { renderSvg, tikzToSvg } from "../src/index.js";
import { layoutNativeMath, scaleNativeMathBox } from "../src/tex/mathBox.js";
import { relativeMathParseOptions, readScaledMath } from "../src/tex/relativeMath.js";
import { normalizeTikzText, readDollarMathSpan } from "../src/tikz/text.js";
import { measureMathBoxPt } from "../src/renderers/svg/mathNode.js";
import { nativeMathGroups } from "./helpers/native-math-svg.js";

const ptPerCm = 72.27 / 2.54;
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.001,
  `${label}: ${actual} TeX pt differs from native ${expected} TeX pt`);

test("scalebox scales the completed math box instead of selecting five-point fonts", () => {
  for (const mathRenderer of [undefined, "svg-text"]) {
    const svg = renderSvg({ items: [{ type: "textNode", x: 0, y: 0,
      text: String.raw`\scalebox{.5}{$\times 1$}`, style: { fill: "blue" } }], coordinates: {} },
    { mathRenderer, margin: 0 });
    const view = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    close(view[2] / 100 * ptPerCm, 6.38890, "scaled width");
    close(view[3] / 100 * ptPerCm, 3.22221 + 0.41666, "scaled height plus depth");
    const [group] = nativeMathGroups(svg);
    assert.equal(group.text, "\u00d71");
    assert.deepEqual(group.glyphs.map(glyph => glyph.family), ["TikZKitCMSY10", "TikZKitCMR10"]);
    assert.ok(group.glyphs.every(glyph => glyph.size === 5 && glyph.fill === "blue"));
  }
});

test("interpreted scalebox nodes share native scaled measurement and glyph geometry", () => {
  for (const mathRenderer of [undefined, "svg-text"]) {
    const result = tikzToSvg(String.raw`\begin{tikzpicture}
      \node[inner sep=0pt,outer sep=0pt,anchor=base west] (n) at (0,0) {\scalebox{.5}{$\times 1$}};
    \end{tikzpicture}`, { mathRenderer, margin: 0 });
    assert.deepEqual(result.diagnostics, []);
    const node = result.ir.items.find(item => item.type === "textNode");
    close(node.nodeLayoutWidth * ptPerCm, 6.38890, "node width");
    close(node.nodeLayoutHeight * ptPerCm, 3.22221 + 0.41666, "node height");
    const [group] = nativeMathGroups(result.svg);
    close(group.x / group.scale, 0, "base-west x");
    close(group.y / group.scale, 0, "base-west baseline");
    assert.deepEqual(group.glyphs.map(glyph => glyph.family), ["TikZKitCMSY10", "TikZKitCMR10"]);
    assert.ok(group.glyphs.every(glyph => glyph.size === 5));
  }
});

// Independent dimensions from compact-scalebox-metrics.tex, not renderer output.
const nativeCases = [
  [String.raw`\scalebox{.5}{$\times1$}`, 10, [6.38890, 3.22221, 0.41666]],
  [String.raw`\scalebox{.37}{$\times1$}`, 10, [4.72772, 2.38440, 0.30832]],
  [String.raw`\scalebox{1.5}{$x_1$}`, 10, [15.30210, 6.45831, 2.24997]],
  [String.raw`\scalebox{.5}{$\frac{1}{x+y}$}`, 10, [8.69019, 4.22421, 2.40475]],
  [String.raw`\scalebox{.5}{$\times1$}`, 8, [5.43063, 2.57777, 0.41669]],
  [String.raw`{\large\scalebox{.5}{$x_1$}}`, 10, [5.71355, 2.58333, 0.90000]],
  [String.raw`\scalebox{.5}{\large$\times1$}`, 10, [7.60414, 3.86665, 0.50000]],
  [String.raw`\scalebox{.5}{\scalebox{1.5}{$\sin x$}}`, 10, [14.74477, 5.00894, 0]],
  [String.raw`\scalebox{2}{$\times1$}`, 10, [25.55563, 12.88889, 1.66666]],
  [String.raw`\scalebox{.5}{$\mathlarger{\mathlarger{x}}$}`, 10, [3.33852, 2.58333, 0]]
];

test("uniform math scalebox dimensions match graphicx across fonts and nested boxes", () => {
  for (const [source, inheritedSize, expected] of nativeCases) {
    const normalized = normalizeTikzText(source);
    const { tex } = readDollarMathSpan(normalized.text);
    const size = normalized.explicitFontSize ? normalized.scale * 10 : inheritedSize;
    const box = layoutNativeMath(tex, { fontSizePt: size });
    assert.ok(box, source);
    ["width", "height", "depth"].forEach((key, index) => close(box[key], expected[index], `${source}: ${key}`));
    const measured = measureMathBoxPt(tex, { font: { sizePt: size } });
    ["widthPt", "heightPt", "depthPt"].forEach((key, index) =>
      close(measured[key], expected[index], `${source}: ${key}`));
    const result = tikzToSvg(String.raw`\begin{tikzpicture}\node[inner sep=0pt,outer sep=0pt` +
      (inheritedSize === 8 ? String.raw`,font=\footnotesize` : "") + `] {${source}};\\end{tikzpicture}`);
    assert.deepEqual(result.diagnostics, [], source);
    const node = result.ir.items.find(item => item.type === "textNode");
    close(node.nodeLayoutWidth * ptPerCm, expected[0], `${source}: node width`);
    close(node.nodeLayoutHeight * ptPerCm, expected[1] + expected[2], `${source}: node height`);
  }
});

test("box scaling preserves optical fonts, script positions, fraction rules and cached originals", () => {
  for (const source of [String.raw`x_1`, String.raw`\frac{1}{x+y}`]) {
    const original = layoutNativeMath(source);
    const snapshot = structuredClone(original);
    for (const scale of [0.37, 0.5, 1.5, 2]) {
      const wrapped = layoutNativeMath(`\\tikzkitmathscale{${scale}}{0}{${source}}`);
      const scaled = scaleNativeMathBox(original, scale);
      assert.deepEqual(wrapped.items, scaled.items);
      assert.equal(wrapped.items.length, original.items.length);
      wrapped.items.forEach((item, index) => {
        const unscaled = original.items[index];
        assert.equal(item.x, unscaled.x * scale);
        assert.equal(item.y, unscaled.y * scale);
        if (item.type === "glyph") {
          assert.equal(item.family, unscaled.family);
          assert.equal(item.size, unscaled.size * scale);
        } else {
          assert.equal(item.width, unscaled.width * scale);
          assert.equal(item.height, unscaled.height * scale);
        }
      });
      assert.deepEqual(layoutNativeMath(source), snapshot);
    }
  }
});

test("scaled colors and unsupported math retain the non-native renderer dispatch", () => {
  const colored = tikzToSvg(String.raw`\begin{tikzpicture}\node {\scalebox{.5}{\color{red}$x_1$}};\end{tikzpicture}`);
  const [group] = nativeMathGroups(colored.svg);
  assert.deepEqual(group.glyphs.map(glyph => [glyph.family, glyph.size, glyph.fill]),
    [["TikZKitCMMI10", 5, "red"], ["TikZKitCMR7", 3.5, "red"]]);
  const unsupported = String.raw`\widehat{x}`;
  assert.equal(layoutNativeMath(unsupported), null);
  const source = normalizeTikzText(`\\scalebox{.5}{$${unsupported}$}`).text.slice(1, -1);
  const original = measureMathBoxPt(unsupported);
  const scaled = measureMathBoxPt(source);
  for (const key of ["widthPt", "heightPt", "depthPt", "paintWidthPt", "paintHeightPt"]) {
    assert.equal(scaled[key], original[key] * 0.5, key);
  }
  for (const mathRenderer of [undefined, "svg-text"]) {
    const { svg, diagnostics } = tikzToSvg(`\\begin{tikzpicture}\\node {\\scalebox{.5}{$${unsupported}$}};\\end{tikzpicture}`,
      { mathRenderer });
    assert.deepEqual(diagnostics, []);
    assert.equal(nativeMathGroups(svg).length, 0);
    assert.match(svg, /class="tikz-math-scaled"[^>]*scale\(0\.5\)/);
    const body = svg.slice(svg.indexOf('<g class="tikz-math-scaled"'));
    assert.doesNotMatch(body, /tikzkitmathscale|NaN|Infinity/);
    if (!mathRenderer) assert.match(svg, /<foreignObject/);
  }
});

test("internal box scale parsing trusts only finite numeric scale data", () => {
  const attributes = { "data-tikzkit-scale": ".5", "data-tikzkit-size": "0" };
  const { trust } = relativeMathParseOptions;
  assert.equal(trust({ command: "\\htmlData", attributes }), true);
  for (const patch of [
    { "data-tikzkit-scale": "NaN" }, { "data-tikzkit-scale": "Infinity" },
    { "data-tikzkit-scale": "-1" }, { "data-tikzkit-scale": "0" },
    { "data-tikzkit-size": "-10" }, { "data-tikzkit-size": "10px" },
    { style: "position:fixed" }
  ]) assert.equal(trust({ command: "\\htmlData", attributes: { ...attributes, ...patch } }), false);
  assert.equal(trust({ command: "\\href", attributes }), false);
  assert.equal(readScaledMath(String.raw`\tikzkitmathscale{.5}{0}{x}y`), null);
  assert.equal(readScaledMath(String.raw`\tikzkitmathscale{.5}{0}{x`), null);
  assert.deepEqual(readScaledMath(String.raw`\tikzkitmathscale{.5}{0}{\frac{1}{x}}`),
    { scale: 0.5, size: 0, tex: String.raw`\frac{1}{x}` });
});
