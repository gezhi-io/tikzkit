import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTikz, tikzToSvg } from "../src/internal.js";
import { renderAddplot } from "../src/pgfplots/addplotLowering.js";
import { parseAddplots } from "../src/pgfplots/addplotParser.js";
import { isAxisBarPlot, renderAxisBars } from "../src/pgfplots/bars.js";
import {
  preparePgfplotsHistogram
} from "../src/pgfplots/histogram.js";
import { renderNodesNearCoords } from "../src/pgfplots/plotNodes.js";
import { computeAxisRanges } from "../src/pgfplots/rangeResolver.js";
import { renderAxisGrid } from "../src/pgfplots/grid.js";
import { majorTickValues, renderAxisTicks } from "../src/pgfplots/ticks.js";

const identityGeometry = {
  width: 10,
  height: 10,
  mapPoint: (point) => ({ ...point })
};

test("pgfplots automatic ticks and grid stay within an explicit fractional maximum", () => {
  const ranges = { xMin: 1987, xMax: 2011.9, yMin: 340, yMax: 760 };
  const geometry = { width: 12, height: 10, mapPoint: (point) => ({ ...point }) };
  const axisOptions = { grid: "major" };

  assert.ok(majorTickValues(ranges.xMin, ranges.xMax, 10).includes(2012), "planner may consider a convenient terminal candidate");
  assert.ok(!renderAxisTicks(axisOptions, [], ranges, geometry).some((command) => /\{2012\};$/.test(command)));
  assert.ok(!renderAxisGrid(axisOptions, [], ranges, geometry).some((command) => command.includes("(2012,")));
});

test("pgfplots histogram handler bins table samples and installs interval defaults", () => {
  const [plot] = parseAddplots(String.raw`
    \addplot+[hist={bins=3}]
    table[row sep=\\,y index=0] {
      data\\
      1\\ 2\\ 1\\ 5\\ 4\\ 10\\
      7\\ 10\\ 9\\ 8\\ 9\\ 9\\
    };
  `);
  const prepared = preparePgfplotsHistogram(
    {
      "/tikz/ybar interval": true,
      xticklabel: String.raw`\pgfmathprintnumber\tick--\pgfmathprintnumber\nexttick`
    },
    [plot]
  );
  const histogram = prepared.addplots[0];

  assert.equal(prepared.axisOptions["/tikz/ybar interval"], undefined);
  assert.equal(prepared.axisOptions["ybar interval"], true);
  assert.equal(prepared.axisOptions.xtick, "data");
  assert.equal(prepared.axisOptions.xmajorgrids, true);
  assert.equal(prepared.axisOptions["pgfplots x interval tick labels"], true);
  assert.deepEqual(histogram.histogram.edges, [1, 4, 7, 10]);
  assert.deepEqual(histogram.histogram.counts, [3, 2, 7]);
  assert.deepEqual(histogram.points.map(({ x, y }) => ({ x, y })), [
    { x: 1, y: 3 },
    { x: 4, y: 2 },
    { x: 7, y: 7 },
    { x: 10, y: 7 }
  ]);
});

test("pgfplots interval bars use adjacent coordinates and ignore the terminal value", () => {
  const points = [
    { x: 0, y: 12 },
    { x: 1, y: 6 },
    { x: 3, y: 4 },
    { x: 4, y: 999 }
  ];
  const axisOptions = { "ybar interval": true, "enlarge x limits": false, "enlarge y limits": false };
  const plot = { type: "coordinates", options: { "pgfplots plus": true }, points };
  const ranges = computeAxisRanges(axisOptions, [plot]);
  const bars = renderAxisBars(points, axisOptions, identityGeometry, plot.options, 0, "y", { ...ranges, yMin: 0 });

  assert.deepEqual(ranges, { xMin: 0, xMax: 4, yMin: 4, yMax: 12, zMin: 0, zMax: 1 });
  assert.equal(bars.length, 3);
  assert.equal(
    bars[1],
    String.raw`\draw[axis bar, fill=blue!30, draw=blue] (1,0) -- (3,0) -- (3,6) -- (1,6) -- cycle;`
  );
  assert.ok(!bars.some((command) => command.includes("999")));
});

test("pgfplots interval near-coordinate nodes honor appended node styles and omit the boundary point", () => {
  const plot = {
    type: "coordinates",
    options: { "mycolor!80!white": true, "pgfplots explicit options": true },
    points: [{ x: 0, y: 122 }, { x: 1, y: 66 }, { x: 2, y: 70 }]
  };
  const commands = renderNodesNearCoords(
    plot,
    {
      "ybar interval": true,
      "nodes near coords": true,
      "every node near coord/.append style": String.raw`fill=white,anchor=mid west,shift={(3pt,4pt)},inner sep=0,font=\footnotesize,rotate=45`
    },
    identityGeometry
  );

  assert.equal(commands.length, 2);
  assert.ok(commands.every((command) => command.includes("fill=white")));
  assert.ok(commands.every((command) => command.includes("anchor=mid west")));
  assert.ok(commands.every((command) => command.includes("shift={(3pt,4pt)}")));
  assert.ok(commands.every((command) => command.includes("font=\\footnotesize")));
  assert.ok(commands.every((command) => command.includes("rotate=45")));
  assert.ok(commands.every((command) => command.includes("text=mycolor!80!white")));
  assert.match(commands[0], /at \(0,122\)/);
  assert.match(commands[1], /at \(1,66\)/);
  assert.ok(!commands.some((command) => command.endsWith("{70};")));
});

