import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const fixture = name => readFileSync(new URL("./fixtures/circuitikz-source-voltage/" + name + ".tex", import.meta.url), "utf8");
function render(source) {
  const r = tikzToSvg(source);
  assert.deepEqual(r.diagnostics, []);
  return r.ir.items;
}
const ofType = (items, name) => items.filter(i => i.subtype === "circuitikz-" + name);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, a + " != " + b);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const extent = .42 * 1.1 * 1.2;

test("European generators default to forward; only < reverses the shaft, not its label side", () => {
  const all = render(fixture("directions")), shafts = ofType(all, "voltage-arrow");
  assert.equal(shafts.length, 4);
  const directions = [[0,1],[0,1],[1,0],[-2.2,-1.5]];
  shafts.forEach(({commands: [a,b]}, i) => {
    const [x,y] = directions[i];
    near(dist(a,b), 2 * extent / Math.sqrt(3));
    near((b.x - a.x) * x + (b.y - a.y) * y, dist(a,b) * Math.hypot(x,y));
  });
  near(shafts[0].commands[0].x, -extent);
  near(shafts[1].commands[0].x, 2.4 + extent);
  near(shafts[2].commands[0].y, -extent);
});

test("native currarrow uses the tip anchor and the parent pen, including in reversed orientations", () => {
  const all = render(fixture("directions")), shafts = ofType(all,"voltage-arrow"), heads = ofType(all,"voltage-arrow-head");
  assert.equal(heads.length, 4);
  heads.forEach((head,i) => {
    assert.equal(shafts[i].style.markerEnd, undefined);
    assert.deepEqual(head.commands.map(p => p.type), ["moveTo","lineTo","lineTo","lineTo","closePath"]);
    const [base, lower, tip, upper] = head.commands;
    near(dist(tip,shafts[i].commands[1]),0);
    near(dist(base,tip), 1.7 * 1.4 / 16);
    near(dist(lower,upper), 1.6 * 1.4 / 16);
    near(head.style.lineWidth, shafts[i].style.lineWidth);
    assert.equal(head.style.fill, shafts[i].style.stroke);
  });
});

test("voltage shift and class scale move the anchors independently of arrow size; a suppressed arrow keeps its label", () => {
  const all = render(fixture("settings")), shafts = ofType(all, "voltage-arrow"), heads = ofType(all, "voltage-arrow-head");
  assert.equal(shafts.length, 2); assert.equal(heads.length, 2);
  assert.equal(all.filter(i => i.type === "textNode" && i.text === "$E$").length, 1);
  const radius = .42 * .8, border = radius * 1.2;
  near(shafts[0].commands[0].y, 1.3 * border);
  near(shafts[1].commands[0].y, 2 + (1.3 + .5 * .6) * border);
  near(dist(heads[1].commands[2], heads[1].commands[0]), 1.7 * 1.4 / 10);
  const boxes = all.filter(i => i.type === "bbox" && i.subtype === "node-layout");
  const halfDefaultPen = .2 * 2.54 / 72.27;
  for (let i = 0; i < 2; i++) {
    const bottom = Math.min(...boxes[i].commands.filter(p => "y" in p).map(p => p.y));
    near(bottom - halfDefaultPen, shafts[i].commands[0].y + (1.7 - 1.2) * radius);
  }
});

test("a plain European source strokes the entire diameter; a sinusoidal source does not acquire a bar", () => {
  const all = render(fixture("tight")), lines = ofType(all, "voltage-source-line");
  assert.equal(lines.length, 1);
  near(dist(...lines[0].commands), .84);
  assert.ok(ofType(all,"sinusoidal-source-wave").length === 1);
});

test("a 60-degree ray hits the narrow side first; per-shape shifts and scoped tip scales stay independent", () => {
  const all = render(fixture("border")), shafts = ofType(all, "voltage-arrow"), heads = ofType(all, "voltage-arrow-head");
  assert.equal(shafts.length, 2); assert.equal(heads.length, 2);
  const x = 1.8 * .24 / 2 * 1.1 * 1.5, side = x * Math.sqrt(3) + 2 * x * .15;
  near(shafts[0].commands[0].x, 1.5 - x); near(shafts[0].commands[0].y, side);
  near(shafts[1].commands[0].x, 1.5 + x); near(shafts[1].commands[0].y, 2 - side);
  near(dist(heads[0].commands[0], heads[0].commands[2]), 1.7 * 1.8 / 16);
  near(dist(heads[1].commands[0], heads[1].commands[2]), 1.7 * 1.8 / 8);
  const box = all.find(i => i.type === "bbox");
  near(box.commands[0].y, side + (1.8 - 1.2) * .9 * 1.8 / 2 + .2 * 2.54 / 72.27);
  assert.notEqual(ofType(all,"voltage-source")[0].style.fill, "none");
});
