import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { tikzToSvg } from "../src/index.js";
import { REAL_GALLERY_CASES } from "../web/real-gallery-data.js";
import { withGalleryDebugGrid } from "./gallery-debug-grid.js";
import { measureIrGridUnits } from "./gallery-unit-metrics.js";

const outputRoot = "outputs/real-gallery/js";
await mkdir(outputRoot, { recursive: true });

const rows = [];
for (const [index, item] of REAL_GALLERY_CASES.entries()) {
  const id = String(index + 1).padStart(3, "0");
  const source = withGalleryDebugGrid(item.source);
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const svgPath = path.join(outputRoot, `${id}.svg`);
  const pngPath = path.join(outputRoot, `${id}.png`);
  await writeFile(svgPath, result.svg, "utf8");
  const raster = spawnSync("rsvg-convert", ["-o", pngPath, svgPath], { encoding: "utf8" });
  rows.push({
    id,
    origin: item.origin,
    path: item.path,
    svgPath,
    pngPath,
    ok: raster.status === 0,
    unit: measureIrGridUnits(result.ir),
    diagnostics: result.diagnostics
  });
}

await writeFile(path.join(outputRoot, "report.json"), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
process.stdout.write(`gallery:js wrote ${rows.filter((row) => row.ok).length}/${rows.length} JS PNGs\n`);
