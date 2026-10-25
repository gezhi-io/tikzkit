#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compareAxisGrid } from "./browser-axis-grid-metrics.js";

assert.ok(process.argv[2], "Usage: node scripts/check-pgfplots-origin-audit.js <browser audit directory>");
const root = path.resolve(process.argv[2]);
const audit = JSON.parse(await readFile(path.join(root, "browser-audit.json"), "utf8"));
const required = new Map([
  ["native-seams-positive", 12], ["native-seams-circle", 35],
  ["native-origin-negative", 12], ["native-origin-zero-minors", 6],
  ["native-origin-positive-grid", 12]
]);

// PGF's negative minor-tick foreach repaints identical opaque segments.
// Compare visible segments, retaining their direction, width and gray value.
// This is not a spatial fit: the underlying audit aligned once at the axes
// and measured every panel at the same physical scale in Chrome.
function distinctTicks(metrics) {
  assert.ok(metrics?.ticks && metrics.glyphs, "Run the browser audit with --tick-grid-metrics first");
  return { ...metrics, ticks: metrics.ticks.filter((tick, i, all) => !all.slice(0, i).some(previous =>
    tick.vertical === previous.vertical && ["x", "y", "length", "strokeWidth", "gray", ...(tick.dx === undefined ? [] : ["dx", "dy"])]
      .every(key => Math.abs(tick[key] - previous[key]) < 0.025))) };
}

const rows = audit.cases.map(entry => {
  const reference = distinctTicks(entry.panels[1].axisGrid);
  if (required.has(entry.id)) assert.equal(reference.ticks.length, required.get(entry.id), `${entry.id}: native visible ticks`);
  const comparisons = entry.panels.filter((_, i) => i !== 1).map(panel => {
    const actual = distinctTicks(panel.axisGrid);
    const result = compareAxisGrid(actual, reference);
    // A no-grid control must have no grid in either renderer. The generic
    // combined grid gate deliberately requires nonempty grids, so keep that
    // original report unchanged and make this control's absence explicit.
    const gridsMatch = reference.grids.length ? result.grids.accepted : actual.grids.length === 0;
    const glyphsMatch = result.glyphs === result.referenceGlyphs && result.referenceGlyphs > 0 &&
      result.glyphErrorPx !== null && result.glyphErrorPx < result.tolerancePx;
    const frameMatches = !reference.frame || (result.frameErrorPx !== null && result.canvasErrorPx !== null &&
      result.frameErrorPx < result.tolerancePx && result.canvasErrorPx < result.tolerancePx);
    return { title: panel.title, ...result, gridsMatch,
      tickSliceAccepted: result.ticks.accepted && gridsMatch,
      accepted: result.ticks.accepted && gridsMatch && glyphsMatch && frameMatches };
  });
  return { id: entry.id, required: required.has(entry.id),
    rawReferenceTicks: entry.panels[1].axisGrid.ticks.length,
    uniqueReferenceTicks: reference.ticks.length, comparisons,
    accepted: comparisons.filter(result => !result.title.startsWith("Before")).every(result => result.accepted) };
});
for (const id of required.keys()) assert.ok(rows.some(row => row.id === id), `Missing required control: ${id}`);
const report = { source: "browser-audit.json", tolerancePx: 0.35,
  scope: "Final-range linear origins, descriptions, major grids and visible minor ticks; not whole-raster acceptance",
  cases: rows, accepted: rows.filter(row => row.required).every(row => row.accepted) };
await writeFile(path.join(root, "origin-gate.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ accepted: report.accepted, cases: rows.map(row => ({ id: row.id,
  required: row.required, accepted: row.accepted,
  ticks: row.comparisons[0].ticks, glyphErrorPx: row.comparisons[0].glyphErrorPx })) }, null, 2));
assert.ok(report.accepted, "Final-range origin controls must match native browser geometry");
