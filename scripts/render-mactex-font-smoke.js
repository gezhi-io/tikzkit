import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tikzToSvg } from "../src/index.js";
import { renderExampleFixtures } from "./render-example-fixtures.js";
import { compareDecodedPngs, composeImageSheet, decodePng, encodePng } from "./diff-example-pngs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(root, "outputs/mactex-font-audit-2026-09-06");
const fixtureRoot = path.join(outputRoot, ".fixtures");
await mkdir(fixtureRoot, { recursive: true });
const inputs = {
  "activation-functions": "test/fixtures/examples/latex-examples/activation-functions.tex",
  "b-tree": "test/fixtures/examples/latex-examples/b-tree-2-small-2.tex",
  "plot-box-ratio": "test/fixtures/examples/pgfplots/plot-box-ratio-3d.tex",
  "portable-fonts": "test/fixtures/font-visual-gates/mactex-portable-fonts.tex"
};
const cases = [];
for (const [id, file] of Object.entries(inputs)) {
  await writeFile(path.join(fixtureRoot, `${id}.tex`), await readFile(path.join(root, file)));
  cases.push({ id, title: id, source: `${id}.tex` });
}
await writeFile(path.join(fixtureRoot, "manifest.json"), JSON.stringify({ cases }, null, 2));
const summary = await renderExampleFixtures({
  fixtureRoot, outputRoot, strictTikztosvg: true, nativeReference: true,
  tikztosvgEngine: "pdflatex", comparisonGrid: false,
  renderOptions: { mathRenderer: "svg-text" }
});
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
let html = '<!doctype html><meta charset="utf-8"><title>MacTeX font comparison</title><style>body{font:14px sans-serif;margin:20px;color:#222}section{margin:20px 0 40px} .pair{display:grid;grid-template-columns:1fr 1fr;gap:16px} iframe{width:100%;height:430px;border:1px solid #ccc}h2{font-size:18px}img{max-width:100%}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><h1>MacTeX Fonts</h1>';
const diagnostics = {};
for (const entry of summary.cases) {
  const source = await readFile(path.join(fixtureRoot, entry.source), "utf8");
  const result = tikzToSvg(source);
  diagnostics[entry.id] = result.diagnostics;
  await writeFile(path.join(outputRoot, `${entry.id}-browser.svg`), result.svg);
  const native = await readFile(path.join(outputRoot, entry.tikztosvgSvg), "utf8");
  const page = (svg) => `<style>body{margin:12px}svg{max-width:100%;height:auto;max-height:400px}</style>${svg}`;
  html += `<section id="${entry.id}"><h2>${entry.id}</h2><div class="pair"><div><p>tikztosvg / MacTeX</p><iframe title="${entry.id} native" srcdoc="${escape(page(native))}"></iframe></div><div><p>TikZKit / embedded MacTeX fonts</p><iframe title="${entry.id} JS" srcdoc="${escape(page(result.svg))}"></iframe></div></div></section>`;
  const pngs = [];
  for (const file of [entry.mactexPng, entry.tikztosvgPng, entry.tikzkitPng]) {
    pngs.push(decodePng(await readFile(path.join(outputRoot, file))));
  }
  const diff = compareDecodedPngs(pngs[2], pngs[0]);
  // Reading order: native, tikztosvg, SVG-text fallback, native/fallback diff.
  await writeFile(path.join(outputRoot, `${entry.id}-native-sheet.png`), encodePng(
    composeImageSheet([...pngs, diff.diff], { columns: 2, gap: 20, padding: 16 })
  ));
}
await writeFile(path.join(outputRoot, "browser.html"), html);
await writeFile(path.join(outputRoot, "browser-diagnostics.json"), JSON.stringify(diagnostics, null, 2));
console.log(`Browser comparison: ${path.join(outputRoot, "browser.html")}`);
