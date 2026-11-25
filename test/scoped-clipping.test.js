import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { computeSvgBounds } from "../src/renderers/svg/bounds.js";

const picture = body => String.raw`\begin{tikzpicture}${body}\end{tikzpicture}`;
function convert(source) {
  const result = tikzToSvg(source, { margin: 0, idPrefix: "test" });
  assert.deepEqual(result.diagnostics, []);
  return result;
}
const fill = String.raw`\fill[red] (-3,-4) rectangle (5,6);`;

for (const action of [String.raw`\clip`, String.raw`\path[clip]`]) {
  test(action + " clips the paint, not the source geometry, and owns the picture bounds", () => {
    const { ir, svg } = convert(picture(action + " (0,0) rectangle (1,1);" + fill));
    assert.deepEqual(computeSvgBounds(ir.items), { minX: 0, minY: 0, maxX: 1, maxY: 1 });
    assert.equal(ir.items.filter(item => item.type === "path").length, 1);
    assert.match(svg, /<clipPath\b[^>]*clipPathUnits="userSpaceOnUse"><path d="M 0 0 L 0 -100 L 100 -100 L 100 0 Z"/);
    assert.match(svg, /<g clip-path="url\(#test-[^"]+\)"><path\b[^>]*fill="red"/);
  });
}

test("nested clips intersect and restore; previous paint and siblings are unaffected", () => {
  const { ir, svg } = convert(picture(String.raw`
    \fill[black] (-1,0) circle (.2);
    \begin{scope}[xshift=1cm]
      \clip (0,0) rectangle (2,2);
      \begin{scope}
        \clip (1,1) circle (.75);
        \fill[red] (-2,-2) rectangle (4,4);
        \node at (1,1) {R};
      \end{scope}
      \draw[blue] (-2,1) -- (4,1);
    \end{scope}
    \fill[green] (4,0) circle (.2);`));
  const painted = ir.items.filter(item => item.type === "path" || item.type === "textNode");
  assert.deepEqual(painted.map(item => item.scopeClips?.length ?? 0), [0, 2, 2, 1, 0]);
  assert.equal((svg.match(/<clipPath /g) || []).length, 2);
  assert.match(svg, /<clipPath\b[^>]*><path d="M 100 0 L 100 -200/);
  assert.match(svg, /<g clip-path="[^"]+"><g clip-path="[^"]+"><path\b[^>]*fill="red"/);
});

test("background paint uses its own clips and later foreground scopes retain the main clip", () => {
  const source = readFileSync(new URL("./fixtures/scoped-render-parity/background-clip.tex", import.meta.url), "utf8");
  const { ir } = convert(source);
  const fills = ir.items.filter(item => item.type === "path" && item.style.fill !== "none");
  assert.deepEqual(fills.map(item => item.scopeClips?.length ?? 0), [0, 1, 1, 1, 0]);
  const [, disk, before, after] = fills;
  assert.ok(disk.scopeClips[0].commands.some(command => command.type === "curveTo"));
  assert.deepEqual(before.scopeClips[0].commands[0], { type: "moveTo", x: 1, y: .5 });
  assert.deepEqual(after.scopeClips, before.scopeClips);
});

test("reselecting the background keeps its clip and paint order without enlarging the main clip's bounds", () => {
  const { ir } = convert(String.raw`\usetikzlibrary{backgrounds}` + picture(String.raw`
    \clip (0,0) rectangle (1,1);
    \begin{pgfonlayer}{background}
      \begin{scope}
        \clip (2,2) rectangle (4,4);
        \fill[red] (1,1) rectangle (5,5);
        \begin{scope}[on background layer]
          \fill[blue] (3,1) rectangle (5,5);
        \end{scope}
      \end{scope}
    \end{pgfonlayer}`));
  const fills = ir.items.filter(item => item.type === "path");
  assert.deepEqual(fills.map(item => [item.style.fill, item.scopeClips?.length]), [["red", 1], ["blue", 1]]);
  assert.deepEqual(fills[0].scopeClips[0].commands[0], { type: "moveTo", x: 2, y: 2 });
  assert.deepEqual(fills[1].scopeClips, fills[0].scopeClips);
  assert.deepEqual(computeSvgBounds(ir.items), { minX: 0, minY: 0, maxX: 1, maxY: 1 });
});

test("a compound clip uses a single even-odd path, not a union of separate masks", () => {
  const { svg } = convert(picture(String.raw`
    \begin{scope}[even odd rule]
      \clip (0,0) rectangle (2,2) (1,1) circle (.5);
      \fill[blue] (-1,-1) rectangle (3,3);
    \end{scope}`));
  const definition = svg.match(/<clipPath\b[^>]*>([\s\S]*?)<\/clipPath>/)?.[1];
  assert.ok(definition);
  assert.equal((definition.match(/<path /g) || []).length, 1);
  assert.match(definition, /Z.*C .*Z/);
  assert.match(definition, /clip-rule="evenodd"/);
});

test("draw+clip strokes its own contour first, then clips later paint", () => {
  const { ir } = convert(picture(String.raw`
    \draw[clip] (0,0) rectangle (1,1);
    \fill[red] (-1,-1) rectangle (3,3);`));
  assert.deepEqual(ir.items.filter(i => i.type === "path").map(i => i.scopeClips?.length ?? 0), [0, 1]);
});

test("inline picture placement translates the mask exactly as far as the clipped paint", () => {
  const { ir, svg } = convert(picture(String.raw`\fill (0,0) rectangle (2,1);`) +
    picture(String.raw`\clip (0,0) rectangle (1,1); \fill[red] (0,0) rectangle (3,2); \fill[blue] (0,0) circle (.2);`));
  const red = ir.items.find(i => i.type === "path" && i.style?.fill === "red");
  const clipStart = red.scopeClips?.[0].commands[0];
  assert.ok(clipStart?.x > 2);
  assert.deepEqual(clipStart, red.commands[0]);
  assert.equal((svg.match(/<clipPath /g) || []).length, 1);
});
