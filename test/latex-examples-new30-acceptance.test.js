import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const FIXTURE_ROOT = new URL("./fixtures/examples/latex-examples/", import.meta.url);
const MAX_BBOX_DELTA_PT = 1.5;

const CASES = [
  ["flowchart", 452.25, 210.33],
  ["knot-trefoil", 147.209, 127.753],
  ["koch-snowflake", 275.24, 329.16],
  ["landtagswahlen-in-bayern", 518.34, 217.96],
  ["lda-gauss-1", 359.63, 216.4],
  ["lda-gauss-2", 359.63, 216.4],
  ["lda-gauss-intervariance", 359.63, 216.4],
  ["lda-gauss-intervariance-big", 359.63, 216.4],
  ["lda-gauss-variance-big", 359.63, 216.4],
  ["lda-gauss-variance-small", 359.63, 216.4],
  ["learn-curve-ml", 376.04, 199.64],
  ["liftung-torus-r", 417.03, 211.67],
  ["line-chart-electric-vehicles-sold", 389.57, 264.3],
  ["line-reflection", 249.48, 298.11],
  ["line-segments-bounding-box", 135.24, 163.59],
  ["line-segments-f1", 220.28, 220.28],
  ["line-segments-f2", 177.76, 170.68],
  ["line-segments-f3", 78.55, 106.9],
  ["line-segments-f4", 106.9, 78.55],
  ["line-segments-f5", 191.94, 191.94],
  ["line-segments-f6", 78.55, 78.55],
  ["line-segments-f7", 135.24, 78.55],
  ["line-segments-f8", 163.59, 135.24],
  ["line-segments-t2", 248.63, 163.59],
  ["line-segments-t3", 78.55, 78.55],
  ["line-segments-t4", 78.55, 135.24],
  ["line-segments-t5", 163.59, 163.59],
  ["line-segments-t6", 220.28, 163.59],
  ["linear-functions", 182.33, 182.34],
  ["lines-intersections", 652.37, 255.52]
];

const BAVARIA_CSV = readFileSync(
  new URL("./fixtures/examples/latex-examples/resources/landtagswahlen-in-bayern/landtagswahlen-in-bayern.csv", import.meta.url),
  "utf8"
);

function svgDimensions(svg) {
  const root = String(svg).match(/<svg\b[^>]*\bwidth="([0-9.]+)pt"[^>]*\bheight="([0-9.]+)pt"/);
  assert.ok(root, "expected an SVG root with point dimensions");
  return { width: Number(root[1]), height: Number(root[2]) };
}

test("the selected 30 LaTeX-examples cases keep their native visual canvas contract", async (t) => {
  assert.equal(CASES.length, 30);

  for (const [name, expectedWidth, expectedHeight] of CASES) {
    await t.test(name, () => {
      const source = readFileSync(new URL(`${name}.tex`, FIXTURE_ROOT), "utf8");
      const result = tikzToSvg(source, {
        margin: 0,
        mathRenderer: "svg-text",
        pgfplotsTableResolver: (fileName) => fileName === "landtagswahlen-in-bayern.csv" ? BAVARIA_CSV : undefined
      });
      const dimensions = svgDimensions(result.svg);

      assert.deepEqual(result.diagnostics, [], `${name} should render without diagnostics`);
      assert.ok(
        Math.abs(dimensions.width - expectedWidth) <= MAX_BBOX_DELTA_PT,
        `${name} width ${dimensions.width}pt differs from native ${expectedWidth}pt`
      );
      assert.ok(
        Math.abs(dimensions.height - expectedHeight) <= MAX_BBOX_DELTA_PT,
        `${name} height ${dimensions.height}pt differs from native ${expectedHeight}pt`
      );
      assert.match(result.svg, /<svg class="tikz-render-svg"/);
    });
  }
});
