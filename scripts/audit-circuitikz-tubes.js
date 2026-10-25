#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { captureTubeStrokes, compareTubeStrokes } from "./browser-tube-metrics.js";

const arg = name => process.argv[process.argv.indexOf(name) + 1];
assert.ok(process.argv.includes("--output") && process.argv.includes("--browser-module"),
  "Usage: node scripts/audit-circuitikz-tubes.js --output <browser audit directory> --browser-module <playwright/index.mjs>");
const root = path.resolve(arg("--output"));
const { chromium } = await import(pathToFileURL(path.resolve(arg("--browser-module"))).href);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const cases = [];
try {
  const page = await browser.newPage();
  for (const id of ["tube-catalog", "tube-settings", "tube-filaments"]) {
    const captures = [];
    for (const index of [0, 1, 2]) {
      const svg = await readFile(path.join(root, "browser", `${id}-${index}.svg`), "utf8");
      await page.setContent(`<style>body{margin:0}svg{display:block}</style>${svg}`);
      await page.evaluate(async () => {
        await document.fonts.ready;
        const svg = document.querySelector("svg"), box = svg.getBoundingClientRect();
        svg.style.width = `${box.width * 3}px`;
        svg.style.height = `${box.height * 3}px`;
      });
      captures.push(await captureTubeStrokes(page));
    }
    cases.push({ id, defaultBrowser: compareTubeStrokes(captures[0], captures[1]),
      svgTextBrowser: compareTubeStrokes(captures[2], captures[1]) });
  }
} finally {
  await browser.close();
}
await writeFile(path.join(root, "tube-stroke-metrics.json"), JSON.stringify(cases, null, 2) + "\n");
console.log(JSON.stringify(cases, null, 2));
assert.ok(cases.every(c => c.defaultBrowser.accepted && c.svgTextBrowser.accepted), "Tube stroke geometry differs from native");
