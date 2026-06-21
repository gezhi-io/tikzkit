import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { splitTikzCodeBlocks, tikzToSvg } from "../src/index.js";
import { createSampleGallery } from "../web/sample-gallery.js";
import { REAL_GALLERY_CASES } from "../web/real-gallery-data.js";

test("web sample gallery provides 121 real TikZ source blocks", () => {
  const source = createSampleGallery();
  const parts = splitTikzCodeBlocks(source);
  const tikzParts = parts.filter((part) => part.type === "tikz");
  const petarVCases = REAL_GALLERY_CASES.filter((item) => item.origin === "PetarV-/TikZ");

  assert.equal(tikzParts.length, 121);
  assert.equal(REAL_GALLERY_CASES.length, 121);
  assert.equal(petarVCases.length, 65);
  assert.match(source, /Case 001/);
  assert.match(source, /Case 100/);
  assert.match(source, /Case 121/);
  assert.match(source, /PetarV-\/TikZ/);
  assert.match(source, /Packt GitHub|TikZ\.net|MacTeX tikz-network|MacTeX tikz-3dplot|MacTeX tikz-bagua|MacTeX tikz-bbox|MacTeX tikz-bpmn|MacTeX tikz-cd|MacTeX tikz-decofonts|MacTeX tikz-dimline|MacTeX tikz-ext/);

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
  assert.ok(origins.has("MacTeX tikz-network"));
  assert.ok(origins.has("MacTeX tikz-3dplot"));
  assert.ok(origins.has("MacTeX tikz-bagua"));
  assert.ok(origins.has("MacTeX tikz-bbox"));
  assert.ok(origins.has("MacTeX tikz-bpmn"));
  assert.ok(origins.has("MacTeX tikz-cd"));
  assert.ok(origins.has("MacTeX tikz-decofonts"));
  assert.ok(origins.has("MacTeX tikz-dimline"));
  assert.ok(origins.has("MacTeX tikz-ext"));
  assert.equal(REAL_GALLERY_CASES.every((item) => item.sourceUrl.startsWith("https://")), true);
});

test("web entry declares an inline favicon to keep browser console clean", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");

  assert.match(html, /<link\s+rel="icon"/);
  assert.match(html, /href="data:image\/svg\+xml,/);
});

test("web CSS does not restyle nested KaTeX SVG accents", () => {
  const css = readFileSync(new URL("../web/styles.css", import.meta.url), "utf8");

  assert.match(css, /\.svg-surface\s*>\s*svg\s*\{/);
  assert.doesNotMatch(css, /\.svg-surface\s+svg\s*\{/);
});
