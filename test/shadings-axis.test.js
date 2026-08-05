import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const AXIS_SHADINGS = String.raw`
\begin{tikzpicture}
  \shade[top color=blue, middle color=white, bottom color=red] (0,0) rectangle (1,1);
  \shade[left color=green, middle color=yellow, right color=purple] (1.2,0) rectangle (2.2,1);
  \shade[top color=cyan, bottom color=orange, shading angle=45] (2.4,0) rectangle (3.4,1);
  \node[draw, top color=black, middle color=gray, bottom color=white] at (4.2,.5) {axis};
\end{tikzpicture}`;

test("maps TikZ axis shading shortcuts to PGF-compatible color stops and angles", () => {
  const result = tikzToSvg(AXIS_SHADINGS);
  const shaded = result.ir.items.filter((item) => item.style?.shading === "axis");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(shaded.length, 4);
  assert.deepEqual(
    shaded.slice(0, 3).map((item) => [item.style.topColor, item.style.middleColor, item.style.bottomColor, item.style.shadingAngle]),
    [
      ["blue", "rgb(128 0 128)", "red", 0],
      ["rgb(0 255 0)", "rgb(96 128 32)", "rgb(191 0 64)", 90],
      ["cyan", "rgb(128 192 128)", "rgb(255 128 0)", 45]
    ]
  );
  assert.deepEqual(
    [shaded[3].style.topColor, shaded[3].style.middleColor, shaded[3].style.bottomColor, shaded[3].style.shadingAngle],
    ["black", "rgb(128 128 128)", "white", 0]
  );
  assert.match(result.svg, /<linearGradient[^>]+x1="50%" y1="100%" x2="50%" y2="0%"[^>]*><stop offset="0%" stop-color="red"[^>]*><stop offset="50%" stop-color="rgb\(128 0 128\)"[^>]*><stop offset="100%" stop-color="blue"/);
  assert.match(result.svg, /<linearGradient[^>]+x1="100%" y1="50%" x2="0%" y2="50%"/);
  assert.match(result.svg, /<linearGradient[^>]+x1="100%" y1="100%" x2="0%" y2="0%"/);
});
