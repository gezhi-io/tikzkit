#!/usr/bin/env node
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExternalLatexAdapter } from "../src/adapters/externalLatex.js";
import { withGalleryDebugGrid } from "./gallery-debug-grid.js";
import { renderExampleFixtures } from "./render-example-fixtures.js";
import {
  compareDecodedPngs,
  composeImageSheet,
  decodePng,
  encodePng
} from "./diff-example-pngs.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const DEFAULT_MANIFEST_PATH = path.join(REPO_ROOT, "test", "fixtures", "font-visual-gates", "manifest.json");
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, "outputs", "font-visual-gates");
const EXAMPLE_FIXTURE_ROOT = path.join(REPO_ROOT, "test", "fixtures", "examples");
const RASTER_DPI = 96;
const PT_PER_PIXEL = 72 / RASTER_DPI;

export async function renderFontVisualGates(options = {}) {
  const manifestPath = path.resolve(options.manifestPath || DEFAULT_MANIFEST_PATH);
  const outputRoot = path.resolve(options.outputRoot || DEFAULT_OUTPUT_ROOT);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const stagingRoot = path.join(outputRoot, ".fixtures");
  const pairRoot = path.join(outputRoot, ".pair-render");
  const gridPairRoot = path.join(outputRoot, ".pair-grid-render");
  const external = createExternalLatexAdapter(options.external);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(stagingRoot, { recursive: true });

  const stagedCases = [];
  const sources = new Map();
  for (const entry of manifest.cases || []) {
    const source = await loadFontGateSource(entry);
    sources.set(entry.id, source);
    const stagedSource = `${entry.id}.tex`;
    await writeFile(path.join(stagingRoot, stagedSource), source, "utf8");
    stagedCases.push({ id: entry.id, title: entry.id, source: stagedSource });
  }
  await writeFile(path.join(stagingRoot, "manifest.json"), `${JSON.stringify({ cases: stagedCases }, null, 2)}\n`, "utf8");

  const pairSummary = await renderExampleFixtures({
    fixtureRoot: stagingRoot,
    outputRoot: pairRoot,
    strictTikztosvg: true,
    tikztosvgEngine: "xelatex",
    externalCommandTimeoutMs: options.timeoutMs || 300000,
    renderOptions: { margin: 0, mathRenderer: "svg-text" }
  });
  const gridPairSummary = await renderExampleFixtures({
    fixtureRoot: stagingRoot,
    outputRoot: gridPairRoot,
    strictTikztosvg: true,
    tikztosvgEngine: "xelatex",
    comparisonGridMode: "source",
    externalCommandTimeoutMs: options.timeoutMs || 300000,
    renderOptions: { margin: 0, mathRenderer: "svg-text" }
  });
  await copyFontAssets(pairRoot, outputRoot);

  const cases = [];
  for (const entry of manifest.cases || []) {
    const pairEntry = pairSummary.cases.find((item) => item.id === entry.id);
    const gridPairEntry = gridPairSummary.cases.find((item) => item.id === entry.id);
    if (!pairEntry) throw new Error(`Missing pair-render result for ${entry.id}`);
    if (!gridPairEntry) throw new Error(`Missing grid pair-render result for ${entry.id}`);
    const caseDir = path.join(outputRoot, entry.id);
    await mkdir(caseDir, { recursive: true });
    await writeFile(path.join(caseDir, "source.tex"), sources.get(entry.id), "utf8");
    await writeFile(path.join(caseDir, "source-grid.tex"), withGalleryDebugGrid(sources.get(entry.id)), "utf8");
    await copyPairArtifacts(pairRoot, pairEntry, caseDir);
    await copyGridPairArtifacts(gridPairRoot, gridPairEntry, caseDir);
    await renderNativeMacTeX(external, entry, caseDir, options.timeoutMs || 300000);
    const result = await writeComparisonArtifacts(caseDir, manifest.tolerances || {});
    cases.push({ id: entry.id, ...result });
  }

  const summary = {
    outputRoot,
    rasterDpi: RASTER_DPI,
    tolerances: manifest.tolerances || {},
    passed: cases.filter((entry) => entry.status === "pass").length,
    total: cases.length,
    cases
  };
  await writeFile(path.join(outputRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputRoot, "summary.md"), formatGateSummary(summary), "utf8");
  return summary;
}

export async function loadFontGateSource(entry) {
  if (entry.source) return readFile(path.resolve(REPO_ROOT, entry.source), "utf8");
  if (!entry.sourceId) throw new Error(`Font gate ${entry.id || "<unknown>"} has no source or sourceId`);
  const examples = JSON.parse(await readFile(path.join(EXAMPLE_FIXTURE_ROOT, "manifest.json"), "utf8"));
  const sourceEntry = (examples.cases || []).find((candidate) => candidate.id === entry.sourceId);
  if (!sourceEntry) throw new Error(`Unknown example sourceId ${entry.sourceId}`);
  return readFile(path.join(EXAMPLE_FIXTURE_ROOT, sourceEntry.source), "utf8");
}

