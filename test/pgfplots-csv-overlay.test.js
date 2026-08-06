import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { parseOptions } from "../src/engine/options.js";
import { renderAddplot } from "../src/pgfplots/addplotLowering.js";
import { parsePgfplotsTablePoints } from "../src/pgfplots/addplotParser.js";
import { transformAxisStatementCoordinates } from "../src/pgfplots/axisOverlay.js";
import { applyPgfplotsCycleStyles } from "../src/pgfplots/axisTikzLowering.js";
import { renderAxisBox } from "../src/pgfplots/axisLines.js";
import { createAxisOptions } from "../src/pgfplots/axisOptions.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";
import { renderAxisLabels } from "../src/pgfplots/labels.js";
import { legendBoxFromAnchor, legendPlacement, renderLegendEntries } from "../src/pgfplots/legend.js";
import { renderPlotMark } from "../src/pgfplots/marks.js";
import { renderNodesNearCoords } from "../src/pgfplots/plotNodes.js";
import { computeAxisRanges } from "../src/pgfplots/rangeResolver.js";
import { axisAutoMajorTickCountForOptions, majorTickValues, renderAxisTicks } from "../src/pgfplots/ticks.js";

test("plain addplot table entries receive the native default color-cycle marks", () => {
  const plots = applyPgfplotsCycleStyles([
    { type: "coordinates", source: "table", options: {} },
    { type: "coordinates", source: "table", options: {} },
    {
      type: "coordinates",
      source: "table",
      options: { orange: true, mark: "halfcircle", "pgfplots explicit options": true }
    }
  ]);

  assert.equal(plots[0].options.mark, "*");
  assert.equal(plots[0].options["mark fill"], "blue!80!black");
  assert.equal(plots[1].options.mark, "square*");
  assert.equal(plots[1].options["mark fill"], "red!80!black");
  assert.equal(plots[2].options.mark, "halfcircle");
});

test("halfcircle plot marks use the PGF circle outline and diameter", () => {
  const command = renderPlotMark({ x: 1, y: 2 }, { orange: true, mark: "halfcircle", "mark size": "2pt" });

  assert.match(command, /\(0\.93,2\) -- \(1\.07,2\)/);
  assert.match(command, /\(1,2\) circle\(0\.07\)/);
  assert.doesNotMatch(command, /fill=orange/);
});

test("triangle plot marks use PGF's polar triangle geometry", () => {
  const filled = renderPlotMark({ x: 1, y: 2 }, { blue: true, mark: "triangle*", "mark size": "2pt" });
  const outline = renderPlotMark({ x: 1, y: 2 }, { blue: true, mark: "triangle", "mark size": "2pt" });

  assert.match(filled, /\(1,2\.07\) -- \(1\.061,1\.965\) -- \(0\.939,1\.965\) -- cycle/);
  assert.match(filled, /fill=blue/);
  assert.doesNotMatch(outline, /fill=blue/);
});

test("hide x axis suppresses its frame and all x ticks on an overlaid right axis", () => {
  const options = { "hide x axis": true, "axis y line*": "right", width: "15cm", height: "8cm" };
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 300 };
  const geometry = {
    origin: { x: 0, y: 0 },
    width: 15,
    height: 8,
    mapPoint: ({ x, y }) => ({ x: x * 15, y: y * 8 / 300 })
  };

  assert.equal(
    renderAxisBox(options, geometry),
    String.raw`\draw[axis frame, black, line width=0.35pt] (15,0) -- (15,8);`
  );
  assert.ok(renderAxisTicks(options, [], ranges, geometry).every((command) => !command.includes("axis x tick")));
});

test("an overlaid right axis keeps native automatic range padding", () => {
  const ranges = computeAxisRanges(
    { "hide x axis": true, "axis y line*": "right" },
    [{ type: "coordinates", points: [{ x: 1, y: 0 }, { x: 2138, y: 299 }] }]
  );

  assert.equal(ranges.xMin, -212.7);
  assert.equal(ranges.xMax, 2351.7);
  assert.equal(ranges.yMin, -29.9);
  assert.equal(ranges.yMax, 328.9);
});

