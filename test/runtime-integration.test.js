import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { interpretTikz, parseTikz, tikzToSvg, tikzToSvgAsync } from "../src/index.js";
import { fontDimensionMetrics, parseDimension } from "../src/engine/math.js";

const picture = (body, options = "") => String.raw`\begin{tikzpicture}[${options}]${body}\end{tikzpicture}`;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("R1/R5 public conversion rejects invalid coordinates without invented geometry or host access", async () => {
  delete globalThis.tikzAuditFlag;
  for (const convert of [tikzToSvg, tikzToSvgAsync]) {
    for (const expression of ["sqrt(-1)", "1/0", String.raw`\doesnotexist`, "globalThis.tikzAuditFlag=29"]) {
      const result = await convert(picture(String.raw`\draw(0,0)coordinate(bad)--({${expression}},1);\draw(2,0)--(3,1);`));
      assert.equal(result.ok, false);
      assert.equal(result.diagnostics.length, 1);
      assert.equal(result.diagnostics[0].severity, "error");
      assert.ok(result.diagnostics[0].expression.includes(expression));
      assert.equal(Object.hasOwn(result.ir.coordinates, "bad"), false);
      assert.deepEqual(result.ir.items.filter((item) => item.type === "path").map((item) => item.commands), [[
        { type: "moveTo", x: 2, y: 0 }, { type: "lineTo", x: 3, y: 1 }
      ]]);
      assert.doesNotMatch(result.svg.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, ""), /NaN|Infinity/);
      assert.equal(globalThis.tikzAuditFlag, undefined);
    }
  }
});

test("R5 invalid explicit node dimensions discard the failed node, not subsequent valid nodes", () => {
  const result = tikzToSvg(picture(String.raw`\node[draw,minimum width={sqrt(-1)}](bad){};\node[draw](good)at(2,0){};`));
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.expression.includes("sqrt(-1)")));
  assert.equal(Object.hasOwn(result.ir.coordinates, "bad"), false);
  assert.deepEqual(result.ir.items.filter((item) => item.type === "nodeBox").map((item) => item.id), ["good"]);
});

test("length-register factors remain products through option and coordinate substitution", () => {
  const result = tikzToSvg(picture(String.raw`\coordinate(p)at(-0.5\pgflinewidth,0);\node[xshift=0.5\pgflinewidth](n){};`));
  assert.deepEqual(result.diagnostics, []);
  close(result.ir.coordinates.p.x, -0.5 * parseDimension("0.4pt"));
  const text = result.ir.items.find((item) => item.type === "textNode");
  close(text.x, 0.5 * parseDimension("0.4pt"));
});

test("R2 sync and async conversion catch zero-step foreach and share nested expansion budgets", async () => {
  for (const convert of [tikzToSvg, tikzToSvgAsync]) {
    const zero = await convert(picture(String.raw`\foreach\x in {1,1,...,3}{\draw(\x,0)--(\x,1);}`));
    assert.equal(zero.ok, false);
    assert.equal(zero.diagnostics[0].code, "foreach-nonprogressing-range");
    const bounded = await convert(picture(String.raw`
      \foreach\x in {1,2}{
        \node[draw](n\x)at(\x,0){};
        \foreach\y in {1,2}{\draw(\x,0)--(\x,\y);}
      }
      \draw(n1)--(n2);`), { foreachLimits: { maxIterations: 3 } });
    assert.equal(bounded.ok, false);
    assert.ok(bounded.diagnostics.some((diagnostic) => diagnostic.code === "foreach-expansion-limit"));
    for (const name of ["n1", "n2"]) {
      assert.ok(bounded.ir.coordinates[name]);
      assert.ok(bounded.ir.items.some((item) => item.type === "nodeBox" && item.id === name));
    }
    assert.ok(bounded.ir.items.some((item) => item.type === "path"));
  }
});

