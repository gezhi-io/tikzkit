import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { lineWidthFromPt } from "../src/engine/units.js";

function picture(body) {
  const source = String.raw`\usepackage{circuitikz}\begin{circuitikz}${body}\end{circuitikz}`;
  const { ir, diagnostics } = tikzToSvg(source, { mathRenderer: "svg-text" });
  assert.deepEqual(diagnostics, []);
  return ir.items;
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < .0004, `${actual} != ${expected}`);
}

test("a ground attached to a wire has a connection pen and three independently painted plates", () => {
  const items = picture(String.raw`\draw[line width=1pt] (1,2) -- (1,1) node[ground] {};`);
  const paths = items.filter(i => i.type === "path");
  const stem = paths.find(i => i.commands.length === 2 && i.commands[0].y === 1);
  const plates = paths.find(i => i.commands.length === 6);
  assert.ok(stem && plates, "wire, ground lead and ground plates must not be one stroke");
  near(stem.commands[1].y, 1 - .35 * 1.2);
  near(plates.commands[0].x, 1 - .35 * .6);
  near(plates.commands[5].y, 1 - .35 * 1.6);
  near(stem.style.lineWidth, lineWidthFromPt(1));
  near(plates.style.lineWidth, lineWidthFromPt(2));
});

test("a protective ground paints its filled ring first, then its lead and plates, and keeps its node text", () => {
  const items = picture(String.raw`\node[pground,fill=red,label=above:PIN] at (0,0) {G};`);
  const paths = items.filter(i => i.type === "path");
  assert.equal(paths.length, 3);
  assert.ok(paths[0].commands.some(c => c.type === "curveTo"));
  assert.equal(paths[0].style.fill, "red");
  assert.equal(paths[1].style.fill, "none");
  assert.equal(paths[2].style.fill, "none");
  assert.deepEqual(items.filter(i => i.type === "textNode").map(i => i.text), ["G", "PIN"]);
});

test("the parent's pen and text ink are independent and the node may override either", () => {
  for (const [parent, node, stroke, text] of [
    ["draw=red", "", "red", "black"], ["blue", "", "blue", "blue"],
    ["color=blue", ",draw=red", "red", "blue"], ["red,draw=blue", ",text=black", "blue", "black"]
  ]) {
    const items = picture(`\\draw[${parent},line cap=round,dashed] (-1,0)--(0,0) node[ground${node}] {G};`);
    const lead = items.find(i => i.subtype === "circuitikz-ground-lead");
    const letter = items.find(i => i.text === "G");
    assert.equal(lead.style.stroke, stroke);
    assert.equal(lead.style.lineCap, "round");
    assert.deepEqual(lead.style.dashArray, items[0].style.dashArray);
    assert.equal(letter.style.fill, text);
    assert.equal(letter.excludeFromBounds, true, "the ground's behind-background path sets its native picture box");
  }
});

test("ground angle labels start at the terminal, independent of the body's depth", () => {
  const labelY = (scale) => picture(`\\ctikzset{grounds/scale=${scale}}\\node[pground,label=above:PE] at (0,0) {};`)
    .find(i => i.text === "PE").y;
  near(labelY(1), labelY(3));
});
