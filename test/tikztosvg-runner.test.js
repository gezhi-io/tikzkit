import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseTikzCasesMarkdown } from "../web/cases-md.js";
import { runTikzToSvg } from "../web/tikztosvg-runner.js";

test("local tikztosvg runner generates an svg without relying on the system wrapper cleanup", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "tikzkit-tikztosvg-test-"));
  try {
    const input = path.join(tempDir, "input.tikz");
    const output = path.join(tempDir, "output.svg");
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(
        input,
        String.raw`
\usetikzlibrary{arrows,trees}
\tikz \draw[->, thick] (0,0) -- (1,0);
`
      )
    );

    const result = runTikzToSvg(input, output, { texEngine: "xelatex" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(output), true);
    const svg = await readFile(output, "utf8");
    assert.match(svg, /<svg\b/);
    assert.match(svg, /<path\b/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("local tikztosvg runner skips blank first page from stacked TikZ output", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "tikzkit-tikztosvg-test-"));
  try {
    const casesMarkdown = await readFile(path.join(process.cwd(), "web", "cases.md"), "utf8");
    const source = parseTikzCasesMarkdown(casesMarkdown).find((item) => item.id === "library-packages-001")?.source;
    assert.ok(source, "expected library-packages-001 source");

    const input = path.join(tempDir, "input.tikz");
    const output = path.join(tempDir, "output.svg");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(input, source));

    const result = runTikzToSvg(input, output, { texEngine: "xelatex" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(output), true);
    const svg = await readFile(output, "utf8");
    assert.match(svg, /<svg\b/);
    assert.match(svg, /<path\b/);
    assert.ok(svg.length > 1000, `expected nonblank SVG content, got ${svg.length} bytes`);
    const widthMatch = svg.match(/\bwidth="([\d.]+)pt"/);
    assert.ok(widthMatch, "expected physical pt width in reference SVG");
    const widthPt = Number(widthMatch[1]);
    assert.ok(widthPt > 145, `expected TCS logo reference bbox wide enough for unclipped small-caps text, got ${widthPt}pt`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("local tikztosvg runner generates a reference SVG for datavisualization barcharts", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "tikzkit-tikztosvg-test-"));
  try {
    const casesMarkdown = await readFile(path.join(process.cwd(), "web", "cases.md"), "utf8");
    const source = parseTikzCasesMarkdown(casesMarkdown).find((item) => item.id === "datavisualization-065")?.source;
    assert.ok(source, "expected datavisualization-065 source");

    const input = path.join(tempDir, "input.tikz");
    const output = path.join(tempDir, "output.svg");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(input, source));

    const result = runTikzToSvg(input, output, { texEngine: "xelatex" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(output), true);
    const svg = await readFile(output, "utf8");
    assert.match(svg, /<svg\b/);
    assert.match(svg, /<path\b/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("local tikztosvg runner generates a reference SVG for datavisualization sparklines", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "tikzkit-tikztosvg-test-"));
  try {
    const casesMarkdown = await readFile(path.join(process.cwd(), "web", "cases.md"), "utf8");
    const source = parseTikzCasesMarkdown(casesMarkdown).find((item) => item.id === "datavisualization-066")?.source;
    assert.ok(source, "expected datavisualization-066 source");

    const input = path.join(tempDir, "input.tikz");
    const output = path.join(tempDir, "output.svg");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(input, source));

    const result = runTikzToSvg(input, output, { texEngine: "xelatex" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(output), true);
    const svg = await readFile(output, "utf8");
    assert.match(svg, /<svg\b/);
    assert.match(svg, /<path\b/);
    const widthMatch = svg.match(/\bwidth="([\d.]+)pt"/);
    assert.ok(widthMatch, "expected compact physical pt width in reference SVG");
    assert.ok(Number(widthMatch[1]) < 35, `expected compact sparkline reference, got ${widthMatch[1]}pt`);
    const numbers = [...svg.matchAll(/[-+]?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    const largePathCoordinates = numbers.filter((number) => number > 20 && number < 40);
    assert.equal(
      largePathCoordinates.length,
      0,
      `expected zero coordinates to stay explicit, got suspicious cm-sized coordinates: ${largePathCoordinates.join(", ")}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
