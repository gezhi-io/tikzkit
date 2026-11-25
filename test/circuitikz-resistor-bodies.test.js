import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { TIKZ_UNIT } from "../src/tikz/metrics.js";

function parts(name) {
  const source = readFileSync(new URL("./fixtures/" + name + ".tex", import.meta.url), "utf8");
  const r = tikzToSvg(source, { mathRenderer: "svg-text", margin: 0 });
  assert.deepEqual(r.diagnostics, []);
  return r.ir.items.filter(item => item.subtype === "circuitikz-resistor");
}
const fixture = id => parts("circuitikz-resistor-bodies/" + id);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .0002, actual + " vs " + expected);
const distance = (a,b) => Math.hypot(b.x-a.x, b.y-a.y);
function span(item) { return distance(item.commands[0], item.commands.at(-1)); }

test("native zigzags start to the left of travel and overlap the wire by half their own pen", () => {
  const bodies = fixture("directions");
  assert.equal(bodies.length, 4);
  for (const r of bodies) {
    const [a,p] = r.commands, b = r.commands.at(-1), len = span(r);
    const ux=(b.x-a.x)/len, uy=(b.y-a.y)/len;
    near((p.y-a.y)*ux - (p.x-a.x)*uy, .21);
    near(len, 1.12 + r.style.lineWidth / TIKZ_UNIT);
    assert.equal(r.style.fill, "none");
    assert.equal(r.style.lineJoin, "bevel");
  }
});

test("class scaling, pen priority, zigzag stubs and explicit invert/mirror are scoped", () => {
  const [normal, mirrored, inverted, restored] = fixture("settings");
  const w = .65 / (72.27/2.54) * TIKZ_UNIT;
  near(normal.style.lineWidth, 3*w); near(mirrored.style.lineWidth, 1.5*w);
  near(span(normal), 1.6*.75*.9 + 3*w/TIKZ_UNIT);
  near(span(mirrored), 1.6*1.25*.9 + 1.5*w/TIKZ_UNIT);
  near(normal.commands[1].y, .24);
  assert.equal(mirrored.commands.length, 12);
  near(mirrored.commands[1].y, -.85);
  near(mirrored.commands[1].x - mirrored.commands[0].x, 1.6*1.25*.9*.12);
  near(mirrored.commands[2].y, -.85-.4);
  assert.equal(inverted.commands.length, 6);
  assert.ok(inverted.commands[0].x > inverted.commands.at(-1).x, "invert reflects the body's x axis");
  near(span(restored), span(normal)); near(restored.commands[1].y, -2.65+.24);
});

test("transform shape scales the zigzag but not the physical overlap or stroke", () => {
  const [fixed, scaled] = fixture("scale");
  assert.equal(fixed.style.lineWidth, scaled.style.lineWidth);
  const pen = fixed.style.lineWidth / TIKZ_UNIT;
  near(span(fixed)-pen, 1.12);
  near(span(scaled)-pen, 1.6*1.12);
});

test("the generic rectangle takes its own dimensions and fill without filling an open zigzag", () => {
  const [yellow, cyan, zig] = fixture("rectangle");
  for (const [i, r] of [yellow, cyan].entries()) {
    assert.equal(r.commands.at(-1).type, "closePath");
    const corners = r.commands.slice(0, -1);
    near(Math.max(...corners.map(p=>p.y)) - Math.min(...corners.map(p=>p.y)), .4*1.4);
    near(Math.max(...corners.map(p=>p.x)) - Math.min(...corners.map(p=>p.x)), [.95,.5][i]*1.4);
    assert.equal(r.style.fill, ["rgb(255 242 0)", "rgb(0 173 239)"][i]);
  }
  assert.equal(zig.style.fill, "none");
});

test("all three resistors in the manual triode amplifier agree with the native first-peak side", () => {
  const rs=parts("circuitikz-tubes/amplifier");
  assert.equal(rs.length,3);
  rs.forEach((r,i) => {
    const [start,peak]=r.commands;
    near(peak.x-start.x,[.21,.21,-.21][i]);
    near(span(r),1.12+r.style.lineWidth/TIKZ_UNIT);
  });
});

test("the package selects a default resistor which a scope or an explicit symbol can override", () => {
  assert.deepEqual(fixture("selection").map(r => r.resistorKind), ["european","american","european","european"]);
});