test("frontend plot diagnostics collect consumed expressions but not speculative option probes", async () => {
  for (const expression of ["sqrt(-1)", "1/0", "globalThis.tikzAuditFlag=29"]) {
    for (const convert of [tikzToSvg, tikzToSvgAsync]) {
      const result = await convert(picture(String.raw`\begin{axis}\addplot[domain=0:1,samples=5]{${expression}};\end{axis}`));
      assert.equal(result.ok, false);
      assert.equal(result.diagnostics.length, 1);
      assert.equal(result.diagnostics[0].expression, expression);
    }
  }
  const recovered = tikzToSvg(picture(String.raw`\begin{axis}\addplot[domain=0:1,samples=5]{-x*ln(x)};\end{axis}`));
  assert.deepEqual(recovered.diagnostics, []);
  const normal = tikzToSvg(picture(String.raw`\node[draw,outer sep=auto](a){};\node[draw=none,fill=none]at(a.east){};`));
  assert.deepEqual(normal.diagnostics, []);
});

test("PGFPlots discards isolated nonfinite samples by default and preserves explicit jumps through clipping", () => {
  const render = (axisPolicy = "", plotPolicy = "") => tikzToSvg(picture(String.raw`
    \begin{axis}[xmin=-2,xmax=2,ymin=-.75,ymax=.75,${axisPolicy}]
      \addplot[samples at={-2,-1,0,1,2},${plotPolicy}]{1/x};
    \end{axis}`));
  const commands = (result) => result.ir.items.find((item) => item.subtype === "axis-plot").commands;
  const defaultResult = render();
  const discard = render("unbounded coords=discard");
  const jump = render("unbounded coords=jump");
  const override = render("unbounded coords=jump", "unbounded coords=discard");
  for (const result of [defaultResult, discard, jump, override]) assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(commands(defaultResult), commands(discard));
  assert.deepEqual(commands(override), commands(discard));
  assert.equal(commands(discard).filter((command) => command.type === "moveTo").length, 1);
  assert.deepEqual(commands(jump).map((command) => command.type), ["moveTo", "lineTo", "moveTo", "lineTo"]);
  assert.ok(commands(jump).every((command) => Number.isFinite(command.x) && Number.isFinite(command.y)));
});

test("partial real-domain failures are skipped, but wholly invalid and partially unbound plots still fail", () => {
  const render = (expression) => tikzToSvg(picture(String.raw`
    \begin{axis}[domain=-1:1,ymin=-2,ymax=2]
      \addplot[samples at={-1,0,1}]{${expression}};
    \end{axis}`));
  const partial = render("sqrt(x)");
  assert.deepEqual(partial.diagnostics, []);
  assert.ok(partial.ir.items.some((item) => item.subtype === "axis-plot"));
  for (const [expression, code] of [["sqrt(-1)", "math-nonfinite"], ["1/0", "math-nonfinite"], ["x<0?missing:1", "math-unknown-variable"]]) {
    const result = render(expression);
    assert.equal(result.ok, false, expression);
    assert.equal(result.diagnostics.length, 1, expression);
    assert.equal(result.diagnostics[0].code, code);
    assert.equal(result.diagnostics[0].expression, expression);
  }
});

test("3D quiver plots do not enter the two-dimensional current-plot sampling fallback", () => {
  const result = tikzToSvg(picture(String.raw`
    \begin{axis}[domain=-1:1,y domain=-1:1,xmin=-1,xmax=1,ymin=-1,ymax=1]
      \addplot3[quiver={u={x},v={y}},samples=3]{x+y};
    \end{axis}`));
  assert.deepEqual(result.diagnostics, []);
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd?.kind === "stealth");
  assert.equal(arrows.length, 9);
  assert.ok(arrows.every((item) => item.commands.length === 2));
});

test("datavisualization uses safe PGF maths, local radian suffixes, and seeded random values", async () => {
  const source = (expression) => String.raw`\usetikzlibrary{datavisualization.formats.functions}
    \tikz\datavisualization[scientific axes=clean,visualize as line,data/format=function]
      data { var x : interval [0:2] samples 3; func y = ${expression}; };`;
  const valid = source(String.raw`sin((\value x*0)r)+cos(0)+rnd+random(2)`);
  const first = tikzToSvg(valid), second = await tikzToSvgAsync(valid);
  assert.deepEqual(first.diagnostics, []);
  assert.deepEqual(second.diagnostics, []);
  const plots = (result) => result.ir.items.filter((item) => item.subtype === "axis-plot");
  assert.ok(plots(first).length);
  assert.deepEqual(plots(first), plots(second));
  const invalid = await tikzToSvgAsync(source("sqrt(-1)"));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.diagnostics[0].code, "math-nonfinite");
});

