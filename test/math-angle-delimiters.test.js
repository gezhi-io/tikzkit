import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mathFallbackText } from "../src/tikz/text.js";
import { tikzToSvg } from "../src/index.js";

test("math fallback preserves angle delimiters in bras, kets and inner products", () => {
  assert.equal(mathFallbackText(String.raw`|e\rangle`), "|e\u27e9");
  assert.equal(mathFallbackText(String.raw`\langle g|e\rangle`), "\u27e8g|e\u27e9");
  assert.equal(mathFallbackText(String.raw`\left\langle x\right\rangle`), "\u27e8x\u27e9");
  assert.equal(mathFallbackText(String.raw`\ranglefoo`), "ranglefoo");
});

test("physics missing-child tree paints ket delimiters without printing command names", () => {
  const source = readFileSync(new URL("./fixtures/examples/trees/missing-physics.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text", fontUrlPrefix: "/fonts/" });
  assert.deepEqual(result.diagnostics, []);
  assert.doesNotMatch(result.svg, /rangle/);
  assert.equal((result.svg.match(/\u27e9/g) || []).length, 3);
});
