// Compare a workbench audit's legends at their authored physical scale.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compareDecodedPngs, composeImageSheet, cropWithWhiteMargin, decodePng, encodePng } from "./diff-example-pngs.js";

const [directory, playwrightModule, ...rest] = process.argv.slice(2);
const filled = rest[0] === "--filled";
const caseIds = filled ? rest.slice(1) : rest;
assert.ok(directory && playwrightModule && caseIds.length,
  "Usage: node scripts/measure-text-legend.mjs <audit-directory> <playwright-module> [--filled] <case-id> ...");
const audit = JSON.parse(await readFile(path.join(directory, "browser-audit.json"), "utf8"));
const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)).href);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  for (const id of caseIds) {
    const panels = audit.cases.find(entry => entry.id === id)?.panels;
    assert.ok(panels?.length >= 3, `Missing workbench, reference or export: ${id}`);
    assert.equal(panels[0].title, "Live workbench JS", "Run the browser audit with --workbench");
    assert.equal(panels[1].title, "Local tikztosvg");
    const measurements = [];
    for (const panel of panels) {
      const svg = await readFile(path.join(directory, panel.svg), "utf8");
      const html = `<style>body{margin:0;background:white}svg{display:block}</style>${svg}`;
      await page.setContent(html);
      measurements.push(await page.evaluate(async filled => {
        await document.fonts.ready;
        const elements = [...document.querySelectorAll("path,rect,circle,ellipse,text,use,foreignObject")]
          .filter(p => !p.closest("defs,clipPath,symbol"));
        const pathElements = elements.filter(el => el.localName === "path");
        const frame = pathElements.findLast(p => getComputedStyle(p).fill === "rgb(255, 255, 255)" &&
          /z/i.test(p.getAttribute("d")));
        if (!frame) throw new Error("Expected a painted white legend frame");
        const following = p => frame.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING;
        const bluePlot = pathElements.find(p => !following(p) && getComputedStyle(p).stroke === "rgb(0, 0, 255)" &&
          getComputedStyle(p).fill === "none");
        // An only-marks series has no data stroke. Register on the first
        // colored data mark instead, never on the legend being measured.
        const coloredMark = elements.find(p => !following(p) && ["path","circle","ellipse"].includes(p.localName) &&
          /^rgb\(/.test(getComputedStyle(p).fill) && new Set(getComputedStyle(p).fill.match(/\d+/g)).size > 1);
        const rectangles = el => {
          const parts = [];
          // Cairo batches several bars in one path and can leave a final move.
          for (const m of el.getAttribute("d").matchAll(/M([^MZ]+)Z/gi)) {
            if (/[^\d\s.,eEL+\-]/.test(m[1])) continue;
            const n = (m[1].match(/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi) || []).map(Number);
            if (n.length !== 8) continue;
            const points = [0,2,4,6].map(i => new DOMPoint(n[i], n[i+1]).matrixTransform(el.getScreenCTM()));
            if (!points.every((p, i) => p.x === points[(i+1)%4].x || p.y === points[(i+1)%4].y)) continue;
            const xs = points.map(p => p.x), ys = points.map(p => p.y);
            parts.push({ x:Math.min(...xs), y:Math.min(...ys),
              width:Math.max(...xs)-Math.min(...xs), height:Math.max(...ys)-Math.min(...ys) });
          }
          return parts;
        };
        const axisBox = filled && pathElements.filter(p => !following(p) &&
          getComputedStyle(p).stroke === "rgb(0, 0, 0)" && getComputedStyle(p).fill === "none")
          .flatMap(p => rectangles(p)).sort((a,b) => b.width*b.height-a.width*a.height)[0];
        if (filled ? !axisBox : !bluePlot && !coloredMark) throw new Error("No independent registration landmark");
        const dataBox = coloredMark?.getBoundingClientRect();
        const start = axisBox ? { x: axisBox.x, y: axisBox.y + axisBox.height }
          : bluePlot ? bluePlot.getPointAtLength(0).matrixTransform(bluePlot.getScreenCTM())
          : { x: dataBox.x + dataBox.width / 2, y: dataBox.y + dataBox.height / 2 };
        const rect = frame.getBoundingClientRect();
        const pt = 72.27 / 96;
        const rel = ({ x, y }) => [(x - rect.left) * pt, (y - rect.top) * pt];
        const lines = [], marks = [], glyphs = [], colors = [], pens = [];
        for (const el of elements.filter(following)) {
          if (el.localName === "foreignObject") throw new Error("Expected native legend glyphs, found HTML");
          if (!["text", "use"].includes(el.localName)) {
            const box = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            const bars = filled && el.localName === "path" ? rectangles(el) : [];
            if (bars.length) {
              for (const bar of bars) {
                marks.push([...rel(bar), bar.width * pt, bar.height * pt]);
                for (const paint of [style.fill, style.stroke]) {
                  colors.push(...(paint === "none" ? [-255,-255,-255] : paint.match(/[\d.]+/g).map(Number)));
                }
                const matrix = el.getScreenCTM();
                pens.push(parseFloat(style.strokeWidth) * Math.hypot(matrix.a,matrix.b) * pt,
                  Number(style.strokeOpacity), Number(style.fillOpacity));
              }
            } else if (box.height < 0.01 && box.width > 0 && style.stroke !== "none") {
              lines.push([...rel(box), box.width * pt]);
            } else if (el.localName === "rect" && box.height * pt < 1 && box.width > box.height && style.fill !== "none") {
              // TeX fractions can paint a filled rule or its stroked centerline.
              lines.push([...rel({ x: box.x, y: box.y + box.height / 2 }), box.width * pt]);
            } else if (box.width > 0 && box.height > 0) {
              marks.push([...rel(box), box.width * pt, box.height * pt]);
            }
          } else {
            const p = new DOMPoint(Number(el.getAttribute("x")), Number(el.getAttribute("y")));
            glyphs.push(rel(p.matrixTransform(el.getScreenCTM())));
          }
        }
        const root = document.querySelector("svg").getBoundingClientRect();
        return { start: [start.x - root.x, start.y - root.y], viewport: [root.width, root.height],
          origin: [(rect.left - start.x) * pt, (rect.top - start.y) * pt],
          size: [rect.width * pt, rect.height * pt], lines, marks, glyphs, colors, pens };
      }, filled));
    }
    const ref = measurements[1];
    assert.ok((filled || ref.lines.length + ref.marks.length > 0) && ref.glyphs.length > 0, `Empty reference: ${id}`);
    // Crop the actual audit screenshots, not a second rendering translated
    // into a small viewport (Chrome may then round away a thin edge).
    const pt = 72.27 / 96, pad = 10;
    const clip = { x: 0, y: 0, width: Math.ceil((ref.size[0] + 2 * pad) / pt),
      height: Math.ceil((ref.size[1] + 2 * pad) / pt) };
    const captures = [];
    let pixelScale;
    for (const [i, panel] of panels.entries()) {
      const image = decodePng(await readFile(path.join(directory, panel.image)));
      const m = measurements[i];
      const scale = Math.round(image.width / m.viewport[0]);
      pixelScale ??= scale;
      assert.ok(scale === pixelScale && scale >= 1 && [image.width,image.height].every((n,j) =>
        Math.abs(n-scale*m.viewport[j]) <= 1.1), `Inconsistent screenshot scale: ${id}/${panel.title}`);
      const [x, y] = m.start.map((v,j) => Math.round((v + (ref.origin[j]-pad)/pt)*scale));
      captures.push(cropWithWhiteMargin(image, x, y, clip.width*scale, clip.height*scale));
    }
    const before = panels.findIndex(p => p.title.startsWith("Before"));
    const strip = [...(before < 0 ? [] : [captures[before]]), captures[0], captures[1],
      compareDecodedPngs(captures[0], captures[1]).diff];
    await writeFile(path.join(directory, "browser", `${id}-legend-sheet.png`),
      encodePng(composeImageSheet(strip, { columns: 1, gap: 6, padding: 6 })));
    const maxError = (a, b) => a.length === b.length ? Math.max(0, ...a.map((v, i) => Math.abs(v - b[i]))) : null;
    for (const [i, m] of measurements.entries()) {
      if (i === 1) continue;
      const result = { id, panel: panels[i].title, comparison: "TeX pt at authored scale",
        originError: maxError(m.origin, ref.origin), sizeError: maxError(m.size, ref.size),
        sampleError: maxError(m.lines.flat(), ref.lines.flat()), markError: maxError(m.marks.flat(), ref.marks.flat()),
        glyphError: maxError(m.glyphs.flat(), ref.glyphs.flat()), marks: m.marks.length, strokesAndRules: m.lines.length,
        glyphs: m.glyphs.length, referenceGlyphs: ref.glyphs.length,
        ...(filled && { rectangles:m.pens.length/3, referenceRectangles:ref.pens.length/3,
          penError:maxError(m.pens,ref.pens), rgbError:maxError(m.colors,ref.colors) }) };
      results.push(result);
    }
  }
} finally {
  await browser.close();
}
await writeFile(path.join(directory, "text-legend-metrics.json"), JSON.stringify(results, null, 2) + "\n");
console.table(results);
for (const result of results.filter(r => !r.panel.startsWith("Before"))) {
  for (const field of ["originError", "sizeError", "sampleError", "markError", "glyphError"]) {
    assert.ok(result[field] !== null && result[field] < 0.1, `${result.id}/${result.panel}/${field} = ${result[field]}pt`);
  }
  if (filled) {
    assert.ok(result.penError !== null && result.penError < .01, `${result.id}: pen/opacity mismatch`);
    assert.ok(result.rgbError !== null && result.rgbError <= 1, `${result.id}: swatch color mismatch`);
  }
}
