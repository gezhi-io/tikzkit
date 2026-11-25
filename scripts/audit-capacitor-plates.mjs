import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, modulePath] = process.argv.slice(2);
assert.ok(root && modulePath, "Usage: node scripts/audit-capacitor-plates.mjs <browser audit directory> <playwright/index.mjs>");
const { chromium } = await import(pathToFileURL(path.resolve(modulePath)).href);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const expected = { amplifier: 3, directions: 4, settings: 4, "coordinate-scale": 2, scope: 4 };
const rows = [];

function measure() {
  const pair = /^M\s*([-+\d.eE ,]+)L\s*([-+\d.eE ,]+)M\s*([-+\d.eE ,]+)L\s*([-+\d.eE ,]+)$/;
  const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return [...document.querySelectorAll("svg path")].flatMap(p => {
    if (p.closest("defs, clipPath") || getComputedStyle(p).stroke === "none") return [];
    const m = p.getAttribute("d")?.trim().match(pair);
    if (!m) return [];
    const ctm = p.getScreenCTM();
    const [a, b, c, d] = m.slice(1).map(v => new DOMPoint(...v.trim().split(/[\s,]+/).map(Number)).matrixTransform(ctm));
    const span = length(a, b), left = mid(a, b), right = mid(c, d), gap = length(left, right);
    if (!gap || !span || Math.abs(span - length(c, d)) > .04) return [];
    const ux = (b.x - a.x) / span, uy = (b.y - a.y) / span;
    // The split wire is also two subpaths, but the gap runs along, not across, its strokes.
    if (Math.abs(ux * (right.x - left.x) + uy * (right.y - left.y)) > .04 ||
        Math.abs(ux * (d.y - c.y) - uy * (d.x - c.x)) > .04) return [];
    const style = getComputedStyle(p);
    return [{ span, gap, center: mid(left, right), angle: Math.atan2(uy, ux),
      pen: parseFloat(style.strokeWidth) * Math.hypot(ctm.a, ctm.b), color: style.stroke }];
  });
}

try {
  const page = await browser.newPage();
  for (const [name, count] of Object.entries(expected)) {
    const id = "capacitor-" + name;
    const captures = [];
    for (const panel of [0, 1, 2]) {
      const svg = await readFile(path.join(root, "browser", id + "-" + panel + ".svg"), "utf8");
      await page.setContent("<style>body{margin:0}svg{display:block}</style>" + svg);
      const caps = await page.evaluate(measure);
      assert.equal(caps.length, count, id + " panel " + panel + ": unexpected number of plate pairs");
      captures.push(caps);
    }
    for (const panel of [0, 2]) {
      const ref = captures[1], live = captures[panel];
      const errors = live.map((p, i) => {
        const r = ref[i];
        return { gap: Math.abs(p.gap - r.gap), span: Math.abs(p.span - r.span), pen: Math.abs(p.pen - r.pen),
          tilt: Math.abs(Math.sin(p.angle - r.angle)) * r.span, strokeMatches: p.color === r.color,
          relativeCenter: Math.hypot(p.center.x - live[0].center.x - r.center.x + ref[0].center.x,
            p.center.y - live[0].center.y - r.center.y + ref[0].center.y),
          pagePosition: Math.hypot(p.center.x - r.center.x, p.center.y - r.center.y) };
      });
      // Page-origin drift is reported, not removed from the independent full-page ink check.
      const passed = errors.every(e => e.strokeMatches && Math.max(e.gap, e.span, e.pen, e.tilt, e.relativeCenter) <= .12);
      rows.push({ id, panel: panel === 0 ? "workbench" : "svg-text", passed, errors });
    }
  }
} finally {
  await browser.close();
}
await writeFile(path.join(root, "plate-metrics.json"), JSON.stringify(rows, null, 2) + "\n");
console.log(rows.filter(r => r.passed).length + "/" + rows.length + " panel comparisons within 0.12 CSS px");
if (rows.some(r => !r.passed)) process.exitCode = 1;
