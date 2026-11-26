import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { clipFillBetweenAxis, clipFillBetweenBox } from "../src/pgfplots/fillBetweenSoftClip.js";

// The fixture values below are TeX Live 2025 softpath traces in TeX points;
// the public helper takes and returns ordinary scene commands in cm.
const pt = 2.54 / 72.27;
const M = (x, y) => ({ type: "moveTo", x: x * pt, y: y * pt });
const L = (x, y) => ({ type: "lineTo", x: x * pt, y: y * pt });
const C = (x1, y1, x2, y2, x, y) => ({ type: "curveTo", x1: x1 * pt, y1: y1 * pt,
  x2: x2 * pt, y2: y2 * pt, x: x * pt, y: y * pt });
const Z = { type: "closePath" };
const box = (minX, maxX, minY, maxY) => ({ minX: minX * pt, maxX: maxX * pt, minY: minY * pt, maxY: maxY * pt });
const square = box(0, 100, 0, 100);

function expectTrace(path, expected, rect = square, tolerancePt = 0.004) {
  expectCommands(clipFillBetweenBox(path, rect), expected, tolerancePt);
}

function expectCommands(actual, expected, tolerancePt) {
  assert.deepEqual(actual.map(c => c.type), expected.map(c => c.type));
  for (const [i, cmd] of expected.entries()) for (const [key, value] of Object.entries(cmd)) {
    if (key !== "type") assert.ok(Math.abs(actual[i][key] - value) / pt < tolerancePt,
      `command ${i}.${key}: ${actual[i][key] / pt}pt, expected ${value / pt}pt`);
  }
}

test("two-side rectangle fixture: use the original left and top hit times on one cubic", () => {
  const rect = box(48.36761, 162.17377, 5.6903, 86.77719);
  const rise = Object.freeze([M(14.22577, 25.60638),
    C(59.74823, 85.35461, 105.27069, 101.00296, 150.79315, 106.69327)].map(Object.freeze));
  // Original hits t=.24976, .50513. The top solution is (83.19562,86.78424),
  // NOT the endpoint returned by split@curveto on the remaining controls.
  expectTrace(rise, [M(48.3509, 62.62933), C(65.59406, 77.74303, 82.84146, 87.7418, 100.09097, 94.48695)],
    rect, 0.001);
  expectTrace([M(14.22577, 12.80319), L(153.6383, 12.80319)],
    [M(48.3684, 12.80319), L(153.6383, 12.80319)], rect);
});

test("distinct sides on a reversed cubic are sorted by source time, not rectangle order", () => {
  expectTrace([M(90, 211), C(50, 19, 10, 19, -30, 19)],
    [M(60.00613, 100.01978), C(37.51616, 39.27472, 15.02141, 24.07362, -7.47452, 20.26964)]);
});

test("three hits on one edge restart the second run at the original solution", () => {
  expectTrace([M(-18, 14), C(26, 34, -26, 54, 18, 74)], [
    M(-0.00589, 28.9628), C(3.00778, 36.46428, -0.73584, 43.96379, -1.12239, 51.46233),
    M(-0.00581, 58.95313), C(10.57022, 70.23653, 13.86021, 72.11827, 18, 74)
  ]);
});

test("line hits keep rectangle discovery order; extensions past the other sides do not hit", () => {
  for (const path of [[M(-20, 20), L(120, 80)], [M(120, 80), L(-20, 20)]]) {
    expectTrace(path, [M(0, 28.5714), L(100, 71.4286)]);
  }
  for (const path of [[M(-10, 9), L(9, -10)], [M(20, -0.2), L(80, -0.2)],
    [M(-20, 115), C(20, 125, 70, 119, 160, 111)]]) expectTrace(path, []);
});

test("descending lower limit in the qualified-key fixture: finite PGF box and geometric strip differ", () => {
  // MacTeX default compat, from the actual axis (width=4cm, height=2cm,
  // xmin=0,xmax=4,ymin=0,ymax=2). The uncut paths set reverse=0 before
  // soft clipping. Both line hits have time 0, so the joined lower leg is 1 -> 3.
  const lower = [M(113.80615, 14.22577), L(0, 14.22577)];
  const rect = box(28.45154, 85.35461, -5.6903, 62.59338);
  expectTrace(lower, [M(28.44981, 14.22577), L(85.35461, 14.22577)], rect);
  const strip = clipFillBetweenAxis(lower, "x", rect.minX, rect.maxX);
  assert.deepEqual(strip.map(c => c.type), ["moveTo", "lineTo"]);
  assert.ok(Math.abs(strip[0].x - rect.maxX) < 1e-12 && Math.abs(strip[1].x - rect.minX) < 1e-12);
});

test("flipped rectangle fixture: authored corners determine the order of same-index line hits", () => {
  expectTrace([M(14.22577, 48.36761), L(156.48346, 105.27069)],
    [M(96.73549, 81.37149), L(42.67903, 59.74892)],
    { ...box(19.91608, 96.73523, 59.74823, 96.73523), flipX: true, flipY: true });
  expectTrace([M(14.22577, 7.11288), L(156.48346, 35.56442)],
    [M(128.03235, 29.87419), L(56.9035, 15.64842)],
    { ...box(56.90308, 150.79315, 12.80319, 29.87411), flipX: true });
});

