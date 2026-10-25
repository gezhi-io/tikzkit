import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { layoutChronologyBlock } from "../src/extensions/chronologyLayout.js";
import { tikzToSvg } from "../src/index.js";

test("chronology lays out native labels and scales the entire picture box", () => {
  const block = { yearStart: 1800, yearStop: 2020, step: 50, widthCm: 9.72, baseWidthCm: 9.72,
    events: [{ endYear: 1812 - 1 / 372 - 1 / 12, label: String.raw`\small Beginnings of Gerrymandering` },
      { startYear: 1960 - 1 / 372 - 1 / 12, endYear: 2020 - 1 / 372 - 1 / 12, label: "" }] };
  const box = layoutChronologyBlock(block, { sans: true });
  // Independent PGF dimensions: fixtures/chronology-native-metrics.tex.
  for (const [key, value] of Object.entries({ minX: -.2, maxX: 278.0147, minY: -13.6729, maxY: 98.023 })) {
    assert.ok(Math.abs(box.bounds[key] - value) < .006, `${key}: ${box.bounds[key]} vs ${value}`);
  }
  assert.equal(box.commands.filter(line => line.startsWith("\\draw")).length, 225);
  assert.ok(box.commands.some(line => line.endsWith("{1850};")));
  assert.ok(!box.commands.some(line => line.endsWith("{1800};")));
  assert.ok(Math.abs(box.width - 276.58452) < .002);
});

test("chronology does not silently claim unsupported Beamer page settings", () => {
  const result = tikzToSvg(String.raw`\documentclass[12pt,aspectratio=169]{beamer}
    \usetheme{metropolis}\usepackage{chronology}\begin{document}
    \begin{frame}{Timeline}\begin{chronology}[10]{2000}{2020}{8cm}
    \event{2010}{Start}\end{chronology}\end{frame}\end{document}`);
  assert.ok(result.diagnostics.some(d => d.message.includes("unsupported native page")));
});

test("chronology events retain native fill-only paint under inherited scope color", () => {
  const source = readFileSync(new URL("fixtures/visual-followups/chronology-core.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  const events = result.ir.items.filter(item => item.type === "path" && item.style?.opacity === .5);
  assert.equal(events.length, 3);
  assert.ok(events.every(item => item.style.fill === "black" && item.style.stroke === "none"));
});
