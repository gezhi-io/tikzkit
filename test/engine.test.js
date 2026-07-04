import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTransform,
  composeTransforms,
  createEngineContext,
  createPathBuilder,
  evaluateTikzAst,
  identityTransform,
  parseDimension
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
  assert.deepEqual(applyTransform({ x: 1, y: 1 }, transform), { x: 3, y: 4 });
  assert.equal(Number(parseDimension("1cm").toFixed(6)), 1);
});
