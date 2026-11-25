import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [root, modulePath] = process.argv.slice(2);
if (!root || !modulePath) throw new Error("Usage: node scripts/audit-generator-voltage.mjs <browser audit directory> <playwright module>");
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const { cases } = JSON.parse(await readFile(join(root, "browser-audit.json"), "utf8"));
const expected = { amplifier: 2, directions: 4, settings: 2, tight: 2, border: 2 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const delta = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const rows = [];

function measure() {
  const paths = [...document.querySelectorAll("path")].filter(p => !p.closest("defs,clipPath,marker"));
  const point = (el, x, y) => new DOMPoint(x, y).matrixTransform(el.getScreenCTM());
  const glyphs = [...document.querySelectorAll('[data-math-layout="cm-tex-box"] text,.tikz-text-native text,use')]
    .filter(el => !el.closest("defs")).map(el => point(el, Number(el.getAttribute("x")), Number(el.getAttribute("y"))));
  const shape = /^M\s*([-\d.Ee+, ]+)L\s*([-\d.Ee+, ]+)L\s*([-\d.Ee+, ]+)L\s*([-\d.Ee+, ]+)[Zz](?:\s*M\s*[-\d.Ee+, ]+)?$/;
  return paths.flatMap(p => {
    const m = p.getAttribute("d")?.trim().match(shape), style = getComputedStyle(p);
    if (!m || style.stroke === "none" || style.fill === "none") return [];
    const [base, a, tip, b] = m.slice(1).map(v => point(p, ...v.trim().split(/[ ,]+/).map(Number)));
    // Unlike a closed box, currarrow starts at the midpoint of its rear edge.
    if (Math.hypot(base.x - (a.x + b.x) / 2, base.y - (a.y + b.y) / 2) > .015) return [];
    const ctm = p.getScreenCTM();
    const nearest = glyphs.map(g => ({ x: g.x - tip.x, y: g.y - tip.y }))
      .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)).slice(0, 2);
    return [{ tip: { x: tip.x, y: tip.y }, direction: { x: tip.x - base.x, y: tip.y - base.y },
      width: Math.hypot(a.x - b.x, a.y - b.y), pen: parseFloat(style.strokeWidth) * Math.hypot(ctm.a, ctm.b),
      fill: style.fill, stroke: style.stroke, nearest }];
  });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  for (const [name, count] of Object.entries(expected)) {
    const id = "source-voltage-" + name, entry = cases.find(c => c.id === id);
    const captures = [];
    for (const panel of entry.panels.slice(0, 3)) {
      const svg = await readFile(join(root, panel.svg), "utf8");
      await page.setContent("<style>body{margin:0}svg{display:block}</style>" + svg);
      await page.evaluate(() => document.fonts.ready.then(() => true));
      captures.push(await page.evaluate(measure));
    }
    const ref = captures[1];
    for (const index of [0, 2]) {
      const live = captures[index];
      const complete = ref.length === count && live.length === count;
      const errors = complete ? live.map((p, i) => {
        const r = ref[i];
        const relative = dist(delta(p.tip, live[0].tip), delta(r.tip, ref[0].tip));
        // Only the amplifier has two isolated two-glyph voltage labels.
        const glyphs = name !== "amplifier" ? 0 : (p.nearest.length !== 2 || r.nearest.length !== 2 ? Infinity :
          Math.max(...p.nearest.map((g, k) => dist(g, r.nearest[k]))));
        return { geometry: Math.max(relative, dist(p.direction, r.direction), Math.abs(p.width - r.width),
          Math.abs(p.pen - r.pen)), glyphs, paint: p.stroke === r.stroke && p.fill === r.fill,
          pageOffset: delta(p.tip, r.tip) };
      }) : [];
      const passed = complete && errors.every(e => e.paint && Math.max(e.geometry, e.glyphs) <= .12);
      rows.push({ id, panel: entry.panels[index].title, measured: live.length, reference: ref.length, expected: count, errors, passed });
    }
  }
} finally {
  await browser.close();
}
await writeFile(join(root, "generator-voltage-metrics.json"), JSON.stringify(rows, null, 2) + "\n");
console.log(rows.filter(r => r.passed).length + "/" + rows.length + " generator comparisons within 0.12 CSS px");
if (rows.some(r => !r.passed)) process.exitCode = 1;
