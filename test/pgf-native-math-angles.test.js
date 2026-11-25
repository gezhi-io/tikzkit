import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { evaluateMath, parseDimension } from "../src/engine/math.js";
import { evaluateAxisExpression } from "../src/pgfplots/expressions.js";

// MacTeX pgfmathfunctions.round/basic.code.tex: ties away from zero,
// truncated-division remainder, and one divisor added for negative Mod.
for (const [expression, expected] of [
  ["round(-2.5)", -3], ["round(-1.5)", -2], ["round(-.5)", -1],
  ["round(.5)", 1], ["round(2.5)", 3], ["round(-2.49)", -2],
  ["round(-2.51)", -3], ["round(0)", 0], ["round(-.1)", 0],
  ["mod(-5,3)", -2], ["mod(5,-3)", 2], ["mod(-5,-3)", -2],
  ["Mod(-5,3)", 1], ["Mod(5,-3)", 2], ["Mod(-5,-3)", -5],
  ["mod(-6,3)", 0], ["Mod(-6,3)", 0]
]) {
  test(`native PGF numeric semantics: ${expression}`, () => {
    assert.equal(evaluateMath(expression), expected, "TikZ coordinate evaluator");
    assert.equal(evaluateAxisExpression(expression, 0), expected, "PGFPlots evaluator");
  });
}

test("round never turns an invalid subexpression into a valid zero", () => {
  assert.ok(Number.isNaN(evaluateMath("round(sqrt(-1))")));
  assert.ok(Number.isNaN(evaluateAxisExpression("round(sqrt(-1))", 0)));
});

test("native numeric semantics reach named coordinates and macro expansion", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \pgfmathsetmacro{\r}{round(-2.5)}
    \coordinate (rounded) at (\r,0);
    \coordinate (remainder) at ({mod(-5,3)},1);
    \coordinate (positive) at ({Mod(-5,3)},2);
  \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.coordinates.rounded.x, -3);
  assert.equal(result.ir.coordinates.remainder.x, -2);
  assert.equal(result.ir.coordinates.positive.x, 1);
});

function angle(command, options, kind = "angle", pictureOptions = "") {
  const result = tikzToSvg(String.raw`\usetikzlibrary{angles,quotes}
    \begin{tikzpicture}[${pictureOptions}]
    \coordinate (O) at (0,0);
    \coordinate (A) at (1,0);
    \coordinate (B) at (0,1);
    ${command}[${options}] {${kind}=A--O--B};
    \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  return {
    paths: result.ir.items.filter(item => item.subtype === "angle-pic"),
    label: result.ir.items.find(item => item.type === "textNode")
  };
}

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
}

for (const command of [String.raw`\pic`, String.raw`\path pic`]) {
  for (const [eccentricity, factor] of [["", .6], [",angle eccentricity=0", 0], [",angle eccentricity=-.3", -.3]]) {
    test(`${command}: native angle label eccentricity ${factor}`, () => {
      const { label } = angle(command, String.raw`draw,"$\alpha$"${eccentricity}`);
      close(label.x, .5 * factor / Math.SQRT2);
      close(label.y, .5 * factor / Math.SQRT2);
    });
  }
  for (const kind of ["angle", "right angle"]) {
    test(`${command}: ${kind} fills the sector but strokes only its outer boundary`, () => {
      const { paths } = angle(command, "draw=red,fill=blue!20,->", kind);
      assert.equal(paths.length, 2);
      const [background, foreground] = paths;
      assert.equal(background.style.stroke, "none");
      assert.equal(background.style.fill, "rgb(204 204 255)");
      assert.equal(background.commands.at(-1).type, "closePath");
      assert.ok(!background.style.markerStart && !background.style.markerEnd);
      assert.equal(foreground.style.stroke, "red");
      assert.equal(foreground.style.fill, "none");
      assert.ok(foreground.style.markerEnd);
      assert.ok(!foreground.commands.some(c => c.type === "closePath"));
      close(foreground.commands[0].x, .5);
      close(foreground.commands[0].y, 0);
      if (kind === "right angle") assert.equal(foreground.commands.length, 3);
      else assert.ok(foreground.commands.slice(1).every(c => c.type === "curveTo"));
    });
  }
  for (const options of ["fill=green!20", "fill=green!20,draw=none", ""]) {
    test(`${command}: does not invent a stroke for [${options}]`, () => {
      const { paths } = angle(command, options);
      assert.ok(paths.every(p => p.style.stroke === "none"));
      assert.equal(paths.filter(p => p.style.fill !== "none").length, options ? 1 : 0);
    });
  }
  test(`${command}: nonpositive angle radius uses PGF's 12pt fallback`, () => {
    const { paths, label } = angle(command, String.raw`draw,angle radius=0pt,"$x$"`, "right angle");
    close(paths[0].commands[0].x, parseDimension("12pt"));
    close(label.x, parseDimension("12pt") * .6);
    close(label.y, parseDimension("12pt") * .6);
  });
}

test("inline pic inherits path eccentricity and expands angle styles", () => {
  const { label, paths } = angle(String.raw`\path[angle eccentricity=1.2] pic`,
    String.raw`measured,"$x$"`, "angle", "measured/.style={draw=red,angle radius=1cm}");
  close(paths[0].commands[0].x, 1);
  close(label.x, 1.2 / Math.SQRT2);
  close(label.y, 1.2 / Math.SQRT2);
});

test("angle backgrounds sit behind parent edges, foreground arcs above the parent path", () => {
  const result = tikzToSvg(String.raw`\usetikzlibrary{angles,quotes}
    \begin{tikzpicture}
    \coordinate (O) at (0,0); \coordinate (A) at (1,0); \coordinate (B) at (0,1);
    \draw[black] (A) edge[blue] (B) (O) -- (A)
      pic[draw=red,fill=yellow] {angle=A--O--B};
    \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  const painted = result.ir.items.filter(item => item.type === "path");
  const fill = painted.findIndex(p => p.picLayer === "background");
  const arc = painted.findIndex(p => p.picLayer === "foreground");
  const edge = painted.findIndex(p => p.subtype === "edge");
  const parent = painted.findIndex(p => !p.subtype);
  assert.ok(fill >= 0 && fill < edge && fill < parent, "fill must not erase either path or edge");
  assert.ok(arc > edge && arc > parent, "foreground is deferred until the path is painted");
});

function pathPaintOrder(items) {
  return items.flatMap(item => {
    if (item.picLayer === "background") return ["sector"];
    if (item.picLayer === "foreground") return ["arc"];
    if (item.subtype === "decoration-text") return [`post:${item.text}`];
    if (item.type === "textNode") return [item.text];
    if (item.type === "path") return [item.subtype || "shaft"];
    return [];
  });
}

test("parent postactions precede the source-ordered pic, edge and their labels", () => {
  const source = readFileSync(new URL("./fixtures/scoped-render-parity/foreground-order.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(pathPaintOrder(result.ir.items), [
    "sector", "shaft", "post:P", "arc", "Q", "edge", "E",
    "sector", "shaft", "post:P", "edge", "E", "arc", "Q"
  ]);
});

test("each edge runs only its own postactions at its position in the foreground", () => {
  const result = tikzToSvg(String.raw`\usetikzlibrary{decorations.text}
    \begin{tikzpicture}
    \draw[decoration={text along path,text={P}},postaction={decorate}]
      (0,0) edge[postaction={decorate,decoration={text along path,text={E}}}] (0,1)
            edge (1,1) -- (2,0);
    \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(pathPaintOrder(result.ir.items), ["shaft", "post:P", "edge", "post:E", "edge"]);
});
