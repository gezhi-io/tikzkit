import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { computeAxisRanges, sampleParametricSurfaceGrid } from "../src/pgfplots/rangeResolver.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { renderAxisSurfacePlot } from "../src/pgfplots/surface.js";

const options = { "pgfplots 3d surface": true, compat: "1.3", xmin: -5, xmax: 5,
  ymin: -5, ymax: 5, "axis lines": "left" };
const expression = "3*x*x-y*y-9*x+1";
const plot = { type: "function", is3d: true, expression, options: { surf: true } };
const parametric = { type: "parametric", is3d: true, xExpression: "x", yExpression: "y",
  zExpression: expression, options: { surf: true } };
const fixture = name => readFileSync(new URL(`fixtures/pgfplots-surface-survey/${name}.tex`, import.meta.url), "utf8");
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .055,
  `${label}: ${actual} TeX pt vs native ${expected} TeX pt`);

for (const surface of [plot, parametric]) {
  test(`${surface.type} surface surveys the native 25 by 25 default mesh`, () => {
    const ranges = computeAxisRanges(options, [surface]);
    // Independent MacTeX probe: zmin=-30.66678, zmax=121. A 15- or
    // 40-sample survey finds a different minimum from the painted mesh.
    assert.ok(Math.abs(ranges.zMin - -30.66678) < .001, String(ranges.zMin));
    assert.equal(ranges.zMax, 121);
    const geometry = createAxisGeometry(options, ranges);
    close(geometry.height * 72.27 / 2.54, 161.3747, "projected frame height");
  });
}

test("default hypersurface labels use the native surveyed frame", () => {
  const source = readFileSync(new URL("fixtures/examples/latex-examples/hypersurface-2.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  const expected = [["$x$", 53.28691, -14.7028], ["$y$", 184.93095, -2.58488], ["$z$", -30.5253, 60.33383]];
  for (const [text, x, y] of expected) {
    const node = result.ir.items.find(item => item.type === "textNode" && item.text === text);
    assert.ok(node, text);
    close(node.x * 72.27 / 2.54, x, `${text} x`);
    close(node.y * 72.27 / 2.54, y, `${text} y`);
  }
});

test("surface survey and replay share explicit sample overrides above the old survey cap", () => {
  const p = { ...plot, expression: "-1000*(x-0.123)^2-1000*(y-0.456)^2",
    options: { surf: true, domain: "0:1", "y domain": "0:1", samples: 73, "samples y": 67 } };
  const asParametric = { ...parametric, zExpression: p.expression, options: p.options };
  const points = sampleParametricSurfaceGrid(asParametric, options).grid.flat().filter(Boolean);
  const ranges = computeAxisRanges(options, [p], { enlargeZ: false });
  assert.ok(Math.abs(ranges.zMax - Math.max(...points.map(p => p.z))) <= .0005);
});

test("cropping does not resample a declared coarse surface domain", () => {
  const p = { ...plot, expression: "x*x-y*y", options: { surf: true, domain: "-2:2", "y domain": "-2:2", samples: 5 } };
  const ranges = { xMin: -1.2, xMax: 1.3, yMin: -1.1, yMax: .9, zMin: -2, zMax: 2 };
  const seen = [];
  renderAxisSurfacePlot(p, options, ranges, { mapPoint3d(point) { seen.push(point); return point; } }, {});
  assert.deepEqual([...new Set(seen.map(p => p.x))], [-2, -1, 0, 1, 2]);
  assert.deepEqual([...new Set(seen.map(p => p.y))], [-2, -1, 0, 1, 2]);
  assert.equal(seen.length, 25);
});

test("surface fills and mesh strokes clip to the projected box only when enabled", () => {
  for (const clipMode of ["global", "individual"]) {
    const result = tikzToSvg(fixture("clipped").replace("view={35}{30}", `view={35}{30},clip mode=${clipMode}`));
    assert.deepEqual(result.diagnostics, []);
    const facets = result.ir.items.filter(item => item.subtype === "axis-surface");
    assert.equal(facets.length, 32, "sixteen fills and sixteen mesh strokes");
    assert.ok(facets.every(item => item.clipPolygon?.length === 6));
    assert.ok(result.ir.items.filter(item => item.type === "textNode").every(item => !item.clipPolygon),
      "axis descriptions must stay outside the surface clip");
  }
  const result = tikzToSvg(fixture("unclipped"));
  assert.deepEqual(result.diagnostics, []);
  const facets = result.ir.items.filter(item => item.subtype === "axis-surface");
  assert.equal(facets.length, 32);
  assert.ok(facets.every(item => !item.clipPolygon));
});

test("explicit z limits do not remap the same sampled surface colors", () => {
  const source = fixture("clipped");
  const colors = text => tikzToSvg(text).ir.items
    .filter(item => item.subtype === "axis-surface" && item.style.fill !== "none")
    .map(item => item.style.fill);
  assert.deepEqual(colors(source), colors(source.replace("zmin=-2,zmax=2,", "")));
});

test("explicit point-meta bounds respect axis-wide versus per-plot normalization", () => {
  // Native metrics.ltx TRANSFORMED wb 6/12: (.49648,.49648,1).
  for (const [mode, color] of [["axis wide", "rgb(126.6024 126.6024 255)"], ["per plot", "rgb(0 0 255)"]]) {
    const source = fixture("explicit-meta").replace("surf,", `surf,point meta rel=${mode},`);
    const result = tikzToSvg(source);
    assert.deepEqual(result.diagnostics, []);
    const face = result.ir.items.find(item => item.subtype === "axis-surface" && item.style.fill !== "none");
    assert.equal(face.style.fill, color);
  }
});

test("unclipped mesh bounds follow PGF quick paint without extra pen padding", () => {
  const { svg, ir } = tikzToSvg(fixture("unclipped"), { margin: 0 });
  const width = Number(svg.match(/width="([\d.]+)pt"/)[1]);
  const height = Number(svg.match(/height="([\d.]+)pt"/)[1]);
  // Native PDF/SVG dimensions, minus the standalone 2 TeX pt border per side.
  close(width * 72.27 / 72, 325.053 * 72.27 / 72 - 4, "unclipped width");
  close(height * 72.27 / 72, 237.074 * 72.27 / 72 - 4, "unclipped height");
  assert.ok(ir.items.filter(item => item.subtype === "axis-surface")
    .every(item => item.includeStrokeBounds === false));
});