test("default scaled ticks extract a shared power of ten for large values", () => {
  const options = { ytick: "{0,5000000,10000000,15000000,20000000}" };
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 20000000 };
  const geometry = {
    origin: { x: 0, y: 0 },
    width: 4,
    height: 3,
    mapPoint: ({ x, y }) => ({ x: x * 4, y: y * 3 / 20000000 })
  };
  const commands = renderAxisTicks(options, [], ranges, geometry);

  assert.ok(commands.some((command) => command.endsWith("{0.5};")));
  assert.ok(commands.some((command) => command.endsWith("{1.5};")));
  const scaleLabel = commands.find((command) => command.includes(String.raw`\cdot 10^{7}`));
  assert.ok(scaleLabel?.includes("inner sep=0pt"));
  assert.match(scaleLabel, /at \(0,3\.054\)/);
});

test("middle-axis left y tick labels retain their TeX layout bounding boxes", () => {
  const options = { "axis x line": "middle", "axis y line": "middle", ytick: "{0,10000000,20000000}" };
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 20000000 };
  const geometry = {
    origin: { x: 0, y: 0 },
    width: 4,
    height: 3,
    mapPoint: ({ x, y }) => ({ x: x * 4, y: y * 3 / 20000000 })
  };
  const commands = renderAxisTicks(options, [], ranges, geometry);

  assert.ok(commands.some((command) => command.includes("axis tick label") && command.includes("tikzkit layout bbox")));
});

test("explicit middle axes reserve scaled-y description space before y-only enlargement", () => {
  const geometry = createAxisGeometry(
    {
      "axis x line": "middle",
      "axis y line": "middle",
      width: "15cm",
      height: "8cm",
      xmin: "0",
      xmax: "2150",
      ymin: "0",
      ymax: "20000000",
      "enlarge y limits": "true"
    },
    { xMin: 0, xMax: 2150, yMin: 0, yMax: 20000000 }
  );

  assert.ok(Math.abs(geometry.width - 13.369) < 0.001);
  assert.ok(Math.abs(geometry.height - 5.328) < 0.001);
});

test("middle-axis layout measures grouped numeric tick labels instead of using the text fallback margin", () => {
  const geometry = createAxisGeometry(
    {
      "axis x line": "middle",
      "axis y line": "middle",
      width: "15cm",
      height: "8cm",
      xmin: "0",
      xmax: "2150",
      ymin: "0",
      ymax: "20000000",
      "enlarge y limits": "true"
    },
    { xMin: 0, xMax: 2150, yMin: 0, yMax: 20000000 }
  );

  // Native PGFPlots measures `1,000` as a numeric tick label; it should not
  // force the generic 1.1cm nonnumeric-label reserve on the left edge.
  assert.ok(Math.abs(geometry.margin.left - 0.758) < 0.01, geometry.margin.left);
});

test("legend style at and anchor use axis-description coordinates", () => {
  const geometry = { origin: { x: 1, y: 2 }, width: 10, height: 5 };
  const placement = legendPlacement(undefined, geometry, "at={(0.1,-0.1)}, anchor=north");

  assert.deepEqual(placement, { anchor: "north", point: { x: 2, y: 1.5 } });
  assert.deepEqual(legendBoxFromAnchor(placement.point, placement.anchor, 4, 1), {
    left: 0,
    right: 4,
    top: 1.5,
    bottom: 0.5
  });
});

test("legend samples include the plot cycle marks", () => {
  const commands = renderLegendEntries(
    { "legend entries": "{first,second}" },
    {},
    { origin: { x: 0, y: 0 }, width: 8, height: 4 },
    [],
    [
      { options: { blue: true, mark: "*", "mark fill": "blue!80!black" } },
      { options: { red: true, mark: "square*", "mark fill": "red!80!black" } }
    ]
  );

  assert.ok(commands.some((command) => command.includes("circle(") && command.includes("fill=blue!80!black")));
  assert.ok(commands.some((command) => command.includes("fill=red!80!black") && command.includes("-- cycle")));
});

test("plain legend matrix uses native text row height and vertical padding", () => {
  const commands = renderLegendEntries(
    { "legend entries": "{linear probing,quadratic probing}" },
    {},
    { origin: { x: 0, y: 0 }, width: 8, height: 4 },
    [],
    [{ options: {} }, { options: {} }]
  );
  const box = commands[0].match(/^\\draw\[[^\]]+\] \(([-\d.]+),([-\d.]+)\).*\(([-\d.]+),([-\d.]+)\) -- cycle;$/);

  assert.ok(box, commands[0]);
  assert.ok(Math.abs((Number(box[2]) - Number(box[4])) - 28.8 / 28.45274) < 1e-3);
});

