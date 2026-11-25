import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const limits = "scale only axis,width=4cm,height=4cm,xmin=-2,xmax=2,ymin=-2,ymax=2,enlargelimits=false";
const tickOpts = "xtick={1},ytick={1},minor xtick={-1},minor ytick={-1},major tick length=.2cm,minor tick length=.1cm";
function diagram(options, env = "axis", data = "(-2,-2)(2,2)") {
  const { ir, diagnostics } = tikzToSvg(String.raw`\begin{tikzpicture}\begin{${env}}[${options}]
    \addplot coordinates {${data}};\end{${env}}\end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  return ir.items;
}
const round = n => Number(n.toFixed(4));
function segments(items, axis, minor) {
  return items.filter(i => i.subtype === (minor ? "axis-minor-tick" : "axis-tick")).map(i => i.commands)
    .filter(([a,b]) => axis === "x" ? a.x === b.x : a.y === b.y);
}

// Measured from PGFPlots 1.18.2's final tick soft paths on a 4cm square.
const cases = [
  ["", [0,4], [0,4], false, false],
  ["tick pos=right", [4], [4], true, true],
  ["tickpos=left", [0], [0], false, false],
  ["tick pos=right,xtick pos=both,yticklabel pos=lower", [0,4], [4], false, false],
  ["xtick pos=right,tick pos=left,xticklabel pos=upper", [0], [0], true, false],
  ["axis lines=middle", [2], [2], false, false],
  ["axis lines=left", [0], [0], false, false],
  ["axis x line=middle,axis y line=box", [2], [0,4], false, false],
  ["axis x line=top,axis y line=left", [4], [0], true, false]
];
for (const [options, xs, ys, xUpper, yUpper] of cases) {
  test("major and minor sides and default label placement: " + (options || "box"), () => {
    const items = diagram([limits, tickOpts, options, "xticklabels={XX},yticklabels={YY}"].filter(Boolean).join(","));
    for (const [axis, edges, upper] of [["x", xs, xUpper], ["y", ys, yUpper]]) {
      const b = axis === "x" ? "y" : "x";
      const centeredTicks = options.includes("axis lines=middle") || options.includes("axis lines=left") || options.includes("axis " + axis + " line=") &&
        !options.includes("axis " + axis + " line=box");
      for (const minor of [true, false]) {
        const len = minor ? .1 : .2;
        assert.deepEqual(segments(items, axis, minor).map(([p,q]) => [round(p[b]), round(q[b])]), edges.map(v => {
          const inward = v === 4 ? -1 : 1;
          const start = v - (centeredTicks ? inward * len / 2 : 0);
          return [round(start), round(start + inward * len)];
        }));
      }
      const labels = items.filter(i => i.type === "textNode" && i.text === (axis === "x" ? "XX" : "YY"));
      assert.equal(labels.length, 1);
      const offset = labels[0][b] - (edges[0] === 2 ? 2 : upper ? 4 : 0);
      assert.ok(Math.abs(offset) < .65 && (upper ? offset > 0 : offset < 0), `${axis} label offset: ${offset}`);
    }
  });
}

test("inside, centered and outside minor ticks reflect across the frame", () => {
  for (const [align, lower, upper] of [["inside", [0,.1],[4,3.9]],["center",[-.05,.05],[4.05,3.95]],
    ["outside",[-.1,0],[4.1,4]]]) {
    const items = diagram(limits + "," + tickOpts + ",tick align=" + align);
    assert.deepEqual(segments(items, "x", true).map(([p,q]) => [round(p.y),round(q.y)]), [lower,upper]);
  }
});

test("reversing the data axes does not exchange the physical tick or label sides", () => {
  const items = diagram(limits + "," + tickOpts + ",x dir=reverse,y dir=reverse,tick pos=right,xticklabels=XX,yticklabels=YY");
  for (const axis of ["x","y"]) {
    const other = axis === "x" ? "y" : "x";
    for (const minor of [true,false]) {
      const ticks = segments(items, axis, minor);
      assert.equal(ticks.length, 1);
      const [[p,q]] = ticks;
      assert.deepEqual([p[axis],p[other],q[other]], [minor ? 3 : 1, 4, minor ? 3.9 : 3.8]);
    }
    const label = items.find(i => i.text === (axis === "x" ? "XX" : "YY"));
    assert.ok(label[other] > 4 && Math.abs(label[axis] - 1) < .01);
  }
});

test("auto log marks include partial edge decades; explicit majors only subdivide their own intervals", () => {
  const common = "scale only axis,width=8cm,height=4cm,xmin=2,xmax=400,ymin=0,ymax=1,enlargelimits=false,ytick=\\empty";
  const within = [10,20,30,40,50,60,70,80,90];
  for (const [extra, hi, expected] of [["",400,[2,3,4,5,6,7,8,9,...within,100,200,300,400]],
    [",xtick={10,100}",400,within],[",xmax=220",220,[2,3,4,5,6,7,8,9,...within]]]) {
    const items = diagram(common + extra, "semilogxaxis", "(2,0)(400,1)");
    const minor = segments(items, "x", true);
    for (const edge of [0,4]) {
      assert.deepEqual(minor.filter(([p]) => p.y === edge).map(([p]) => Math.round(2 * (hi/2) ** (p.x / 8))), expected);
    }
  }
});

test("the original log-relative error-bar drawing has its native minor strokes on all four edges", () => {
  const source = readFileSync(new URL("./fixtures/native-pgfplots-log-errors/manual-log-relative.tex", import.meta.url), "utf8");
  const { ir, diagnostics } = tikzToSvg(source);
  assert.deepEqual(diagnostics, []);
  // Counted from the original native PDF paths, not from the number of visible major labels.
  for (const [axis, minorCount, majorCount] of [["x",43,5],["y",39,4]]) {
    const other = axis === "x" ? "y" : "x";
    const positions = (minor, lower) => segments(ir.items, axis, minor)
      .filter(([p]) => (p[other] === 0) === lower).map(([p]) => p[axis]);
    const minors = positions(true, true), majors = positions(false, true);
    assert.equal(minors.length, minorCount, axis + " minor"); assert.equal(majors.length, majorCount, axis + " major");
    assert.deepEqual(positions(true, false), minors); assert.deepEqual(positions(false, false), majors);
    assert.ok(minors[0] < majors[0] && minors.at(-1) > majors.at(-1));
  }
});
