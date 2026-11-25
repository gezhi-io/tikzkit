import assert from "node:assert/strict";
import test from "node:test";
import { normalizeColor, normalizeOptions, parseOptions, styleDefinitionsFromOptions } from "../src/engine/options.js";
import { tikzToSvg } from "../src/index.js";
import {
  backgroundFrameBounds, backgroundFrameKind, backgroundFramePath, backgroundStyles
} from "../src/tikz/libraries/backgrounds.js";
import { lineWidthFromPt } from "../src/tikz/metrics.js";

function pictureOptions(keys) {
  const raw = parseOptions(keys, backgroundStyles);
  const styles = { ...backgroundStyles, ...styleDefinitionsFromOptions(raw, backgroundStyles) };
  return normalizeOptions("path", raw, { styles, variables: {} }).options;
}

const content = Object.freeze({ minX: 3, minY: -4, maxX: 13, maxY: 7 });

test("show styles enqueue native macros without absorbing user code or deduplicating style calls", () => {
  const hooks = pictureOptions(String.raw`pair/.style={show background left,gridded},
    execute at end picture={\before},pair,framed,show background top,
    execute at end picture={\after},show background bottom,pair,show background right,framed`
  )["execute at end picture"];
  assert.deepEqual(hooks.map(code => backgroundFrameKind(code) ?? code), [
    "\\before", "left", "grid", "rectangle", "top", "\\after", "bottom", "left", "grid", "right", "rectangle"
  ]);
  assert.equal(hooks[3], "\\tikz@background@framed");
  assert.equal(backgroundFrameKind("  " + hooks[2] + "\n"), "grid");
  assert.equal(backgroundFrameKind(hooks[2] + " \\after"), null);
});

test("replacing a show style retargets its alias, and appending to the alias preserves both hooks", () => {
  const hooks = pictureOptions(String.raw`show background rectangle/.style={show background left},
    framed/.append style={execute at end picture={\afterLeft},show background right},
    gridded/.style={show background bottom},framed,gridded,show background grid`
  )["execute at end picture"];
  assert.deepEqual(hooks.map(code => backgroundFrameKind(code) ?? code), [
    "left", "\\afterLeft", "right", "bottom", "grid"
  ]);
  assert.equal(pictureOptions("show background rectangle/.style={},framed")["execute at end picture"], undefined);
});

test("inner and outer separators each execute as two ordered registers, evaluated only at save time", () => {
  for (const [keys, expected] of [
    ["", ["1ex", "1ex", "0ex", "0ex"]],
    ["inner frame xsep=9pt,loose background,inner frame ysep=3pt", ["2ex", "3pt", "0ex", "0ex"]],
    ["inner frame sep=3pt,tight background", ["0ex", "0ex", "0ex", "0ex"]],
    ["pad/.style={inner frame sep=3pt,outer frame ysep=4pt},inner frame ysep=7pt,pad,outer frame sep=5pt",
      ["3pt", "3pt", "5pt", "5pt"]],
    ["inner frame xsep=1pt,inner frame sep=2pt,inner frame xsep=3pt,outer frame ysep=4pt,outer frame sep=5pt,outer frame ysep=-6pt",
      ["3pt", "2pt", "5pt", "-6pt"]],
    ["/tikz/outer frame xsep=2pt,outer frame sep=1pt,/tikz/inner frame ysep={1pt+2pt},/tikz/outer frame xsep=9pt",
      ["1ex", "1pt+2pt", "9pt", "1pt"]]
  ]) {
    const parsed = [];
    backgroundFrameBounds(content, pictureOptions(keys), value => { parsed.push(value); return 0; });
    assert.deepEqual(parsed, expected, keys);
  }
});

