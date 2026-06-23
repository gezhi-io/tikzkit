import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { splitTikzCodeBlocks } from "../src/index.js";
import { createGalleryMarkdown } from "../web/sample-gallery.js";
import { listWebCorpora, loadWebCorpus } from "../web/corpus-gallery-server.js";

test("web corpus registry exposes already-added external libraries", () => {
  const corpora = listWebCorpora();
  const ids = new Set(corpora.map((item) => item.id));

  assert.ok(ids.has("janosh"));
  assert.ok(ids.has("f0nzie"));
  assert.ok(ids.has("walmes"));
  assert.ok(ids.has("circuitikz"));
  assert.ok(ids.has("structural-analysis"));
  assert.equal(corpora.every((item) => item.expectedCount > 0), true);
});

test("web corpus loader can turn janosh/diagrams into visible TikZ blocks", async (t) => {
  const janosh = listWebCorpora().find((item) => item.id === "janosh");
  if (!janosh?.available) {
    t.skip(`janosh corpus not found at ${janosh?.root || "work/janosh-diagrams/assets"}`);
    return;
  }

  const corpus = await loadWebCorpus("janosh");
  const markdown = createGalleryMarkdown(corpus.cases, { origins: [corpus.origin] });
  const tikzParts = splitTikzCodeBlocks(markdown).filter((part) => part.type === "tikz");

  assert.equal(corpus.available, true);
  assert.equal(corpus.cases.length, janosh.expectedCount);
  assert.equal(tikzParts.length, janosh.expectedCount);
  assert.match(markdown, /janosh\/diagrams/);
  assert.match(markdown, /Case 001/);
});

test("web corpus loader can turn hackl/TikZ-StructuralAnalysis into visible TikZ blocks", async (t) => {
  const structural = listWebCorpora().find((item) => item.id === "structural-analysis");
  if (!structural?.available) {
    t.skip(`StructuralAnalysis corpus not found at ${structural?.root || "work/TikZ-StructuralAnalysis"}`);
    return;
  }

  const corpus = await loadWebCorpus("structural-analysis");
  const markdown = createGalleryMarkdown(corpus.cases, { origins: [corpus.origin] });
  const tikzParts = splitTikzCodeBlocks(markdown).filter((part) => part.type === "tikz");

  assert.equal(corpus.available, true);
  assert.equal(corpus.cases.length, structural.expectedCount);
  assert.equal(tikzParts.length, structural.expectedCount);
  assert.match(markdown, /hackl\/TikZ-StructuralAnalysis/);
  assert.match(markdown, /Case 001/);
});

test("web app has a corpus selector wired to the corpus API", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../web/app.js", import.meta.url), "utf8");

  assert.match(html, /id="gallery-source-select"/);
  assert.match(app, /fetchJson\("\/api\/corpora"\)/);
  assert.match(app, /fetchJson\(`\/api\/corpora\/\$\{encodeURIComponent\(selected\)\}`\)/);
  assert.match(app, /activeCases\s*=\s*cases/);
});
