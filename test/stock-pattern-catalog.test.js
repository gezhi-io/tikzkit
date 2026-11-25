import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { stockPatternTile } from "../src/tikz/patternTiles.js";

const read = id => readFileSync(new URL(`./fixtures/stock-pattern-catalog/${id}.tex`, import.meta.url), "utf8");
const compile = source => tikzToSvg(source, { mathRenderer: "svg-text" });
const patternTags = svg => [...svg.matchAll(/<pattern\b[^>]*>[\s\S]*?<\/pattern>/g)].map(m => m[0]);

test("all twenty classic PGF names have physical tile definitions, not fallback hatching", () => {
  const r = compile(read("manual-catalog"));
  assert.deepEqual(r.diagnostics, []);
  const names = r.ir.items.map(i => i.style?.pattern).filter(Boolean);
  assert.equal(new Set(names).size, 20);
  assert.deepEqual(names.filter(n => !stockPatternTile(n)), []);
  assert.ok(patternTags(r.svg).every(tag => tag.includes("patternTransform=")));
});

test("a named pattern enables a bare path fill without enabling its outline", () => {
  const r = compile(read("stencil-geometry"));
  assert.deepEqual(r.diagnostics, []);
  const items = r.ir.items.filter(i => i.style?.pattern);
  assert.deepEqual(items.map(i => i.style.pattern), ["fivepointed stars", "sixpointed stars", "bricks", "checkerboard"]);
  assert.equal(items[1].style.stroke, "none");
  assert.equal(items[1].style.fillRule, "evenodd");
  const star = patternTags(r.svg).find(tag => tag.includes("sixpointed-stars"));
  assert.match(star, /fill-rule="nonzero"/, "the outer fill rule must not hollow out the two overlapping triangles");
});

test("the pattern command and the solid ground follow the same manual arch to (3,0)", () => {
  const r = compile(read("manual-brick-arch"));
  assert.deepEqual(r.diagnostics, []);
  const [ground, mortar] = r.ir.items.filter(i => i.type === "path");
  assert.equal(mortar.style.pattern, "bricks");
  assert.equal(mortar.style.stroke, "none");
  assert.deepEqual(ground.commands.at(-1), { type: "lineTo", x: 3, y: 0 });
  assert.deepEqual(mortar.commands, ground.commands);
});

test("a relative coordinate after an arc uses the arc endpoint, then ordinary one-plus rules resume", () => {
  const r = compile(String.raw`\begin{tikzpicture}\draw (2,3) arc (0:90:1cm) -- +(1,0) -- ++(0,1) -- +(2,0);\end{tikzpicture}`);
  assert.deepEqual(r.diagnostics, []);
  assert.deepEqual(r.ir.items[0].commands.slice(-3).map(({x,y}) => [x,y]), [[2,4],[1,5],[3,5]]);
});

test("bare pattern actions keep the selected ink instead of replacing its name in scope", () => {
  const r = compile(read("command-forms"));
  assert.deepEqual(r.diagnostics, []);
  const panels = r.ir.items.filter(i => i.type === "path");
  assert.deepEqual(panels.filter(i => i.style.pattern).map(i => i.style.pattern),
    ["bricks", "bricks", "sixpointed stars", "bricks"]);
  assert.equal(panels[4].style.fill, "rgb(255 128 0)");
  assert.ok(!panels[6] || panels[6].style.fill === "none");
});

test("fixed-color cells ignore pattern color but paint translucent layers separately", () => {
  const r = compile(read("fixed-inks"));
  assert.deepEqual(r.diagnostics, []);
  const tile = patternTags(r.svg).find(t => t.includes("crosshatch-dots-light-steel-blue") && t.includes("alpha-"));
  assert.ok(tile, "missing translucent colored tile");
  assert.doesNotMatch(tile, /(?:fill|stroke)="blue"/);
  assert.equal((tile.match(/<circle /g) || []).length, 4);
  assert.equal((tile.match(/fill-opacity="0\.45"/g) || []).length, 5, "ground, two highlights, two shadows");
});
