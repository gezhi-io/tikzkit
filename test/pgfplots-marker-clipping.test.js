import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function axisMarks(result) {
  return result.ir.items.filter((item) => item.type === "path" && item.subtype === "axis-mark");
}

function renderAxis(axisOptions, plot) {
  return tikzToSvg(String.raw`
\begin{tikzpicture}
  \begin{axis}[width=4cm,height=3cm,xmin=0,xmax=2,ymin=0,ymax=2,enlargelimits=false,${axisOptions}]
    ${plot}
  \end{axis}
\end{tikzpicture}`, { mathRenderer: "svg-text" });
}

test("pgfplots default clipping rejects outside marker centers without clipping boundary marks", () => {
  const result = renderAxis("", String.raw`
    \addplot[only marks,mark=*,mark size=6pt]
      coordinates {(-0.2,1) (0,0.4) (1,1) (2,1.6) (2.2,1)};`);
  const marks = axisMarks(result);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 3);
  assert.ok(marks.every((item) => item.clipRect == null));
});

test("pgfplots clip marker paths clips accepted boundary marker geometry", () => {
  const result = renderAxis("clip marker paths=true", String.raw`
    \addplot[only marks,mark=square*,mark size=7pt]
      coordinates {(-0.2,1) (0,0.4) (1,1) (2,1.6) (2.2,1)};`);
  const marks = axisMarks(result);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 3);
  assert.ok(marks.every((item) => item.clipRect));
  assert.equal(new Set(marks.map((item) => JSON.stringify(item.clipRect))).size, 1);
});

test("pgfplots clip=false preserves function markers outside the visible axis range", () => {
  const result = renderAxis("clip=false", String.raw`
    \addplot[domain=-0.5:2.5,samples=7,only marks,mark=triangle*] {0.5*x+0.5};`);
  const marks = axisMarks(result);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(marks.length, 7);
  assert.ok(marks.every((item) => item.clipRect == null));
  const frame = result.ir.items.filter((item) => item.subtype === "axis-frame").at(-1);
  const frameX = frame.commands.filter((command) => Number.isFinite(command.x)).map((command) => command.x);
  const markX = marks.flatMap((item) => item.commands.filter((command) => Number.isFinite(command.x)).map((command) => command.x));
  assert.ok(Math.min(...markX) < Math.min(...frameX));
  assert.ok(Math.max(...markX) > Math.max(...frameX));
});
