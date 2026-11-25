import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

function diagram(body, options = "") {
  const source = String.raw`\documentclass{standalone}
\usepackage{circuitikz}
\begin{document}
\begin{circuitikz}[${options}]
${body}
\end{circuitikz}
\end{document}`;
  const { ir, diagnostics } = tikzToSvg(source, { mathRenderer: "svg-text", margin: 0 });
  assert.deepEqual(diagnostics, []);
  return ir;
}

function near(actual, expected, label) {
  assert.ok(actual != null && Math.abs(actual - expected) < 0.0004, `${label}: ${actual} vs ${expected}`);
}

function at(ir, key, x, y) {
  const point = ir.coordinates[key];
  near(point?.x, x, key + ".x");
  near(point?.y, y, key + ".y");
}

test("a named potentiometer's case-sensitive sliding and body anchors are usable as wire endpoints", () => {
  const ir = diagram(String.raw`
    \ctikzset{resistors/width=1.5}
    \draw (1.5,0) to[pR, wiper pos=.3, name=B] ++(0,-4);
    \draw[red] (B.W) -- (B.wiper) -- ++(1,0) coordinate (tap);
    \draw[blue] (B.w) -- ++(-1,0) coordinate (left);
    \coordinate (contact) at (B.tip);
  `);
  at(ir, "tap", 3.06, -1.58);
  at(ir, "left", 0.5, -0.95);
  at(ir, "contact", 1.71, -1.58);
});

test("both regional names accept inline labels; named styles and local wiper keys stay local", () => {
  const ir = diagram(String.raw`
    \ctikzset{wiper pos=.25}
    \draw (0,0) to[longpot, l=A, n=first] (4,0);
    \draw (0,2) to[potentiometer=B, n=second] (4,2);
    \draw (0,4) to[american potentiometer=C, n=third] (4,4);
    \draw (0,6) to[european potentiometer=D, n=fourth] (4,6);
  `, "european,longpot/.style={pR,wiper pos=.8,resistors/scale=.75,resistors/width=1.6,resistors/zigs=6}");
  at(ir, "first.wiper", 2.504, .42);
  at(ir, "second.W", 1.72, 2.56);
  at(ir, "third.W", 1.72, 4.56);
  at(ir, "fourth.W", 1.72, 6.56);
  assert.deepEqual(ir.items.filter(i => i.type === "textNode").map(i => i.text), ["A", "B", "C", "D"]);
});

test("a regional override and a mirror/invert affect the next connector without changing outer settings", () => {
  const ir = diagram(String.raw`
    \ctikzset{resistors/width=1,bipoles/generic potentiometer/width=2,wiper pos=1}
    \begin{scope}[european resistors]
      \draw (0,0) to[pR,mirror,invert,n=flipped] (4,0);
    \end{scope}
    \draw (0,1) to[pR,n=restored] (4,1);
    \coordinate (sliding) at (flipped.W);
    \coordinate (end) at (flipped.w);
  `);
  at(ir, "sliding", .6, -.56);
  at(ir, "end", 3.4, 0);
  at(ir, "restored.W", 2.7, 1.56);
});

test("inclined leads end at the saved component anchors, even when inverted", () => {
  for (const inverted of [false, true]) {
    const ir = diagram(String.raw`\draw (0,0) to[pR,n=P${inverted ? ",invert" : ""}] (4,1.6);`);
    const lead = ir.items.find(i => i.type === "path" && !i.subtype);
    const [first, last] = inverted ? ["right", "left"] : ["left", "right"];
    assert.deepEqual(lead.commands[1], { type: "lineTo", ...ir.coordinates["P." + first] });
    assert.deepEqual(lead.commands[2], { type: "moveTo", ...ir.coordinates["P." + last] });
  }
});

test("all three original manual wipers have separate labels at their physical contacts", () => {
  const { ir, diagnostics } = tikzToSvg(readFileSync(new URL(
    "./fixtures/native-circuitikz-potentiometers/manual-wipers.tex", import.meta.url), "utf8"));
  assert.deepEqual(diagnostics, []);
  const labels = ir.items.filter(i => i.type === "textNode");
  assert.deepEqual(labels.map(i => i.text), ["A", "B", "C"]);
  at(ir, "A.wiper", .56, -2);
  at(ir, "B.wiper", 2.06, -1.58);
  at(ir, "C.wiper", 3.56, -2.63);
});

test("a bare path records its endpoints but paints only the component, using separate stroke and fill inks", () => {
  const ir = diagram(String.raw`\path (0,0) to[pR] (4,0);`);
  assert.deepEqual(ir.items.filter(i => i.type === "path").map(i => i.subtype),
    ["circuitikz-potentiometer-body", "circuitikz-potentiometer-wiper", "circuitikz-potentiometer-wiper-head"]);
  // Native picture x limits: 0pt and 113.81097pt (4cm). No wire is stroked.
  const bbox = ir.items.find(i => i.type === "bbox");
  assert.ok(bbox.commands.some(c => c.x === 0) && bbox.commands.some(c => c.x === 4));
  const inks = diagram(String.raw`
    \draw[red] (0,0) to[pR] (4,0);
    \draw[draw=red] (0,1) to[pR] (4,1);
    \draw[draw=blue,fill=green] (0,2) to[pR] (4,2);
    \draw (0,3) to[european potentiometer,fill=green,thick] (4,3);
  `).items;
  assert.deepEqual(inks.filter(i => i.subtype === "circuitikz-potentiometer-wiper-head").map(i => i.style.fill),
    ["red", "black", "rgb(0 255 0)", "black"]);
  const bodies = inks.filter(i => i.subtype === "circuitikz-potentiometer-body");
  assert.equal(bodies[3].style.fill, "rgb(0 255 0)");
  near(bodies[3].style.lineWidth / bodies[0].style.lineWidth, 2, "local pen");
});

test("a label stays on its requested side, outside the wiper or the body as appropriate", () => {
  const variants = ["pR", "pR,mirror", "pR,invert", "pR,mirror,invert"];
  // MacTeX 2025: \pgfpointanchor{Blabel}{text}, in TeX pt, for the
  // horizontal (0,0)--(4,0) probe below. The wiper side is taller.
  const above = [20.75612, 9.80179, 20.75612, 9.80179];
  const below = [-16.58717, -27.54150, -16.58717, -27.54150];
  for (const [key, baselines] of [["l", above], ["l_", below]]) {
    for (const [i, variant] of variants.entries()) {
      const source = String.raw`\begin{circuitikz}\draw (0,0) to[${variant},name=B,${key}={$P$}] (4,0);\end{circuitikz}`;
      const { diagnostics, svg } = tikzToSvg(source, { unit: 72.27 / 2.54, mathRenderer: "svg-text" });
      assert.deepEqual(diagnostics, []);
      const paint = svg.match(/data-math-layout="cm-tex-box"[^>]*transform="translate\(([-.\d]+) ([-.\d]+)\)/);
      assert.ok(paint, `${variant},${key}: missing native math label`);
      near(Number(paint[1]), 53.00098, variant + " text left");
      near(-Number(paint[2]), baselines[i], variant + " " + key + " baseline");
    }
  }
});
