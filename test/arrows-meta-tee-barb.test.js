import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseArrowTipSpec } from "../src/engine/options.js";
import { computeSvgBounds } from "../src/renderers/svg/bounds.js";
import { resolveInlineArrowTip } from "../src/renderers/svg/paths.js";
import { tikzToSvg } from "../src/index.js";
import { lineWidthFromPt } from "../src/tikz-metrics.js";

const unitsPerPt = lineWidthFromPt(1);

function inPt(value) {
  return Number(value) / unitsPerPt;
}

function close(actual, expected, label, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function closePoint(actual, expected, label) {
  close(inPt(actual.x), expected.x, `${label} x`);
  close(inPt(actual.y), expected.y, `${label} y`);
}

test("uses the PGF Tee Barb defaults and inset-driven shaft shortening", () => {
  const tip = resolveInlineArrowTip(parseArrowTipSpec("Tee Barb"), {
    stroke: "black",
    lineWidth: lineWidthFromPt(0.4)
  });
  const geometry = tip.geometry;

  close(inPt(geometry.length), 2.3, "length");
  close(inPt(geometry.width), 4.6, "width");
  close(inPt(geometry.inset), 1.15, "inset");
  close(inPt(geometry.lineWidth), 0.4, "tip line width");
  close(inPt(geometry.tipEnd), 1.15, "tip end");
  close(inPt(geometry.backEnd), -1.15, "back end");
  close(inPt(geometry.lineEnd), -0.1, "line end");
  close(inPt(geometry.visualTipEnd), 1.15, "visual tip end");
  close(inPt(geometry.visualBackEnd), 0.2, "visual back end");
  close(inPt(geometry.terminalPlacement), 1.25, "shaft shortening");
  close(inPt(geometry.assemblyLength), 2.3, "assembly length");
  assert.equal(geometry.paths.length, 3);
  closePoint(geometry.paths[0][0], { x: -1.15, y: 2.1 }, "top path start");
  closePoint(geometry.paths[0][1], { x: 1.15, y: 2.1 }, "top path end");
  closePoint(geometry.paths[1][0], { x: 0, y: 2.1 }, "stem start");
  closePoint(geometry.paths[1][1], { x: 0, y: -2.1 }, "stem end");
  closePoint(geometry.paths[2][0], { x: -1.15, y: -2.1 }, "bottom path start");
  closePoint(geometry.paths[2][1], { x: 1.15, y: -2.1 }, "bottom path end");
  close(inPt(geometry.bounds.minX), -1.15, "hull min x");
  close(inPt(geometry.bounds.maxX), 1.15, "hull max x");
  close(inPt(geometry.bounds.minY), -2.3, "hull min y");
  close(inPt(geometry.bounds.maxY), 2.3, "hull max y");
  assert.equal(tip.lineCap, "butt");
  assert.equal(tip.lineJoin, "miter");
});

test("combines custom Tee Barb dimensions with a reversed right round harpoon and slant", () => {
  const tip = resolveInlineArrowTip(
    parseArrowTipSpec("Tee Barb[length=5pt,width=6pt,inset=1pt,line width=.8pt,round,right,reversed,slant=.25]"),
    { stroke: "blue", lineWidth: lineWidthFromPt(0.4) }
  );
  const geometry = tip.geometry;

  close(inPt(geometry.length), 5, "length");
  close(inPt(geometry.width), 6, "width");
  close(inPt(geometry.inset), 1, "inset");
  close(inPt(geometry.lineWidth), 0.8, "tip line width");
  close(inPt(geometry.tipEnd), 1.4, "reversed round tip end");
  close(inPt(geometry.backEnd), -4.4, "reversed round back end");
  close(inPt(geometry.lineEnd), -0.2, "reversed line end");
  close(inPt(geometry.visualTipEnd), -0.4, "reversed visual tip end");
  close(inPt(geometry.visualBackEnd), -4.4, "reversed visual back end");
  close(inPt(geometry.terminalPlacement), 1.6, "reversed shaft shortening");
  assert.equal(geometry.harpoon, true);
  assert.equal(geometry.swap, true);
  assert.equal(geometry.reversed, true);
  assert.equal(geometry.slant, 0.25);
  assert.equal(geometry.paths.length, 2);
  assert.equal(tip.lineCap, "round");
  assert.equal(tip.lineJoin, "round");
});

test("clamps a length-sized inset and emits one connected Tee Barb polyline", () => {
  const tip = resolveInlineArrowTip(
    parseArrowTipSpec("Tee Barb[length=2pt,width=6pt,inset=2pt,round]"),
    { stroke: "black", lineWidth: lineWidthFromPt(0.4) }
  );
  const geometry = tip.geometry;

  close(inPt(geometry.front), 0.2, "clamped front");
  close(inPt(geometry.back), -2, "back");
  close(inPt(geometry.tipEnd), 0.2, "clamped round tip end");
  close(inPt(geometry.backEnd), -2.2, "round back end");
  assert.equal(geometry.frontClamped, true);
  assert.equal(geometry.paths.length, 1);
  assert.equal(geometry.paths[0].length, 4);
});

test("uses the full outer double-line width for Tee Barb dependent dimensions", () => {
  const tip = resolveInlineArrowTip(parseArrowTipSpec("Tee Barb"), {
    stroke: "black",
    lineWidth: lineWidthFromPt(0.4),
    doubleColor: "white",
    doubleDistance: lineWidthFromPt(0.6)
  });

  close(inPt(tip.geometry.length), 4.3, "double-line-dependent length");
  close(inPt(tip.geometry.width), 8.6, "double-line-dependent width");
  close(inPt(tip.geometry.lineWidth), 0.4, "outer-factor-adjusted tip stroke");
});

test("scales Tee Barb length and width independently without scaling its stroke", () => {
  const tip = resolveInlineArrowTip(
    parseArrowTipSpec("Tee Barb[scale length=2,scale width=.5]"),
    { stroke: "black", lineWidth: lineWidthFromPt(0.4) }
  );

  close(inPt(tip.geometry.length), 4.6, "scaled length");
  close(inPt(tip.geometry.inset), 2.3, "scaled inset");
  close(inPt(tip.geometry.width), 2.3, "scaled width");
  close(inPt(tip.geometry.lineWidth), 0.4, "unscaled tip stroke");
});

test("maps the Bar and Bracket aliases onto the two Tee Barb special path branches", () => {
  const style = { stroke: "black", lineWidth: lineWidthFromPt(0.4) };
  const bar = resolveInlineArrowTip(parseArrowTipSpec("Bar"), style).geometry;
  const bracket = resolveInlineArrowTip(parseArrowTipSpec("Bracket"), style).geometry;

  close(inPt(bar.length), 0, "Bar length");
  assert.equal(bar.paths.length, 1);
  assert.equal(bar.paths[0].length, 2);
  closePoint(bar.paths[0][0], { x: 0, y: 2.3 }, "Bar start");
  closePoint(bar.paths[0][1], { x: 0, y: -2.3 }, "Bar end");

  close(inPt(bracket.length), 1.15, "Bracket length");
  close(inPt(bracket.inset), 1.15, "Bracket inset");
  assert.equal(bracket.paths.length, 1);
  assert.equal(bracket.paths[0].length, 4);
  closePoint(bracket.paths[0][0], { x: -1.15, y: 2.1 }, "Bracket start");
  closePoint(bracket.paths[0][1], { x: 0, y: 2.1 }, "Bracket upper corner");
  closePoint(bracket.paths[0][2], { x: 0, y: -2.1 }, "Bracket lower corner");
  closePoint(bracket.paths[0][3], { x: -1.15, y: -2.1 }, "Bracket end");
});

test("includes the asymmetric Tee Barb harpoon hull in SVG bounds", () => {
  const markerEnd = parseArrowTipSpec("Tee Barb[length=7pt,width=10pt,inset'=0pt .3,left,slant=.25]");
  const style = { stroke: "black", lineWidth: lineWidthFromPt(0.4), markerEnd };
  const bounds = computeSvgBounds([{
    type: "path",
    commands: [{ type: "moveTo", x: 0, y: 0 }, { type: "lineTo", x: 1, y: 0 }],
    style
  }], { unit: 100 });

  assert.ok(bounds.maxY > -bounds.minY * 2, `expected left Tee Barb harpoon above its shaft, got ${JSON.stringify(bounds)}`);
});

test("renders the Tee Barb flowchart, interval, and vector fixture without diagnostics", () => {
  const source = readFileSync(new URL(
    "./fixtures/examples/arrows/meta-tee-barb-controls.tex",
    import.meta.url
  ), "utf8");
  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.equal((result.svg.match(/tikz-arrow-tee-barb/g) || []).length, 7);
  assert.match(result.svg, /sample/);
  assert.match(result.svg, /accept/);
  assert.match(result.svg, /reset/);
});
