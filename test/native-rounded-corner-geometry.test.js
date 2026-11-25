import assert from "node:assert/strict";
import test from "node:test";
import { roundPathCorners } from "../src/tikz/pathOperations/roundedCorners.js";

const cmPerPt = 2.54 / 72.27;
const sp = 65536;
const M = (x, y) => ({ type: "moveTo", x: x * cmPerPt, y: y * cmPerPt });
const L = (x, y) => ({ ...M(x, y), type: "lineTo" });
const C = (a, b, c, d, x, y) => ({ ...M(x, y), type: "curveTo",
  x1: a * cmPerPt, y1: b * cmPerPt, x2: c * cmPerPt, y2: d * cmPerPt });
const Z = () => ({ type: "closePath" });

function rounded(commands, insetsPt) {
  commands.forEach(Object.freeze);
  return roundPathCorners(Object.freeze(commands), (command, index) => {
    assert.equal(command, commands[index]);
    return (insetsPt[index] || 0) * cmPerPt;
  });
}

// Expected rows are native soft-path tokens, not SVG samples: construct the
// path in pt with \pgfsetcornersarced, then \pgfgetpath\p\pgfprocessround\p\q.
// Read \q's coordinates with \number\dimexpr; combine support A/B/end into C.
function rows(commands) {
  return commands.map(({ type, x1, y1, x2, y2, x, y }) => {
    if (type === "closePath") return ["Z"];
    const coords = type === "curveTo" ? [x1, y1, x2, y2, x, y] : [x, y];
    return [{ moveTo: "M", lineTo: "L", curveTo: "C" }[type],
      ...coords.map(n => Math.round(n / cmPerPt * sp))];
  });
}

test("sharp paths and marked open ends return the original array", () => {
  const empty = [];
  assert.equal(rounded(empty, {}), empty);
  const path = [M(1, 2), L(3, 5), M(7, 8), C(2, 3, 4, 5, 6, 7)];
  assert.equal(roundPathCorners(path, () => false), path);
  assert.equal(rounded(path, { 1: 2, 3: -3 }), path);
  const tiny = [M(0, 0), L(2, 0), L(2, 3)];
  assert.equal(rounded(tiny, { 1: .4 / sp }), tiny);
});

test("adjacent oversized insets use original segments even when their cuts cross", () => {
  const path = [M(0, 0), L(10, 0), L(10, 2), L(20, 2), L(20, 20)];
  assert.deepEqual(rows(rounded(path, { 1: 4, 2: 4, 3: 4 })), [
    ["M", 0, 0], ["L", 393216, 0], ["C", 537996, 0, 655360, 117364, 655360, 262144],
    ["L", 655360, -131072], ["C", 655360, 13708, 772724, 131072, 917504, 131072],
    ["L", 1048576, 131072], ["C", 1193356, 131072, 1310720, 248436, 1310720, 393216],
    ["L", 1310720, 1310720]
  ]);
});

test("negative insets extend both legs; collinear corners still emit a cubic", () => {
  assert.deepEqual(rows(rounded([M(0, 0), L(10, 0), L(10, 5)], { 1: -2 })), [
    ["M", 0, 0], ["L", 786432, 0], ["C", 714042, 0, 655360, -58682, 655360, -131072],
    ["L", 655360, 327680]
  ]);
  assert.deepEqual(rows(rounded([M(0, 0), L(2, 0), L(4, 0)], { 1: 3 })), [
    ["M", 0, 0], ["L", -65536, 0], ["C", 43049, 0, 219095, 0, 327680, 0], ["L", 262144, 0]
  ]);
});

test("cubic joins use the neighboring supports; a marked close uses its own move and first support", () => {
  const path = [M(71, 22), L(72, 24), M(0, 0), C(0, 8, 10, -3, 10, 0),
    C(14, 0, 17, 12, 20, 7), Z(), M(-1, -3), L(3, 3)];
  const result = rounded(path, { 1: 7, 3: 2, 5: 3, 7: 8 });
  assert.deepEqual(rows(result.slice(2, -2)), [
    ["M", 0, 196608], ["C", 0, 524288, 655360, -196608, 655360, -131072],
    ["C", 655360, -58682, 714042, 0, 786432, 0],
    ["C", 917504, 0, 1114112, 786432, 1310720, 458752],
    ["L", 185562, 64944], ["C", 83078, 29076, 0, 88023, 0, 196608], ["Z"]
  ]);
  assert.deepEqual(result.slice(0, 2), path.slice(0, 2));
  assert.deepEqual(result.slice(-2), path.slice(-2));
});

