#!/usr/bin/env node
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { tikzToSvg } from "../src/index.js";
import { compareDecodedPngs, composeImageSheet, decodePng, encodePng } from "./diff-example-pngs.js";
import { captureClippedCurves, compareCurvePaint, curvePaintPoints } from "./browser-plot-clip-metrics.js";
import { axisAlignedViewport, captureAxisGrid, compareAxisGrid } from "./browser-axis-grid-metrics.js";
import { captureCrossOuts, compareCrossOuts } from "./browser-cross-out-metrics.js";
import { captureDatavisPin, compareDatavisPin } from "./browser-datavis-pin-metrics.js";
import { captureArrowPaint, compareArrowPaint } from "./browser-arrow-metrics.js";

const arg = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
assert.ok(arg("--output") && arg("--browser-module"),
  "Usage: node scripts/audit-module-regressions.js --output <rendered directory> --browser-module <local playwright/index.mjs> [--fixtures <directory>] [--only <id>] [--before <baseline directory>] [--legend-metrics] [--plot-clip-metrics] [--axis-text-metrics] [--tick-grid-metrics] [--cross-out-metrics]");
const outputRoot = path.resolve(arg("--output"));
const beforeRoot = arg("--before") ? path.resolve(arg("--before")) : null;
const fixtureRoot = path.resolve(arg("--fixtures") || "test/fixtures/module-regressions");
const manifest = JSON.parse(await readFile(path.join(fixtureRoot, "manifest.json"), "utf8"));
const selectedIds = process.argv.flatMap((value, i) => value === "--only" ? [process.argv[i + 1]] : []);
const cases = manifest.cases.filter(entry => !selectedIds.length || selectedIds.includes(entry.id));
assert.ok(cases.length, "No matching browser audit cases");
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

