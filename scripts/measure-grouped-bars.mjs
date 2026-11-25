// Register on the independent axis frame; never fit the graphs to each other.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compareDecodedPngs, composeImageSheet, cropWithWhiteMargin, decodePng, encodePng } from "./diff-example-pngs.js";

const [directory, playwrightModule, ...args] = process.argv.slice(2);
const ids = args.filter(arg => !["--solid-paint", "--bar-ink"].includes(arg));
const checkPaint = args.includes("--solid-paint");
const checkInk = args.includes("--bar-ink");
assert.ok(directory && playwrightModule, "Usage: node scripts/measure-grouped-bars.mjs <audit-dir> <playwright-module> [--solid-paint] [--bar-ink] [case ...]");
async function measure(includeInk) {
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
  if (includeInk) {
    // A hollow, fill-only or black bar is meaningful. Compare the two paint
    // channels independently: PDF may emit them in two different paths.
    const ink = {};
    function record(role, el, x, y, w, h) {
      const s = getComputedStyle(el), m = el.getScreenCTM(), unit = Math.hypot(m.a,m.b)*pt;
      let opacity = 1;
      for (let parent=el; parent; parent=parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
      for (const channel of ["fill","stroke"]) {
        if (s[channel] === "none") continue;
        const key = [inPlot(el) ? "data" : "legend", role, channel].join("/");
        const item = {box:[...rel(x,y),w*pt,h*pt], rgb:rgb(s[channel]), alpha:opacity*Number(s[channel+"Opacity"])};
        if (channel === "stroke") Object.assign(item, {pen:parseFloat(s.strokeWidth)*unit, cap:s.strokeLinecap,
          join:s.strokeLinejoin, dash:(s.strokeDasharray.match(/[\d.e+\-]+(?=px)/gi) || []).map(v => Number(v)*unit)});
        (ink[key] ??= []).push(item);
      }
    }
    for (const r of closed) if (r.el !== frame.el && r.el !== legend) record("bar",r.el,r.x,r.y,r.w,r.h);
    for (const el of paths) {
      if (!/C[^Z]+Z/i.test(el.getAttribute("d"))) continue;
      const b = el.getBoundingClientRect();
      record("mark",el,b.x,b.y,b.width,b.height);
    }
    result.ink = ink;
  }
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

function compareInk(actual, reference) {
  const out = {counts:{}, countErrors:0, bounds:0, rgb:0, alpha:0, pen:0, dash:0, styleErrors:0};
  for (const key of new Set([...Object.keys(reference), ...Object.keys(actual)])) {
    const a = actual[key] || [], b = reference[key] || [];
    out.counts[key] = b.length;
    out.countErrors += Math.abs(a.length-b.length);
    for (let i=0; i<Math.min(a.length,b.length); i++) {
      for (const [metric,attr] of [["bounds","box"],["rgb","rgb"],["dash","dash"]]) {
        const e = maxError(a[i][attr] || [], b[i][attr] || []);
        if (e === null) out.styleErrors++;
        else out[metric] = Math.max(out[metric],e);
      }
      for (const k of ["alpha","pen"]) out[k] = Math.max(out[k],Math.abs((a[i][k] || 0)-(b[i][k] || 0)));
      if (a[i].cap !== b[i].cap || a[i].join !== b[i].join) out.styleErrors++;
    }
  }
  return out;
}

// Bounds alone cannot detect a later bar covering an earlier mark. Probe
// opaque, flat color interiors on the registered reference; ignore antialiasing.
function solidPaint(actual, reference) {
  const { width, height, data } = reference;
  let solidPixels = 0, wrongPaint = 0;
  for (let y = 3; y < height - 3; y += 2) {
    for (let x = 3; x < width - 3; x += 2) {
      const i = (y*width+x)*4;
      const r = data[i], g = data[i+1], b = data[i+2];
      if (data[i+3] !== 255 || Math.max(r,g,b) - Math.min(r,g,b) < 50) continue;
      let solid = true;
      for (let dy = -3; solid && dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const j = i + (dy*width+dx)*4;
          if (data[j] !== r || data[j+1] !== g || data[j+2] !== b || data[j+3] !== 255) { solid = false; break; }
        }
      }
      if (!solid) continue;
      solidPixels++;
      if (actual.data[i+3] !== 255 || Math.max(Math.abs(actual.data[i]-r),
        Math.abs(actual.data[i+1]-g), Math.abs(actual.data[i+2]-b)) > 2) wrongPaint++;
    }
  }
  return { solidPixels, wrongPaint };
}
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
      measures.push(await page.evaluate(measure,checkInk));
    }
    const ref = measures[1];
    if (checkInk) assert.ok(ref.ink["data/bar/stroke"]?.length || ref.ink["data/bar/fill"]?.length, id + ": missing reference bars");
    else assert.ok(ref.fills.length && ref.strokes.length === ref.fills.length, id + ": empty reference bars");
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
      results.push({id, panel:panels[i].title, glyphCount:ref.glyphs.length,
        ...(checkInk ? {ink:compareInk(m.ink,ref.ink)} : {bars:ref.fills.length}),
        ...Object.fromEntries(fields.map(k => [k,maxError(m[k].flat(),ref[k].flat())]))});
      const outliers = m.ticks.flatMap(([x,y],j) => ref.ticks[j] &&
        Math.max(Math.abs(x-ref.ticks[j][0]),Math.abs(y-ref.ticks[j][1])) > .1
        ? [{index:j, actual:[x,y], reference:ref.ticks[j]}] : []);
      if (!panels[i].title.startsWith("Before") && outliers.length) console.log(id, panels[i].title, "tick outliers", JSON.stringify(outliers));
    }
    const before = panels.findIndex(p => p.title.startsWith("Before"));
    if (checkPaint) for (const [i, panel] of panels.entries()) {
      if (i === 1) continue;
      Object.assign(results.find(r => r.id === id && r.panel === panel.title), solidPaint(crops[i], crops[1]));
    }
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
  if (checkInk) {
    for (const [k,limit] of Object.entries({countErrors:0,styleErrors:0,bounds:.1,rgb:1,alpha:.002,pen:.01,dash:.015})) {
      assert.ok(r.ink[k] <= limit, `${r.id}/${r.panel}/ink/${k}: ${r.ink[k]}`);
    }
  }
  if (checkPaint) assert.ok(r.solidPixels > 0 && r.wrongPaint === 0,
    `${r.id}/${r.panel}: ${r.wrongPaint} of ${r.solidPixels} interior colors differ`);
  for (const key of ["size","fills","strokes","glyphs","titles","ticks","pens","colors","glyphColors"]) {
    assert.ok(r[key] !== null && r[key] <= (key.endsWith("olors") ? 1 : key === "pens" ? .01 : .1), `${r.id}/${r.panel}/${key}: ${r[key]}`);
  }
}
