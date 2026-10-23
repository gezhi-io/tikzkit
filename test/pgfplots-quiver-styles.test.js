import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseOptions, parseArrowTipSpec } from "../src/engine/options.js";
import { sampleAxisQuiverPlot } from "../src/pgfplots/quiver.js";
import { createAxisTickModel } from "../src/pgfplots/ticks.js";

const fixture = name => readFileSync(new URL(`fixtures/pgfplots-quiver/${name}.tex`, import.meta.url), "utf8");
const sample = (options, ranges) => sampleAxisQuiverPlot({ type: "function", is3d: true,
  expression: "0", options: parseOptions(options) }, {}, ranges, { mapPoint3d: p => p });
function arrows(name) {
  const result = tikzToSvg(fixture(name));
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items.filter(item => item.type === "path" && !item.subtype);
}

test("quiver inherits path arrow settings without inventing a default tip", () => {
  const paths = arrows("inherited");
  assert.equal(paths.length, 24);
  for (const p of paths.slice(0, 8)) assert.ok(!p.style.markerStart && !p.style.markerEnd);
  for (const p of paths.slice(8, 16)) assert.equal(p.style.markerEnd?.kind, "stealth");
  for (const p of paths.slice(16)) {
    assert.equal(p.style.markerStart?.kind, "latex");
    assert.equal(p.style.markerStart?.open, true);
    assert.equal(p.style.markerEnd?.kind, "stealth");
    assert.equal(p.style.markerEnd?.meta, true);
  }
});

test("quiver forwards per-point scale length but keeps native line-width-dependent dimensions", () => {
  const paths = arrows("point-meta");
  assert.equal(paths.length, 24);
  assert.deepEqual(paths.slice(0, 8).map(p => p.style.markerEnd.lengthScale), [.1, .25, .5, .75, .1, .25, .5, .75]);
  for (const p of paths) {
    assert.equal(p.style.markerEnd.kind, "latex");
    assert.equal(p.style.markerEnd.meta, true);
    assert.ok(!p.style.markerEnd.customLength && !p.style.markerEnd.customWidth);
  }
  assert.ok(paths.slice(8).every(p => (p.style.markerEnd.lengthScale ?? 1) === 1),
    "metadata must not resize tips unless the style explicitly uses it");
});

test("quiver preserves every-arrow paint, direction, and namespaced nested options", () => {
  const paths = arrows("overrides");
  assert.equal(paths.length, 24);
  for (const p of paths.slice(0, 8)) {
    assert.equal(p.style.stroke, "red");
    assert.equal(p.style.markerEnd?.scale, .7);
    assert.ok(Math.abs(p.style.lineWidth - 100 * 2.54 / 72.27) < 1e-8);
  }
  for (const p of paths.slice(8, 16)) {
    assert.equal(p.style.markerEnd?.kind, "stealth");
    assert.equal(p.style.markerEnd?.meta, true);
    assert.equal(p.style.markerEnd?.open, true);
    assert.equal(p.style.opacity, .5);
  }
  for (const p of paths.slice(16)) {
    assert.equal(p.style.markerStart?.kind, "latex");
    assert.ok(!p.style.markerEnd);
    assert.ok(p.style.dashArray.length > 0);
  }
});

test("arrows.meta scale expressions use PGF math rather than numeric-only coercion", () => {
  const tip = parseArrowTipSpec("Latex[scale length={max(.01,250/1000)},scale width={sqrt(4)}]");
  assert.equal(tip.lengthScale, .25);
  assert.equal(tip.widthScale, 2);
});

