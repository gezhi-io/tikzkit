import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const fixture = id => readFileSync(new URL("./fixtures/pgfplots-pattern-paint/" + id + ".tex", import.meta.url), "utf8");
const compile = (tex, options = {}) => {
  const result = tikzToSvg(tex, { mathRenderer: "svg-text", ...options });
  assert.deepEqual(result.diagnostics, []);
  return result;
};
const painted = result => result.ir.items.filter(i => i.type === "path" && i.style?.pattern);
const tags = svg => [...svg.matchAll(/<pattern\b[^>]*>[\s\S]*?<\/pattern>/g)].map(m => m[0]);

test("the manual's two xbar series select five light and five dark blue striped fills", () => {
  const result = compile(fixture("manual-blue-bars"));
  assert.deepEqual(painted(result).map(i => i.style.pattern), [
    ...Array(5).fill("horizontal lines light blue"), ...Array(5).fill("horizontal lines dark blue")
  ]);
  assert.equal(tags(result.svg).length, 2);
  for (const tile of tags(result.svg)) assert.match(tile, /viewBox="0 0 100 4"/);
});

test("function areas and their miniature legend rectangles both carry the pattern", () => {
  const result = compile(fixture("manual-area-legend"));
  const items = painted(result);
  for (const pattern of ["crosshatch dots", "crosshatch"]) {
    const paths = items.filter(i => i.style.pattern === pattern);
    assert.equal(paths.length, 2);
    assert.ok(paths.some(i => i.commands.length > 10));
    assert.ok(paths.some(i => i.commands.length === 5));
  }
});

test("pattern sets the fill ink, a subsequent fill color replaces it, and pattern=none disables fill", () => {
  const { ir } = compile(fixture("hatch-order"));
  const bars = ir.items.filter(i => i.type === "path" && i.subtype === "axis-bar");
  assert.equal(bars.length, 8);
  for (const b of bars.slice(0,2)) {
    assert.equal(b.style.pattern, "north east lines");
    assert.equal(b.style.fillOpacity, .5);
  }
  for (const b of bars.slice(2,4)) assert.equal(b.style.pattern, "north west lines");
  for (const b of bars.slice(4,6)) assert.ok(!b.style.pattern && b.style.fill === "rgb(0 255 0)");
  for (const b of bars.slice(6)) assert.ok(!b.style.pattern && b.style.fill === "none");
});

test("stock patterns have a physical repeat and are anchored at the cropped page's lower left", () => {
  for (const unit of [65, 100]) {
    const { svg } = compile(fixture("stock-tiles"), {unit});
    const box = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const tiles = tags(svg);
    assert.equal(tiles.length, 6);
    const cropped = compile(fixture("stock-tiles"), { unit, margin: 0 }).svg;
    assert.notEqual(cropped.match(/viewBox="[^"]+"/)[0], svg.match(/viewBox="[^"]+"/)[0]);
    assert.deepEqual(tags(cropped), tiles, "cropping the same document must not rephase its ink");
    for (const tile of tiles) {
      const transform = tile.match(/patternTransform="matrix\(([^)]+)\)/);
      assert.ok(transform, "missing physical tile transform");
      const [sx,b,c,sy,x,y] = transform[1].split(/[,\s]+/).map(Number);
      assert.ok(Math.abs(sx-unit*2.54/72.27)<1e-5 && Math.abs(sx+sy)<1e-5);
      assert.equal(b+c,0);
      assert.ok(Math.abs(x-box[0])<1e-4 && Math.abs(y-box[1]-box[3])<1e-4);
    }
    assert.match(tiles.find(t => t.includes("pattern-grid-")), /stroke="black"/);
    assert.doesNotMatch(tiles.find(t => t.includes("pattern-horizontal-lines-dark-gray-")), /fill="red"/);
  }
});

test("a PDF pattern cell inherits the opacity of its own paint operation, not its enclosing fill", () => {
  const result = compile(fixture("pattern-alpha"));
  const tiles = tags(result.svg);
  const hatches = tiles.filter(t => t.includes("north-east-lines"));
  const dots = tiles.filter(t => t.includes("pattern-dots-"));
  assert.equal(hatches.length, 2, "the opaque hatch and the two identical pale hatches share two definitions");
  assert.ok(hatches.every(t => t.includes('stroke="rgb(255 0 255)"')), "PGF converts pattern ink to RGB");
  assert.equal(hatches.filter(t => t.includes('stroke-opacity="0.3"')).length, 1);
  assert.equal(dots.length, 2);
  assert.equal(dots.filter(t => t.includes('fill-opacity="0.3"')).length, 1);
  const band = tiles.find(t => t.includes("horizontal-lines-dark-gray"));
  assert.match(band, /height="2\.5"/);
  assert.match(band, /fill-opacity="0\.3"/);
  const shapes = result.svg.match(/<path\b[^>]*fill="url\(#[^"]*pattern-[^"]+"[^>]*>/g) || [];
  assert.equal(shapes.length, 6);
  assert.ok(shapes.every(p => !/ (?:opacity|fill-opacity)=/.test(p)), "never attenuate the completed fill a second time");
});
