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
