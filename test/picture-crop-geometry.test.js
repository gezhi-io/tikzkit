import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const PT_PER_CM = 72.27 / 2.54;
const BP_PER_PT = 72 / 72.27;
const fixture = (name) => readFileSync(new URL(`./fixtures/decoration-box-qa/${name}.tex`, import.meta.url), "utf8");

function near(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 0.00001, `got [${actual}], expected [${expected}]`));
}

function page(source, expectedView, options = {}) {
  // One SVG user unit per TeX pt; physical SVG lengths use 72 bp per inch.
  const { svg, ir, diagnostics } = tikzToSvg(source, { unit: PT_PER_CM, ...options });
  assert.deepEqual(diagnostics, []);
  const view = svg.match(/\bviewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  near(view, expectedView);
  const size = svg.match(/\bwidth="([\d.]+)pt" height="([\d.]+)pt"/).slice(1).map(Number);
  near(size, expectedView.slice(2).map((v) => v * BP_PER_PT));
  return { svg, ir, view };
}

function rectangleOnPage(path, [left, top]) {
  const vertices = [...path.matchAll(/[ML] ([-\d.]+) ([-\d.]+)/g)];
  assert.equal(vertices.length, 4, path);
  const xs = vertices.map(([, x]) => Number(x) - left);
  const ys = vertices.map(([, , y]) => Number(y) - top);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

test("shorthand opening bbox sets the page origin and size but does not clip later ink", () => {
  // Source bbox [-6,14] x [-4,6], scaled by (1.5,2), then bordered L2 B3 R5 T7.
  const { svg, view } = page(fixture("bounding-box-shorthand"), [-11, -19, 37, 30]);
  const blue = svg.match(/<path d="([^"]+)"[^>]*fill="blue"/)[1];
  near(rectangleOnPage(blue, view), [11, -1, 38, 19]);
  assert.match(svg, /<svg\b[^>]*\boverflow="hidden"/);
  assert.doesNotMatch(svg, /clip-path=/);
});

test("transformed preview retains pre-clip ink and measures the clip, not the later fill", () => {
  // Relative to the shift, the tracked union is [-16,0] x [-12,36] pt.
  const { svg, view } = page(fixture("preview-clip-transform"), [2 * PT_PER_CM - 19, PT_PER_CM - 39, 22, 54]);
  const blue = svg.match(/<path d="([^"]+)"[^>]*fill="blue"/)[1];
  const clip = svg.match(/<clipPath id="([^"]+)"[^>]*>\s*<path d="([^"]+)"/);
  const red = svg.match(/<g clip-path="url\(#([^)]+)\)">\s*<path d="([^"]+)"[^>]*fill="red"/);
  assert.equal(red[1], clip[1]);
  near(rectangleOnPage(blue, view), [11, 43, 17, 51]);
  near(rectangleOnPage(clip[2], view), [3, 3, 19, 39]);
  near(rectangleOnPage(red[2], view), [-16, -31, 44, 89]);
});

test("opening picture instructions accumulate in order in the body's bounds scope", () => {
  const source = String.raw`\tikzset{every picture/.style={execute at begin picture={\fill (-3pt,0pt) rectangle (-2pt,1pt);}}}
\begin{tikzpicture}[execute at begin picture={\useasboundingbox (0pt,0pt) rectangle (4pt,2pt);},
  execute at begin picture={\fill[red] (30pt,0pt) rectangle (31pt,1pt);}]
  \fill[blue] (20pt,0pt) rectangle (21pt,1pt);
\end{tikzpicture}`;
  const { ir } = page(source, [-3, -2, 7, 2], { margin: 0 });
  assert.deepEqual(ir.items.filter((i) => i.type === "path").map((i) => [i.style.fill, !!i.excludeFromBounds]), [
    ["black", false], ["red", true], ["blue", true]
  ]);
});

test("a late registration in an earlier picture does not set the next picture's bounds", () => {
  const source = String.raw`\begin{tikzpicture}
  \tikzset{execute at begin picture={\useasboundingbox (-8,-8) rectangle (8,8);}}
  \fill (0,0) rectangle (1,1);
\end{tikzpicture}
\begin{tikzpicture}\fill[blue] (0,0) rectangle (6pt,5pt);\end{tikzpicture}`;
  const { svg, ir } = page(source, [0, -5, 6, 5], { activeFigureId: "figure:1", margin: 0 });
  assert.deepEqual(ir.items.map((i) => i.type), ["path"]);
  assert.doesNotMatch(svg, /<svg\b[^>]*\boverflow=/);
});
