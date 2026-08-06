import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const SOURCE = readFileSync(
  new URL("./fixtures/examples/circuitikz/zener-tvs-diodes.tex", import.meta.url),
  "utf8"
);

test("renders circuitikz Zener, ZZener, and TVS diode whiskers", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const diodes = result.ir.items.filter((item) => item.subtype === "circuitikz-diode");
  const tvs = result.ir.items.filter((item) => item.subtype === "circuitikz-tvs-diode");
  const cathodes = result.ir.items.filter((item) => item.subtype === "circuitikz-diode-cathode");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(diodes.filter((item) => item.diodeKind === "zener").length, 2);
  assert.equal(diodes.filter((item) => item.diodeKind === "zzener").length, 2);
  assert.equal(tvs.length, 2);
  assert.equal(cathodes.length, 6);
  assert.ok(diodes.some((item) => item.diodeKind === "zener" && item.variant === "empty" && item.fill !== "none"));
  assert.ok(diodes.some((item) => item.diodeKind === "zzener" && item.whiskers === "sloped"));
  assert.ok(diodes.some((item) => item.diodeKind === "zzener" && item.whiskers === "straight"));
  assert.ok(tvs.some((item) => item.variant === "empty" && item.whiskers === "straight"));
  assert.ok(tvs.some((item) => item.variant === "full" && item.whiskers === "sloped" && item.bodyLength < 1));
});
