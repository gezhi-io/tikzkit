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

test("browser grid gate cannot accept empty reference and actual drawings", () => {
  const empty = { ticks: [], grids: [], glyphs: [] };
  assert.equal(compareAxisGrid(empty, empty).accepted, false);
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