// Reference exports use relative font URLs. Embed exactly those local files
// for portable file:// comparisons, without changing the font or its metrics.
async function portableSvg(file) {
  let svg = await readFile(file, "utf8");
  for (const match of [...svg.matchAll(/url\('([^']+\.woff)'\)/g)]) {
    assert.ok(match[1].startsWith("../fonts/"), "Only local fixture fonts may be embedded");
    const data = await readFile(path.resolve(path.dirname(file), match[1]));
    svg = svg.replaceAll(match[0], `url('data:font/woff;base64,${data.toString("base64")}')`);
  }
  return svg;
}

const { chromium } = await import(pathToFileURL(path.resolve(arg("--browser-module"))).href);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const summaries = [];
await mkdir(path.join(outputRoot, "browser"), { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1600 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const entry of cases) {
    const { id } = entry;
    const source = await readFile(path.join(fixtureRoot, entry.source), "utf8");
    const result = tikzToSvg(source);
    assert.deepEqual(result.diagnostics, [], `${id}: browser render diagnostics`);
    const inputs = [
      ["Default JS", result.svg],
      ["Local tikztosvg", await portableSvg(path.join(outputRoot, "tikztosvg-svg", `${id}.svg`))],
      ["After SVG-text", await portableSvg(path.join(outputRoot, "tikzkit-svg", `${id}.svg`))]
    ];
    if (beforeRoot) {
      // A later selective fixture render may replace managed SVG exports.
      // The browser's portable SVG is also an immutable pre-repair artifact.
      for (const file of [path.join(beforeRoot, "tikzkit-svg", `${id}.svg`), path.join(beforeRoot, "browser", `${id}-2.svg`)]) {
        if (await access(file).then(() => true, () => false)) {
          inputs.push(["Before SVG-text", await portableSvg(file)]);
          break;
        }
      }
    }
    const panels = [];
    const images = [];
    const legendMode = process.argv.includes("--legend-metrics");
    const clipMode = process.argv.includes("--plot-clip-metrics");
    const textMode = process.argv.includes("--axis-text-metrics");
    const gridMode = process.argv.includes("--tick-grid-metrics");
    const crossMode = process.argv.includes("--cross-out-metrics");
    assert.ok(!textMode || clipMode, "Axis text comparison requires the shared plot clip origin");
    const curvePaint = [];
    for (const [title, svg] of inputs) {
      const stem = `browser/${id}-${panels.length}`;
      await writeFile(path.join(outputRoot, `${stem}.svg`), svg);
      await page.setContent(`<style>body{margin:0;background:white}svg{display:block}</style>${svg}`);
      await page.evaluate(async () => {
        await document.fonts.ready;
        const svg = document.querySelector("svg");
        const box = svg.getBoundingClientRect();
        svg.style.width = `${box.width * 3}px`;
        svg.style.height = `${box.height * 3}px`;
      });
      const failedFonts = await page.evaluate(() => [...document.fonts].filter(f => f.status === "error").map(f => f.family));
      assert.deepEqual(failedFonts, [], `${id}/${title}: failed browser fonts`);
      const origins = await page.evaluate(frameColor => {
        const frame = frameColor ? [...document.querySelectorAll("path")]
          .find(p => !p.closest("defs") && getComputedStyle(p).stroke === frameColor) : document.querySelector("svg");
        if (!frame) throw new Error("Expected math audit frame");
        const box = frame.getBoundingClientRect();
        return [...document.querySelectorAll('[data-math-layout="cm-tex-box"] text, .tikz-text-native text, use')].map(el => {
          const p = new DOMPoint(Number(el.getAttribute("x")), Number(el.getAttribute("y"))).matrixTransform(el.getScreenCTM());
          return { x: p.x - box.x, y: p.y - box.y };
        });
      }, entry.nativeGlyphFrame?.color);
      const ticks = textMode ? await page.evaluate(() => {
        const svg = document.querySelector("svg").getBoundingClientRect();
        return [...document.querySelectorAll("svg path")].flatMap(p => {
          if (p.closest("defs") || getComputedStyle(p).stroke !== "rgb(128, 128, 128)") return [];
          // The audited reference groups straight tick subpaths; JS emits one
          // path per tick. Validate this small grammar before splitting it.
          const d = p.getAttribute("d") || "";
          const segments = [...d.matchAll(/M\s*([-\d.e+]+)[ ,]+([-\d.e+]+)\s*L\s*([-\d.e+]+)[ ,]+([-\d.e+]+)/gi)];
          if (d.replace(/M\s*([-\d.e+]+)[ ,]+([-\d.e+]+)\s*L\s*([-\d.e+]+)[ ,]+([-\d.e+]+)/gi, "").trim()) {
            throw new Error("Unexpected tick path syntax");
          }
          return segments.map(m => {
            const matrix = p.getScreenCTM();
            const a = new DOMPoint(Number(m[1]), Number(m[2])).matrixTransform(matrix);
            const b = new DOMPoint(Number(m[3]), Number(m[4])).matrixTransform(matrix);
            return { x: (a.x + b.x) / 2 - svg.x, y: (a.y + b.y) / 2 - svg.y,
              length: Math.hypot(a.x - b.x, a.y - b.y) };
          });
        });
      }) : undefined;
      const legend = legendMode ? await page.evaluate(() => {
        const frame = [...document.querySelectorAll("path")].filter(p => !p.closest("defs") &&
          /z/i.test(p.getAttribute("d") || "") && !/[cqast]/i.test(p.getAttribute("d") || "")).at(-1);
        if (!frame) throw new Error("Legend frame not found");
        const box = frame.getBoundingClientRect();
        const glyphs = [...document.querySelectorAll('[data-math-layout="cm-tex-box"] text, use')].map(el => {
          const p = new DOMPoint(Number(el.getAttribute("x")), Number(el.getAttribute("y"))).matrixTransform(el.getScreenCTM());
          return { x: p.x - box.x, y: p.y - box.y };
        }).filter(p => p.x >= 0 && p.x <= box.width && p.y >= 0 && p.y <= box.height);
        return { x: box.x, y: box.y, width: box.width, height: box.height, glyphs };
      }) : undefined;
      const axisGrid = gridMode ? await captureAxisGrid(page, { frame: entry.axisFrame || "middle" }) : undefined;
      const crossOuts = crossMode ? await captureCrossOuts(page) : undefined;
      const pin = entry.pinGlyphs ? await captureDatavisPin(page, entry.pinGlyphs) : undefined;
      const arrowPaint = entry.arrowGeometry ? await captureArrowPaint(page,
        typeof entry.arrowGeometry === "object" ? entry.arrowGeometry : {}) : undefined;
      const paintColors = entry.paintColors ? await page.evaluate(() => {
        const palette = { fill: new Set(), stroke: new Set() };
        for (const element of document.querySelectorAll("svg path, svg rect, svg circle, svg ellipse, svg polygon, svg text, svg use")) {
          if (element.closest("defs, clipPath, mask")) continue;
          const style = getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
          for (const property of ["fill", "stroke"]) {
            if (Number(style[`${property}Opacity`]) === 0) continue;
            if (property === "stroke" && parseFloat(style.strokeWidth) === 0) continue;
            if (/^rgb\(/.test(style[property])) palette[property].add(style[property]);
          }
        }
        return Object.fromEntries(Object.entries(palette).map(([key, values]) =>
          [key, [...values].map(color => color.match(/[\d.]+/g).map(Number))]));
      }) : undefined;
      // These two quiver controls have an axis-aligned black frame. Translate
      // to that independently painted frame; never resize either arrow field.
      const quiverViewport = entry.quiverPaint ? await page.evaluate(() => {
        const frames = [...document.querySelectorAll("svg path")].filter(p =>
          !p.closest("defs") && getComputedStyle(p).stroke === "rgb(0, 0, 0)")
          .map(p => p.getBoundingClientRect()).filter(b => b.width > 0 || b.height > 0);
        if (!frames.length) throw new Error("Expected the quiver control's black box frame");
        const svg = document.querySelector("svg").getBoundingClientRect();
        // Native emits separate edge paths; JS may emit one closed path.
        const x = Math.min(...frames.map(b => b.x)), y = Math.min(...frames.map(b => b.y));
        return { x: x - svg.x, y: y - svg.y,
          width: Math.max(...frames.map(b => b.right)) - x,
          height: Math.max(...frames.map(b => b.bottom)) - y };
      }) : undefined;
      const png = await page.locator("svg").first().screenshot({ path: path.join(outputRoot, `${stem}.png`) });
      if (legend) await page.screenshot({ path: path.join(outputRoot, `${stem}-legend.png`),
        clip: { x: Math.max(0, legend.x - 4), y: Math.max(0, legend.y - 4),
          width: legend.width + 8, height: legend.height + 8 } });
      images.push(decodePng(png));
      const curves = clipMode ? await captureClippedCurves(page, path.join(outputRoot, `${stem}-curves.png`)) : null;
      if (curves) curvePaint.push(curvePaintPoints(decodePng(curves.png), curves.viewport));
      panels.push({ title, image: `${stem}.png`, svg: `${stem}.svg`, origins, legend, ticks, axisGrid, crossOuts, pin, arrowPaint, paintColors, quiverViewport,
        ...(curves ? { viewport: curves.viewport, curvesImage: `${stem}-curves.png` } : {}) });
    }
    const difference = compareDecodedPngs(images[2], images[1]);
    const sheet = `browser/${id}-sheet.png`;
    await writeFile(path.join(outputRoot, sheet), encodePng(composeImageSheet(
      [...images, difference.diff], { columns: 2, gap: 20, padding: 20 })));
    let alignedSheet;
    if (gridMode) {
      // Keep the raw crop comparison above. This second sheet translates each
      // SVG once by its measured axis origin, without rescaling or label fits.
      const view = axisAlignedViewport(panels.map((panel, i) => ({
        width: images[i].width, height: images[i].height, origin: panel.axisGrid.origin
      })));
      const aligned = [];
      for (const [i, [, svg]] of inputs.entries()) {
        await page.setContent(`<style>body{margin:0;background:white}svg{display:block;position:absolute}</style>${svg}`);
        await page.evaluate(async ({ view, origin }) => {
          await document.fonts.ready;
          const svg = document.querySelector("svg");
          const box = svg.getBoundingClientRect();
          svg.style.width = `${box.width * 3}px`;
          svg.style.height = `${box.height * 3}px`;
          svg.style.left = `${view.x - origin.x}px`;
          svg.style.top = `${view.y - origin.y}px`;
        }, { view, origin: panels[i].axisGrid.origin });
        aligned.push(decodePng(await page.screenshot({
          clip: { x: 0, y: 0, width: view.width, height: view.height },
          path: path.join(outputRoot, `browser/${id}-${i}-aligned.png`)
        })));
      }
      alignedSheet = `browser/${id}-aligned-sheet.png`;
      await writeFile(path.join(outputRoot, alignedSheet), encodePng(composeImageSheet(
        [...aligned, compareDecodedPngs(aligned[2], aligned[1]).diff], { columns: 2, gap: 20, padding: 20 })));
    }
    let nativeGlyphGate;
    if (id === "math-native-contracts") {
      const js = panels[0].origins;
      const ref = panels[1].origins;
      const errorPx = Math.max(...js.flatMap((p, i) => [Math.abs(p.x - ref[i]?.x), Math.abs(p.y - ref[i]?.y)]));
      nativeGlyphGate = { glyphs: js.length, referenceGlyphs: ref.length, errorPx, tolerancePx: 0.09,
        accepted: js.length > 0 && js.length === ref.length && errorPx < 0.09 };
    }
    if (entry.nativeGlyphFrame) {
      const spec = entry.nativeGlyphFrame;
      const reference = panels[1].origins.slice(spec.referenceSkip || 0);
      const comparisons = [panels[0], panels[2]].map(panel => {
        const glyphs = panel.origins;
        const errorPx = glyphs.length === reference.length ? Math.max(...glyphs.flatMap((p, i) =>
          [Math.abs(p.x - reference[i].x), Math.abs(p.y - reference[i].y)])) : null;
        return { title: panel.title, glyphs: glyphs.length, referenceGlyphs: reference.length, errorPx,
          accepted: glyphs.length === spec.count && errorPx !== null && errorPx < 0.09 };
      });
      nativeGlyphGate = { alignment: "One rectangle-frame translation; fixed physical scale",
        referenceSkip: spec.referenceSkip || 0, excludedControl: spec.excludedControl,
        tolerancePx: 0.09, comparisons, accepted: comparisons.every(c => c.accepted) };
    }
    let legendGate;
    if (legendMode) {
      const ref = panels[1].legend;
      const comparisons = panels.filter((_, i) => i !== 1).map(panel => {
        const js = panel.legend;
        const matchingGlyphs = js.glyphs.length > 0 && js.glyphs.length === ref.glyphs.length;
        const glyphErrorPx = matchingGlyphs ? Math.max(...js.glyphs.flatMap((p, i) => [
          Math.abs(p.x - ref.glyphs[i].x), Math.abs(p.y - ref.glyphs[i].y)])) : null;
        const frameErrorPx = Math.max(Math.abs(js.width - ref.width), Math.abs(js.height - ref.height));
        return { title: panel.title, glyphs: js.glyphs.length, referenceGlyphs: ref.glyphs.length, glyphErrorPx, frameErrorPx,
          accepted: matchingGlyphs && glyphErrorPx < 0.2 && frameErrorPx < 0.2 };
      });
      legendGate = { comparisons,
        alignment: "Translation by each legend frame; identical physical scale, no fit or resize",
        accepted: comparisons.filter(c => !c.title.startsWith("Before")).every(c => c.accepted) };
    }
    let clipGate;
    if (clipMode) {
      const reference = panels[1].viewport;
      const comparisons = panels.flatMap((panel, i) => {
        if (i === 1) return [];
        const frameErrorPx = Math.max(Math.abs(panel.viewport.width - reference.width), Math.abs(panel.viewport.height - reference.height));
        const paint = compareCurvePaint(curvePaint[i], curvePaint[1]);
        return [{ title: panel.title, frameErrorPx, paint, accepted: frameErrorPx < 0.3 &&
          Object.values(paint).every(p => p.actualCoverage > 0.995 && p.referenceCoverage > 0.995) }];
      });
      clipGate = { comparisons, tolerancePx: 2,
        alignment: "Final clip translation only; actual browser curve pixels at identical 3x physical scale",
        accepted: comparisons.filter(c => !c.title.startsWith("Before")).every(c => c.accepted) };
    }
    let axisTextGate;
    if (textMode) {
      const ref = panels[1];
      const comparisons = panels.flatMap((panel, i) => {
        if (i === 1) return [];
        const matchingGlyphs = panel.origins.length > 0 && panel.origins.length === ref.origins.length;
        const errors = matchingGlyphs ? panel.origins.map((p, index) => ({ index,
          dx: (p.x - panel.viewport.x) - (ref.origins[index].x - ref.viewport.x),
          dy: (p.y - panel.viewport.y) - (ref.origins[index].y - ref.viewport.y)
        })) : [];
        const errorPx = matchingGlyphs ? Math.max(...errors.flatMap(p => [Math.abs(p.dx), Math.abs(p.dy)])) : null;
        const matchingTicks = panel.ticks.length > 0 && panel.ticks.length === ref.ticks.length;
        const tickErrorPx = matchingTicks ? Math.max(...panel.ticks.flatMap((p, index) => [
          Math.abs((p.x - panel.viewport.x) - (ref.ticks[index].x - ref.viewport.x)),
          Math.abs((p.y - panel.viewport.y) - (ref.ticks[index].y - ref.viewport.y)),
          Math.abs(p.length - ref.ticks[index].length)
        ])) : null;
        return [{ title: panel.title, glyphs: panel.origins.length, referenceGlyphs: ref.origins.length,
          errors, errorPx, ticks: panel.ticks.length, referenceTicks: ref.ticks.length, tickErrorPx,
          accepted: matchingGlyphs && errorPx < 0.3 && matchingTicks && tickErrorPx < 0.3 }];
      });
      axisTextGate = { comparisons, tolerancePx: 0.3,
        alignment: "One plot-clip translation for ALL tick, axis, annotation and legend glyph origins; no per-label fitting",
        accepted: comparisons.filter(c => !c.title.startsWith("Before")).every(c => c.accepted) };
    }
    const gridGate = gridMode ? { comparisons: panels.filter((_, i) => i !== 1).map(panel =>
      ({ title: panel.title, ...compareAxisGrid(panel.axisGrid, panels[1].axisGrid) })) } : undefined;
    if (gridGate) gridGate.accepted = gridGate.comparisons.filter(c => !c.title.startsWith("Before")).every(c => c.accepted);
    const crossGate = crossMode ? { comparisons: panels.filter((_, i) => i !== 1).map(panel =>
      ({ title: panel.title, ...compareCrossOuts(panel.crossOuts, panels[1].crossOuts) })) } : undefined;
    if (crossGate) crossGate.accepted = crossGate.comparisons.filter(c => !c.title.startsWith("Before")).every(c => c.accepted);
    const pinGate = entry.pinGlyphs ? { comparisons: panels.filter((_, i) => i !== 1).map(panel =>
      ({ title: panel.title, ...compareDatavisPin(panel.pin, panels[1].pin, entry.pinGlyphs) })) } : undefined;
    if (pinGate) pinGate.accepted = pinGate.comparisons.filter(c => !c.title.startsWith("Before")).every(c => c.accepted);
    const arrowGate = entry.arrowGeometry ? { comparisons: panels.filter((_, i) => i !== 1).map(panel =>
      ({ title: panel.title, ...compareArrowPaint(panel.arrowPaint, panels[1].arrowPaint) })) } : undefined;
    if (arrowGate) arrowGate.accepted = arrowGate.comparisons.filter(c => !c.title.startsWith("Before")).every(c => c.accepted);
    const paintColorGate = entry.paintColors ? {
      scope: "Requested computed SVG paint colors only; not geometry, layering or full visual acceptance",
      toleranceByte: 1,
      comparisons: panels.filter((_, i) => i !== 1).map(panel => {
        const matches = entry.paintColors.map(spec => {
          const distance = color => Math.max(...color.map((value, i) => Math.abs(value - spec.rgb[i])));
          const nearest = palette => palette[spec.property].reduce((best, color) =>
            !best || distance(color) < distance(best) ? color : best, null);
          const native = nearest(panels[1].paintColors);
          const actual = nearest(panel.paintColors);
          const errorByte = actual && native ? Math.max(...actual.map((value, i) => Math.abs(value - native[i]))) : null;
          return { ...spec, native, actual, errorByte,
            accepted: Boolean(native && distance(native) < 1 && errorByte !== null && errorByte < 1) };
        });
        return { title: panel.title, matches, accepted: matches.every(match => match.accepted) };
      })
    } : undefined;
    if (paintColorGate) paintColorGate.accepted = paintColorGate.comparisons.filter(c => !c.title.startsWith("Before")).every(c => c.accepted);
    const quiverPaintGate = entry.quiverPaint ? {
      scope: "Red/blue quiver paint in axis-aligned control cases; excludes text and other 3D views",
      tolerancePx: 1, minimumCoverage: .98,
      comparisons: panels.flatMap((panel, i) => {
        if (i === 1) return [];
        const paint = compareCurvePaint(curvePaintPoints(images[i], panel.quiverViewport),
          curvePaintPoints(images[1], panels[1].quiverViewport), 1)[entry.quiverPaint];
        const frameErrorPx = Math.max(...["width", "height"].map(k =>
          Math.abs(panel.quiverViewport[k] - panels[1].quiverViewport[k])));
        return [{ title: panel.title, ...paint, frameErrorPx,
          accepted: frameErrorPx < 1 && paint.actualPixels > 0 && paint.referencePixels > 0
            && paint.actualCoverage >= .98 && paint.referenceCoverage >= .98 }];
      })
    } : undefined;
    if (quiverPaintGate) quiverPaintGate.accepted = quiverPaintGate.comparisons.filter(c => !c.title.startsWith("Before")).every(c => c.accepted);
    summaries.push({ id, panels, sheet, alignedSheet, diagnostics: result.diagnostics, nativeGlyphGate, legendGate, clipGate, axisTextGate, gridGate, crossGate, pinGate, arrowGate, paintColorGate, quiverPaintGate,
      comparison: "Browser at 3x CSS zoom; SVG-text/reference diff is supplemental, not visual acceptance",
      meanAbsoluteRGBA: difference.meanAbsoluteRGBA });
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(outputRoot, "browser-audit.json"), JSON.stringify({ browser: browser.version(), cases: summaries, errors }, null, 2));
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Module regression comparison</title>
<style>body{font:14px system-ui;margin:24px;color:#222}h1{font-size:24px}h2{font-size:18px}h3{font-size:14px}section{border-top:1px solid #ccc;padding:16px 0}.panels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.panel{overflow:auto}object{display:block;zoom:2}img{max-width:100%}@media(max-width:800px){.panels{grid-template-columns:1fr}}</style>
<h1>Module regression comparison</h1><p>Live SVG objects at the same 2x zoom. Screenshots use 3x zoom. Full-library visual parity is not claimed.</p>
${summaries.map(c => `<section id="${escape(c.id)}"><h2>${escape(c.id)}</h2><div class="panels">${c.panels.map(p => `<div class="panel"><h3>${p.title}</h3><object type="image/svg+xml" data="${p.svg}"></object></div>`).join("")}</div><p><a href="mactex-png/${c.id}.png">MacTeX native PNG</a></p>${c.alignedSheet ? `<details open><summary>Shared axis origin: browser screenshots and difference</summary><img src="${c.alignedSheet}" alt="Same physical scale and shared origin; no resizing"></details>` : ""}<details><summary>Raw crop: browser screenshots and difference</summary><img src="${c.sheet}" alt="Browser outputs and difference"></details></section>`).join("")}</html>`;
  await writeFile(path.join(outputRoot, "browser-audit.html"), html);
  console.log(JSON.stringify({ cases: summaries.length, browserErrors: errors.length,
    nativeGlyphGates: summaries.filter(c => c.nativeGlyphGate).map(c => c.nativeGlyphGate),
    legendGates: summaries.filter(c => c.legendGate).map(c => ({ id: c.id, ...c.legendGate })),
    gridGates: summaries.filter(c => c.gridGate).map(c => ({ id: c.id, ...c.gridGate })),
    crossGates: summaries.filter(c => c.crossGate).map(c => ({ id: c.id, ...c.crossGate })),
    pinGates: summaries.filter(c => c.pinGate).map(c => ({ id: c.id, ...c.pinGate })),
    arrowGates: summaries.filter(c => c.arrowGate).map(c => ({ id: c.id, ...c.arrowGate })),
    paintColorGates: summaries.filter(c => c.paintColorGate).map(c => ({ id: c.id, ...c.paintColorGate })),
    quiverPaintGates: summaries.filter(c => c.quiverPaintGate).map(c => ({ id: c.id, ...c.quiverPaintGate })),
    axisTextGates: summaries.filter(c => c.axisTextGate).map(c => ({ id: c.id, accepted: c.axisTextGate.accepted,
      comparisons: c.axisTextGate.comparisons.map(({ errors, ...comparison }) => comparison) })),
    clipGates: summaries.filter(c => c.clipGate).map(c => ({ id: c.id, ...c.clipGate })), outputRoot }, null, 2));
  assert.ok(summaries.every(c => !c.nativeGlyphGate || c.nativeGlyphGate.accepted), "Native glyph origins must match the browser reference");
  assert.ok(summaries.every(c => !c.legendGate || c.legendGate.accepted), "Legend frame and glyph origins must match the browser reference");
  assert.ok(summaries.every(c => !c.clipGate || c.clipGate.accepted), "Clipped curve paint must match the browser reference");
  assert.ok(summaries.every(c => !c.axisTextGate || c.axisTextGate.accepted), "All axis glyph origins must match the browser reference");
  assert.ok(summaries.every(c => !c.gridGate || c.gridGate.accepted), "Browser ticks, grids and glyphs must match the native reference");
  assert.ok(summaries.every(c => !c.crossGate || c.crossGate.accepted), "Browser endpoint crosses must match the native reference");
  assert.ok(summaries.every(c => !c.pinGate || c.pinGate.accepted), "Browser pin endpoints and glyphs must match the native reference");
  assert.ok(summaries.every(c => !c.arrowGate || c.arrowGate.accepted), "Browser arrow curves, shafts, paint and canvas must match the native reference");
  assert.ok(summaries.every(c => !c.paintColorGate || c.paintColorGate.accepted), "Requested browser paint colors must match the native reference");
  assert.ok(summaries.every(c => !c.quiverPaintGate || c.quiverPaintGate.accepted), "Browser quiver paint must match the native reference");
} finally {
  await browser.close();
}