test("R6 ambient font switches update coordinates dynamically and restore at group boundaries", () => {
  const result = tikzToSvg(picture(String.raw`
    \coordinate(a)at(1em,1ex);
    \large\coordinate(b)at(1em,1ex);
    {\tiny\coordinate(c)at(1em,1ex);}
    \coordinate(d)at(1em,1ex);`));
  assert.deepEqual(result.diagnostics, []);
  for (const [name, sizePt] of [["a", 10], ["b", 12], ["c", 5], ["d", 12]]) {
    const font = { sizePt };
    close(result.ir.coordinates[name].x, parseDimension("1em", {}, { font }));
    close(result.ir.coordinates[name].y, parseDimension("1ex", {}, { font }));
  }
  close(parseDimension("1em"), fontDimensionMetrics({ sizePt: 10 }).emPt / 28.4527559);
});

test("R6 native TikZ font= affects text only while node font= changes geometry, including inline nodes", () => {
  // pdfTeX 2025: normal/font=large widths 20.00003pt; node font=large 23.49976pt.
  for (const key of ["font", "node font"]) {
    const result = tikzToSvg(picture(String.raw`
      \coordinate(p)at(1em,1ex);
      \node[${key}=\large,draw,inner sep=1em,outer sep=0pt,minimum size=0pt](n)at(1em,1ex){};
      \draw(0,0)--(1,1)node[${key}=\large,draw,inner sep=1em,outer sep=0pt,minimum size=0pt](m){};`, String.raw`font=\large`));
    assert.deepEqual(result.diagnostics, []);
    close(result.ir.coordinates.p.x, parseDimension("1em"));
    close(result.ir.coordinates.p.y, parseDimension("1ex"));
    const font = { sizePt: key === "node font" ? 12 : 10 };
    close(result.ir.coordinates.n.x, parseDimension("1em", {}, { font }));
    close(result.ir.coordinates.n.y, parseDimension("1ex", {}, { font }));
    for (const box of result.ir.items.filter((item) => item.type === "nodeBox")) close(box.width, 2 * parseDimension("1em", {}, { font }));
    assert.ok(result.ir.items.filter((item) => item.type === "textNode").every((item) => item.font.sizePt === 12));
  }
});

test("R6 engine accepts frontend document and ambient font metadata", () => {
  const { ast } = parseTikz(picture(String.raw`\coordinate(p)at(1em,1ex);`));
  ast.documentFont = { sizePt: 12, baselineSkipPt: 14.5 };
  close(interpretTikz(ast).ir.coordinates.p.x, parseDimension("1em", {}, { font: { sizePt: 12 } }));
  ast.pictures[0].ambientFont = String.raw`\tiny`;
  close(interpretTikz(ast).ir.coordinates.p.x, parseDimension("1em", {}, { font: { sizePt: 5 } }));
});

test("activation, b-tree, portable-font and fit/matrix inputs retain their geometry without probe diagnostics", () => {
  for (const [fixture, count] of [
    ["examples/latex-examples/activation-functions.tex", 71],
    ["examples/latex-examples/b-tree-2.tex", 41],
    ["examples/latex-examples/b-tree-3-evolution.tex", 76],
    ["font-visual-gates/mactex-portable-fonts.tex", 11]
  ]) {
    const result = tikzToSvg(readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), "utf8"));
    assert.deepEqual(result.diagnostics, [], fixture);
    assert.equal(result.ir.items.length, count, fixture);
  }
  const matrix = tikzToSvg(picture(String.raw`\matrix(m)[matrix of nodes,row sep=-\pgflinewidth,nodes={draw}]{0 &1\\};\node[draw,fit=(m)](f){};`));
  assert.deepEqual(matrix.diagnostics, []);
  assert.ok(matrix.ir.items.some((item) => item.type === "nodeBox" && item.id === "f"));
});
