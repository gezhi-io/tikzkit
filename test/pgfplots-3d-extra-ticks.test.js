import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { axis3DParentBounds, renderAxis3DGrid, renderAxis3DTicks } from "../src/pgfplots/axis3d.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";

const ranges = { xMin: 0, xMax: 4, yMin: 0, yMax: 2, zMin: 1, zMax: 16 };

function render(options = {}) {
  const axisOptions = {
    width: "10cm",
    height: "7cm",
    view: "{35}{25}",
    "pgfplots 3d surface": true,
    xtick: "{0,4}",
    ytick: "{0,2}",
    ztick: "{1,16}",
    ...options
  };
  const geometry = createAxisGeometry(axisOptions, ranges);
  return {
    ticks: renderAxis3DTicks(axisOptions, ranges, geometry),
    grid: renderAxis3DGrid(axisOptions, ranges, geometry)
  };
}

test("pgfplots 3d renders an independent extra z tick and label", () => {
  const { ticks } = render({
    "extra z ticks": "{8}",
    "extra z tick labels": "{threshold}"
  });

  assert.ok(ticks.some((command) => command.endsWith("{threshold};")), ticks.join("\n"));
});

test("pgfplots 3d extra x y and z ticks retain independent labels and styles", () => {
  const { ticks } = render({
    "extra x ticks": "{1}",
    "extra x tick labels": "{ingest}",
    "extra x tick style": "tick style={red,line width=0.8pt},tick label style={text=red,rotate=12}",
    "extra y ticks": "{1.5}",
    "extra y tick labels": "{batch}",
    "extra y tick style": "tick label style={text=blue}",
    "extra z ticks": "{4}",
    "extra z tick labels": "{limit}",
    "extra z tick style": "tick label style={font=\\scriptsize}"
  });

  const ingest = ticks.find((command) => command.endsWith("{ingest};")) || "";
  const batch = ticks.find((command) => command.endsWith("{batch};")) || "";
  const limit = ticks.find((command) => command.endsWith("{limit};")) || "";
  assert.match(ingest, /text=red/);
  assert.match(ingest, /rotate=12/);
  assert.match(batch, /text=blue/);
  assert.match(limit, /font=.*scriptsize/);
  assert.ok(ticks.some((command) => /\\draw\[axis tick[^\]]*red[^\]]*line width=0\.8pt/.test(command)), ticks.join("\n"));
});

test("pgfplots 3d logarithmic extra ticks use data values for power labels and equal spacing", () => {
  const { ticks } = render({
    zmode: "log",
    "log basis z": 2,
    ztick: "{1,4,16}",
    "extra z ticks": "{2,8}"
  });

  assert.ok(ticks.some((command) => command.endsWith("{$2^{1}$};")), ticks.join("\n"));
  assert.ok(ticks.some((command) => command.endsWith("{$2^{3}$};")), ticks.join("\n"));
});

test("pgfplots 3d extra ticks draw their own major grid without changing ordinary ticks", () => {
  const { ticks, grid } = render({
    grid: "none",
    "extra z ticks": "{8}",
    "extra z tick style": "grid=major,grid style={red,dashed}"
  });

  assert.equal(ticks.filter((command) => command.includes("axis tick label")).length, 7);
  assert.equal(grid.filter((command) => command.includes("axis 3d grid")).length, 2);
  assert.ok(grid.every((command) => command.includes("red") && command.includes("dashed")), grid.join("\n"));
});

test("pgfplots 3d parent bounds reserve space for long extra tick labels", () => {
  const compact = {
    xtick: "{}",
    ytick: "{}",
    ztick: "{}",
    "extra x ticks": "{0}",
    "extra x tick labels": "{A}"
  };
  const wide = {
    ...compact,
    "extra x tick labels": "{A very long deployment checkpoint}"
  };
  const compactOptions = { width: "10cm", height: "7cm", view: "{35}{25}", "pgfplots 3d surface": true, ...compact };
  const wideOptions = { width: "10cm", height: "7cm", view: "{35}{25}", "pgfplots 3d surface": true, ...wide };
  const compactBounds = axis3DParentBounds(compactOptions, ranges, createAxisGeometry(compactOptions, ranges));
  const wideBounds = axis3DParentBounds(wideOptions, ranges, createAxisGeometry(wideOptions, ranges));

  assert.ok(wideBounds.width > compactBounds.width + 1);
});

test("pgfplotsset every extra z tick style reaches the browser 3d renderer", () => {
  const result = tikzToSvg(String.raw`\documentclass[tikz]{standalone}
\usepackage{pgfplots}
\pgfplotsset{every extra z tick/.style={tick label style={text=red}}}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[view={35}{25},xmin=0,xmax=1,ymin=0,ymax=1,zmin=1,zmax=16,extra z ticks={8},extra z tick labels={threshold}]
    \addplot3 coordinates {(0,0,1) (1,1,16)};
  \end{axis}
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /<text[^>]*fill="(?:red|rgb\(255,0,0\))"[^>]*>threshold<\/text>/);
});
