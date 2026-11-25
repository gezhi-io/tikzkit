import assert from "node:assert/strict";
import test from "node:test";
import { potentiometerWiperItems } from "../src/extensions/circuitikz/wiperArrow.js";
import { TIKZ_UNIT } from "../src/tikz/metrics.js";

const pt = 2.54 / 72.27, bp = 2.54 / 72;
const anchors = { wiper: { x: 1.5, y: .56 }, tip: { x: 1.5, y: .21 } };
const pen = n => n * pt * TIKZ_UNIT;
const near = (a, b, tolerance) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b} (+/- ${tolerance})`);
const fromTip = (x, y) => [(x - anchors.tip.x) / bp, (anchors.tip.y - y) / bp];

test("both potentiometers match the native shaft cut and all three filled latexslim cubics", () => {
  // pdfTeX tikztosvg -p circuitikz: (0,0) to[american/european potentiometer]
  // (3,0). Measured in output bp relative to the nose; Cairo rounds to 1/256 bp.
  const cases = [
    ["american", .8, 3.109375, [[.25781,-1.29687],[.77734,-3.625],[1.94141,-5.17969],
      [.51953,-3.88672],[-.51953,-3.88672],[-1.94141,-5.17969],[-.77734,-3.625],[-.25781,-1.29687],[0,0]]],
    ["european", .4, 2.394531, [[.19922,-1],[.59766,-2.79297],[1.49609,-3.98828],
      [.39844,-2.99219],[-.39844,-2.99219],[-1.49219,-3.98828],[-.59766,-2.79297],[-.19922,-1],[0,0]]]
  ];
  for (const [kind, width, cut, controls] of cases) {
    const [shaft, head, ...extra] = potentiometerWiperItems(anchors, { kind }, { lineWidth: pen(.4) });
    assert.deepEqual(extra, []);
    assert.deepEqual(shaft.commands[0], { type: "moveTo", ...anchors.wiper });
    near((shaft.commands[1].y - anchors.tip.y) / bp, cut, .004);
    near(shaft.style.lineWidth, pen(width), .0002);
    assert.deepEqual(head.commands.map(c => c.type), ["moveTo", "curveTo", "curveTo", "curveTo", "closePath"]);
    near(head.commands[0].x, anchors.tip.x, .000001); near(head.commands[0].y, anchors.tip.y, .000001);
    const actual = head.commands.slice(1, 4).flatMap(c => [fromTip(c.x1,c.y1), fromTip(c.x2,c.y2), fromTip(c.x,c.y)]);
    actual.forEach(([x,y], i) => { near(x, controls[i][0], .004); near(y, controls[i][1], .004); });
    assert.equal(head.style.stroke, "none");
    assert.ok(shaft.paintAfterPath && head.paintAfterPath);
  }
});

test("the American modifier multiplies the body pen; the European shaft restores the wire pen", () => {
  const pathStyle = { stroke: "blue", fill: "green", lineWidth: pen(1), lineCap: "round",
    lineJoin: "miter", dashArray: [4, 2], strokeOpacity: .7, fillOpacity: .25,
    markerStart: {kind:"stealth"}, markerEnd: {kind:"latex"}, shortenStart: 5, shortenEnd: 10 };
  const settings = { thickness: 3, modifierThickness: .5 };
  for (const [kind, width, join] of [["american", 1.5, "bevel"], ["european", 1, "miter"]]) {
    const [shaft, head] = potentiometerWiperItems(anchors, { ...settings, kind }, pathStyle);
    near(shaft.style.lineWidth, pen(width), .0002);
    near((shaft.commands[1].y - anchors.tip.y) / pt, 6 * (.28 + .3 * width), .0003);
    assert.equal(shaft.style.lineJoin, join); assert.equal(shaft.style.lineCap, "round");
    assert.deepEqual(shaft.style.dashArray, [4, 2]);
    assert.equal(shaft.style.stroke, "blue"); assert.equal(shaft.style.fill, "none");
    assert.equal(shaft.style.strokeOpacity, .7); assert.equal(head.style.fillOpacity, .25);
    assert.equal(head.style.fill, "green");
    for (const item of [shaft, head]) {
      assert.equal(item.style.markerStart, undefined); assert.equal(item.style.markerEnd, undefined);
      assert.ok(!item.style.shortenStart && !item.style.shortenEnd);
    }
  }
  assert.equal(potentiometerWiperItems(anchors, {}, {stroke:"blue"})[1].style.fill, "black");
  const colored = potentiometerWiperItems(anchors, {color:"red"}, pathStyle);
  assert.equal(colored[0].style.stroke, "red"); assert.equal(colored[1].style.fill, "red");
  assert.equal(potentiometerWiperItems(anchors, {wiperHeadFill:"blue"}, {})[1].style.fill, "blue");
  const [resolved] = potentiometerWiperItems(anchors, { ...settings, wiperThickness: .75 }, pathStyle);
  near(resolved.style.lineWidth, pen(.75), .0002);
});

test("empty, start, and reversed family tips use their native endpoints and extents", () => {
  const line = { wiper: {x:0,y:0}, tip:{x:12*pt,y:0} };
  const [plain, ...heads] = potentiometerWiperItems(line, {wiperEndArrow:"{}"}, {});
  assert.deepEqual(heads, []); assert.deepEqual(plain.commands[1], {type:"lineTo", ...line.tip});
  const [shaft, start, end] = potentiometerWiperItems(line, {
    wiperStartArrow:"latexslim", wiperEndArrow:"latexslim reversed"
  }, {});
  near(shaft.commands[0].x / pt, 3.12, .0003); near(shaft.commands[1].x / pt, 12 - 2.08, .0003);
  near(start.commands[0].x / pt, 0, .0001);
  near(end.commands[0].x / pt, 12 - 5.2, .0003); near(end.commands[1].x / pt, 12, .0001);
});

test("short and coincident wipers keep native shortening order and zero-direction normalization", () => {
  const [shaft, start, end] = potentiometerWiperItems({wiper:{x:0,y:0}, tip:{x:pt,y:0}},
    {wiperStartArrow:"latexslim"}, {});
  near(shaft.commands[0].x / pt, -3.12, .0003); near(shaft.commands[1].x / pt, 1 - 3.12, .0003);
  assert.ok(start.commands[1].x < start.commands[0].x && end.commands[1].x < end.commands[0].x);
  const [zero, head] = potentiometerWiperItems({ wiper:{x:0,y:0}, tip:{x:0,y:0} }, {}, {lineWidth:0});
  near(zero.commands[1].y / pt, 6 * .28, .0003);
  near(head.commands[1].y / pt, -10 * .28, .0003);
  assert.equal(zero.style.lineWidth, 0);
});

test("scaled anchors alone leave the head physical; a uniform backend canvas scales it with the pen", () => {
  const doubled = {wiper:{x:3,y:1.12}, tip:{x:3,y:.42}};
  const [physical] = potentiometerWiperItems(doubled, {}, {lineWidth:pen(.4)});
  const [canvas] = potentiometerWiperItems(doubled, {canvasScale:2}, {lineWidth:pen(.8)});
  near((physical.commands[1].y - doubled.tip.y) / pt, 3.12, .0003);
  near((canvas.commands[1].y - doubled.tip.y) / pt, 6.24, .0005);
});
