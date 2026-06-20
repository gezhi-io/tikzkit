import assert from "node:assert/strict";
import test from "node:test";
import { splitTikzCodeBlocks, tikzToSvg } from "../src/index.js";
import { createSampleGallery } from "../web/sample-gallery.js";
import { REAL_GALLERY_CASES } from "../web/real-gallery-data.js";

test("web sample gallery provides 100 real TikZ source blocks", () => {
  const source = createSampleGallery();
  const parts = splitTikzCodeBlocks(source);
  const tikzParts = parts.filter((part) => part.type === "tikz");
  const petarVCases = REAL_GALLERY_CASES.filter((item) => item.origin === "PetarV-/TikZ");

  assert.equal(tikzParts.length, 100);
  assert.equal(REAL_GALLERY_CASES.length, 100);
  assert.equal(petarVCases.length, 65);
  assert.match(source, /Case 001/);
  assert.match(source, /Case 100/);
  assert.match(source, /PetarV-\/TikZ/);
  assert.match(source, /Packt GitHub|TikZ\.net/);

  for (const part of tikzParts) {
    const result = tikzToSvg(part.content);
    assert.match(result.svg, /<svg/);
    assert.equal(result.diagnostics.length, 0);
  }
});

test("web sample gallery is sourced from repository and website examples", () => {
  const origins = new Set(REAL_GALLERY_CASES.map((item) => item.origin));
  const paths = new Set(REAL_GALLERY_CASES.map((item) => `${item.origin}:${item.path}`));

  assert.equal(paths.size, REAL_GALLERY_CASES.length);
  assert.ok(origins.has("PetarV-/TikZ"));
  assert.ok(origins.has("Packt GitHub"));
  assert.ok(origins.has("TikZ.net"));
  assert.equal(REAL_GALLERY_CASES.every((item) => item.sourceUrl.startsWith("https://")), true);
});
