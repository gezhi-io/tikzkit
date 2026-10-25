import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

test("PGF RGB shadings convert CMYK colors before interpolation", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \shade[top color=cyan,bottom color=orange] (0,0) rectangle (1,1);
    \shade[ball color=yellow] (2,0) circle (1cm);
  \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  const axis = result.ir.items.find(item => item.style?.shading === "axis").style;
  assert.equal(axis.topColor, "rgb(0 255 255)");
  assert.equal(axis.middleColor, "rgb(128 192 128)");
  assert.match(result.svg, /r="100%" fx="30%" fy="30%"/);
  assert.match(result.svg, /offset="18%" stop-color="rgb\(255 255 64\)"/);
  assert.match(result.svg, /offset="100%" stop-color="black"/);
});

test("rotated axis shading uses PGF's aspect-dependent physical span", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \shade[top color=cyan,bottom color=orange,shading angle=45] (0,0) rectangle (2.2,2);
    \shade[top color=cyan,bottom color=orange,shading angle=45] (3,0) rectangle (5,2);
  \end{tikzpicture}`);
  const gradients = [...result.svg.matchAll(/<linearGradient[^>]*x1="([\d.-]+)%" y1="([\d.-]+)%" x2="([\d.-]+)%" y2="([\d.-]+)%"/g)];
  assert.equal(gradients.length, 2, "different aspect ratios cannot share one rotated gradient");
  for (const [i, width] of [2.2, 2].entries()) {
    const [, x1, y1, x2, y2] = gradients[i].map(Number);
    const dx = (x2 - x1) / 100, dy = (y2 - y1) / 100;
    const span = (width + 2) / 2;
    // pgfshadepath: yscale = (w |sin a| + h |cos a|) / (50bp (|sin a| + |cos a|)).
    assert.ok(Math.abs(dx / (dx * dx + dy * dy) / width + Math.SQRT1_2 / span) < 1e-7);
    assert.ok(Math.abs(dy / (dx * dx + dy * dy) / 2 + Math.SQRT1_2 / span) < 1e-7);
  }
});
