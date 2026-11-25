import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { passiveLabelLayout } from "../src/extensions/circuitikz/passiveLabels.js";

const SP = 65536, SP_PER_CM = SP * 72.27 / 2.54;
const cm = value => value / SP_PER_CM;
const point = ([x, y]) => ({ x: cm(x), y: cm(y) });
const spBox = ([w, h, d]) => ({ width: cm(w), height: cm(h), depth: cm(d) });
const twoDigits = [655362, 422343, 0]; // plain cmr10 "45", not math
const defaultFont = [282168, 655361, 786432, 26214]; // ex, em, baseline skip, pen (sp)
const nameMap = { text: "text", base: "base", mid: "mid", "south west": "southWest", "north east": "northEast" };

function input({ delta, kind = "R", align, side = 1, box = twoDigits, font = defaultFont,
  matrix = [1, 0, 0, 1, 0, 0], center = [0, 0], flags = "", distance = 0 }) {
  const [a, b, c, d, e, f] = matrix, [dx, dy] = delta;
  const x = a * dx + c * dy, y = b * dx + d * dy, length = Math.hypot(x, y);
  return { mid: point(center), localDelta: point(delta), u: { x: x / length, y: y / length },
    coordinateTransform: { a, b, c, d, x: cm(e), y: cm(f) }, align, side, halfNormal: kind === "R" ? .21 : .42,
    ex: cm(font[0]), em: cm(font[1]), baselineSkip: cm(font[2]), lineWidth: cm(font[3]), textBox: spBox(box),
    labelDistance: cm(distance), mirror: flags.split(",").includes("mirror"), invert: flags.split(",").includes("invert") };
}

function check(record, anchor, rotation, reference) {
  const args = input(record), result = passiveLabelLayout(args);
  assert.ok(result);
  assert.equal(result.anchor, anchor);
  assert.equal(result.rotation, rotation);
  assert.equal(result.options.anchor, "base");
  assert.equal(result.options.rotate ?? 0, rotation);
  assert.deepEqual(result.point, result.anchors.base);
  let max = 0;
  for (const [name, expected] of Object.entries(reference)) {
    const p = result.anchors[nameMap[name]];
    for (const [i, axis] of ["x", "y"].entries()) {
      const actual = Math.round((p[axis] - args.mid[axis]) * SP_PER_CM);
      const error = Math.abs(actual - expected[i]);
      max = Math.max(max, error);
      assert.ok(error <= 6, `${record.id ?? anchor} ${name}.${axis}: ${actual} vs ${expected[i]} sp`);
    }
  }
  return { result, max };
}

// Frozen measurements from the unmodified TeX fixture. Numeric anchors lie on
// different faces for a tall/narrow "1" and a wide mathematical subscript.
test("diagonal straight labels use a signed numeric PGF rectangle anchor", () => {
  check({ align: "straight", delta: [2637057, 2637057] }, "-45", 0, {
    text: [-1065757, 580831], "south west": [-1171570, 239086], "north east": [-304582, 1237144]
  });
  check({ align: "straight", delta: [-2031184, 3127696], kind: "C", side: -1, box: [327681, 422343, 0] }, "213", 0, {
    text: [828304, 487034], "south west": [722491, 145289], "north east": [1261797, 1143347]
  });
  check({ align: "straight", delta: [3127696, -2031184], box: [1314081, 447828, 98303] }, "237", 0, {
    text: [-98353, 702989], "south west": [-204166, 361244], "north east": [1321540, 1359302]
  });
});

test("rotated mid uses an unstrutted rectangle; only the outer anchors follow the pen", () => {
  const args = { align: "rotate", delta: [2637057, 2637057] };
  const thin = check(args, "mid", 45, {
    text: [-660989, 197579], "south west": [-660989, -129863], "north east": [-496219, 1287073]
  }).result;
  const thick = check({ ...args, font: [...defaultFont.slice(0, 3), 104858] }, "mid", 45, {
    text: [-660989, 197579], "south west": [-660989, -185473], "north east": [-496219, 1342683]
  }).result;
  assert.deepEqual(thin.point, thick.point);
  assert.deepEqual(thin.anchors.mid, thick.anchors.mid);
  assert.equal(thick.options["tikzkit layout bbox top padding"], "0cm");
  assert.equal(thick.options["tikzkit layout bbox bottom padding"], "0cm");
  assert.ok(!("tikzkit math number" in thick.options));
});

