import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tikzToSvg } from "../src/index.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { parseDimension } from "../src/engine/math.js";
import { computeAxisRanges } from "../src/pgfplots/rangeResolver.js";
import { normalizeTikzText } from "../src/tikz/text.js";
import { layoutNativeTextRun } from "../src/tex/textBox.js";

const pt = 72.27 / 2.54;
const source = name => readFileSync(new URL(`./fixtures/pgfplots-small-axis/${name}.tex`, import.meta.url), "utf8");
const near = (actual, expected, tolerance = 0.002) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from native ${expected}`);

test("small middle axes subtract the full native description reserve without a half-size floor", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  for (const height of [1.7, 2, 2.5, 3, 4]) {
    const geometry = createAxisGeometry({ width: "4cm", height: `${height}cm`, "axis lines": "middle" }, ranges);
    near(geometry.width * pt, 4 * pt - 45);
    near(geometry.height * pt, height * pt - 45);
  }
  // Independent pgfplots-small-axis-metrics.tex, not generated from JS.
  const result = tikzToSvg(source("middle"));
  assert.deepEqual(result.diagnostics, []);
  const frame = result.ir.items.find(item => item.subtype === "axis-frame");
  near(Math.max(...frame.commands.map(c => c.x ?? 0)) * pt, 68.80951, 0.02);
  near(Math.max(...frame.commands.map(c => c.y ?? 0)) * pt, 11.9049, 0.02);
  const scaleOnly = createAxisGeometry({ width: "4cm", height: "2cm", "axis lines": "middle", "scale only axis": true }, ranges);
  near(scaleOnly.width, 4);
  near(scaleOnly.height, 2);
});

for (const [mode, nativeWidth, nativeHeight, nativeCenterY] of [
  ["no-align", 41.06644, 12.2215, -6.11075],
  ["center", 24.0662, 21.7215, -10.86075],
  ["left", 24.0662, 21.7215, -10.86075]
]) {
  test(`PGFPlots ${mode} 8pt ticks use the measured native node box`, () => {
    const result = tikzToSvg(source(`tick-${mode}`));
    assert.deepEqual(result.diagnostics, []);
    const index = result.ir.items.findIndex(item => item.type === "textNode" && item.text.startsWith("2012"));
    const text = result.ir.items[index];
    const box = result.ir.items[index - 1];
    assert.equal(box.subtype, "node-layout");
    const xs = box.commands.filter(c => "x" in c).map(c => c.x * pt);
    const ys = box.commands.filter(c => "y" in c).map(c => c.y * pt);
    // Native anchors include .2pt outer sep per side; layout paint does not.
    near(Math.max(...xs) - Math.min(...xs), nativeWidth - 0.4);
    near(Math.max(...ys) - Math.min(...ys), nativeHeight - 0.4);
    near(text.y * pt, nativeCenterY);
    assert.equal(text.text, mode === "no-align" ? "20122956" : String.raw`2012\\2956`);
    assert.equal(text.font.sizePt, 8);
    near(text.font.baselineSkipPt, 9.5);
  });
}

test("optionless coordinate plots retain the native cycle marks at their endpoints", () => {
  const result = tikzToSvg(source("middle"));
  const marks = result.ir.items.filter(item => item.subtype === "axis-mark");
  assert.equal(marks.length, 2);
  const frame = result.ir.items.find(item => item.subtype === "axis-frame");
  near(marks[0].cx, 0);
  near(marks[0].cy, 0);
  near(marks[1].cx, Math.max(...frame.commands.map(c => c.x ?? 0)));
  near(marks[1].cy, Math.max(...frame.commands.map(c => c.y ?? 0)));
  assert.equal(marks[0].style.fill, "rgb(0 0 204)");
  near(marks[0].r, parseDimension("2pt", {}));
  assert.ok(marks.every(mark => mark.includeStrokeBounds === false), "PGF plot marks use quick paint without stroke bbox expansion");
});

test("quick circle and rectangle paint preserve path bounds without changing ordinary strokes", () => {
  for (const geometry of ["(0,0) circle(10pt)", "(-10pt,-10pt) rectangle (10pt,10pt)"]) {
    const render = quick => tikzToSvg(`\\begin{tikzpicture}\\draw[line width=4pt${quick ? ",tikzkit quick path" : ""}] ${geometry};\\end{tikzpicture}`, { margin: 0 });
    const plain = render(false), quick = render(true);
    assert.deepEqual(quick.diagnostics, []);
    const width = result => Number(result.svg.match(/\bwidth="([\d.]+)pt"/)[1]);
    // PGF quick paint skips pgfcorepathusage's +/- half-linewidth hook.
    // SVG pt are PDF big points (72/in), not TeX points (72.27/in).
    near(width(quick), 20 * 72 / 72.27, 0.02);
    near(width(plain) - width(quick), 4 * 72 / 72.27, 0.02);
  }
});

test("left axes use native tight limits, centered ticks and absolute description anchors", () => {
  const result = tikzToSvg(source("green-left"));
  assert.deepEqual(result.diagnostics, []);
  const curve = result.ir.items.find(item => item.subtype === "axis-plot");
  assert.equal(curve.style.stroke, "rgb(0 255 0)");
  near(curve.commands[0].x, 0);
  near(curve.commands[0].y, 0);
  near(curve.commands.at(-1).x * pt, 194.99817, 0.02);
  near(curve.commands.at(-1).y * pt, 161.99951, 0.02);
  for (const [label, x, y] of [["$x$", 97.49908, -20.68575], ["$y$", -35, 80.99976], ["Curve", 97.49908, 174.94914]]) {
    const text = result.ir.items.find(item => item.type === "textNode" && item.text === label);
    near(text.x * pt, x, 0.02);
    near(text.y * pt, y, 0.02);
  }
  const tick = result.ir.items.find(item => item.subtype === "axis-tick");
  near(tick.commands[0].y, -0.075);
  near(tick.commands[1].y, 0.075);
});

test("starred edge axes retain auto enlargement while unstarred axes disable it", () => {
  const plots = [{ type: "coordinates", options: {}, points: [{ x: 0, y: 0 }, { x: 2, y: 4 }] }];
  const plain = computeAxisRanges({ "axis lines": "left" }, plots);
  assert.deepEqual([plain.xMin, plain.xMax, plain.yMin, plain.yMax], [0, 2, 0, 4]);
  const starred = computeAxisRanges({ "axis x line*": "bottom", "axis y line*": "right" }, plots);
  assert.deepEqual([starred.xMin, starred.xMax, starred.yMin, starred.yMax], [-0.2, 2.2, -0.4, 4.4]);
});

test("native percentage text retains CM optical metrics and text-mode thin space", () => {
  const font = { sizePt: 8, family: "serif" };
  const spaced = layoutNativeTextRun(normalizeTikzText(String.raw`20\,\%`), font);
  const compact = layoutNativeTextRun(normalizeTikzText(String.raw`20\%`), font);
  assert.ok(spaced && compact, "text-mode control symbols must retain the native hbox");
  near(spaced.width - compact.width, 1.4167);
  // MacTeX's hbox: 17.00027pt x (6pt + .44444pt).
  near(spaced.width, 17.00027);
  near(spaced.height, 6);
  near(spaced.depth, 0.44444);
  assert.deepEqual(spaced.items.map(item => item.text), ["2", "0", "%"]);
  assert.ok(spaced.items.every(item => item.family === "TikZKitCMR8"));
  for (const unsupported of [String.raw`20\unknown`, String.raw`\textcolor{red}{\unknown}`, String.raw`A\\[2pt]B`]) {
    assert.equal(layoutNativeTextRun(normalizeTikzText(unsupported), font), null);
  }
});

test("axis line width is inherited by the frame and node outer separations", () => {
  const base = source("tick-center");
  const plain = tikzToSvg(base);
  const thick = tikzToSvg(base.replace("width=5cm", "thick,width=5cm"));
  assert.deepEqual(thick.diagnostics, []);
  const frame = thick.ir.items.find(item => item.type === "path" && item.subtype === "axis-frame" && item.style.stroke !== "none");
  near(frame.style.lineWidth / 100 * pt, 0.8);
  const tick = r => r.ir.items.find(item => item.type === "textNode" && item.text.startsWith("2012"));
  near((tick(plain).y - tick(thick).y) * pt, 0.2);
});
