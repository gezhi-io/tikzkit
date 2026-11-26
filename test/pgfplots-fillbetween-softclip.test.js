import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { clipFillBetweenAxis, softClipFillBetweenBoundary } from "../src/pgfplots/fillBetweenSoftClip.js";
import { createDataToCanvasTransform } from "../src/pgfplots/transformDataToCanvas.js";

const move = (x, y) => ({ type: "moveTo", x, y });
const line = (x, y) => ({ type: "lineTo", x, y });
const curve = (x1, y1, x2, y2, x, y) => ({ type: "curveTo", x1, y1, x2, y2, x, y });
const close = { type: "closePath" };

function nearPath(actual, expected, tolerance = 1e-10) {
  assert.deepEqual(actual.map(c => c.type), expected.map(c => c.type));
  expected.forEach((cmd, i) => {
    for (const [key, value] of Object.entries(cmd)) {
      if (key !== "type") assert.ok(Math.abs(actual[i][key] - value) < tolerance,
        `command ${i}.${key}: expected ${value}, got ${actual[i][key]}`);
    }
  });
}

test("no domain is an identity; arbitrary clip contours and expressions are not numeric strips", () => {
  const path = [move(1, 2), line(3, 4)];
  for (const selector of [undefined, "", "(0,0) rectangle (1,1)", "domain=0:sin(1)", "y domain=0:1"]) {
    assert.equal(softClipFillBetweenBoundary(path, selector), path);
  }
  assert.equal(clipFillBetweenAxis(path, "x", -Infinity, Infinity), path);
  assert.deepEqual(clipFillBetweenAxis(path, "y", -Infinity, 1), []);
});

test("maps numeric domains and the native y alias, leaving the unsurveyed overlay direction unbounded", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: -2, yMax: 3 };
  const geometry = createDataToCanvasTransform({ ranges, geometry: { origin: { x: 10, y: 12 }, width: 5, height: 10 },
    axisOptions: { "y dir": "reverse" } });
  const horizontal = [move(15, 100), line(10, 100)];
  nearPath(softClipFillBetweenBoundary(horizontal, "domain=.2:.8", ranges, geometry),
    [move(14, 100), line(11, 100)]);
  const vertical = [move(-100, 12), line(-100, 22)];
  for (const selector of ["{domain y={-1:2}}", "y domain y=-1:2"]) {
    nearPath(softClipFillBetweenBoundary(vertical, selector, ranges, geometry),
      [move(-100, 14), line(-100, 20)]);
  }
});

test("preserves untouched move-only paths by identity and discards outside moves without drawing", () => {
  const keep = move(1, -2), drop = move(3, -2);
  const inside = [keep, move(0, 9)];
  assert.equal(clipFillBetweenAxis(inside, "x", 0, 1), inside);
  assert.deepEqual(clipFillBetweenAxis([drop], "x", 0, 1), []);
  assert.deepEqual(clipFillBetweenAxis([drop, keep, drop], "x", 0, 1), [keep]);
  const empty = [];
  assert.equal(clipFillBetweenAxis(empty, "y", -2, 2), empty);
});

test("a two-sided trim of x=t^3 keeps the restricted cubic, including both controls", () => {
  const path = Object.freeze([move(0, 0), curve(0, 1, 0, 1, 1, 0)].map(Object.freeze));
  // x=t^3, y=3t(1-t), restricted to [1/4,3/4]; controls follow from the endpoint derivatives.
  nearPath(clipFillBetweenAxis(path, "x", 1/64, 27/64),
    [move(1/64, 9/16), curve(3/64, 13/16, 9/64, 13/16, 27/64, 9/16)]);
});

test("one cubic crosses a single physical edge three times; its two retained runs stay separate", () => {
  // x=192(t-1/4)(t-1/2)(t-3/4), y=3t. Keep [1/4,1/2] and [3/4,1].
  const path = [move(-18, 0), curve(26, 1, -26, 2, 18, 3)];
  nearPath(clipFillBetweenAxis(path, "x", 0, Infinity), [
    move(0, .75), curve(2, 1, 1, 1.25, 0, 1.5),
    move(0, 2.25), curve(2, 2.5, 7, 2.75, 18, 3)
  ]);
});

