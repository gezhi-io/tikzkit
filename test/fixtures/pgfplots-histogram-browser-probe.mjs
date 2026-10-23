import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compareDecodedPngs, composeImageSheet, decodePng, encodePng } from "../../scripts/diff-example-pngs.js";

// Run after audit-module-regressions.js has written portable browser SVGs.
const [after, before, browserModule] = process.argv.slice(2);
assert.ok(after && before && browserModule, "Usage: node test/fixtures/pgfplots-histogram-browser-probe.mjs <after> <before> <playwright module>");
const id = "latex-examples-histogram-large-1d-dataset";
const { chromium } = await import(pathToFileURL(path.resolve(browserModule)).href);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const panels = [];
const images = [];
try {
  const page = await browser.newPage({ viewport: { width: 1450, height: 575 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [name, file] of [
    ["native", path.join(after, "browser", `${id}-1.svg`)],
    ["before", path.join(before, "browser", `${id}-0.svg`)],
    ["after", path.join(after, "browser", `${id}-0.svg`)]
  ]) {
    await page.setContent(`<style>body{margin:0;background:white}svg{display:block;position:absolute}</style>${await readFile(file, "utf8")}`);
    const metrics = await page.evaluate(async () => {
      await document.fonts.ready;
      const svg = document.querySelector("svg");
      const original = svg.getBoundingClientRect();
      svg.style.width = `${original.width * 3}px`;
      svg.style.height = `${original.height * 3}px`;
      const bars = [...document.querySelectorAll("path")].filter(p => {
        if (p.closest("defs")) return false;
        const rgb = getComputedStyle(p).fill.match(/rgb\((\d+), (\d+), (\d+)\)/);
        return rgb && +rgb[1] < 50 && +rgb[2] > 60 && +rgb[2] < 150 && +rgb[3] > 150;
      }).map(p => p.getBoundingClientRect());
      if (!bars.length) throw new Error("Histogram bars not found");
      const left = Math.min(...bars.map(r => r.left));
      const right = Math.max(...bars.map(r => r.right));
      const bottom = Math.max(...bars.map(r => r.bottom));
      const canvas = svg.getBoundingClientRect();
      const groups = { yTicks: [], xTicks: [], xLabel: [], yLabel: [], nearCoords: [] };
      for (const el of document.querySelectorAll("text, use")) {
        if (el.closest("defs")) continue;
        const p = new DOMPoint(Number(el.getAttribute("x")), Number(el.getAttribute("y"))).matrixTransform(el.getScreenCTM());
        const point = { x: p.x - left, y: p.y - bottom };
        const fill = getComputedStyle(el).fill;
        if (fill !== "rgb(0, 0, 0)") {
          if (point.x >= 0 && point.x < right - left) groups.nearCoords.push(point);
        } else if (point.x < -90) groups.yLabel.push(point);
        else if (point.x < -20 && point.y < 20) groups.yTicks.push(point);
        else if (point.y > 70) groups.xLabel.push(point);
        else if (point.y > 30 && point.y < 60) groups.xTicks.push(point);
      }
      const nativeTicks = groups.yTicks.length === 12 &&
        [...document.querySelectorAll("text")].every(el => {
          const p = new DOMPoint(Number(el.getAttribute("x")), Number(el.getAttribute("y"))).matrixTransform(el.getScreenCTM());
          return p.x - left >= -20 || p.x - left <= -90 ||
            getComputedStyle(el).dominantBaseline === "alphabetic";
        });
      svg.style.left = `${190 - left}px`;
      svg.style.top = `${430 - bottom}px`;
      return { width: right - left, groups, nativeTicks,
        canvas: { left: canvas.left - left, right: canvas.right - left,
          top: canvas.top - bottom, bottom: canvas.bottom - bottom },
        failedFonts: [...document.fonts].filter(f => f.status === "error").map(f => f.family) };
    });
    assert.deepEqual(metrics.failedFonts, [], `${name}: failed fonts`);
    const png = await page.screenshot({ path: path.join(after, "browser", `histogram-tick-text-${name}.png`) });
    const decoded = decodePng(png);
    images.push(decoded);
    const ink = Array.from({ length: 6 }, (_, i) => {
      const center = 430 - i * 57.761;
      let weight = 0, ySum = 0, minY = Infinity, maxY = -Infinity, count = 0;
      for (let y = Math.ceil(center - 20); y <= Math.floor(center + 20); y++) {
        for (let x = 110; x <= 170; x++) {
          const j = (y * decoded.width + x) * 4;
          const rgb = decoded.data.slice(j, j + 3);
          if (Math.max(...rgb) >= 128) continue;
          const darkness = 1 - (rgb[0] + rgb[1] + rgb[2]) / (3 * 255);
          weight += darkness; ySum += darkness * y; count++;
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
      assert.ok(count > 0, `${name}: missing painted tick ${i}`);
      return { minY, maxY, centroidY: ySum / weight, count };
    });
    panels.push({ name, ...metrics, ink });
  }
  const reference = panels[0];
  const comparisons = panels.slice(1).map(panel => ({
    name: panel.name,
    canvas: Object.fromEntries(Object.keys(panel.canvas).map(key => [key, panel.canvas[key] - reference.canvas[key]])),
    widthError: panel.width - reference.width,
    groups: Object.fromEntries(Object.entries(panel.groups).map(([key, points]) => {
      const expected = reference.groups[key];
      const comparable = points.length === expected.length && (key !== "yTicks" || panel.nativeTicks);
      return [key, { count: points.length, referenceCount: expected.length,
        maxDxPx: comparable ? Math.max(...points.map((p, i) => Math.abs(p.x - expected[i].x))) : null,
        maxDyPx: comparable ? Math.max(...points.map((p, i) => Math.abs(p.y - expected[i].y))) : null }];
    })),
    ink: panel.ink.map((row, i) => ({ topErrorPx: row.minY - reference.ink[i].minY,
      bottomErrorPx: row.maxY - reference.ink[i].maxY, centroidErrorPx: row.centroidY - reference.ink[i].centroidY }))
  }));
  const diff = compareDecodedPngs(images[2], images[0]);
  await writeFile(path.join(after, "browser", "histogram-tick-text-diff.png"), encodePng(diff.diff));
  await writeFile(path.join(after, "browser", "histogram-tick-text-sheet.png"), encodePng(composeImageSheet(
    [...images, diff.diff], { columns: 2, gap: 20, padding: 20 })));
  const summary = { browser: browser.version(), scale: 3, alignment: "One translation to bar lower-left at (190,430); no fit or resizing",
    inkMethod: "Black pixels with max RGB below 128, fixed six tick regions; darkness-weighted vertical centroids",
    panelOrder: ["native", "before", "after", "difference"], errors, panels, comparisons,
    wholeCaseAccepted: false, note: "Before y-tick SVG middle anchors are not comparable to native glyph baselines; use ink measurements." };
  await writeFile(path.join(after, "histogram-tick-text-browser-metrics.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ browser: summary.browser, errors, comparisons }, null, 2));
  assert.deepEqual(errors, []);
  const current = comparisons[1];
  for (const group of ["yTicks", "xLabel", "yLabel"]) {
    const result = current.groups[group];
    assert.equal(result.count, result.referenceCount, `${group}: glyph count`);
    assert.ok(result.maxDxPx !== null && result.maxDyPx !== null &&
      Math.max(result.maxDxPx, result.maxDyPx) < 0.09, `${group}: native glyph drift`);
  }
  assert.ok(current.ink.every(row => Math.abs(row.topErrorPx) <= 1 && Math.abs(row.centroidErrorPx) < 0.6),
    "Explicit tick ink still visibly displaced");
} finally {
  await browser.close();
}
