import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTransform,
  closePathCommand,
  composeTransforms,
  createEngineContext,
  createPathBuilder,
  curveToCommand,
  evaluateTikzAst,
  identityTransform,
  lineToCommand,
  moveToCommand,
  parseDimension,
  quadToCommand
} from "../src/engine/index.js";
import { parseTikz } from "../src/frontend/index.js";

test("engine layer evaluates ASTs and exposes context, units, path, and transform helpers", () => {
  const parsed = parseTikz(String.raw`\draw (0,0) -- (1,0);`);
  const evaluated = evaluateTikzAst(parsed.ast);
  const context = createEngineContext({ variables: { x: 1 } });
  const path = createPathBuilder().moveTo(0, 0).lineTo(1, 0).build();
  const transform = composeTransforms(identityTransform(), { a: 1, b: 0, c: 0, d: 1, e: 2, f: 3 });

  assert.equal(evaluated.diagnostics.length, 0);
  assert.ok(evaluated.ir.items.some((item) => item.type === "path"));
  assert.equal(context.variables.x, 1);
  assert.equal(path.length, 2);
  assert.deepEqual(moveToCommand({ x: 0, y: 0 }), { type: "moveTo", x: 0, y: 0 });
  assert.deepEqual(lineToCommand(1, 0), { type: "lineTo", x: 1, y: 0 });
  assert.deepEqual(curveToCommand({ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }), {
    type: "curveTo",
    x1: 0,
    y1: 1,
    x2: 1,
    y2: 1,
    x: 1,
    y: 0
  });
  assert.deepEqual(quadToCommand({ x: 0.5, y: 1 }, { x: 1, y: 0 }), {
    type: "quadTo",
    x1: 0.5,
    y1: 1,
    x: 1,
    y: 0
  });
  assert.deepEqual(closePathCommand(), { type: "closePath" });
  assert.deepEqual(applyTransform({ x: 1, y: 1 }, transform), { x: 3, y: 4 });
  assert.equal(Number(parseDimension("1cm").toFixed(6)), 1);
});

test("engine lowers rounded-corners closed polylines into curved scene paths", () => {
  const parsed = parseTikz(String.raw`\begin{tikzpicture}
  \path[draw=blue, fill=blue!15, rounded corners=2pt] (0,0) -- (1.6,0) -- (1.2,1) -- cycle;
\end{tikzpicture}`);
  const evaluated = evaluateTikzAst(parsed.ast);
  const path = evaluated.ir.items.find((item) => item.type === "path");

  assert.equal(evaluated.diagnostics.length, 0);
  assert.ok(path, "expected a scene path");
  assert.ok(path.commands.some((command) => command.type === "curveTo"), "expected rounded corners to insert curve commands");
  assert.equal(path.commands.at(-1).type, "closePath");
});

test("engine lowers encoded raster image paths into scene image primitives", () => {
  const payload = Buffer.from(JSON.stringify({ href: "data:image/svg+xml,%3Csvg%2F%3E" })).toString("base64url");
  const parsed = parseTikz(String.raw`\begin{tikzpicture}
  \path[axis surface raster image=${payload}] (0,0) rectangle (2,1);
\end{tikzpicture}`);
  const evaluated = evaluateTikzAst(parsed.ast);
  const image = evaluated.ir.items.find((item) => item.type === "rasterImage");

  assert.equal(evaluated.diagnostics.length, 0);
  assert.ok(image, "expected a raster image scene item");
  assert.equal(image.x, 0);
  assert.equal(image.y, 0);
  assert.equal(image.width, 2);
  assert.equal(image.height, 1);
  assert.equal(image.href, "data:image/svg+xml,%3Csvg%2F%3E");
});
