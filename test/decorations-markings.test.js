import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { TIKZ_LINE_WIDTHS } from "../src/tikz/metrics.js";

function markersFor(decoration, pathOptions = "blue,thick") {
  const source = String.raw`
\usetikzlibrary{arrows.meta,decorations.markings}
\begin{tikzpicture}
  \draw[${pathOptions},postaction={decorate},decoration={markings,${decoration}}]
    (0,0) -- (4,0);
\end{tikzpicture}`;
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  return { result, markers: result.ir.items.filter((item) => item.type === "marker") };
}

test("decorations.markings resolves fractional and absolute positions from either path end", () => {
  const { markers } = markersFor(String.raw`
    mark=at position -0.25 with {\arrow{Stealth}},
    mark=at position 10mm with {\arrow{Latex}},
    mark=at position -5mm with {\arrow{>}}`);

  assert.deepEqual(markers.map((marker) => marker.x), [3, 1, 3.5]);
  assert.deepEqual(markers.map((marker) => marker.kind), ["stealth", "latex", "to"]);
});

test("decorations.markings advances between positions by an absolute dimension", () => {
  const { markers } = markersFor(
    String.raw`mark=between positions 5mm and -5mm step 10mm with {\arrow{Stealth}}`
  );

  assert.deepEqual(markers.map((marker) => marker.x), [0.5, 1.5, 2.5, 3.5]);
});

test("decorations.markings skips a reversed interval like PGF", () => {
  const { markers } = markersFor(
    String.raw`mark=between positions .8 and .2 step .1 with {\arrow{Stealth}}`
  );

  assert.equal(markers.length, 0);
});

test("decorations.markings renders arrow actions with scoped paint, width, and reversal", () => {
  const { result, markers } = markersFor(
    String.raw`mark=at position .5 with {\arrowreversed[red,very thick]{Latex}}`
  );

  assert.equal(markers.length, 1);
  assert.equal(markers[0].reversed, true);
  assert.equal(markers[0].style.stroke, "red");
  assert.equal(markers[0].style.lineWidth, TIKZ_LINE_WIDTHS.veryThick);
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-latex"/);
  assert.match(result.svg, /fill="red"/);
  assert.match(result.svg, /scale\(-1 1\)/);
});

test("decorations.markings does not execute without decorate", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{decorations.markings}
\begin{tikzpicture}
  \draw[decoration={markings,mark=at position .5 with {\arrow{>}}}] (0,0) -- (4,0);
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.items.some((item) => item.type === "marker"), false);
});

test("decorations.markings substitutes TeX variables in direct decorate positions", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{decorations.markings}
\def\offset{-5mm}
\begin{tikzpicture}
  \draw[decorate,decoration={markings,mark=at position \offset with {\arrow{>}}}]
    (0,0) -- (4,0);
\end{tikzpicture}`);
  const markers = result.ir.items.filter((item) => item.type === "marker");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].x, 3.5);
});

test("decorations.markings executes node code in the local path frame", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{decorations.markings}
\begin{tikzpicture}
  \draw[postaction={decorate},decoration={markings,
    mark=at position .5 with {\node[red,above]{mid};}}]
    (0,0) -- (2,2);
\end{tikzpicture}`);
  const label = result.ir.items.find((item) => item.type === "textNode" && item.text === "mid");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(label, "expected marking node code to create a text node");
  assert.ok(label.x > 0.8 && label.x < 1.2);
  assert.ok(label.y > 1, `expected the above anchor to offset from the diagonal, got y=${label.y}`);
  assert.equal(label.style.fill, "red");
});

test("decorations.markings executes repeated drawing code along the path tangent", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{decorations.markings}
\begin{tikzpicture}[decoration={markings,
  mark=between positions .25 and .75 step .25 with {
    \draw[orange] (-2pt,-2pt) -- (2pt,2pt);
    \draw[blue] (2pt,-2pt) -- (-2pt,2pt);}}]
  \draw[postaction={decorate}] (0,0) -- (0,4);
\end{tikzpicture}`);
  const markingPaths = result.ir.items.filter((item) => item.subtype === "decoration-marking-code");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(markingPaths.length, 6);
  assert.deepEqual([...new Set(markingPaths.map((item) => item.style.stroke))].sort(), ["blue", "rgb(255 128 0)"]);
  assert.ok(markingPaths.every((item) => item.commands.every((command) => command.type === "moveTo" || command.type === "lineTo")));
});

test("decorations.markings exposes sequence and distance info to marking nodes", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{decorations.markings}
\begin{tikzpicture}[decoration={markings,
  mark=between positions 0 and 1 step .5 with {
    \node {\pgfkeysvalueof{/pgf/decoration/mark info/sequence number}:\pgfkeysvalueof{/pgf/decoration/mark info/distance from start}};}}]
  \draw[blue,postaction={decorate}] (0,0) -- (2,0);
\end{tikzpicture}`);
  const labels = result.ir.items.filter((item) => item.type === "textNode" && item.subtype === "decoration-marking-code");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(labels.map((item) => item.text), ["1:0pt", "2:28.4527559pt", "3:56.9055118pt"]);
  assert.ok(labels.every((item) => item.style.fill === "blue"));
});
