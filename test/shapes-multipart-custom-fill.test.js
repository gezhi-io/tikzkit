import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { renderRectangleSplitNodeBox } from "../src/renderers/svg/rectangleSplitNodes.js";

test("rectangle split custom fill follows the PGF boolean toggle and ordinary node fill", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[rectangle split, rectangle split parts=3, draw,
    rectangle split part fill={red,green,blue}] (custom)
    {one\nodepart{two}two\nodepart{three}three};
  \node[rectangle split, rectangle split parts=3, draw, fill=yellow,
    rectangle split part fill={red,green,blue}, rectangle split uses custom fill=false] (fallback) at (3,0)
    {one\nodepart{two}two\nodepart{three}three};
  \node[rectangle split, rectangle split parts=3, draw, fill=gray] (plain) at (6,0)
    {one\nodepart{two}two\nodepart{three}three};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const [custom, fallback, plain] = result.ir.items.filter((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(custom.rectangleSplitUsesCustomFill, true);
  assert.deepEqual(custom.partFills, ["red", "rgb(0 255 0)", "blue"]);
  assert.equal(fallback.rectangleSplitUsesCustomFill, false);
  assert.equal(fallback.partFills, undefined);
  assert.equal(plain.rectangleSplitUsesCustomFill, false);

  const customSvg = renderRectangleSplitNodeBox(custom, 100);
  const fallbackSvg = renderRectangleSplitNodeBox(fallback, 100);
  const plainSvg = renderRectangleSplitNodeBox(plain, 100);
  assert.equal((customSvg.match(/tikz-split-part/g) || []).length, 3);
  assert.equal((customSvg.match(/tikz-split-background/g) || []).length, 0);
  assert.equal((fallbackSvg.match(/tikz-split-part/g) || []).length, 0);
  assert.equal((fallbackSvg.match(/tikz-split-background/g) || []).length, 1);
  assert.match(fallbackSvg, /fill="rgb\(255 242 0\)"/);
  assert.equal((plainSvg.match(/tikz-split-part/g) || []).length, 0);
  assert.match(plainSvg, /fill="gray"/);
});
