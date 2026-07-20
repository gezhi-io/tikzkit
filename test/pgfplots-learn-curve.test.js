import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

function svgDocumentSizePt(svg) {
  const width = Number(svg.match(/\bwidth="([\d.]+)pt"/)?.[1]);
  const height = Number(svg.match(/\bheight="([\d.]+)pt"/)?.[1]);
  return { width, height };
}

test("learn-curve middle axes omit unused right and vertical boundary reserves", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/learn-curve-ml.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(Math.abs(size.width - 376.04) <= 0.25, `expected width near native 376.04pt, got ${size.width}pt`);
  assert.ok(Math.abs(size.height - 199.64) <= 0.25, `expected height near native 199.64pt, got ${size.height}pt`);
});
