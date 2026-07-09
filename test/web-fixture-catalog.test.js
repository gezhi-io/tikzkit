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
  assert.deepEqual(catalog.map((entry) => entry.id), [
    "latex-examples-2048",
    "latex-examples-2d-chi-squared-cdf",
    "latex-examples-2d-chi-squared-pdf",
    "latex-examples-2d-epochs-overfitting",
    "latex-examples-2d-light-bulb",
    "latex-examples-2d-parted-function",
    "latex-examples-2d-x-square-with-circle",
    "latex-examples-3d-cmos-loss-diagram",
    "latex-examples-3d-function-2",
    "latex-examples-3d-function-3",
    "latex-examples-3d-function-4",
    "latex-examples-3d-function-5",
    "latex-examples-3d-function-6",
    "latex-examples-3d-function-7",
    "latex-examples-3d-function-8",
    "latex-examples-3d-function-9",
    "latex-examples-3d-function-continuous",
    "latex-examples-3d-function-semicubical-parabola",
    "latex-examples-3d-gaussian-distribution",
    "latex-examples-3d-gradient-colored",
    "latex-examples-3d-gradient-cos",
    "latex-examples-3d-helix",
    "latex-examples-3d-manhattan-bar-plot",
    "latex-examples-3d-vector",
    "latex-examples-activation-functions",
    "latex-examples-agent-environment-diagram-mdp",
    "latex-examples-agent-environment-diagram-pomdp",
    "latex-examples-agent-environment-diagram-rl",
    "latex-examples-aggregation-blocks",
    "latex-examples-arbelos"
  ]);
  assert.equal(catalog[0].id, "latex-examples-2048");
  assert.equal(catalog.at(-1).id, "latex-examples-arbelos");
  assert.equal(new Set(catalog.map((entry) => entry.id)).size, 30);
  assert.match(catalog[0].sourceUrl, /^\/api\/fixtures\//);
  assert.ok(catalog[0].tikztosvgSvgUrl === null || /^\/artifacts\/tikztosvg-svg\//.test(catalog[0].tikztosvgSvgUrl));
});
