import assert from "node:assert/strict";
import test from "node:test";
import { compareChronologyPaint } from "../scripts/browser-chronology-metrics.js";

test("chronology browser paint gate rejects extra strokes, missing events and displaced intervals", () => {
  const event = { x: 10, y: -1, width: 20, height: 2, fill: "rgb(0, 0, 0)", opacity: .5, stroke: "none" };
  const ref = { events: [event] };
  assert.equal(compareChronologyPaint(ref, ref, 1).accepted, true);
  for (const change of [{ stroke: "rgb(0, 0, 0)" }, { opacity: 1 }, { height: 3 }, { x: 10.2 }]) {
    assert.equal(compareChronologyPaint({ events: [{ ...event, ...change }] }, ref, 1).accepted, false);
  }
  assert.equal(compareChronologyPaint({ events: [] }, ref, 1).accepted, false);
});
