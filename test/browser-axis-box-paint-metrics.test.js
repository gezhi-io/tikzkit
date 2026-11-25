import assert from "node:assert/strict";
import test from "node:test";
import { compareAxisBoxPaint } from "../scripts/browser-axis-box-paint-metrics.js";

const pen = () => ({ color: "rgb(0, 0, 0)", width: 2, dash: [6, 3], dashOffset: 0,
  cap: "butt", join: "miter", points: [{ x: 0, y: 0 }, { x: 0, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 0 }] });
const sample = () => ({ frame: pen(), plots: [{ ...pen(), color: "rgb(255, 0, 0)", afterFrame: true }] });

test("browser box paint gate accepts matching physical paths", () => {
  assert.equal(compareAxisBoxPaint(sample(), sample()).accepted, true);
});

test("browser box paint gate rejects reversed frames, wrong layer order and dash drift", () => {
  for (const change of [
    p => p.frame.points.reverse(),
    p => { p.plots[0].afterFrame = false; },
    p => { p.frame.dashOffset = 1; },
    p => { p.frame.width += .1; },
    p => { p.frame.dash[0] = NaN; }
  ]) {
    const actual = sample();
    change(actual);
    assert.equal(compareAxisBoxPaint(actual, sample()).accepted, false);
  }
});
