import assert from "node:assert/strict";
import test from "node:test";
import { buildGateMetrics, loadFontGateSource, measureVisibleBox } from "../scripts/render-font-visual-gates.js";

test("font visual gate manifest sources resolve to complete TeX documents", async () => {
  const activation = await loadFontGateSource({ id: "activation", sourceId: "latex-examples-activation-functions" });
  const circuit = await loadFontGateSource({
    id: "circuit",
    source: "test/fixtures/font-visual-gates/circuitikz-labels.tex"
  });
  assert.match(activation, /\\begin\{axis\}/);
  assert.match(circuit, /\\usepackage\[siunitx,RPvoltages\]\{circuitikz\}/);
});

test("font visual gates measure physical visible boxes and anchor offsets", () => {
  const image = rgbaImage(6, 4, [[2, 1], [3, 1], [2, 2], [3, 2]]);
  assert.deepEqual(measureVisibleBox(image), {
    canvasPt: { width: 4.5, height: 3 },
    visibleBoxPt: { x: 1.5, y: 0.75, width: 1.5, height: 1.5 },
    anchorFromCanvasCenterPt: { x: 0, y: 0 }
  });
});

test("font visual gates enforce visible-box and anchor tolerances", () => {
  const native = rgbaImage(10, 10, [[4, 4], [5, 4], [4, 5], [5, 5]]);
  const matching = rgbaImage(10, 10, [[4, 4], [5, 4], [4, 5], [5, 5]]);
  const shifted = rgbaImage(10, 10, [[7, 4], [8, 4], [7, 5], [8, 5]]);
  assert.equal(buildGateMetrics({ native, tikztosvg: matching, tikzkit: matching }, { visibleBoxPt: 1, anchorPt: 1 }).status, "pass");
  assert.equal(buildGateMetrics({ native, tikztosvg: matching, tikzkit: shifted }, { visibleBoxPt: 1, anchorPt: 1 }).status, "review");
});

function rgbaImage(width, height, darkPixels) {
  const data = Buffer.alloc(width * height * 4, 255);
  for (const [x, y] of darkPixels) {
    const index = (y * width + x) * 4;
    data[index] = 0;
    data[index + 1] = 0;
    data[index + 2] = 0;
  }
  return { width, height, data };
}
