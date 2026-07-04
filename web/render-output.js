import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { tikzToSvg } from "../src/index.js";
import { parseTikzCasesMarkdown } from "./cases-md.js";
import { parseCaseFilter } from "./case-filter.js";
import { createPhysicalScaleSheetSvg, createPhysicalScaleSvg } from "./physical-scale-sheet.js";
import { addTikzSourceUnitGrid } from "./tikz-source-grid.js";
import { generatedArtifactStatus } from "./tool-status.js";
import { diffReportFields, prefixedDiffReportFields } from "./diff-report.js";
import { runTikzToSvg } from "./tikztosvg-runner.js";

const webRoot = new URL("./", import.meta.url);
const outputRoot = new URL("./output/", webRoot);
const markdown = readFileSync(new URL("./cases.md", webRoot), "utf8");
const caseFilter = parseCaseFilter(process.argv.slice(2), process.env.TIKZKIT_WEB_CASES);
const cases = parseTikzCasesMarkdown(markdown).filter((item) => {
  if (!caseFilter.size) return true;
  return caseFilter.has(item.id);
});
const webRenderOptions = { strict: false, mathRenderer: "svg-text", margin: 0 };

if (caseFilter.size && cases.length === 0) {
  console.error(`No web cases matched: ${[...caseFilter].join(", ")}`);
  process.exitCode = 1;
}

await mkdir(outputRoot, { recursive: true });

