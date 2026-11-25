import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { decodePng } from "./diff-example-pngs.js";

const nativeTitle = "Local tikztosvg";
const candidateTitles = ["Live workbench JS", "After SVG-text"];
const defaultConfig = new URL("../test/fixtures/native-path-ellipses/paint-probes.json", import.meta.url);
const readJson = async file => JSON.parse(await readFile(file, "utf8"));

function colorAt(image, x, y) {
  if (x >= image.width || y >= image.height) return null;
  const i = 4 * (y * image.width + x);
  // Browser captures have opaque paper. Do not accept transparent black as ink.
  return "#" + image.data.subarray(i, i + (image.data[i + 3] === 255 ? 3 : 4)).toString("hex");
}

export function comparePaintProbes(reference, candidate, spec) {
  const nativeSize = [reference.width, reference.height];
  const actualSize = [candidate.width, candidate.height];
  assert.ok(spec.referenceSize?.length === 2 && spec.referenceSize.every(n => Number.isInteger(n) && n > 0),
    "referenceSize must be the absolute native capture size in pixels");
  const sameSize = nativeSize.every((n, i) => n === spec.referenceSize[i] && n === actualSize[i]);
  const checks = Object.entries(spec.probes).map(([name, { uv, px, rgb }]) => {
    assert.match(rgb, /^#[0-9a-f]{6}$/i, name + ": declare the expected opaque reference RGB");
    assert.ok((uv === undefined) !== (px === undefined), name + ": specify either uv or px");
    // uv is a fraction of the *reference page*, top-left origin, not an ink box.
    // Resolve it once. Never align, resize, or remap a point onto a candidate.
    if (uv !== undefined) assert.ok(uv.length === 2 && uv.every(v => Number.isFinite(v) && v >= 0 && v < 1),
      name + ": uv must be in [0, 1)");
    const point = uv === undefined ? px : uv.map((v, i) => Math.floor(v * nativeSize[i]));
    assert.ok(point.length === 2 && point.every((n, i) => Number.isInteger(n) && n >= 0 && n < nativeSize[i]),
      name + ": point outside native page");
    const expected = rgb.toLowerCase(), native = colorAt(reference, ...point), actual = colorAt(candidate, ...point);
    return { name, point, expected, native, actual, passed: native === expected && actual === native };
  });
  assert.ok(checks.some(check => check.expected !== "#ffffff"), "Include at least one non-white paint control per case");
  return { declaredSize: spec.referenceSize, nativeSize, actualSize, sameSize, checks,
    passed: sameSize && checks.every(check => check.passed) };
}

async function audit(root, config) {
  const captures = await readJson(path.join(root, "browser-audit.json"));
  const summary = await readJson(path.join(root, "summary.json"));
  assert.deepEqual(captures.errors, [], "Browser audit reported errors");
  const specs = Object.entries(await readJson(config));
  assert.ok(specs.length, "No configured paint probes");
  const results = [];
  for (const [id, spec] of specs) {
    const capture = captures.cases.find(c => c.id === id);
    const source = summary.cases.find(c => c.id === id);
    assert.ok(source?.referenceKind === "tikztosvg" && source.tikztosvgStatus === "rendered" &&
      source.referenceProvenance?.tools?.kind === "local-tools", id + ": missing local tikztosvg reference");
    assert.match(spec.sourceSha256, /^[0-9a-f]{64}$/, id + ": pin sourceSha256 from the render summary");
    assert.equal(source.fingerprints?.sourceSha256, spec.sourceSha256, id + ": different fixture source");
    assert.deepEqual(source.diagnostics, [], id + ": render diagnostics");
    assert.deepEqual(capture?.diagnostics, [], id + ": missing browser capture or browser diagnostics");
    const files = [nativeTitle, ...candidateTitles].map(title => {
      const panels = capture.panels.filter(p => p.title === title);
      assert.equal(panels.length, 1, id + ": expected one " + title + " capture");
      return panels[0].image;
    });
    assert.equal(new Set(files).size, files.length, id + ": browser capture reused for multiple panels");
    const load = async file => decodePng(await readFile(path.join(root, file)));
    const reference = await load(files[0]);
    for (const [i, panel] of candidateTitles.entries()) {
      results.push({ id, panel, ...comparePaintProbes(reference, await load(files[i + 1]), spec) });
    }
  }
  return results;
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true,
    options: { json: { type: "boolean" }, help: { type: "boolean", short: "h" } } });
  const usage = "Usage: node scripts/compare-native-paint-probes.mjs <browser-audit-directory> [paint-probes.json] [--json]";
  if (values.help) return console.log(usage);
  assert.ok(positionals.length === 1 || positionals.length === 2, usage);
  const results = await audit(positionals[0], positionals[1] || defaultConfig);
  const passed = results.every(r => r.passed);
  if (values.json) console.log(JSON.stringify({ passed, results }, null, 2));
  else for (const r of results) {
    const failed = r.checks.filter(c => !c.passed);
    console.log(`${r.passed ? "PASS" : "FAIL"} ${r.id} / ${r.panel}: ${r.checks.length - failed.length}/${r.checks.length} paint; ` +
      `size ${r.actualSize.join("x")} (native ${r.nativeSize.join("x")}, declared ${r.declaredSize.join("x")})`);
    for (const c of failed) console.log(`  ${c.name} @ ${c.point}: expected ${c.expected}, native ${c.native}, actual ${c.actual ?? "out of bounds"}`);
  }
  if (!passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
