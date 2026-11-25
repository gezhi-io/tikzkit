import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { decodePng } from "./diff-example-pngs.js";

const root = process.argv[2];
if (!root) throw new Error("Usage: node scripts/measure-pattern-paint.mjs <browser-audit-directory> [paint-probes.json]");
const probes = JSON.parse(await readFile(process.argv[3] ||
  new URL("../test/fixtures/pgfplots-pattern-paint/paint-probes.json", import.meta.url), "utf8"));
const load = file => readFile(path.join(root, file));
const audit = JSON.parse(await load("browser-audit.json"));
const summary = JSON.parse(await load("summary.json"));
if (audit.errors.length) throw new Error("Browser errors; refusing to compare partial output");

// The audit renders 3x CSS size; one PDF bp is 96/72 CSS pixels. Compare
// fixed paper coordinates, never independently fit, align or normalize tiles.
function pixels(image, box) {
  const [left, top, right, bottom] = box.map(v => Math.round(v * 4));
  if (left < 0 || top < 0 || right > image.width || bottom > image.height || left >= right || top >= bottom)
    throw new Error("Invalid paper-space probe: " + box);
  const rgba = image.data, channels = [[], [], []];
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const off = 4 * (y * image.width + x);
    for (let c = 0; c < 3; c++) channels[c].push(255 + (rgba[off + c] - 255) * rgba[off + 3] / 255);
  }
  return channels;
}

const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
const rounded = value => Math.round(value * 1000) / 1000;
function compare(live, native, probe) {
  const a = pixels(live, probe.box), b = pixels(native, probe.box);
  const ma = a.map(mean), mb = b.map(mean);
  const meanError = Math.max(...ma.map((n, i) => Math.abs(n - mb[i])));
  if (probe.solid) {
    const solid = [a, b].every(rgb => rgb.every((values, c) => values.every(v => Math.abs(v - probe.solid[c]) <= 2)));
    return { meanError: rounded(meanError), accepted: solid };
  }
  const sd = (arr, m) => Math.sqrt(mean(arr.map(v => (v - m) ** 2)));
  const deviation = b.map((ch, i) => sd(ch, mb[i]));
  const c = deviation.indexOf(Math.max(...deviation));
  const sa = sd(a[c], ma[c]), sb = deviation[c];
  const corr = sa && sb ? mean(a[c].map((v, i) => (v - ma[c]) * (b[c][i] - mb[c]))) / (sa * sb) : 0;
  const contrast = sb ? sa / sb : 0;
  // Vector antialiasing varies; losing ink, reversing lines, using the
  // wrong alpha or shifting half a cell must still fail.
  return { meanError: rounded(meanError), correlation: rounded(corr), contrast: rounded(contrast),
    accepted: sb >= 3 && corr >= .90 && contrast >= .75 && contrast <= 1.3 && meanError <= 12 };
}

const checks = [];
for (const [id, regions] of Object.entries(probes)) {
  const entry = audit.cases.find(c => c.id === id);
  const source = summary.cases.find(c => c.id === id);
  if (!entry || entry.diagnostics.length || source?.tikztosvgStatus !== "rendered" || source.mactexPngStatus !== "rendered")
    throw new Error("Missing independent reference or unexpected diagnostics: " + id);
  const panel = async title => {
    const found = entry.panels.find(p => p.title === title);
    if (!found) throw new Error(id + ": missing " + title);
    return decodePng(await load(found.image));
  };
  const ref = await panel("Local tikztosvg");
  for (const title of ["Live workbench JS", "After SVG-text"]) {
    const candidate = await panel(title);
    const samePage = Math.abs(candidate.width - ref.width) <= 1 && Math.abs(candidate.height - ref.height) <= 1;
    for (const [name, probe] of Object.entries(regions)) {
      const measurement = compare(candidate, ref, probe);
      checks.push({ id, title, name, ...measurement, accepted: samePage && measurement.accepted });
    }
  }
}
const failed = checks.filter(c => !c.accepted);
await writeFile(path.join(root, "pattern-metrics.json"), JSON.stringify({ checks }, null, 2) + "\n");
console.log(`${checks.length - failed.length}/${checks.length} physical paint probes passed`);
if (failed.length) { console.error(failed); process.exitCode = 1; }
