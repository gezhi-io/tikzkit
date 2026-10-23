import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function render(body) {
  const result = tikzToSvg(`\\begin{tikzpicture}${body}\\end{tikzpicture}`, { margin: 0 });
  assert.deepEqual(result.diagnostics, []);
  const [, width, height] = result.svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/);
  return { ...result, width: Number(width), height: Number(height) };
}

test("an inline label does not remove the native half-line-width bounds", () => {
  // Local pgfcorepathusage.code.tex expands the original stroked path before
  // arrow shortening. The native probe gives 60.90549 TeX pt = 60.67795 bp.
  const plain = render(String.raw`\draw[line width=4pt] (0,0) -- (2,0);`);
  const labelled = render(String.raw`\draw[line width=4pt] (0,0) -- node[above] {$x$} (2,0);`);
  assert.equal(labelled.width, plain.width);
  assert.ok(Math.abs(labelled.width - 60.90549 * 72 / 72.27) < 0.01);
});

test("an empty inline node does not collapse a stroked path's height", () => {
  const plain = render(String.raw`\draw[line width=4pt] (0,0) -- (2,0);`);
  const empty = render(String.raw`\draw[line width=4pt] (0,0) -- node[inner sep=0pt] {} (2,0);`);
  assert.equal(empty.width, plain.width);
  assert.equal(empty.height, plain.height);
  assert.ok(Math.abs(empty.height - 4 * 72 / 72.27) < 0.01);
});

test("filled but unstroked paths retain their original geometric bounds", () => {
  const result = render(String.raw`\fill (0,0) rectangle (2,1) node[midway] {$x$};`);
  assert.ok(Math.abs(result.width - 2 * 72 / 2.54) < 0.01);
  assert.ok(Math.abs(result.height - 72 / 2.54) < 0.01);
});
