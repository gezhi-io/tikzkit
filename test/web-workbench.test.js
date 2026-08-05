import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../src/index.js";
import {
  SCRATCH_FIXTURE_ID,
  createScratchFixture,
  createScratchSource,
  createRequestGate,
  diagnosticRows,
  filterFixtures,
  isFixtureDraft,
  renderWorkbenchSource,
  selectTikzRenderer,
  sourceOffsetForLocation,
  svgDownloadName
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

test("workbench uses the same zero-margin SVG bounds as fixture comparisons", async () => {
  const source = String.raw`
\documentclass{article}
\usepackage[pdftex,active,tightpage]{preview}
\setlength\PreviewBorder{2mm}
\begin{document}
\begin{preview}
\begin{tikzpicture}\draw (0,0) -- (1,0);\end{tikzpicture}
\end{preview}
\end{document}`;
  const workbench = await renderWorkbenchSource(source);
  const comparison = publicApi.tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const svgSize = (svg) => svg.match(/\b(?:width|height)="[^"]+"/g)?.slice(0, 2);

  assert.deepEqual(workbench.diagnostics, []);
  assert.deepEqual(svgSize(workbench.svg), svgSize(comparison.svg));
});

test("workbench diagnostic rows preserve severity, code, message, and source location", () => {
  assert.deepEqual(
    diagnosticRows([{ severity: "warning", code: "x", message: "Unsupported x", line: 3, column: 7 }]),
    [{ severity: "warning", code: "x", message: "Unsupported x", location: "3:7" }]
  );
});

test("workbench fixture helpers provide a searchable scratch case and preserve source locations", () => {
  const scratch = createScratchFixture();
  assert.equal(scratch.id, SCRATCH_FIXTURE_ID);
  assert.match(createScratchSource(), /\\begin\{tikzpicture\}/);
  assert.deepEqual(
    filterFixtures([
      { id: "axis", title: "Scientific axes", features: ["pgfplots"] },
      { id: "tree", title: "Tree layout", features: ["trees"] }
    ], "TREE"),
    [{ id: "tree", title: "Tree layout", features: ["trees"] }]
  );
  assert.equal(sourceOffsetForLocation("one\ntwo\nthree", "2:2"), 5);
  assert.equal(sourceOffsetForLocation("one", "4:1"), null);
  assert.equal(isFixtureDraft("changed", "original"), true);
  assert.equal(isFixtureDraft("same", "same"), false);
  assert.equal(svgDownloadName("A complicated / case"), "A-complicated-case.svg");
});
