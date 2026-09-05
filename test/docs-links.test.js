import test from "node:test";
import assert from "node:assert/strict";
import {
  findBrokenDocLinks,
  repositoryPathFromPublicUrl
} from "../scripts/check-doc-links.js";

test("public documentation links resolve to repository files", () => {
  assert.deepEqual(findBrokenDocLinks(), []);
});

test("maps public TikZKit GitHub URLs back to tracked repository paths", () => {
  assert.equal(
    repositoryPathFromPublicUrl(
      "https://github.com/gezhi-io/tikzkit/blob/main/docs/images/readme/example.png"
    ),
    "docs/images/readme/example.png"
  );
  assert.equal(
    repositoryPathFromPublicUrl(
      "https://raw.githubusercontent.com/gezhi-io/tikzkit/main/docs/images/readme/example.png"
    ),
    "docs/images/readme/example.png"
  );
  assert.equal(repositoryPathFromPublicUrl("https://example.com/example.png"), null);
});
