import assert from "node:assert/strict";
import test from "node:test";
import { diagnosticRows, renderWorkbenchSource } from "../web/workbench.js";

test("workbench renders through TikZKit public async API", async () => {
  const result = await renderWorkbenchSource(String.raw`\begin{tikzpicture}\draw (0,0)--(1,0);\end{tikzpicture}`);
  assert.match(result.svg, /^<svg class="tikz-render-svg"/);
  assert.equal(Array.isArray(result.diagnostics), true);
  assert.equal(Number.isFinite(result.elapsedMs), true);
});

test("workbench diagnostic rows preserve severity, code, message, and source location", () => {
  assert.deepEqual(
    diagnosticRows([{ severity: "warning", code: "x", message: "Unsupported x", line: 3, column: 7 }]),
    [{ severity: "warning", code: "x", message: "Unsupported x", location: "3:7" }]
  );
});
