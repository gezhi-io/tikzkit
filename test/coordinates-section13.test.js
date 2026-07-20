import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function expectClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} to be close to ${expected}`);
}

test("distinguishes xyz factors from canvas dimensions in implicit coordinates", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[x=2cm,y=3cm]
  \draw (0,0) -- (1,1) -- (1cm,1cm) -- (1,1cm) -- (1cm,1);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 2, y: 3 },
    { type: "lineTo", x: 1, y: 1 },
    { type: "lineTo", x: 2, y: 1 },
    { type: "lineTo", x: 1, y: 3 }
  ]);
});

test("treats dimensionless terms inside dimensional coordinate components as pt", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw (0,0) -- (2+3cm,-5mm+2pt);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(path.commands[1].x - (3 + 2 / 28.4527559)) < 1e-9, `unexpected x: ${path.commands[1].x}`);
  assert.ok(Math.abs(path.commands[1].y - (-0.5 + 2 / 28.4527559)) < 1e-9, `unexpected y: ${path.commands[1].y}`);
});

test("interprets dimensionless polar coordinates in the current xyz basis", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[x={(0cm,1cm)},y={(-1cm,0cm)}]
  \draw (0,0) -- (0:1) -- (90:1);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 0, y: 1 },
    { type: "lineTo", x: -1, y: 0 }
  ]);
});

test("supports elliptical implicit polar coordinates in canvas and xyz bases", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[x={(0cm,1cm)},y={(-2cm,0cm)}]
  \coordinate (Canvas) at (30:1cm and 2cm);
  \coordinate (Basis) at (30:1 and 2);
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  expectClose(result.ir.coordinates.Canvas.x, Math.cos(Math.PI / 6), 1e-6);
  expectClose(result.ir.coordinates.Canvas.y, 1, 1e-6);
  expectClose(result.ir.coordinates.Basis.x, -2, 1e-6);
  expectClose(result.ir.coordinates.Basis.y, Math.cos(Math.PI / 6), 1e-6);
});

test("supports common explicit coordinate systems from section 13", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[x=2cm,y=3cm,z={(1cm,1cm)}]
  \draw (canvas cs:x=1cm,y=2mm)
     -- (xyz cs:x=1,y=1,z=1)
     -- (canvas polar cs:angle=90,radius=1cm)
     -- (xyz polar cs:angle=90,radius=1);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 1, y: 0.2 },
    { type: "lineTo", x: 3, y: 4 },
    { type: "lineTo", x: 0, y: 1 },
    { type: "lineTo", x: 0, y: 3 }
  ]);
});

test("uses PGF's default z vector for implicit and xyz coordinates", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw (0,0,0) -- (0,0,1) -- (xyz cs:z=2);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: -0.385, y: -0.385 },
    { type: "lineTo", x: -0.77, y: -0.77 }
  ]);
});

test("maps a scalar z basis to TikZ's diagonal z vector", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[z=2cm]
  \draw (0,0,0) -- (0,0,1);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 2, y: 2 }
  ]);
});

test("does not reapply the picture transform to explicit node coordinates", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[scale=2]
  \node (A) at (1,0) {A};
  \draw (0,0) -- (node cs:name=A,anchor=center);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 2, y: 0 }
  ]);
});

test("clips an anchorless explicit node coordinate to the node border", () => {
  const implicit = tikzToSvg(String.raw`
\begin{tikzpicture}[scale=2]
  \node[circle,draw,minimum size=1cm] (A) at (0,0) {};
  \node[circle,draw,minimum size=1cm] (B) at (3,0) {};
  \draw (A) -- (B);
\end{tikzpicture}`);
  const explicit = tikzToSvg(String.raw`
\begin{tikzpicture}[scale=2]
  \node[circle,draw,minimum size=1cm] (A) at (0,0) {};
  \node[circle,draw,minimum size=1cm] (B) at (3,0) {};
  \draw (node cs:name=A) -- (node cs:name=B);
