import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { renderSvgDocument } from "../src/renderers/svg/document.js";
import { renderNativeScatterLegend } from "../src/tikz/libraries/datavisualizationLegend.js";

const scatter = fs.readFileSync(new URL("./fixtures/native-node-text/scatter.tex", import.meta.url), "utf8");
const pt = 72.27 / 2.54;
const close = (actual, expected, tolerance = .03) => assert.ok(Math.abs(actual - expected) < tolerance,
  `${actual}pt != native ${expected}pt`);

test("scatter legend uses the complete axis box and the native matrix cell", () => {
  const result = tikzToSvg(scatter);
  assert.deepEqual(result.diagnostics, []);
  const mark = result.ir.items.find(item => item.subtype === "axis-legend-example");
  const label = result.ir.items.find(item => item.text === "source ordered rand");
  // Independently measured by native-node-text/legend-metrics.tex. These
  // positions are relative to the data frame, not the exported SVG crop.
  close(mark.cx * pt, 158.422);
  close(mark.cy * pt, 37.26093);
  close(label.svgTextX * pt, 163.41797);
});

test("scatter legend rows use native AMS fraction depth and font-dependent struts", () => {
  const result = tikzToSvg(fs.readFileSync(new URL("./fixtures/datavis-scatter-legend/rows.tex", import.meta.url), "utf8"));
  assert.deepEqual(result.diagnostics, []);
  const marks = result.ir.items.filter(item => item.subtype === "axis-legend-example");
  assert.equal(marks.length, 3);
  // metrics.ltx probes with amsmath: marker origins share each label's mid
  // baseline. A fraction creates unequal gaps, not a fixed row stride.
  for (const [i, y] of [53.72366, 37.79054, 21.31213].entries()) {
    close(marks[i].cx * pt, 159.922);
    close(marks[i].cy * pt, y);
  }
  assert.equal(marks[2].style.fill, "none");
});

test("specialized scatter legend leaves custom mark coordinates and named label shapes to fallback", () => {
  const entry = { kind: "scatter", plot: { mark: "*", legendLabel: "sample" },
    sampleColor: "black", sampleStyle: "color=black", labelColor: "black" };
  for (const patch of [{ legendMarkCoordinates: [{ x: 1, y: 0 }] },
    { legendNodeStyle: ["name=custom label"] }, { legendNodeStyle: [String.raw`font=\ttfamily`] }]) {
    assert.equal(renderNativeScatterLegend([{ ...entry, plot: { ...entry.plot, ...patch } }], "axis"), null);
  }
});

test("a local bounding box excludes earlier paint but retains its own text box", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \draw (-8,-8) rectangle (8,8);
    \begin{scope}[local bounding box=local]
      \path (1,2) rectangle (3,4);
    \end{scope}
    \coordinate (right) at (local.east);
    \coordinate (bottom) at (local.south);
  \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.right, { x: 3, y: 3 });
  assert.deepEqual(result.ir.coordinates.bottom, { x: 2, y: 2 });
});

test("scatter legend is independent of unrelated preceding nodes", () => {
  const a = tikzToSvg(scatter);
  const b = tikzToSvg(scatter.replace("\\tikz \\datavisualization", "\\begin{tikzpicture}\\node at (20,20) {Other};\\datavisualization")
    .replace("\\end{document}", "\\end{tikzpicture}\\end{document}"));
  assert.deepEqual(b.diagnostics, []);
  const label = result => result.ir.items.find(item => item.text === "source ordered rand");
  close(label(a).x, label(b).x, .0001);
  close(label(a).y, label(b).y, .0001);
});

test("native legend text preserves the base anchor across optical sizes and inline math", () => {
  for (const [font, label] of [
    [String.raw`\small`, "a long legend with gyjp"],
    [String.raw`\scriptsize`, "small measurements"],
    [String.raw`\small`, String.raw`measurements at $x_i$`],
    [String.raw`\small`, String.raw`$\displaystyle\frac{1+x_i}{1+x_i^2}$`]
  ]) {
    const result = tikzToSvg(String.raw`\begin{tikzpicture}\node[tikzkit native math,tikzkit tex node anchors,
      anchor=base west,inner sep=0pt,outer sep=0pt,font=${font}] at (0,0) {${label}};\end{tikzpicture}`);
    assert.deepEqual(result.diagnostics, []);
    const baseline = result.svg.match(/<g class="tikz-(?:text|math)-native"[^>]*translate\(([-\d.]+) ([-\d.]+)\)/);
    assert.ok(baseline, `expected native glyph paint for ${label}`);
    close(Number(baseline[1]), 0, .0001);
    close(Number(baseline[2]), 0, .0001);
  }
});

test("physical SVG dimensions retain the viewBox scale at browser zoom", () => {
  const svg = renderSvgDocument("0 0 1279.310812 285.168271", [], [], {
    widthPt: 1279.310812 * 72 / 254, heightPt: 285.168271 * 72 / 254
  });
  const [, width, height] = svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/);
  assert.ok(Math.abs(Number(width) / Number(height) - 1279.310812 / 285.168271) < 1e-7);
});

test("local bounds follow nested transforms and backgrounds but exclude overlays", () => {
  const result = tikzToSvg(String.raw`\usetikzlibrary{backgrounds}
    \begin{tikzpicture}
      \begin{scope}[local bounding box=local,shift={(2,3)}]
        \begin{scope}[local bounding box=inner,on background layer]
          \path (0,0) rectangle (1,2);
        \end{scope}
        \draw[overlay] (-10,-10) rectangle (10,10);
        \coordinate (during) at (local.north east);
      \end{scope}
      \coordinate (innerCorner) at (inner.north east);
      \coordinate (outerCorner) at (local.north east);
    \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  for (const name of ["during", "innerCorner", "outerCorner"]) {
    assert.deepEqual(result.ir.coordinates[name], { x: 3, y: 5 }, name);
  }
});