test("rectangle and grid use the inner corners; each side uses outer separation only along its tangent", () => {
  const opts = pictureOptions("inner frame sep=2pt,inner frame ysep=1pt,outer frame xsep=4pt,outer frame ysep=-8pt");
  const frozen = backgroundFrameBounds(content, opts, Number.parseFloat);
  assert.deepEqual(frozen, {
    inner: { minX: 1, minY: -5, maxX: 15, maxY: 8 },
    outer: { minX: -3, minY: 3, maxX: 19, maxY: 0 }
  });
  for (const [kind, operator, x1, y1, x2, y2] of [
    ["rectangle", "rectangle", 1, -5, 15, 8], ["grid", "grid", 1, -5, 15, 8],
    ["top", "--", -3, 8, 19, 8], ["bottom", "--", -3, -5, 19, -5],
    ["left", "--", 1, 3, 1, 0], ["right", "--", 15, 3, 15, 0]
  ]) {
    assert.deepEqual(backgroundFramePath(kind, frozen), {
      style: `background ${kind}`, operator, from: { x: x1, y: y1 }, to: { x: x2, y: y2 }
    });
  }
});

test("background grid looks up help lines; extensions keep its draw action and a replacement can drop it", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`\usetikzlibrary{backgrounds}
    \begin{tikzpicture}
      \path[background grid] (0,0) -- (1,0);
      \path[background top] (0,1) -- (1,1);
      \tikzset{help lines/.style={color=blue,line width=1pt},background grid/.append style={dashed},
        background rectangle/.style={fill=blue}}
      \path[background grid] (0,2) -- (1,2);
      \path[background rectangle] (0,3) rectangle (1,4);
    \end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  const styles = ir.items.filter(item => item.type === "path").map(item => item.style);
  assert.deepEqual(styles.map(s => [s.stroke, s.fill, s.lineWidth]), [
    ["gray", "none", lineWidthFromPt(.2)], ["black", "none", lineWidthFromPt(.4)],
    ["blue", "none", lineWidthFromPt(1)], ["none", "blue", lineWidthFromPt(.4)]
  ]);
  assert.ok(styles[2].dashArray.length > 0);
});

test("background scope payload overrides its hook; a style can switch layers without bringing the foreground pen", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`\usetikzlibrary{backgrounds}
    \tikzset{back/.style={on background layer={#1}},
      every on background layer/.style={color=green,line width=1pt}}
    \begin{tikzpicture}[line width=5pt]
      \draw[blue] (0,0) -- (1,0);
      \begin{scope}[back={color=yellow},line width=9pt]
        \draw (0,0) -- (2,0);
      \end{scope}
      \begin{scope}[/tikz/on background layer]
        \draw (0,0) -- (3,0);
      \end{scope}
    \end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.items.map(i => [i.commands.at(-1).x, i.style.stroke, i.style.lineWidth]), [
    [2, normalizeColor("yellow"), lineWidthFromPt(1)], [3, normalizeColor("green"), lineWidthFromPt(1)],
    [1, "blue", lineWidthFromPt(5)]
  ]);
});

test("a subsequent automatic frame reuses the explicit layer's device pen, not the main pen", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`\usetikzlibrary{backgrounds}
    \begin{tikzpicture}[red,line width=6pt,framed,inner frame sep=1pt]
      \begin{scope}[on background layer={draw=blue,fill=green,line width=3pt,dotted}]
        \draw (0,0) -- (1,1);
      \end{scope}
      \draw (.5,0) -- (1.5,1);
    \end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  const [line, frame, foreground] = ir.items;
  assert.deepEqual([line, frame, foreground].map(i => [i.style.stroke, i.style.lineWidth]), [
    ["blue", lineWidthFromPt(3)], ["blue", lineWidthFromPt(3)], ["red", lineWidthFromPt(6)]
  ]);
  assert.deepEqual(frame.style.dashArray, line.style.dashArray);
  assert.equal(frame.boundsLineWidth, lineWidthFromPt(.4));
});

test("background node text retains its TeX color independently of the layer's stroke and fill", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`\usetikzlibrary{backgrounds}
    \begin{tikzpicture}[color=red]
      \begin{scope}[on background layer] \node at (0,0) {A}; \end{scope}
      \begin{scope}[on background layer={draw=blue,fill=green}]
        \node[draw,fill] at (1,0) {B};
      \end{scope}
      \begin{scope}[on background layer] \node[fill,draw] at (2,0) {C}; \end{scope}
      \node at (3,0) {D};
    \end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.items.filter(i => i.type === "nodeBox").map(i => [i.style.stroke, i.style.fill]),
    Array(2).fill(["blue", normalizeColor("green")]));
  assert.deepEqual(ir.items.filter(i => i.type === "textNode").map(i => i.style.fill), Array(4).fill("red"));
});
