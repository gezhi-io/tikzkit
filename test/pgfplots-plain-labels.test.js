import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg, tikzToSvgAsync } from "../src/index.js";
import { createSvgTextEngine } from "../src/renderers/svg/textEngine.js";
import { layoutNativeText } from "../src/tex/textBox.js";

const source = readFileSync(new URL("fixtures/examples/latex-examples/activation-functions.tex", import.meta.url), "utf8");
const pt = 72.27 / 2.54;
const close = (actual, expected, label, tolerance = 0.045) => assert.ok(Math.abs(actual - expected) < tolerance,
  `${label}: ${actual}pt differs from MacTeX ${expected}pt`);

test("middle-axis ordinary labels share native CMR widths, heights and depths", async () => {
  // pgfplots-plain-label-metrics.tex measures the same axis with named labels.
  for (const result of [tikzToSvg(source), await tikzToSvgAsync(source)]) {
    assert.deepEqual(result.diagnostics, []);
    for (const [text, x, y] of [["x", 404.14671, 66.57121], ["y", 211.34058, 176.00124]]) {
      const node = result.ir.items.find(item => item.text === text);
      // PGF's right/above-origin anchors use fixed-point line intersections,
      // not the exact rectangular endpoint (0.08pt at this 16cm width).
      // Browser glyph positions have a separate, unchanged 0.35px gate at 3x.
      close(node.x * pt, x, `${text} center x`, 0.1);
      close(node.y * pt, y, `${text} center y`, 0.1);
      assert.equal(node.style.textWidthScale, 1, "native CMR needs no fitted width expansion");
    }
    assert.match(result.svg, /data-text-layout="cm-tex-box"/);
  }
});

test("native plain-text payload paints at the measured TeX baseline", () => {
  const engine = createSvgTextEngine();
  for (const [text, height, depth] of [["x", 4.30555, 0], ["y", 4.30555, 1.94445]]) {
    const metrics = engine.measure({ text, preferNativeText: true,
      font: { sizePt: 10, family: "serif", weight: 400, style: "normal" } });
    const factor = 100 / pt;
    close(metrics.height / factor, height + depth, `${text} total height`);
    close(metrics.baselineY / factor, height, `${text} baseline`);
    const payload = engine.renderFromCache(metrics.cacheKey);
    const transform = payload.body.match(/transform="translate\(([-\d.]+) ([-\d.]+)\) scale/);
    assert.ok(transform, "plain text must use the same TeX-box transform as its measurement");
    close(Number(transform[2]) / factor, (height - depth) / 2, `${text} paint baseline`);
    assert.match(payload.body, /dominant-baseline="alphabetic"/);
  }
});

test("native plain-text selection does not leak outside an axis or into unsupported text", () => {
  const result = tikzToSvg(source.replace(String.raw`\end{axis}`, String.raw`\end{axis}\node at (0,-2) {outside};`));
  assert.ok(!result.ir.items.find(item => item.text === "outside").style.preferNativeText);
  const engine = createSvgTextEngine();
  for (const text of [String.raw`\textit{italic}`, "two\nlines", " x ", "office   AV"]) {
    const metrics = engine.measure({ text, preferNativeText: true });
    assert.ok(!engine.renderFromCache(metrics.cacheKey).body.includes('data-text-layout="cm-tex-box"'));
  }
  const mixed = engine.measure({ text: "mixed $x$", preferNativeText: true });
  assert.ok(engine.renderFromCache(mixed.cacheKey).body.includes('data-text-layout="cm-tex-box"'));
});

test("native text uses CM optical sizes, ligatures and kerning from local TFM", () => {
  for (const [sizePt, weight, width, height] of [
    [10, 400, 39.44449, 6.94444], [8, 400, 33.51160, 5.55556],
    [12, 400, 46.33841, 8.33331], [10, 700, 45.65948, 6.94444]
  ]) {
    const box = layoutNativeText("office AV", { sizePt, weight });
    close(box.width, width, `${sizePt}/${weight} width`);
    close(box.height, height, `${sizePt}/${weight} height`);
    assert.ok(box.items.some(item => item.text === "\ufb03"), "ffi is one native ligature");
  }
  assert.equal(layoutNativeText("x", { family: "helvetica" }), null);
  assert.equal(layoutNativeText("x", { variant: "small-caps" }), null);
  assert.equal(layoutNativeText("x", { style: "italic" }), null);
});

test("native text cache distinguishes center, start and end anchors", () => {
  const engine = createSvgTextEngine();
  const entries = ["center", "left", "right"].map(alignment => {
    const metrics = engine.measure({ text: "office AV", preferNativeText: true, alignment });
    const body = engine.renderFromCache(metrics.cacheKey).body;
    return { metrics, x: Number(body.match(/translate\(([-\d.]+)/)[1]) };
  });
  assert.equal(new Set(entries.map(entry => entry.metrics.cacheKey)).size, 3);
  assert.ok(Math.abs(entries[0].x + entries[0].metrics.width / 2) < 1e-4);
  assert.equal(entries[1].x, 0);
  assert.ok(Math.abs(entries[2].x + entries[2].metrics.width) < 1e-4);
});

test("numeric ticks measure the same optical-size math box that they paint", async () => {
  for (const font of [String.raw`\footnotesize`, String.raw`\normalsize`, String.raw`\large`]) {
    const axis = labels => String.raw`\usepackage{pgfplots}
      \begin{tikzpicture}\begin{axis}[axis lines=middle,
        xmin=-1,xmax=1,ymin=-1,ymax=1,enlargelimits=false,
        font=${font},xtick={-0.5},ytick={-0.5},${labels}]
        \addplot coordinates {(-1,-1)(1,1)};
      \end{axis}\end{tikzpicture}`;
    const explicit = tikzToSvg(axis(String.raw`xticklabels={$-0.5$},yticklabels={$-0.5$}`));
    const expected = explicit.ir.items.filter(item => item.text === "$-0.5$");
    assert.equal(expected.length, 2);
    for (const result of [tikzToSvg(axis("")), await tikzToSvgAsync(axis(""))]) {
      const ticks = result.ir.items.filter(item => item.style?.mathMode === "number");
      assert.equal(ticks.length, 2);
      ticks.forEach((tick, index) => {
        close(tick.x * pt, expected[index].x * pt, `${font} ${index} x`, 0.002);
        close(tick.y * pt, expected[index].y * pt, `${font} ${index} y`, 0.002);
      });
    }
  }
});

test("literal-label width repair leaves unsupported font families on the existing path", () => {
  for (const font of [String.raw`\sffamily`, String.raw`\ttfamily\small`, String.raw`\itshape`, String.raw`\scshape`]) {
    const result = tikzToSvg(String.raw`\usepackage{pgfplots}
      \begin{tikzpicture}\begin{axis}[axis lines=middle,xlabel=label,font=${font}]
      \addplot coordinates {(0,0)(1,1)};\end{axis}\end{tikzpicture}`);
    const label = result.ir.items.find(item => item.text === "label");
    assert.equal(label.style.textWidthScale, 1.06);
    assert.ok(!result.svg.includes('data-text-layout="cm-tex-box"'));
  }
});