async function copyFontAssets(pairRoot, outputRoot) {
  const sourceDir = path.join(pairRoot, "fonts");
  const targetDir = path.join(outputRoot, "fonts");
  await mkdir(targetDir, { recursive: true });
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    if (entry.isFile()) await copyFile(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
  }
}

async function copyPairArtifacts(pairRoot, entry, caseDir) {
  const artifacts = [
    [entry.tikzkitSvg, "tikzkit.svg"],
    [entry.tikzkitPng, "tikzkit.png"],
    [entry.tikztosvgSvg, "tikztosvg.svg"],
    [entry.tikztosvgPng, "tikztosvg.png"],
    [entry.tikztosvgInput, "tikztosvg-source.tex"]
  ];
  for (const [relativePath, name] of artifacts) {
    if (!relativePath) throw new Error(`Missing ${name} for ${entry.id}`);
    await copyFile(path.join(pairRoot, relativePath), path.join(caseDir, name));
  }
}

async function copyGridPairArtifacts(pairRoot, entry, caseDir) {
  const artifacts = [
    [entry.tikzkitSvg, "tikzkit-grid.svg"],
    [entry.tikzkitPng, "tikzkit-grid.png"],
    [entry.tikztosvgSvg, "tikztosvg-grid.svg"],
    [entry.tikztosvgPng, "tikztosvg-grid.png"],
    [entry.tikztosvgInput, "tikztosvg-grid-source.tex"]
  ];
  for (const [relativePath, name] of artifacts) {
    if (!relativePath) throw new Error(`Missing ${name} for ${entry.id}`);
    await copyFile(path.join(pairRoot, relativePath), path.join(caseDir, name));
  }
}

export async function renderNativeMacTeX(external, entry, caseDir, timeoutMs = 300000) {
  const engine = entry.nativeEngine || "pdflatex";
  await compileNativeSource(external, entry, caseDir, engine, "source.tex", "native", timeoutMs);
  await compileNativeSource(external, entry, caseDir, engine, "source-grid.tex", "native-grid", timeoutMs);
}

async function compileNativeSource(external, entry, caseDir, engine, sourceName, jobName, timeoutMs) {
  const compile = await external.runCommand(
    engine,
    ["-interaction=nonstopmode", "-halt-on-error", `-jobname=${jobName}`, sourceName],
    { cwd: caseDir, timeoutMs }
  );
  await writeFile(
    path.join(caseDir, `${jobName}-build.log`),
    [`engine: ${engine}`, `exitCode: ${compile.exitCode}`, "", compile.stdout || "", compile.stderr || ""].join("\n"),
    "utf8"
  );
  if (compile.exitCode !== 0) throw new Error(`${engine} failed for ${entry.id}; see ${jobName}-build.log`);

  const raster = await external.runCommand(
    "pdftocairo",
    ["-png", "-singlefile", "-r", String(RASTER_DPI), `${jobName}.pdf`, jobName],
    { cwd: caseDir, timeoutMs }
  );
  if (raster.exitCode !== 0) throw new Error(`pdftocairo failed for ${entry.id}: ${raster.stderr || raster.stdout}`);
}

