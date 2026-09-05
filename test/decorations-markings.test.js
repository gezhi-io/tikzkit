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
