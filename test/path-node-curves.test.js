import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function textNode(result, text) {
  return result.ir.items.find((item) => item.type === "textNode" && item.text === text);
}

function cubicPointAt(from, c1, c2, to, t) {
  const mt = 1 - t;
  return {
    x: mt ** 3 * from.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * to.x,
    y: mt ** 3 * from.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * to.y
  };
}

test("curve auto nodes choose compass anchors from the local cubic tangent", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[auto]
  \draw (0,0) .. controls (0,3) and (4,3) .. (4,0)
    node[pos=.2] {A}
    node[pos=.8] {B};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const left = textNode(result, "A");
  const right = textNode(result, "B");
  const leftPathPoint = cubicPointAt({ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 0 }, 0.2);
  const rightPathPoint = cubicPointAt({ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 0 }, 0.8);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(left.x < leftPathPoint.x - 0.08, `expected rising-curve auto node left of its path point, got ${left.x}`);
  assert.ok(left.y > leftPathPoint.y, `expected rising-curve auto node above its path point, got ${left.y}`);
  assert.ok(right.x > rightPathPoint.x + 0.08, `expected falling-curve auto node right of its path point, got ${right.x}`);
  assert.ok(right.y > rightPathPoint.y, `expected falling-curve auto node above its path point, got ${right.y}`);
});

test("curve swap and auto=right select the opposite local-tangent anchors", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[auto]
  \draw (0,-1) .. controls (0,-4) and (4,-4) .. (4,-1)
    node[pos=.2,swap] {S}
    node[pos=.8,auto=right] {R};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const left = textNode(result, "S");
  const right = textNode(result, "R");
  const leftPathPoint = cubicPointAt({ x: 0, y: -1 }, { x: 0, y: -4 }, { x: 4, y: -4 }, { x: 4, y: -1 }, 0.2);
  const rightPathPoint = cubicPointAt({ x: 0, y: -1 }, { x: 0, y: -4 }, { x: 4, y: -4 }, { x: 4, y: -1 }, 0.8);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(left.x < leftPathPoint.x - 0.08, `expected swapped falling-curve node left of its path point, got ${left.x}`);
  assert.ok(left.y < leftPathPoint.y, `expected swapped falling-curve node below its path point, got ${left.y}`);
  assert.ok(right.x > rightPathPoint.x + 0.08, `expected auto=right rising-curve node right of its path point, got ${right.x}`);
  assert.ok(right.y < rightPathPoint.y, `expected auto=right rising-curve node below its path point, got ${right.y}`);
});

test("sloped curve nodes retain the local cubic tangent rotation", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw (0,0) .. controls (0,3) and (4,3) .. (4,0)
    node[pos=.2,sloped,above] {T};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const label = textNode(result, "T");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(label.rotation > 50 && label.rotation < 60, `expected local tangent rotation near 54.6 degrees, got ${label.rotation}`);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the curve-auto ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/paths/curve-auto-${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const curves = result.ir.items.filter(
      (item) => item.type === "path" && item.commands.some((command) => command.type === "curveTo")
    );

    assert.deepEqual(result.diagnostics, []);
    assert.ok(curves.length >= 2, `expected multiple cubic paths, got ${curves.length}`);
  });
}

test("records the reviewed curved path-node slice in both extension registries", () => {
  const markdown = readFileSync("docs/extension-registry.md", "utf8");
  const csv = readFileSync("docs/extension-registry.csv", "utf8");

  assert.match(markdown, /derive `auto` from that position's normalized local tangent/);
  assert.match(csv, /derive `auto` from that position's normalized local tangent/);
  assert.match(csv, /resolveAutoInlineNodePoint\/autoInlineNodeAnchor\/inlineNodePathTangent/);
});
