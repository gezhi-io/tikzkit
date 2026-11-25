import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [root, modulePath] = process.argv.slice(2);
assert.ok(root && modulePath, "Usage: node scripts/audit-resistor-geometry.mjs <browser audit directory> <playwright module>");
const { cases, errors } = JSON.parse(await readFile(join(root, "browser-audit.json"), "utf8"));
assert.deepEqual(errors, []);
const expected = { directions:[4,0], settings:[4,0], scale:[2,0], rectangle:[1,0],
  labels:[4,12], spacing:[2,8], selection:[1,0], amplifier:[3,21] };
assert.deepEqual(cases.map(c => c.id).sort(), Object.keys(expected).map(k => "resistor-"+k).sort());
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
function measure() {
  const svg = document.querySelector("svg"), box = svg.getBoundingClientRect();
  function point(el, p) {
    const q = p.matrixTransform(el.getScreenCTM());
    return { x:q.x-box.x, y:q.y-box.y };
  }
  const strokes = [...svg.querySelectorAll("path")].filter(p => !p.closest("defs,clipPath,marker") &&
    getComputedStyle(p).strokeLinejoin === "bevel" &&
    /^M[\d.,\sLeE+-]+$/i.test(p.getAttribute("d").trim()) && (p.getAttribute("d").match(/L/gi) || []).length >= 5
  ).map(p => {
    const cs=getComputedStyle(p), cm=p.getScreenCTM(), length=p.getTotalLength();
    // Sample the actual browser path, including both ends and the straight stubs.
    return { points:Array.from({length:65}, (_,i) => point(p, p.getPointAtLength(length*i/64))),
      pen:parseFloat(cs.strokeWidth)*Math.hypot(cm.a,cm.b), stroke:cs.stroke, fill:cs.fill };
  });
  const glyphs = [...svg.querySelectorAll('[data-math-layout="cm-tex-box"] text, .tikz-text-native text, use')]
    .filter(el=>!el.closest("defs")).map(el=>point(el,new DOMPoint(Number(el.getAttribute("x")),Number(el.getAttribute("y")))));
  return { strokes, glyphs };
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
try {
  const page=await browser.newPage();
  for(const entry of cases) {
    const captures=[];
    for(const title of ["Live workbench JS","Local tikztosvg","After SVG-text"]) {
      const p=entry.panels.find(panel=>panel.title===title);
      await page.setContent('<style>body{margin:0}svg{display:block}</style>'+await readFile(join(root,p.svg),"utf8"));
      await page.evaluate(async()=>{ await document.fonts.ready; });
      captures.push(await page.evaluate(measure));
    }
    const ref=captures[1], [bodies,glyphs]=expected[entry.id.slice("resistor-".length)];
    for(const index of [0,2]) {
      const r=captures[index];
      const counts=[r,ref].every(c=>c.strokes.length===bodies && c.glyphs.length===glyphs);
      const shapeError=counts ? Math.max(0,...r.strokes.flatMap((p,i)=>p.points.map((v,j)=>dist(v,ref.strokes[i].points[j])))) : null;
      const penError=counts ? Math.max(0,...r.strokes.map((p,i)=>Math.abs(p.pen-ref.strokes[i].pen))) : null;
      const glyphError=counts ? Math.max(0,...r.glyphs.map((g,i)=>dist(g,ref.glyphs[i]))) : null;
      const paint=counts && r.strokes.every((p,i)=>p.stroke===ref.strokes[i].stroke && p.fill===ref.strokes[i].fill);
      rows.push({id:entry.id,panel:entry.panels[index].title,bodies:r.strokes.length,glyphs:r.glyphs.length,
        expected:[bodies,glyphs],shapeError,penError,glyphError,paint,passed:paint && Math.max(shapeError,penError,glyphError)<.15});
    }
  }
} finally { await browser.close(); }
await writeFile(join(root,"resistor-geometry.json"),JSON.stringify(rows,null,2)+"\n");
const passed=rows.filter(r=>r.passed).length;
console.log("Absolute browser geometry, pen, paint and glyph origins: "+passed+"/"+rows.length+" within 0.15 CSS px");
if(passed!==rows.length) process.exitCode=1;
