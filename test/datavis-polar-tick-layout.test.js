import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

test("clean polar tick labels use native directions, node separation and both radius origins", () => {
  const source = readFileSync(new URL("fixtures/remaining-layout-failures/polar-degrees.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  const labels = result.ir.items.filter(item => item.type === "textNode");
  const pt = 72.27 / 2.54;
  // Independent anchors from fixtures/polar-tick-metrics.tex, in canvas pt.
  for (const [text, x, y] of [
    [String.raw`$0^\circ$`, 42.41039, 0],
    [String.raw`$30^\circ$`, 39.78569, 23.2345],
    [String.raw`$60^\circ$`, 26.809, 36.21118],
    [String.raw`$90^\circ$`, 0, 40.9609]
  ]) {
    const node = labels.find(item => item.text === text);
    assert.ok(node);
    assert.ok(Math.abs(node.x * pt - x) < .005, `${text} x: ${node.x * pt} vs ${x}`);
    assert.ok(Math.abs(node.y * pt - y) < .005, `${text} y: ${node.y * pt} vs ${y}`);
  }
  const zeros = labels.filter(item => item.text === "0");
  assert.equal(zeros.length, 2);
  assert.ok(zeros.some(node => Math.abs(node.x) < 1e-6 && Math.abs(node.y * pt + 12.24373) < .005));
  assert.ok(zeros.some(node => Math.abs(node.y) < 1e-6 && Math.abs(node.x * pt + 11.79099) < .005));
});

test("radian tick positions retain numeric precision until canvas projection", () => {
  const source = readFileSync(new URL("fixtures/remaining-layout-failures/polar-half-plane.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  const labels = result.ir.items.filter(item => item.type === "textNode").slice(0, 13);
  // MacTeX probe: fixtures/polar-half-plane-metrics.tex, node centers in pt.
  const centers = [
    [104.26244, 0], [106.19727, 33.54538], [94.42683, 57.53748],
    [78.61884, 78.13727], [58.01903, 93.9468], [35.86177, 103.88243],
    [0.00151, 107.2732], [-35.85873, 103.88391], [-58.01602, 93.9468],
    [-78.6158, 78.1403], [-94.42531, 57.5405], [-106.19727, 33.54991],
    [-104.71994, 0.00299]
  ];
  assert.equal(labels.length, centers.length);
  for (const [i, [x, y]] of centers.entries()) {
    const node = labels[i];
    assert.ok(Math.abs(node.x * 72.27 / 2.54 - x) < .005, `${node.text} native x`);
    assert.ok(Math.abs(node.y * 72.27 / 2.54 - y) < .005, `${node.text} native y`);
  }
});

test("polar outside legends measure their actual axis bounds and keep labels black", () => {
  const source = readFileSync(new URL("fixtures/remaining-layout-failures/polar-half-plane.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  const labels = result.ir.items.filter(item => item.type === "textNode" && item.text.includes("1+\\"));
  assert.equal(labels.length, 2);
  assert.ok(labels.every(node => node.style.textFill === "black"));
  assert.ok(!JSON.stringify(result.ast).includes('"axis bounds"'));
});

test("polar boundary arcs preserve PGF unit-arc controls and the mapped radian endpoint", () => {
  const source = readFileSync(new URL("fixtures/remaining-layout-failures/polar-half-plane.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source);
  const arc = result.ir.items.find(item => item.subtype === "axis-clean-boundary" && item.commands.some(command => command.type === "curveTo"));
  // Native soft path from polar-half-plane-metrics.tex, not the JS renderer.
  const expected = [
    { x: 97.47145, y: 0 },
    { x1: 97.47145, y1: 53.83269, x2: 53.83269, y2: 97.47145, x: 0, y: 97.47145 },
    { x1: -53.82524, y1: 97.47145, x2: -97.46848, y2: 53.82672, x: -97.46996, y: .00296 }
  ];
  assert.equal(arc.commands.length, expected.length);
  for (const [i, coordinates] of expected.entries()) {
    for (const [key, value] of Object.entries(coordinates)) {
      assert.ok(Math.abs(arc.commands[i][key] * 72.27 / 2.54 - value) < .002, `arc ${i} ${key}`);
    }
  }
});

test("clean polar axes paint the pale maximum-radius axis independently of its grid arc", () => {
  const source = readFileSync(new URL("fixtures/remaining-layout-failures/polar-half-plane.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source);
  const maximumArcs = result.ir.items.filter(item => item.shape === "arc" &&
    item.style.stroke === "rgb(191 191 191)" && Math.abs(item.commands[0].x - 3.25) < .001);
  // clean/.style declares both visualize grid and visualize axis at radius=max.
  assert.equal(maximumArcs.length, 2);
  assert.deepEqual(maximumArcs.map(item => item.subtype).sort(), ["axis-grid-line", "axis-line"]);
  assert.ok(maximumArcs.some(item => item.style.lineCap === "square"));
  assert.ok(maximumArcs.some(item => !item.style.lineCap || item.style.lineCap === "butt"));
});