\end{tikzpicture}`);
  const implicitLine = implicit.ir.items.filter((item) => item.type === "path").at(-1);
  const explicitLine = explicit.ir.items.filter((item) => item.type === "path").at(-1);

  assert.deepEqual(implicit.diagnostics, []);
  assert.deepEqual(explicit.diagnostics, []);
  assert.deepEqual(explicitLine.commands, implicitLine.commands);
  assert.ok(explicitLine.commands[0].x > 0, "the line should leave A at its east border");
  assert.ok(explicitLine.commands[1].x < 6, "the line should enter B at its west border");
});

test("keeps an explicit node anchor at the requested point", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[scale=2]
  \node[circle,draw,minimum size=1cm] (A) at (1,0) {};
  \draw (node cs:name=A,anchor=center) -- (4,0);
\end{tikzpicture}`);
  const line = result.ir.items.filter((item) => item.type === "path").at(-1);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(line.commands[0], { type: "moveTo", x: 2, y: 0 });
});

test("keeps single-plus coordinates relative to the last updated point", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw (1,1) -- +(1,0) -- +(0,1) -- ++(2,0) -- +(0,2);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 1, y: 1 },
    { type: "lineTo", x: 2, y: 1 },
    { type: "lineTo", x: 1, y: 2 },
    { type: "lineTo", x: 3, y: 1 },
    { type: "lineTo", x: 3, y: 3 }
  ]);
});

test("applies the full picture transform to relative coordinate vectors", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[rotate=90]
  \draw (1,0) -- ++(1,0) -- +(0,1);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  expectClose(path.commands[0].x, 0, 1e-6);
  expectClose(path.commands[0].y, 1, 1e-6);
  expectClose(path.commands[1].x, 0, 1e-6);
  expectClose(path.commands[1].y, 2, 1e-6);
  expectClose(path.commands[2].x, -1, 1e-6);
  expectClose(path.commands[2].y, 2, 1e-6);
});

test("uses TikZ's special relative-coordinate rules for Bezier curves", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[rotate=90]
  \draw (1,0) .. controls +(1,0) and +(0,1) .. +(2,0);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");
  const curve = path.commands[1];

  assert.deepEqual(result.diagnostics, []);
  expectClose(curve.x1, 0, 1e-6);
  expectClose(curve.y1, 2, 1e-6);
  expectClose(curve.x2, -1, 1e-6);
  expectClose(curve.y2, 3, 1e-6);
  expectClose(curve.x, 0, 1e-6);
  expectClose(curve.y, 3, 1e-6);
});

test("keeps grid lines in the same affine coordinate space as paths", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[rotate=30]
  \draw[step=1cm] (0,0) grid (2,2);
\end{tikzpicture}`);
  const grid = result.ir.items.filter((item) => item.subtype === "grid-line");
  const directions = grid.map((line) => ({
    x: line.commands[1].x - line.commands[0].x,
    y: line.commands[1].y - line.commands[0].y
  }));

  assert.deepEqual(result.diagnostics, []);
  assert.equal(grid.length, 6);
  assert.ok(directions.some((vector) => Math.abs(Math.atan2(vector.y, vector.x) * 180 / Math.PI - 30) < 1e-6));
  assert.ok(directions.some((vector) => Math.abs(Math.atan2(vector.y, vector.x) * 180 / Math.PI - 120) < 1e-6));
});

test("keeps calc offsets in the correct basis or canvas coordinate space", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{calc}
\begin{tikzpicture}[x=2cm,y=3cm,scale=2]
  \coordinate (A) at (1,1);
  \draw (A)
    -- ($(A)+(1,0)$)
    -- ($(A)+(1cm,0cm)$)
    -- ($(A)+(0:1)$)
    -- ($(A)+(0:1cm)$);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 4, y: 6 },
    { type: "lineTo", x: 8, y: 6 },
    { type: "lineTo", x: 6, y: 6 },
    { type: "lineTo", x: 8, y: 6 },
    { type: "lineTo", x: 6, y: 6 }
  ]);
});

test("computes barycentric coordinates from transformed node centers", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[scale=2]
  \coordinate (A) at (0,0);
  \coordinate (B) at (3,0);
  \coordinate (C) at (0,3);
  \fill (barycentric cs:A=1,B=2,C=3) circle (1pt);
\end{tikzpicture}`);
  const circle = result.ir.items.find((item) => item.type === "path");
  const start = circle.commands[0];

  assert.deepEqual(result.diagnostics, []);
  expectClose(start.x, 2 + 2 / 28.4527559);
  expectClose(start.y, 3);
});

