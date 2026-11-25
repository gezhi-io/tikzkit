import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { decodePng } from "./diff-example-pngs.js";

// Compare ink on white paper without shifting, resizing or rewarding empty margins.
// 2<A,B>/(||A||^2+||B||^2) penalizes both color changes and lost stroke coverage.
export function inkAgreement(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 0;
  let dot = 0, energy = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const x = (255 - a.data[i + c]) * (a.data[i + 3] / 255);
      const y = (255 - b.data[i + c]) * (b.data[i + 3] / 255);
      dot += x * y;
      energy += x * x + y * y;
    }
  }
  return energy ? 2 * dot / energy : 0;
}

async function audit(root) {
  const load = name => readFile(path.join(root, name));
  const captures = JSON.parse(await load("browser-audit.json"));
  const summary = JSON.parse(await load("summary.json"));
  const cases = new Map(captures.cases.map(c => [c.id, c]));
  if (captures.errors.length || !cases.size || cases.size !== summary.cases.length)
    throw new Error("Missing browser captures or browser errors");
  const results = [];
  for (const source of summary.cases) {
    const entry = cases.get(source.id);
    if (!entry || entry.diagnostics.length || source.diagnostics.length ||
        source.referenceKind !== "tikztosvg" || source.tikztosvgStatus !== "rendered" || source.mactexPngStatus !== "rendered")
      throw new Error("Incomplete independent references or unexpected diagnostics: " + source.id);
    const panel = async title => {
      const found = entry.panels.find(p => p.title === title);
      if (!found) throw new Error(source.id + ": missing " + title);
      return decodePng(await load(found.image));
    };
    const ref = await panel("Local tikztosvg");
    for (const title of ["Live workbench JS", "After SVG-text"]) {
      const actual = await panel(title);
      const score = inkAgreement(actual, ref);
      results.push({ id: source.id, panel: title, size: [actual.width, actual.height],
        referenceSize: [ref.width, ref.height], score, passed: score >= 0.95 });
    }
  }
  await writeFile(path.join(root, "vector-ink.json"), JSON.stringify(results, null, 2) + "\n");
  const passed = results.filter(r => r.passed).length;
  console.log("Full-size ink comparisons: " + passed + "/" + results.length + " at >= 0.95");
  if (passed !== results.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error("Usage: node scripts/measure-vector-ink.mjs <browser-audit-directory>");
  await audit(process.argv[2]);
}
