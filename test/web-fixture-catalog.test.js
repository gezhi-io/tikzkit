import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadMilestoneCatalog } from "../web/fixtureCatalog.js";

test("workbench catalog freezes the accepted 30 real cases in order", async () => {
  const catalog = await loadMilestoneCatalog({
    fixtureRoot: path.resolve("test/fixtures/examples"),
    outputRoot: path.resolve("test/fixtures/examples/output")
  });

  assert.equal(catalog.length, 30);
  assert.equal(catalog[0].id, "latex-examples-2048");
  assert.equal(catalog.at(-1).id, "latex-examples-arbelos");
  assert.equal(new Set(catalog.map((entry) => entry.id)).size, 30);
  assert.match(catalog[0].sourceUrl, /^\/api\/fixtures\//);
  assert.ok(catalog[0].tikztosvgSvgUrl === null || /^\/artifacts\/tikztosvg-svg\//.test(catalog[0].tikztosvgSvgUrl));
});
