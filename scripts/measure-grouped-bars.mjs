// Register on the independent axis frame; never fit the graphs to each other.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compareDecodedPngs, composeImageSheet, cropWithWhiteMargin, decodePng, encodePng } from "./diff-example-pngs.js";

const [directory, playwrightModule, ...ids] = process.argv.slice(2);
assert.ok(directory && playwrightModule, "Usage: node scripts/measure-grouped-bars.mjs <audit-dir> <playwright-module> [case ...]");
async function measure() {
  await document.fonts.ready;
  const elements = [...document.querySelectorAll("path,text,use")].filter(el => !el.closest("defs,symbol,clipPath"));
  const paths = elements.filter(el => el.localName === "path");
  const closed = [];
  // Cairo can batch a full series into one compound path, independently for
  // the fill and the outline. Record both, even when TikZKit paints together.
  for (const el of paths) {
    for (const [,subpath] of el.getAttribute("d").matchAll(/M([^MZ]+)Z/gi)) {
      if (/[^\d\s.,eEL+\-]/.test(subpath)) continue;
      const coords = (subpath.match(/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi) || []).map(Number);
      if (coords.length !== 8) continue;
      const points = [0,2,4,6].map(i => new DOMPoint(coords[i], coords[i+1]).matrixTransform(el.getScreenCTM()));
      if (!points.every((p,i) => p.x === points[(i+1)%4].x || p.y === points[(i+1)%4].y)) continue;
      const xs = points.map(p => p.x), ys = points.map(p => p.y);
      closed.push({el, x:Math.min(...xs), y:Math.min(...ys), w:Math.max(...xs)-Math.min(...xs), h:Math.max(...ys)-Math.min(...ys)});
    }
  }
  const frame = closed.filter(r => getComputedStyle(r.el).stroke === "rgb(0, 0, 0)" && getComputedStyle(r.el).fill === "none")
    .sort((a,b) => b.w*b.h-a.w*a.h)[0];
  if (!frame) throw new Error("Missing independent axis frame");
  const legend = closed.find(r => getComputedStyle(r.el).fill === "rgb(255, 255, 255)" && getComputedStyle(r.el).stroke === "rgb(0, 0, 0)")?.el;
  const inPlot = el => !legend || (el.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING);
  const rgb = raw => (raw.match(/[\d.]+/g) || []).map(Number);
  const colored = raw => raw.startsWith("rgb") && new Set(rgb(raw)).size > 1;
  const pt = 72.27 / 96;
  const rel = (x,y) => [(x-frame.x)*pt, (y-frame.y-frame.h)*pt];
  const result = { fills:[], strokes:[], glyphs:[], titles:[], ticks:[], pens:[], colors:[], glyphColors:[] };
  for (const paint of ["fill","stroke"]) {
    for (const r of closed.filter(r => inPlot(r.el) && colored(getComputedStyle(r.el)[paint]))) {
      const style = getComputedStyle(r.el);
      result[paint+"s"].push([...rel(r.x,r.y), r.w*pt, r.h*pt]);
      result.colors.push(...rgb(style[paint]));
      const m = r.el.getScreenCTM();
      if (paint === "stroke") result.pens.push(parseFloat(style.strokeWidth)*Math.hypot(m.a,m.b)*pt);
    }
  }
  const letters = elements.filter(el => el.localName !== "path" && inPlot(el));
  const lastLabel = letters.findLast(el => colored(getComputedStyle(el).fill));
  for (const el of letters) {
    const p = new DOMPoint(Number(el.getAttribute("x")), Number(el.getAttribute("y"))).matrixTransform(el.getScreenCTM());
    if (colored(getComputedStyle(el).fill)) {
      result.glyphs.push(rel(p.x,p.y));
      result.glyphColors.push(...rgb(getComputedStyle(el).fill));
    } else {
      const title = lastLabel && (lastLabel.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      result[title ? "titles" : "ticks"].push(rel(p.x,p.y));
    }
  }
  const root = document.querySelector("svg").getBoundingClientRect();
  return { ...result, origin:[frame.x-root.x, frame.y+frame.h-root.y], size:[frame.w*pt, frame.h*pt], viewport:[root.width,root.height] };
}

const maxError = (a,b) => a.length === b.length ? Math.max(0, ...a.map((v,i) => Math.abs(v-b[i]))) : null;
const audit = JSON.parse(await readFile(path.join(directory, "browser-audit.json"), "utf8"));
const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)).href);
const browser = await chromium.launch({ channel:"chrome", headless:true });
const results = [];
try {
  const page = await browser.newPage();
  for (const {id,panels} of audit.cases.filter(c => !ids.length || ids.includes(c.id))) {
    assert.deepEqual(panels.slice(0,2).map(p => p.title), ["Live workbench JS", "Local tikztosvg"]);
    const measures = [];
    for (const panel of panels) {
      await page.setContent('<style>body{margin:0}svg{display:block}</style>' + await readFile(path.join(directory,panel.svg), "utf8"));
      measures.push(await page.evaluate(measure));
    }
    const ref = measures[1];
    assert.ok(ref.fills.length && ref.strokes.length === ref.fills.length, id + ": empty reference bars");
    const crops = [];
    let scale;
    for (const [i,m] of measures.entries()) {
      const image = decodePng(await readFile(path.join(directory,panels[i].image)));
      scale ??= Math.round(image.width/m.viewport[0]);
      assert.ok(scale > 0 && [image.width,image.height].every((v,j) => Math.abs(v-scale*m.viewport[j]) < 1.1), "Inconsistent image scale");
      const x = Math.round((m.origin[0]-ref.origin[0])*scale), y = Math.round((m.origin[1]-ref.origin[1])*scale);
      crops.push(cropWithWhiteMargin(image,x,y,Math.ceil(ref.viewport[0]*scale),Math.ceil(ref.viewport[1]*scale)));
      if (i === 1) continue;
      const fields = ["size","fills","strokes","glyphs","titles","ticks","pens","colors","glyphColors"];
      results.push({id, panel:panels[i].title, bars:ref.fills.length, glyphCount:ref.glyphs.length,
        ...Object.fromEntries(fields.map(k => [k,maxError(m[k].flat(),ref[k].flat())]))});
      const outliers = m.ticks.flatMap(([x,y],j) => ref.ticks[j] &&
        Math.max(Math.abs(x-ref.ticks[j][0]),Math.abs(y-ref.ticks[j][1])) > .1
        ? [{index:j, actual:[x,y], reference:ref.ticks[j]}] : []);
      if (!panels[i].title.startsWith("Before") && outliers.length) console.log(id, panels[i].title, "tick outliers", JSON.stringify(outliers));
    }
    const before = panels.findIndex(p => p.title.startsWith("Before"));
    const comparison = [...(before < 0 ? [] : [crops[before]]), crops[0], crops[1], compareDecodedPngs(crops[0],crops[1]).diff];
    await writeFile(path.join(directory,"browser",id+"-bar-sheet.png"),encodePng(composeImageSheet(comparison,{columns:2,gap:6,padding:6})));
  }
} finally {
  await browser.close();
}
assert.ok(results.length && ids.every(id => results.some(r => r.id === id)), "Missing requested bar comparison");
await writeFile(path.join(directory,"bar-metrics.json"),JSON.stringify(results,null,2)+"\n");
console.table(results);
for (const r of results.filter(r => !r.panel.startsWith("Before"))) {
  for (const key of ["size","fills","strokes","glyphs","titles","ticks","pens","colors","glyphColors"]) {
    assert.ok(r[key] !== null && r[key] <= (key.endsWith("olors") ? 1 : key === "pens" ? .01 : .1), `${r.id}/${r.panel}/${key}: ${r[key]}`);
  }
}