const report = [];
for (const item of cases) {
  const caseDir = new URL(`./${item.id}/`, outputRoot);
  await mkdir(caseDir, { recursive: true });

  const sourcePath = new URL("./source.tikz", caseDir);
  const sourceGridPath = new URL("./source-grid.tikz", caseDir);
  const jsSvgPath = new URL("./js.svg", caseDir);
  const jsGridSvgPath = new URL("./js-grid.svg", caseDir);
  const jsGridPngPath = new URL("./js-grid.png", caseDir);
  const tikztosvgPath = new URL("./tikztosvg.svg", caseDir);
  const tikztosvgGridPath = new URL("./tikztosvg-grid.svg", caseDir);
  const tikztosvgPngPath = new URL("./tikztosvg.png", caseDir);
  const tikztosvgGridPngPath = new URL("./tikztosvg-grid.png", caseDir);
  const jsNormalizedSvgPath = new URL("./js-normalized.svg", caseDir);
  const jsNormalizedPngPath = new URL("./js-normalized.png", caseDir);
  const tikztosvgNormalizedSvgPath = new URL("./tikztosvg-normalized.svg", caseDir);
  const tikztosvgNormalizedPngPath = new URL("./tikztosvg-normalized.png", caseDir);
  const imageDiffPngPath = new URL("./image-diff.png", caseDir);
  const alignedImageDiffPngPath = new URL("./image-diff-aligned.png", caseDir);
  const physicalScaleSheetSvgPath = new URL("./physical-scale-sheet.svg", caseDir);
  const physicalScaleSheetPngPath = new URL("./physical-scale-sheet.png", caseDir);
  const reportPath = new URL("./report.json", caseDir);

  await removeArtifacts([
    jsSvgPath,
    jsGridSvgPath,
    jsGridPngPath,
    tikztosvgPath,
    tikztosvgGridPath,
    tikztosvgPngPath,
    tikztosvgGridPngPath,
    jsNormalizedSvgPath,
    jsNormalizedPngPath,
    tikztosvgNormalizedSvgPath,
    tikztosvgNormalizedPngPath,
    imageDiffPngPath,
    alignedImageDiffPngPath,
    physicalScaleSheetSvgPath,
    physicalScaleSheetPngPath
  ]);

  const sourceGrid = addTikzSourceUnitGrid(item.source);
  await writeFile(sourcePath, `${item.source.trim()}\n`);
  await writeFile(sourceGridPath, `${sourceGrid.trim()}\n`);

  const result = tikzToSvg(item.source, webRenderOptions);
  await writeFile(jsSvgPath, result.svg);
  const gridResult = tikzToSvg(sourceGrid, webRenderOptions);
  await writeFile(jsGridSvgPath, gridResult.svg);

  const jsGridPng = spawnSync("rsvg-convert", ["--background-color=white", filePath(jsGridSvgPath), "-o", filePath(jsGridPngPath)], {
    encoding: "utf8"
  });

  const tikztosvg = runTikzToSvg(filePath(sourcePath), filePath(tikztosvgPath), { texEngine: "xelatex" });
  const tikztosvgSvgExists = existsSync(filePath(tikztosvgPath));

  let pngOk = false;
  let gridPngOk = false;
  let physicalScaleSheetOk = false;
  let jsNormalizedOk = false;
  let tikztosvgNormalizedOk = false;
  let pngStatus = null;
  let gridPngStatus = null;
  let physicalScaleSheetStatus = null;
  let jsNormalizedStatus = null;
  let tikztosvgNormalizedStatus = null;
  let imageDiff = null;
  let alignedImageDiff = null;
  let pngStderr = "";
  let gridPngStderr = "";
  let physicalScaleSheetStderr = "";
  let jsNormalizedStderr = "";
  let tikztosvgNormalizedStderr = "";
  const tikztosvgGrid = runTikzToSvg(filePath(sourceGridPath), filePath(tikztosvgGridPath), { texEngine: "xelatex" });
  const tikztosvgGridSvgExists = existsSync(filePath(tikztosvgGridPath));

  if (tikztosvgSvgExists) {
    const png = spawnSync("rsvg-convert", ["--background-color=white", filePath(tikztosvgPath), "-o", filePath(tikztosvgPngPath)], {
      encoding: "utf8"
    });
    pngOk = png.status === 0;
    pngStatus = png.status;
    pngStderr = png.stderr?.trim() || "";
  }
  if (tikztosvgGridSvgExists) {
    const tikztosvgGridSvg = readFileSync(filePath(tikztosvgGridPath), "utf8");
    const gridPng = spawnSync("rsvg-convert", ["--background-color=white", filePath(tikztosvgGridPath), "-o", filePath(tikztosvgGridPngPath)], {
      encoding: "utf8"
    });
    gridPngOk = gridPng.status === 0;
    gridPngStatus = gridPng.status;
    gridPngStderr = gridPng.stderr?.trim() || "";

    try {
      const physicalScaleSheet = createPhysicalScaleSheetSvg([
        { title: "TikZKit JS SVG + 1cm grid", svg: gridResult.svg },
        { title: "tikztosvg SVG + 1cm grid", svg: tikztosvgGridSvg }
      ]);
      await writeFile(physicalScaleSheetSvgPath, physicalScaleSheet);
      const sheetPng = spawnSync("rsvg-convert", ["--background-color=white", filePath(physicalScaleSheetSvgPath), "-o", filePath(physicalScaleSheetPngPath)], {
        encoding: "utf8"
      });
      physicalScaleSheetOk = sheetPng.status === 0;
      physicalScaleSheetStatus = sheetPng.status;
      physicalScaleSheetStderr = sheetPng.stderr?.trim() || "";
    } catch (error) {
      physicalScaleSheetStatus = 1;
      physicalScaleSheetStderr = error instanceof Error ? error.message : String(error);
    }

    try {
      await writeFile(jsNormalizedSvgPath, createPhysicalScaleSvg({ title: "TikZKit JS SVG + 1cm grid", svg: gridResult.svg }));
      await writeFile(tikztosvgNormalizedSvgPath, createPhysicalScaleSvg({ title: "tikztosvg SVG + 1cm grid", svg: tikztosvgGridSvg }));
      const jsNormalized = spawnSync("rsvg-convert", ["--background-color=white", filePath(jsNormalizedSvgPath), "-o", filePath(jsNormalizedPngPath)], {
        encoding: "utf8"
      });
      const tikztosvgNormalized = spawnSync("rsvg-convert", ["--background-color=white", filePath(tikztosvgNormalizedSvgPath), "-o", filePath(tikztosvgNormalizedPngPath)], {
        encoding: "utf8"
      });
      jsNormalizedOk = jsNormalized.status === 0;
      tikztosvgNormalizedOk = tikztosvgNormalized.status === 0;
      jsNormalizedStatus = jsNormalized.status;
      tikztosvgNormalizedStatus = tikztosvgNormalized.status;
      jsNormalizedStderr = jsNormalized.stderr?.trim() || "";
      tikztosvgNormalizedStderr = tikztosvgNormalized.stderr?.trim() || "";
    } catch (error) {
      jsNormalizedStatus = 1;
      tikztosvgNormalizedStatus = 1;
      jsNormalizedStderr = error instanceof Error ? error.message : String(error);
      tikztosvgNormalizedStderr = error instanceof Error ? error.message : String(error);
    }
  }

  if (jsNormalizedOk && tikztosvgNormalizedOk) {
    imageDiff = spawnSync(
      "python3",
      [filePath(new URL("./image-diff.py", webRoot)), filePath(jsNormalizedPngPath), filePath(tikztosvgNormalizedPngPath), filePath(imageDiffPngPath)],
      { encoding: "utf8" }
    );
    alignedImageDiff = spawnSync(
      "python3",
      [
        filePath(new URL("./image-diff.py", webRoot)),
        filePath(jsNormalizedPngPath),
        filePath(tikztosvgNormalizedPngPath),
        filePath(alignedImageDiffPngPath),
        "--align-window",
        "32",
        "--align-step",
        "4"
      ],
      { encoding: "utf8" }
    );
  }

  const row = {
    id: item.id,
    title: item.title,
    source: relativeWebPath(sourcePath),
    sourceGrid: relativeWebPath(sourceGridPath),
    jsSvg: relativeWebPath(jsSvgPath),
    jsGridSvg: relativeWebPath(jsGridSvgPath),
    jsGridPng: jsGridPng.status === 0 ? relativeWebPath(jsGridPngPath) : null,
    jsNormalizedSvg: existsSync(filePath(jsNormalizedSvgPath)) ? relativeWebPath(jsNormalizedSvgPath) : null,
    jsNormalizedPng: jsNormalizedOk ? relativeWebPath(jsNormalizedPngPath) : null,
    tikztosvgSvg: tikztosvgSvgExists ? relativeWebPath(tikztosvgPath) : null,
    tikztosvgGridSvg: tikztosvgGridSvgExists ? relativeWebPath(tikztosvgGridPath) : null,
    tikztosvgPng: pngOk ? relativeWebPath(tikztosvgPngPath) : null,
    tikztosvgGridPng: gridPngOk ? relativeWebPath(tikztosvgGridPngPath) : null,
    tikztosvgNormalizedSvg: existsSync(filePath(tikztosvgNormalizedSvgPath)) ? relativeWebPath(tikztosvgNormalizedSvgPath) : null,
    tikztosvgNormalizedPng: tikztosvgNormalizedOk ? relativeWebPath(tikztosvgNormalizedPngPath) : null,
    ...diffReportFields({
      rawStatus: imageDiff?.status ?? null,
      stdout: imageDiff?.stdout || "",
      stderr: imageDiff?.stderr || "",
      diffExists: existsSync(filePath(imageDiffPngPath)),
      diffPath: relativeWebPath(imageDiffPngPath)
    }),
    ...prefixedDiffReportFields("alignedImageDiff", {
      rawStatus: alignedImageDiff?.status ?? null,
      stdout: alignedImageDiff?.stdout || "",
      stderr: alignedImageDiff?.stderr || "",
      diffExists: existsSync(filePath(alignedImageDiffPngPath)),
      diffPath: relativeWebPath(alignedImageDiffPngPath)
    }),
    physicalScaleSheetSvg: existsSync(filePath(physicalScaleSheetSvgPath)) ? relativeWebPath(physicalScaleSheetSvgPath) : null,
    physicalScaleSheetPng: physicalScaleSheetOk ? relativeWebPath(physicalScaleSheetPngPath) : null,
    diagnostics: result.diagnostics,
    jsGridDiagnostics: gridResult.diagnostics,
    jsGridPngStatus: jsGridPng.status,
    jsGridPngStderr: jsGridPng.stderr?.trim() || "",
    jsNormalizedPngStatus: jsNormalizedStatus,
    jsNormalizedPngStderr: jsNormalizedStderr,
    tikztosvgStatus: generatedArtifactStatus(tikztosvg.status, tikztosvgSvgExists, { fresh: tikztosvgSvgExists }),
    tikztosvgRawStatus: tikztosvg.status,
    tikztosvgGenerated: tikztosvgSvgExists,
    tikztosvgStderr: tikztosvg.stderr?.trim() || "",
    tikztosvgGridStatus: generatedArtifactStatus(tikztosvgGrid.status, tikztosvgGridSvgExists, { fresh: tikztosvgGridSvgExists }),
    tikztosvgGridRawStatus: tikztosvgGrid.status,
    tikztosvgGridGenerated: tikztosvgGridSvgExists,
    tikztosvgGridStderr: tikztosvgGrid.stderr?.trim() || "",
    rsvgStatus: pngStatus,
    rsvgStderr: pngStderr,
    rsvgGridStatus: gridPngStatus,
    rsvgGridStderr: gridPngStderr,
    rsvgNormalizedStatus: tikztosvgNormalizedStatus,
    rsvgNormalizedStderr: tikztosvgNormalizedStderr,
    physicalScaleSheetStatus,
    physicalScaleSheetStderr
  };
  await writeFile(reportPath, `${JSON.stringify(row, null, 2)}\n`);
  report.push(row);
}

await writeFile(new URL("./report.json", outputRoot), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${cases.length} web output case(s) to ${filePath(outputRoot)}`);

function filePath(url) {
  return path.resolve(url.pathname);
}

function relativeWebPath(url) {
  return path.relative(filePath(webRoot), filePath(url)).replace(/\\/g, "/");
}

async function removeArtifacts(urls) {
  await Promise.all(urls.map((url) => rm(filePath(url), { force: true })));
}
