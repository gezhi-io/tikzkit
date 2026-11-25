import assert from "node:assert/strict";
import test from "node:test";
import { computeSvgBounds } from "../src/renderers/svg/bounds.js";
import { renderSvg } from "../src/renderers/svg/renderSvg.js";
import { renderPathElement, pathTerminalSegments } from "../src/renderers/svg/paths.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";
import { tikzToSvg } from "../src/index.js";

// Coordinates below are in TeX points. PGF's core 'to' at a 1pt pen
// has tip end .835pt, line end 0pt, and no picture hull.
const unit = lineWidthFromPt(1);
const move = (x, y) => ({ type: "moveTo", x, y });
const line = (x, y) => ({ type: "lineTo", x, y });
const curve = (x1, y1, x2, y2, x, y) => ({ type: "curveTo", x1, y1, x2, y2, x, y });
const close = { type: "closePath" };
const both = { markerStart: "to", markerEnd: "to" };
const item = (commands, style) => ({ type: "path", commands, style: { stroke: "black", lineWidth: unit, ...style } });
const bounds = (path) => computeSvgBounds([path], { unit });
const paint = (commands, style = both) => renderPathElement(item(commands, style), unit);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .0001, `${actual} != ${expected}`);

function checkShaft(svg, expected) {
  const tokens = svg.match(/<path d="([^"]*)"/u)?.[1].split(" ");
  const want = expected.split(" ");
  assert.equal(tokens?.length, want.length, `shaft: ${tokens}`);
  want.forEach((token, i) => {
    if (/^[MLCQZ]$/u.test(token)) assert.equal(tokens[i], token);
    else near(Number(tokens[i]) / unit, Number(token));
  });
}

function checkTips(svg, expected) {
  const tags = svg.match(/<path class="tikz-arrow-tip[^>]*>/gu) || [];
  assert.equal(tags.length, expected.length);
  tags.forEach((tag, i) => {
    const transform = tag.match(/translate\(([^ ]+) ([^)]+)\) rotate\(([^)]+)\)/u);
    assert.ok(transform, tag);
    const [x, y, angle] = expected[i];
    near(Number(transform[1]) / unit, x);
    near(-Number(transform[2]) / unit, y);
    near((Number(transform[3]) - angle) / 360, Math.round((Number(transform[3]) - angle) / 360));
  });
}

test("both arrows and both shortenings belong to the last subpath", () => {
  const commands = [move(-20, 7), line(-10, 7), move(10, 20), line(10, 40)];
  const original = structuredClone(commands);
  const style = { ...both, shortenStart: 2 * unit, shortenEnd: 3 * unit };
  const svg = paint(commands, style);
  checkShaft(svg, "M -20 -7 L -10 -7 M 10 -22.835 L 10 -36.165");
  checkTips(svg, [[10, 22.835, 90], [10, 36.165, -90]]);
  assert.deepEqual(bounds(item(commands, style)), { minX: -20.5, minY: 6.5, maxX: 10.5, maxY: 40.5 });
  assert.deepEqual(commands, original);
});

test("a trailing move takes both upward tips, but never moves the shaft", () => {
  const commands = [move(-5, 1), line(0, 1), move(4, -3), move(10, 20)];
  for (const [s, e] of [[0, 0], [-2, 3]]) {
    const svg = paint(commands, { ...both, shortenStart: s * unit, shortenEnd: e * unit });
    checkShaft(svg, "M -5 -1 L 0 -1");
    checkTips(svg, [[10, 20 - .835 - s, -90], [10, 20 - .835 - e, -90]]);
  }
  checkTips(paint([move(10, 20)]), [[10, 19.165, -90], [10, 19.165, -90]]);
  checkTips(paint([]), []);
});

test("a zero-length line has PGF's upward normalization for both shortening and rotation", () => {
  const commands = [move(10, 20), line(10, 20)];
  const start = { markerStart: "to", shortenStart: 2 * unit };
  const end = { markerEnd: "to", shortenEnd: 3 * unit };
  checkShaft(paint(commands, start), "M 10 -22.835 L 10 -20");
  checkTips(paint(commands, start), [[10, 17.165, -90]]);
  checkShaft(paint(commands, end), "M 10 -20 L 10 -23.835");
  checkTips(paint(commands, end), [[10, 16.165, -90]]);
  // The start now sees a real line to the already-shortened end.
  const svg = paint(commands, { ...start, ...end });
  checkShaft(svg, "M 10 -22.835 L 10 -23.835");
  checkTips(svg, [[10, 22.835, 90], [10, 16.165, -90]]);
  assert.deepEqual(bounds(item(commands, { ...start, ...end })), { minX: 9.5, minY: 19.5, maxX: 10.5, maxY: 20.5 });
});

