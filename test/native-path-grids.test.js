import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const pt = 2.54 / 72.27;
const fixture = name => readFileSync(new URL("./fixtures/native-path-grids/" + name + ".tex", import.meta.url), "utf8");
const draw = picture => {
  const result = tikzToSvg(picture);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items;
};
const grid = items => items.filter(i => i.subtype === "grid-line");
const near = (value, expected) => assert.ok(Math.abs(value - expected) < .00008, value + " != " + expected);
const dirs = lines => ({
  x: lines.filter(l => l.commands[0].x === l.commands[1].x).map(l => l.commands[0].x),
  y: lines.filter(l => l.commands[0].y === l.commands[1].y).map(l => l.commands[0].y)
});

test("the manual's numeric and dimensional steps differ in a half-centimetre basis", () => {
  const lines = grid(draw(fixture("manual-basis")));
  assert.equal(lines.length, 13);
  const black = dirs(lines.filter(l => l.style.stroke === "black"));
  const red = dirs(lines.filter(l => l.style.stroke === "red"));
  assert.equal(black.x.length, 4);
  near(black.x[1], .5);
  near(red.x[1], .75);
});

test("the manual's polar step resolves once, into physical x and y lengths", () => {
  const lines = grid(draw(fixture("manual-polar")));
  const { x, y } = dirs(lines);
  assert.equal(x.length, 5);
  assert.equal(y.length, 3);
  near(x[2], Math.SQRT2);
  near(y[1], Math.SQRT1_2);
});

test("each direction can be switched off independently, including sub-.01pt steps", () => {
  const lines = grid(draw(fixture("one-direction")));
  assert.equal(lines.length, 11);
  assert.equal(dirs(lines.filter(l => l.style.stroke === "red")).y.length, 3);
  assert.equal(dirs(lines.filter(l => l.style.stroke === "blue")).x.length, 6);
  assert.equal(dirs(lines).x.length, 6);
});

test("a grid draws its first lattice line, then uses only PGF's .01pt final allowance", () => {
  const lines = grid(draw(fixture("limit")));
  const blue = dirs(lines.filter(l => l.style.stroke === "blue"));
  assert.equal(blue.x.length, 1);
  assert.equal(blue.y.length, 1);
  near(blue.x[0], 1);
  near(blue.y[0], 1);
  const red = dirs(lines.filter(l => l.style.stroke === "red"));
  assert.equal(red.x.length, 2);
  near(red.y.at(-1), -.01 * pt);
});

test("grid-local keys do not leak and a following relative line starts at the requested corner", () => {
  const items = draw(fixture("local-steps"));
  const blue = grid(items).filter(l => l.style.stroke === "blue");
  assert.equal(blue.length, 12);
  const line = items.find(i => i.type === "path" && !i.subtype && i.commands.some(c => c.type === "lineTo"));
  assert.ok(line);
  assert.deepEqual(line.commands.slice(-2), [{ type:"moveTo",x:3,y:1 }, { type:"lineTo",x:3.5,y:1.3 }]);
});

test("a rotated grid keeps its requested corner in the bounds, not just the last painted line", () => {
  const items = draw(fixture("affine"));
  const teal = items.filter(i => i.style.stroke === "teal");
  const lines = grid(teal);
  assert.equal(lines.length, 5);
  const [a, b] = lines[0].commands;
  near((b.y - a.y) / (b.x - a.x), Math.tan(24 * Math.PI / 180));
  const corner = teal.find(i => i.type === "bbox").commands.at(-1);
  near(corner.x, 1 + 2.5 * Math.cos(24 * Math.PI / 180) - 1.5 * Math.sin(24 * Math.PI / 180));
  near(corner.y, .4 + 2.5 * Math.sin(24 * Math.PI / 180) + 1.5 * Math.cos(24 * Math.PI / 180));
  assert.ok(corner.y > Math.max(...lines.flatMap(l => l.commands.map(p => p.y))) + .25);
});

test("grid cycle returns to the current subpath start without losing the preceding diagonal", () => {
  const items = draw(fixture("cycle"));
  const teal = items.filter(i => i.style.stroke === "teal");
  assert.equal(grid(teal).length, 6);
  const path = teal.find(i => i.type === "path" && !i.subtype);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: .2, y: .1 }, { type: "lineTo", x: 2.3, y: 1.3 },
    { type: "moveTo", x: .2, y: .1 }, { type: "closePath" }
  ]);
});

test("a translucent grid is stroked once and an outgoing arrow belongs to its continuation", () => {
  const paths = draw(fixture("stroke")).filter(i => i.type === "path");
  assert.equal(paths.length, 2);
  const [blue, red] = paths;
  assert.equal(blue.style.opacity, .4);
  assert.equal(blue.commands.filter(c => c.type === "lineTo").length, 7);
  assert.ok(red.style.markerEnd);
  // 4 * (.5cm) falls two scaled points short of the starting coordinate
  // (2,0), so the first vertical stroke is at 2.5cm in the native path.
  assert.equal(red.commands.filter(c => c.type === "lineTo").length, 7);
  assert.deepEqual(red.commands.at(-1), { type: "lineTo", x: 4, y: 1.3 });
});

test("oversized grids report one diagnostic without returning a partial lattice", () => {
  const result = tikzToSvg(String.raw`\tikz \draw[xstep=0,ystep=1pt] (0,0) grid (.2,1200);`);
  assert.deepEqual(result.diagnostics.map(d => d.code), ["grid-line-limit"]);
  assert.equal(grid(result.ir.items).length, 0);
});

test("a dimension and a basis multiple may select different first grid lines", () => {
  const items = draw(String.raw`\begin{tikzpicture}
    \draw[blue,ystep=0] (2,0) grid (4,1);
    \draw[red,ystep=0] (2cm,0) grid (4,1);
  \end{tikzpicture}`);
  // In scaled points: 2*(1cm) = 3729358, whereas scanning 2cm gives 3729359.
  const first = color => dirs(grid(items).filter(i => i.style.stroke === color)).x[0];
  near(first("blue"), 2);
  near(first("red"), 3);
});
