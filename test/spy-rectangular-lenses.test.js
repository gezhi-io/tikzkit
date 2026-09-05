import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function renderSpy(source) {
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items;
}

test("uses the requested rectangular spy shape and independent width and height", () => {
  const items = renderSpy(String.raw`
\usetikzlibrary{spy}
\begin{tikzpicture}[spy using outlines={rectangle,magnification=3,width=2cm,height=1cm,connect spies}]
  \draw (-2,0) -- (2,0);
  \spy on (0,0) in node at (4,0);
\end{tikzpicture}`);
  const source = items.find((item) => item.subtype === "spy-on");
  const lens = items.find((item) => item.subtype === "spy-in");

  assert.equal(source?.shape, "rectangle");
  assert.equal(lens?.shape, "rectangle");
  assert.ok(Math.abs(source.width - 2 / 3) < 1e-9);
  assert.ok(Math.abs(source.height - 1 / 3) < 1e-9);
  assert.equal(lens.width, 2);
  assert.equal(lens.height, 1);
});

test("clips magnified path segments to rectangular spy bounds", () => {
  const items = renderSpy(String.raw`
\usetikzlibrary{spy}
\begin{tikzpicture}[spy using outlines={rectangle,magnification=4,width=2cm,height=1cm}]
  \draw (-3,0) -- (3,0);
  \draw (0,-3) -- (0,3);
  \draw (-2,-2) -- (2,2);
  \spy on (0,0) in node at (4,1);
\end{tikzpicture}`);
  const lens = items.find((item) => item.subtype === "spy-in");
  const magnified = items.filter((item) => item.subtype === "spy-magnified");

  assert.ok(magnified.length >= 3);
  for (const item of magnified) {
    assert.deepEqual(item.clipRect, {
      minX: lens.x,
      minY: lens.y,
      maxX: lens.x + lens.width,
      maxY: lens.y + lens.height
    });
  }
});

test("lets command and in-node options own the source and target spy shapes", () => {
  const items = renderSpy(String.raw`
\usetikzlibrary{spy}
\begin{tikzpicture}[spy scope={magnification=2,size=1cm}]
  \draw (-1,0) -- (1,0);
  \spy [circle,blue] on (0,0) in node [rectangle,red] at (3,0);
\end{tikzpicture}`);
  const source = items.find((item) => item.subtype === "spy-on");
  const lens = items.find((item) => item.subtype === "spy-in");

  assert.equal(source?.shape, "circle");
  assert.equal(lens?.shape, "rectangle");
  assert.equal(source.style.stroke, "blue");
  assert.equal(lens.style.stroke, "red");
});

test("uses filled translucent nodes for spy using overlays", () => {
  const items = renderSpy(String.raw`
\usetikzlibrary{spy}
\begin{tikzpicture}[spy using overlays={rectangle,magnification=3,size=1cm}]
  \draw (-1,0) -- (1,0);
  \spy [green] on (0,0) in node at (2,0);
\end{tikzpicture}`);
  const source = items.find((item) => item.subtype === "spy-on");
  const lens = items.find((item) => item.subtype === "spy-in");

  assert.equal(source?.shape, "rectangle");
  assert.equal(lens?.shape, "rectangle");
  assert.equal(source.style.fill, "rgb(0 255 0)");
  assert.equal(lens.style.fill, "rgb(0 255 0)");
  assert.equal(source.style.fillOpacity, 0.2);
  assert.equal(lens.style.fillOpacity, 0.2);
});

test("replays filled paths and curves inside the clipped spy lens", () => {
  const items = renderSpy(String.raw`
\usetikzlibrary{spy}
\begin{tikzpicture}[spy using outlines={circle,magnification=3,size=2cm}]
  \fill[orange] (-.3,-.2) rectangle (.3,.2);
  \draw[blue,very thick] (-1,-.4) .. controls (-.3,.8) and (.3,-.8) .. (1,.4);
  \spy on (0,0) in node at (3,0);
\end{tikzpicture}`);
  const magnified = items.filter((item) => item.subtype === "spy-magnified");
  const fill = magnified.find((item) => item.style?.fill === "rgb(255 128 0)");
  const curve = magnified.find((item) => item.style?.stroke === "blue");

  assert.ok(fill, "expected the filled rectangle inside the spy lens");
  assert.ok(fill.commands.some((command) => command.type === "closePath"));
  assert.ok(curve, "expected the cubic curve inside the spy lens");
  assert.ok(curve.commands.some((command) => command.type === "curveTo"));
  assert.ok(magnified.every((item) => item.clipCircle), "expected one shared circular lens clip");
  assert.ok(curve.style.lineWidth > items.find((item) => item.style?.stroke === "blue").style.lineWidth);
});

test("replays node shapes and text at magnified canvas size", () => {
  const items = renderSpy(String.raw`
\usetikzlibrary{spy}
\begin{tikzpicture}[spy using outlines={rectangle,magnification=4,width=3cm,height=1.5cm}]
  \node[draw=purple,fill=yellow!30,circle] at (.2,0) {$x_1$};
  \node[red] at (-.25,.2) {state};
  \spy on (0,0) in node at (4,1);
\end{tikzpicture}`);
  const nodeBoxes = items.filter((item) => item.subtype === "spy-magnified" && item.type === "nodeBox");
  const labels = items.filter((item) => item.subtype === "spy-magnified" && item.type === "textNode");
  const math = labels.find((item) => item.text === "$x_1$");
  const state = labels.find((item) => item.text === "state");

  assert.equal(nodeBoxes.length, 1);
  assert.equal(nodeBoxes[0].shape, "circle");
  assert.ok(nodeBoxes[0].width > 1, `expected magnified node width, got ${nodeBoxes[0].width}`);
  assert.ok(math && state, "expected both magnified text nodes");
  assert.equal(math.font.sizePt, 40);
  assert.equal(state.font.sizePt, 40);
  assert.ok(labels.every((item) => item.clipRect), "expected rectangular clipping on magnified text");
  assert.ok(Math.abs(math.x - 4.8) < 1e-9 && Math.abs(math.y - 1) < 1e-9);
});

for (const fixture of ["algorithm", "math", "physics"]) {
  test(`renders the rectangular spy ${fixture} fixture without diagnostics`, async () => {
    const source = await readFile(
      new URL(`fixtures/examples/spy/rectangular-lenses/${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const lens = result.ir.items.find((item) => item.subtype === "spy-in");

    assert.deepEqual(result.diagnostics, []);
    assert.equal(lens?.shape, "rectangle");
    assert.ok(result.ir.items.some((item) => item.subtype === "spy-magnified"));
  });
}