test("a repeated first or last segment does not borrow a neighboring line's direction", () => {
  const leading = paint([move(0, 0), line(0, 0), line(10, 0)]);
  checkShaft(leading, "M 0 -.835 L 0 0 L 9.165 0");
  checkTips(leading, [[0, -.835, -90], [9.165, 0, 0]]);
  const trailing = paint([move(0, 0), line(10, 0), line(10, 0)]);
  checkShaft(trailing, "M .835 0 L 10 0 L 10 -.835");
  checkTips(trailing, [[.835, 0, 180], [10, -.835, -90]]);
});

test("end shortening past the start reverses the start frame, not the end frame", () => {
  const svg = paint([move(0, 0), line(.5, 0)]);
  checkShaft(svg, "M -.835 0 L -.335 0");
  checkTips(svg, [[-.835, 0, 0], [-.335, 0, 0]]);
});

test("an open cubic loop with coincident endpoints uses its two distinct controls", () => {
  const svg = paint([move(0, 0), curve(0, 10, 10, 0, 0, 0)]);
  checkShaft(svg, "M 0 -.835 C 0 -10 10 0 .835 0");
  checkTips(svg, [[0, .835, 90], [.835, 0, 180]]);
});

test("quick cubic shortening follows the next distinct control or the opposite endpoint", () => {
  const start = paint([move(0, 0), curve(0, 0, 0, 10, 10, 0)], { markerStart: "to" });
  checkShaft(start, "M 0 -.835 C 0 -10 0 -10 10 0");
  checkTips(start, [[0, .835, 90]]);
  const end = paint([move(10, 0), curve(0, 10, 0, 0, 0, 0)], { markerEnd: "to" });
  checkShaft(end, "M 10 0 C 0 -10 0 0 0 -.835");
  checkTips(end, [[0, .835, 90]]);
  const flat = paint([move(0, 0), curve(0, 0, 0, 0, 10, 0)], { markerStart: "to" });
  checkShaft(flat, "M .835 0 C 10 0 0 0 10 0");
  const point = paint([move(0, 0), curve(0, 0, 0, 0, 0, 0)]);
  checkShaft(point, "M 0 -.835 C 0 -.835 0 0 0 -.835");
  checkTips(point, [[0, .835, 90], [0, -.835, -90]]);
});

test("a close in any subpath suppresses all arrow paint, shortening and hulls", () => {
  const open = [move(-5, -2), line(1, -2)];
  const closed = [move(3, 0), line(3, 5), close];
  const tip = { kind: "to", legacy: false };
  const style = { markerStart: tip, markerEnd: tip, shortenStart: 10 * unit, shortenEnd: -5 * unit };
  for (const commands of [[...open, ...closed], [...closed, ...open]]) {
    const svg = paint(commands, style);
    checkTips(svg, []);
    assert.equal(svg.match(/<path d="[^"]+"/u)?.[0], paint(commands, {}).match(/<path d="[^"]+"/u)?.[0]);
    assert.deepEqual(bounds(item(commands, style)), bounds(item(commands, {})));
  }
});

test("a modern hull on a final move contributes at the same position as an upward line tip", () => {
  const prefix = [move(-20, 0), line(-10, 0)];
  const tip = { kind: "to", legacy: false };
  const style = { markerEnd: tip, shortenEnd: -5 * unit };
  const expected = bounds(item([...prefix, move(10, 10), line(10, 20)], style));
  assert.ok(expected.maxX > 10.5 && expected.maxY > 20.5);
  assert.deepEqual(bounds(item([...prefix, move(10, 20)], style)), expected);
});

