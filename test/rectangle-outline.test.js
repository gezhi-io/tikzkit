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

const ptPerCm = 72.27 / 2.54, svgPerPt = TIKZ_UNIT / ptPerCm;
const fixture = fileURLToPath(new URL("./fixtures/rectangle-outline-metrics.tex", import.meta.url));
const probes = [...readFileSync(fixture, "utf8").matchAll(/^\\probe(?:\[([^\]]*)\])?\{([a-z]+)\}\{([^{}]*)\}\{([^{}]*)\}$/gm)];
// pdfLaTeX readings in TeX pt: picture width/height and the northeast anchor.
const metrics = {
  stroke: [64,34,32,17], tight: [64,34,30,15], outside: [64,34,40,21],
  fill: [60,30,40,25], round: [64,34,32,17], oversized: [64,34,32,17],
  negative: [64,34,32,17], unitless: [64,34,32,17],
  rotate: [70.96165,59.98082,19.21289,30.72247],
  empty: [70.96167,59.98083,19.21289,30.72247],
  roundrot: [70.96165,59.98082,19.21289,30.72247],
  scaled: [94,49,48,25.5], scaledround: [94,49,48,25.5], scaleddouble: [97,52,46.5,24],
  double: [64.6,34.6,31,16], color: [67,37,31,16], center: [68,38,31,16],
  single: [62,32,31,16], reenable: [67,37,31,16], noframedraw: [60,30,32,17],
  zerogap: [64,34,31,16], overlap: [65,35,32,17], rememberink: [67,37,31,16]
};
const pens = { double: [4.6,.6], color: [7,3], center: [8,4], reenable: [7,3], single: [2],
  zerogap: [4], overlap: [5], rememberink: [7,3], scaleddouble: [7,3] };
const insets = { round: 3, oversized: 24, negative: -3, unitless: 5, scaledround: 4 };

function near(actual, expected, what) {
  assert.ok(Math.abs(actual - expected) < .003, `${what}: ${actual} instead of ${expected} TeX pt`);
}

for (const [, picture, id, keys, content] of probes) {
  test(`rectangle outline: ${id} separates centerline, pen, page and named anchors`, () => {
    const result = tikzToSvg(String.raw`\begin{tikzpicture}[${picture ?? ""}]
      \node[minimum width=60pt,minimum height=30pt,inner sep=0pt,${keys}] (R) {${content}};
      \coordinate[overlay] (corner) at (R.north east);
      \end{tikzpicture}`, { margin: 0 });
    assert.deepEqual(result.diagnostics, []);
    const b = computeSvgBounds(result.ir.items), p = result.ir.coordinates.corner;
    const values = [b.maxX-b.minX, b.maxY-b.minY, p.x, p.y];
    values.forEach((n, i) => near(n * ptPerCm, metrics[id][i], ["page width","page height","anchor x","anchor y"][i]));

    const outlines = [...result.svg.matchAll(/<(?:rect\b|path\b(?=[^>]*tikz-rounded-rectangle))[^>]*>/g)].map(m => m[0]);
    const penWidths = pens[id] || [4];
    const scale = Number(picture?.match(/(?:^|,)scale=([\d.]+)/)?.[1] ?? 1);
    assert.equal(outlines.length, penWidths.length, "one centerline, one element for each paint pass");
    for (const [i, el] of outlines.entries()) {
      const attr = name => el.match(new RegExp(' ' + name + '="([^"]+)"'))?.[1];
      if (attr("width")) {
        near(Number(attr("width")) / svgPerPt, 60 * scale, "rectangle path width");
        near(Number(attr("height")) / svgPerPt, 30 * scale, "rectangle path height");
      }
      if (Object.hasOwn(insets, id)) {
        // PGF starts on the top edge, leaving the northeast corner towards the west.
        const inset = insets[id];
        const numbers = attr("d")?.match(/-?[\d.]+/g)?.map(v => Number(v) / svgPerPt);
        assert.ok(numbers, "a signed corner must not disappear");
        near(numbers[0], 30 * scale - inset, "outgoing northeast corner");
        near(numbers[1], -15 * scale, "top edge");
        near(numbers[2], -30 * scale + inset, "incoming northwest corner");
        near(numbers[9], -15 * scale + inset, "outgoing northwest corner");
      }
      if (id === "fill" || id === "noframedraw") assert.equal(attr("stroke"), "none");
      else near(Number(attr("stroke-width")) / svgPerPt, penWidths[i], "paint width");
      if (i > 0) {
        assert.equal(attr("fill"), "none", "do not fill twice");
        assert.equal(attr("stroke"), keys.includes("double=blue") ? "blue" : "white");
      }
    }
  });
}

test("a backend canvas scale changes the pen independently of a shape scale", () => {
  for (const command of ["\\node", "\\path (0,0) node"]) {
    const r = tikzToSvg(`\\begin{tikzpicture}[scale=1.5,transform shape,transform canvas={scale=2}]
      ${command}[draw,line width=4pt,minimum width=60pt,inner sep=0pt] {Box};
      \\end{tikzpicture}`);
    assert.deepEqual(r.diagnostics, []);
    const rect = r.svg.match(/<rect\b[^>]*stroke-width="[^"]+"[^>]*>/)?.[0];
    assert.ok(rect);
    near(Number(rect.match(/ width="([^"]+)"/)[1]) / svgPerPt, 180, "scaled outline");
    near(Number(rect.match(/ stroke-width="([^"]+)"/)[1]) / svgPerPt, 8, "backend pen");
  }
});

test("a double distance enables two coincident strokes on a bare draw path", () => {
  const r = tikzToSvg("\\tikz \\draw[draw=red,double=blue,double=none,double distance=3pt,line width=2pt] (0,0)--(60pt,0);", { margin: 0 });
  assert.deepEqual(r.diagnostics, []);
  const passes = [...r.svg.matchAll(/<path class="tikz-double-(?:outer|inner)"[^>]+/g)].map(m => m[0]);
  assert.equal(passes.length, 2);
  const paths = passes.map(el => el.match(/ d="([^"]+)"/)[1]);
  assert.equal(paths[0], paths[1]);
  passes.forEach((el, i) => {
    near(Number(el.match(/stroke-width="([^"]+)"/)[1]) / svgPerPt, [7,3][i], "path pen");
    assert.equal(el.match(/ stroke="([^"]+)"/)[1], ["red","blue"][i]);
  });
  const b = computeSvgBounds(r.ir.items);
  near((b.maxX - b.minX) * ptPerCm, 67, "stroked line page width");
  near((b.maxY - b.minY) * ptPerCm, 7, "stroked line page height");
});

if (process.env.RECTANGLE_PDFLATEX) {
  test("original pdfLaTeX measures the recorded rectangle pages and anchors", () => {
    const dir = mkdtempSync(join(tmpdir(), "tikzkit-rectangles-"));
    try {
      const log = execFileSync(process.env.RECTANGLE_PDFLATEX, [
        "-no-shell-escape", "-halt-on-error", "-interaction=nonstopmode", fixture
      ], { cwd: dir, encoding: "utf8" });
      for (const id of Object.keys(metrics)) {
        for (const [prefix, index] of [["PAGE",0],["CORNER",2]]) {
          const line = log.split("\n").find(s => s.startsWith(prefix + " " + id + " "));
          assert.ok(line, "missing native " + id);
          line.split(" ").slice(2).forEach((pt, i) => near(parseFloat(pt), metrics[id][index + i], prefix));
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
