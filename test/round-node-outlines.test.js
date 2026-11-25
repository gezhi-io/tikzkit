import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { computeSvgBounds } from "../src/renderers/svg/bounds.js";
import { TIKZ_UNIT } from "../src/tikz/metrics.js";
import { radiusSpByMinimum } from "./helpers/round-node-minima.js";

const pt = 72.27 / 2.54;
const fixture = fileURLToPath(new URL("./fixtures/round-node-outlines.tex", import.meta.url));
const cases = [...readFileSync(fixture, "utf8").matchAll(/^\\probe(?:\[([^\]]*)\])?\{(\w+)\}\{([^{}]+)\}\{([^{}]*)\}$/gm)];
const anchors = ["east", "north", "north east", "45"];
// Original pdfLaTeX: page, cardinal anchors, named diagonal, numeric border ray (TeX pt).
const measured = {
  circle: [34,34,23,0,0,23,16.26347,16.26347,16.26347,16.26347],
  ellipse: [64,34,38,0,0,17,26.87009,12.02083,15.51694,15.51727],
  lastsep: [30.4,30.4,16,0,0,16,11.31372,11.31372,11.31372,11.31372],
  state: [29.60004,29.60004,13.80002,0,0,13.80002,9.75809,9.75809,9.75809,9.75809],
  override: [29.60004,29.60004,15.50002,0,0,15.50002,10.96017,10.96017,10.96017,10.96017],
  color: [37,37,16,0,0,16,11.31372,11.31372,11.31372,11.31372],
  rotate: [64.24603,47.44930,27.71289,16,-8.5,14.72247,13.58560,21.72409,5.49518,20.50758],
  invisible: [60.24603,43.44930,26.15404,15.09999,-7.59999,13.16362,13.11970,19.98541,4.96942,18.54585],
  silent: [32.92911,32.92911,10.74803,10.74803,-10.74803,10.74803,0,15.20001,0,15.20001],
  scaled: [97,52,46.5,0,0,24,32.8805,16.97058,21.32503,21.32593],
  localscale: [92,47,46.5,0,0,24,32.8805,16.97058,21.32503,21.32593],
  negative: [60.4,30.4,28,0,0,13,19.79901,9.1924,11.79071,11.79077],
  textcircle: [35.22665,35.22665,17.61333,0,0,17.61333,12.45451,12.45451,12.45451,12.45451],
  textellipse: [10.2995,22.94882,5.14975,0,0,11.47441,3.64142,8.11363,4.69807,4.69806],
  depth: [24.6832,24.6832,12.3416,0,0,12.3416,8.72684,8.72684,8.72684,8.72684],
  reverse: [60.24603,44.349,26.15404,-15.09999,7.59999,13.16362,23.86772,-1.36923,18.54587,4.96931],
  quadrant: [54.14233,54.14233,-21.35464,21.35464,-10.74803,-10.74803,-22.70003,7.50002,-19.20007,.00006]
};

function near(actual, expected, label, tolerance = .003) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} instead of ${expected} TeX pt`);
}

for (const [, picture, id, keys, content] of cases) {
  test(`native round outline: ${id}`, () => {
    const r = tikzToSvg(`\\usetikzlibrary{shapes.geometric,automata}
      \\begin{tikzpicture}[${picture ?? ""}]
      \\node[${keys}] (N) {${content}};
      ${anchors.map((a, i) => `\\coordinate[overlay] (probe${i}) at (N.${a});`).join("\n")}
      \\end{tikzpicture}`, { margin: 0 });
    assert.deepEqual(r.diagnostics, []);
    const bounds = computeSvgBounds(r.ir.items);
    const observed = [bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, ...anchors.flatMap((_, i) => {
      const { x, y } = r.ir.coordinates["probe" + i];
      return [x,y];
    })];
    observed.forEach((n, i) => near(n * pt, measured[id][i], id + " " + (["width","height"][i] || anchors[(i-2)>>1]), i >= 8 ? .02 : .003));
    if (["color","scaled"].includes(id)) {
      const paints = [...r.svg.matchAll(/<ellipse\b[^>]+>/g)].map(m => m[0]);
      assert.equal(paints.length, 2, "one fill, two pens on the same centerline");
      const attr = (el, key) => el.match(new RegExp(' ' + key + '="([^"]+)"'))?.[1];
      for (const k of ["cx","cy","rx","ry"]) assert.equal(attr(paints[0], k), attr(paints[1], k));
      assert.deepEqual(paints.map(el => attr(el,"stroke")), ["blue","red"]);
      assert.equal(attr(paints[1],"fill"), "none");
      paints.forEach((el, i) => near(Number(attr(el,"stroke-width")) * pt / TIKZ_UNIT, [7,3][i], "paint width"));
    }
  });
}

if (process.env.ROUND_NODE_PDFLATEX) {
  test("original pdfLaTeX reproduces the persisted round-node pages and anchors", () => {
    const dir = mkdtempSync(join(tmpdir(), "tikzkit-round-outlines-"));
    try {
      const log = execFileSync(process.env.ROUND_NODE_PDFLATEX, [
        "-no-shell-escape", "-halt-on-error", "-interaction=nonstopmode", fixture
      ], { cwd: dir, encoding: "utf8" });
      for (const [length, sp] of Object.entries(radiusSpByMinimum)) assert.ok(log.includes(`MINRADIUS ${length}: ${sp}sp`));
      for (const id of Object.keys(measured)) {
        const pairs = ["PAGE " + id, ...anchors.map(a => "ANCHOR " + id + " " + a)].flatMap(label => {
          const row = log.split("\n").find(s => s.startsWith(label + ": "));
          assert.ok(row, label);
          return row.slice(label.length + 2).split(" ").map(parseFloat);
        });
        pairs.forEach((n, i) => near(n, measured[id][i], "MacTeX " + id));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
