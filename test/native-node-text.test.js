import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";
import { renderSvg } from "../src/renderers/svg/renderSvg.js";
import { nativePlainTextBox } from "../src/renderers/svg/plainTextNode.js";
import { normalizeTikzText } from "../src/tikz/text.js";
import { createSvgTextEngine } from "../src/renderers/svg/textEngine.js";

test("default literal node paint uses the measured TeX hbox baseline", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}\node[draw] {Koordinatenfrei};\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /data-text-layout="cm-tex-box"/);
  assert.doesNotMatch(result.svg, /dominant-baseline="middle"/);
});

test("native literal selection respects resolved size, family and explicit stretching", () => {
  const normalized = normalizeTikzText("ABC");
  const item = { type: "textNode", x: 0, y: 0, text: "ABC", style: { fontScale: .7 } };
  const small = nativePlainTextBox(item, normalized);
  assert.ok(small);
  assert.ok(small.items.every(g => g.size === 7 && g.family === "TikZKitCMR7"));
  const sans = nativePlainTextBox({ ...item, font: { family: "sans-serif" } }, normalized);
  assert.ok(sans.items.every(g => g.size === 7 && g.family === "TikZKitCMSS8"));
  assert.equal(nativePlainTextBox({ ...item, font: { family: "Helvetica" } }, normalized), null);
  assert.equal(nativePlainTextBox({ ...item, style: { textWidthScaleExplicit: true, textWidthScale: 2 } }, normalized), null);
  const bold = nativePlainTextBox({ ...item, font: { sizePt: 12, weight: 700 }, style: {} }, normalized);
  assert.ok(bold.items.every(g => g.family === "TikZKitCMBX12" && g.size === 12));
});

test("literal text engine cache and direct SVG share native baseline paint", () => {
  const engine = createSvgTextEngine();
  const measured = engine.measure({ mode: "text", text: "gyjp", fontSizePt: 10 });
  const payload = engine.renderFromCache(measured.cacheKey);
  assert.equal(measured.measurementKind, "cm-text-box");
  assert.match(payload.body, /data-text-layout="cm-tex-box"/);
  const svg = renderSvg({ items: [{ type: "textNode", x: 0, y: 0, text: "gyjp", style: {} }], coordinates: {} });
  assert.match(svg, /data-text-layout="cm-tex-box"/);
});

test("literal node hboxes and anchors match independent MacTeX measurements", () => {
  // native-node-text-metrics.tex measures TFM boxes and PGF saved anchors.
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .001,
    `${actual} != MacTeX ${expected}pt`);
  for (const [text, font, width, height, depth] of [
    ["Koordinatenfrei", {}, 68.94463, 6.94444, 0],
    ["gyjp", {}, 18.88896, 6.67859, 1.94444],
    ["measurements", {}, 61.52788, 6.15079, 0],
    ["measurements", { sizePt: 7 }, 48.99606, 4.30556, 0],
    ["Mixed ABC", { sizePt: 12, weight: 700 }, 71.38196, 8.33331, 0],
    ["tiny capitals", { sizePt: 5 }, 37.32687, 3.47221, .97221],
    ["=", {}, 7.7778, 3.66875, 0]
  ]) {
    const box = nativePlainTextBox({ text, font }, normalizeTikzText(text));
    assert.ok(box, text);
    close(box.width, width); close(box.height, height); close(box.depth, depth);
  }
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \node[draw,inner sep=0pt,anchor=base] (a) at (0,1) {gyjp};
    \node[draw,font=\large\bfseries,anchor=west] (b) at (1.5,-1) {Mixed ABC};
  \end{tikzpicture}`);
  const a = result.ir.items.find(item => item.type === "textNode" && item.text === "gyjp");
  const b = result.ir.items.find(item => item.type === "textNode" && item.text === "Mixed ABC");
  close(a.y * 72.27 / 2.54, 30.81982);
  close(b.x * 72.27 / 2.54, 81.90306);
});

test("sync and async conversion share literal-text node geometry", async () => {
  const source = String.raw`\begin{tikzpicture}\node[draw,font=\large\bfseries,anchor=west] at (1,2) {Mixed ABC};\end{tikzpicture}`;
  const sync = tikzToSvg(source);
  const asyncResult = await tikzToSvgAsync(source);
  assert.deepEqual(asyncResult.diagnostics, []);
  assert.deepEqual(asyncResult.ir.items, sync.ir.items);
  assert.match(sync.svg, /data-text-layout="cm-tex-box"/);
  assert.match(sync.svg, /font-family="TikZKitCMBX12"/);
});