test("PGFPlots tick label styles preserve separators, rotation, anchors, and nested scaled-ticks policy", () => {
  const options = {
    "axis x line": "middle",
    "axis y line": "middle",
    "x tick label style": String.raw`/pgf/number format/1000 sep=,rotate=60,anchor=east,font=\scriptsize`,
    "y tick label style": String.raw`scaled ticks=false,/pgf/number format/1000 sep=\,,anchor=east,font=\scriptsize`,
    xtick: "{1986,1988}",
    ytick: "{0,5000,10000}"
  };
  const ranges = { xMin: 1986, xMax: 1988, yMin: 0, yMax: 10000 };
  const geometry = {
    origin: { x: 0, y: 0 },
    width: 4,
    height: 3,
    mapPoint: ({ x, y }) => ({ x: (x - 1986) * 2, y: y * 3 / 10000 })
  };
  const commands = renderAxisTicks(options, [], ranges, geometry);

  assert.ok(commands.some((command) => command.includes("anchor=east") && command.includes("rotate=60") && command.endsWith("{1988};")));
  assert.ok(commands.some((command) => command.includes("rotate=60") && command.includes("tikzkit layout bbox")));
  assert.ok(commands.every((command) => !command.endsWith("{1986};")));
  assert.ok(commands.some((command) => command.endsWith(String.raw`{5\,000};`)));
  assert.ok(commands.some((command) => command.endsWith(String.raw`{10\,000};`)));
  assert.ok(commands.every((command) => !command.includes(String.raw`\cdot 10^{4}`)));
});

test("axis-specific middle-axis enlargement keeps data scale separate from line extensions", () => {
  const options = {
    "axis x line": "middle",
    "axis y line": "middle",
    width: "15cm",
    height: "8cm",
    xmin: "1986",
    xmax: "2014",
    ymin: "0",
    ymax: "26000",
    "enlarge y limits": "true",
    "y tick label style": String.raw`scaled ticks=false,/pgf/number format/1000 sep=\,`
  };
  const ranges = { xMin: 1986, xMax: 2014, yMin: 0, yMax: 26000 };
  const geometry = createAxisGeometry(options, ranges);

  assert.deepEqual(geometry.transformRanges, { ...ranges, zMin: 0, zMax: 1 });
  assert.deepEqual(geometry.lineRanges, { xMin: 1986, xMax: 2014, yMin: -2600, yMax: 28600, zMin: 0, zMax: 1 });
  assert.equal(geometry.mapPoint({ x: 1986, y: 0 }).y, 0);
  assert.ok(Math.abs(geometry.mapPoint({ x: 1986, y: 26000 }).y - geometry.height) < 1e-9);
  assert.ok(Math.abs(geometry.height - (8 - 45 / 28.45274) / 1.2) < 0.01);
  assert.ok(Math.abs(geometry.mapAxisDescriptionPoint({ x: 0.5, y: 1 }).y - geometry.mapPoint({ x: 1986, y: 28600 }).y) < 1e-9);
});

test("numeric boxed-axis enlargement expands both transform bounds by the requested fraction", () => {
  const options = {
    width: "7.5cm",
    height: "15cm",
    xmin: "-5",
    xmax: "5",
    ymin: "-10",
    ymax: "10",
    "enlarge x limits": "0.05",
    "enlarge y limits": "0.05"
  };
  const ranges = { xMin: -5, xMax: 5, yMin: -10, yMax: 10 };
  const geometry = createAxisGeometry(options, ranges);
  const ticks = renderAxisTicks(options, [], ranges, geometry);

  assert.deepEqual(geometry.transformRanges, { xMin: -5.5, xMax: 5.5, yMin: -11, yMax: 11, zMin: 0, zMax: 1 });
  assert.deepEqual(geometry.lineRanges, geometry.transformRanges);
  assert.equal(geometry.mapPoint({ x: -5.5, y: -11 }).x, geometry.origin.x);
  assert.equal(geometry.mapPoint({ x: 5.5, y: 11 }).y, geometry.origin.y + geometry.height);
  assert.ok(Math.abs(geometry.margin.left - (17.7778 + 2 * 3.33333) / 28.45274) < 0.001);
  assert.ok(Math.abs(geometry.margin.bottom - (6.4444 + 0.8333 + 2 * 3.33333) / 28.45274) < 0.001);
  assert.ok(Math.abs(geometry.margin.right - 0.2 / 28.45274) < 0.001);
  assert.ok(Math.abs(geometry.margin.top - 0.2 / 28.45274) < 0.001);
  assert.ok(ticks.some((command) => command.includes("(0.807,0) -- (0.807,0.15)")));
  assert.ok(ticks.some((command) => command.includes("at (0.807,-0.028) {−4}")));
  assert.ok(ticks.some((command) => command.includes("at (0,0.61) {−10}")));
});