test("computes both tangent coordinate solutions for circle nodes", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{calc}
\begin{tikzpicture}
  \node[circle,draw,minimum size=2cm] (C) at (0,0) {};
  \coordinate (P) at (3,0);
  \coordinate (T1) at (tangent cs:node=C,point={(P)},solution=1);
  \coordinate (T2) at (tangent cs:node=C,point={(P)},solution=2);
\end{tikzpicture}`);
  const circle = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "C");
  const center = result.ir.coordinates.C;
  const external = result.ir.coordinates.P;
  const first = result.ir.coordinates.T1;
  const second = result.ir.coordinates.T2;
  const radius = Math.max(circle.width, circle.height) / 2;
  const firstRadius = Math.hypot(first.x - center.x, first.y - center.y);
  const secondRadius = Math.hypot(second.x - center.x, second.y - center.y);

  assert.deepEqual(result.diagnostics, []);
  expectClose(firstRadius, radius + 0.2 / 28.4527559, 1e-8);
  expectClose(secondRadius, firstRadius, 1e-8);
  expectClose((first.x - center.x) * (external.x - first.x) + (first.y - center.y) * (external.y - first.y), 0, 1e-8);
  expectClose((second.x - center.x) * (external.x - second.x) + (second.y - center.y) * (external.y - second.y), 0, 1e-8);
  assert.ok(first.y > center.y, "solution 1 should be the counter-clockwise tangent");
  assert.ok(second.y < center.y, "solution 2 should be the clockwise tangent");
});

test("supports the explicit perpendicular coordinate system in canvas space", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[x={(0cm,2cm)},y={(3cm,0cm)}]
  \coordinate (A) at (1,2);
  \coordinate (B) at (3,4);
  \coordinate (P) at (perpendicular cs:
    horizontal line through={(A)},
    vertical line through={(B)});
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.A, { x: 6, y: 2 });
  assert.deepEqual(result.ir.coordinates.B, { x: 12, y: 6 });
  assert.deepEqual(result.ir.coordinates.P, { x: 12, y: 2 });
});

test("supports calc distance, rotation, projection, and repeated modifiers", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{calc}
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (4,0);
  \coordinate (C) at (3,2);
  \coordinate (Half) at ($(A)!.5!(B)$);
  \coordinate (Distance) at ($(A)!1cm!(B)$);
  \coordinate (Rotated) at ($(A)!.5!90:(B)$);
  \coordinate (Foot) at ($(A)!(C)!(B)$);
  \coordinate (Repeated) at ($(A)!.5!(B)!.5!(C)$);
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.ir.coordinates.Half, { x: 2, y: 0 });
  assert.deepEqual(result.ir.coordinates.Distance, { x: 1, y: 0 });
  assert.deepEqual(result.ir.coordinates.Rotated, { x: 0, y: 2 });
  assert.deepEqual(result.ir.coordinates.Foot, { x: 3, y: 0 });
  assert.deepEqual(result.ir.coordinates.Repeated, { x: 2.5, y: 1 });
});

test("turns path coordinates relative to the incoming tangent", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw (0,0) -- (1,1) -- ([turn]-45:1cm) -- ([turn]-30:1cm);
  \draw (0,0) -| (2,1) -- ([turn]1,1);
  \draw (0,0) .. controls (0,1) and (1,1) .. (1,0) -- ([turn]0:1cm);
\end{tikzpicture}`);
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  expectClose(paths[0].commands[2].x, 2);
  expectClose(paths[0].commands[2].y, 1);
  expectClose(paths[0].commands[3].x, 2 + Math.cos(Math.PI / 6));
  expectClose(paths[0].commands[3].y, 1 - Math.sin(Math.PI / 6));
  expectClose(paths[1].commands.at(-1).x, 1);
  expectClose(paths[1].commands.at(-1).y, 2);
  expectClose(paths[2].commands.at(-1).x, 1);
  expectClose(paths[2].commands.at(-1).y, -1);
});

