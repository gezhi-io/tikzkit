import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseTikz } from "../src/internal.js";
import { createSvgTextEngine } from "../src/renderers/svg/textEngine.js";

const source = readFileSync(new URL("fixtures/examples/latex-examples/histogram-large-1d-dataset.tex", import.meta.url), "utf8");
const texPtPerCm = 72.27 / 2.54;
const close = (actual, expected, label, tolerance = 0.035) => assert.ok(Math.abs(actual - expected) < tolerance,
  `${label}: ${actual} TeX pt differs from MacTeX ${expected} TeX pt`);

test("interval histogram description uses the styled native tick boxes", () => {
  // Independent named-node measurements: fixtures/pgfplots-histogram-bounds-metrics.tex.
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  const ylabel = result.ir.items.find(item => item.type === "textNode" && item.text === "Number of Symbols");
  close(ylabel.x * texPtPerCm, -29.20892, "ylabel center x");
  close(ylabel.y * texPtPerCm, 48.63179, "ylabel center y");
  assert.equal(ylabel.font.sizePt, 12);
  assert.equal(ylabel.rotation, 90);
});

test("histogram description spacing follows optical font sizes and zero inner sep", () => {
  // Same native probe, with histogramtickoverride set before input.
  for (const { font, sep, center, west } of [
    { font: "footnotesize", sep: 2, center: -30.08420, west: -38.75049 },
    { font: "normalsize", sep: 0, center: -28.33405, west: -37.00034 }
  ]) {
    const variant = source.replace("font=\\small", `font=\\${font}`).replace("inner sep=1pt", `inner sep=${sep}pt`);
    const result = tikzToSvg(variant);
    assert.deepEqual(result.diagnostics, []);
    const ylabel = result.ir.items.find(item => item.type === "textNode" && item.text === "Number of Symbols");
    close(ylabel.x * texPtPerCm, center, `${font} ylabel center x`);
    close(result.ir.coordinates["current axis.outer south west"].x * texPtPerCm, west, `${font} outer west`);
  }
});

test("histogram native tick spacing does not overwrite explicit description placement", () => {
  const variant = source.replace("ylabel={Number of Symbols},",
    "ylabel={Number of Symbols}, ylabel style={at={(axis description cs:-0.2,0.5)}},");
  const result = tikzToSvg(variant);
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.ast.pictures[0].body, /axis label[^\n]+at \(-2\.109,1\.709\) \{Number of Symbols\}/);
  const xVariant = source.replace("xlabel={Collected Labeled Recordings},",
    "xlabel={Collected Labeled Recordings}, xlabel style={at={(axis description cs:0.2,-0.2)}},");
  assert.match(tikzToSvg(xVariant).ast.pictures[0].body,
    /axis label[^\n]+at \(2\.109,-0\.684\) \{Collected Labeled Recordings\}/);
});

test("native histogram outer anchor retains the entire measured label box", () => {
  const result = tikzToSvg(source);
  const labelBox = result.ir.items.findLast(item => item.type === "bbox" && item.subtype === "node-layout");
  const west = Math.min(...labelBox.commands.filter(point => Number.isFinite(point.x)).map(point => point.x));
  const anchor = result.ir.coordinates["current axis.outer south west"];
  close((anchor.x - west) * texPtPerCm, 0, "outer anchor versus actual ylabel box", 1e-6);
  close(anchor.x * texPtPerCm, -37.87521, "outer south west x");
  // Crop x is the frame east plus .5ex, not the rightmost infinity tick label.
  const crop = result.ir.items.at(-1);
  const right = Math.max(...crop.commands.filter(point => Number.isFinite(point.x)).map(point => point.x));
  close(right * texPtPerCm, 302.14362, "explicit crop right");
  const width = Number(result.svg.match(/\bwidth="([\d.]+)pt"/)[1]);
  // SVG/CSS points are 72/in; the native probe reports 72.27/in TeX points.
  close(width * 72.27 / 72, 302.14362 + 37.87521, "cropped canvas width", 0.06);
});

