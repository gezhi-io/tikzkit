import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { tubeGeometry } from "../src/extensions/circuitikz/tubes.js";

const source = name => fs.readFileSync(new URL(`./fixtures/circuitikz-tubes/${name}.tex`, import.meta.url), "utf8");
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.0001, `${a} != ${b}`);

test("triode cathode and tetrode grids follow the native tube anchors", () => {
  const {ir, diagnostics} = tikzToSvg(source("catalog"));
  assert.deepEqual(diagnostics, []);
  close(ir.coordinates["T.cathode"].x - ir.coordinates.T.x, -.28);
  close(ir.coordinates["T.cathode"].y - ir.coordinates.T.y, -.98);
  close(ir.coordinates["Q.control"].y, -.098);
  close(ir.coordinates["Q.screen"].y, .098);
});

test("tube settings control dimensions, class thickness and terminal positions", () => {
  const {ir, diagnostics} = tikzToSvg(source("settings"));
  assert.deepEqual(diagnostics, []);
  const tube = ir.items.find(item => item.id === "T" && item.type === "nodeBox");
  close(tube.width, 1.4 * .8 * 1.6);
  close(tube.height, 1.4 * .8);
  close(ir.coordinates["T.control"].y, .12 * tube.height / 2);
  close(ir.coordinates["T.cathode 1"].x, -.3 * tube.width / 2);
  close(ir.coordinates["T.cathode 2"].x, .3 * tube.width / 2);
  const pentode = ir.items.find(item => item.id === "P" && item.type === "nodeBox");
  // pgfcirctripoles.tex reads grid keys at anchor lookup, outside the node group.
  close(ir.coordinates["P.control"].y, (-.2 + .12) * pentode.height / 2);
  close(ir.coordinates["P.screen"].y, .12 * pentode.height / 2);
  close(pentode.style.lineWidth / tube.style.lineWidth, 1.5 / 2);
});

test("tube grid anchors read current keys but cathode anchors retain saved dimensions", () => {
  const {ir, diagnostics} = tikzToSvg(String.raw`\begin{tikzpicture}
    \node[pentode] (P) {};
    \ctikzset{tubes/grid separation=.4,tubes/grid shift=.1,tubes/cathode width=.8}
    \coordinate (G) at (P.control);
    \coordinate (C) at (P.cathode);
  \end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  close(ir.coordinates.G.y, -.3 * .98);
  close(ir.coordinates.C.x, -.4 * .7);
});

test("triode uses the shared capsule outline rather than a circular approximation", () => {
  const {svg} = tikzToSvg(source("catalog"));
  assert.match(svg, /tikz-node-circuitikzTube tikz-node-circuitikzTriode/);
  assert.doesNotMatch(svg, /<ellipse class="tikz-node-circuitikzTriode-outline"/);
  assert.match(svg, /tikz-node-circuitikzTube-electrodes/);
});

test("native tube grid lengths, capsule arcs and cathode corners share physical dimensions", () => {
  const geometry = tubeGeometry({width: 1.4, height: 1.96}, "triode");
  assert.equal(geometry.outline.full.filter(c => c[0] === "C").length, 4);
  assert.deepEqual(geometry.electrodes[0], ["M", -.7, 0]);
  close(geometry.electrodes[1][1], -.455);
  const gridLines = geometry.electrodes.slice(0, 12).filter(c => c[0] === "L");
  assert.equal(gridLines.length, 6);
  close(gridLines.at(-1)[1], -.455 + 10 * (1.015 / 11));
  const cathodeCorners = geometry.electrodes.filter(c => c[0] === "C");
  assert.equal(cathodeCorners.length, 2);
  close(cathodeCorners[0][5], -.28 + .06 * .98);
  close(cathodeCorners[1][6], -(.4 + .06) * .98);
  close(geometry.bounds.minX, -.7);
  close(geometry.bounds.maxX, .56);
});

test("tube filament and cathode flags are local, and partial dashes have fixed dimensions", () => {
  const {ir, diagnostics, svg} = tikzToSvg(source("filaments"));
  assert.deepEqual(diagnostics, []);
  const boxes = Object.fromEntries(ir.items.filter(i => i.type === "nodeBox" && i.id).map(i => [i.id, i]));
  assert.equal(boxes.F.shapeData.tubeSettings.filament, true);
  assert.equal(boxes.N.shapeData.tubeSettings.nocathode, true);
  assert.equal(boxes.C.shapeData.tubeSettings.fullcathode, true);
  assert.equal(boxes.P.shapeData.tubeSettings.filament, false);
  close(boxes.F.shapeData.partialBorderDash[0], 3 * 2.54 / 72.27 * 100);
  close(boxes.F.shapeData.partialBorderDash[1], 1 * 2.54 / 72.27 * 100);
  const filament = tubeGeometry(boxes.F, "triode", boxes.F.shapeData.tubeSettings);
  close(ir.coordinates["F.filament 1"].x, filament.anchors["filament 1"].x);
  const noCathode = tubeGeometry(boxes.N, "triode", boxes.N.shapeData.tubeSettings);
  assert.equal(noCathode.electrodes.some(c => c[0] === "C"), false);
  assert.match(svg, /stroke-dasharray="10\.5437\d* 3\.5145\d*"/);
});

test("explicit tube thickness none uses tripole thickness", () => {
  const {ir} = tikzToSvg(String.raw`\begin{tikzpicture}
    \ctikzset{tripoles/thickness=3,tubes/thickness=none}
    \node[triode] {};
  \end{tikzpicture}`);
  close(ir.items.find(item => item.type === "nodeBox").style.lineWidth, 3 * .4 * 2.54 / 72.27 * 100);
});