test("native open Latex tips keep the PGF miter limit rather than SVG's bevel cutoff", () => {
  const result = tikzToSvg(fixture("inherited"));
  const openTips = result.svg.match(/<path class="tikz-arrow-tip tikz-arrow-latex"[^>]*>/g) || [];
  assert.equal(openTips.length, 8);
  assert.ok(openTips.every(path => path.includes('stroke-miterlimit="10"')));
  const custom = tikzToSvg(String.raw`\begin{tikzpicture}
    \draw[line width=1.2pt,miter limit=6,-{Latex[open]}] (0,0)--(1,0);
  \end{tikzpicture}`);
  assert.match(custom.svg, /class="tikz-arrow-tip[^>]*stroke-miterlimit="6"/);
});

test("quiver survey honors explicit metadata limits before normalization", () => {
  const plot = { type: "function", is3d: true, expression: "0", options: parseOptions(
    "domain=0:3,y domain=0:0,samples=4,point meta=x,point meta min=0,point meta max=4,quiver={u=1,v=0}") };
  const result = sampleAxisQuiverPlot(plot, {}, { xMin: 0, xMax: 3, yMin: 0, yMax: 1 },
    { mapPoint3d: point => point });
  assert.deepEqual(result.metaRange, { min: 0, max: 4 });
});

test("arrow outlines and fills inherit the path's PGF paint opacity", () => {
  const result = tikzToSvg(fixture("overrides"));
  const greenTips = result.svg.match(/<path class="tikz-arrow-tip tikz-arrow-stealth"[^>]*>/g) || [];
  assert.equal(greenTips.length, 8);
  assert.ok(greenTips.every(path => path.includes('stroke-opacity="0.5"')));
  const separate = tikzToSvg(String.raw`\begin{tikzpicture}
    \draw[draw opacity=.4,fill opacity=.25,-{Latex}] (0,0)--(1,0);
  \end{tikzpicture}`).svg;
  const tip = separate.match(/<path class="tikz-arrow-tip tikz-arrow-latex"[^>]*>/)[0];
  assert.match(tip, /stroke-opacity="0.4"/);
  assert.match(tip, /fill-opacity="0.25"/);
});

test("top-view 3D plots retain the native three-tick minimum", () => {
  const ranges = { xMin: 0, xMax: 4, yMin: 0, yMax: 1 };
  const geometry = { width: 6, height: 2 };
  const opts = { "pgfplots 3d surface": true, "tikzkit pgfplots top view": true };
  assert.deepEqual(createAxisTickModel(opts, ranges, [], geometry).y.values, [0, .5, 1]);
  assert.deepEqual(createAxisTickModel({ ...opts, "try min ticks": 6 }, ranges, [], geometry).y.values,
    [0, .2, .4, .6, .8, 1]);
});

test("quiver stems and arrow tips share the projected axis clipping hull", () => {
  for (const mode of ["global", "individual"]) {
    const source = fixture("inherited").replace("view={0}{90}", `view={0}{90},clip mode=${mode}`);
    const result = tikzToSvg(source);
    const paths = result.ir.items.filter(item => item.type === "path" && !item.subtype);
    assert.equal(paths.length, 24);
    assert.ok(paths.every(path => path.clipRect || path.clipPolygon));
    assert.match(result.svg, /<clipPath\b/);
  }
  const unclipped = tikzToSvg(fixture("inherited").replace("view={0}{90}", "view={0}{90},clip=false"));
  assert.ok(unclipped.ir.items.filter(item => item.type === "path" && !item.subtype)
    .every(path => !path.clipRect && !path.clipPolygon));
});

test("quiver samples and surveys the source domain before viewport clipping", () => {
  const result = sample("domain=-1:3,y domain=.3:.7,samples=5,samples y=2,point meta=x,quiver={u=.7,v=0}",
    { xMin: 0, xMax: 2, yMin: 0, yMax: 1 });
  assert.deepEqual(result.samples.slice(0, 5).map(s => s.start.x), [-1, 0, 1, 2, 3]);
  assert.deepEqual(result.metaRange, { min: -1, max: 3 });
  assert.ok(arrows("sampling-window").every(p => p.clipRect || p.clipPolygon));
});

test("quiver samples y=1 selects a single line at y=0, regardless of y domain", () => {
  const result = sample("domain=0:3,y domain=.4:.8,samples=4,samples y=1,quiver={u=.6,v=0}",
    { xMin: -.2, xMax: 3.7, yMin: -.5, yMax: 1 });
  assert.equal(result.samples.length, 4);
  assert.deepEqual(result.samples.map(s => s.start.y), [0, 0, 0, 0]);
  assert.equal(arrows("single-row").length, 4);
});
