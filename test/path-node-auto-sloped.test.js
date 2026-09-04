import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function textNode(result, text) {
  return result.ir.items.find((item) => item.type === "textNode" && item.text === text);
}

function signedNormalOffset(point, label, tangent) {
  return tangent.x * (label.y - point.y) - tangent.y * (label.x - point.x);
}

test("auto and sloped offset a forward line label along its local normal", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[auto]
  \draw (0,0) -- node[pos=.35,sloped] {F} (3,2);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const label = textNode(result, "F");
  const point = { x: 1.05, y: 0.7 };
  const length = Math.hypot(3, 2);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(signedNormalOffset(point, label, { x: 3 / length, y: 2 / length }) > 0.1);
  assert.ok(label.rotation > 33 && label.rotation < 34);
});

test("upright correction controls the visual side for a reversed sloped label", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[auto]
  \draw (3,-1) -- node[pos=.35,sloped] {R} (0,-3);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const label = textNode(result, "R");
  const point = { x: 1.95, y: -1.7 };
  const length = Math.hypot(3, 2);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(signedNormalOffset(point, label, { x: 3 / length, y: 2 / length }) > 0.1);
  assert.ok(label.rotation > 33 && label.rotation < 34);
});

test("auto and sloped use the active orthogonal leg at each timer half", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[auto]
  \draw (0,0) |- node[pos=.25,sloped] {V} (3,2);
  \draw (4,0) -| node[pos=.75,sloped] {W} (7,2);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const verticalFirst = textNode(result, "V");
  const verticalSecond = textNode(result, "W");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(verticalFirst.x < -0.1, `expected V left of the first vertical leg, got ${verticalFirst.x}`);
  assert.ok(verticalFirst.y > 0.9 && verticalFirst.y < 1.1);
  assert.ok(verticalSecond.x < 6.9, `expected W left of the second vertical leg, got ${verticalSecond.x}`);
  assert.ok(verticalSecond.y > 0.9 && verticalSecond.y < 1.1);
});

test("swap and auto=right select the opposite sloped local anchor", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[auto]
  \draw (0,0) |- node[pos=.75,sloped,swap] {S} (3,2);
  \draw (4,0) -| node[pos=.25,sloped,auto=right] {A} (7,2);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const swapped = textNode(result, "S");
  const autoRight = textNode(result, "A");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(swapped.y < 1.9, `expected S below the horizontal leg, got ${swapped.y}`);
  assert.ok(autoRight.y < -0.1, `expected A below the horizontal leg, got ${autoRight.y}`);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the auto-sloped ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/paths/auto-sloped-${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const rotatedLabels = result.ir.items.filter(
      (item) => item.type === "textNode" && Math.abs(Number(item.rotation) || 0) > 45
    );

    assert.deepEqual(result.diagnostics, []);
    assert.ok(rotatedLabels.length >= 2, `expected multiple vertical sloped labels, got ${rotatedLabels.length}`);
  });
}

test("registry records the combined auto and sloped path-node implementation", () => {
  const registry = readFileSync(new URL("../docs/extension-registry.md", import.meta.url), "utf8");

  assert.match(registry, /combined `auto` plus `sloped` ordering/);
  assert.match(registry, /autoInlineNodeUsesOppositeAnchor\/resolveSlopedInlineNodePoint/);
});
