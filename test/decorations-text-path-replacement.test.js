import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function render(body) {
  const result = tikzToSvg(String.raw`\usetikzlibrary{decorations.text}
\begin{tikzpicture}${body}\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  return result;
}

const drawable = result => result.ir.items.filter(item => item.type === "path"
  && item.commands?.some(command => command.type !== "moveTo")
  && (item.style?.stroke !== "none" || item.style?.fill !== "none"));
const labels = result => result.ir.items.filter(item => item.subtype === "decoration-text");

for (const kind of ["text along path", "text effects along path"]) {
  for (const route of ["(0,0) -- (4,0)", "(0,0) .. controls (1,1) and (3,1) .. (4,0)",
    "(0,0) rectangle (4,2)", "(0,0) circle (1cm)"]) {
    test(`${kind} replaces the painted path: ${route}`, () => {
      const result = render(String.raw`\filldraw[red,decorate,decoration={${kind},text={ABC}}] ${route};`);
      assert.equal(labels(result).length, 1, "the original route must still position the text");
      assert.ok(labels(result)[0].pathCommands.length > 1);
      assert.equal(drawable(result).length, 0, "text decoration emits neither original stroke nor fill");
    });
  }
}

test("empty text still consumes a directly decorated path", () => {
  const result = render(String.raw`\draw[decorate,decoration={text along path,text={}}] (0,0) -- (4,0);`);
  assert.equal(labels(result).length, 0);
  assert.equal(drawable(result).length, 0);
});

test("ordinary decoration boxes reset color, while text-effects nodes inherit it", () => {
  const result = render(String.raw`
    \draw[red,text=blue,decorate,decoration={text along path,text={ABC}}] (0,3) -- (4,3);
    \draw[red,decorate,decoration={text along path,text color=green,text={ABC}}] (0,2) -- (4,2);
    \draw[red,decorate,decoration={text along path,text={|\color{orange}|ABC}}] (0,1) -- (4,1);
    \draw[red,text=blue,decorate,decoration={text effects along path,text={ABC}}] (0,0) -- (4,0);`);
  assert.deepEqual(labels(result).map(label => label.style.fill), ["black", "rgb(0 255 0)", "rgb(255 128 0)", "blue"]);
});

test("rectangle text follows the native vertical-first path direction", () => {
  const result = render(String.raw`\draw[decorate,decoration={text along path,text={ABC}}]
    (0,0) rectangle (4,2);`);
  assert.deepEqual(labels(result)[0].pathCommands.slice(0, 3), [
    { type: "moveTo", x: 0, y: 0 }, { type: "lineTo", x: 0, y: 2 }, { type: "lineTo", x: 4, y: 2 }
  ]);
});

test("postaction text preserves the undecorated stroke and paints after it", () => {
  const result = render(String.raw`\draw[red,very thick,decoration={text along path,text={ABC}},
    postaction={decorate}] (0,0) -- (4,0);`);
  assert.equal(drawable(result).length, 1);
  assert.equal(drawable(result)[0].style.stroke, "red");
  assert.equal(labels(result).length, 1);
  assert.ok(result.ir.items.indexOf(labels(result)[0]) > result.ir.items.indexOf(drawable(result)[0]));
});

test("declaring a decoration without activating it does not suppress paint", () => {
  const result = render(String.raw`\draw[decorate=false,decoration={text along path,text={ABC}}] (0,0) -- (4,0);`);
  assert.equal(labels(result).length, 0);
  assert.equal(drawable(result).length, 1);
});

test("direct replacement retains inline nodes and independent undecorated edges", () => {
  const result = render(String.raw`\draw[decorate,decoration={text along path,text={ABC}}]
    (0,0) edge[decorate=false,blue] (0,1) -- (4,0) node[above]{end};`);
  assert.equal(labels(result).length, 1);
  assert.equal(drawable(result).length, 1);
  assert.equal(drawable(result)[0].style.stroke, "blue");
  assert.ok(result.ir.items.some(item => item.type === "textNode" && item.text === "end"));
});

test("an edge-local text decoration does not erase the parent or later edges", () => {
  const result = render(String.raw`\draw (0,0)
    edge[decorate,decoration={text along path,text={ABC}}] (2,1)
    edge[blue] (3,1) -- (4,0);`);
  assert.equal(labels(result).length, 1);
  assert.equal(drawable(result).length, 2);
  assert.equal(drawable(result).filter(item => item.subtype === "edge").length, 1);
});

test("the overfitting annotation does not draw a second line above its arrow", () => {
  const source = readFileSync(new URL("fixtures/examples/latex-examples/2d-epochs-overfitting.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  const [annotation] = labels(result);
  assert.equal(annotation.text, "overfitting");
  assert.ok(result.ir.items.some(item => item.style?.markerEnd?.kind === "latex"));
  assert.equal(drawable(result).filter(item => JSON.stringify(item.commands) === JSON.stringify(annotation.pathCommands)).length, 0);
});
