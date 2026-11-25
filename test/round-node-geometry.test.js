import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { tikzToSvg } from "../src/index.js";
import { isRoundNode, roundNodeSize } from "../src/tikz/roundNodeGeometry.js";

const cmPerPt = 2.54 / 72.27, sp = 65536;
const inSp = (...values) => values.map(v => v / sp);
// Inputs in TeX pt: wd, ht+dp, xsep, ysep, min width, min height, optional dp.
// Expected sp: circle diameter, ellipse width, ellipse height. These are
// measured from native cardinal anchors in fixtures/round-node-radii.tex.
const controls = [
  ["wide", [84.5, 4.75, 2.375, .875, 0, 0], [5849088, 8271868, 602432]],
  ["tall", [1.75, 57.25, .625, 3.125, 0, 0], [4161536, 278046, 5885306]],
  ["bucket-wide", [41.5, 7, 2, 1.5, 0, 0], [3053440, 4217030, 926820]],
  ["bucket-tall", [5.5, 98.5, 2, 4.5, 0, 0], [7045120, 880478, 9963314]],
  ["padded", [13, 6, 3.25, 6.5, 0, 0], [1778016, 1807298, 1760958]],
  ["x-min", [5.25, 9, .75, 1, 25.25, 3], [1654784, 1654784, 1019502]],
  ["y-min", [7, 3.25, 2.75, .5, 3, 29.75], [1949696, 1158524, 1949696]],
  ["zero", [0, 0, 0, 0, 0, 0], [0, 0, 0]],
  ["padding-only", [0, 0, 3.5, 1.25, 0, 0], [485280, 648774, 231704]],
  ["empty-min", [0, 0, 0, 0, 1, 2], [131072, 65536, 131072]],
  ["odd-min", inSp(0, 0, 0, 0, 101, 99), [100, 100, 98]],
  ["signed-sep", [4, 6, -11, 0, 0, 0], [1242752, 0, 556092]],
  ["axis", [10, 0, 0, 0, 0, 0], [652800, 926820, 0]],
  ["vertical", [0, 0, 0, 60, 0, 0], [7833696, 0, 11121840]],
  ["flat-negative", [0, 0, -100, 0, 0, 0], [0, 0, 0]],
  ["wide-extreme", [0, 0, 512, 1 / sp, 0, 0], [66847712, 94906368, 2]],
  ["tall-extreme", [0, 0, 1 / sp, 512, 0, 0], [66847712, 2, 94906368]],
  ["tiny-65", inSp(0, 0, 10, 65, 0, 0), [0, 28, 182]],
  ["tiny-66", inSp(0, 0, 10, 66, 0, 0), [128, 28, 186]],
  ["odd-sp", inSp(823119, 210025, 17001, 27015, 0, 0), [895584, 1212152, 373428]],
  ["split-even", [2, 393236 / sp, .25, .5, 0, 0, 131092 / sp], [485312, 231704, 648802]],
  ["split-odd", [2, 393236 / sp, .25, .5, 0, 0, 131091 / sp], [485280, 231704, 648798]],
  ["split-no-depth", [2, 393235 / sp, .25, .5, 0, 0], [485280, 231704, 648798]],
  ["split-negative", [2, 393235 / sp, .25, .5, 0, 0, -65537 / sp], [485312, 231704, 648802]]
];
const nativeErrorControls = [
  ["zero-divisor-y", [0, 0, -100, .1, 0, 0], [3355648, 0, 18536]],
  ["zero-divisor-x", [0, 0, .1, -100, 0, 0], [3355648, 18536, 0]],
  ["both-negative", [0, 0, -100, -.1, 0, 0], [0, 0, 0]],
  ["oversized-register", [0, 0, 1100, 1 / sp, 0, 0], [133695456, 203900400, 2]]
];

test("isRoundNode recognizes only the two literal ordinary shape names", () => {
  for (const shape of ["circle", "ellipse"]) assert.equal(isRoundNode(shape), true);
  for (const shape of [undefined, null, "", "Circle", " ellipse", "double circle", "circle split", { shape: "circle" }])
    assert.equal(isRoundNode(shape), false);
  assert.throws(() => roundNodeSize("rectangle", {}), /circle or ellipse/);
});

