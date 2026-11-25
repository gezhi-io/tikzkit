import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { computeSvgBounds } from "../src/renderers/svg/bounds.js";

const ptPerCm = 72.27 / 2.54;
function picture(body) {
  const r = tikzToSvg("\\begin{tikzpicture}" + body + "\\end{tikzpicture}", { margin: 0 });
  assert.deepEqual(r.diagnostics, []);
  const bounds = computeSvgBounds(r.ir.items);
  return { ...r, bounds, width: (bounds.maxX - bounds.minX) * ptPerCm,
    height: (bounds.maxY - bounds.minY) * ptPerCm };
}
function near(actual, native) {
  assert.ok(Math.abs(actual - native) < .003, actual + " vs " + native + " TeX pt");
}

test("bipole leads meet saved node borders without moving the capacitor or an explicit center", () => {
  const source = readFileSync(new URL("./fixtures/empty-node-boundaries/leads.tex", import.meta.url), "utf8");
  const r = tikzToSvg(source);
  assert.deepEqual(r.diagnostics, []);
  const wires = r.ir.items.filter(i => i.type === "path" && !i.subtype);
  const blue = wires.find(p => p.style.stroke === "blue").commands;
  near(blue[0].x * ptPerCm, .7 * ptPerCm + 2);
  near(blue.at(-1).x * ptPerCm, 3.6 * ptPerCm - 1);
  near((blue[1].x + blue[2].x) * ptPerCm / 2, 2 * ptPerCm);
  const orange = wires.find(p => p.style.stroke === "rgb(255 128 0)").commands;
  near(orange[0].y * ptPerCm, .5 * ptPerCm + 1);
  near(orange.at(-1).y * ptPerCm, .25 * ptPerCm + 2);
  const explicit = wires.find(p => p.style.stroke === "red").commands[0];
  assert.deepEqual([explicit.x, explicit.y], [0, 0]);
});

// Independent pdfTeX box measurements: fixtures/empty-node-boundary-metrics.tex.
test("an unpainted empty rectangle sets the page without painting a rectangle or glyph", () => {
  const r = picture(String.raw`\node (a) at (3,2) {};`);
  near(r.width, 6.66595); near(r.height, 6.66595);
  near((r.bounds.maxX + r.bounds.minX) * ptPerCm / 2, 3 * ptPerCm);
  assert.equal(r.ir.items.length, 1);
  assert.doesNotMatch(r.svg, /<(?:rect|path|text)\b/);
});
test("both empty terminal boxes survive an ordinary path", () => {
  const r = picture(String.raw`\draw (0,0) node (a) {} -- (0,2) node (b) {};`);
  near(r.width, 6.66595); near(r.height, 63.57144);
});
test("rotate the unpainted background rectangle, not its outer separation", () => {
  const r = picture(String.raw`\node[rotate=30,inner xsep=12pt,inner ysep=4pt,outer sep=9pt] {};`);
  near(r.width, 24.78467); near(r.height, 18.92822);
});
test("the one-point minimum and axis-specific overrides follow PGF key order", () => {
  for (const [keys, w, h] of [["",1,1], [",minimum size=14pt,minimum width=3pt",3,14],
    [",minimum width=3pt,minimum size=14pt",14,14]]) {
    const r = picture("\\node[inner sep=0pt" + keys + "] {};");
    near(r.width, w); near(r.height, h);
  }
});
test("zero-sized rectangles can extend a page to a point; overlays and coordinates cannot", () => {
  const stroke = String.raw`\draw (0,0) -- (1,1);`;
  const r = picture(stroke + String.raw`\node[inner sep=0pt,minimum size=0pt] at (2,2) {};`);
  near(r.bounds.maxX * ptPerCm, 2 * ptPerCm); near(r.bounds.maxY * ptPerCm, 2 * ptPerCm);
  const control = picture(stroke + String.raw`\node[overlay] at (-9,8) {}; \coordinate (far) at (5,9); \node[shape=coordinate] at (5,9) {};`);
  near(control.width, 28.85274); near(control.height, 28.85274);
});

test("an isolated zero-sized logical rectangle leaves only the standalone border", () => {
  const body = String.raw`\node[inner sep=0pt,minimum size=0pt] at (2,3) {};`;
  const r = picture(body);
  assert.deepEqual(r.bounds, { minX: 2, minY: 3, maxX: 2, maxY: 3 });
  const bordered = tikzToSvg(String.raw`\documentclass[border=2pt]{standalone}\usepackage{tikz}\begin{document}\begin{tikzpicture}` +
    body + String.raw`\end{tikzpicture}\end{document}`);
  const [, w, h] = bordered.svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/);
  near(Number(w) * 72.27 / 72, 4); near(Number(h) * 72.27 / 72, 4);
});
