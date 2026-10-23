import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, browserModule] = process.argv.slice(2);
assert.ok(root && browserModule, "Usage: node browser-bounds.mjs <audited output> <playwright/index.mjs>");
const { chromium } = await import(pathToFileURL(path.resolve(browserModule)).href);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const cases = [];
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
  for (const id of ["native-seams-tickless", "native-seams-tickless-empty"]) {
    const panels = [];
    for (const [index, title] of ["Default JS", "Local tikztosvg", "Exported SVG-text"].entries()) {
      const svg = await readFile(path.join(root, "browser", `${id}-${index}.svg`), "utf8");
      await page.setContent(`<style>body{margin:0}svg{display:block}</style>${svg}`);
      await page.evaluate(async () => {
        await document.fonts.ready;
        const svg = document.querySelector("svg");
        const box = svg.getBoundingClientRect();
        svg.style.width = `${box.width * 3}px`;
        svg.style.height = `${box.height * 3}px`;
      });
      const metrics = await page.evaluate(() => {
        const svg = document.querySelector("svg");
        const viewport = svg.getBoundingClientRect();
        const paths = [...svg.querySelectorAll("path")].filter(p => !p.closest("defs") &&
          (getComputedStyle(p).stroke === "rgb(0, 0, 0)" || getComputedStyle(p).fill === "rgb(0, 0, 0)"))
          .map(p => p.getBoundingClientRect()).filter(b => b.width > 0 || b.height > 0);
        return {
          width: viewport.width, height: viewport.height, paths: paths.length,
          text: svg.querySelectorAll("text, use").length,
          left: Math.min(...paths.map(b => b.left)) - viewport.left,
          right: Math.max(...paths.map(b => b.right)) - viewport.left,
          top: Math.min(...paths.map(b => b.top)) - viewport.top,
          bottom: Math.max(...paths.map(b => b.bottom)) - viewport.top
        };
      });
      assert.ok(metrics.paths >= 2, `${id}/${title}: painted axes must be present`);
      assert.equal(metrics.text, 0, `${id}/${title}: no tick or label glyphs`);
      panels.push({ title, ...metrics });
    }
    const comparisons = [panels[0], panels[2]].map(panel => {
      const maxErrorPx = Math.max(...["width", "height", "left", "right", "top", "bottom"]
        .map(key => Math.abs(panel[key] - panels[1][key])));
      return { title: panel.title, maxErrorPx, tolerancePx: 0.35, accepted: maxErrorPx < 0.35 };
    });
    cases.push({ id, panels, comparisons });
  }
} finally {
  await browser.close();
}
await writeFile(path.join(root, "browser-bounds.json"), `${JSON.stringify({ scale: 3, cases }, null, 2)}\n`);
console.log(JSON.stringify(cases.map(({ id, comparisons }) => ({ id, comparisons })), null, 2));
assert.ok(cases.every(entry => entry.comparisons.every(result => result.accepted)),
  "Tickless canvas and painted axis bounds must match without fitting or extra padding");
