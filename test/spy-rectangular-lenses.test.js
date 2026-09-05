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
  const left = lens.x;
  const right = lens.x + lens.width;
  const bottom = lens.y;
  const top = lens.y + lens.height;

  assert.ok(magnified.length >= 3);
  for (const item of magnified) {
    for (const command of item.commands) {
      assert.ok(command.x >= left - 1e-9 && command.x <= right + 1e-9, `x=${command.x} escaped [${left}, ${right}]`);
      assert.ok(command.y >= bottom - 1e-9 && command.y <= top + 1e-9, `y=${command.y} escaped [${bottom}, ${top}]`);
    }
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
