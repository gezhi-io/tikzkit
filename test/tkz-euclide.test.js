import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { tkzEuclideExtension } from "../src/internal.js";
import { expandTkzEuclide } from "../src/extensions/tkz-euclide.js";
import { collectTexPackages } from "../src/packages/declarations.js";

const FIXTURE_ROOT = new URL("./fixtures/examples/latex-examples/", import.meta.url);

function renderFixture(number) {
  const source = readFileSync(new URL(`geometry-${number}.tex`, FIXTURE_ROOT), "utf8");
  return tikzToSvg(source, { mathRenderer: "svg-text" });
}

function structuralPaths(result) {
  return result.ir.items.filter((item) => item.type === "path" && item.commands.filter((command) => command.type !== "closePath").length >= 2);
}

test("exposes tkz-euclide as a built-in preprocess extension", () => {
  assert.equal(tkzEuclideExtension.name, "tkz-euclide");
  assert.equal(tkzEuclideExtension.phase, "preprocess");
  for (const command of ["tkzDefPoints", "tkzInterLL", "tkzDrawSegments", "tkzDrawPolygon", "tkzMarkAngle", "tkzLabelAngle", "tkzLabelPoint"]) {
    assert.ok(tkzEuclideExtension.commands.includes(command));
  }
  const pkg = collectTexPackages(String.raw`\usepackage{tkz-euclide}`)[0];
  assert.equal(pkg.status, "extension");
  assert.equal(pkg.implementedBy, "src/extensions/tkz-euclide.js");
});

test("expands points, intersections, extended lines, polygons, segments, and labels into ordinary TikZ", () => {
  const diagnostics = [];
  const expanded = expandTkzEuclide(String.raw`
\usepackage{tkz-euclide}
\usetkzobj{all}
\begin{tikzpicture}
  \tkzSetUpPoint[shape=circle,size=10,color=black,fill=black]
  \tkzSetUpLine[line width=1]
  \tkzDefPoints{0/0/A,4/0/B,1/2/C,2/-1/D}
  \tkzInterLL(A,B)(C,D) \tkzGetPoint{I}
  \tkzDrawLine[add=0 and .5](A,I)
  \tkzDrawPolygon[blue](A,B,C)
  \tkzDrawSegments(A,C B,C)
  \tkzDrawPoints(A,B,C,I)
  \tkzLabelPoint[above](I){$I$}
\end{tikzpicture}`,
  diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.doesNotMatch(expanded, /\\(?:usetkzobj|tkz[A-Za-z]+)/);
  assert.match(expanded, /\\coordinate \(tkzPointResult\) at \(1\.6666666667,0\);/);
  assert.match(expanded, /\\coordinate \(I\) at \(tkzPointResult\);/);
  assert.match(expanded, /\\draw\[line width=1pt,[^\]]*\] \(A\) -- \(\$\(I\)!-0\.5!\(A\)\$\);/);
  assert.match(expanded, /\\draw\[line width=1pt,[^\]]*blue[^\]]*,line join=round\] \(A\) -- \(B\) -- \(C\) -- cycle;/);
  assert.match(expanded, /minimum size=10pt/);
  assert.match(expanded, /\\node\[above\] at \(I\) \{\$I\$\};/);
});

