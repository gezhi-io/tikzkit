import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { withGalleryDebugGrid } from "../scripts/gallery-debug-grid.js";
import {
  JS_STANDARD_PX_PER_TIKZ_UNIT,
  NATIVE_RASTER_DPI,
  NATIVE_RASTER_PX_PER_TIKZ_UNIT,
  measureIrGridUnits
} from "../scripts/gallery-unit-metrics.js";

test("measures the one-centimeter comparison grid in JS and native units", () => {
  const source = withGalleryDebugGrid(String.raw`\documentclass[tikz]{standalone}
\begin{document}
\begin{tikzpicture}
  \draw (0,0) -- (2,1);
\end{tikzpicture}
\end{document}`);
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const unit = measureIrGridUnits(result.ir);

  assert.equal(JS_STANDARD_PX_PER_TIKZ_UNIT, 100);
  assert.equal(NATIVE_RASTER_DPI, 144);
  assert.ok(Math.abs(NATIVE_RASTER_PX_PER_TIKZ_UNIT - 56.6929133858) < 1e-9);
  assert.equal(unit.step, "1cm");
  assert.ok(unit.gridLineCount >= 4);
  assert.equal(unit.xTikzUnits, 1);
  assert.equal(unit.yTikzUnits, 1);
  assert.equal(unit.jsSvgPxPerXUnit, 100);
  assert.equal(unit.jsSvgPxPerYUnit, 100);
});