test("repeated legend styles merge and legend columns=-1 produces one native row", () => {
  const options = parseOptions("legend style={at={(0.5,1.0)},anchor=north},legend style={draw=none,legend columns=-1}");
  const commands = renderLegendEntries(
    { ...options, "legend entries": "{first,second,third}" },
    {},
    { origin: { x: 0, y: 0 }, width: 12, height: 6 },
    [],
    [{ options: {} }, { options: {} }, { options: {} }]
  );
  const labels = commands.filter((command) => command.startsWith("\\node[axis legend"));
  const yValues = labels.map((command) => Number(command.match(/ at \([-\d.]+,([-\d.]+)\)/)?.[1]));

  assert.deepEqual(options["legend style"], ["at={(0.5,1.0)},anchor=north", "draw=none,legend columns=-1"]);
  assert.equal(labels.length, 3);
  assert.equal(new Set(yValues).size, 1);
  assert.match(commands[0], /draw=none/);
});

test("csv two-axis fixture renders all four series and the overlaid right axis", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/csv-line-plot-two-axes.tex", "utf8");
  const resourceRoot = "test/fixtures/examples/resources/csv-line-plot-two-axes";
  const result = tikzToSvg(source, {
    margin: 0,
    mathRenderer: "svg-text",
    pgfplotsTableResolver: (name) => readFileSync(`${resourceRoot}/${name}`, "utf8")
  });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const labels = result.ir.items
    .filter((item) => item.type === "textNode")
    .map((item) => String(item.text || ""));
  const plotPaths = result.ir.items.filter((item) => item.type === "path" && item.subtype === "axis-plot");

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.equal(plotPaths.length, 4);
  assert.ok(labels.includes("linear probing"));
  assert.ok(labels.includes("quadratic probing"));
  assert.ok(labels.includes("300"), "expected the overlaid right-axis tick labels");
  assert.match(result.svg, /tikz-arrow-tip tikz-arrow-stealth/);
  assert.match(result.svg, /fill=\"rgb\(0 0 204\)\"/);
  assert.match(result.svg, /fill=\"rgb\(204 0 0\)\"/);
});

test("csv two-axis fixture shares the primary plot box with its hidden-x right-axis overlay", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/csv-line-plot-two-axes.tex", "utf8");
  const resourceRoot = "test/fixtures/examples/resources/csv-line-plot-two-axes";
  const result = tikzToSvg(source, {
    margin: 0,
    mathRenderer: "svg-text",
    pgfplotsTableResolver: (name) => readFileSync(`${resourceRoot}/${name}`, "utf8")
  });
  const primary = createAxisGeometry(
    {
      "axis x line": "middle",
      "axis y line": "middle",
      width: "15cm",
      height: "8cm",
      xmin: "0",
      xmax: "2150",
      ymin: "0",
      ymax: "20000000",
      "enlarge y limits": "true"
    },
    { xMin: 0, xMax: 2150, yMin: 0, yMax: 20000000 }
  );
  const rightAxisFrame = result.ir.items.find((item) =>
    item.type === "path"
      && item.subtype === "axis-frame"
      && item.commands?.length === 2
      && Math.abs(item.commands[0]?.x - primary.width) < 1e-3
  );
  const overlayBounds = result.ir.items.find((item) =>
    item.type === "path"
      && item.subtype === "axis-frame"
      && item.commands?.length === 5
      && Math.abs(item.commands[1]?.x - primary.width) > 0.01
      && item.commands[2]?.y > primary.height
  );

  assert.ok(rightAxisFrame, "expected a right-side axis frame aligned with the primary plot box");
  assert.ok(Math.abs(rightAxisFrame.commands[0].y) < 1e-9);
  assert.ok(Math.abs(rightAxisFrame.commands[1].y - primary.height) < 1e-3);
  assert.ok(overlayBounds, "expected the right axis to retain its own PGFPlots layout bounds");
});