test("PGF soft clip splits the remaining cubic at original hit times and restarts runs at the solution point", () => {
  const path = [move(-18, 0), curve(26, 1, -26, 2, 18, 3)];
  // Same 1/4, 1/2, 3/4 intersections as the geometric clip above. The second
  // hit takes half the first remainder; the third moveto is the original hit.
  nearPath(softClipFillBetweenBoundary(path, "domain=0:30", { yMin: 0 }, { mapPoint: p => p }), [
    move(0, .75), curve(3, 1.125, -.75, 1.5, -1.125, 1.875),
    move(0, 2.25), curve(10.59375, 2.8125, 13.875, 2.90625, 18, 3)
  ]);
});

test("the original rising-cubic fixture matches the MacTeX fill controls and both bottom corners", () => {
  const file = new URL("./fixtures/examples/fill-between-boundaries/soft-clipped-rising-cubic.tex", import.meta.url);
  const { ir, diagnostics } = tikzToSvg(readFileSync(file, "utf8"));
  assert.deepEqual(diagnostics, []);
  const band = ir.items.find(item => item.style?.fill === "teal");
  // TeX Live 2025 softpath trace, in TeX points. Allow 0.005 mm for the
  // native intersection search and TeX dimension rounding (not a pixel gate).
  const cm = pt => pt * 2.54 / 72.27;
  nearPath(band.commands, [
    move(cm(32.19534), cm(36.97592)),
    curve(cm(57.61577), cm(67.51176), cm(83.04434), cm(83.6376), cm(108.47597), cm(93.28967)),
    line(cm(132.30208), cm(11.38062)), line(cm(39.83327), cm(11.38062)), close
  ], .0005);
});

test("use the true cubic extremum: keep an inside tangent intact and drop an isolated outside touch", () => {
  const arch = [move(0, 0), curve(1, 2, 2, 2, 3, 0)];
  assert.equal(clipFillBetweenAxis(arch, "y", -Infinity, 1.5), arch);
  assert.deepEqual(clipFillBetweenAxis(arch, "y", 1.5, Infinity), []);
  assert.deepEqual(clipFillBetweenAxis(arch, "y", 1.6, 2), []);
  nearPath(clipFillBetweenAxis(arch, "y", 1.125, Infinity),
    [move(.75, 1.125), curve(1.25, 1.625, 1.75, 1.625, 2.25, 1.125)]);
  const onEdge = [move(0, 1.5), line(2, 1.5)];
  assert.equal(clipFillBetweenAxis(onEdge, "y", 1.5, 1.5), onEdge);
  const tiny = [move(0, 0), curve(1, 2e-15, 2, 2e-15, 3, 0)];
  nearPath(clipFillBetweenAxis(tiny, "y", 1.125e-15, Infinity),
    [move(.75, 1.125e-15), curve(1.25, 1.625e-15, 1.75, 1.625e-15, 2.25, 1.125e-15)]);
});

test("an outside excursion and an explicit move both break runs even at coincident endpoints", () => {
  const path = [move(0, 0), line(1, 0), line(2, 1), line(1, 0), line(0, 1), move(0, 1), line(1, 1)];
  assert.deepEqual(clipFillBetweenAxis(path, "x", -Infinity, 1),
    [move(0, 0), line(1, 0), move(1, 0), line(0, 1), move(0, 1), line(1, 1)]);
});

test("a trim keeps just the original closing edge; an untouched closed subpath still closes", () => {
  const inside = [move(2, 0), line(3, 0), line(2, 1), close];
  const path = [move(-1, 0), line(1, 0), line(1, 2), close, ...inside];
  assert.deepEqual(clipFillBetweenAxis(path, "x", 0, Infinity),
    [move(0, 0), line(1, 0), line(1, 2), line(0, 1), ...inside]);
});