test("smart strips before its strict thresholds; readability rounds before stripping the flipped angle", () => {
  for (const [align, delta, side, native, anchor, rotation] of [
    ["smart", [3486143, 1324190], 1, 20.79927, "-69", 0],
    ["smart", [3476811, 1348489], 1, 21.19878, "mid", 21],
    ["smart", [1287714, 3499858], -1, 69.79942, "mid", 70],
    ["smart", [1263244, 3508792], -1, 70.20012, "160", 0],
    ["rotate", [-39037, 3728959], 1, 90.59985, "mid", -89],
    ["rotate", [-39037, -3728959], -1, 269.40015, "mid", 89]
  ]) {
    const { result } = check({ align, delta, side }, anchor, rotation, {});
    assert.equal(Math.round(result.direction * SP), Math.round(native * SP));
  }
});

test("reflected coordinate axes preserve the fixed body and affect the directed PGF angle and calc shift", () => {
  const { result } = check({ kind: "C", align: "rotate", delta: [2978433, -2244409],
    matrix: [-1.5, 0, 0, .5, 0, 0], center: [-2233824, -561102], box: [873815, 422343, 0], flags: "mirror" },
  "mid", 323, { text: [-246760, 984674], "south west": [-571019, 939103], "north east": [1029541, 841667] });
  assert.equal(Math.round(result.direction * SP), Math.round(323.00345 * SP));
});

const sweep = process.env.CIRCUITIKZ_LABEL_SWEEP === "1";
test("replay installed CircuitikZ directions and five named label anchors in page coordinates",
  { skip: !sweep && process.env.TIKZKIT_TEST_PDFLATEX !== "1" }, t => {
    const source = fileURLToPath(new URL("./fixtures/circuitikz-passive-label-anchors.tex", import.meta.url));
    const tmp = mkdtempSync(join(tmpdir(), "circuitikz-label-anchors-"));
    try {
      const run = spawnSync("pdflatex", ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error",
        "-jobname=circuitikz-passive-label-anchors", `-output-directory=${tmp}`,
        sweep ? `\\def\\FullAngleSweep{}\\input{"${source}"}` : source], { encoding: "utf8" });
      assert.equal(run.status, 0, run.error?.message ?? run.stdout?.slice(-2000));
      const log = readFileSync(join(tmp, "circuitikz-passive-label-anchors.log"), "utf8");
      const cases = new Map();
      for (const line of log.split(/\r?\n/)) {
        if (!/^[ITFMDELPC]\|/.test(line)) continue;
        const [tag, id, ...v] = line.split("|");
        if (!cases.has(id)) cases.set(id, { points: {} });
        const row = cases.get(id);
        if (tag === "P") row.points[v[0]] = v.slice(1).map(Number);
        else row[tag] = ["I", "D"].includes(tag) ? v : v.map(Number);
      }
      assert.equal(cases.size, 41 + (sweep ? 360 * 3 : 0));
      let max = 0;
      for (const [id, { I, T, E, F, D, M, C, L, points }] of cases) {
        assert.deepEqual(Object.keys(points).sort(), Object.keys(nameMap).sort(), id);
        const { result, max: error } = check({ id, kind: I[0], align: I[1], side: Number(I[2]), flags: I[3],
          delta: E, center: C, matrix: M, font: F, box: T, distance: L[0] }, D[4], Number(D[3]), points);
        assert.equal(Math.round(result.direction * SP), Math.round(Number(D[2]) * SP), id + " direction");
        max = Math.max(max, error);
      }
      t.diagnostic(`${cases.size} original R/C cases, ${cases.size * 10} anchor coordinates, max error ${max} sp (${max / SP} TeX pt)`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
