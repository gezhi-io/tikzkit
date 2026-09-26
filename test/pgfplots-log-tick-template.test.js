import assert from "node:assert/strict";
import test from "node:test";
import { axisRenderedTickLabels } from "../src/pgfplots/ticks.js";

test("log tick templates receive display-log values before local number formatting", () => {
  assert.deepEqual(axisRenderedTickLabels({ xmode: "log" }, "x", undefined, [5, 50], {},
    "$" + String.raw`{\pgfmathprintnumber[fixed,precision=0]{\tick}}^*$`), ["${1}^*$", "${2}^*$"]);
  assert.deepEqual(axisRenderedTickLabels({ ymode: "log", "log basis y": 2 }, "y", undefined, [2, 8], {},
    String.raw`$2^{\tick}$`), ["$2^{1}$", "$2^{3}$"]);
});

test("log tick templates leave explicit labels and default power notation intact", () => {
  const options = { zmode: "log", "log basis z": 2 };
  assert.deepEqual(axisRenderedTickLabels(options, "z", "{low,high}", [2, 8], {}, String.raw`\tick`), ["low", "high"]);
  assert.deepEqual(axisRenderedTickLabels(options, "z", undefined, [2, 8]), ["$2^{1}$", "$2^{3}$"]);
  assert.deepEqual(axisRenderedTickLabels({}, "x", undefined, [5, 50], {}, String.raw`\tick`), ["5", "50"]);
});
