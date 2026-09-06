import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { parseDimension } from "../src/engine/math.js";

function svgDocumentSizePt(svg) {
  return {
    width: Number(svg.match(/\bwidth="([\d.]+)pt"/)?.[1]),
    height: Number(svg.match(/\bheight="([\d.]+)pt"/)?.[1])
  };
}

test("PGFPlots data paths use the plot rectangle as their SVG clip", () => {
  const source = String.raw`
    \begin{tikzpicture}
      \begin{axis}[axis lines=middle,width=8cm,height=8cm,xmin=-5,xmax=5,ymin=-5,ymax=5,enlargelimits=false]
        \addplot[domain=-5:5,ultra thick] {x};
      \end{axis}
    \end{tikzpicture}`;
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });

  assert.match(result.svg, /<clipPath id="tikzkit-[\da-f]{16}-tikzkit-clip-/);
  assert.match(result.svg, /<g clip-path="url\(#tikzkit-[\da-f]{16}-tikzkit-clip-/);
});

test("interior middle axes use PGFPlots' 45pt plot-box reserve", () => {
  const geometry = createAxisGeometry(
    { "axis x line": "middle", "axis y line": "middle", width: "8cm", height: "8cm", enlargelimits: "false" },
    { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }
  );
  const expected = 8 - parseDimension("45pt", {});

  assert.ok(Math.abs(geometry.width - expected) < 1e-9);
  assert.ok(Math.abs(geometry.height - expected) < 1e-9);
});

test("linear-functions plot keeps the native clipped physical frame", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/linear-functions.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(Math.abs(size.width - 182.33) <= 0.25, `expected width near native 182.33pt, got ${size.width}pt`);
  assert.ok(Math.abs(size.height - 182.34) <= 0.25, `expected height near native 182.34pt, got ${size.height}pt`);
});
