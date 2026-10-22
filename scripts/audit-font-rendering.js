#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { tikzToSvg } from "../src/index.js";
import { fontManifest } from "../src/fonts/manifest.js";
import { runCommand } from "../src/adapters/externalLatex.js";
import { measureMathBoxPt } from "../src/renderers/svg/mathNode.js";
import { createRsvgFontEnv, renderExampleFixtures } from "./render-example-fixtures.js";
import { compareDecodedPngs, composeImageSheet, decodePng, encodePng } from "./diff-example-pngs.js";

const root = path.resolve(import.meta.dirname, "..");
const sha256 = data => createHash("sha256").update(data).digest("hex");
const drivers = [
  ["activation-functions", "test/fixtures/examples/latex-examples/activation-functions.tex"],
  ["commutative-diagram", "test/fixtures/examples/latex-examples/commutative-diagram.tex"],
  ["evaluation-tree", "test/fixtures/examples/latex-examples/evaluation-tree.tex"],
  ["b-tree", "test/fixtures/examples/latex-examples/b-tree-2-small-2.tex"],
  ["font-face-selection", "test/fixtures/font-visual-gates/font-face-selection.tex"],
  ["fractions-scripts", "test/fixtures/font-visual-gates/fractions-scripts.tex"],
  ["polynomial-box", "test/fixtures/font-visual-gates/polynomial-box.tex"],
  ["radicals", "test/fixtures/font-visual-gates/radicals.tex"],
  ["matrices", "test/fixtures/font-visual-gates/matrices.tex"],
  ["bold-math", "test/fixtures/font-visual-gates/bold-math.tex"],
  ["aligned", "test/fixtures/font-visual-gates/aligned.tex"],
  ["cases", "test/fixtures/font-visual-gates/cases.tex"],
  ["common-math-sizes", "test/fixtures/font-visual-gates/common-math-sizes.tex"],
  ["polar-small-fractions", "test/fixtures/font-visual-gates/polar-small-fractions.tex"],
  ["faktorraum", "test/fixtures/examples/latex-examples/faktorraum.tex"],
  ["jordan-array", "test/fixtures/examples/latex-examples/jordan-normal-form-block.tex"],
  ["portable-fonts", "test/fixtures/font-visual-gates/mactex-portable-fonts.tex"]
];

