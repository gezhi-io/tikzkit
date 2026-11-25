import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const fixture = file => readFileSync(new URL("./fixtures/" + file + ".tex", import.meta.url), "utf8");
const input = id => fixture("circuitikz-capacitor-plates/" + id);
function items(source) {
  const r = tikzToSvg(source, { mathRenderer: "svg-text", margin: 0 });
  assert.deepEqual(r.diagnostics, []);
  return r.ir.items;
}
const plates = all => all.filter(i => i.subtype === "circuitikz-capacitor");
const wires = all => all.filter(i => i.type === "path" && !i.subtype && i.commands.length === 4);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a, b) => ({ x: (a.x+b.x)/2, y: (a.y+b.y)/2 });
const near = (n, expected) => assert.ok(Math.abs(n - expected) < 1e-8, n + " != " + expected);

function measure(plate) {
  assert.deepEqual(plate.commands.map(c => c.type), ["moveTo", "lineTo", "moveTo", "lineTo"]);
  const [a,b,c,d] = plate.commands, start = midpoint(a,b), end = midpoint(c,d);
  near(distance(a,b), distance(c,d));
  return { span: distance(a,b), gap: distance(start,end), start, end };
}

test("both fixed plates meet their wires, in all three directions and even on a short path", () => {
  const all = items(input("directions")), caps = plates(all), leads = wires(all);
  assert.equal(caps.length, 4);
  assert.equal(leads.length, 4);
  caps.forEach((cap, i) => {
    const { span, gap, start, end } = measure(cap);
    near(span, .6 * 1.4); near(gap, .2 * 1.4);
    near(distance(start, leads[i].commands[1]), 0);
    near(distance(end, leads[i].commands[2]), 0);
    near(cap.style.lineWidth, 2 * leads[i].style.lineWidth);
  });
  assert.ok(leads[3].commands[1].x < leads[3].commands[0].x);
});

test("class size, individual overrides, fillings and pen multipliers follow the native capacitor keys", () => {
  const all = items(input("settings")), caps = plates(all), leads = wires(all);
  assert.equal(caps.length, 4);
  caps.forEach((cap, i) => {
    const { span, gap } = measure(cap);
    near(span, [1.05,1.05,.75,.75][i]);
    near(gap, [.6,.375,.6,.6][i]);
    near(cap.style.lineWidth, leads[i].style.lineWidth * [3,3,1.25,1.25][i]);
    assert.equal(cap.style.fill, "none");
  });
  const fills = all.filter(i => i.subtype === "circuitikz-capacitor-fill");
  assert.deepEqual(fills.map(i => i.style.fill), ["rgb(255 242 0)", "rgb(0 173 239)", "rgb(255 242 0)"]);
  fills.forEach((f,i) => {
    assert.equal(f.style.stroke, "none"); assert.equal(f.commands.at(-1).type, "closePath");
    assert.ok(all.indexOf(f) < all.indexOf(caps[i]));
    for (const p of caps[i].commands) assert.ok(f.commands.some(q => q.x === p.x && q.y === p.y));
  });
});

test("coordinates scale alone unless transform shape is active; the plate pen does not scale with the node", () => {
  const all = items(input("coordinate-scale")), [a,b] = plates(all);
  near(measure(a).gap, .28); near(measure(b).gap, 1.8 * .28);
  near(measure(a).span, .84); near(measure(b).span, 1.8 * .84);
  near(a.style.lineWidth, b.style.lineWidth);
  for (const w of wires(all)) near(w.commands.at(-1).x, 3.6);
});

test("the amplifier's three coupling and bypass capacitors use physical, not wire-relative, sizes", () => {
  const caps = plates(items(fixture("circuitikz-tubes/amplifier")));
  assert.equal(caps.length, 3);
  for (const cap of caps) {
    near(measure(cap).gap, .28); near(measure(cap).span, .84);
  }
});

test("class setters and concrete capacitor keys address the same dimensions in source order", () => {
  const source = String.raw`\begin{circuitikz}
  \ctikzset{bipoles/capacitor/width=.1}
  \ctikzset{capacitors/width=.3}
  \draw (0,0) to[C] (2,0);
  \draw (0,1) to[C,bipoles/capacitor/width=.8,capacitors/width=.4] (2,1);
  \draw (0,2) to[C,capacitors/width=.4,bipoles/capacitor/width=.8] (2,2);
  \end{circuitikz}`;
  const caps = plates(items(source));
  assert.equal(caps.length, 3);
  caps.forEach((cap,i) => near(measure(cap).gap, 1.4 * [.3,.4,.8][i]));
});

test("scoped sizes are restored and native class fill covers wires inside a short capacitor", () => {
  const all = items(input("scope")), caps = plates(all), leads = wires(all);
  assert.equal(caps.length, 4);
  assert.equal(leads.length, 4);
  caps.forEach((cap, i) => near(measure(cap).gap, 1.4 * [.35, .65, .65, .5][i]));
  const fills = all.filter(i => i.subtype === "circuitikz-capacitor-fill");
  // fill=none clears the node override; capacitors/fill=none clears the class.
  assert.deepEqual(fills.map(f => f.style.fill), Array(3).fill("rgb(255 242 0)"));
  for (let i = 1; i < caps.length; i++) {
    assert.ok(all.indexOf(leads[i]) < all.indexOf(fills[i - 1]));
    assert.ok(all.indexOf(fills[i - 1]) < all.indexOf(caps[i]));
  }
});