export async function writeComparisonArtifacts(caseDir, tolerances = {}) {
  const native = decodePng(await readFile(path.join(caseDir, "native.png")));
  const tikztosvg = decodePng(await readFile(path.join(caseDir, "tikztosvg.png")));
  const tikzkit = decodePng(await readFile(path.join(caseDir, "tikzkit.png")));
  const comparison = compareDecodedPngs(tikzkit, native);
  await writeFile(path.join(caseDir, "diff.png"), encodePng(comparison.diff));
  await writeFile(
    path.join(caseDir, "sheet.png"),
    encodePng(composeImageSheet([native, tikztosvg, tikzkit, comparison.diff], { columns: 2, gap: 24, padding: 16 }))
  );

  const nativeGrid = decodePng(await readFile(path.join(caseDir, "native-grid.png")));
  const tikztosvgGrid = decodePng(await readFile(path.join(caseDir, "tikztosvg-grid.png")));
  const tikzkitGrid = decodePng(await readFile(path.join(caseDir, "tikzkit-grid.png")));
  const gridComparison = compareDecodedPngs(tikzkitGrid, nativeGrid);
  await writeFile(path.join(caseDir, "diff-grid.png"), encodePng(gridComparison.diff));
  await writeFile(
    path.join(caseDir, "sheet-grid.png"),
    encodePng(composeImageSheet([nativeGrid, tikztosvgGrid, tikzkitGrid, gridComparison.diff], { columns: 2, gap: 24, padding: 16 }))
  );

  const metrics = buildGateMetrics({ native, tikztosvg, tikzkit }, tolerances);
  await writeFile(path.join(caseDir, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  return {
    status: metrics.status,
    metrics: path.join(path.basename(caseDir), "metrics.json"),
    sheet: path.join(path.basename(caseDir), "sheet.png"),
    gridSheet: path.join(path.basename(caseDir), "sheet-grid.png")
  };
}

export function buildGateMetrics(images, tolerances = {}) {
  const measured = Object.fromEntries(Object.entries(images).map(([name, image]) => [name, measureVisibleBox(image)]));
  const tikzkitDelta = metricDelta(measured.tikzkit, measured.native);
  const tikztosvgDelta = metricDelta(measured.tikztosvg, measured.native);
  const visibleTolerance = Number(tolerances.visibleBoxPt ?? 1);
  const anchorTolerance = Number(tolerances.anchorPt ?? 1);
  const status = tikzkitDelta.visibleBoxMaxPt <= visibleTolerance && tikzkitDelta.anchorMaxPt <= anchorTolerance
    ? "pass"
    : "review";
  return {
    status,
    rasterDpi: RASTER_DPI,
    tolerances: { visibleBoxPt: visibleTolerance, anchorPt: anchorTolerance },
    measured,
    deltas: { tikzkitVsNative: tikzkitDelta, tikztosvgVsNative: tikztosvgDelta },
    visualReviewRequired: true
  };
}

export function measureVisibleBox(image, threshold = 8) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      const alpha = image.data[index + 3];
      const distanceFromWhite = Math.max(
        255 - image.data[index],
        255 - image.data[index + 1],
        255 - image.data[index + 2]
      );
      if (alpha <= threshold || distanceFromWhite <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const hasPaint = maxX >= minX && maxY >= minY;
  const visible = hasPaint
    ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : { x: 0, y: 0, width: 0, height: 0 };
  const centerX = visible.x + visible.width / 2;
  const centerY = visible.y + visible.height / 2;
  return {
    canvasPt: { width: toPt(image.width), height: toPt(image.height) },
    visibleBoxPt: {
      x: toPt(visible.x),
      y: toPt(visible.y),
      width: toPt(visible.width),
      height: toPt(visible.height)
    },
    anchorFromCanvasCenterPt: {
      x: toPt(centerX - image.width / 2),
      y: toPt(centerY - image.height / 2)
    }
  };
}

function metricDelta(actual, expected) {
  const visibleWidthPt = Math.abs(actual.visibleBoxPt.width - expected.visibleBoxPt.width);
  const visibleHeightPt = Math.abs(actual.visibleBoxPt.height - expected.visibleBoxPt.height);
  const anchorXPt = Math.abs(actual.anchorFromCanvasCenterPt.x - expected.anchorFromCanvasCenterPt.x);
  const anchorYPt = Math.abs(actual.anchorFromCanvasCenterPt.y - expected.anchorFromCanvasCenterPt.y);
  return {
    canvasWidthPt: round(Math.abs(actual.canvasPt.width - expected.canvasPt.width)),
    canvasHeightPt: round(Math.abs(actual.canvasPt.height - expected.canvasPt.height)),
    visibleWidthPt: round(visibleWidthPt),
    visibleHeightPt: round(visibleHeightPt),
    visibleBoxMaxPt: round(Math.max(visibleWidthPt, visibleHeightPt)),
    anchorXPt: round(anchorXPt),
    anchorYPt: round(anchorYPt),
    anchorMaxPt: round(Math.max(anchorXPt, anchorYPt))
  };
}

function toPt(pixels) {
  return round(pixels * PT_PER_PIXEL);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function formatGateSummary(summary) {
  const lines = [
    "# Font visual gates",
    "",
    `Generated at 96 dpi. Automated physical-box result: ${summary.passed}/${summary.total} within tolerance.`,
    "",
    "Panel order in every 2x2 sheet: native MacTeX, tikztosvg, TikZKit, TikZKit-vs-native diff.",
    "Each case includes both sheet.png and source-level 1cm-grid sheet-grid.png.",
    "",
    "| Case | Automated box status | Visual review |",
    "| --- | --- | --- |"
  ];
  for (const entry of summary.cases) lines.push(`| ${entry.id} | ${entry.status} | pending |`);
  lines.push("", "Automated numbers are supporting evidence only. A case is not accepted until the sheet is inspected.", "");
  return lines.join("\n");
}

if (path.resolve(process.argv[1] || "") === SCRIPT_PATH) {
  renderFontVisualGates()
    .then((summary) => process.stdout.write(`Rendered ${summary.total} font visual gates into ${summary.outputRoot}\n`))
    .catch((error) => {
      process.stderr.write(`${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}
