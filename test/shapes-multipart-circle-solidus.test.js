import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { circleSolidusGeometry } from "../src/tikz/libraries/shapes.multipart.js";

function closeTo(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be close to ${expected}`);
}

test("circle solidus geometry follows PGF diagonal box and radius formulas", () => {
  const geometry = circleSolidusGeometry({
    upper: { width: 1.2, height: 0.4, depth: 0.1 },
    lower: { width: 0.8, height: 0.3, depth: 0.05 }
  }, {
    innerXSep: 0.2,
    innerYSep: 0.1,
    lineWidth: 0.02,
    outerXSep: 0.03,
    outerYSep: 0.06,
    midlineOffset: 0.07
  });
  const visibleRadius = 0.7071 * 1.7 + 0.01 + Math.hypot(0.4, 0.2);

  closeTo(geometry.visibleRadius, visibleRadius);
  closeTo(geometry.anchorRadius, visibleRadius + 0.06);
  closeTo(geometry.separatorRadius, visibleRadius - 0.01);
  closeTo(geometry.separatorComponent, 0.437 * (visibleRadius - 0.01));
  closeTo(geometry.anchors.text.x, -(0.85 + 0.3536 * 0.02 + 0.2));
  closeTo(geometry.anchors.lower.x, (0.3 + 0.05 - 0.8) / 2 + (0.7071 - 0.3536) * 0.02 + 0.2);
  closeTo(geometry.anchors.mid.y - geometry.anchors.base.y, 0.07);
  closeTo(geometry.anchors["north east"].x, Math.SQRT1_2 * geometry.anchorRadius);
});

test("circle solidus creates diagonal text boxes and a circular border", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.multipart}
\begin{tikzpicture}
  \node[circle solidus,draw,inner xsep=4pt,inner ysep=3pt,
    minimum size=1.8cm] (state)
    {$q_1$\nodepart{lower}$00$};
  \draw (state.lower) -- (state.east);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const anchorPath = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.shape, "circleSolidus");
  assert.equal(labels.length, 2);
  assert.ok(labels[0].x < box.x && labels[0].y > box.y);
  assert.ok(labels[1].x > box.x && labels[1].y < box.y);
  assert.ok(anchorPath.commands[0].x > box.x);
  assert.ok(anchorPath.commands[0].y < box.y);
  assert.ok(anchorPath.commands.at(-1).x > box.x + box.width / 2);
  closeTo(anchorPath.commands.at(-1).y, box.y);
  assert.match(result.svg, /tikz-node-circle-solidus/);
});

test("circle solidus exposes text, lower, baseline, compass, and numeric anchors", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.multipart}
\begin{tikzpicture}
  \node[circle solidus,draw,outer sep=3pt] (cell)
    {top\nodepart{lower}bottom};
  \draw[red] (cell.base west) -- (cell.base east);
  \draw[blue] (cell.mid west) -- (cell.mid east);
  \draw[green] (cell.north west) -- (cell.south east);
  \draw[orange] (cell.text) -- (cell.lower);
  \draw[purple] (cell.130) -- (cell.-50);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox");
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.shape, "circleSolidus");
  assert.equal(paths.length, 5);
  closeTo(paths[0].commands[0].y, paths[0].commands.at(-1).y);
  closeTo(paths[1].commands[0].y, paths[1].commands.at(-1).y);
  assert.ok(paths[1].commands[0].y > paths[0].commands[0].y);
  assert.ok(paths[2].commands[0].x < box.x && paths[2].commands[0].y > box.y);
  assert.ok(paths[2].commands.at(-1).x > box.x && paths[2].commands.at(-1).y < box.y);
  assert.ok(paths[3].commands[0].x < box.x && paths[3].commands[0].y > box.y);
  assert.ok(paths[3].commands.at(-1).x > paths[3].commands[0].x);
  assert.ok(paths[3].commands.at(-1).y < box.y);
  assert.ok(paths[4].commands[0].x < box.x && paths[4].commands[0].y > box.y);
  assert.ok(paths[4].commands.at(-1).x > box.x && paths[4].commands.at(-1).y < box.y);
});