test("stock cached delimiters and legacy latex paint without a page hull", () => {
  const commands = [move(0, 0), line(25, 0)];
  const expected = { minX: -.5, minY: -.5, maxX: 25.5, maxY: .5 };
  for (const tip of ["to", "square bracket", { kind: "latex", legacy: true }]) {
    const style = { markerStart: tip, markerEnd: tip };
    assert.equal((paint(commands, style).match(/class="tikz-arrow-tip/g) || []).length, 2);
    assert.deepEqual(bounds(item(commands, style)), expected, JSON.stringify(tip));
  }
  assert.ok(bounds(item(commands, { markerEnd: { kind: "to", legacy: false } })).maxY > .5);
});

test("arrow-only tips keep their stroke color without painting a shaft or adding pen padding", () => {
  const style = { stroke: "none", fill: "none", arrowStroke: "red", markerStart: "to", markerEnd: { kind: "latex", legacy: true } };
  const commands = [move(0, 2), line(10, 2)];
  const svg = paint(commands, style);
  assert.match(svg, /class="tikz-arrow-tip tikz-arrow-to"[^>]+stroke="red"/u);
  assert.match(svg, /class="tikz-arrow-tip tikz-arrow-latex"[^>]+fill="red"/u);
  for (const shaft of svg.match(/<path (?!class="tikz-arrow-tip)[^>]+>/gu) || []) {
    assert.match(shaft, /stroke="none"/u);
    assert.match(shaft, /fill="none"/u);
  }
  assert.deepEqual(bounds(item(commands, style)), { minX: 0, minY: 2, maxX: 10, maxY: 2 });
  assert.deepEqual(bounds(item([move(10, 2)], style)), { minX: 10, minY: 2, maxX: 10, maxY: 2 });
});

test("general terminal inspection still reports the first and last nonzero segments", () => {
  const commands = [move(0, 0), line(1, 0), move(4, 4), line(4, 5), move(8, 8)];
  const { first, last } = pathTerminalSegments(commands);
  assert.equal(first.startIndex, 0);
  assert.equal(last.commandIndex, 3);
});

test("SVG geometry starts on the painted circle, not its discarded center move", () => {
  const result = tikzToSvg(String.raw`\draw[<->] (0,0) circle[radius=2pt] (2,0) -- (3,0);`);
  assert.deepEqual(result.diagnostics, []);
  const shaft = result.svg.match(/<path d="([^"]+)"/u)?.[1];
  assert.match(shaft, /^M 7\.029\d+ 0 C /u);
  assert.match(shaft, / Z M 200 0 L 300 0$/u);
  assert.equal((shaft.match(/M /gu) || []).length, 2);
});

test("paint skips only move-only contours; zero-length segments and original bounds survive", () => {
  const commands = [move(-20, 30), move(1, 2), line(1, 2), move(3, 4), move(8, 9), line(9, 10), move(50, 60)];
  const original = structuredClone(commands);
  checkShaft(paint(commands, {}), "M 1 -2 L 1 -2 M 8 -9 L 9 -10");
  assert.doesNotMatch(paint([move(0, 0), move(10, 2)], {}), /<path\b/u);
  assert.deepEqual(commands, original);
  assert.deepEqual(bounds(item(commands, {})), { minX: -20.5, minY: 1.5, maxX: 50.5, maxY: 60.5 });
});

test("a retained silent line or point sets the page to its native extent plus the 2pt border", () => {
  for (const [commands, width] of [[[move(0, 1), line(2, 1)], 60.678], [[move(3, 2)], 3.985]]) {
    const bbox = { type: "bbox", commands, retainZeroExtent: true };
    const svg = renderSvg({ items: [bbox] }, { margin: lineWidthFromPt(2) });
    const size = svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/u);
    assert.ok(size);
    near(Number(size[1]), width);
    near(Number(size[2]), 3.985);
    assert.doesNotMatch(svg, /<path\b/u);
  }
});

test("ordinary empty-scene and unflagged bounding-box fallbacks are unchanged", () => {
  const point = { type: "bbox", commands: [move(10, 20)] };
  const fallback = { minX: 10, maxX: 11, minY: 20, maxY: 21 };
  assert.deepEqual(computeSvgBounds([point]), fallback);
  assert.deepEqual(computeSvgBounds([point, { ...point, retainZeroExtent: true, overlay: true }]), fallback);
  assert.deepEqual(computeSvgBounds([{ ...point, retainZeroExtent: true, excludeFromBounds: true }]),
    { minX: 0, minY: 0, maxX: 1, maxY: 1 });
});

test("rigid endpoint flex with a coincident near control uses the next cubic support", () => {
  const tip = { kind: "to", legacy: false, bending: { mode: "flex", factor: 0 } };
  for (const [commands, side] of [
    [[move(0, 0), curve(0, 0, 0, 1, 1, 0)], "markerStart"],
    [[move(1, 0), curve(0, 1, 0, 0, 0, 0)], "markerEnd"]
  ]) {
    const svg = renderPathElement(item(commands, { [side]: tip }), 100);
    const transform = svg.match(/class="tikz-arrow-tip[^"]*tikz-arrow-flex"[^>]+transform="matrix\(([^)]+)\)/u);
    assert.ok(transform);
    const [a, b, c, d, x, y] = transform[1].split(" ").map(Number);
    [a, b, c, d, x, y].forEach((n, i) => near(n, [0, 1, -1, 0, 0, -unit / 2][i]));
  }
});