test("the close marker is independent of a marked line that explicitly returns to the start", () => {
  const path = [M(2, 3), L(12, 3), L(2, 3), Z()];
  const beforeClose = [["L", 786432, 196608], ["L", 327680, 196608],
    ["C", 219095, 196608, 131072, 284631, 131072, 393216]];
  assert.deepEqual(rows(rounded(path, { 2: 3 })), [["M", 131072, 196608], ...beforeClose, ["Z"]]);
  assert.deepEqual(rows(rounded(path, { 2: 3, 3: 2 })), [
    ["M", 262144, 196608], ...beforeClose, ["L", 131072, 327680],
    ["C", 131072, 255290, 189754, 196608, 262144, 196608], ["Z"]
  ]);
  assert.deepEqual(rows(rounded([M(2, 3), Z()], { 1: 2 })), [
    ["M", 131072, 327680], ["L", 131072, 327680],
    ["C", 131072, 255290, 131072, 255290, 131072, 327680], ["Z"]
  ]);
});

test("a marked close may override the preceding corner with a different signed inset", () => {
  assert.deepEqual(rows(rounded([M(2, 3), L(12, 3), L(2, 13), Z()], { 2: 3, 3: -2 })), [
    ["M", 0, 196608], ["L", 786432, 196608], ["L", 270095, 712945],
    ["C", 193314, 789726, 131072, 763945, 131072, 655360], ["L", 131072, 65536],
    ["C", 131072, 137926, 72390, 196608, 0, 196608], ["Z"]
  ]);
});

test("continuing after a rounded close uses its exit until the next explicit move", () => {
  const path = [M(0, 0), L(5, 0), Z(), L(2, 4), L(10, 4), Z()];
  assert.deepEqual(rows(rounded(path, { 2: 2, 3: 3, 5: 3 })), [
    ["M", 327680, 0], ["L", 327680, 0], ["L", 131072, 0],
    ["C", 58682, 0, 58682, 0, 131072, 0], ["Z"], ["L", 131072, 65536],
    ["C", 131072, 174121, 219095, 262144, 327680, 262144], ["L", 655360, 262144],
    ["L", 306911, 87918], ["C", 209797, 39362, 219095, 0, 327680, 0], ["Z"]
  ]);
});

test("zero cubic tangents normalize to +Y without searching for another support", () => {
  const path = [M(-8, 3), C(-3, -1, 0, 0, 0, 0), C(0, 0, 8, 10, 10, 7)];
  assert.deepEqual(rows(rounded(path, { 1: 2 })), [
    ["M", -524288, 196608], ["C", -196608, -65536, 0, 0, 0, 131072],
    ["C", 0, 58682, 0, 58682, 0, 131072], ["C", 0, 0, 524288, 655360, 655360, 458752]
  ]);
});

test("PGF normalization preserves oblique table values and the .001pt atan2 branch", () => {
  const cases = [
    [[M(0, 0), L(3, 4), L(-.125, 9.5625)], 10, [-196602, -262126],
      [20564, 27424, 52907, 517938, -124362, 833484]],
    [[M(.003, .006), L(0, 0), L(.008, .013)], 10, [293530, 585910],
      [131416, 262317, 153703, 249911, 343310, 558200]],
    [[M(0, 0), L(10 / sp, 65 / sp), L(1, 1)], 2, [-131062, 65],
      [-58672, 65, 41523, 41540, 92732, 92703]],
    [[M(0, 0), L(10 / sp, 66 / sp), L(1, 1)], 2, [-19758, -129500],
      [-8841, -57942, 41523, 41540, 92732, 92702]]
  ];
  for (const [path, inset, entry, cubic] of cases) {
    assert.deepEqual(rows(rounded(path, { 1: inset })).slice(1, -1), [["L", ...entry], ["C", ...cubic]]);
  }
});
