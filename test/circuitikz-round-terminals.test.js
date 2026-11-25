import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { TIKZ_UNIT } from "../src/tikz/metrics.js";

const controls = readFileSync(new URL("./fixtures/circuitikz-round-terminals.tex", import.meta.url), "utf8");
const ptPerCm = 72.27 / 2.54;
const nativeRadius = 104404 / 65536; // circ and ocirc: .04 * the 1.4cm Rlen register
const near = (a, b, tolerance = .00005) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function draw(source) {
  const { ir, diagnostics } = tikzToSvg(source);
  assert.deepEqual(diagnostics, []);
  return ir.items;
}
const poles = items => items.filter(i => ["circuitikz-terminal-dot", "circuitikz-terminal-open"].includes(i.subtype));
const pairAt = (items, row) => poles(items).slice(2 * row, 2 * row + 2);

// Measurements from the actual paths in the native probe, before the SVG
// driver's common pt-to-bp transform. Its pen-up move back to center paints
// nothing. Compare the four actual cubics, not just radius metadata.
function expectGeometry(pair, rxPt, ryPt = rxPt, penPt = .4) {
  assert.equal(pair.length, 2);
  for (const p of pair) {
    assert.deepEqual(p.commands.map(c => c.type), ["moveTo", ...Array(4).fill("curveTo"), "closePath"]);
    const [east, north, west, south] = p.commands;
    near((east.x - p.cx) * ptPerCm, rxPt);
    near((p.cx - west.x) * ptPerCm, rxPt);
    near((north.y - p.cy) * ptPerCm, ryPt);
    near((p.cy - south.y) * ptPerCm, ryPt);
    near((north.y1 - p.cy) * ptPerCm, .5522847 * ryPt);
    near(p.style.lineWidth * ptPerCm / TIKZ_UNIT, penPt);
  }
}

test("the eight literal-list *-o spokes paint each lead and resistor before both stroked poles", () => {
  for (const mode of ["straight", "rotate", "smart"]) {
    const items = draw(String.raw`\begin{circuitikz}
      \ctikzset{label/align=${mode}}
      \foreach \i in {0,45,90,135,180,-90,-45,-135} {\draw (0,0) to[R=\i,*-o] (\i:2.5);}
    \end{circuitikz}`);
    const pairs = poles(items);
    assert.equal(pairs.length, 16);
    const resistors = items.filter(i => i.subtype === "circuitikz-resistor");
    const leads = items.filter(i => i.type === "path" && !i.subtype);
    assert.equal(resistors.length, 8);
    assert.equal(leads.length, 8);
    for (let i = 0; i < 8; i++) {
      const pair = pairs.slice(2 * i, 2 * i + 2), [dot, open] = pair;
      assert.ok(items.indexOf(leads[i]) < items.indexOf(resistors[i]));
      assert.ok(items.indexOf(resistors[i]) < items.indexOf(dot), "poles must cover the completed lead and body");
      assert.ok(items.indexOf(dot) < items.indexOf(open));
      assert.deepEqual(pair.map(p => [p.style.stroke, p.style.fill]), [["black", "black"], ["black", "white"]]);
      const angle = [0, 45, 90, 135, 180, -90, -45, -135][i] * Math.PI / 180;
      near(dot.cx, 0); near(dot.cy, 0);
      near(open.cx, 2.5 * Math.cos(angle), .0002); near(open.cy, 2.5 * Math.sin(angle), .0002);
      expectGeometry(pair, nativeRadius);
    }
  }
});

test("coordinate scaling moves poles; transform shape scales both axes independently but not the pen", () => {
  const items = draw(controls);
  for (const [row, rx, ry] of [[0, 1, 1], [1, 1, 1], [2, 2, 2], [3, 2, .5]]) {
    const pair = pairAt(items, row);
    near(pair[1].cx, 3); near(pair[1].cy, -row);
    expectGeometry(pair, rx * nativeRadius, ry * nativeRadius);
  }
});

test("scoped nodes width and unscaled Rlen set both radii; component-local keys do not leak", () => {
  const items = draw(controls);
  expectGeometry(pairAt(items, 4), 298355 / 65536, 298355 / 65536, .8);
  expectGeometry(pairAt(items, 5), 298355 / 65536, 298355 / 65536, 0);
  expectGeometry(pairAt(items, 6), 372958 / 65536);
  expectGeometry(pairAt(items, 7), nativeRadius);
});

test("native pole fill, stroke, and opacity resolve independently of body fill and wire opacity", () => {
  const items = draw(controls);
  function paint(row) {
    return pairAt(items, row).map(({style: s}) => {
      assert.equal(s.opacity ?? 1, 1, "path opacity must not attenuate pole fill again");
      return [s.stroke, s.fill, s.fillOpacity ?? 1, s.strokeOpacity ?? 1];
    });
  }
  assert.deepEqual(paint(4), [["blue", "blue", .5, 1], ["blue", "rgb(0 255 0)", .25, 1]]);
  assert.deepEqual(paint(5), [["red", "red", .5, 1], ["red", "blue", .25, 1]]);
  assert.deepEqual(paint(6), [["red", "red", .9, .6], ["red", "blue", .8, .6]]);
  assert.deepEqual(paint(7), [["red", "red", 1, 1], ["red", "rgb(0 255 0)", 1, 1]]);
  // Unpatched CircuitikZ tracks explicit color= and draw= for full-pole
  // fill, not a bare [red]. A to-local draw= affects tracked ink, not the pen.
  assert.deepEqual(paint(8), [["red", "black", 1, .4], ["red", "white", 1, .4]]);
  assert.deepEqual(paint(9), [["red", "blue", 1, 1], ["red", "white", 1, 1]]);
  assert.ok(pairAt(items, 9).every(p => p.style.dashArray?.length));
  assert.deepEqual(paint(10), [["blue", "blue", 1, 1], ["blue", "white", 1, 1]]);
  assert.deepEqual(paint(11), [["black", "black", 1, 1], ["black", "red", 1, 1]]);
});
