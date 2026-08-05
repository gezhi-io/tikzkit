import test from "node:test";
import assert from "node:assert/strict";
import { loadFixtureCorpus } from "../scripts/gallery-case-source.js";

test("loads the maintained fixture manifest as the gallery fallback", async () => {
  const gallery = await loadFixtureCorpus();

  assert.equal(gallery.id, "fixture-core");
  assert.equal(gallery.available, true);
  assert.ok(gallery.cases.length >= 200);
  const triangle = gallery.cases.find((entry) => entry.id === "latex-examples-interiour-exteriour-angles-triangle");
  assert.ok(triangle);
  assert.match(triangle.source, /\\tkzMarkAngle\[arc=lll/);
});
