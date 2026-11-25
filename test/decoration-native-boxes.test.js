import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { layoutDecorationRun } from "../src/tex/decorationBoxes.js";
import { createFontSpec } from "../src/tex/fontSpec.js";

// Inputs are the single-line \\Probe calls in the reproducible pdfLaTeX fixture.
// Expected pt values below come from PGF's scanchar box register, not JS metrics.
const fixture = readFileSync(new URL("./fixtures/native-decoration-scanner.tex", import.meta.url), "utf8");
const sources = new Map([...fixture.matchAll(/^\\Probe(?:\[[^\]]*\])?\{([^}]+)\}\{(.*)\}$/gm)]
  .map(([, name, source]) => [name, source]));
const normal = createFontSpec();
const tt7 = createFontSpec({ family: "monospace", sizePt: 7, baselineSkipPt: 8 });
const bold12 = createFontSpec({ sizePt: 12, baselineSkipPt: 14, weight: 700, mathVersion: "bold" });
const probe = (name, font = normal) => {
  assert.ok(sources.has(name), name);
  const run = layoutDecorationRun(sources.get(name), font);
  assert.ok(run, name);
  return run;
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .0002,
  `expected ${expected} TeX pt, got ${actual}`);
function widths(run, values) {
  assert.equal(run.length, values.length);
  run.forEach(({ box }, i) => close(box.width, values[i]));
}
function dimensions(run, values) {
  widths(run, values.map(([width]) => width));
  run.forEach(({ box }, i) => {
    close(box.height, values[i][1]);
    close(box.depth, values[i][2]);
  });
}
const glyphText = box => box.items.filter(item => item.type === "glyph").map(item => item.text).join("");
const stretchSpace = entry => entry.kind === "glyph" && entry.text === " " && entry.tex === undefined;

test("ordinary PGF positions separate letters, but shapes the contents of a group just once", () => {
  const run = probe("letters");
  assert.deepEqual(run.map(e => e.kind), ["glyph", "glyph", "glyph", "glyph", "glyph",
    "group", "group", "group", "group", "glyph"]);
  assert.deepEqual(run.map(e => e.text), ["A", "V", "f", "f", "i", "AV", "ffi", "office", "To", "!"]);
  widths(run, [7.50002, 7.50002, 3.05557, 3.05557, 2.77779, 13.8889, 8.33336, 22.22226, 11.3889, 2.77779]);
  for (const { box } of run.slice(0, 5)) assert.equal(box.items[0].x, 0);
  close(run[5].box.items[1].x, 6.38888);
  assert.equal(glyphText(run[6].box), "\ufb03");
  assert.equal(glyphText(run[7].box), "o\ufb03ce");
});

test("adjacent arguments retain PGF's exact saved-remainder grouping", () => {
  const pair = probe("pair"), tail = probe("saved-tail");
  assert.deepEqual(pair.map(e => e.text), ["AV", "ffi"]);
  widths(pair, [13.8889, 8.33336]);
  assert.deepEqual(tail.map(e => e.text), ["X", "AV", "f", "f", "i"]);
  widths(tail, [7.50002, 13.8889, 3.05557, 3.05557, 2.77779]);
  const boundaries = probe("group-boundaries");
  widths(boundaries, [7.50002, 0, 8.88893, 17.22223, 17.22223, 14.72224, 2.77779]);
  assert.deepEqual(boundaries[1].box.items, []);
  assert.equal(glyphText(boundaries[2].box), "ffi"); // inner braces interrupt ligaturing
  close(boundaries[4].box.items[0].x, 3.33333);
  assert.deepEqual(layoutDecorationRun("", normal), []);
});

test("typed glue collapses; explicit spaces survive and never count as stretchable scanner spaces", () => {
  const run = probe("spaces");
  widths(run, [3.33333, 7.50002, 3.33333, 3.33333, 3.33333, 3.33333, 7.08336, 3.33333, 7.22223, 3.33333]);
  assert.deepEqual(run.filter(stretchSpace).map(e => run.indexOf(e)), [0, 2, 9]);
  assert.deepEqual(run.filter(e => e.tex).map(e => e.tex), ["\\ ", "\\ ", "\\space", "\\ "]);
  for (const { box } of run.filter(e => e.text === " ")) {
    assert.deepEqual([box.height, box.depth, box.items], [0, 0, []]);
  }
  const groups = probe("group-spaces");
  widths(groups, [17.77782, 16.6667, 17.77782, 9.99998, 2.77779]);
  assert.deepEqual(groups.filter(stretchSpace), []);
  widths(probe("nested-spaces"), [17.77782, 19.1667, 14.33337, 2.77779]);
  assert.deepEqual(layoutDecorationRun("A \r\n  B", normal).map(e => e.text), ["A", " ", "B"]);
});

test("the manual's grouped negative kern shifts paint as well as the advance", () => {
  const run = probe("manual-kern");
  widths(run, [10.2778, 6.50002, 7.22223, 6.80557, 7.36111]);
  assert.equal(run[1].kind, "group");
  assert.equal(glyphText(run[1].box), "A");
  assert.equal(run[1].box.items[0].x, -1);
});