test("assembly of independent flipped rectangles matches the painted quadrilateral, not a bow tie", () => {
  const source = readFileSync(new URL("./fixtures/examples/fill-between-rectangles/independent-flipped-rectangles.tex",
    import.meta.url), "utf8");
  const swapped = source.replace("(axis cs:4.3,-0.55) rectangle (axis cs:1,0.05)",
    "(axis cs:1,0.05) rectangle (axis cs:4.3,-0.55)");
  assert.notEqual(source, swapped);
  const left = L(56.9035, 15.64842), right = L(128.03235, 29.87419);
  // Native: both source lines ascend, so assembly reverses the second AFTER
  // clipping. Swapping just its box corners leaves all four bounds identical
  // but changes its hit order; that negative control really is a bow tie.
  for (const [tex, lower] of [[source, [left, right]], [swapped, [right, left]]]) {
    const result = tikzToSvg(tex);
    assert.deepEqual(result.diagnostics, []);
    const fills = result.ir.items.filter(item => item.style?.fill === "teal");
    assert.equal(fills.length, 1);
    expectCommands(fills[0].commands, [M(96.73549, 81.37149), L(42.67903, 59.74892), ...lower, Z], .01);
  }
});

test("a corner kiss or a shared vertex toggles only once, even if the tail is outside", () => {
  expectTrace([M(-10, 10), L(10, -10)], [M(0, 0), L(10, -10)]);
  expectTrace([M(-20, -20), L(120, 120)], [M(0, 0), L(100, 100)]);
  expectTrace([M(-10, 20), L(0, 50), L(-10, 80)], [M(0, 50), L(0, 50), L(-10, 80)]);
  expectTrace([M(-2, 40), L(2, 40), L(-2, 41.5)], [M(0, 40), L(2, 40), L(-2, 41.5)]);
  expectTrace([M(-2, 40), L(2, 40), L(-2, 43)], [M(0, 40), L(2, 40), L(0, 41.5)]);
});

test("line along an edge has no collinear hits; adjacent faces can still cut it", () => {
  expectTrace([M(20, 0), L(80, 0)], []);
  expectTrace([M(20, 100), L(80, 100)], []);
  expectTrace([M(-10, 0), L(120, 0)], [M(0, 0), L(100, 0)]);
  expectTrace([M(0, 40), L(-20, 20)], [M(0, 40), L(-20, 20)]);
  expectTrace([M(-20, 20), L(0, 40)], [M(0, 40), L(0, 40)]);
});

test("a cubic tangent is a single reported hit, approached from either side", () => {
  expectTrace([M(10, -30), C(30, 10, 70, 10, 90, -30)],
    [M(50.00244, -0.00002), C(64.97069, 0.01953, 79.99023, -9.98047, 90, -30)]);
  expectTrace([M(10, 30), C(30, -10, 70, -10, 90, 30)],
    [M(10, 30), C(19.99023, 10.01953, 34.97069, 0.01953, 49.95602, 0.00002)]);
});

test("a cubic coincident with the bottom edge is subdivided, not discarded as a parallel line", () => {
  const path = [M(20, 0), C(40, 0, 60, 0, 80, 0)];
  const runs = clipFillBetweenBox(path, square);
  // Native reports 42 discrete hits for this particular 60pt overlap.
  const starts = [20.3417, 23.45694, 26.57217, 29.31631, 32.83194, 35.9472, 38.69135,
    42.20697, 45.32224, 48.06638, 51.58203, 55.09766, 57.4414, 59.78519, 62.52933,
    64.87308, 67.21683, 70.33209, 73.84772, 76.19147, 78.53522];
  assert.equal(runs.length, 2 * starts.length);
  starts.forEach((x, i) => {
    assert.equal(runs[2 * i].type, "moveTo");
    assert.ok(Math.abs(runs[2 * i].x / pt - x) < .001);
    assert.equal(runs[2 * i + 1].type, "curveTo");
    assert.equal(runs[2 * i + 1].y, 0);
  });
  assert.ok(Math.abs(runs[1].x / pt - 22.17572) < .001);
  assert.ok(Math.abs(runs.at(-1).x / pt - 79.99995) < .001);
});

test("the first point owns parity across subsequent moves, including the no-hit fast path", () => {
  const unchanged = [M(10, 10), L(20, 15), M(200, 60), L(250, 60)];
  for (const p of [[], [M(12, 35)], unchanged, [M(10, 10), L(25, 40), Z]]) {
    assert.equal(clipFillBetweenBox(p, square), p);
  }
  expectTrace([M(-10, 20), M(12, 35)], []);
  for (const p of [M(0, 20), M(99.95, 20), M(100, 100)]) expectTrace([p], []);
  expectTrace([M(-20, 20), L(25, 20), M(120, 60), L(75, 60)], [M(0, 20), L(25, 20), M(120, 60), L(100, 60)]);
});

test("a split close uses its original closing edge and remembers the native close target", () => {
  expectTrace([M(-20, 30), L(50, 30), L(50, 80), Z], [M(0, 30), L(50, 30), L(50, 80), L(0.0026, 44.28757)]);
  expectTrace([M(20, 30), L(130, 30), L(120, 80), Z], [
    M(20, 30), L(99.99908, 30), M(100.0003, 70.00015), { ...Z, x: 20 * pt, y: 30 * pt }
  ]);
});

test("empty or invalid rectangles and unsupported command streams cannot leak partial paths", () => {
  for (const b of [box(5, 5, 0, 100), box(5, 0, 0, 100), box(0, Infinity, 0, 100)]) {
    expectTrace([M(1, 1), L(2, 2)], [], b);
  }
  expectTrace([M(1, 1), L(2, 2), { type: "quadTo", x: 3, y: 3 }], []);
  expectTrace([M(NaN, 1)], []);
});
