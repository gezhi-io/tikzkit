import assert from "node:assert/strict";
import test from "node:test";
import { parsePgfplotsColormaps } from "../src/pgfplots/axisOptions.js";
import { pgfplotsSurfaceColor } from "../src/pgfplots/surface.js";
import { tikzToSvg } from "../src/index.js";

function sample(stops, value) {
  const maps = parsePgfplotsColormaps(`{native}{${stops}}`);
  return pgfplotsSurfaceColor(value, { zMin: 0, zMax: 1 }, 0,
    { "colormap name": "native", "pgfplots colormaps": maps }).match(/[\d.]+/g).map(Number);
}

function near(actual, expected) {
  expected.forEach((value, index) => assert.ok(Math.abs(actual[index] - value) < 0.01,
    `channel ${index}: expected ${value}, received ${actual[index]}`));
}

test("RGB-first colormaps convert CMYK stops before interpolation", () => {
  const stops = "color(0cm)=(blue);color(1cm)=(yellow)";
  // Native pgfplots-native-colormap/metrics.ltx includes the fixed-point
  // interval lookup as well as xcolor's RGB conversion.
  near(sample(stops, 0), [0, 0, 255]);
  near(sample(stops, .5), [.50354, .50354, .49646].map(value => value * 255));
  near(sample(stops, 1), [255, 255, 0]);
});

test("CMYK-first colormaps interpolate channels before display conversion", () => {
  const stops = "color(0cm)=(cyan);color(1cm)=(black)";
  // metrics.ltx paints the native colormap result (.49646,0,0,.50354).
  // These percentages are independently read from pdf2svg's DeviceCMYK patch.
  near(sample(stops, .5), [28.48053, 46.272278, 54.812622].map(value => value * 2.55));
});

test("dvips color stops use xcolor conversion rather than CSS or painted DeviceCMYK", () => {
  const stops = "color(0cm)=(blue);color(1cm)=(SkyBlue);color(2cm)=(SpringGreen);color(3cm)=(yellow)";
  near(sample(stops, 1 / 3), [.3807, 1, .87872].map(value => value * 255));
  near(sample(stops, 2 / 3), [.74103, 1, .23904].map(value => value * 255));
});

function flatPatches(shader, data, extra = "") {
  const result = tikzToSvg(String.raw`\usepackage{pgfplots}
    \pgfplotsset{compat=1.18,colormap={test}{color(0cm)=(blue);color(1cm)=(red)}}
    \begin{tikzpicture}\begin{axis}[view={0}{90},domain=0:2,y domain=0:1,
      samples=3,samples y=2,colormap name=test,point meta min=0,point meta max=2]
      \addplot3[surf,mesh/cols=3,shader=${shader},${extra}] ${data};
    \end{axis}\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items.filter(item => item.type === "path" && item.subtype === "axis-surface")
    .sort((a, b) => a.commands[0].x - b.commands[0].x);
}

test("flat corner uses the source first vertex, while flat and flat mean average corners", () => {
  for (const data of ["{x}", "coordinates {(0,0,0) (1,0,1) (2,0,2) (0,1,0) (1,1,1) (2,1,2)}"]) {
    const corner = flatPatches("flat corner", data).filter(p => p.style.fill !== "none");
    assert.equal(corner.length, 2);
    near(corner[0].style.fill.match(/[\d.]+/g).map(Number), [0, 0, 255]);
    near(corner[1].style.fill.match(/[\d.]+/g).map(Number), [.50354, 0, .49646].map(value => value * 255));
    for (const shader of ["flat", "flat mean"]) {
      const mean = flatPatches(shader, data).filter(p => p.style.fill !== "none");
      near(mean[0].style.fill.match(/[\d.]+/g).map(Number), [.25177, 0, .74823].map(value => value * 255));
    }
  }
});

test("flat surfaces retain native mapped-color strokes even with draw=none", () => {
  const patches = flatPatches("flat corner", "{x}", "draw=none");
  const fills = patches.filter(p => p.style.fill !== "none");
  const strokes = patches.filter(p => p.style.stroke !== "none");
  assert.equal(fills.length, 2);
  assert.equal(strokes.length, 2);
  for (const [index, patch] of strokes.entries()) {
    assert.equal(patch.style.stroke, fills[index].style.fill);
    assert.ok(Math.abs(patch.style.lineWidth - 100 * .4 * 2.54 / 72.27) < 1e-8);
  }
});
