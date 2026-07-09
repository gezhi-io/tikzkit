import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../src/index.js";
import {
  createRequestGate,
  diagnosticRows,
  renderWorkbenchSource,
  selectTikzRenderer
} from "../web/workbench.js";

test("workbench falls back to the synchronous renderer from the committed public API", async () => {
  const committedPublicApi = { tikzToSvg: publicApi.tikzToSvg };
  const renderer = selectTikzRenderer(committedPublicApi);

  assert.equal(renderer, publicApi.tikzToSvg);
  const result = await renderer(String.raw`\begin{tikzpicture}\draw (0,0)--(1,0);\end{tikzpicture}`);
  assert.match(result.svg, /^<svg class="tikz-render-svg"/);
});

test("request gate identifies only the newest request as current", () => {
  const gate = createRequestGate();
  const first = gate.next();
  const second = gate.next();

  assert.equal(gate.current(), second);
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
});

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