test("outer math shifts change each scanned hbox's mode; they don't collect a formula", () => {
  const run = probe("inline");
  assert.deepEqual(run.map(e => e.kind), ["glyph", "math-box", "math-box", "math-box", "glyph"]);
  assert.deepEqual(run.map(e => e.tex), [undefined, "a", "+", "b", undefined]);
  dimensions(run, [[6.11111, 6.83331, 0], [5.28589, 4.30554, 0], [7.7778, 5.83333, .83333],
    [4.29166, 6.94444, 0], [7.7778, 6.83331, 1.94444]]);
  const groups = probe("math-groups");
  assert.deepEqual(groups.map(e => e.tex), ["x", "^y_i", "\\times", "ab"]);
  dimensions(groups, [[5.71527, 4.30554, 0], [4.80675, 7.81941, 2.78741],
    [7.7778, 5.83333, .83333], [9.57755, 6.94444, 0]]);
  const blanks = probe("math-spaces");
  widths(blanks, [5.28589, 0, 4.29166, 3.33333, 4.32756, 0, 5.20486]);
  assert.deepEqual(blanks.filter(stretchSpace), [blanks[1]]);
});

test("grouped fractions, scripts and radicals retain native glyphs and rule paint", () => {
  const run = probe("structures");
  assert.deepEqual(run.map(e => e.tex), ["\\frac{1}{2}", "x_i^2", "\\sqrt{x}", undefined]);
  dimensions(run, [[6.38612, 8.44843, 3.44841], [10.2014, 8.14003, 2.60292],
    [14.04863, 8.00272, 2.39725], [2.77779, 6.94444, 0]]);
  const [frac, script, radical] = run.map(e => e.box.items);
  assert.ok(frac.some(g => g.text === "1" && g.size === 7 && g.y < 0));
  assert.ok(frac.some(g => g.text === "2" && g.size === 7 && g.y > 0));
  close(frac.find(g => g.type === "rule").x, 1.2);
  assert.ok(script.some(g => g.text === "2" && g.y < 0));
  assert.ok(script.some(g => g.text === "i" && g.y > 0));
  assert.ok(radical.some(g => g.type === "rule" && g.width > 0 && g.height > 0));
});

test("explicit glue inside collected math uses the surrounding text font, even in a numerator", () => {
  const run = probe("math-box-spaces", tt7);
  dimensions(run, [[7.85431, 4.8611, 0], [11.5731, 4.8611, 0],
    [13.15761, 6.15953, 2.4095], [3.7188, 4.27777, 0]]);
  assert.equal(run[0].tex, "a\\space b");
  assert.equal(run[1].tex, "a\\ b");
  close(run[1].box.items[1].x - run[0].box.items[1].x, 3.7188);
  widths(probe("fixed-spaces", { ...normal, spaceSkipPt: 8 }), [5.00002, 8, 8, 17.57755]);
});

test("mixed hboxes preserve surrounding text, its glue, and a common math baseline", () => {
  const run = probe("mixed");
  dimensions(run, [[40.98901, 6.83331, 1.49998], [33.75468, 6.94444, 1.94444],
    [32.35529, 6.94444, 1.94444], [2.77779, 6.94444, 0]]);
  assert.deepEqual(run.slice(0, 3).map(e => [e.kind, e.text]), [
    ["group", "AV $x_i$ To"], ["group", "$x$ and $y$"], ["group", "x{$a+b$}y"]
  ]);
  const items = run[0].box.items;
  assert.equal(glyphText(run[0].box), "AVxiTo");
  close(items[2].x, 17.22223);
  assert.deepEqual(items.filter(g => g.text !== "i").map(g => g.y), [0, 0, 0, 0, 0]);
  assert.ok(items[3].y > 0);
});

test("font selection and transform apply to actual glyphs, scripts and space advances", () => {
  const tt = probe("tt7", tt7);
  dimensions(tt, [[3.7188, 4.27777, 0], [11.15639, 4.27777, 0], [3.7188, 0, 0], [7.70258, 3.01389, 1]]);
  assert.ok(tt[1].box.items.every(g => g.family === "TikZKitCMTT8" && g.size === 7));
  assert.equal(tt[3].box.items[0].family, "TikZKitCMMI7");
  widths(probe("tt7-space", tt7), [4.33765, 3.7188, 3.51666]);
  const bold = probe("bold12", bold12);
  dimensions(bold, [[18.88889, 8.23334, 0], [11.84909, 5.33333, 1.79999]]);
  assert.equal(bold[0].box.items[0].family, "TikZKitCMBX12");
  assert.equal(bold[1].box.items[0].family, "TikZKitCMMIB10");
  const scaled = probe("tt7", { ...tt7, sizePt: 14, baselineSkipPt: 16, geometricScale: 2 });
  widths(scaled, [7.4376, 22.31278, 7.4376, 15.40516]);
  assert.ok(scaled[1].box.items.every(g => g.family === "TikZKitCMTT8" && g.size === 14));
  assert.equal(scaled[3].box.items[1].size, 10);
});

test("unsupported syntax or missing native metrics reject the complete run", () => {
  for (const source of ["abc{", "A}", "A$x", "A$x_1$", "$\\times$", "A{$\\unknown{x}$}B",
    "A{hello $x$ \\oops}Z", "{\\kern1em A}", "A|\\large|B", "{a%comment\nb}", "A\n\nB",
    "{a$$b}", "$$x$$", "{a_b}", "x~y", "A\\spaceXYZ", "A\\", "A\u2603",
    "{$\\def\\foo{unused}x$}", "{$\\sqrt{\\unmapped}$}"]) {
    assert.equal(layoutDecorationRun(source, normal), null, source);
  }
  assert.equal(layoutDecorationRun("A{ffi}", { ...normal, family: "Helvetica" }), null);
  assert.equal(layoutDecorationRun("A{$x$}", { ...normal, mathVersion: "sans" }), null);
  assert.equal(layoutDecorationRun("{AV}", { ...normal, sizePt: 11.5 }), null);
});
