import assert from "node:assert/strict";
import test from "node:test";

import { parseDimension } from "../src/engine/math.js";
import { tikzToSvg } from "../src/index.js";
import { pgfplotsCompatAtLeast } from "../src/pgfplots/compat.js";
import { pgfplotsUsesCorrectSampling } from "../src/pgfplots/sampling.js";

test("pgfplots compat levels compare as dotted versions, not decimals", () => {
  assert.equal(pgfplotsCompatAtLeast("1.18", "1.3"), true);
  assert.equal(pgfplotsCompatAtLeast("1.3", "1.3"), true);
  assert.equal(pgfplotsCompatAtLeast("1.2", "1.13"), false);
  assert.equal(pgfplotsCompatAtLeast("1.9", "1.13"), false);
  assert.equal(pgfplotsCompatAtLeast("newest", "1.13"), true);
  assert.equal(pgfplotsCompatAtLeast("pre 1.3", "1.3"), false);
  assert.equal(pgfplotsCompatAtLeast(undefined, "1.3"), false);
  assert.equal(pgfplotsCompatAtLeast(undefined, "1.3", { unset: true }), true);
  // `correct sampling` is a 1.13 feature; 1.2 used to pass a decimal comparison.
  assert.equal(pgfplotsUsesCorrectSampling({}, { "pgfplots compat": "1.2" }), false);
  assert.equal(pgfplotsUsesCorrectSampling({}, { "pgfplots compat": "1.18" }), true);
});

function tickSegments(align) {
  const { ir } = tikzToSvg(String.raw`\begin{tikzpicture}\begin{axis}[width=4cm,height=6cm,tick align=${align}]\addplot {x^2};\end{axis}\end{tikzpicture}`);
  return ir.items.filter((item) => item.subtype === "axis-tick");
}

function extent(items, key) {
  const values = items.flatMap((item) => item.commands.map((command) => command[key])).filter(Number.isFinite);
  return { min: Math.min(...values), max: Math.max(...values) };
}

test("box axis tick marks honor tick align outside and center on every frame side", () => {
  const tickLength = parseDimension("0.15cm");
  const inside = { x: extent(tickSegments("inside"), "x"), y: extent(tickSegments("inside"), "y") };
  for (const [align, factor] of [["outside", 1], ["center", 0.5]]) {
    const ticks = tickSegments(align);
    const x = extent(ticks, "x");
    const y = extent(ticks, "y");
    // Left/bottom ticks move out below the frame, right/top ticks beyond it.
    assert.ok(Math.abs(x.min - (inside.x.min - factor * tickLength)) < 1e-6, `${align} left ${x.min}`);
    assert.ok(Math.abs(x.max - (inside.x.max + factor * tickLength)) < 1e-6, `${align} right ${x.max}`);
    assert.ok(Math.abs(y.min - (inside.y.min - factor * tickLength)) < 1e-6, `${align} bottom ${y.min}`);
    assert.ok(Math.abs(y.max - (inside.y.max + factor * tickLength)) < 1e-6, `${align} top ${y.max}`);
  }
});

test("ellipse nodes circumscribe their text before applying a smaller minimum width", () => {
  const box = (options) => tikzToSvg(String.raw`\begin{tikzpicture}\node[draw,ellipse,${options}] (e) {WIDE TEXT LABEL};\end{tikzpicture}`)
    .ir.items.find((item) => item.type === "nodeBox");
  const natural = box("");
  const narrowMinimum = box("minimum width=0.5cm");
  const wideMinimum = box("minimum width=8cm");
  // pgflibraryshapes.geometric: radius = sqrt(2) * (content/2 + inner sep), then max with minimum/2.
  assert.ok(Math.abs(narrowMinimum.width - natural.width) < 1e-9, `${narrowMinimum.width} vs ${natural.width}`);
  assert.ok(Math.abs(wideMinimum.width - 8) < 1e-9, `${wideMinimum.width}`);
});
