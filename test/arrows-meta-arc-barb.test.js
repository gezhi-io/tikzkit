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

test("uses the PGF Arc Barb defaults and half-line-width shortening", () => {
  const tip = resolveInlineArrowTip(parseArrowTipSpec("Arc Barb"), {
    stroke: "black",
    lineWidth: lineWidthFromPt(0.4)
  });
  const geometry = tip.geometry;

  close(inPt(geometry.length), 2.3, "length");
  close(inPt(geometry.width), 4.6, "width");
  close(inPt(geometry.lineWidth), 0.4, "tip line width");
  close(geometry.arc, 180, "arc");
  close(inPt(geometry.tipEnd), 2.3, "tip end");
  close(inPt(geometry.backEnd), 0, "back end");
  close(inPt(geometry.lineEnd), 2.1, "line end");
  close(inPt(geometry.terminalPlacement), 0.2, "shaft shortening");
  close(inPt(geometry.assemblyLength), 2.3, "assembly length");
  close(inPt(geometry.bounds.minX), 0, "lower x hull");
  close(inPt(geometry.bounds.maxX), 2.3, "upper x hull");
  close(inPt(geometry.bounds.minY), -2.3, "lower y hull");
  close(inPt(geometry.bounds.maxY), 2.3, "upper y hull");
  assert.equal(tip.lineCap, "butt");
  assert.equal(tip.lineJoin, "miter");
  assert.match(geometry.path, /^M [^C]+ C /);
  assert.doesNotMatch(geometry.path, /M 0 0 C/);
});

test("expands Parenthesis to its source-defined Arc Barb defaults", () => {
  const tip = resolveInlineArrowTip(parseArrowTipSpec("Parenthesis"), {
    stroke: "black",
    lineWidth: lineWidthFromPt(0.4)
  });
  const geometry = tip.geometry;

  assert.equal(tip.kind, "arc-barb");
  close(geometry.arc, 120, "parenthesis arc");
  close(inPt(geometry.length), 2.645, "parenthesis length");
  close(inPt(geometry.width), 5.29, "parenthesis width");
  close(inPt(geometry.tipEnd), 2.645, "parenthesis tip end");
  close(inPt(geometry.backEnd), 1.1225, "parenthesis back end");
  close(inPt(geometry.assemblyLength), 1.5225, "parenthesis assembly length");
  assert.equal(geometry.segments.length, 2);
  close(inPt(geometry.segments[0].end.x), 2.445 * Math.cos(Math.PI / 6), "90-degree split x");
  close(inPt(geometry.segments[0].end.y), -2.445 * 0.5, "90-degree split y");
});

test("combines reversed right harpoon, wide arc, round caps, and slant", () => {
  const tip = resolveInlineArrowTip(
    parseArrowTipSpec("Arc Barb[arc=270,length=5pt,width=6pt,line width=.8pt,round,right,reversed,slant=.25]"),
    { stroke: "blue", lineWidth: lineWidthFromPt(0.4) }
  );
  const geometry = tip.geometry;
  const forwardBackEnd = Math.cos(135 * Math.PI / 180) * 4.6 - 0.4;

  close(geometry.arc, 270, "arc");
  close(inPt(geometry.length), 5, "length");
  close(inPt(geometry.width), 6, "width");
  close(inPt(geometry.tipEnd), -forwardBackEnd, "reversed tip end");
  close(inPt(geometry.backEnd), -5, "reversed back end");
  close(inPt(geometry.lineEnd), -4.6, "reversed line end");
  close(inPt(geometry.terminalPlacement), -forwardBackEnd + 4.6, "reversed shortening");
  assert.equal(geometry.harpoon, true);
  assert.equal(geometry.swap, true);
  assert.equal(geometry.reversed, true);
  assert.equal(geometry.slant, 0.25);
  assert.equal(tip.lineCap, "round");
  assert.equal(tip.lineJoin, "round");
  assert.equal((geometry.path.match(/ C /g) || []).length, 2);
  assert.match(geometry.path, / L /);
});

test("uses the full outer double-line width for Arc Barb dependent dimensions", () => {
  const tip = resolveInlineArrowTip(parseArrowTipSpec("Arc Barb"), {
    stroke: "black",
    lineWidth: lineWidthFromPt(0.4),
    doubleColor: "white",
    doubleDistance: lineWidthFromPt(0.6)
  });

  close(inPt(tip.geometry.length), 4.3, "double-line-dependent length");
  close(inPt(tip.geometry.width), 8.6, "double-line-dependent width");
  close(inPt(tip.geometry.lineWidth), 0.4, "outer-factor-adjusted tip stroke");
});

test("includes the exact asymmetric Arc Barb harpoon hull in SVG bounds", () => {
  const markerEnd = parseArrowTipSpec("Arc Barb[arc=210,left,length=8pt,width=10pt]");
  const style = { stroke: "black", lineWidth: lineWidthFromPt(0.4), markerEnd };
  const bounds = computeSvgBounds([{
    type: "path",
    commands: [{ type: "moveTo", x: 0, y: 0 }, { type: "lineTo", x: 1, y: 0 }],
    style
  }], { unit: 100 });

  assert.ok(bounds.maxY > -bounds.minY * 2, `expected left harpoon above its shaft, got ${JSON.stringify(bounds)}`);
});

test("renders the Arc Barb and Parenthesis state-estimator fixture without diagnostics", () => {
  const source = readFileSync(new URL(
    "./fixtures/examples/arrows/meta-arc-barb-parenthesis-state-estimator.tex",
    import.meta.url
  ), "utf8");
  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.equal((result.svg.match(/tikz-arrow-arc-barb/g) || []).length, 6);
  assert.match(result.svg, /measurement update/);
  assert.match(result.svg, /admissible gain/);
});
