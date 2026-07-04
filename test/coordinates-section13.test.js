import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

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