for (const [name, dimensions, [diameter, ellipseW, ellipseH]] of [...controls, ...nativeErrorControls]) {
  test("round node centerline diameters match pdfLaTeX: " + name, () => {
    const [width, height, innerX, innerY, minWidth, minHeight, depth] = dimensions.map(v => v * cmPerPt);
    for (const [shape, w, h] of [["circle", diameter, diameter], ["ellipse", ellipseW, ellipseH]]) {
      const size = roundNodeSize(shape, { width, height, depth, innerX, innerY, minWidth, minHeight });
      for (const [key, expected] of [["width", w], ["height", h]]) {
        const actual = size[key] / cmPerPt * sp;
        assert.ok(Math.abs(actual - expected) < 1e-7, shape + " " + key + ": " + actual + " vs " + expected + "sp");
      }
    }
  });
}

test("public TikZ conversion continues after zero axes, signed padding and extreme aspect ratios", () => {
  const cases = ["zero", "flat-negative", "axis", "vertical", "signed-sep", "wide-extreme", "tall-extreme", "tiny-65", "tiny-66"];
  for (const [name, [w, h, xsep, ysep], [d, ew, eh]] of [...controls.filter(c => cases.includes(c[0])), ...nativeErrorControls]) {
    const text = w || h ? "T" : "";
    const box = text ? ",text width=" + w + "pt,text height=" + h + "pt,text depth=0pt" : "";
    for (const shape of ["circle", "ellipse"]) {
      const source = "\\usetikzlibrary{shapes.geometric}\\begin{tikzpicture}\\node[draw," + shape + box +
        ",inner xsep=" + xsep + "pt,inner ysep=" + ysep + "pt,outer sep=0pt,minimum size=0pt] {" + text + "};" +
        "\\draw[red] (0pt,0pt)--(2pt,0pt);\\end{tikzpicture}";
      const result = tikzToSvg(source, { fontUrlPrefix: "../fonts/" });
      if (cases.includes(name) || shape === "ellipse") assert.deepEqual(result.diagnostics, [], name + " " + shape);
      assert.doesNotMatch(result.svg, /NaN|Infinity/);
      const node = result.ir.items.find(i => i.type === "nodeBox");
      assert.ok(node, name + ": lost node");
      assert.deepEqual([node.width, node.height].map(v => Math.round(v / cmPerPt * sp)),
        shape === "circle" ? [d, d] : [ew, eh], name + " " + shape);
      assert.ok(result.ir.items.some(i => i.type === "path" && i.style.stroke === "red"), name + ": lost subsequent draw");
    }
  }
});

// Normal unit runs need no TeX installation; this mode remeasures the goldens.
test("remeasure native circle/ellipse anchor spans with pdfLaTeX", { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "tikzkit-round-radii-"));
  try {
    const fixture = fileURLToPath(new URL("./fixtures/round-node-radii.tex", import.meta.url));
    for (const recover of [false, true]) {
      const args = recover ? ["\\def\\RoundNodeErrorProbes{1}\\input{" + fixture.replaceAll("\\", "/") + "}"] :
        ["-halt-on-error", fixture];
      const result = spawnSync("pdflatex", ["-no-shell-escape", "-interaction=nonstopmode", "-output-directory=" + dir,
        ...args], { encoding: "utf8" });
      if (result.error) throw result.error;
      assert.equal(result.status, recover ? 1 : 0, result.stdout);
      const errors = [...result.stdout.matchAll(/^! (.+)$/gm)].map(m => m[1]);
      assert.deepEqual(errors, recover ? [...Array(3).fill("Arithmetic overflow."), "Dimension too large."] : []);
      const measured = [...result.stdout.matchAll(/^ROUNDNODE ([\w-]+) (circle|ellipse) (\d+) (\d+)$/gm)]
        .map(([, name, shape, w, h]) => [name, shape, Number(w), Number(h)]);
      const wanted = recover ? [...controls, ...nativeErrorControls] : controls;
      assert.deepEqual(measured, wanted.flatMap(([name, , [d, w, h]]) =>
        [[name, "circle", d, d], [name, "ellipse", w, h]]));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