test("histogram near-coordinate nodes follow the native after-axis marker pass", () => {
  const body = parseTikz(source).ast.pictures[0].body;
  assert.ok(body.indexOf("\\draw[axis bar") < body.indexOf("\\draw[axis grid"));
  assert.ok(body.lastIndexOf("\\draw[axis grid") < body.indexOf("\\node[axis near coord"),
    "foreground grids must not erase the near-coordinate glyphs");
  assert.ok(body.lastIndexOf("\\node[axis near coord") < body.indexOf("\\node[axis label"));
  for (const option of ["clip marker paths=true", "clip mode=individual"]) {
    const clipped = parseTikz(source.replace("axis on top,", `axis on top, ${option},`)).ast.pictures[0].body;
    assert.ok(clipped.indexOf("\\node[axis near coord") < clipped.indexOf("\\draw[axis grid"),
      `${option}: retain the inline marker pass`);
  }
});

test("explicit histogram numeric ticks paint the same native box used by their anchors", () => {
  for (const { font, size, height } of [
    { font: "small", size: 9, height: 5.8 },
    { font: "footnotesize", size: 8, height: 5.15556 },
    { font: "normalsize", size: 10, height: 6.44444 }
  ]) {
    const result = tikzToSvg(source.replace("font=\\small", `font=\\${font}`));
    const ticks = result.ir.items.filter(item => item.type === "textNode" && /^\d+$/.test(item.text) && item.x < 0);
    assert.equal(ticks.length, 6);
    for (const tick of ticks) {
      assert.equal(tick.font.sizePt, size);
      assert.equal(tick.style.mathMode, undefined, "explicit labels remain literal text, not formatted numbers");
      const engine = createSvgTextEngine();
      const metrics = engine.measure({ text: tick.text, font: tick.font, ...tick.style });
      const payload = engine.renderFromCache(metrics.cacheKey);
      assert.match(payload.body, /data-text-layout="cm-tex-box"/,
        "a legacy width fit must not disable native tick text painting");
      assert.match(payload.body, /dominant-baseline="alphabetic"/);
      close(metrics.baselineY * texPtPerCm / 100, height, `${font} tick baseline`);
      close(metrics.height * texPtPerCm / 100, height, `${font} tick height`);
    }
  }
});

test("histogram xlabel and bottom bound include the measured tick path extent", () => {
  // Same named-anchor native probe, including optical-size/inner-separation variants.
  for (const { font, sep, center, bottom } of [
    { font: "small", sep: 1, center: -21.13400, bottom: -29.80030 },
    { font: "footnotesize", sep: 2, center: -22.48956, bottom: -31.15585 },
    { font: "normalsize", sep: 0, center: -19.77844, bottom: -28.44473 }
  ]) {
    const result = tikzToSvg(source.replace("font=\\small", `font=\\${font}`).replace("inner sep=1pt", `inner sep=${sep}pt`));
    const xlabel = result.ir.items.find(item => item.text === "Collected Labeled Recordings");
    close(xlabel.y * texPtPerCm, center, `${font} xlabel center y`);
    close(result.ir.coordinates["current axis.outer south west"].y * texPtPerCm, bottom, `${font} bottom bound`);
  }
});

test("explicit histogram numeric text keeps leading zeros and unsupported font fallbacks", () => {
  const literal = source.replace("yticklabels={ 0, 20, 40, 60, 80, 100 }",
    "yticklabels={ 0, 20, 40, 60, 80, 0100 }");
  for (const font of ["small", "small\\ttfamily"]) {
    const result = tikzToSvg(literal.replace("font=\\small", `font=\\${font}`));
    assert.deepEqual(result.diagnostics, []);
    const tick = result.ir.items.find(item => item.type === "textNode" && item.text === "0100");
    assert.ok(tick, "explicit text must not be parsed and reformatted as a number");
    assert.equal(tick.style.mathMode, undefined);
    assert.equal(tick.style.textWidthScale, font === "small" ? 1 : 1.0001);
  }
});
