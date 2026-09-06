import assert from "node:assert/strict";
import test from "node:test";
import { renderSvg, tikzToSvg } from "../src/index.js";

const patternedRectangle = (width) => String.raw`\usetikzlibrary{patterns}
\pgfdeclarepatternformonly{audit dots}
{\pgfqpoint{-1pt}{-1pt}}{\pgfqpoint{1pt}{1pt}}{\pgfqpoint{3pt}{3pt}}
{\pgfpathcircle{\pgfpointorigin}{.5pt}\pgfusepath{fill}}
\begin{tikzpicture}
\fill[pattern=audit dots,pattern color=blue] (0,0) rectangle (${width},1);
\draw (0,0) rectangle (${width},1);
\end{tikzpicture}`;

const ids = (svg) => [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const refs = (svg) => [...svg.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1]);

function assertLocalReferences(svg) {
  const definitions = ids(svg);
  assert.equal(new Set(definitions).size, definitions.length, "definition IDs must be unique within a document");
  for (const ref of refs(svg)) assert.ok(definitions.includes(ref), `missing definition for ${ref}`);
}

test("independent form-only pattern renders isolate clip and pattern definitions", () => {
  const first = tikzToSvg(patternedRectangle(1));
  const second = tikzToSvg(patternedRectangle(3));
  assert.deepEqual(first.diagnostics, []);
  assert.deepEqual(second.diagnostics, []);
  assert.ok(ids(first.svg).length > 0);
  assert.deepEqual(ids(first.svg).filter((id) => ids(second.svg).includes(id)), []);
  assertLocalReferences(first.svg);
  assertLocalReferences(second.svg);
  assert.equal(tikzToSvg(patternedRectangle(1)).svg, first.svg, "default output must remain deterministic");
});

test("explicit ID prefixes isolate identical diagrams without mutating the scene", () => {
  const { ir } = tikzToSvg(patternedRectangle(1));
  const before = JSON.stringify(ir);
  const left = renderSvg(ir, { idPrefix: "left" });
  const right = renderSvg(ir, { idPrefix: "right" });
  assert.deepEqual(ids(left).filter((id) => ids(right).includes(id)), []);
  assert.ok(ids(left).every((id) => id.startsWith("left-")));
  assertLocalReferences(left);
  assertLocalReferences(right);
  assert.equal(renderSvg(ir, { idPrefix: "left" }), left);
  assert.equal(JSON.stringify(ir), before);
});

test("clip definitions include render units in their default scope", () => {
  const ir = { items: [{ type: "path", style: { fill: "red" },
    clipRect: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    commands: [{ type: "moveTo", x: 0, y: 0 }, { type: "lineTo", x: 2, y: 0 },
      { type: "lineTo", x: 2, y: 2 }, { type: "closePath" }]
  }] };
  const first = renderSvg(ir, { unit: 100 });
  const second = renderSvg(ir, { unit: 50 });
  assert.ok(ids(first).length > 0);
  assert.deepEqual(ids(first).filter((id) => ids(second).includes(id)), []);
  assertLocalReferences(first);
  assertLocalReferences(second);
});

test("scoped gradients, masks, shadows, and node styles resolve to local definitions", () => {
  const { svg } = tikzToSvg(String.raw`\usetikzlibrary{shadings,fadings,shadows.blur}
\begin{tikzpicture}
\shade[ball color=blue] (0,0) circle (1);
\shade[top color=red,bottom color=blue] (2,0) rectangle (3,1);
\fill[red,path fading=west] (4,0) rectangle (5,1);
\path[fill=blue,blur shadow] (6,0) rectangle (7,1);
\node[draw,ball color=green,circle] at (8,0) {};
\end{tikzpicture}`, { idPrefix: "resources" });
  assert.ok(ids(svg).length >= 5);
  assert.ok(ids(svg).every((id) => id.startsWith("resources-")));
  assertLocalReferences(svg);
});

test("caller ID prefixes are validated before they become SVG identifiers", () => {
  for (const idPrefix of ["", "123", "two words", 'a\" onload=\"bad', "a#b", "a)b", null, 123]) {
    assert.throws(() => tikzToSvg(patternedRectangle(1), { idPrefix }), /idPrefix/);
  }
  const { svg } = tikzToSvg(patternedRectangle(1), { idPrefix: "_plot.1-2" });
  assert.ok(ids(svg).every((id) => id.startsWith("_plot.1-2-")));
  assertLocalReferences(svg);
});

test("inline mini-graphic gradients also isolate different paints and caller scopes", () => {
  const scene = (color) => ({ items: [{ type: "textNode", x: 0, y: 0, style: { fill: "black" },
    text: String.raw`\scalebox{0.5}{\begin{tikzpicture}[scale=1.5]
      \draw (0,0,0) -- (1,1,1);
      \node[atom,anchor=center,ball color=${color}] at (0,0.5,0.5) {};
    \end{tikzpicture}}`
  }] });
  const red = renderSvg(scene("red"));
  const blue = renderSvg(scene("blue"));
  assert.ok(ids(red).length > 0);
  assert.deepEqual(ids(red).filter((id) => ids(blue).includes(id)), []);
  const scoped = renderSvg(scene("red"), { idPrefix: "mini" });
  assert.ok(ids(scoped).every((id) => id.startsWith("mini-")));
  assertLocalReferences(red);
  assertLocalReferences(blue);
  assertLocalReferences(scoped);
  assert.equal(renderSvg(scene("red")), red);
});
