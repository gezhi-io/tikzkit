import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function diagram(body, options = "") {
  const { ir, diagnostics } = tikzToSvg(String.raw`\begin{circuitikz}[${options}]${body}\end{circuitikz}`);
  assert.deepEqual(diagnostics, []);
  return ir;
}

const paths = (ir, subtype) => ir.items.filter(item => item.subtype === "circuitikz-" + subtype);
function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < .00005, `${actual} vs ${expected}`);
}

test("the manual's two resistive modifiers use the body pen first, then the modifier multiplier", () => {
  const ir = diagram(String.raw`
    \draw (0,2) to[vR] ++(2,0) to[sR] ++(2,0);
    \ctikzset{resistors/thickness=4}
    \draw (0,1) to[vR] ++(2,0) to[sR] ++(2,0);
    \ctikzset{resistors/modifier thickness=0.5}
    \draw (0,0) to[vR] ++(2,0) to[sR] ++(2,0);`, "american");
  for (const family of ["variable-resistor", "resistive-sensor"]) {
    const bodies = paths(ir, family + "-body"), strokes = paths(ir, family + "-modifier");
    assert.equal(bodies.length, 3);
    assert.equal(strokes.length, 3);
    const base = bodies[0].style.lineWidth;
    bodies.forEach((item, i) => near(item.style.lineWidth / base, [1,2,2][i]));
    strokes.forEach((item, i) => near(item.style.lineWidth / base, [1,2,1][i]));
    assert.equal(bodies[0].commands.length, 8); // three zigs and both leads
  }
  assert.equal(paths(ir, "variable-resistor-modifier-head").length, 3);
  assert.equal(paths(ir, "resistive-sensor-modifier-head").length, 0);
  assert.equal(paths(ir, "resistive-sensor-modifier")[0].commands.length, 3);
});

test("old tunable direction changes painted ends, not saved contacts; an empty tip exposes the whole shaft", () => {
  const ir = diagram(String.raw`
    \ctikzset{tunable end arrow={}}
    \draw (0,0) to[vR,name=A] (4,0);
    \draw (0,2) to[tgeneric,name=E] (4,2);
    \ctikzset{bipoles/fix tunable direction=false}
    \draw (0,4) to[variable american resistor,name=B] (4,4);
    \draw (0,6) to[variable european resistor,name=F] (4,6);`);
  const strokes = paths(ir, "variable-resistor-modifier");
  assert.equal(strokes.length, 4);
  assert.equal(paths(ir, "variable-resistor-modifier-head").length, 0);
  for (const [i, name] of ["A","E","B","F"].entries()) {
    const [start, end] = strokes[i].commands;
    const lower = ir.coordinates[name + ".W"], upper = ir.coordinates[name + ".tip"];
    near(start.x, i === 2 ? upper.x : lower.x); near(start.y, i < 2 ? lower.y : upper.y);
    near(end.x, i === 2 ? lower.x : upper.x); near(end.y, i < 2 ? upper.y : lower.y);
    assert.ok(lower.x < upper.x && lower.y < upper.y);
  }
});

test("the European sensor's named elbow follows its bar beyond the rectangle, also after reflection", () => {
  const ir = diagram(String.raw`
    \ctikzset{resistors/width=1,bipoles/thermistor/width=1.25,bipoles/thermistor/main=.5}
    \path (0,0) to[thR,name=T,mirror,invert,fill=red] (4,0);
    \path (0,2) to[sR,name=S] (4,2);
    \draw (T.label) -- ++(0,.1) coordinate(tap);`, "american");
  const [european, american] = paths(ir, "resistive-sensor-body");
  assert.equal(european.style.fill, "red"); assert.equal(american.style.fill, "none");
  assert.equal(european.commands.at(-1).type, "closePath");
  const [tip, elbow, wiper] = paths(ir, "resistive-sensor-modifier")[0].commands;
  for (const [p, key] of [[tip,"tip"], [elbow,"label"], [wiper,"W"]]) {
    near(p.x, ir.coordinates["T." + key].x); near(p.y, ir.coordinates["T." + key].y);
  }
  near(ir.coordinates.tap.x, 2.35); near(ir.coordinates.tap.y, 1.2 * .428 * 1.4 / 2 + .1);
  near(ir.coordinates["T.w"].x, 2.875); near(ir.coordinates["S.w"].x, 1.3);
  assert.equal(ir.items.filter(i => i.type === "path" && !i.subtype).length, 1);
});

test("the tunable head uses the recorded pen after a filled box, but the original fill after a zigzag", () => {
  const ir = diagram(String.raw`
    \draw[draw=red] (0,0) to[tgeneric,fill=blue] (3,0);
    \draw[draw=red] (0,1) to[vR,fill=blue] (3,1);
    \draw[red] (0,2) to[vR] (3,2);
    \draw[draw=red,fill=green] (0,3) to[tgeneric,fill=blue] (3,3);
    \draw[red,fill=green] (0,4) to[tgeneric,fill=blue] (3,4);
    \draw[draw=red,fill=green] (0,5) to[vR,fill=blue] (3,5);
    \draw[draw=red] (0,6) to[tgeneric,blue,fill=red] (3,6);`, "american");
  const ink = suffix => paths(ir, "variable-resistor-" + suffix).map(item => item.style);
  assert.deepEqual(ink("body").map(s => s.fill), ["blue", "none", "none", "blue", "blue", "none", "red"]);
  assert.deepEqual(ink("modifier").map(s => s.stroke), ["red", "red", "red", "red", "red", "red", "blue"]);
  // Original pdfLaTeX: compare the fill of each three-cubic arrowhead, not the adjacent box.
  assert.deepEqual(ink("modifier-head").map(s => s.fill), ["black", "black", "red", "black", "red", "rgb(0 255 0)", "blue"]);
});

test("the tunable arrow and class width apply locally without changing a subsequent potentiometer", () => {
  const ir = diagram(String.raw`
    \draw (0,0) to[var=R, n=A] (4,0);
    \draw (0,1) to[variable resistor=S, n=B] (4,1);
    \draw (0,2) to[pR=T, n=C] (4,2);`,
    "var/.style={variable european resistor=#1,resistors/width=1.5,tunable end arrow={}}");
  const labels = ir.items.filter(i => i.type === "textNode").map(i => i.text);
  assert.deepEqual(labels, ["R", "S", "T"]);
  near(ir.coordinates["A.w"].x, .95); near(ir.coordinates["B.w"].x, 1.44);
  assert.equal(paths(ir, "variable-resistor-modifier-head").length, 1);
  assert.equal(paths(ir, "potentiometer-wiper-head").length, 1);
});