test("keeps tkzLabelLine positions outside the segment and renders coordinate-system polygons", () => {
  const source = readFileSync(new URL("coordinate-system-3.tex", FIXTURE_ROOT), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = new Map(
    result.ir.items
      .filter((item) => item.type === "textNode" && item.text)
      .map((item) => [item.text, item])
  );
  const closedPolygons = result.ir.items.filter(
    (item) => item.type === "path" && item.commands.some((command) => command.type === "closePath")
  );

  assert.deepEqual(result.diagnostics, []);
  assert.equal(closedPolygons.length, 2);
  assert.ok(Math.abs(labels.get("$g_1$").x - 3) < 1e-9);
  assert.ok(Math.abs(labels.get("$g_2$").y - 3) < 1e-9);
  assert.deepEqual(result.ir.coordinates.R, { x: 2, y: 3 });
});

test("renders coordinate-system-1 axes, angle mark, and the default point label", () => {
  const source = readFileSync(new URL("coordinate-system-1.tex", FIXTURE_ROOT), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = new Map(
    result.ir.items
      .filter((item) => item.type === "textNode" && item.text)
      .map((item) => [item.text, item])
  );
  const point = result.ir.items.find((item) => item.type === "nodeBox" && item.shape === "circle");
  const axes = structuralPaths(result).filter((item) => item.shape !== "arc");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.P, { x: 2, y: 1 });
  assert.equal(result.ir.items.filter((item) => item.type === "path" && item.shape === "arc").length, 1);
  assert.deepEqual(axes.map((item) => item.commands), [
    [{ type: "moveTo", x: -3, y: 0 }, { type: "lineTo", x: 3, y: 0 }],
    [{ type: "moveTo", x: 0, y: -3 }, { type: "lineTo", x: 0, y: 3 }]
  ]);
  assert.equal(labels.get("$g_1$").x, 3);
  assert.equal(labels.get("$g_2$").y, 3);
  assert.ok(labels.get("$P$").y < point.y);
});

test("renders coordinate-system-2 angle arcs and labels on the normalized bisector", () => {
  const source = readFileSync(new URL("coordinate-system-2.tex", FIXTURE_ROOT), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const angleArc = result.ir.items.find((item) => item.type === "path" && item.shape === "arc");
  const angleLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$\\cdot$");
  const closedPolygon = result.ir.items.find(
    (item) => item.type === "path" && item.commands.some((command) => command.type === "closePath")
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(angleArc);
  assert.equal(angleArc.style.fill, "none");
  assert.equal(angleArc.style.opacity, 0.5);
  assert.deepEqual(angleArc.commands[0], { type: "moveTo", x: 0.3, y: 0 });
  assert.ok(Math.abs(angleArc.commands.at(-1).x) < 1e-9);
  assert.ok(Math.abs(angleArc.commands.at(-1).y - 0.3) < 1e-9);
  assert.ok(angleLabel);
  assert.ok(Math.abs(angleLabel.x - 0.15 / Math.sqrt(2)) < 1e-9);
  assert.ok(Math.abs(angleLabel.y - 0.15 / Math.sqrt(2)) < 1e-9);
  assert.deepEqual(closedPolygon.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 2, y: 0 },
    { type: "lineTo", x: 2, y: 1 },
    { type: "lineTo", x: 0, y: 1 },
    { type: "closePath" }
  ]);
});

test("expands perpendicular lines through ordinary TikZ nodes and explicit-radius arcs", () => {
  const diagnostics = [];
  const expanded = expandTkzEuclide(String.raw`
\usepackage{tkz-euclide}
\begin{tikzpicture}
  \tkzDefPoints{1/1/Z1,2/2/Z2,3/0/A}
  \node (m) at ($(Z1)!0.5!(Z2)$) {};
  \tkzDefLine[perpendicular=through m](Z1,Z2)\tkzGetPoint{c}
  \tkzDrawLine[add=2 and 1,dashed,thick](m,c)
  \tkzDrawArc[R,line width=1pt,color=orange](A,2.24 cm)(0,180)
\end{tikzpicture}`,
  diagnostics);

  assert.deepEqual(diagnostics, []);
  assert.match(expanded, /\\coordinate \(tkzPointResult\) at \(\$\(m\)\+\(-1,1\)\$\);/);
  assert.match(expanded, /\\coordinate \(c\) at \(tkzPointResult\);/);
  assert.match(expanded, /\(\$\(m\)!-2!\(c\)\$\) -- \(\$\(c\)!-1!\(m\)\$\)/);
  assert.match(expanded, /\\draw\[line width=1pt,draw=orange\] \(\$\(A\)\+\(0:2\.24cm\)\$\) arc \(0:180:2\.24cm\);/);
});

test("renders the hyperbolic axiom fixture with points, a perpendicular, and its orange semicircle", () => {
  const source = readFileSync(new URL("hyperbolische-geometrie-axiom-1-2.tex", FIXTURE_ROOT), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const orangePaths = result.ir.items.filter(
    (item) => item.type === "path" && item.shape === "arc" && item.style?.stroke === "rgb(255 128 0)"
  );

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.c, { x: 0.5, y: 2.5 });
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circle").length, 2);
  assert.equal(orangePaths.length, 1);
  assert.equal(orangePaths[0].shape, "arc");
  assert.equal(orangePaths[0].commands.filter((command) => command.type === "curveTo").length, 2);
});

test("renders geometry-3 with its complete point-line-intersection-label structure", () => {
  const result = renderFixture(3);
  const paths = structuralPaths(result);
  const labels = result.ir.items.filter((item) => item.type === "textNode" && item.text).map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.C, { x: 2.2857142857, y: 1.1428571429 });
  assert.equal(paths.length, 5);
  assert.deepEqual(paths[0].commands, [
    { type: "moveTo", x: -0.2, y: -0.4 },
    { type: "lineTo", x: 1.2, y: 2.4 }
  ]);
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox").length, 5);
  for (const label of ["$P$", "$Q$", "$B$", "$C$", "$A$"]) assert.ok(labels.includes(label));
});

test("renders geometry-8 segments and intersections while reporting only unsupported angle variants", () => {
  const result = renderFixture(8);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message);
  const angleArcs = result.ir.items.filter((item) => item.type === "path" && item.shape === "arc");
  const nonAnglePaths = structuralPaths(result).filter((item) => item.shape !== "arc");

  assert.deepEqual(result.ir.coordinates.M, { x: 3, y: 1 });
  assert.equal(nonAnglePaths.length, 7);
  assert.equal(angleArcs.length, 5);
  assert.equal(result.ir.items.filter((item) => item.type === "nodeBox").length, 5);
  assert.deepEqual(messages, [
    "tkz-euclide compatibility currently renders the single unmarked tkzMarkAngle arc"
  ]);
  assert.equal(messages.some((message) => /Unsupported command|Unknown coordinate/.test(message)), false);
});

test("keeps geometry-3 through geometry-9 structurally drawable through the shared subset", () => {
  for (let number = 3; number <= 9; number += 1) {
    const result = renderFixture(number);
    const messages = result.diagnostics.map((diagnostic) => diagnostic.message);

    assert.ok(Object.keys(result.ir.coordinates).length >= 3, `geometry-${number} should define its points`);
    assert.ok(structuralPaths(result).length >= 1, `geometry-${number} should contain structural paths`);
    assert.ok(result.ir.items.some((item) => item.type === "nodeBox"), `geometry-${number} should draw points`);
    assert.equal(
      messages.some((message) => /Unsupported command \\tkz(?:SetUp|DefPoint|InterLL|GetPoint|Draw|LabelPoint|LabelLine|FillPolygon)/.test(message)),
      false,
      `geometry-${number} should not fall back to unsupported diagnostics for the shared subset`
    );
    assert.equal(messages.some((message) => /Unknown coordinate/.test(message)), false, `geometry-${number} should resolve shared points`);
  }
});