async function command(name, args, options = {}) {
  const result = await runCommand(name, args, { timeoutMs: 120000, ...options });
  if (result.exitCode !== 0) throw new Error(`${name}: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

export async function auditFontSelection(outputRoot) {
  const env = await createRsvgFontEnv(outputRoot);
  const results = [];
  for (const font of fontManifest) {
    const query = `${font.family}:weight=${font.weight >= 700 ? 200 : 80}:slant=${font.style === "italic" ? 100 : 0}`;
    const selected = await command("fc-match", ["-f", "%{file}", query], { env });
    const expected = font.file.replace(/\.woff$/, ".otf");
    results.push({ query, expected, selected, matches: path.basename(selected) === expected });
  }
  return results;
}

async function nativeMathProbes(directory) {
  const expressions = ["x", String.raw`\Theta_B`, String.raw`\varphi_1(x)`,
    String.raw`\frac{1}{1+e^{-x}}`, String.raw`\mathbf{ABC}`,
    "x_i^2", "x_{i_j}", "x^2+y^2=1", String.raw`\Theta_{B'}`,
    String.raw`\frac{a_1+b_2}{c_3}`, String.raw`\dfrac{a_1+b_2}{c_3}`,
    String.raw`\frac{1}{1+\frac{x_i}{2}}`, String.raw`\varphi_1(x)=\frac{1}{1+e^{-x}}`,
    String.raw`\varphi_2(x)=\tanh(x)`, String.raw`\varphi_3(x)=\max(0,x)`,
    String.raw`\varphi_4(x)=\log(e^x+1)`, String.raw`\varphi_5(x)=\max(x,e^x-1)`,
    String.raw`E_{\mathrm{pulse}}`, "e^{-x/2}\\sin(x)", "f_i", "f^2", "T_i^2"];
  const probes = [10, 7, 5].flatMap(sizePt => expressions.map(tex => ({ sizePt, tex })));
  const tex = String.raw`\documentclass{article}
\usepackage{amsmath}
\newcommand{\Probe}[3]{\begingroup\fontsize{#2}{12}\selectfont
\setbox0=\hbox{$#3$}\typeout{TIKZKITBOX:#1:\the\wd0:\the\ht0:\the\dp0}\endgroup}
\begin{document}
\setbox0=\hbox{$x$}
\typeout{TIKZKITFONT:operators:\fontname\textfont0}
\typeout{TIKZKITFONT:letters:\fontname\textfont1}
{\boldmath\setbox0=\hbox{$x$}\typeout{TIKZKITFONT:bold-letters:\fontname\textfont1}}
` + probes.map((probe, i) => `\\Probe{${i}}{${probe.sizePt}}{${probe.tex}}`).join("\n") + "\n\\end{document}\n";
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "probe.tex"), tex);
  await command("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", "probe.tex"], { cwd: directory });
  const log = await readFile(path.join(directory, "probe.log"), "utf8");
  const native = new Map([...log.matchAll(/TIKZKITBOX:(\d+):([\d.-]+)pt:([\d.-]+)pt:([\d.-]+)pt/g)]
    .map((m) => [Number(m[1]), { widthPt: Number(m[2]), heightPt: Number(m[3]), depthPt: Number(m[4]) }]));
  assert.equal(native.size, probes.length, "All native box probes must be measured");
  const measurements = probes.map((probe, i) => {
    const js = measureMathBoxPt(probe.tex, { font: { sizePt: probe.sizePt, mathExtension: "ams" } });
    const actual = Object.fromEntries(["widthPt", "heightPt", "depthPt"].map(key => [key, js[key]]));
    return { ...probe, measurementKind: js.measurementKind || "legacy", native: native.get(i), js: actual,
      deltaPt: Object.fromEntries(Object.keys(actual).map(key => [key, actual[key] - native.get(i)[key]])) };
  });
  const supported = measurements.filter(p => p.measurementKind === "cm-tex-box");
  return {
    comparison: "Native TeX hbox versus JS layout reservation; not a glyph-ink comparison",
    nativeFonts: [...log.matchAll(/TIKZKITFONT:([^:]+):([^\r\n]+)/g)].map(m => ({ role: m[1], font: m[2] })),
    probes: measurements,
    gate: { accepted: supported.length > 0 && supported.every(p => Object.values(p.deltaPt).every(d => Math.abs(d) < 0.015)),
      tolerancePt: 0.015, checked: supported.length, fallback: measurements.length - supported.length }
  };
}

const escape = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

export function fontAuditGate(selection, cases, generationGate) {
  const blockers = [...(generationGate?.blockers || [])];
  if (!generationGate?.accepted) blockers.push("Reference artifact generation did not pass");
  if (selection.length !== fontManifest.length) blockers.push("Incomplete font selection audit");
  for (const font of selection) {
    if (!font.matches) blockers.push(`Wrong font: ${font.query} selected ${font.selected}`);
  }
  if (!cases.length) blockers.push("No browser cases rendered");
  for (const entry of cases) {
    if (entry.diagnostics.length || entry.fallbackDiagnostics.length) blockers.push(`${entry.id}: renderer diagnostics`);
    if (entry.fontErrors.length) blockers.push(`${entry.id}: failed browser fonts`);
    if (entry.browserErrors.length) blockers.push(`${entry.id}: browser errors`);
    if (entry.mathPositionDiff && !entry.mathPositionDiff.accepted) blockers.push(`${entry.id}: browser math origin mismatch`);
  }
  return { accepted: blockers.length === 0, scope: "font-selection-and-artifact-generation", blockers };
}

