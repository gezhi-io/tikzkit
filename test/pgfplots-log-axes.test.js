import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import {
  axisLogBase,
  axisLogMajorTickValues,
  axisLogMinorTickValues,
  axisLogTickLabel,
  axisPointIsValidForScale
} from "../src/pgfplots/logAxis.js";

function renderAxis(environment, options, coordinates) {
  return tikzToSvg(String.raw`\documentclass[tikz]{standalone}
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}
\begin{document}
\begin{tikzpicture}
\begin{${environment}}[${options}]
  \addplot coordinates {${coordinates}};
\end{${environment}}
\end{tikzpicture}
\end{document}`);
}

function role(item) {
  return item.subtype || item.semanticRole || item.style?.semanticRole;
}

test("pgfplots log axes use power ticks and base-ten minor decades", () => {
  const options = { xmode: "log" };
  assert.equal(axisLogBase(options, "x"), 10);
  assert.deepEqual(axisLogMajorTickValues(options, "x", 1, 1000, 7), [1, 10, 100, 1000]);
  assert.deepEqual(axisLogMinorTickValues(options, "x", [1, 10, 100, 1000], 1, 1000), [
    2, 3, 4, 5, 6, 7, 8, 9,
    20, 30, 40, 50, 60, 70, 80, 90,
    200, 300, 400, 500, 600, 700, 800, 900
  ]);
  assert.equal(axisLogTickLabel(options, "x", 100), "$10^{2}$");
});

test("pgfplots custom log basis changes power ticks and disables decimal minor ticks", () => {
  const options = { ymode: "log", "log basis y": "2" };
  assert.equal(axisLogBase(options, "y"), 2);
  assert.deepEqual(axisLogMajorTickValues(options, "y", 1, 64, 7), [1, 2, 4, 8, 16, 32, 64]);
  assert.deepEqual(axisLogMajorTickValues(options, "y", 1, 64, 4), [2, 8, 32]);
  assert.deepEqual(axisLogMinorTickValues(options, "y", [1, 2, 4, 8, 16, 32, 64], 1, 64), []);
  assert.equal(axisLogTickLabel(options, "y", 32), "$2^{5}$");
});

test("pgfplots sparse logarithmic ticks are centered between range boundaries", () => {
  const options = { ymode: "log" };
  assert.deepEqual(axisLogMajorTickValues(options, "y", 1e-4, 1e4, 5), [1e-3, 1e-1, 10, 1000]);
});

test("pgfplots log scale rejects non-positive coordinates", () => {
  const options = { xmode: "log" };
  assert.equal(axisPointIsValidForScale({ x: -1, y: 2 }, options), false);
  assert.equal(axisPointIsValidForScale({ x: 1, y: 2 }, options), true);
});

test("semilog rendering spaces decades evenly and labels powers", () => {
  const { ir, diagnostics } = renderAxis(
    "semilogxaxis",
    "xmin=1,xmax=1000,ymin=0,ymax=3,grid=both",
    "(-10,3) (1,0) (10,1) (100,2) (1000,3)"
  );
  assert.equal(diagnostics.length, 0);
  const plot = ir.items.find((item) => role(item) === "axis-plot");
  const points = plot.commands.filter((command) => command.type === "moveTo" || command.type === "lineTo");
  assert.equal(points.length, 4, "the non-positive logarithmic coordinate must be discarded");
  const gaps = points.slice(1).map((point, index) => point.x - points[index].x);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.01, "decades must have equal canvas width");
  const labels = ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  for (const label of ["$10^{0}$", "$10^{1}$", "$10^{2}$", "$10^{3}$"]) {
    assert.ok(labels.includes(label), `missing logarithmic tick label ${label}`);
  }
});
