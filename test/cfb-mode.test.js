import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

test("ignores an importer TODO marker while rendering the CFB decryption flow", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/cfb-mode-decryption.tex", "utf8");
  const result = tikzToSvg(source);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circle").length, 3);
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "rectangle").length, 3);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$IV$"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "$M_3$"));
});
