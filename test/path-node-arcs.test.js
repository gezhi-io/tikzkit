import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function textNode(result, text) {
  return result.ir.items.find((item) => item.type === "textNode" && item.text === text);
}

test("arc path nodes use parameter-angle positions instead of the endpoint chord", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw (2,0) arc[start angle=0,end angle=150,radius=2cm]
    node[pos=.25,sloped,anchor=center] {C};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const label = textNode(result, "C");
  const angle = 37.5 * Math.PI / 180;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(label.x - 2 * Math.cos(angle)) < 1e-6, `unexpected arc x ${label.x}`);
  assert.ok(Math.abs(label.y - 2 * Math.sin(angle)) < 1e-6, `unexpected arc y ${label.y}`);
  assert.ok(Math.abs(label.rotation + 52.5) < 1e-6, `unexpected tangent rotation ${label.rotation}`);
});

test("elliptical arc nodes use the two local axes in point and tangent calculations", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw (5,0) arc[start angle=180,end angle=30,x radius=2cm,y radius=1cm]
    node[pos=.6,sloped,anchor=center] {E};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const label = textNode(result, "E");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(label.x - 7) < 1e-6, `unexpected ellipse x ${label.x}`);
  assert.ok(Math.abs(label.y - 1) < 1e-6, `unexpected ellipse y ${label.y}`);
  assert.ok(Math.abs(Number(label.rotation) || 0) < 1e-6, `unexpected ellipse tangent rotation ${label.rotation}`);
});

test("decreasing-angle arcs retain their traversal tangent and upright correction", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw (7,0) arc[start angle=0,end angle=-150,radius=1.5cm]
    node[pos=.4,sloped,anchor=center] {R};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const label = textNode(result, "R");
  const angle = -60 * Math.PI / 180;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(label.x - (5.5 + 1.5 * Math.cos(angle))) < 1e-6, `unexpected reverse arc x ${label.x}`);
  assert.ok(Math.abs(label.y - 1.5 * Math.sin(angle)) < 1e-6, `unexpected reverse arc y ${label.y}`);
  assert.ok(Math.abs(label.rotation - 30) < 1e-6, `unexpected reverse tangent rotation ${label.rotation}`);
});

test("auto and swap offset arc labels on opposite local normals", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[auto]
  \draw (2,0) arc[start angle=0,end angle=120,radius=2cm]
    node[pos=.5,sloped] {A};
  \draw (6,0) arc[start angle=0,end angle=120,radius=2cm]
    node[pos=.5,sloped,swap] {S};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const automatic = textNode(result, "A");
  const swapped = textNode(result, "S");
  const firstCenter = { x: 1, y: Math.sqrt(3) };
  const secondCenter = { x: 5, y: Math.sqrt(3) };

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.hypot(automatic.x, automatic.y) > Math.hypot(firstCenter.x, firstCenter.y));
  assert.ok(Math.hypot(swapped.x - 4, swapped.y) < Math.hypot(secondCenter.x - 4, secondCenter.y));
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the arc path-node ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/paths/arc-node-${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const curvedPaths = result.ir.items.filter(
      (item) => item.type === "path" && item.commands.some((command) => command.type === "curveTo")
    );
    const rotatedLabels = result.ir.items.filter(
      (item) => item.type === "textNode" && Math.abs(Number(item.rotation) || 0) > 5
    );

    assert.deepEqual(result.diagnostics, []);
    assert.ok(curvedPaths.length >= 2, `expected multiple arc paths, got ${curvedPaths.length}`);
    assert.ok(rotatedLabels.length >= 1, `expected a tangent-aligned label, got ${rotatedLabels.length}`);
  });
}

test("the TikZ registry records the arc path-node timer slice", () => {
  const source = readFileSync(new URL("../src/packages/tikz.js", import.meta.url), "utf8");

  assert.match(source, /arcTimerPointAt\/arcTimerTangentAt\/arcTimerAngleAt\/buildArc/);
  assert.match(source, /ellipse-parameter arc path-node pos/);
  assert.match(source, /Arbitrary custom soft-path timers/);
  assert.doesNotMatch(source, /Arc timers, arbitrary custom soft-path timers/);
});
