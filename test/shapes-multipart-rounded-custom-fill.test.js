import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { renderRectangleSplitNodeBox } from "../src/renderers/svg/rectangleSplitNodes.js";

test("rounded rectangle split fills round only their outer corners", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[rectangle split, rectangle split parts=3, rounded corners=10pt, draw,
    rectangle split part fill={red,green,blue}] (vertical)
    {one\nodepart{two}two\nodepart{three}three};
  \node[rectangle split, rectangle split horizontal, rectangle split parts=3,
    rounded corners=10pt, draw, rectangle split part fill={red,green,blue}]
    (horizontal) at (4,0) {one\nodepart{two}two\nodepart{three}three};
  \node[rectangle split, rounded corners=10pt, draw, fill=gray] (ordinary) at (8,0)
    {plain};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const [vertical, horizontal, ordinary] = result.ir.items.filter((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  const verticalSvg = renderRectangleSplitNodeBox(vertical, 100);
  const horizontalSvg = renderRectangleSplitNodeBox(horizontal, 100);
  const ordinarySvg = renderRectangleSplitNodeBox(ordinary, 100);

  assert.equal((verticalSvg.match(/class="tikz-split-part"/g) || []).length, 3);
  assert.equal((horizontalSvg.match(/class="tikz-split-part"/g) || []).length, 3);
  assert.equal((verticalSvg.match(/\bA /g) || []).length, 4);
  assert.equal((horizontalSvg.match(/\bA /g) || []).length, 4);
  assert.equal((verticalSvg.match(/<rect class="tikz-split-part"/g) || []).length, 0);
  assert.match(ordinarySvg, /class="tikz-split-background"[^>]*rx="[1-9]/);
});
