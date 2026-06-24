import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { splitTikzCodeBlocks, tikzToSvg } from "../src/index.js";
import { createSampleGallery } from "../web/sample-gallery.js";
import { REAL_GALLERY_CASES } from "../web/real-gallery-data.js";

test("web sample gallery provides real TikZ source blocks plus math concept coverage cases", () => {
  const source = createSampleGallery();
  const parts = splitTikzCodeBlocks(source);
  const tikzParts = parts.filter((part) => part.type === "tikz");
  const petarVCases = REAL_GALLERY_CASES.filter((item) => item.origin === "PetarV-/TikZ");
  const mathConceptCases = REAL_GALLERY_CASES.filter((item) => item.origin === "TikZKit math concept coverage");
  const mathConceptCategories = new Set(mathConceptCases.map((item) => item.path.split("/")[1]));

  assert.equal(tikzParts.length, REAL_GALLERY_CASES.length);
  assert.equal(REAL_GALLERY_CASES.length, 163);
  assert.equal(petarVCases.length, 65);
  assert.ok(mathConceptCases.length >= 20);
  assert.ok(mathConceptCategories.size >= 10);
  assert.match(source, /Case 001/);
  assert.match(source, /Case 100/);
  assert.match(source, /Case 163/);
  assert.match(source, /PetarV-\/TikZ/);
  assert.match(source, /Packt GitHub|TikZ\.net|MacTeX tikz-network|MacTeX tikz-3dplot|MacTeX tikz-bagua|MacTeX tikz-bbox|jluttine\/tikz-bayesnet|MacTeX tikz-bpmn|MacTeX tikz-cd|jettan\/tikz_cnn|MacTeX tikz-decofonts|MacTeX tikz-dimline|MacTeX tikz-ext|MacTeX tikz-feynhand|MacTeX tikz-feynman|MacTeX tikz-palattice|MacTeX tikz-qtree|MacTeX tikzquads|MacTeX tikzfxgraph|Izaak Neutelings complex roots|TikZKit calibration|TikZKit math concept coverage/);

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
  assert.ok(origins.has("jluttine/tikz-bayesnet"));
  assert.ok(origins.has("MacTeX tikz-bpmn"));
  assert.ok(origins.has("MacTeX tikz-cd"));
  assert.ok(origins.has("jettan/tikz_cnn"));
  assert.ok(origins.has("MacTeX tikz-decofonts"));
  assert.ok(origins.has("MacTeX tikz-dimline"));
  assert.ok(origins.has("MacTeX tikz-ext"));
  assert.ok(origins.has("MacTeX tikz-feynhand"));
  assert.ok(origins.has("MacTeX tikz-feynman"));
  assert.ok(origins.has("MacTeX tikz-palattice"));
  assert.ok(origins.has("MacTeX tikz-qtree"));
  assert.ok(origins.has("MacTeX tikzquads"));
  assert.ok(origins.has("MacTeX tikzfxgraph"));
  assert.ok(origins.has("Izaak Neutelings complex roots"));
  assert.ok(origins.has("TikZKit calibration"));
  assert.ok(origins.has("TikZKit math concept coverage"));
  assert.equal(REAL_GALLERY_CASES.every((item) => item.sourceUrl.startsWith("https://")), true);
});

test("web sample gallery appends new extension cases without shifting native comparison ids", () => {
  assert.equal(REAL_GALLERY_CASES[110].origin, "MacTeX tikz-bpmn");
  assert.equal(REAL_GALLERY_CASES[111].origin, "MacTeX tikz-cd");
  assert.equal(REAL_GALLERY_CASES[112].origin, "MacTeX tikz-decofonts");
  assert.equal(REAL_GALLERY_CASES.at(-2).origin, "jluttine/tikz-bayesnet");
  assert.equal(REAL_GALLERY_CASES.at(-1).origin, "jettan/tikz_cnn");
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

test("web CSS confines oversized SVG renders to their preview surface", () => {
  const css = readFileSync(new URL("../web/styles.css", import.meta.url), "utf8");

  assert.match(css, /\.svg-surface\s*\{[^}]*overflow:\s*auto/s);
  assert.match(css, /\.svg-surface\s*\{[^}]*max-width:\s*100%/s);
  assert.match(css, /\.svg-surface\s*>\s*svg\s*\{[^}]*max-width:\s*100%/s);
  assert.match(css, /\.case-viewer\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.case-panel\s*\{[^}]*min-width:\s*0/s);
  assert.doesNotMatch(css, /\.svg-surface\s+svg\s*\{/);
});

test("web realtime JS renderer injects the same comparison grid as gallery artifacts", () => {
  const app = readFileSync(new URL("../web/app.js", import.meta.url), "utf8");

  assert.match(app, /import\s+\{\s*withGalleryDebugGrid\s*\}\s+from\s+"..\/scripts\/gallery-debug-grid\.js"/);
  assert.match(app, /withGalleryDebugGrid\(source\)/);
  assert.match(app, /tikzToSvg\(renderSource,\s*options\)/);
  assert.match(app, /formatUnitStatus/);
  assert.match(app, /createUnitMetricsPanel/);
});
