import test from "node:test";
import assert from "node:assert/strict";
import { findBrokenDocLinks } from "../scripts/check-doc-links.js";

test("public documentation links resolve to repository files", () => {
  assert.deepEqual(findBrokenDocLinks(), []);
});
