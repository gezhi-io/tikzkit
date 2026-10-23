import assert from "node:assert/strict";
import test from "node:test";
import { normalizeColor, colorToRgb } from "../src/engine/options.js";
import { tikzToSvg } from "../src/index.js";

test("xcolor gray names keep their native intensity with or without a mix", () => {
  // xcolor.sty declares these as gray .25 and .75, not the CSS named colors.
  for (const [name, byte] of [["darkgray", 64], ["lightgray", 191]]) {
    assert.equal(normalizeColor(name), `rgb(${byte} ${byte} ${byte})`);
    assert.equal(normalizeColor(`${name}!100`), normalizeColor(name));
    assert.deepEqual(colorToRgb(name), [byte, byte, byte]);
  }
});

test("dvips named colors retain their case and natural CMYK model in mixes", () => {
  for (const name of ["Blue", "Green", "Red", "WildStrawberry", "Sepia", "LimeGreen", "SkyBlue", "SpringGreen"]) {
    assert.equal(normalizeColor(`${name}!100`), normalizeColor(name), name);
    assert.deepEqual(colorToRgb(name), normalizeColor(name).match(/\d+/g).map(Number));
  }
  assert.notEqual(normalizeColor("Green!50!white"), normalizeColor("green!50!white"));
  assert.equal(normalizeColor("Green!0!Blue"), normalizeColor("Blue"));
  // Local pdflatex + tikztosvg: rgb(52.6474%, 46.763611%, 76.469421%).
  assert.equal(normalizeColor("Blue!50!white"), "rgb(134 119 195)");
});

test("unknown color names do not resolve Object prototype properties", () => {
  for (const name of ["constructor", "__proto__", "toString"]) {
    assert.equal(normalizeColor(name), "black");
    assert.equal(normalizeColor(`${name}!50`), "black");
    assert.equal(colorToRgb(name), null);
  }
});

test("explicit color definitions continue to override built-in names", () => {
  const result = tikzToSvg(String.raw`\definecolor{yellow}{HTML}{cccc00}
    \begin{tikzpicture}\fill[yellow] (0,0) rectangle (1,1);\end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.find(item => item.type === "path").style.fill, "#cccc00");
});

test("natural-model palette matches local pdflatex and tikztosvg", () => {
  // xcolor-natural-models.tex records these independently of this evaluator.
  const palette = {
    yellow: [255, 242, 0], "yellow!90!black": [232, 222, 23], "yellow!30": [255, 251, 179],
    green: [0, 255, 0], purple: [191, 0, 64], orange: [255, 128, 0],
    "cyan!50": [128, 214, 247], "cyan!20": [204, 239, 252],
    "gray!50": [191, 191, 191], "gray!70!black": [89, 89, 89], "cyan!50!orange": [131, 165, 131]
  };
  for (const [color, rgb] of Object.entries(palette)) {
    assert.equal(normalizeColor(color), `rgb(${rgb.join(" ")})`, color);
  }
});
