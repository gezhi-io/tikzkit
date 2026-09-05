import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { axis3DParentBounds, renderAxis3DColorbar } from "../src/pgfplots/axis3d.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";

const ranges = { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -1, zMax: 1 };

function render(style, rangeOverrides = {}) {
  const currentRanges = { ...ranges, ...rangeOverrides };
  const axisOptions = {
    width: "10cm",
    height: "7cm",
    view: "{35}{25}",
    "pgfplots 3d surface": true,
    "colorbar horizontal": true,
    "colorbar style": style
  };
  const geometry = createAxisGeometry(axisOptions, currentRanges);
  return {
    commands: renderAxis3DColorbar(axisOptions, currentRanges, geometry),
    parent: axis3DParentBounds(axisOptions, currentRanges, geometry)
  };
}

function points(command) {
  return [...String(command || "").matchAll(/\(([-+\d.]+),([-+\d.]+)\)/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
}

test("pgfplots horizontal colorbar can anchor above the parent with upper ticks", () => {
  const { commands, parent } = render(
    "{at={(parent axis.above north west)},anchor=south west,yshift=0.3cm,xtick={-1,0,1},xticklabel pos=upper}"
  );
  const fill = commands.find((command) => command.includes("axis colorbar") && command.includes("draw=none"));
  const rectangle = points(fill);
  const tickLines = commands.filter((command) => command.includes("axis colorbar tick,"));
  const labels = commands.filter((command) => command.includes("axis colorbar tick label"));

  assert.ok(Math.abs(Math.min(...rectangle.map((point) => point.y)) - (parent.maxY + 0.3)) < 0.001);
  assert.ok(tickLines.every((command) => {
    const [from, to] = points(command);
    return to.y > from.y;
  }));
  assert.ok(labels.every((command) => command.includes("anchor=south")));
});

test("pgfplots upper horizontal colorbar accepts top and right tick-label aliases", () => {
  for (const alias of ["upper", "top", "right"]) {
    const { commands } = render(`{at={(0.5,1.05)},anchor=south,xtick={-1,1},xticklabel pos=${alias}}`);
    const tickLines = commands.filter((command) => command.includes("axis colorbar tick,"));
    const labels = commands.filter((command) => command.includes("axis colorbar tick label"));
    assert.ok(tickLines.every((command) => points(command)[1].y > points(command)[0].y), alias);
    assert.ok(labels.every((command) => command.includes("anchor=south")), alias);
  }
});

test("pgfplots upper horizontal colorbar keeps scaled tick multiplier above the bar", () => {
  const { commands } = render(
    "{at={(parent axis.above north west)},anchor=south west,yshift=0.3cm,xtick={10000,20000},xticklabel pos=upper,title={Latency scale}}",
    { zMin: 10000, zMax: 20000 }
  );
  const fill = commands.find((command) => command.includes("axis colorbar") && command.includes("draw=none"));
  const top = Math.max(...points(fill).map((point) => point.y));
  const scale = commands.find((command) => command.includes("axis colorbar tick scale label"));
  const title = commands.find((command) => command.includes("axis colorbar title"));

  assert.match(scale || "", /anchor=south east/);
  assert.ok(points(scale)[0].y > top);
  assert.ok(points(title)[0].y >= top + 0.3);
});

test("pgfplots upper horizontal colorbar reaches browser SVG without diagnostics", () => {
  const result = tikzToSvg(String.raw`\documentclass[tikz]{standalone}
\usepackage{pgfplots}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[
    view={35}{25},colorbar horizontal,
    colorbar style={at={(parent axis.above north west)},anchor=south west,yshift=0.3cm,xtick={-1,0,1},xticklabel pos=upper,title={Score}}
  ]
    \addplot3[surf,domain=-1:1,y domain=-1:1,samples=5] {x*y};
  \end{axis}
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /<linearGradient[^>]+x1="0%"[^>]+x2="100%"/);
  assert.match(result.svg, />Score<\/text>/);
});
