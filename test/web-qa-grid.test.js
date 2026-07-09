import assert from "node:assert/strict";
import test from "node:test";
import { withQaGrid } from "../web/qaGrid.js";

test("QA grid inserts a background pattern at the TikZ origin without changing viewBox", () => {
  const source = '<svg class="tikz-render-svg" viewBox="-10 -20 320 240"><path d="M0 0L100 0"/></svg>';
  const output = withQaGrid(source);
  assert.match(output, /id="tikzkit-qa-grid"/);
  assert.match(output, /width="100" height="100"/);
  assert.match(output, /patternTransform="translate\(0 0\)"/);
  assert.match(output, /viewBox="-10 -20 320 240"/);
  assert.ok(output.indexOf("tikzkit-qa-grid-layer") < output.indexOf("<path"));
});

test("QA grid can be disabled without mutating exported SVG", () => {
  const source = '<svg viewBox="0 0 100 100"></svg>';
  assert.equal(withQaGrid(source, { enabled: false }), source);
});
