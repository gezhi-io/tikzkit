import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { extractBalanced } from "../src/frontend/parser.js";
import { tikzToSvg } from "../src/index.js";
import { computeSvgBounds } from "../src/renderers/svg/bounds.js";

const fixture = fileURLToPath(new URL("./fixtures/automata-arrow-labels.tex", import.meta.url));
const ptPerCm = 72.27 / 2.54;
// Label center (x, y), then the width and height of the entire TikZ picture, in TeX pt.
const native = {
  left: [-39.46907, 0, 65.82152, 25.40002],
  right: [40.55241, 0, 67.98820, 25.40002],
  above: [0, 32.22500, 27.30487, 51.33339],
  below: [0, -40.83609, 27.30487, 59.94447],
  empty: [37.76070, 0, 53.79369, 25.40002],
  styled: [-47.10812, 0, 80.29962, 25.40002],
  statefont: [-39.46907, 0, 65.82152, 25.40002],
  zero: [-16.23299, 0, 32.26598, 25.40002],
  scaled: [52.38570, 0, 78.73814, 25.40002],
  rotated: [26.55244, 12.91663, 52.90489, 32.02501],
  orderA: [0, 32.225, 27.30487, 51.33339],
  orderB: [0, -33.53848, 25.40002, 53.96034],
  every: [-39.57996, 0, 66.04329, 25.40002],
  math: [0, -32.27460, 25.40002, 51.43257],
  shape: [59.20590, 0, 98.63457, 37.90002],
  scope: [29.358, 0, 56.516, 25.40002],
  repeated: [0, -25.70520, 25.40002, 45.21040]
};

function compare(id, observed) {
  observed.forEach((value, i) => assert.ok(Math.abs(value - native[id][i]) < .01,
    `${id} ${["label x", "label y", "page width", "page height"][i]}: ${value} vs ${native[id][i]} TeX pt`));
}

for (const line of readFileSync(fixture, "utf8").split("\n").filter(s => s.startsWith("\\probe{"))) {
  let cursor = "\\probe".length;
  const [id, picture, keys, text] = Array.from({ length: 4 }, () => {
    const group = extractBalanced(line, cursor, "{", "}");
    cursor = group.end;
    return group.content;
  });
  test(`native automata arrow and label rectangle: ${id}`, () => {
    const r = tikzToSvg(String.raw`\usetikzlibrary{automata,arrows.meta}
      \begin{tikzpicture}[>=Stealth,${picture}]\node[state,${keys}] {${text}};\end{tikzpicture}`);
    assert.deepEqual(r.diagnostics, []);
    const arrow = r.ir.items.find(item => item.subtype === "automata-initial" || item.subtype === "automata-accepting");
    assert.ok(arrow, "after-node arrows also work on anonymous states");
    const label = r.ir.items.find(item => item.type === "textNode" && (item.subtype?.endsWith("-text") ||
      (item.retainEmptyLayout && !item.nodeLayoutShape)));
    assert.ok(label, "even a label without ink contributes its rectangle to the picture");
    if (id === "statefont") {
      assert.equal(label.font.sizePt, 10, "state-local text settings end before the arrow path");
      assert.equal(label.style.fill, "black");
    }
    if (id === "styled") assert.equal(label.font.sizePt, 14.4);
    const page = computeSvgBounds(r.ir.items);
    compare(id, [label.x, label.y, page.maxX - page.minX, page.maxY - page.minY].map(n => n * ptPerCm));
  });
}

test("an arrow-local font, text color and pen do not escape into later nodes or paths", () => {
  const r = tikzToSvg(String.raw`\usetikzlibrary{automata}
    \begin{tikzpicture}[every initial by arrow/.style={text=red,font=\Large,line width=2pt}]
      \node[state,initial] {S};
      \node at (2,0) {outside};
      \draw (0,1)--(2,1);
    \end{tikzpicture}`);
  assert.deepEqual(r.diagnostics, []);
  const label = r.ir.items.find(item => item.subtype === "automata-initial-text");
  const outside = r.ir.items.find(item => item.text === "outside");
  assert.equal(label.font.sizePt, 14.4);
  assert.equal(label.style.fill, "red");
  assert.equal(outside.font.sizePt, 10);
  assert.equal(outside.style.fill, "black");
  assert.ok(Math.abs(r.ir.items.at(-1).style.lineWidth / 100 * ptPerCm - .4) < .001);
});

if (process.env.AUTOMATA_PDFLATEX) {
  test("local pdfLaTeX reproduces the automata label centers and picture sizes", () => {
    const dir = mkdtempSync(join(tmpdir(), "tikzkit-automata-labels-"));
    try {
      const log = execFileSync(process.env.AUTOMATA_PDFLATEX,
        ["-no-shell-escape", "-halt-on-error", "-interaction=nonstopmode", fixture], { cwd: dir, encoding: "utf8" });
      for (const id of Object.keys(native)) {
        const observed = ["LABEL", "PAGE"].flatMap(key => {
          const prefix = `${key} ${id}: `;
          return log.split("\n").find(row => row.startsWith(prefix)).slice(prefix.length).split(" ").map(parseFloat);
        });
        compare(id, observed);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
