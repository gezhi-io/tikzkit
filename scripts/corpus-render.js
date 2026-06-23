import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tikzToSvg } from "../src/index.js";
import { loadWebCorpus, listWebCorpora } from "../web/corpus-gallery-server.js";
import { withGalleryDebugGrid } from "./gallery-debug-grid.js";
import { measureIrGridUnits } from "./gallery-unit-metrics.js";

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : Infinity;
const corpora = listWebCorpora();
const ids = requested.length ? requested : corpora.map((corpus) => corpus.id);
const outputRoot = "outputs/corpora";
const summaries = [];

await mkdir(outputRoot, { recursive: true });

for (const id of ids) {
  const corpus = await loadWebCorpus(id);
  if (!corpus) {
    summaries.push({ id, available: false, totalCases: 0, rendered: 0, diagnostics: 0, message: "unknown corpus" });
    continue;
  }
  const corpusOutput = path.join(outputRoot, corpus.id, "js");
  await mkdir(corpusOutput, { recursive: true });
  if (!corpus.available) {
    const summary = {
      id: corpus.id,
      label: corpus.label,
      available: false,
      root: corpus.root,
      expectedCount: corpus.expectedCount,
      totalCases: 0,
      rendered: 0,
      diagnostics: 0
    };
    await writeFile(path.join(corpusOutput, "report.json"), `${JSON.stringify({ ...summary, rows: [] }, null, 2)}\n`);
    summaries.push(summary);
    continue;
  }

  const rows = [];
  const cases = corpus.cases.slice(0, Number.isFinite(limit) ? limit : corpus.cases.length);
  for (const [index, item] of cases.entries()) {
    const caseId = String(index + 1).padStart(3, "0");
    const source = withGalleryDebugGrid(item.source);
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const svgPath = path.join(corpusOutput, `${caseId}.svg`);
    const pngPath = path.join(corpusOutput, `${caseId}.png`);
    await writeFile(svgPath, result.svg, "utf8");
    const raster = spawnSync("rsvg-convert", ["-o", pngPath, svgPath], { encoding: "utf8" });
    rows.push({
      id: caseId,
      origin: item.origin,
      title: item.title,
      path: item.path,
      sourceUrl: item.sourceUrl,
      svgPath,
      pngPath,
      ok: raster.status === 0,
      rasterError: raster.status === 0 ? "" : `${raster.stderr || raster.stdout || ""}`.trim(),
      unit: measureIrGridUnits(result.ir),
      diagnostics: result.diagnostics.map((diagnostic) => ({
        severity: diagnostic.severity,
        message: diagnostic.message
      }))
    });
  }
  const report = {
    id: corpus.id,
    label: corpus.label,
    origin: corpus.origin,
    root: corpus.root,
    expectedCount: corpus.expectedCount,
    totalCases: rows.length,
    rendered: rows.filter((row) => row.ok).length,
    diagnostics: rows.reduce((total, row) => total + row.diagnostics.length, 0),
    rows
  };
  await writeFile(path.join(corpusOutput, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  summaries.push(report);
  process.stdout.write(
    `corpus:render ${corpus.id} ${report.rendered}/${report.totalCases} PNGs, ${report.diagnostics} diagnostics\n`
  );
}

await writeFile(path.join(outputRoot, "render-summary.json"), `${JSON.stringify(summaries, null, 2)}\n`);
