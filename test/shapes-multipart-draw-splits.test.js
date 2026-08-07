import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { renderRectangleSplitNodeBox } from "../src/renderers/svg/rectangleSplitNodes.js";

test("rectangle split draw splits=false preserves part geometry but omits separators", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[rectangle split, rectangle split horizontal, rectangle split parts=3, draw] (shown)
    {one\nodepart{two}two\nodepart{three}three};
  \node[rectangle split, rectangle split horizontal, rectangle split parts=3,
    rectangle split draw splits=false, draw] (hidden) at (0,-1)
    {one\nodepart{two}two\nodepart{three}three};
  \node[rectangle split, rectangle split parts=3,
    rectangle split draw splits=false, draw] (vertical) at (2,0)
    {one\nodepart{two}two\nodepart{three}three};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const [shown, hidden, vertical] = result.ir.items.filter((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(shown.rectangleSplitDrawSplits, true);
  assert.equal(hidden.rectangleSplitDrawSplits, false);
  assert.equal(hidden.parts, shown.parts);
  assert.deepEqual(hidden.partWidths, shown.partWidths);
  assert.equal(hidden.width, shown.width);
  assert.equal(hidden.height, shown.height);
  assert.equal(vertical.rectangleSplitHorizontal, false);
  assert.equal(vertical.rectangleSplitDrawSplits, false);

  const withSplits = renderRectangleSplitNodeBox(shown, 100);
  const withoutSplits = renderRectangleSplitNodeBox(hidden, 100);
  const verticalWithoutSplits = renderRectangleSplitNodeBox(vertical, 100);
  assert.equal((withSplits.match(/tikz-split-separator/g) || []).length, 2);
  assert.equal((withoutSplits.match(/tikz-split-separator/g) || []).length, 0);
  assert.equal((withoutSplits.match(/tikz-split-part/g) || []).length, 0);
  assert.equal((withoutSplits.match(/tikz-split-background/g) || []).length, 1);
  assert.equal((verticalWithoutSplits.match(/tikz-split-separator/g) || []).length, 0);
  assert.equal((verticalWithoutSplits.match(/tikz-split-part/g) || []).length, 0);
  assert.equal((verticalWithoutSplits.match(/tikz-split-background/g) || []).length, 1);
});
