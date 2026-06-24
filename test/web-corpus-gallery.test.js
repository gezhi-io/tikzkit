import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { splitTikzCodeBlocks } from "../src/index.js";
import { createGalleryMarkdown } from "../web/sample-gallery.js";
import { REAL_GALLERY_CASES } from "../web/real-gallery-data.js";
import { listWebCorpora, loadWebCorpus, normalizedGallerySourceKey } from "../web/corpus-gallery-server.js";
import { loadRealGalleryCases } from "../scripts/gallery-case-source.js";

test("web corpus registry exposes one merged core gallery", () => {
  const corpora = listWebCorpora();

  assert.equal(corpora.length, 1);
  assert.equal(corpora[0].id, "core");
  assert.equal(corpora[0].merged, true);
  assert.equal(corpora[0].dedupe, "source");
  assert.ok(corpora[0].expectedCount > REAL_GALLERY_CASES.length);
});

test("web corpus loader can turn janosh/diagrams into visible TikZ blocks", async (t) => {
  const corpus = await loadWebCorpus("janosh");
  if (!corpus?.available) {
    t.skip(`janosh corpus not found at ${corpus?.root || "work/janosh-diagrams/assets"}`);
    return;
  }

  const markdown = createGalleryMarkdown(corpus.cases, { origins: [corpus.origin] });
  const tikzParts = splitTikzCodeBlocks(markdown).filter((part) => part.type === "tikz");

  assert.equal(corpus.available, true);
  assert.equal(corpus.cases.length, corpus.expectedCount);
  assert.equal(tikzParts.length, corpus.expectedCount);
  assert.match(markdown, /janosh\/diagrams/);
  assert.match(markdown, /Case 001/);
});

test("web corpus loader can turn hackl/TikZ-StructuralAnalysis into visible TikZ blocks", async (t) => {
  const corpus = await loadWebCorpus("structural-analysis");
  if (!corpus?.available) {
    t.skip(`StructuralAnalysis corpus not found at ${corpus?.root || "work/TikZ-StructuralAnalysis"}`);
    return;
  }

  const markdown = createGalleryMarkdown(corpus.cases, { origins: [corpus.origin] });
  const tikzParts = splitTikzCodeBlocks(markdown).filter((part) => part.type === "tikz");

  assert.equal(corpus.available, true);
  assert.equal(corpus.cases.length, corpus.expectedCount);
  assert.equal(tikzParts.length, corpus.expectedCount);
  assert.match(markdown, /hackl\/TikZ-StructuralAnalysis/);
  assert.match(markdown, /Case 001/);
});

test("core gallery loader merges available corpora and removes duplicate sources", async () => {
  const core = await loadWebCorpus("core");
  const markdown = createGalleryMarkdown(core.cases, core.summary);
  const tikzParts = splitTikzCodeBlocks(markdown).filter((part) => part.type === "tikz");
  const sourceKeys = core.cases.map((item) => normalizedGallerySourceKey(item.source));
  const uniqueSourceKeys = new Set(sourceKeys);
  const expectedOrigins = [
    ["janosh", "janosh/diagrams"],
    ["f0nzie", "f0nzie/tikz_favorites"],
    ["walmes", "walmes/Tikz"],
    ["circuitikz", "circuitikz/circuitikz"],
    ["structural-analysis", "hackl/TikZ-StructuralAnalysis"]
  ];
  const origins = new Set(core.cases.map((item) => item.origin));

  assert.equal(core.id, "core");
  assert.equal(core.available, true);
  assert.equal(sourceKeys.length, uniqueSourceKeys.size);
  assert.equal(core.summary.rawCaseCount - core.cases.length, core.summary.duplicatesRemoved);
  assert.equal(tikzParts.length, core.cases.length);
  assert.ok(core.cases.length >= REAL_GALLERY_CASES.length);
  for (const [id, origin] of expectedOrigins) {
    const corpus = await loadWebCorpus(id);
    if (corpus?.available) assert.ok(origins.has(origin), `expected merged core to include ${origin}`);
  }
});

test("web app defaults to the merged core gallery API", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../web/app.js", import.meta.url), "utf8");

  assert.match(html, /id="gallery-source-select"/);
  assert.match(app, /fetchJson\("\/api\/corpora"\)/);
  assert.match(app, /fetchJson\("\/api\/corpora\/core"\)/);
  assert.doesNotMatch(app, /fetchJson\(`\/api\/corpora\/\$\{encodeURIComponent\(selected\)\}`\)/);
});

test("local gallery artifact scripts use the same merged core cases as the web app", async () => {
  const gallery = await loadRealGalleryCases();
  const nativeScript = readFileSync(new URL("../scripts/gallery-native.js", import.meta.url), "utf8");
  const jsScript = readFileSync(new URL("../scripts/gallery-js.js", import.meta.url), "utf8");
  const auditScript = readFileSync(new URL("../scripts/gallery-audit.js", import.meta.url), "utf8");

  assert.equal(gallery.id, "core");
  assert.equal(gallery.available, true);
  assert.ok(gallery.cases.length > REAL_GALLERY_CASES.length);
  assert.deepEqual(
    gallery.cases.map((item) => item.source),
    (await loadWebCorpus("core")).cases.map((item) => item.source)
  );

  for (const script of [nativeScript, jsScript, auditScript]) {
    assert.match(script, /loadRealGalleryCases/);
    assert.doesNotMatch(script, /REAL_GALLERY_CASES/);
  }
});
