import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { tikzToSvg } from "../src/index.js";
import { loadFixtureCorpus } from "../scripts/gallery-case-source.js";
import { galleryRenderOptions, materializeGalleryResources } from "../scripts/gallery-resources.js";

test("loads the maintained fixture manifest as the gallery fallback", async () => {
  const gallery = await loadFixtureCorpus();

  assert.equal(gallery.id, "fixture-core");
  assert.equal(gallery.available, true);
  assert.ok(gallery.cases.length >= 200);
  const triangle = gallery.cases.find((entry) => entry.id === "latex-examples-interiour-exteriour-angles-triangle");
  assert.ok(triangle);
  assert.match(triangle.source, /\\tkzMarkAngle\[arc=lll/);
});

test("feeds manifest CSV resources into gallery PGFPlots rendering", async () => {
  const gallery = await loadFixtureCorpus();
  const chart = gallery.cases.find((entry) => entry.id === "latex-examples-csv-line-plot-two-axes");

  assert.ok(chart);
  assert.equal(chart.resources.length, 2);
  assert.ok(chart.resources.every((resource) => typeof resource.content === "string"));

  const result = tikzToSvg(chart.source, galleryRenderOptions(chart, { mathRenderer: "svg-text" }));
  assert.equal(
    result.diagnostics.some((diagnostic) => /Could not resolve pgfplots table file/.test(diagnostic.message)),
    false
  );
  assert.ok(result.ir.items.length > 400, result.ir.items.length);
});

test("materializes manifest resources for native gallery references", async () => {
  const gallery = await loadFixtureCorpus();
  const chart = gallery.cases.find((entry) => entry.id === "latex-examples-csv-line-plot-two-axes");
  const workDir = await mkdtemp(path.join(tmpdir(), "tikzkit-gallery-resources-"));

  try {
    const copied = await materializeGalleryResources(chart, workDir);
    assert.deepEqual(copied.sort(), ["linearProbing.csv", "quadraticProbing.csv"]);
    assert.match(await readFile(path.join(workDir, "linearProbing.csv"), "utf8"), /seconds,situations,mirrored/);
    assert.match(await readFile(path.join(workDir, "quadraticProbing.csv"), "utf8"), /seconds,situations,mirrored/);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});
