import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";

const source = readFileSync(new URL("fixtures/examples/latex-examples/cos-fixpoint.tex", import.meta.url), "utf8");
const pt = 72.27 / 2.54;
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.045,
  `${label}: ${actual}pt differs from MacTeX ${expected}pt`);

test("cos-fixpoint tick and axis-label centers follow native TeX node anchors", () => {
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  const clip = result.ir.items.find(item => item.clipRect)?.clipRect;
  const originY = (clip.minY + clip.maxY) / 2;
  // pgfplots-axis-text-metrics.tex: centers relative to current axis.origin.
  for (const [text, x, y] of [
    [String.raw`$\frac{\pi}{2}$`, 123.51210, -10.86673],
    [String.raw`$\pi$`, 247.02343, -7.81970],
    ["\u22121", -12.05571, -76.09100],
    ["\u22120.5", -15.94461, -38.04550],
    ["0.5", -12.05571, 38.04550],
    ["1", -8.16681, 76.09100],
    ["$x$", 265.33689, 5.68574],
    ["$y$", 6.16378, 84.65216]
  ]) {
    const node = result.ir.items.find(item => item.text === text);
    assert.ok(node, text);
    close(node.x * pt, x, `${text} x`);
    close((node.y - originY) * pt, y, `${text} y`);
  }
});

test("cos-fixpoint keeps six centered tick strokes and a text-driven enlarged canvas", () => {
  const result = tikzToSvg(source);
  const clip = result.ir.items.find(item => item.clipRect)?.clipRect;
  const originY = (clip.minY + clip.maxY) / 2;
  const ticks = result.ir.items.filter(item => item.subtype === "axis-tick");
  const centers = [[123.51210, 0], [247.02343, 0], [0, -76.09100],
    [0, -38.04550], [0, 38.04550], [0, 76.09100]];
  assert.equal(ticks.length, centers.length, "Native middle axes omit the origin tick");
  ticks.forEach((tick, i) => {
    const [a, b] = tick.commands;
    close((a.x + b.x) / 2 * pt, centers[i][0], `tick ${i} x`);
    close(((a.y + b.y) / 2 - originY) * pt, centers[i][1], `tick ${i} y`);
    close(Math.hypot(b.x - a.x, b.y - a.y) * pt, 0.15 * pt, `tick ${i} length`);
  });
  // Native PDF/SVG: 300.357bp x 182.336bp; stroke bounds vary below 0.3bp.
  const size = result.svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/);
  assert.ok(Math.abs(Number(size[1]) - 300.357) < 0.3);
  assert.ok(Math.abs(Number(size[2]) - 182.336) < 0.3);
});

test("numeric ticks use math glyphs without rewriting source or explicit text labels", async () => {
  for (const result of [tikzToSvg(source), await tikzToSvgAsync(source)]) {
    const numeric = result.ir.items.filter(item => ["\u22121", "\u22120.5", "0.5", "1"].includes(item.text));
    assert.equal(numeric.length, 4);
    assert.ok(numeric.every(item => item.style.mathMode === "number"));
    assert.ok(result.svg.includes('data-math-layout="cm-tex-box"'));
    assert.ok(!result.svg.includes("foreignObject"));
  }
  const explicit = tikzToSvg(String.raw`\begin{tikzpicture}\begin{axis}[xtick={0,1},xticklabels={Text,123},ytick=\empty]
    \addplot coordinates {(0,0)(1,1)};\end{axis}\end{tikzpicture}`);
  assert.ok(explicit.ir.items.filter(item => ["Text", "123"].includes(item.text)).every(item => !item.style.mathMode));
});

test("a PGFPlots node label uses the same math box for placement and paint", () => {
  const result = tikzToSvg(source);
  const clip = result.ir.items.find(item => item.clipRect)?.clipRect;
  const node = result.ir.items.find(item => item.text?.includes("0.739085"));
  close(node.x * pt, 105.73629, "annotation center x");
  close((node.y - (clip.minY + clip.maxY) / 2) * pt, 56.23770, "annotation center y");
  assert.equal(node.style.preferNativeMath, true);
});

test("axis-native text settings remain local to the axis environment", () => {
  const input = source.replace(String.raw`\end{axis}`, String.raw`\end{axis}\node at (0,-2) {$outside$};`);
  const result = tikzToSvg(input);
  const outside = result.ir.items.find(item => item.text === "$outside$");
  assert.ok(!outside.style.preferNativeMath);
});