test("pgfplots bar labels lower rotatebox and formatted point meta into node semantics", () => {
  const commands = renderNodesNearCoords(
    {
      options: {
        "nodes near coords": String.raw`\rotatebox{90}{\scriptsize\pgfmathprintnumber\pgfplotspointmeta}`
      },
      points: [{ x: 1, y: 42 }]
    },
    { ybar: true },
    identityGeometry
  );

  assert.deepEqual(commands, [
    String.raw`\node[axis near coord, anchor=south, font=\scriptsize, rotate=90] at (1,42.08) {42};`
  ]);
  assert.doesNotMatch(commands[0], /rotatebox|pgfmathprintnumber|pgfplotspointmeta/);
});

test("pgfplots histogram interval tick labels span adjacent bin edges", () => {
  const plot = { points: [{ x: 1 }, { x: 4 }, { x: 7 }, { x: 10 }] };
  const commands = renderAxisTicks(
    {
      xtick: "data",
      ytick: "none",
      "pgfplots x interval tick labels": true
    },
    [plot],
    { xMin: 0, xMax: 11, yMin: 0, yMax: 1 },
    identityGeometry
  );
  const labels = commands.filter((command) => command.includes("axis tick label"));

  assert.equal(labels.length, 3);
  assert.ok(labels.some((command) => /at \(2\.5,[^)]+\) \{1--4\}/.test(command)));
  assert.ok(labels.some((command) => /at \(8\.5,[^)]+\) \{7--10\}/.test(command)));
});

test("pgfplots plot-level smooth handler overrides an axis-level ybar default", () => {
  const plotOptions = { mark: "none", smooth: true };
  const plot = {
    type: "coordinates",
    options: plotOptions,
    points: [{ x: 0, y: 3 }, { x: 1, y: 6 }, { x: 2, y: 4 }]
  };
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 6 };

  assert.equal(isAxisBarPlot({ ybar: true }, plotOptions, "y"), false);
  assert.equal(isAxisBarPlot({ ybar: true }, { ...plotOptions, ybar: true }, "y"), true);

  const commands = renderAddplot(plot, { ybar: true }, ranges, identityGeometry, {}, 0);
  assert.equal(commands.length, 1);
  assert.ok(commands[0].includes("axis plot"));
  assert.ok(commands[0].includes(".. controls"));
  assert.ok(!commands[0].includes("axis bar"));
});

test("large interval histogram preserves native foreground layers, tick styles, and explicit bbox crop", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/histogram-large-1d-dataset.tex", "utf8");
  const parsed = parseTikz(source);
  const body = parsed.ast.pictures[0].body;
  const result = tikzToSvg(source);
  const svgTag = result.svg.match(/<svg\b[^>]*>/)?.[0] || "";
  const widthPt = Number(svgTag.match(/\bwidth="([0-9.]+)pt"/)?.[1]);
  const heightPt = Number(svgTag.match(/\bheight="([0-9.]+)pt"/)?.[1]);

  assert.ok(body.indexOf("\\draw[axis bar") < body.indexOf("\\draw[axis grid"));
  assert.match(body, /axis tick label[^\]]*font=\\small[^\]]*inner sep=1pt/);
  assert.doesNotMatch(
    result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /pgfresetboundingbox|useasboundingbox|Unknown coordinate current axis/
  );
  assert.match(result.svg, />∞<\/text>/);
  assert.doesNotMatch(result.svg, />infty<\/text>/);
  assert.ok(widthPt >= 338.5 && widthPt <= 339.5, `expected native width near 338.98pt, got ${widthPt}pt`);
  assert.ok(heightPt >= 133 && heightPt <= 134, `expected native height near 133.24pt, got ${heightPt}pt`);
});

test("pgfplots table options after whitespace map comma-separated x and y headers", () => {
  const csv = [
    "dist,ele",
    "0.0000,361.8000",
    "0.0107,374.2000",
    "0.0206,373.4000"
  ].join("\n");
  const diagnostics = [];
  const [plot] = parseAddplots(
    String.raw`\addplot[mark=none, smooth] table [x=dist, y=ele, col sep=comma] {data.csv};`,
    { pgfplotsTableResolver: (name) => name === "data.csv" ? csv : null },
    diagnostics
  );

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(plot.tableOptions, { x: "dist", y: "ele", "col sep": "comma" });
  assert.deepEqual(plot.points.map(({ x, y }) => ({ x, y })), [
    { x: 0, y: 361.8 },
    { x: 0.0107, y: 374.2 },
    { x: 0.0206, y: 373.4 }
  ]);
  assert.deepEqual(plot.points[0].columns, { dist: "0.0000", ele: "361.8000" });
  assert.equal(isAxisBarPlot({ ybar: true }, plot.options, "y"), false);
});