test("KIT students CSV fixture renders three series with native tick and legend policies", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/csv-line-plot-kit-students.tex", "utf8");
  const resourceRoot = "test/fixtures/examples/resources/csv-line-plot-kit-students";
  const result = tikzToSvg(source, {
    margin: 0,
    mathRenderer: "svg-text",
    pgfplotsTableResolver: (name) => readFileSync(`${resourceRoot}/${name}`, "utf8")
  });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const labels = result.ir.items
    .filter((item) => item.type === "textNode")
    .map((item) => String(item.text || ""));
  const plotPaths = result.ir.items.filter((item) => item.type === "path" && item.subtype === "axis-plot");
  const firstRotatedYear = result.ir.items.find((item) => item.type === "textNode" && item.text === "1988");

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.equal(plotPaths.length, 3);
  assert.ok(labels.includes("Anzahl"));
  assert.ok(labels.includes("Jahr"));
  assert.ok(labels.includes("Eingeschriebene Studenten"));
  assert.ok(labels.includes("davon Frauen"));
  assert.ok(labels.includes("davon Ausländer"));
  assert.doesNotMatch(result.svg, /\\cdot 10\^\{4\}/);
  assert.equal(firstRotatedYear?.rotation, 60);
  assert.equal(firstRotatedYear?.style?.textWidthScale, 1.135);
});

test("bivariate CSV fixture resolves all 5000 samples as filled scatter marks", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/csv-bivariate-normal-distribution.tex", "utf8");
  const resourceRoot = "test/fixtures/examples/resources/csv-bivariate-normal-distribution";
  const result = tikzToSvg(source, {
    margin: 0,
    mathRenderer: "svg-text",
    pgfplotsTableResolver: (name) => readFileSync(`${resourceRoot}/${name}`, "utf8")
  });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const marks = result.ir.items.filter((item) => item.type === "path" && item.subtype === "axis-mark" && item.shape === "circle");
  const plotPaths = result.ir.items.filter((item) => item.type === "path" && item.subtype === "axis-plot");

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.equal(marks.length, 5000);
  assert.equal(plotPaths.length, 0, "only marks scatter must not connect samples");
  assert.ok(marks.every((mark) => mark.style.fill && mark.style.fill !== "none"));
  assert.ok(marks.every((mark) => Math.abs(mark.r - 1 / 28.45274) < 0.001));
  assert.ok(marks.every((mark) => mark.style.fill === "blue"));
  assert.ok(marks.every((mark) => mark.style.stroke === "rgb(0 0 204)"));
});