export async function auditFontRendering(options) {
  const outputRoot = path.resolve(options.outputRoot);
  const fixtureRoot = path.join(outputRoot, ".fixtures");
  await mkdir(fixtureRoot, { recursive: true });
  const cases = [];
  for (const [id, source] of drivers) {
    await writeFile(path.join(fixtureRoot, `${id}.tex`), await readFile(path.join(root, source)));
    cases.push({ id, source: `${id}.tex`, title: id });
  }
  await writeFile(path.join(fixtureRoot, "manifest.json"), JSON.stringify({ cases }, null, 2));
  const rendered = await renderExampleFixtures({ fixtureRoot, outputRoot,
    nativeReference: true, strictTikztosvg: true, tikztosvgEngine: "pdflatex",
    renderOptions: { mathRenderer: "svg-text" }
  });
  const selection = await auditFontSelection(outputRoot);
  const math = await nativeMathProbes(path.join(outputRoot, "native-probes"));
  await mkdir(path.join(outputRoot, "browser"), { recursive: true });
  const { chromium } = await import(pathToFileURL(path.resolve(options.browserModule)).href);
  const browser = await chromium.launch({ headless: true, channel: options.browserChannel });
  const browserVersion = browser.version();
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1800, height: 1400 }, deviceScaleFactor: 1 });
    let browserErrors = [];
    page.on("pageerror", error => browserErrors.push(error.message));
    for (const entry of rendered.cases) {
      browserErrors = [];
      assert.ok(["tikztosvg", "native-latex"].includes(entry.referenceKind), "Reference provenance must be explicit");
      const source = await readFile(path.join(fixtureRoot, entry.source), "utf8");
      const result = tikzToSvg(source);
      await writeFile(path.join(outputRoot, "browser", `${entry.id}.svg`), result.svg);
      await page.setContent(`<style>body{margin:0;background:white}svg{display:block}</style>${result.svg}`);
      await page.evaluate(async () => { await document.fonts.ready; });
      const fontErrors = await page.evaluate(() => [...document.fonts].filter(f => f.status === "error").map(f => f.family));
      assert.deepEqual(fontErrors, [], `${entry.id}: failed browser fonts`);
      const svg = page.locator("svg").first();
      const bounds = await svg.boundingBox();
      assert(bounds?.width > 0 && bounds?.height > 0, "Browser SVG must be visible");
      const browserPng = `browser/${entry.id}.png`;
      await svg.screenshot({ path: path.join(outputRoot, browserPng), animations: "disabled" });
      let mathPositionDiff;
      if (["fractions-scripts", "polynomial-box", "radicals", "matrices", "bold-math", "aligned", "cases", "common-math-sizes"].includes(entry.id)) {
        const origins = selector => page.evaluate(selector => {
          const root = document.querySelector("svg").getBoundingClientRect();
          return [...document.querySelectorAll(selector)].map(element => {
            const point = new DOMPoint(Number(element.getAttribute("x")), Number(element.getAttribute("y")))
              .matrixTransform(element.getScreenCTM());
            return { x: point.x - root.x, y: point.y - root.y };
          });
        }, selector);
        const jsOrigins = await origins('[data-math-layout="cm-tex-box"] text');
        await page.setContent(`<style>body{margin:0}svg{display:block}</style>${await readFile(path.join(outputRoot, entry.tikztosvgSvg), "utf8")}`);
        const referenceOrigins = await origins("use");
        const deltas = jsOrigins.map((point, i) => ({ x: point.x - referenceOrigins[i]?.x, y: point.y - referenceOrigins[i]?.y }));
        const maxErrorPx = Math.max(...deltas.flatMap(p => [Math.abs(p.x), Math.abs(p.y)]));
        mathPositionDiff = { jsOrigins, referenceOrigins, maxErrorPx, tolerancePx: 0.03,
          alignment: "none; actual browser CSS pixels from each SVG viewport origin",
          accepted: jsOrigins.length > 0 && jsOrigins.length === referenceOrigins.length && maxErrorPx < 0.03 };
      }
      const paths = [entry.mactexPng, entry.tikztosvgPng, browserPng, entry.tikzkitPng];
      const images = [];
      for (const file of paths) images.push(decodePng(await readFile(path.join(outputRoot, file))));
      const diffs = [compareDecodedPngs(images[2], images[0]), compareDecodedPngs(images[3], images[0])];
      const sheet = `browser/${entry.id}-sheet.png`;
      await writeFile(path.join(outputRoot, sheet), encodePng(composeImageSheet(
        [...images, ...diffs.map(d => d.diff)], { columns: 2, gap: 24, padding: 16 })));
      results.push({ id: entry.id, source: drivers.find(([id]) => id === entry.id)[1],
        referenceKind: entry.referenceKind,
        browserSvg: `browser/${entry.id}.svg`, browserPng, referenceSvg: entry.tikztosvgSvg,
        nativePng: entry.mactexPng, fallbackPng: entry.tikzkitPng, sheet,
        diagnostics: result.diagnostics, fallbackDiagnostics: entry.diagnostics, fontErrors, browserErrors, mathPositionDiff,
        provenance: { renderFingerprint: entry.renderFingerprint, fingerprints: entry.fingerprints,
          browserSvgSha256: sha256(result.svg), browserPngSha256: sha256(await readFile(path.join(outputRoot, browserPng))) },
        browserVsNative: { status: diffs[0].status, meanAbsoluteRGBA: diffs[0].meanAbsoluteRGBA },
        fallbackVsNative: { status: diffs[1].status, meanAbsoluteRGBA: diffs[1].meanAbsoluteRGBA } });
    }
  } finally {
    await browser.close();
  }
  const summary = { schemaVersion: 1, fontSelection: selection, math, cases: results,
    browserVersion, browserChannel: options.browserChannel || "chromium", browserRenderOptions: {},
    auditScriptSha256: sha256(await readFile(new URL(import.meta.url))),
    gate: fontAuditGate(selection, results, rendered.gate),
    selectionPassed: selection.every(f => f.matches), visualReviewRequired: true,
    visualAccepted: false, rasterDpi: 96 };
  await writeFile(path.join(outputRoot, "font-audit.json"), JSON.stringify(summary, null, 2));
  const livePanel = (title, file) => `<div><h3>${title}</h3><div class="viewport"><object type="image/svg+xml" data="${escape(file)}" aria-label="${escape(title)}"></object></div></div>`;
  await writeFile(path.join(outputRoot, "font-audit.html"), `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Font Rendering Audit</title>
<style>body{margin:24px;font:14px system-ui;color:#222;background:#fff}h1{font-size:24px}h2{font-size:18px}h3{font-size:14px}
section{border-top:1px solid #ccc;padding:16px 0}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.viewport{overflow:auto;border:1px solid #ddd}.viewport img,.viewport object{display:block;max-width:none}summary{cursor:pointer}
@media(max-width:800px){.pair{grid-template-columns:minmax(0,1fr)}}a{color:#0670bd}</style>
<h1>Font Rendering Audit</h1><p>Font selection: ${selection.filter(f=>f.matches).length}/${selection.length}.
<a href="font-audit.json">Measurements</a> | Visual parity: not accepted.</p>` + results.map(c => `<section id="${c.id}"><h2>${c.id}</h2>
<div class="pair">${livePanel("Browser JS (live SVG)", c.browserSvg)}${livePanel(c.referenceKind === "tikztosvg" ? "Local tikztosvg (live SVG)" : "MacTeX document (non-TikZ math)", c.referenceSvg)}</div>
<p><a href="${c.browserSvg}">Browser SVG</a> | <a href="${c.referenceSvg}">Reference SVG</a></p>
<details><summary>Native PDF / SVG-text / differences</summary>
<p>Row 1: native PDF | tikztosvg. Row 2: browser | SVG-text. Row 3: respective differences from native.</p>
<div class="viewport"><img src="${c.sheet}" alt="Native, tikztosvg, browser, fallback, and their native differences"></div></details></section>`).join("") + "</html>");
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const arg = name => process.argv[process.argv.indexOf(name) + 1];
  if (!process.argv.includes("--output") || !process.argv.includes("--browser-module")) {
    throw new Error("Usage: node scripts/audit-font-rendering.js --output <new QA directory> --browser-module <local playwright/index.mjs> [--browser-channel chrome]");
  }
  const summary = await auditFontRendering({ outputRoot: arg("--output"), browserModule: arg("--browser-module"),
    browserChannel: process.argv.includes("--browser-channel") ? arg("--browser-channel") : undefined });
  console.log(JSON.stringify({ cases: summary.cases.length,
    fontSelection: `${summary.fontSelection.filter(f=>f.matches).length}/${summary.fontSelection.length}`,
    nativeMathProbes: summary.math.probes.length, mathGate: summary.math.gate, gate: summary.gate, visualAccepted: summary.visualAccepted }, null, 2));
  if (!summary.gate.accepted || !summary.math.gate.accepted) process.exitCode = 1;
}
