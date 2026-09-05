import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function renderOverlay(axisOptions) {
  return tikzToSvg(String.raw`
\begin{tikzpicture}
  \begin{axis}[width=4cm,height=3cm,xmin=0,xmax=1,ymin=0,ymax=1,enlargelimits=false,${axisOptions}]
    \addplot[blue,thick] coordinates {(-0.2,0.2) (1.2,0.8)};
    \filldraw[red,thick] (axis cs:1,0.5) circle (7pt);
  \end{axis}
\end{tikzpicture}`, { mathRenderer: "svg-text" });
}

function redOverlay(result) {
  return result.ir.items.find((item) => item.type === "path" && item.style?.fill === "red");
}

test("pgfplots default and explicit global clip modes clip ordinary axis overlay paths", () => {
  for (const axisOptions of ["", "clip mode=global"]) {
    const result = renderOverlay(axisOptions);

    assert.deepEqual(result.diagnostics, []);
    assert.ok(redOverlay(result)?.clipRect, `expected a global clip for ${axisOptions || "the default mode"}`);
  }
});

test("pgfplots individual clip mode leaves ordinary axis overlay paths unclipped", () => {
  const result = renderOverlay("clip mode=individual");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(redOverlay(result)?.clipRect, undefined);
});

test("pgfplots clip=false disables global clipping for ordinary axis overlay paths", () => {
  const result = renderOverlay("clip=false,clip mode=global");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(redOverlay(result)?.clipRect, undefined);
});
