import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compareDecodedPngs, composeImageSheet, decodePng, encodePng } from "../../scripts/diff-example-pngs.js";

// Run after fixture rendering, audit-module-regressions, and pdf2svg on the
// preserved .mactex-work PDFs. The latter has no tikztosvg package injection.
const [rootArg, browserModule] = process.argv.slice(2);
assert.ok(rootArg && browserModule, "Usage: node test/fixtures/native-math-hat-browser-probe.mjs <math-hat QA root> <playwright module>");
const root = path.resolve(rootArg);
const after = path.join(root, "after");
const { chromium } = await import(pathToFileURL(path.resolve(browserModule)).href);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const cases = [];
const pinCrops = [];
const compare = (actual, reference) => {
  if (actual.length !== reference.length || !actual.length)
    return { count: actual.length, referenceCount: reference.length, maxErrorPx: null };
  const deltas = actual.map((p, i) => ({ index: i, dx: p.x - reference[i].x, dy: p.y - reference[i].y }));
  return { count: actual.length, referenceCount: reference.length, deltas,
    maxErrorPx: Math.max(...deltas.flatMap(p => [Math.abs(p.dx), Math.abs(p.dy)])) };
};
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
  page.on("pageerror", error => errors.push(error.message));
  for (const id of ["native-math-hat", "native-math-hat-families", "function-pin-colors"]) {
    const panels = [];
    const images = [];
    const inputs = [
      ["native-source", path.join(after, "native-source-svg", `${id}.svg`)],
      ["tikztosvg", path.join(after, "browser", `${id}-1.svg`)],
      ["default", path.join(after, "browser", `${id}-0.svg`)],
      ["export", path.join(after, "browser", `${id}-2.svg`)],
      ["before-default", path.join(root, "before", "browser", `${id}-0.svg`)],
      ["before-export", path.join(root, "before", "browser", `${id}-2.svg`)]
    ];
    for (const [name, file] of inputs) {
      if (!(await access(file).then(() => true, () => false))) continue;
      await page.setContent(`<style>body{margin:0;background:white}svg{display:block;position:absolute}</style>${await readFile(file, "utf8")}`);
      const metrics = await page.evaluate(async (isPin) => {
        await document.fonts.ready;
        const svg = document.querySelector("svg");
        const initial = svg.getBoundingClientRect();
        svg.style.width = `${initial.width * 3}px`;
        svg.style.height = `${initial.height * 3}px`;
        const color = isPin ? "rgb(0, 0, 0)" : "rgb(191, 0, 64)";
        const frames = [...document.querySelectorAll("path")].filter(el =>
          !el.closest("defs") && getComputedStyle(el).stroke === color)
          .map(el => el.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height);
        if (!frames.length) throw new Error("Missing independent picture frame");
        const frame = frames[0];
        const glyphs = [...document.querySelectorAll('[data-math-layout="cm-tex-box"] text, use')]
          .filter(el => !el.closest("defs")).map(el => {
            const point = new DOMPoint(Number(el.getAttribute("x")), Number(el.getAttribute("y")))
              .matrixTransform(el.getScreenCTM());
            return { x: point.x - frame.x, y: point.y - frame.y,
              family: getComputedStyle(el).fontFamily, fill: getComputedStyle(el).fill };
          });
        const canvas = svg.getBoundingClientRect();
        svg.style.left = `${30 - frame.x}px`;
        svg.style.top = `${30 - frame.y}px`;
        return { glyphs, frame: { width: frame.width, height: frame.height },
          canvas: { x: canvas.x - frame.x, y: canvas.y - frame.y, width: canvas.width, height: canvas.height },
          failedFonts: [...document.fonts].filter(f => f.status === "error").map(f => f.family) };
      }, id === "function-pin-colors");
      assert.deepEqual(metrics.failedFonts, [], `${id}/${name}: failed font`);
      const image = `browser/${id}-source-${name}.png`;
      images.push(decodePng(await page.screenshot({ path: path.join(after, image) })));
      panels.push({ name, image, ...metrics });
      if (id === "function-pin-colors" && metrics.glyphs.length === 6) {
        // This separate crop measures glyph construction only. The full
        // frame-aligned sheet above deliberately retains the pin displacement.
        for (const index of [1, 4]) {
          await page.evaluate(({ index, glyphs }) => {
            const svg = document.querySelector("svg");
            const p = glyphs[index];
            const el = [...document.querySelectorAll('[data-math-layout="cm-tex-box"] text, use')]
              .filter(el => !el.closest("defs"))[index];
            const origin = new DOMPoint(Number(el.getAttribute("x")), Number(el.getAttribute("y")))
              .matrixTransform(el.getScreenCTM());
            if (!p) throw new Error("Missing pin nucleus");
            svg.style.left = `${parseFloat(svg.style.left) + 25 - origin.x}px`;
            svg.style.top = `${parseFloat(svg.style.top) + 55 - origin.y}px`;
          }, { index, glyphs: metrics.glyphs });
          pinCrops.push(decodePng(await page.screenshot({ clip: { x: 0, y: 0, width: 100, height: 85 } })));
        }
      }
    }
    const comparisons = panels.filter(p => !p.name.startsWith("before")).map(panel => ({ name: panel.name,
      nativeSource: compare(panel.glyphs, panels[0].glyphs), tikztosvg: compare(panel.glyphs, panels[1].glyphs) }));
    const difference = compareDecodedPngs(images[3], images[0]);
    const sheet = `browser/${id}-source-sheet.png`;
    await writeFile(path.join(after, sheet), encodePng(composeImageSheet([...images, difference.diff],
      { columns: 2, gap: 20, padding: 20 })));
    const result = { id, panels, comparisons, sheet };
    if (id === "function-pin-colors") {
      result.pinLabels = panels.slice(2, 4).map(panel => ({ name: panel.name, labels: [0, 3].map(start => {
        const points = panel.glyphs.slice(start, start + 3);
        const reference = panels[1].glyphs.slice(start, start + 3);
        const relative = glyphs => glyphs.map(g => ({ x: g.x - glyphs[1].x, y: g.y - glyphs[1].y }));
        return { positionDeltaPx: { x: points[1].x - reference[1].x, y: points[1].y - reference[1].y },
          internal: compare(relative(points), relative(reference)) };
      }) }));
    }
    cases.push(result);
  }
  await writeFile(path.join(after, "browser", "pin-glyph-construction-sheet.png"), encodePng(composeImageSheet(pinCrops,
    { columns: 2, gap: 12, padding: 12 })));
  const summary = { browser: browser.version(), scale: 3,
    alignment: "Fixed physical scale; one translation to the independent picture frame at (30,30)",
    pinCropScope: "Nucleus-aligned, construction only. Rows: native source, tikztosvg, default, export; columns: pins 1,2",
    wholeCaseAccepted: false, errors, cases };
  await writeFile(path.join(after, "native-source-browser-metrics.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ browser: summary.browser, errors,
    cases: cases.map(c => ({ id: c.id, comparisons: c.comparisons.map(p => ({ name: p.name,
      nativeSourceMaxPx: p.nativeSource.maxErrorPx, tikztosvgMaxPx: p.tikztosvg.maxErrorPx })), pinLabels: c.pinLabels })) }, null, 2));
  assert.deepEqual(errors, []);
  const hats = cases[0].comparisons.filter(p => ["default", "export"].includes(p.name));
  assert.ok(hats.every(p => p.nativeSource.count === 45 && p.nativeSource.maxErrorPx < 0.09), "Plain TeX accent origins drift");
  assert.ok(cases[2].pinLabels.every(p => p.labels.every(label => label.internal.maxErrorPx < 0.09)), "Pin glyph construction drifts");
} finally {
  await browser.close();
}
