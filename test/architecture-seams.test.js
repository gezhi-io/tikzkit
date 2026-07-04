import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz } from "../src/frontend/index.js";
import { evaluateTikzAst, registerCoreTikz } from "../src/engine/index.js";
import { renderSvg } from "../src/renderers/svg/index.js";
import { appendSceneItem, createSceneGraph, sceneItems } from "../src/scene/index.js";
import { createAxisModel } from "../src/pgfplots/index.js";

test("exposes compiler-style frontend, engine, scene, and svg renderer seams", () => {
  const parsed = parseTikz(String.raw`
\begin{tikzpicture}
  \draw (0,0) -- (1,0);
\end{tikzpicture}`);
  const evaluated = evaluateTikzAst(parsed.ast);
  const svg = renderSvg(evaluated.ir);

  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(evaluated.diagnostics.length, 0);
  assert.match(svg, /<svg class="tikz-render-svg"/);
});

test("registers core TikZ commands and libraries behind a registry seam", () => {
  const registry = registerCoreTikz();

  assert.equal(registry.getCommand("draw").name, "draw");
  assert.equal(registry.getCommand("axis").kind, "environment");
  assert.equal(registry.getLibrary("calc").status, "builtin");
  assert.equal(registry.getLibrary("positioning").status, "builtin");
});

test("scene graph seam owns renderer-neutral drawing items", () => {
  const scene = createSceneGraph();
  appendSceneItem(scene, { type: "path", commands: [] });

  assert.equal(scene.type, "drawing");
  assert.equal(sceneItems(scene).length, 1);
});

test("pgfplots exposes an axis model seam before SceneGraph rendering", () => {
  const axis = createAxisModel({
    ranges: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    geometry: { origin: { x: 0, y: 0 }, width: 2, height: 3 }
  });

  assert.equal(axis.type, "Axis");
  assert.deepEqual(axis.dataToCanvas.mapPoint({ x: 1, y: 1 }), { x: 2, y: 3 });
});
