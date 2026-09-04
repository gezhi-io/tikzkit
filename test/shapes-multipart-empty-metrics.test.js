import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

const TEX_PT_PER_CM = 28.4527559;
const TEX_EX_PT = 4.30554;

test("uses max rule height and depth for empty horizontal rectangle split parts", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[
    rectangle split,
    rectangle split horizontal,
    rectangle split parts=3,
    rectangle split empty part width=2pt,
    rectangle split empty part height=3ex,
    rectangle split empty part depth=2ex,
    rectangle split part align={base,center,top},
    draw
  ] (parts) {A\nodepart{two}\nodepart{three}C};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "parts");
  const layout = box.shapeData.rectangleSplit;
  const emptyPartHeightPt = layout.partHeights[1] * TEX_PT_PER_CM;
  const emptyPartBaselinePt = layout.parts[1].originY * TEX_PT_PER_CM;

  assert.deepEqual(result.diagnostics, []);
  // PGF appends zero-width rules: the hbox takes the maximum height and
  // depth across them, so 3ex + 2ex (not 1ex + 3ex, and not depth=0).
  assert.ok(
    Math.abs(emptyPartHeightPt - (5 * TEX_EX_PT + 2 * 3.333333)) < 0.15,
    `expected empty part height near ${5 * TEX_EX_PT + 2 * 3.333333}pt, got ${emptyPartHeightPt}pt`
  );
  assert.ok(
    Math.abs(emptyPartBaselinePt - ((2 * TEX_EX_PT - 3 * TEX_EX_PT) / 2)) < 0.1,
    `expected the empty part baseline near ${(2 * TEX_EX_PT - 3 * TEX_EX_PT) / 2}pt, got ${emptyPartBaselinePt}pt`
  );
});

test("accumulates repeated empty-part widths and maximizes repeated heights and depths", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[
    rectangle split,
    rectangle split horizontal,
    rectangle split parts=3,
    rectangle split empty part width=2pt,
    rectangle split empty part width=3pt,
    rectangle split empty part height=.5ex,
    rectangle split empty part height=2ex,
    rectangle split empty part depth=.5ex,
    rectangle split empty part depth=1.5ex,
    inner sep=0pt,
    draw
  ] (parts) {A\nodepart{two}\nodepart{three}C};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "parts");
  const layout = box.shapeData.rectangleSplit;
  const emptyPartWidthPt = layout.partWidths[1] * TEX_PT_PER_CM;
  const emptyPartHeightPt = layout.partHeights[1] * TEX_PT_PER_CM;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(
    Math.abs(emptyPartWidthPt - (TEX_EX_PT + 2 + 3)) < 0.1,
    `expected accumulated width near ${TEX_EX_PT + 5}pt, got ${emptyPartWidthPt}pt`
  );
  assert.ok(
    Math.abs(emptyPartHeightPt - 3.5 * TEX_EX_PT) < 0.15,
    `expected max height plus max depth near ${3.5 * TEX_EX_PT}pt, got ${emptyPartHeightPt}pt`
  );
});

test("preserves repeated empty-part metrics across named styles and local options", () => {
  const result = tikzToSvg(String.raw`
\tikzset{split metrics/.style={
  rectangle split empty part width=2pt,
  rectangle split empty part width=3pt,
  rectangle split empty part height=.5ex
}}
\begin{tikzpicture}
  \node[
    split metrics,
    rectangle split,
    rectangle split horizontal,
    rectangle split parts=3,
    rectangle split empty part width=4pt,
    rectangle split empty part height=2ex,
    inner sep=0pt,
    draw
  ] (parts) {A\nodepart{two}\nodepart{three}C};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "parts");
  const layout = box.shapeData.rectangleSplit;
  const emptyPartWidthPt = layout.partWidths[1] * TEX_PT_PER_CM;
  const emptyPartHeightPt = layout.partHeights[1] * TEX_PT_PER_CM;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(
    Math.abs(emptyPartWidthPt - (TEX_EX_PT + 2 + 3 + 4)) < 0.1,
    `expected style and local widths near ${TEX_EX_PT + 9}pt, got ${emptyPartWidthPt}pt`
  );
  assert.ok(
    Math.abs(emptyPartHeightPt - 2 * TEX_EX_PT) < 0.1,
    `expected repeated height maximum near ${2 * TEX_EX_PT}pt, got ${emptyPartHeightPt}pt`
  );
});