test("CSV visualization dependencies bind string columns into nodes near coords", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[
    visualization depends on={value \thisrow{label} \as \label},
    nodes near coords={\label}
  ]
    \addplot[scatter,mark=*,only marks]
      table[x=mean,y=variance,col sep=comma]{data.csv};
  \end{axis}
\end{tikzpicture}`;
  const csv = "label,mean,variance\na,0.5,7\nb,1.2,0.7\nc,0.9,9\nd,0.3,0.5\n";
  const result = tikzToSvg(source, {
    margin: 0,
    mathRenderer: "svg-text",
    pgfplotsTableResolver: (name) => name === "data.csv" ? csv : undefined
  });
  const labels = result.ir.items
    .filter((item) => item.type === "textNode")
    .map((item) => item.text)
    .filter((text) => ["a", "b", "c", "d"].includes(text));

  assert.deepEqual(labels, ["a", "b", "c", "d"]);
});

test("symbolic table metadata selects per-point scatter class styles", () => {
  const diagnostics = [];
  const points = parsePgfplotsTablePoints(
    "x,y,label\n70,40,a\n60,20,b\n",
    { "col sep": "comma", meta: "label" },
    diagnostics,
    { "point meta": "explicit symbolic" }
  );
  const commands = renderAddplot(
    {
      type: "coordinates",
      source: "table",
      points,
      options: {
        scatter: true,
        "only marks": true,
        "point meta": "explicit symbolic",
        "scatter/classes": "a={mark=x,red!90!black},b={mark=x,cyan!50!black}"
      }
    },
    {},
    { xMin: 40, xMax: 90, yMin: 0, yMax: 60 },
    { mapPoint: ({ x, y }) => ({ x, y }) },
    {},
    0
  );

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(points.map((point) => point.meta), ["a", "b"]);
  assert.ok(commands.some((command) => command.includes("draw=red!90!black") && command.includes(" -- ")));
  assert.ok(commands.some((command) => command.includes("draw=cyan!50!black") && command.includes(" -- ")));
  assert.ok(commands.every((command) => !command.includes(" circle(")));
});

test("axis overlay lowering leaves coordinate-looking math label text unchanged", () => {
  const geometry = createAxisGeometry(
    { "scale only axis": true, width: "13.4cm", height: "10cm" },
    { xMin: 40, xMax: 90, yMin: 0, yMax: 60 }
  );
  const lowered = transformAxisStatementCoordinates(
    String.raw`\filldraw (axis cs:65,35) circle[radius=5pt] node[label={above left:$(65, 35)$}] {};`,
    { xMin: 40, xMax: 90, yMin: 0, yMax: 60 },
    geometry
  );

  assert.match(lowered, /\\filldraw \(6\.7,5\.833\)/);
  assert.match(lowered, /above left:\$\(65, 35\)\$/);
});

test("nodes near coords evaluate coordindex math and center labels when requested", () => {
  const commands = renderNodesNearCoords(
    {
      options: {
        "nodes near coords": String.raw`\pgfmathparse{int(\coordindex+1)} \pgfmathresult`,
        "every node near coord/.style": String.raw`font=\scriptsize\sffamily\bfseries,text=white,anchor=center`
      },
      points: [{ x: 1, y: 1 }, { x: 1, y: 2 }]
    },
    {},
    { mapPoint: (point) => point }
  );

  assert.equal(commands.length, 2);
  assert.match(commands[0], /anchor=center/);
  assert.match(commands[0], /at \(1,1\) \{1\};$/);
  assert.match(commands[1], /at \(1,2\) \{2\};$/);
});

test("try min ticks raises automatic density for compact integer axes", () => {
  const count = axisAutoMajorTickCountForOptions(
    { "try min ticks": "5" },
    "x",
    0,
    5,
    { width: 4.7 },
    7
  );

  assert.equal(count, 5);
  assert.deepEqual(majorTickValues(0, 5, count), [0, 1, 2, 3, 4, 5]);
});

test("absolute upper enlargement is applied once and preserves unit-scale axes", () => {
  const axisOptions = createAxisOptions({
    xmin: "0",
    ymin: "0",
    width: "6cm",
    "enlarge x limits": "upper,abs=0.02",
    "enlarge y limits": "false",
    "axis lines*": "left",
    "unit vector ratio*": "1 1 1"
  });
  const plots = [{ type: "coordinates", points: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 1, y: 5 }] }];
  const ranges = computeAxisRanges(axisOptions, plots);
  const geometry = createAxisGeometry(axisOptions, ranges);

  assert.deepEqual(ranges, { xMin: 0, xMax: 5, yMin: 0, yMax: 5, zMin: 0, zMax: 1 });
  assert.deepEqual(geometry.transformRanges, { xMin: 0, xMax: 5.02, yMin: 0, yMax: 5, zMin: 0, zMax: 1 });
  const xUnit = geometry.mapPoint({ x: 1, y: 0 }).x - geometry.mapPoint({ x: 0, y: 0 }).x;
  const yUnit = geometry.mapPoint({ x: 0, y: 1 }).y - geometry.mapPoint({ x: 0, y: 0 }).y;
  assert.ok(Math.abs(xUnit - yUnit) < 1e-9, `expected equal mapped units, got x=${xUnit}, y=${yUnit}`);
  assert.ok(Math.abs(geometry.width / geometry.height - 5.02 / 5) < 1e-9);
});

test("left open axes place rotated y labels near tick labels", () => {
  const ranges = { xMin: 0, xMax: 5, yMin: 0, yMax: 5, zMin: 0, zMax: 1 };
  const axisOptions = {
    ylabel: "m",
    width: "6cm",
    "axis lines*": "left",
    "unit vector ratio*": "1 1 1",
    "try min ticks": "5"
  };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisLabels(axisOptions, ranges, geometry);

  assert.ok(
    commands.some((command) => /anchor=center.*rotate=90.*at \(-0\.7,[^)]+\) \{m\};$/.test(command)),
    `expected left-open ylabel to follow the native near-tick placement, got ${commands.join("\n")}`
  );
});

test("starred left axis lines expand to bottom and left edges without a box", () => {
  const axisOptions = createAxisOptions({ "axis lines*": "left" });
  const command = renderAxisBox(axisOptions, {
    origin: { x: 0, y: 0 },
    width: 5,
    height: 5
  });

  assert.equal(axisOptions["axis x line*"], "bottom");
  assert.equal(axisOptions["axis y line*"], "left");
  assert.equal(
    command,
    String.raw`\draw[axis frame, black, line width=0.35pt] (0,0) -- (5,0) (0,0) -- (0,5);`
  );
});
