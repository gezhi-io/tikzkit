#!/usr/bin/env node
// A portable, two-panel audit for an already-open browser. No browser launch,
// export rasterizer, network service or installed font fallback is required.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tikzToSvg } from "../src/index.js";

const arg = name => process.argv[process.argv.indexOf(name) + 1];
assert.ok(process.argv.includes("--fixtures") && process.argv.includes("--output"));
const root = path.resolve(arg("--fixtures")), output = path.resolve(arg("--output"));
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const summary = JSON.parse(await readFile(path.join(output, "summary.json"), "utf8"));
const escape = text => String(text).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const panels = [];
for (const entry of manifest.cases.filter(c => summary.cases.some(r => r.id === c.id))) {
  const record = summary.cases.find(c => c.id === entry.id);
  const source = await readFile(path.resolve(root, entry.source), "utf8");
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, [], `${entry.id}: default conversion diagnostics`);
  let reference = await readFile(path.join(output, record.tikztosvgSvg), "utf8");
  for (const match of [...reference.matchAll(/url\('([^']+\.woff)'\)/g)]) {
    assert.ok(match[1].startsWith("../fonts/"));
    const bytes = await readFile(path.resolve(output, "tikztosvg-svg", match[1]));
    reference = reference.replaceAll(match[0], `url('data:font/woff;base64,${bytes.toString("base64")}')`);
  }
  const titles = ["Default JS in browser", record.referenceKind === "native-latex"
    ? "MacTeX full page (tikztosvg wrapper unsupported)" : "Local tikztosvg"];
  panels.push(`<section id="${escape(entry.id)}" data-spec="${escape(JSON.stringify(entry.nativeGlyphFrame || {}))}">
    <h2>${escape(entry.title || entry.id)}</h2><pre class="metrics">Waiting for browser fonts</pre>
    ${[result.svg, reference].map((svg, i) => `<h3>${titles[i]}</h3><iframe title="${titles[i]}"
      srcdoc="${escape(`<style>body{margin:0;background:white}svg{display:block}</style>${svg}`)}"></iframe>`).join("\n")}</section>`);
}
const html = `<!doctype html><meta charset="utf-8"><title>Native visual follow-ups</title>
<style>body{margin:0;padding:16px;font:14px system-ui;color:#182124;background:#fff}header{position:sticky;top:0;background:white;padding:8px 0;z-index:2;border-bottom:1px solid #ddd}select{font:inherit;max-width:90%}h2{font-size:18px}h3{font-size:14px}iframe{display:block;width:100%;border:0}section[hidden]{display:none}.metrics{white-space:pre-wrap;background:#f2f5f5;padding:8px;font-size:12px}button{margin:0 8px}section{padding-bottom:24px}</style>
<header><select aria-label="Case">${summary.cases.map(c => `<option value="${escape(c.id)}">${escape(c.id)}</option>`).join("")}</select>
<button id="measure">Check positions</button><button id="download">Download measurements</button></header>
${panels.join("\n")}
<script>
const selector = document.querySelector('select');
const entries = [...document.querySelectorAll('section')];
let report = [];
function select() { entries.forEach(e => e.hidden = e.id !== selector.value); location.hash = selector.value; }
if (entries.some(e => e.id === location.hash.slice(1))) selector.value = location.hash.slice(1);
selector.onchange = select;
select();
async function measure() {
  report = [];
  for (const section of entries) {
    const spec = JSON.parse(section.dataset.spec);
    const panels = [];
    section.hidden = false;
    for (const frame of section.querySelectorAll('iframe')) {
      const doc = frame.contentDocument;
      if (!doc?.querySelector('svg')) { panels.push({error:'Frame not loaded'}); continue; }
      const svg = doc.querySelector('svg');
      await doc.fonts.ready;
      if (!svg.dataset.nativeWidth) {
        svg.dataset.nativeWidth = svg.getBoundingClientRect().width;
        svg.dataset.nativeHeight = svg.getBoundingClientRect().height;
      }
      // Same physical zoom for both panels; do not fit one drawing to another.
      const zoom = 2;
      svg.style.width = svg.dataset.nativeWidth * zoom + 'px';
      svg.style.height = svg.dataset.nativeHeight * zoom + 'px';
      frame.style.height = svg.dataset.nativeHeight * zoom + 20 + 'px';
      const referenceFrame = spec.color ? [...doc.querySelectorAll('path')].find(p => !p.closest('defs') && doc.defaultView.getComputedStyle(p).stroke === spec.color) : svg;
      if (!referenceFrame) { panels.push({error:'Reference frame missing'}); continue; }
      const rect = referenceFrame.getBoundingClientRect();
      const glyphs = [...doc.querySelectorAll('[data-math-layout="cm-tex-box"] text, .tikz-text-native text, use')];
      const origins = glyphs.map(g => {
        const p = new DOMPoint(Number(g.getAttribute('x')), Number(g.getAttribute('y'))).matrixTransform(g.getScreenCTM());
        return {x:(p.x-rect.x)*3/zoom,y:(p.y-rect.y)*3/zoom};
      });
      panels.push({origins,failedFonts:[...doc.fonts].filter(f=>f.status==='error').map(f=>f.family)});
    }
    let error = null;
    if (panels.every(p => p.origins) && panels[0].origins.length === panels[1].origins.length) {
      error = Math.max(0, ...panels[0].origins.map((p,i) => Math.hypot(p.x-panels[1].origins[i].x,p.y-panels[1].origins[i].y)));
    }
    const expected = spec.count;
    const accepted = expected !== undefined && panels.every(p => p.origins?.length === expected && !p.failedFonts?.length) && error !== null && error < .09;
    section.querySelector('.metrics').textContent = JSON.stringify({id:section.id,glyphs:panels.map(p=>p.origins?.length),maxOriginErrorAt3xPx:error,tolerancePx:.09,accepted:expected === undefined ? 'visual review required' : accepted},null,2);
    report.push({id:section.id,panels,maxOriginErrorAt3xPx:error,accepted});
  }
  select();
}
document.querySelector('#measure').onclick = measure;
document.querySelector('#download').onclick = () => {
  const a = document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.download='browser-live-measurements.json';a.click();URL.revokeObjectURL(a.href);
};
window.addEventListener('load',measure);
</script>`;
await writeFile(path.join(output, "browser-live.html"), html);
console.log(path.join(output, "browser-live.html"));