test("distinguishes pgfpointxy basis factors from pgfpoint canvas dimensions", () => {
  const result = tikzToSvg(String.raw`
\tikzdeclarecoordinatesystem{basis point}{\pgfpointxy{#1}{1}}
\tikzdeclarecoordinatesystem{canvas point}{\pgfpoint{#1cm}{2cm}}
\begin{tikzpicture}[x=3cm,y=4cm,scale=2]
  \draw (basis point cs:2) -- (canvas point cs:1);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 12, y: 8 },
    { type: "lineTo", x: 2, y: 4 }
  ]);
});

test("applies the current linear transform to coordinate option shifts", () => {
  const scaled = tikzToSvg(String.raw`
\begin{tikzpicture}[scale=2]
  \coordinate (A) at (1,0);
  \draw (0,0) -- ([xshift=1cm]A) -- ([shift={(1,0)}]A);
\end{tikzpicture}`);
  const scaledPath = scaled.ir.items.find((item) => item.type === "path");

  assert.deepEqual(scaled.diagnostics, []);
  assert.deepEqual(scaledPath.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 4, y: 0 },
    { type: "lineTo", x: 4, y: 0 }
  ]);

  const rotated = tikzToSvg(String.raw`
\begin{tikzpicture}[rotate=90]
  \coordinate (A) at (1,0);
  \draw (0,0) -- ([xshift=1cm]A);
\end{tikzpicture}`);
  const rotatedPath = rotated.ir.items.find((item) => item.type === "path");

  assert.deepEqual(rotated.diagnostics, []);
  expectClose(rotatedPath.commands[1].x, 0, 1e-6);
  expectClose(rotatedPath.commands[1].y, 2, 1e-6);
});

test("applies full affine transforms from coordinate option prefixes", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[rotate=30]
  \coordinate (Rotated) at ([rotate=60]1,0);
  \coordinate (Scaled) at ([scale=2]1,0);
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  expectClose(result.ir.coordinates.Rotated.x, 0, 1e-6);
  expectClose(result.ir.coordinates.Rotated.y, 1, 1e-6);
  expectClose(result.ir.coordinates.Scaled.x, Math.sqrt(3), 1e-6);
  expectClose(result.ir.coordinates.Scaled.y, 1, 1e-6);
});

test("treats dimensionless coordinate xshift and yshift values as TeX points", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \draw (0,0) -- ([xshift=10,yshift=-5]A);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  expectClose(path.commands[1].x, 10 / 28.4527559);
  expectClose(path.commands[1].y, -5 / 28.4527559);
});

test("applies coordinate transforms in TikZ option order", () => {
  const rotateThenShift = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[rotate=30,xshift=2cm] (0,0) -- (1,0);
\end{tikzpicture}`);
  const shiftThenRotate = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[xshift=2cm,rotate=30] (0,0) -- (1,0);
\end{tikzpicture}`);
  const first = rotateThenShift.ir.items.find((item) => item.type === "path").commands;
  const second = shiftThenRotate.ir.items.find((item) => item.type === "path").commands;

  assert.deepEqual(rotateThenShift.diagnostics, []);
  assert.deepEqual(shiftThenRotate.diagnostics, []);
  expectClose(first[0].x, Math.sqrt(3));
  expectClose(first[0].y, 1);
  expectClose(first[1].x, 3 * Math.sqrt(3) / 2);
  expectClose(first[1].y, 1.5);
  expectClose(second[0].x, 2);
  expectClose(second[0].y, 0);
  expectClose(second[1].x, 2 + Math.sqrt(3) / 2);
  expectClose(second[1].y, 0.5);
});

test("applies transforms expanded from a local style in declaration order", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[shifted ray/.style={rotate=30,xshift=2cm}]
  \draw[shifted ray] (0,0) -- (1,0);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  expectClose(path.commands[0].x, Math.sqrt(3));
  expectClose(path.commands[0].y, 1);
  expectClose(path.commands[1].x, 3 * Math.sqrt(3) / 2);
  expectClose(path.commands[1].y, 1.5);
});

test("supports rotate around and scale around in the ordered coordinate transform", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[rotate around={90:(1,0)}] (1,0) -- (2,0);
  \draw[scale around={2:(1,0)}] (1,0) -- (2,0);
\end{tikzpicture}`);
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  expectClose(paths[0].commands[0].x, 1);
  expectClose(paths[0].commands[0].y, 0);
  expectClose(paths[0].commands[1].x, 1);
  expectClose(paths[0].commands[1].y, 1);
  expectClose(paths[1].commands[0].x, 1);
  expectClose(paths[1].commands[0].y, 0);
  expectClose(paths[1].commands[1].x, 3);
  expectClose(paths[1].commands[1].y, 0);
});

