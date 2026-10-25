import assert from "node:assert/strict";
import test from "node:test";
import { axisAlignedViewport, compareAxisGrid } from "../scripts/browser-axis-grid-metrics.js";

const segment = (x, y, vertical = true) => ({ x, y, vertical, length: 100, strokeWidth: 1.6, gray: 210 });
const reference = { ticks: [segment(0, 0), segment(20, 0)],
  grids: [segment(0, 50), segment(20, 50)], glyphs: [{ x: 20, y: 110 }] };

test("browser grid gate matches segments independent of SVG path grouping/order", () => {
  const actual = structuredClone(reference);
  actual.ticks.reverse();
  actual.grids.reverse();
  assert.equal(compareAxisGrid(actual, reference).accepted, true);
});

test("browser grid gate rejects missing, duplicate or displaced lines", () => {
  for (const modify of [a => a.grids.pop(), a => a.grids.push(a.grids[0]), a => a.grids[0].x += 1]) {
    const actual = structuredClone(reference);
    modify(actual);
    assert.equal(compareAxisGrid(actual, reference).accepted, false);
  }
});

test("browser grid gate checks glyph positions, line widths and colors", () => {
  for (const modify of [a => a.glyphs[0].y += 1, a => a.ticks[0].strokeWidth /= 2, a => a.grids[0].gray += 10]) {
    const actual = structuredClone(reference);
    modify(actual);
    assert.equal(compareAxisGrid(actual, reference).accepted, false);
  }
});

test("browser grid gate rejects hue changes even when tick gray values match", () => {
  const expected = structuredClone(reference);
  expected.ticks[0].color = "rgb(255, 0, 0)";
  const actual = structuredClone(expected);
  assert.equal(compareAxisGrid(actual, expected).accepted, true);
  actual.ticks[0].color = "rgb(0, 0, 255)";
  assert.equal(compareAxisGrid(actual, expected).accepted, false);
  delete actual.ticks[0].color;
  assert.equal(compareAxisGrid(actual, expected).accepted, false);
});

test("browser grid gate cannot accept empty reference and actual drawings", () => {
  const empty = { ticks: [], grids: [], glyphs: [] };
  assert.equal(compareAxisGrid(empty, empty).accepted, false);
});

test("unlabeled axes require nonempty matching paint geometry and every crop edge", () => {
  const plot = { ticks: [], grids: [], glyphs: [], canvas: { left: -8, right: 108, top: -58, bottom: 8 },
    unlabeledPaint: [
      { paint: "stroke", color: "rgb(0, 0, 255)", opacity: 1, x: 0, y: -50, width: 100, height: 50, strokeWidth: 1.6 },
      { paint: "fill", color: "rgb(0, 0, 204)", opacity: 1, x: -8, y: -8, width: 16, height: 16, strokeWidth: 0 }
    ] };
  const same = structuredClone(plot);
  same.unlabeledPaint.reverse();
  assert.equal(compareAxisGrid(same, plot).accepted, true);
  for (const modify of [a => a.unlabeledPaint.pop(), a => a.unlabeledPaint[0].x++,
    a => a.unlabeledPaint[1].color = "red", a => a.unlabeledPaint[0].strokeWidth /= 2,
    a => a.canvas.bottom++, a => delete a.canvas, a => delete a.unlabeledPaint,
    a => a.glyphs.push({ x: 0, y: 0 })]) {
    const actual = structuredClone(plot);
    modify(actual);
    assert.equal(compareAxisGrid(actual, plot).accepted, false);
  }
});

test("browser grid gate verifies intentionally absent grids without accepting missing ticks or glyphs", () => {
  const noGrid = { ...structuredClone(reference), grids: [] };
  assert.equal(compareAxisGrid(noGrid, noGrid).accepted, true);
  for (const actual of [
    { ...noGrid, grids: [segment(0, 50)] },
    { ...noGrid, ticks: [] },
    { ...noGrid, glyphs: [] }
  ]) assert.equal(compareAxisGrid(actual, noGrid).accepted, false);
  assert.equal(compareAxisGrid(noGrid, reference).accepted, false);
});

test("projected browser gate rejects ticks with the wrong transverse direction", () => {
  const expected = structuredClone(reference);
  expected.ticks[0] = { ...expected.ticks[0], dx: 8, dy: -6 };
  const actual = structuredClone(expected);
  actual.ticks[0].dy = 6;
  assert.equal(compareAxisGrid(actual, expected).accepted, false);
  assert.equal(compareAxisGrid(expected, expected).accepted, true);
});

test("boxed browser gate checks the frame and every canvas edge", () => {
  const box = { ...structuredClone(reference), frame: { width: 120, height: 90 },
    canvas: { left: 10, right: 130, top: -100, bottom: 20 } };
  assert.equal(compareAxisGrid(box, box).accepted, true);
  for (const modify of [a => a.frame.height += 2, a => a.canvas.left += 2,
    a => a.canvas.bottom += 2, a => delete a.frame]) {
    const actual = structuredClone(box);
    modify(actual);
    assert.equal(compareAxisGrid(actual, box).accepted, false);
  }
});

test("axis-aligned browser sheets preserve every crop edge without resizing", () => {
  const panels = [
    { width: 100, height: 80, origin: { x: 20.25, y: 30.5 } },
    { width: 110, height: 90, origin: { x: 15, y: 40 } }
  ];
  const view = axisAlignedViewport(panels);
  assert.deepEqual(view, { x: 41, y: 60, width: 156, height: 130 });
  for (const panel of panels) {
    const left = view.x - panel.origin.x, top = view.y - panel.origin.y;
    assert.ok(left >= 20 && top >= 20);
    assert.ok(left + panel.width <= view.width - 20);
    assert.ok(top + panel.height <= view.height - 20);
  }
});
