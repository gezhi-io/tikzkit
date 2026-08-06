import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { canvasPlaneSpec } from "../src/tikz/libraries/3d.js";

const SOURCE = readFileSync(new URL("./fixtures/examples/3d/canvas-planes.tex", import.meta.url), "utf8");

test("projects TikZ 3d canvas-plane shortcuts into their documented bases", () => {
  const result = tikzToSvg(SOURCE, { margin: 0, mathRenderer: "svg-text" });
  const circles = result.ir.items.filter((item) => item.shape === "circle");
  const crosses = result.ir.items.filter((item) => item.type === "path" && item.commands?.length === 4);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(circles.length, 3);
  assert.equal(crosses.length, 3);
  assert.equal(
    circles.filter((item) => item.projected).length,
    2,
    "zy and zx planes must use projected cubic paths while xy stays in the default basis"
  );

  const [zy, zx, xy] = circles;
  assert.deepEqual(
    { x: zy.commands[1].x, y: zy.commands[1].y },
    { x: 0, y: 1 },
    "zy plane maps its local y axis to the parent y axis"
  );
  assert.deepEqual(
    { x: zx.commands[1].x, y: zx.commands[1].y },
    { x: 1, y: 0 },
    "zx plane maps its local y axis to the parent x axis"
  );
  assert.equal(Number(xy.commands[0].x.toFixed(6)), 1, "xy plane keeps the default x basis");
  assert.equal(Number(xy.commands[0].y.toFixed(6)), 0, "xy plane keeps the default y basis");
});

test("accepts the generic plane origin/vector form and all six shorthand families", () => {
  const source = String.raw`\usetikzlibrary{3d}
\begin{tikzpicture}
  \begin{scope}[plane origin=(0,0,1),plane x=(1,0,1),plane y=(0,1,1),canvas is plane]
    \draw (0,0) -- (1,0) -- (0,1) -- cycle;
  \end{scope}
\end{tikzpicture}`;
  const result = tikzToSvg(source, { margin: 0 });
  const [path] = result.ir.items;

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path.commands.slice(0, 3), [
    { type: "moveTo", x: -0.385, y: -0.385 },
    { type: "lineTo", x: 0.615, y: -0.385 },
    { type: "lineTo", x: -0.385, y: 0.615 }
  ]);

  const shortcuts = [
    "canvas is xy plane at z",
    "canvas is yx plane at z",
    "canvas is xz plane at y",
    "canvas is zx plane at y",
    "canvas is yz plane at x",
    "canvas is zy plane at x"
  ];
  assert.ok(shortcuts.every((key) => canvasPlaneSpec({ [key]: "2" })), "each documented named plane resolves to a specification");
});