test("applies the external rotation to nodes only when transform shape is enabled", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[rotate=60]
  \node[draw,transform shape] (A) at (1,0) {AB};
  \node[draw] (B) at (2,0) {CD};
\end{tikzpicture}`);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const labels = result.ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual(result.diagnostics, []);
  expectClose(result.ir.coordinates.A.x, 0.5, 1e-6);
  expectClose(result.ir.coordinates.A.y, Math.sqrt(3) / 2, 1e-6);
  expectClose(boxes[0].rotation, 60, 1e-6);
  expectClose(labels[0].rotation, 60, 1e-6);
  assert.equal(boxes[1].rotation, undefined);
  assert.equal(labels[1].rotation, undefined);
});

test("resolves numeric and automatic border anchors on rotated nodes", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[draw,minimum width=2cm,minimum height=1cm,inner sep=0pt,rotate=45] (R) at (0,0) {};
  \coordinate (A0) at (R.0);
  \coordinate (A45) at (R.45);
  \coordinate (E) at (R.east);
  \draw (R) -- (3,0);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  expectClose(result.ir.coordinates.A0.y, 0, 1e-6);
  assert.ok(result.ir.coordinates.A0.x > result.ir.coordinates.E.x);
  assert.ok(result.ir.coordinates.A0.x - result.ir.coordinates.E.x < 0.01);
  expectClose(result.ir.coordinates.A45.x, result.ir.coordinates.E.x, 1e-6);
  expectClose(result.ir.coordinates.A45.y, result.ir.coordinates.E.y, 1e-6);
  expectClose(path.commands[0].x, result.ir.coordinates.A0.x, 1e-6);
  expectClose(path.commands[0].y, result.ir.coordinates.A0.y, 1e-6);
});

test("supports the general cm transform and reset cm across nested scopes", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[shift={(2,1)}]
  \draw[cm={0,1,-1,0,(1,0)}] (0,0) -- (1,0);
  \begin{scope}[scale=2]
    \draw[reset cm] (0,0) -- (1,0);
  \end{scope}
\end{tikzpicture}`);
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  expectClose(paths[0].commands[0].x, 3);
  expectClose(paths[0].commands[0].y, 1);
  expectClose(paths[0].commands[1].x, 3);
  expectClose(paths[0].commands[1].y, 2);
  expectClose(paths[1].commands[0].x, 0);
  expectClose(paths[1].commands[0].y, 0);
  expectClose(paths[1].commands[1].x, 1);
  expectClose(paths[1].commands[1].y, 0);
});
