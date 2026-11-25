import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { includePathCommandBounds } from "../src/scene/bbox.js";

const fixture = id => readFileSync(new URL("./fixtures/native-path-ellipses/" + id + ".tex", import.meta.url), "utf8");
function paths(source) {
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items.filter(i => i.type === "path");
}
const matching = (p, type) => p.commands.filter(c => c.type === type);
function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < .00005, actual + " != " + expected);
}

test("the manual's circle options produce a rotated ellipse, not a round disk", () => {
  const [outer, inner] = paths(fixture("manual-rotated"));
  near(outer.commands[0].x, 2.5);
  const first = inner.commands[0], quarter = matching(inner, "curveTo")[0];
  near(first.x, 1 + Math.cos(Math.PI / 6));
  near(first.y, .5);
  near(quarter.x, .75);
  near(quarter.y, .5 * Math.cos(Math.PI / 6));
});

test("bare path operations inherit the radius and keep all three circular subpaths", () => {
  const items = paths(fixture("manual-chain"));
  assert.equal(items.flatMap(p => matching(p, "curveTo")).length, 12);
  assert.equal(items.flatMap(p => matching(p, "lineTo")).length, 2);
});

test("a rectangle and its circular cutout are painted with the same fill rule", () => {
  const items = paths(fixture("cutout"));
  assert.equal(items.length, 1);
  assert.equal(items[0].style.fillRule, "evenodd");
  assert.equal(matching(items[0], "closePath").length, 2);
  assert.equal(matching(items[0], "curveTo").length, 4);
});

test("a local center sets the pen position without rebasing the next relative coordinate", () => {
  const blue = paths(fixture("local-at")).filter(p => p.style.stroke === "blue");
  const commands = blue.flatMap(p => p.commands);
  const i = commands.findLastIndex(c => c.type === "lineTo");
  assert.ok(i > 0);
  near(commands[i-1].x, 1);
  near(commands[i-1].y, .7);
  near(commands[i].x, 1.9);
  near(commands[i].y, 0);
});

test("every circle applies to both modern spellings but not legacy radii", () => {
  const items = paths(fixture("every-circle"));
  assert.equal(items.length, 3);
  const [blue, red, teal] = items.map(p => p.commands[0]);
  near(blue.x, .4 * Math.cos(Math.PI / 6));
  near(blue.y, .2);
  near(red.x, 1 + .7 / Math.SQRT2);
  near(red.y, .7 / Math.SQRT2);
  near(teal.x, 2.8);
  near(teal.y, 0);
});

test("translucent overlapping outlines receive one draw action", () => {
  const blue = paths(fixture("compound-stroke")).filter(p => p.style.stroke === "blue");
  assert.equal(blue.length, 1);
  assert.equal(matching(blue[0], "curveTo").length, 8);
});

test("the nonzero fill keeps reversed outlines in the same paint operation", () => {
  const blue = paths(fixture("winding")).filter(p => p.style.fill === "blue");
  assert.equal(blue.length, 1);
  assert.equal(matching(blue[0], "closePath").length, 2);
});

test("local transforms accumulate in order and an enclosing at is not the center", () => {
  const items = paths(fixture("scoped-order"));
  const [teal, red, blue] = items.map(p => p.commands[0]);
  near(teal.x, .5 / Math.SQRT2); near(teal.y, .5 / Math.SQRT2);
  near(red.x, 1.3); near(red.y, 0);
  near(blue.x, 2.4); near(blue.y, 0);
});

test("a rotated ellipse paints full controls but uses PGF's measured page height", () => {
  // Half-heights in TeX pt, measured with pdfLaTeX before adding page border.
  for (const [angle, halfHeight] of [[45, 14.28339], [-45, 16.5057], [20, 9.30962], [-120, 17.4486]]) {
    const [path] = paths(String.raw`\begin{tikzpicture}\draw (0,0) ellipse[x radius=7mm,y radius=2mm,rotate=${angle}];\end{tikzpicture}`);
    let ymin = Infinity, ymax = -Infinity;
    includePathCommandBounds(path.commands, (_x, y) => { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); });
    for (const h of [-ymin, ymax]) assert.ok(Math.abs(h * 28.45274 + .2 - halfHeight) < .003, `${angle}: ${h}`);
    if (angle === 45) assert.ok(path.commands[1].y1 > ymax + .07, "the native cubic is not flattened to the page box");
  }
});
