import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decodePng } from "../scripts/diff-example-pngs.js";
import { parseDimension } from "../src/engine/math.js";
import {
  PGFPLOTS_DEFAULT_AXIS_HEIGHT,
  PGFPLOTS_DEFAULT_AXIS_WIDTH,
  PGFPLOTS_DEFAULT_PERSPECTIVE_3D_RESERVE_X,
  PGFPLOTS_DEFAULT_PERSPECTIVE_3D_RESERVE_Y
} from "../src/pgfplots/geometry.js";
import { axisAutoMajorTickCountForOptions } from "../src/pgfplots/ticks.js";
import { sampleAxisQuiverPlot } from "../src/pgfplots/quiver.js";
import {
  TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_X,
  TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_Y
} from "../src/tikz/metrics.js";
import {
  tikzToSvg,
  parseTikz,
  axisModelToSceneGraphPlan,
  axisPlotPointChain,
  axisSamples,
  axisTickValues,
  computeAxisRanges,
  createAxisGeometry,
  createAxisGridModel,
  createAxisModel,
  createAxisTickModel,
  createDataToCanvasTransform,
  evaluateAxisExpression,
  evaluateAxisExpressionAtSample,
  expandPgfplotsAxes,
  findContainingTikzPictureOptions,
  findNextPgfplotsEnvironment,
  isAxisBarPlot,
  isAxisCombPlot,
  isSurfacePlot,
  legendFontOption,
  majorTickValues,
  collectPgfplotsCycleLists,
  parseCoordinateAddplot,
  parseAxisAt,
  parseAxisDimension,
  parseAddplots,
  parseDomain,
  parseLegendEntries,
  parsePgfplotsDeclaredFunctions,
  parsePgfplotsCoordinateList,
  parseZRestriction,
  PGFPLOTS_ENVIRONMENTS,
  renderPgfplotsAxisAsTikz,
  renderAddplot,
  renderAxis3DBox,
  renderAxis3DBoxForeground,
  renderAxis3DColorbar,
  renderAxis3DGrid,
  renderAxis3DTicks,
  renderAxisLabels3D,
  renderAxisBounds,
  renderAxisBox,
  renderAxisBars,
  renderAxisComb,
  renderAxisGrid,
  renderAxisLabels,
  renderAxisLines,
  renderAxisOverlayStatements,
  renderAxisPlotInlineNodes,
  renderAxisSurfaceCoordinatePlot,
  renderAxisSurfacePlot,
  renderAxisTicks,
  renderDatavisualizationCleanAxes,
  renderLegendEntries,
  renderNodesNearCoords,
  renderPlotMark,
  normalizeAxisExpression,
  normalizePgfplotsSymbolicCoordinates,
  pgfMathRuntimePrelude,
  restrictSurfaceZ,
  sampleParametricDataPoints,
  selectPlotStyle,
  shouldRenderAxisPlotPath,
  shouldRenderPlotMarks,
  splitLegendEntries,
  symbolicCoordinateLabels,
  transformDataToCanvas
} from "../src/internal.js";

function svgDocumentSizePt(svg) {
  const match = svg.match(/<svg\b[^>]*\bwidth="([0-9.]+)pt"\s+\bheight="([0-9.]+)pt"/);
  assert.ok(match, "expected SVG document width/height in pt");
  return { width: Number(match[1]), height: Number(match[2]) };
}

function svgViewBox(svg) {
  const match = svg.match(/\bviewBox="(-?[0-9.]+) (-?[0-9.]+) ([0-9.]+) ([0-9.]+)"/);
  assert.ok(match, "expected SVG viewBox");
  return {
    minX: Number(match[1]),
    minY: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4])
  };
}

function svgCoordinateYToDocumentPt(svg, y) {
  const size = svgDocumentSizePt(svg);
  const viewBox = svgViewBox(svg);
  const unitsPerPt = viewBox.width / size.width;
  return (Number(y) - viewBox.minY) / unitsPerPt;
}

function horizontalBlackAxisYDocumentPt(svg) {
  for (const tag of svg.matchAll(/<path\b[^>]*>/g)) {
    const path = tag[0];
    if (!path.includes('stroke="black"')) continue;
    const d = path.match(/\bd="([^"]+)"/)?.[1];
    const match = d?.match(/^M 0 (-?[0-9.]+) L [0-9.]+ \1$/);
    if (match) return svgCoordinateYToDocumentPt(svg, Number(match[1]));
  }
  assert.fail("expected horizontal black axis path");
}

function testNumber(value) {
  return Number(Number(value).toFixed(3)).toString();
}

function decodeAxisSurfaceRasterCommand(command) {
  const match = command.match(/axis surface raster image=([A-Za-z0-9_-]+)/);
  assert.ok(match, `expected encoded axis surface raster image payload in ${command}`);
  const json = Buffer.from(match[1], "base64url").toString("utf8");
  const payload = JSON.parse(json);
  assert.ok(String(payload.href || "").startsWith("data:image/png;base64,"), "expected PNG data URI raster payload");
  return {
    payload,
    png: decodePng(Buffer.from(String(payload.href).slice("data:image/png;base64,".length), "base64"))
  };
}

function pngPixel(png, x, y) {
  const offset = (y * png.width + x) * 4;
  return Array.from(png.data.subarray(offset, offset + 4));
}

function decodeFirstRasterImageFromSvg(svg) {
  const match = String(svg).match(/<image\b[^>]*\bhref="data:image\/png;base64,([^"]+)"/);
  assert.ok(match, "expected SVG raster image data URI");
  return decodePng(Buffer.from(match[1], "base64"));
}

function countBlueRasterPixels(png) {
  let count = 0;
  for (let index = 0; index < png.data.length; index += 4) {
    const red = png.data[index];
    const green = png.data[index + 1];
    const blue = png.data[index + 2];
    const alpha = png.data[index + 3];
    if (alpha > 180 && blue > 140 && blue > red * 1.6 && blue > green * 1.4) count += 1;
  }
  return count;
}

function assertAxisPointsNearlyEqual(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual.x - expected.x) < tolerance, `expected x ${actual.x} ~= ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < tolerance, `expected y ${actual.y} ~= ${expected.y}`);
}

function legendBoxWidthFromCommand(command) {
  const matches = [...String(command).matchAll(/\((-?[0-9.]+),(-?[0-9.]+)\)/g)];
  assert.ok(matches.length >= 2, `expected rectangle points in ${command}`);
  return Math.abs(Number(matches[1][1]) - Number(matches[0][1]));
}

function legendBoxHeightFromCommand(command) {
  const matches = [...String(command).matchAll(/\((-?[0-9.]+),(-?[0-9.]+)\)/g)];
  assert.ok(matches.length >= 3, `expected rectangle points in ${command}`);
  const ys = matches.map((match) => Number(match[2]));
  return Math.max(...ys) - Math.min(...ys);
}

function legendNodeYFromCommand(command) {
  const match = String(command).match(/\bat \((-?[0-9.]+),(-?[0-9.]+)\)/);
  assert.ok(match, `expected positioned legend node in ${command}`);
  return Number(match[2]);
}

function legendNodeXFromCommand(command) {
  const match = String(command).match(/\bat \((-?[0-9.]+),(-?[0-9.]+)\)/);
  assert.ok(match, `expected positioned legend node in ${command}`);
  return Number(match[1]);
}

function legendSampleWidthFromCommand(command) {
  const matches = [...String(command).matchAll(/\((-?[0-9.]+),(-?[0-9.]+)\)/g)];
  assert.ok(matches.length >= 2, `expected sample line points in ${command}`);
  return Math.abs(Number(matches[1][1]) - Number(matches[0][1]));
}

function legendSampleLeftInsetFromCommands(boxCommand, sampleCommand) {
  const boxMatches = [...String(boxCommand).matchAll(/\((-?[0-9.]+),(-?[0-9.]+)\)/g)];
  const sampleMatches = [...String(sampleCommand).matchAll(/\((-?[0-9.]+),(-?[0-9.]+)\)/g)];
  assert.ok(boxMatches.length >= 2, `expected legend box points in ${boxCommand}`);
  assert.ok(sampleMatches.length >= 1, `expected legend sample points in ${sampleCommand}`);
  const boxLeft = Math.min(...boxMatches.map((match) => Number(match[1])));
  return Number(sampleMatches[0][1]) - boxLeft;
}

test("pgfplots axis model owns ranges, ticks, grid, plots, and labels", () => {
  const axis = createAxisModel({
    axisOptions: {
      xmin: 0,
      xmax: 5,
      ymin: 0,
      ymax: 5,
      grid: "major",
      xlabel: "$x$"
    },
    ranges: { xMin: 0, xMax: 5, yMin: 0, yMax: 5 },
    geometry: { origin: { x: 10, y: 20 }, width: 100, height: 50 },
    addplots: [{ type: "coordinates", options: { mark: "o" }, points: [{ x: 0, y: 2 }, { x: 5, y: 2 }] }]
  });

  assert.equal(axis.type, "Axis");
  assert.equal(axis.grid.x, true);
  assert.equal(axis.labels.x, "$x$");
  assert.deepEqual(axis.dataToCanvas.mapPoint({ x: 5, y: 5 }), { x: 110, y: 70 });
  assert.deepEqual(axisModelToSceneGraphPlan(axis), ["bounds", "grid", "axis-lines", "ticks", "plots", "labels"]);
});

test("pgfplots axis environment seam owns discovery and option merging", () => {
  const diagnostics = [];
  const calls = [];
  const dependencies = { marker: "axis dependencies" };
  const source = String.raw`\begin{tikzpicture}[scale=2,x=1cm]
\begin{semilogxaxis}[xmin=0,x=2cm]
\addplot {x};
\end{semilogxaxis}
\end{tikzpicture}`;
  const rendered = expandPgfplotsAxes(source, diagnostics, { runtime: true }, dependencies, (axisOptions, body, options, emittedDiagnostics, axisDependencies) => {
    calls.push({ axisOptions, body, options, emittedDiagnostics, axisDependencies });
    return "<axis/>";
  });

  assert.equal(rendered, String.raw`\begin{tikzpicture}[scale=2,x=1cm]
<axis/>
\end{tikzpicture}`);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].axisOptions.xmode, "log");
  assert.equal(calls[0].axisOptions.x, "2cm");
  assert.equal(calls[0].axisOptions.xmin, "0");
  assert.equal(calls[0].axisOptions.scale, undefined);
  assert.equal(calls[0].axisOptions["tikzkit pgfplots picture scale"], 2);
  assert.equal(calls[0].axisOptions["pgfplots explicit x unit"], true);
  assert.equal(calls[0].axisOptions["pgfplots explicit y unit"], false);
  assert.equal(calls[0].body.trim(), String.raw`\addplot {x};`);
  assert.deepEqual(calls[0].options, { runtime: true });
  assert.equal(calls[0].emittedDiagnostics, diagnostics);
  assert.equal(calls[0].axisDependencies, dependencies);
  assert.equal(findNextPgfplotsEnvironment(source, 0).name, "semilogxaxis");
  assert.deepEqual(findContainingTikzPictureOptions(source, source.indexOf(String.raw`\begin{semilogxaxis}`)), { scale: "2", x: "1cm" });
  assert.ok(PGFPLOTS_ENVIRONMENTS.some((environment) => environment.name === "ternaryaxis"));
});

test("pgfplots axis lowering sees tikzstyle aliases declared before the axis", () => {
  const calls = [];
  const source = String.raw`\begin{tikzpicture}
\tikzstyle{training}=[blue,dashed,thick,samples=7]
\begin{axis}[xmin=0,xmax=1,ymin=0,ymax=1]
\addplot[domain=0:1,training] {x};
\end{axis}
\end{tikzpicture}`;
  expandPgfplotsAxes(source, [], {}, {}, (_axisOptions, _body, options) => {
    calls.push(options);
    return "<axis/>";
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].pgfplotsStyleDefinitions.training, {
    blue: true,
    dashed: true,
    thick: true,
    samples: "7"
  });
});

test("pgfplots axis x/y line middle lowers to arrowed middle axes without a box frame", () => {
  const source = String.raw`\documentclass[tikz]{standalone}
\usepackage{pgfplots}
\begin{document}
\begin{tikzpicture}
\begin{axis}[axis x line=middle,axis y line=middle,xmin=0,xmax=1,ymin=0,ymax=1]
\addplot[domain=0:1] {x};
\end{axis}
\end{tikzpicture}
\end{document}`;
  const parsed = parseTikz(source);
  const body = parsed.ast.pictures[0].body;

  assert.equal(parsed.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length, 0);
  assert.ok(!body.includes("axis frame"), "middle axes should not lower to a boxed axis frame");
  assert.ok(body.includes("axis line"), "middle axes should lower to explicit axis line commands");
  assert.ok(body.includes("-stealth"), "middle axes should use classic stealth arrowed axis lines");
});

test("pgfplots center axes use non-boxed default limits for automatic ticks", () => {
  const source = String.raw`
\begin{tikzpicture}
  \begin{axis}[domain=0:2.7,xlabel=$x$,smooth,thick,axis lines=center,legend pos=north west]
    \addplot[color=blue]{x*ln(x)};
    \addplot[color=red]{x-1};
    \legend{$x \, \ln(x)$,$x-1$}
  \end{axis}
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(texts.includes("0.5"), "native PGFPlots places half-step x ticks for this center-axis range");
  assert.ok(texts.includes("2.5"), "native PGFPlots keeps the last x tick inside the non-enlarged domain");
  assert.equal(texts.includes("3"), false, "non-boxed center axes should not auto-enlarge y limits enough to show tick 3");
});

test("pgfplots coordinate and addplot modules parse data without renderer knowledge", () => {
  assert.deepEqual(parsePgfplotsCoordinateList("(0,2) (5,2)"), [
    { x: 0, y: 2, raw: "(0,2)" },
    { x: 5, y: 2, raw: "(5,2)" }
  ]);

  const rowedPoints = parsePgfplotsCoordinateList(String.raw`(0,0,0) (0,1,0)

(1,0,2) (1,1,3) (1,2,0)`);
  assert.deepEqual(rowedPoints.rows.map((row) => row.length), [2, 3]);
  assert.deepEqual(rowedPoints.rows[1].map((point) => point.z), [2, 3, 0]);

  const plot = parseCoordinateAddplot(String.raw`\addplot[mark=o] coordinates {(0,2) (5,2)};`);

  assert.equal(plot.type, "Plot");
  assert.equal(plot.plotType, "coordinates");
  assert.equal(plot.options.mark, "o");
  assert.equal(plot.points.length, 2);
});

test("pgfplots addplot parser owns coordinate, table, function, and parametric plot statements", () => {
  const diagnostics = [];
  const plots = parseAddplots(
    String.raw`\addplot+[myplot] coordinates {(0,0) (1,1)} node[pos=.5] {mid};
\addplot3[point meta=\thisrow{meta}] table[x=t,y=v,z=w] {t v w meta
0 1 2 7
1 2 3 8};
\addplot[domain=0:1] ({x},{x^2}) -- (axis cs:1,0);
\addplot expression[red] {sin(x)};`,
    {
      pgfplotsStyleDefinitions: {
        myplot: { blue: true, mark: "o" }
      }
    },
    diagnostics
  );

  assert.equal(diagnostics.length, 0);
  assert.equal(plots.length, 4);
  assert.equal(plots[0].type, "coordinates");
  assert.equal(plots[0].options.blue, true);
  assert.equal(plots[0].options.mark, "o");
  assert.equal(plots[0].options["pgfplots plus"], true);
  assert.equal(plots[0].options["pgfplots explicit options"], true);
  assert.deepEqual(plots[0].points.map(({ x, y }) => ({ x, y })), [{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  assert.deepEqual(plots[0].coordinateRows.map((row) => row.length), [2]);
  assert.deepEqual(plots[0].nodes, [{ options: { pos: ".5" }, text: "mid" }]);
  assert.equal(plots[1].source, "table");
  assert.equal(plots[1].is3d, true);
  assert.deepEqual(plots[1].points[0], {
    x: 0,
    y: 1,
    z: 2,
    meta: 7,
    raw: "(0,1,2)",
    columns: { t: "0", v: "1", w: "2", meta: "7" }
  });
  assert.equal(plots[2].type, "parametric");
  assert.equal(plots[2].xExpression, "x");
  assert.equal(plots[2].yExpression, "x^2");
  assert.deepEqual(plots[2].fillAnchor, { x: 1, y: 0 });
  assert.equal(plots[3].type, "function");
  assert.equal(plots[3].expression, "sin(x)");
  assert.equal(plots[3].options.red, true);
});

test("pgfplots addplot3 parametric tuples preserve z and lower through 3d projection", () => {
  const source = String.raw`\begin{tikzpicture}
\begin{axis}[view={335}{50},domain=-2:2,grid=major]
  \addplot3+[domain=0:2*pi,samples=40,samples y=0]
    ({sin(deg(x))},{cos(deg(x))},{x});
\end{axis}
\end{tikzpicture}`;
  const plots = parseAddplots(String.raw`\addplot3+[domain=0:2*pi,samples=40,samples y=0]
    ({sin(deg(x))},{cos(deg(x))},{x});`);

  assert.equal(plots.length, 1);
  assert.equal(plots[0].is3d, true);
  assert.equal(plots[0].xExpression, "sin(deg(x))");
  assert.equal(plots[0].yExpression, "cos(deg(x))");
  assert.equal(plots[0].zExpression, "x");
  const sampled = sampleParametricDataPoints(plots[0], {}, { pgfplotsSamples: 40 });
  assert.equal(sampled.length, 40);
  assert.ok(sampled.every((point) => Number.isFinite(point.z)));

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /<path d="M [^"]+(?: L [^"]+){20,}" stroke="blue"/);
  assert.ok((result.svg.match(/stroke="rgb\(191 191 191\)"/g) || []).length >= 6, "expected projected 3d grid lines");
  assert.ok((result.svg.match(/fill="rgb\(0 0 204\)"/g) || []).length >= 35, "addplot3+ should preserve the default cycle mark");
});

test("pgfplots addplot3 coordinate plots lower through the 3d projection", () => {
  const plot = parseAddplots(String.raw`\addplot3[blue,thick] coordinates {(0,0,0) (1,1,1)};`)[0];
  const commands = renderAddplot(
    plot,
    {},
    { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 },
    {
      mapPoint: () => assert.fail("3d coordinate plots must not use the 2d mapper"),
      mapPoint3d: ({ x, y, z }) => ({ x: x + 2 * y, y: 3 * z })
    }
  );

  assert.deepEqual(commands, [String.raw`\draw[axis plot, blue, thick] (0,0) -- (3,3);`]);
});

test("pgfplots quiver normalizes namespaced scale arrows", () => {
  const sampled = sampleAxisQuiverPlot(
    {
      type: "function",
      is3d: true,
      expression: "0",
      options: {
        domain: "0:0",
        "y domain": "0:0",
        samples: "1",
        "/pgfplots/quiver": true,
        "quiver/u": "1",
        "quiver/v": "0",
        "quiver/w": "0",
        "quiver/scale arrows": "4"
      }
    },
    {},
    { xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 1 },
    { mapPoint3d: (point) => ({ x: point.x, y: point.y }) }
  );

  assert.equal(sampled.samples.length, 1);
  assert.equal(sampled.samples[0].end.x - sampled.samples[0].start.x, 4);
});

test("pgfplots 3d log axes discard zero samples and use decade ticks", () => {
  const axisOptions = {
    domain: "1.5:6",
    "y domain": "0:10^9",
    ymode: "log",
    samples: "46",
    view: "{10}{15}",
    "pgfplots 3d surface": true
  };
  const plot = {
    type: "function",
    is3d: true,
    expression: "x*x*y",
    options: { surf: true, samples: "46" }
  };
  const ranges = computeAxisRanges(axisOptions, [plot]);

  assert.ok(ranges.yMin > 2e7 && ranges.yMin < 2.3e7);
  assert.equal(ranges.yMax, 1e9);
  const commands = renderAxis3DTicks(axisOptions, ranges, createAxisGeometry(axisOptions, ranges));
  const labels = commands.filter((command) => command.includes("axis tick label"));
  assert.ok(labels.some((command) => command.endsWith("{$10^{8}$};")));
  assert.ok(labels.some((command) => command.endsWith("{$10^{9}$};")));
  assert.equal(labels.some((command) => command.includes("200000000")), false);
});

test("pgfplots addplot parser samples supported raw gnuplot chi-squared plots inside foreach", () => {
  const plots = parseAddplots(String.raw`\foreach \k in {1,2} {%
    \addplot+[mark={}] gnuplot[raw gnuplot] {%
      isint(x) = (int(x)==x);
      log2 = 0.693147180559945;
      chisq(x,k)=k<=0||!isint(k)?1/0:x<=0?0.0:exp((0.5*k-1.0)*log(x)-0.5*x-lgamma(0.5*k)-k*0.5*log2);
      set xrange [1.00000e-5:8];
      set yrange [0.00000:0.500000];
      samples=5;
      plot chisq(x,\k)};
    \addlegendentryexpanded{$k = \k$}}`);

  assert.equal(plots.length, 2);
  assert.equal(plots[0].source, "gnuplot");
  assert.equal(plots[0].type, "coordinates");
  assert.equal(plots[0].options.mark, "none");
  assert.equal(plots[0].points.length >= 4, true);
  assert.equal(plots[1].points.length, 5);
  assert.equal(plots[1].points[0].x < 0.001, true);
  assert.equal(plots[0].points.at(-1).x, 8);
  assert.ok(plots[1].points.some((point) => point.y > 0.18 && point.y < 0.19), "k=2 pdf should sample near 0.184");
});

test("pgfplots raw gnuplot evaluates generic constants, functions, ranges, and radian trigonometry", () => {
  const diagnostics = [];
  const plots = parseAddplots(String.raw`\addplot[blue, very thick] gnuplot[raw gnuplot] {
    scale = 2;
    wave(t) = scale * sin(t);
    set xrange [0:pi];
    set yrange [-2:2];
    set samples 5;
    plot wave(x)
  };`, {}, diagnostics);

  assert.equal(diagnostics.length, 0, diagnostics.map((entry) => entry.message).join("; "));
  assert.equal(plots.length, 1);
  assert.equal(plots[0].points.length, 5);
  assert.equal(plots[0].points[0].x, 0);
  assert.equal(plots[0].points.at(-1).x, 3.141593);
  assert.ok(Math.abs(plots[0].points[2].y - 2) < 1e-6);
});

test("pgfplots raw gnuplot no longer depends on a chisq function name", () => {
  const diagnostics = [];
  const plots = parseAddplots(String.raw`\addplot gnuplot[raw gnuplot] {
    isint(t) = (int(t) == t);
    logtwo = 0.693147180559945;
    density(t, freedom) = freedom <= 0 || !isint(freedom) ? 1/0 : t <= 0 ? 0 : exp((0.5*freedom-1.0)*log(t)-0.5*t-lgamma(0.5*freedom)-freedom*0.5*logtwo);
    set xrange [0.00001:8];
    set yrange [0:0.5];
    samples = 5;
    plot density(x,2)
  };`, {}, diagnostics);

  assert.equal(diagnostics.length, 0, diagnostics.map((entry) => entry.message).join("; "));
  assert.equal(plots.length, 1);
  assert.equal(plots[0].points.length, 5);
  assert.ok(plots[0].points.some((point) => point.y > 0.18 && point.y < 0.19));
});

test("pgfplots addplot parser samples supported raw gnuplot chi-squared CDF plots", () => {
  const plots = parseAddplots(String.raw`\addplot+[mark={}] gnuplot[raw gnuplot] {%
    igamma2(a,x) = igamma(a,x)*gamma(a);
    chisq(x,k)=igamma2(k/2.0, x/2.0) / gamma(k/2.0);
    set xrange [0:4];
    set yrange [0:1.0];
    samples=3;
    plot chisq(x,2)};`);

  assert.equal(plots.length, 1);
  assert.equal(plots[0].source, "gnuplot");
  assert.deepEqual(plots[0].points.map((point) => point.x), [0, 2, 4]);
  assert.ok(plots[0].points[1].y > 0.63 && plots[0].points[1].y < 0.633, "k=2 CDF at x=2 should be about 0.632");
});

test("pgfplots legend parser supports expanded legend entries after foreach expansion", () => {
  assert.deepEqual(
    parseLegendEntries(String.raw`\foreach \k in {2,3} {%
  \addlegendentryexpanded{$k = \k$}}
\addlegendentry[forget plot]{$k = 4$}`),
    ["$k = 2$", "$k = 3$", "$k = 4$"]
  );
});

test("pgfplots cycle list declarations feed addplot cycle styles", () => {
  const cycleLists = collectPgfplotsCycleLists(String.raw`\pgfplotscreateplotcyclelist{mylist}{%
{yellow},
{neongreen, densely dashed},
{turquoise, dashed},
{blue,densely dotted}}`, new Map([["neongreen", "#00dd00"]]));
  const rendered = renderPgfplotsAxisAsTikz(
    { "cycle list name": "mylist", xmin: "0", xmax: "1", ymin: "0", ymax: "1" },
    String.raw`\addplot+[mark={}] coordinates {(0,0) (1,1)};
\addplot+[mark={}] coordinates {(0,1) (1,0)};`,
    { pgfplotsCycleLists: cycleLists },
    [],
    {
      parseAddplots,
      parseLegendEntries,
      parsePgfplotsDeclaredFunctions,
      optionValues: (value) => (Array.isArray(value) ? value : value ? [value] : []),
      preparePgfplotsAxisOptions: (axisOptions) => axisOptions,
      computeAxisRanges,
      isSurfacePlot,
      renderAddplot,
      renderAxis3DGrid: () => [],
      renderAxis3DBox: () => [],
      renderAxis3DTicks: () => [],
      renderAxisLabels3D: () => [],
      renderAxis3DColorbar: () => [],
      renderAxisOverlayStatements: () => [],
      renderTernaryAxisAsTikz: () => "",
      parsePgfplotsColormaps: () => ({})
    }
  );

  assert.match(rendered, /\\draw\[axis plot, yellow(?:,|\])/);
  assert.match(rendered, /\\draw\[axis plot, draw=#00dd00, densely dashed(?:,|\])/);
});

test("pgfplots lowers two-parameter addplot3 tuples into a surface grid", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \begin{axis}[domain=0:2,y domain=0:2*pi,samples=3,xmin=-1.5,xmax=1.5,ymin=-1.5,ymax=1.5,zmin=0,zmax=2]
      \addplot3[surf,z buffer=sort] ({cos(deg(y))},{sin(deg(y))},{x});
    \end{axis}
  \end{tikzpicture}`);
  const surfaces = result.ir.items.filter((item) => item.type === "path" && item.subtype === "axis-surface");

  assert.equal(result.diagnostics.length, 0);
  assert.equal(surfaces.length, 8);
  assert.ok(surfaces.some((item) => item.style.fill && item.style.fill !== "none"));
});

test("pgfplots expands explicit arithmetic tick sequences", () => {
  assert.deepEqual(axisTickValues("{0, 2, ..., 24}", "x", []), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
});

test("pgfplots uses the built-in viridis colormap for surfaces", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \begin{axis}[domain=0:1,y domain=0:1,samples=2]
      \addplot3[surf,colormap name=viridis] {x+y};
    \end{axis}
  \end{tikzpicture}`);
  const fills = result.ir.items
    .filter((item) => item.type === "path" && item.subtype === "axis-surface")
    .map((item) => item.style.fill)
    .filter((fill) => fill && fill !== "none");

  assert.equal(result.diagnostics.length, 0);
  assert.ok(fills.length > 0);
  assert.ok(fills.every((fill) => /^rgb\(/.test(fill)));
  assert.ok(fills.some((fill) => /^rgb\((?:3[0-9]|4[0-9])[,\s]+(?:1[0-9]{2}|2[0-9]{2})[,\s]+/.test(fill)));
});

test("pgfplots 3d axis lines left renders three open axes instead of a box", () => {
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: 0, zMax: 2 };
  const geometry = createAxisGeometry({ width: "6cm", height: "5cm", view: "{25}{30}" }, ranges);
  const commands = renderAxis3DBox({ "axis lines": "left" }, ranges, geometry);

  assert.equal(commands.length, 3);
  assert.ok(commands.every((command) => command.includes("-stealth")));
  assert.ok(commands.every((command) => !command.includes("cycle")));
  const [, xStart, xEnd] = commands[0].match(/\] (\([^)]*\)) -- (\([^)]*\));$/);
  const [, yStart] = commands[1].match(/\] (\([^)]*\)) -- (\([^)]*\));$/);
  const [, zStart] = commands[2].match(/\] (\([^)]*\)) -- (\([^)]*\));$/);
  assert.equal(yStart, xEnd, "the projected y axis should continue from the outward x-axis endpoint");
  assert.equal(zStart, xStart, "the projected z axis should share the outward x-axis origin");
});

test("pgfplots 3d axis lines left suppresses opposite-edge tick marks", () => {
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: 0, zMax: 2 };
  const geometry = createAxisGeometry({ width: "6cm", height: "5cm", view: "{25}{30}" }, ranges);
  const tickOptions = { "axis lines": "left", xtick: "{-1,1}", ytick: "{-1,1}", ztick: "{0,2}" };
  const commands = renderAxis3DTicks(tickOptions, ranges, geometry);

  assert.equal(commands.filter((command) => command.startsWith(String.raw`\draw[axis tick,`)).length, 6);
  assert.equal(commands.filter((command) => command.includes("axis tick label")).length, 6);
});

test("pgfplots oblique y tick labels use the native diagonal anchor", () => {
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -50, zMax: 150 };
  const axisOptions = {
    "pgfplots 3d surface": true,
    "axis lines": "left",
    xtick: "{4}",
    ytick: "{-5}",
    ztick: "{}",
    xlabel: "$x$",
    ylabel: "$y$"
  };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const tickCommands = renderAxis3DTicks(axisOptions, ranges, geometry);
  const labelCommands = renderAxisLabels3D(axisOptions, ranges, geometry);

  assert.ok(tickCommands.includes(String.raw`\node[axis tick label, anchor=north east, font=\normalsize, inner sep=0.333em, outer sep=0pt] at (4.143,0.004) {4};`));
  assert.ok(tickCommands.includes(String.raw`\node[axis tick label, anchor=north west, font=\normalsize, inner sep=0.333em, outer sep=0pt] at (4.664,-0.059) {-5};`));
  assert.ok(labelCommands.includes(String.raw`\node[axis label, anchor=north] at (1.874,-0.161) {$x$};`));
  assert.ok(labelCommands.includes(String.raw`\node[axis label, anchor=north west] at (6.251,0.301) {$y$};`));
});

test("pgfplots top-view surface axes lower through 2D frame and ticks", () => {
  const rendered = renderPgfplotsAxisAsTikz(
    { view: "{0}{90}", xmin: "-2", xmax: "2", ymin: "-2", ymax: "2", "axis equal image": true },
    String.raw`\addplot3[surf,samples=2,shader=interp] {x+y};`,
    {},
    [],
    {
      parseAddplots,
      parseLegendEntries,
      parsePgfplotsDeclaredFunctions,
      optionValues: (value) => (Array.isArray(value) ? value : value ? [value] : []),
      preparePgfplotsAxisOptions: (axisOptions) => axisOptions,
      computeAxisRanges,
      isSurfacePlot,
      renderAddplot,
      renderAxis3DGrid,
      renderAxis3DBox,
      renderAxis3DBoxForeground,
      renderAxis3DTicks,
      renderAxisLabels3D,
      renderAxis3DColorbar,
      renderAxisOverlayStatements,
      renderTernaryAxisAsTikz: () => "",
      parsePgfplotsColormaps: () => ({})
    }
  );

  assert.match(rendered, /\\path\[axis surface raster image=/);
  assert.doesNotMatch(rendered, /axis surface image cell/);
  assert.doesNotMatch(rendered, /\\draw\[axis surface,/);
  assert.match(rendered, /\\draw\[axis frame,/);
  assert.doesNotMatch(rendered, /axis 3d grid|axis line, gray!70/);
  assert.doesNotMatch(rendered, /anchor=west, font=\\scriptsize\] at .* \{2\}/);
});

test("pgfplots surface layers keep grid below surfaces and axis annotations above", () => {
  const rendered = renderPgfplotsAxisAsTikz(
    {
      view: "{10}{65}",
      domain: "-1:1",
      "y domain": "-1:1",
      samples: "2",
      grid: "major",
      xlabel: "x",
      ylabel: "y",
      zlabel: "z"
    },
    String.raw`\addplot3[surf] {x+y};
\node at (axis cs:0,0,0) {origin};`,
    {},
    [],
    {
      parseAddplots,
      parseLegendEntries,
      parsePgfplotsDeclaredFunctions,
      optionValues: (value) => (Array.isArray(value) ? value : value ? [value] : []),
      preparePgfplotsAxisOptions: (axisOptions) => axisOptions,
      computeAxisRanges,
      isSurfacePlot,
      renderAddplot,
      renderAxis3DGrid,
      renderAxis3DBox,
      renderAxis3DBoxForeground,
      renderAxis3DTicks,
      renderAxisLabels3D,
      renderAxis3DColorbar,
      renderAxisOverlayStatements,
      renderTernaryAxisAsTikz: () => "",
      parsePgfplotsColormaps: () => ({})
    }
  );

  const axisLineIndexes = [...rendered.matchAll(/\\draw\[axis line, black, line width=0\.4pt\]/g)].map((match) => match.index);
  const backgroundAxisLineIndex = axisLineIndexes[0];
  const foregroundAxisLineIndex = axisLineIndexes.at(-1);
  const tickIndex = rendered.indexOf(String.raw`\draw[axis tick, gray, line width=0.2pt]`);
  const gridIndex = rendered.indexOf(String.raw`\draw[axis 3d grid,`);
  const surfaceIndex = rendered.indexOf(String.raw`\path[axis surface fill,`);
  const surfaceMeshIndex = rendered.indexOf(String.raw`\draw[axis surface mesh,`);
  const overlayIndex = rendered.indexOf(String.raw`{origin};`);
  const labelIndex = rendered.indexOf(String.raw`\node[axis label,`);

  assert.ok(backgroundAxisLineIndex >= 0);
  assert.ok(foregroundAxisLineIndex >= 0);
  assert.ok(tickIndex >= 0);
  assert.ok(gridIndex >= 0);
  assert.ok(surfaceIndex >= 0);
  assert.ok(surfaceMeshIndex >= 0);
  assert.ok(overlayIndex >= 0);
  assert.ok(labelIndex >= 0);
  assert.ok(gridIndex < surfaceIndex);
  assert.ok(backgroundAxisLineIndex < surfaceIndex);
  assert.ok(surfaceIndex < surfaceMeshIndex);
  assert.ok(surfaceMeshIndex < overlayIndex);
  assert.ok(overlayIndex < foregroundAxisLineIndex);
  assert.ok(surfaceMeshIndex < foregroundAxisLineIndex);
  assert.ok(foregroundAxisLineIndex < tickIndex);
  assert.ok(overlayIndex < tickIndex);
  assert.ok(surfaceMeshIndex < tickIndex);
  assert.ok(tickIndex < labelIndex);
});

test("pgfplots legend parser owns addlegendentry and legend list statements", () => {
  assert.deepEqual(
    parseLegendEntries(String.raw`\addlegendentry{$\sin x$}
\addlegendentry{cosine}
\legend{{$x,y$}, {z}, plain}`),
    ["$\\sin x$", "cosine", "$x,y$", "z", "plain"]
  );
});

test("pgfplots axis overlay lowering owns axis coordinate statement transforms", () => {
  const ranges = { xMin: 0, xMax: 10, yMin: -1, yMax: 1 };
  const geometry = {
    origin: { x: 5, y: 7 },
    width: 100,
    height: 50,
    mapPoint: ({ x, y }) => ({
      x: 5 + ((x - ranges.xMin) / (ranges.xMax - ranges.xMin)) * 100,
      y: 7 + ((y - ranges.yMin) / (ranges.yMax - ranges.yMin)) * 50
    })
  };

  assert.deepEqual(
    renderAxisOverlayStatements(
      String.raw`\node at (axis cs:5,0) {mid};
\draw (rel axis cs:.25,.75) -- (\pgfkeysvalueof{/pgfplots/xmin},2);
\draw (axis cs:5,0) -- ++(axis direction cs:2,.5);
\path[axis pin edge] (axis cs:12,2) -- (axis description cs:1,1);`,
      ranges,
      geometry
    ),
    [
      String.raw`\node at (55,32) {mid};`,
      String.raw`\draw (30,44.5) -- (5,57);`,
      String.raw`\draw (55,32) -- ++(20,12.5);`,
      String.raw`\path[axis pin edge] (125,82) -- (105,57);`
    ]
  );
});

test("pgfplots axis overlay lowering evaluates braced math coordinate components", () => {
  const ranges = { xMin: 0, xMax: 10, yMin: 0, yMax: 1 };
  const geometry = {
    origin: { x: 0, y: 0 },
    width: 100,
    height: 50,
    mapPoint: ({ x, y }) => ({ x: x * 10, y: y * 50 })
  };

  assert.deepEqual(
    renderAxisOverlayStatements(
      String.raw`\draw[<->] (axis cs:{8-sqrt(4)},{.2+.1}) -- (axis cs:{8+sqrt(4)},{.2+.1});`,
      ranges,
      geometry
    ),
    [String.raw`\draw[<->] (60,15) -- (100,15);`]
  );
});

test("pgfplots axis overlay lowering projects three-dimensional coordinate systems", () => {
  const ranges = { xMin: 0, xMax: 10, yMin: 0, yMax: 20, zMin: 0, zMax: 30 };
  const geometry = {
    is3d: true,
    origin: { x: 5, y: 7 },
    width: 100,
    height: 50,
    mapPoint3d: ({ x, y, z = 0 }) => ({ x: 5 + x + 2 * y, y: 7 + 3 * z }),
    mapNormalizedPoint3d: ({ x, y, z = 0 }) => ({ x: 5 + 100 * x + 20 * y, y: 7 + 50 * z }),
    mapAxisDirection3d: ({ x, y, z = 0 }) => ({ x: 100 * x + 20 * y, y: 50 * z })
  };

  assert.deepEqual(
    renderAxisOverlayStatements(
      String.raw`\node at (axis cs:1,2,3) {data};
\draw (rel axis cs:.25,.5,.75) -- (normalized axis cs:.5,.25,.1);
\draw (axis cs:1,2) -- ++(axis direction cs:2,4,6);`,
      ranges,
      geometry
    ),
    [
      String.raw`\node at (10,16) {data};`,
      String.raw`\draw (40,44.5) -- (60,12);`,
      String.raw`\draw (10,7) -- ++(24,10);`
    ]
  );
});

test("pgfplots axis overlay lowering owns pgfextra pathellipse primitives", () => {
  const ranges = { xMin: 0, xMax: 10, yMin: -1, yMax: 1 };
  const geometry = {
    origin: { x: 5, y: 7 },
    width: 100,
    height: 50,
    mapPoint: ({ x, y }) => ({
      x: 5 + ((x - ranges.xMin) / (ranges.xMax - ranges.xMin)) * 100,
      y: 7 + ((y - ranges.yMin) / (ranges.yMax - ranges.yMin)) * 50
    })
  };

  assert.deepEqual(
    renderAxisOverlayStatements(
      String.raw`\draw[blue, thick] \pgfextra{
  \pgfpathellipse{\pgfplotspointaxisxy{5}{0}}
    {\pgfplotspointaxisdirectionxy{2}{0}}
    {\pgfplotspointaxisdirectionxy{0}{0.5}}
};`,
      ranges,
      geometry
    ),
    [String.raw`\draw[blue, thick] (55,32) ellipse (20 and 12.5);`]
  );
});

test("pgfplots axis direction vectors use enlarged transform ranges for overlays", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    xmin: "-1.5",
    xmax: "1.5",
    enlargelimits: "true"
  };
  const ranges = { xMin: -1.5, xMax: 1.5, yMin: 0, yMax: 2.475 };
  const geometry = createAxisGeometry(axisOptions, ranges);

  assert.deepEqual(
    renderAxisOverlayStatements(
      String.raw`\draw[blue, thick] \pgfextra{
  \pgfpathellipse{\pgfplotspointaxisxy{0}{1}}
    {\pgfplotspointaxisdirectionxy{0.87}{0}}
    {\pgfplotspointaxisdirectionxy{0}{0.87}}
};`,
      ranges,
      geometry
    ),
    [String.raw`\draw[blue, thick] (3.427,2.583) ellipse (1.656 and 1.835);`]
  );
});

test("pgfplots expression evaluator owns declared functions, trig mode, and endpoint sampling", () => {
  const declarations = parsePgfplotsDeclaredFunctions(String.raw`f(\x)=\x^2; g(\x,\y)=f(\x)+\y`);

  assert.equal(declarations.length, 2);
  assert.equal(evaluateAxisExpression("f(x)+g(x,2)", 3, { "pgfplots declared functions": declarations }), 20);
  const constantDeclarations = parsePgfplotsDeclaredFunctions(String.raw`mu=2; sigma=3; h(\x)=\x+mu+sigma`);
  assert.equal(evaluateAxisExpression("h(x)", 4, { "pgfplots declared functions": constantDeclarations }), 9);
  assert.ok(Math.abs(evaluateAxisExpression("50*sin(1/50)", 0, {}) - 0.01678466796875) < 1e-12);
  assert.equal(
    evaluateAxisExpression("x*y*y/(x*x+y*y*y*y)", 0, {}, { y: 0 }),
    0,
    "PGF math leaves an isolated 0/0 surface sample at zero instead of opening a mesh hole"
  );
  assert.ok(Math.abs(evaluateAxisExpression("sin(x)", Math.PI / 2, { "trig format": "rad" }) - 1) < 1e-12);
  assert.ok(Math.abs(evaluateAxisExpression("sin((x*x)r)", Math.sqrt(Math.PI / 2), {}) - 1) < 1e-12);
  assert.equal(
    evaluateAxisExpressionAtSample("-x*ln(x)", 0, {}, { domain: { start: 0, end: 1 }, index: 0, samples: 11 }),
    0
  );
  assert.match(normalizeAxisExpression("sqrt(4)+deg(pi)", false), /Math\.sqrt/);
  assert.match(pgfMathRuntimePrelude(), /const atan2/);
});

test("pgfplots declared constants feed sampled 3d surface functions", () => {
  const declarations = parsePgfplotsDeclaredFunctions(String.raw`
    mu11=60;
    mu12=20;
    sigma11=5;
    sigma12=5;
    rho=0.8;
    bivar(\ma,\sa,\mb,\sb,\rho)=
      1/(2*pi*\sa*\sb*\rho) * exp(-((x-\ma)^2/\sa^2 + (y-\mb)^2/\sb^2 - (2*\rho*(x-\ma)*(y-\mb))/(\sa*\sb)))/(2*(1-\rho*\rho));
  `);
  const axisOptions = {
    domain: "40:90",
    "y domain": "0:60",
    samples: "4",
    "pgfplots declared functions": declarations,
    "pgfplots 3d surface": true
  };
  const ranges = { xMin: 40, xMax: 90, yMin: 0, yMax: 60, zMin: 0, zMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisSurfacePlot(
    {
      type: "function",
      is3d: true,
      options: { surf: true },
      expression: "bivar(mu11,sigma11,mu12,sigma12,rho)"
    },
    axisOptions,
    ranges,
    geometry,
    {},
    0
  );

  assert.ok(commands.some((command) => command.includes("axis surface fill")), "expected declared constants to produce finite surface patches");
});

test("pgfplots range resolver owns domains, samples, ranges, and surface restrictions", () => {
  const domain = parseDomain("0:2*pi");
  assert.equal(domain.start, 0);
  assert.ok(Math.abs(domain.end - Math.PI * 2) < 1e-12);
  assert.equal(axisSamples("200", 80), 80);

  assert.deepEqual(
    computeAxisRanges({ domain: "0:1", samples: 5 }, [{ type: "function", options: {}, expression: "x^2" }]),
    { xMin: -0.1, xMax: 1.1, yMin: -0.1, yMax: 1.1, zMin: 0, zMax: 1 }
  );
  assert.deepEqual(
    computeAxisRanges(
      { domain: "-5:5", "y domain": "-5:5", samples: 2, enlargelimits: "false" },
      [{ type: "function", is3d: true, options: { surf: true }, expression: "x+y" }]
    ),
    { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -10, zMax: 10 }
  );
  const shallowSurfaceRanges = computeAxisRanges(
    { domain: "-5:5", "y domain": "-5:5", samples: 50, enlargelimits: "false" },
    [{ type: "function", is3d: true, options: { surf: true }, expression: "(x^2+y^2)*sin(1/(x^2+y^2))" }]
  );
  assert.ok(
    shallowSurfaceRanges.zMin > 0.0154 && shallowSurfaceRanges.zMin < 0.0156,
    `expected shallow surface zMin to preserve sampled variation, got ${shallowSurfaceRanges.zMin}`
  );
  assert.ok(
    shallowSurfaceRanges.zMax > 0.0174 && shallowSurfaceRanges.zMax < 0.0175,
    `expected shallow surface zMax to preserve sampled variation, got ${shallowSurfaceRanges.zMax}`
  );
  assert.deepEqual(
    computeAxisRanges(
      { xmin: "-1", xmax: "6", ymin: "-0.25", ymax: "2.25", enlargelimits: "true" },
      []
    ),
    { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25, zMin: 0, zMax: 1 }
  );

  assert.deepEqual(
    sampleParametricDataPoints(
      { type: "parametric", options: { domain: "0:1", samples: 3 }, xExpression: "x", yExpression: "x^2" },
      {},
      {}
    ),
    [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.25 },
      { x: 1, y: 1 }
    ]
  );

  const zRestriction = parseZRestriction({ "restrict z to domain*": "0:1" }, {});
  assert.deepEqual(zRestriction, { start: 0, end: 1, clamp: true });
  assert.equal(restrictSurfaceZ(2, zRestriction), 1);
  assert.equal(isSurfacePlot({ is3d: true, options: { surf: true } }, {}), true);
});

test("pgfplots enlarged middle axes clip function plots to the final transformed limits", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    "enlarge x limits": "true",
    "enlarge y limits": "true",
    xmin: "0",
    xmax: "pi",
    ymin: "-1",
    ymax: "1"
  };
  const ranges = { xMin: 0, xMax: Math.PI, yMin: -1, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAddplot(
    {
      type: "function",
      expression: "x",
      options: { domain: "-8:8", samples: "200", red: true }
    },
    axisOptions,
    ranges,
    geometry,
    {},
    0
  );
  const path = commands.find((command) => command.startsWith("\\draw[axis plot"));
  const points = [...String(path).matchAll(/\((-?[0-9.]+),(-?[0-9.]+)\)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2])
  }));

  assert.ok(points.length > 2, `expected sampled path points in ${path}`);
  const enlargedLeft = geometry.mapPoint({ x: geometry.lineRanges.xMin, y: geometry.lineRanges.xMin });
  const enlargedTop = geometry.mapPoint({ x: geometry.lineRanges.yMax, y: geometry.lineRanges.yMax });
  assert.ok(Math.abs(points[0].x - enlargedLeft.x) < 1e-3, "plot should reach the enlarged left limit");
  assert.ok(
    Math.abs(points.at(-1).y - enlargedTop.y) < 1e-3,
    "plot should reach the enlarged upper limit"
  );
});

test("pgfplots range resolver keeps native middle-axis limits for x-square with circle", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex", "utf8");
  let observed = null;
  expandPgfplotsAxes(source, [], {}, {}, (axisOptions, body, options) => {
    const addplots = parseAddplots(body, options, []);
    observed = computeAxisRanges(axisOptions, addplots);
    return "";
  });

  assert.deepEqual(observed, { xMin: -1.5, xMax: 1.5, yMin: 0, yMax: 2.475, zMin: 0, zMax: 1 });
});

test("pgfplots ticks use half-step labels for compact x-square middle axis", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex", "utf8");
  let observed = null;
  expandPgfplotsAxes(source, [], {}, {}, (axisOptions, body, options) => {
    const addplots = parseAddplots(body, options, []);
    const ranges = computeAxisRanges(axisOptions, addplots);
    const geometry = createAxisGeometry(axisOptions, ranges);
    const tickCommands = renderAxisTicks(axisOptions, addplots, ranges, geometry);
    observed = {
      xLabels: tickCommands
        .filter((command) => command.includes("axis tick label") && command.includes("anchor=north"))
        .map((command) => command.match(/\{([^{}]*)\};$/)?.[1])
        .filter(Boolean),
      yLabels: tickCommands
        .filter((command) => command.includes("axis tick label") && command.includes("anchor=east"))
        .map((command) => command.match(/\{([^{}]*)\};$/)?.[1])
        .filter(Boolean)
    };
    return "";
  });

  assert.deepEqual(observed, {
    xLabels: ["−1.5", "−1", "−0.5", "0.5", "1", "1.5"],
    yLabels: ["0.5", "1", "1.5", "2"]
  });
});

test("pgfplots x-square major grid follows native y tick density", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex", "utf8");
  let observed = null;
  expandPgfplotsAxes(source, [], {}, {}, (axisOptions, body, options) => {
    const addplots = parseAddplots(body, options, []);
    const ranges = computeAxisRanges(axisOptions, addplots);
    const geometry = createAxisGeometry(axisOptions, ranges);
    const gridCommands = renderAxisGrid(axisOptions, addplots, ranges, geometry);
    observed = gridCommands
      .filter((command) => command.includes("] (0,") && command.includes(`-- (${testNumber(geometry.width)},`))
      .map((command) => Number(command.match(/\] \(0,([^)]+)\) --/)?.[1]))
      .filter(Number.isFinite);
    return "";
  });

  assert.deepEqual(observed, [1.529, 2.583, 3.638, 4.692]);
});

test("datavisualization school-book axes preserve only the native y-origin label", () => {
  const axisOptions = {
    width: "2cm",
    height: "2cm",
    "axis lines": "center",
    "datavis school book y origin label": true,
    xtick: "{0,1,2}",
    ytick: "{0,1,2}",
    "axis tick label font": String.raw`\footnotesize`,
    "major tick length": "2pt"
  };
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 2 };
  const commands = renderAxisTicks(axisOptions, [], ranges, createAxisGeometry(axisOptions, ranges));
  const originLabels = commands.filter((command) => command.endsWith("{0};"));

  assert.equal(originLabels.length, 1, `expected only the y-origin label, got ${originLabels.join("\\n")}`);
  assert.match(originLabels[0], /anchor=north east/);
  assert.match(originLabels[0], /at \(0,0\)/);
  assert.equal(
    commands.some((command) => command.startsWith(String.raw`\draw[axis tick`) && /\(0,0\)/.test(command)),
    false,
    "native school-book y origin has a label but no short tick line"
  );
});

test("pgfplots x-square skips out-of-range automatic terminal major ticks", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex", "utf8");
  let observed = null;
  expandPgfplotsAxes(source, [], {}, {}, (axisOptions, body, options) => {
    const addplots = parseAddplots(body, options, []);
    const ranges = computeAxisRanges(axisOptions, addplots);
    const geometry = createAxisGeometry(axisOptions, ranges);
    observed = renderAxisTicks(axisOptions, addplots, ranges, geometry)
      .filter((command) => command.includes("\\draw[axis tick") && command.includes("(3.427,"))
      .map((command) => Number(command.match(/\(3\.427,([^)]+)\)/)?.[1]))
      .filter(Number.isFinite);
    return "";
  });

  assert.ok(observed.includes(4.692), `expected highest native y tick, got ${observed.join(", ")}`);
  assert.ok(!observed.includes(5.746), `expected out-of-range terminal y tick to be skipped, got ${observed.join(", ")}`);
});

test("pgfplots automatic minor ticks are not emitted more than once", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex", "utf8");
  let minorTicks = [];
  expandPgfplotsAxes(source, [], {}, {}, (axisOptions, body, options) => {
    const addplots = parseAddplots(body, options, []);
    const ranges = computeAxisRanges(axisOptions, addplots);
    const geometry = createAxisGeometry(axisOptions, ranges);
    minorTicks = renderAxisTicks(axisOptions, addplots, ranges, geometry).filter((command) => command.includes("axis minor tick"));
    return "";
  });

  assert.equal(new Set(minorTicks).size, minorTicks.length, "automatic minor ticks should be unique");
});

test("pgfplots geometry separates tick/data ranges from enlarged middle-axis transform range", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex", "utf8");
  let observed = null;
  expandPgfplotsAxes(source, [], {}, {}, (axisOptions, body, options) => {
    const addplots = parseAddplots(body, options, []);
    const ranges = computeAxisRanges(axisOptions, addplots);
    const geometry = createAxisGeometry(axisOptions, ranges);
    observed = {
      ranges,
      transformRanges: geometry.transformRanges,
      xMinPoint: geometry.mapPoint({ x: ranges.xMin, y: 0 }),
      xMaxPoint: geometry.mapPoint({ x: ranges.xMax, y: 0 })
    };
    return "";
  });

  assert.deepEqual(observed.ranges, { xMin: -1.5, xMax: 1.5, yMin: 0, yMax: 2.475, zMin: 0, zMax: 1 });
  assert.deepEqual(observed.transformRanges, { xMin: -1.8, xMax: 1.8, yMin: -0.225, yMax: 2.475, zMin: 0, zMax: 1 });
  assert.ok(observed.xMinPoint.x > 0.57 && observed.xMinPoint.x < 0.58, `expected left tick inset, got ${observed.xMinPoint.x}`);
  assert.ok(observed.xMaxPoint.x > 6.28 && observed.xMaxPoint.x < 6.29, `expected right tick inset, got ${observed.xMaxPoint.x}`);
});

test("pgfplots x-square with circle fixture keeps its calibrated semantic canvas", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  // dvisvgm/tikztosvg and browser SVG measure different glyph/crop bounds.
  // The native fixture sheet is the visual acceptance target; keep this unit
  // regression focused on TikZKit's own calibrated, non-clipped canvas.
  assert.ok(size.width >= 196.4 && size.width <= 197.5, `expected calibrated width near 196.95pt, got ${size.width}pt`);
  assert.ok(size.height >= 168.2 && size.height <= 169.4, `expected calibrated height near 168.8pt, got ${size.height}pt`);
  assert.doesNotMatch(result.svg, /<text[^>]*>\s*<\/text>/, "axis bounds must not depend on empty tick labels");
});

test("pgfplots x-square middle axis remains inside the emitted canvas", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const xAxisY = horizontalBlackAxisYDocumentPt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  const size = svgDocumentSizePt(result.svg);
  assert.ok(xAxisY > size.height * 0.85 && xAxisY < size.height * 0.92, `expected lower middle axis inside ${size.height}pt canvas, got ${xAxisY}pt`);
});

test("pgfplots surface lowering owns coordinate meshes and sampled surface patches", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 2 };
  const geometry = { mapPoint3d: ({ x, y }) => ({ x, y }) };

  assert.deepEqual(
    renderAxisSurfaceCoordinatePlot(
      {
        type: "coordinates",
        options: { surf: true, fill: "blue", opacity: 0.75 },
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 1 },
          { x: 0, y: 1, z: 1 },
          { x: 1, y: 1, z: 2 }
        ]
      },
      {},
      ranges,
      geometry,
      0
    ),
    [
      String.raw`\path[axis surface fill, draw=none, fill=blue, opacity=0.75] (0,0) -- (1,0) -- (1,1) -- (0,1) -- cycle;`,
      String.raw`\draw[axis surface mesh, draw=rgb(0,0,204), fill=none, opacity=0.75, line width=0.4pt] (0,0) -- (1,0) -- (1,1) -- (0,1) -- cycle;`
    ]
  );

  const rowedPoints = parsePgfplotsCoordinateList(String.raw`(0,0,0) (0,1,1) (0,2,2)

(1,0,3) (1,1,4) (1,2,5)`);
  const rowedCommands = renderAxisSurfaceCoordinatePlot(
    {
      type: "coordinates",
      options: { surf: true, fill: "blue" },
      points: rowedPoints,
      coordinateRows: rowedPoints.rows
    },
    {},
    { xMin: 0, xMax: 1, yMin: 0, yMax: 2, zMin: 0, zMax: 5 },
    geometry,
    0
  );
  assert.match(
    rowedCommands[0],
    /\(0,0\) -- \(0,1\) -- \(1,1\) -- \(1,0\) -- cycle/,
    "surface coordinates should honor blank-line scanlines before unique-x/y shape inference"
  );

  const raggedPoints = parsePgfplotsCoordinateList(String.raw`(0,0,0) (0,1,1) (0,2,0)

(1,0,0) (1,1,2) (1,2,0) (2,0,0)`);
  const raggedCommands = renderAxisSurfaceCoordinatePlot(
    {
      type: "coordinates",
      options: { surf: true, fill: "blue", "z buffer": "none" },
      points: raggedPoints,
      coordinateRows: raggedPoints.rows
    },
    {},
    { xMin: 0, xMax: 2, yMin: 0, yMax: 2, zMin: 0, zMax: 2 },
    geometry,
    0
  );
  assert.ok(raggedCommands.length >= 2, "ragged coordinate scanlines should still produce surface patches");
  assert.match(
    raggedCommands[0],
    /\(0,0\) -- \(0,1\) -- \(1,1\) -- \(1,0\) -- cycle/,
    "ragged surface should connect adjacent row segments instead of falling back to flat point-pair strips"
  );

  const steppedCellPoints = parsePgfplotsCoordinateList(String.raw`(0,0,0) (0,0,2) (0,1,2) (0,1,0) (1,0,0)`);
  const steppedCellCommands = renderAxisSurfaceCoordinatePlot(
    {
      type: "coordinates",
      options: { surf: true, fill: "blue", "z buffer": "none" },
      points: steppedCellPoints,
      coordinateRows: steppedCellPoints.rows
    },
    {},
    { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 2 },
    { mapPoint3d: ({ x, y, z = 0 }) => ({ x, y: y - z }) },
    0
  );
  assert.ok(
    steppedCellCommands.some((command) => /\(0,-2\) -- \(1,-2\) -- \(1,-1\) -- \(0,-1\) -- cycle/.test(command)),
    `stepped surface rows should lower repeated-height intervals to cuboid top faces, got ${steppedCellCommands.join("\n")}`
  );

  const adjacentSteppedPoints = parsePgfplotsCoordinateList(
    String.raw`(0,0,0) (0,0,2) (0,1,2) (0,1,2) (0,2,2) (0,2,0) (1,0,0)`
  );
  const adjacentCommands = renderAxisSurfaceCoordinatePlot(
    {
      type: "coordinates",
      options: { surf: true, fill: "blue", "z buffer": "none" },
      points: adjacentSteppedPoints,
      coordinateRows: adjacentSteppedPoints.rows
    },
    {},
    { xMin: 0, xMax: 1, yMin: 0, yMax: 2, zMin: 0, zMax: 2 },
    { mapPoint3d: ({ x, y, z = 0 }) => ({ x, y: y - z }) },
    0
  );
  assert.ok(
    adjacentCommands.every((command) => !/\(0,1\) -- \(1,1\) -- \(1,-1\) -- \(0,-1\) -- cycle/.test(command)),
    `adjacent equal-height stepped cells should not emit the shared internal vertical face, got ${adjacentCommands.join("\n")}`
  );

  assert.deepEqual(
    renderAxisSurfaceCoordinatePlot(
      {
        type: "coordinates",
        options: { surf: true },
        points: [
          { x: 0, y: 0, z: 1 },
          { x: 1, y: 0, z: 1 },
          { x: 0, y: 1, z: 1 },
          { x: 1, y: 1, z: 1 }
        ]
      },
      {
        "colormap name": "whitered",
        "pgfplots colormaps": {
          whitered: [
            { position: 0, color: "white" },
            { position: 1, color: "orange!75!red" }
          ]
        }
      },
      { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 },
      geometry,
      0
    ),
    [
      String.raw`\path[axis surface fill, draw=none, fill=rgb(255 96 0), opacity=1] (0,0) -- (1,0) -- (1,1) -- (0,1) -- cycle;`,
      String.raw`\draw[axis surface mesh, draw=rgb(204,77,0), fill=none, opacity=1, line width=0.4pt] (0,0) -- (1,0) -- (1,1) -- (0,1) -- cycle;`
    ]
  );

  assert.deepEqual(
    renderAxisSurfacePlot(
      { type: "function", is3d: true, options: { surf: true, domain: "0:1", "y domain": "0:1", samples: 2, fill: "red" }, expression: "x+y" },
      {},
      ranges,
      geometry,
      {},
      0
    ),
    [
      String.raw`\path[axis surface fill, draw=none, fill=red, opacity=1] (0,0) -- (1,0) -- (1,1) -- (0,1) -- cycle;`,
      String.raw`\draw[axis surface mesh, draw=rgb(204,0,0), fill=none, opacity=1, line width=0.4pt] (0,0) -- (1,0) -- (1,1) -- (0,1) -- cycle;`
    ]
  );
});

test("pgfplots faceted surface patch paint order alternates fill and mesh for each ordered patch", () => {
  const commands = renderAxisSurfacePlot(
    {
      type: "function",
      is3d: true,
      options: { surf: true, fill: "red", domain: "0:2", "y domain": "0:1", samples: 3, "samples y": 2, "z buffer": "none" },
      expression: "x+y"
    },
    {},
    { xMin: 0, xMax: 2, yMin: 0, yMax: 1, zMin: 0, zMax: 3 },
    { mapPoint3d: ({ x, y }) => ({ x, y }) },
    {},
    0
  );

  assert.deepEqual(
    commands.map((command) => (command.startsWith(String.raw`\path[axis surface fill`) ? "fill" : "mesh")),
    ["fill", "mesh", "fill", "mesh"]
  );
  assert.equal(commands[0].slice(commands[0].indexOf("] ") + 2), commands[1].slice(commands[1].indexOf("] ") + 2));
  assert.equal(commands[2].slice(commands[2].indexOf("] ") + 2), commands[3].slice(commands[3].indexOf("] ") + 2));
});

test("pgfplots faceted surface patch paint order preserves default and sorted first patches", () => {
  const axisOptions = {
    "pgfplots 3d surface": true,
    view: "{10}{65}",
    samples: "3",
    domain: "-1:1",
    "y domain": "-1:1"
  };
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const defaultCommands = renderAxisSurfacePlot(
    { type: "function", is3d: true, options: { surf: true }, expression: "x*y" },
    axisOptions,
    ranges,
    geometry,
    {},
    0
  );
  const sortedCommands = renderAxisSurfacePlot(
    { type: "function", is3d: true, options: { surf: true, "z buffer": "sort" }, expression: "x*y" },
    axisOptions,
    ranges,
    geometry,
    {},
    0
  );

  assert.ok(defaultCommands[0].includes("(0.511,2.932) -- (3.409,2.648) -- (3.92,4.254) -- (1.022,3.777)"));
  assert.ok(sortedCommands[0].includes("(0,2.086) -- (2.898,1.043) -- (3.409,2.648) -- (0.511,2.932)"));
  assert.deepEqual(
    defaultCommands.slice(0, 2).map((command) => (command.startsWith(String.raw`\path[axis surface fill`) ? "fill" : "mesh")),
    ["fill", "mesh"]
  );
  assert.deepEqual(
    sortedCommands.slice(0, 2).map((command) => (command.startsWith(String.raw`\path[axis surface fill`) ? "fill" : "mesh")),
    ["fill", "mesh"]
  );
});

test("pgfplots faceted surface patch paint order omits mesh commands for interpolated patches", () => {
  const commands = renderAxisSurfacePlot(
    {
      type: "function",
      is3d: true,
      options: { surf: true, shader: "interp", fill: "red", domain: "0:2", "y domain": "0:1", samples: 3, "samples y": 2 },
      expression: "x+y"
    },
    {},
    { xMin: 0, xMax: 2, yMin: 0, yMax: 1, zMin: 0, zMax: 3 },
    { mapPoint3d: ({ x, y }) => ({ x, y }) },
    {},
    0
  );

  assert.deepEqual(commands.map((command) => command.startsWith(String.raw`\path[axis surface fill`)), [true, true]);
  assert.ok(commands.every((command) => !command.includes("axis surface mesh")));
});

test("pgfplots surface patch paint order pairs stepped coordinate cuboid faces", () => {
  const points = parsePgfplotsCoordinateList(String.raw`(0,0,0) (0,0,2) (0,1,2) (0,1,0) (1,0,0)`);
  const commands = renderAxisSurfaceCoordinatePlot(
    {
      type: "coordinates",
      options: { surf: true, fill: "blue", "z buffer": "none" },
      points,
      coordinateRows: points.rows
    },
    {},
    { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 2 },
    { mapPoint3d: ({ x, y, z = 0 }) => ({ x, y: y - z }) },
    0
  );

  assert.ok(commands.length >= 6, `expected cuboid top and side faces, got ${commands.join("\\n")}`);
  for (let index = 0; index < commands.length; index += 2) {
    assert.ok(commands[index].startsWith(String.raw`\path[axis surface fill`));
    assert.ok(commands[index + 1].startsWith(String.raw`\draw[axis surface mesh`));
    assert.equal(commands[index].slice(commands[index].indexOf("] ") + 2), commands[index + 1].slice(commands[index + 1].indexOf("] ") + 2));
  }
});

test("pgfplots stepped Manhattan cuboids paint distant light faces before foreground peaks", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/3d-manhattan-bar-plot.tex", "utf8");
  const body = parseTikz(source).ast.pictures[0].body;
  const fills = body.split("\n").filter((line) => line.includes("axis surface fill"));

  assert.ok(fills.length >= 20);
  assert.match(fills[0], /fill=rgb\(212\.5 212\.5 255\)/);
  assert.ok(fills.findIndex((line) => /fill=blue[,\]]/.test(line)) > 0, "the tallest foreground top should be painted after distant light faces");
});

test("pgfplots shader interp surfaces suppress mesh strokes", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 2 };
  const geometry = { mapPoint3d: ({ x, y }) => ({ x, y }) };

  assert.deepEqual(
    renderAxisSurfacePlot(
      {
        type: "function",
        is3d: true,
        options: { surf: true, shader: "interp", domain: "0:1", "y domain": "0:1", samples: 2, fill: "red" },
        expression: "x+y"
      },
      {},
      ranges,
      geometry,
      {},
      0
    ),
    [String.raw`\path[axis surface fill, draw=none, fill=red, opacity=1] (0,0) -- (1,0) -- (1,1) -- (0,1) -- cycle;`]
  );
});

test("pgfplots surf colormap uses actual point meta range instead of rounded colorbar tick range", () => {
  const ranges = {
    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 1,
    zMin: 0.015479949354,
    zMax: 0.01744910212
  };
  const geometry = { mapPoint3d: ({ x, y }) => ({ x, y }) };
  const commands = renderAxisSurfacePlot(
    {
      type: "function",
      is3d: true,
      options: { surf: true, domain: "0:1", "y domain": "0:1", samples: 2 },
      expression: "0.016830743029434353"
    },
    {
      "colormap name": "whitered",
      "pgfplots colormaps": {
        whitered: [
          { position: 0, color: "white" },
          { position: 1, color: "orange!75!red" }
        ]
      }
    },
    ranges,
    geometry,
    {},
    0
  );

  assert.match(commands[0], /fill=rgb\(255 145\.929643 80\.075843\)/);
});

test("pgfplots surface point meta colors sampled surfaces independently from z values", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = { mapPoint3d: ({ x, y }) => ({ x, y }) };
  const commands = renderAxisSurfacePlot(
    {
      type: "function",
      is3d: true,
      options: {
        surf: true,
        domain: "0:1",
        "y domain": "0:1",
        samples: 3,
        "point meta": "x",
        colormap: "{blackwhite}{color(0cm)=(black); color(1cm)=(white)}"
      },
      expression: "1"
    },
    {},
    ranges,
    geometry,
    {},
    0
  );
  const fillColors = commands
    .filter((command) => command.startsWith(String.raw`\path[axis surface fill`))
    .map((command) => command.match(/fill=(.*?), opacity=/)?.[1])
    .filter(Boolean);

  assert.ok(fillColors.includes("rgb(63.75 63.75 63.75)"), `expected point meta to drive black-white colormap, got ${fillColors.join(", ")}`);
  assert.ok(fillColors.includes("rgb(191.25 191.25 191.25)"), `expected point meta to drive black-white colormap, got ${fillColors.join(", ")}`);
});

test("pgfplots top-view shader interp surfaces lower to one raster image primitive", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 2 };
  const geometry = { mapPoint3d: ({ x, y }) => ({ x, y }) };

  const commands = renderAxisSurfacePlot(
    {
      type: "function",
      is3d: true,
      options: { surf: true, shader: "interp", domain: "0:1", "y domain": "0:1", samples: 2, fill: "red" },
      expression: "x+y"
    },
    { view: "{0}{90}" },
    ranges,
    geometry,
    {},
    0
  );

  assert.equal(commands.length, 1);
  assert.match(commands[0], /^\\path\[axis surface raster image=[A-Za-z0-9_-]+, draw=none\] \(0,0\) rectangle \(1,1\);$/);
  assert.doesNotMatch(commands[0], /axis surface image cell/);
});

test("pgfplots top-view shader interp raster is supersampled instead of crisp cell-sized blocks", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 2 };
  const geometry = { mapPoint3d: ({ x, y }) => ({ x, y }) };

  const commands = renderAxisSurfacePlot(
    {
      type: "function",
      is3d: true,
      options: { surf: true, shader: "interp", domain: "0:1", "y domain": "0:1", samples: 2 },
      expression: "x+y"
    },
    { view: "{0}{90}" },
    ranges,
    geometry,
    { pgfplotsSurfaceRasterScale: 4 },
    0
  );
  const raster = decodeAxisSurfaceRasterCommand(commands[0]);

  assert.equal(raster.payload.imageRendering, "auto");
  assert.equal(raster.png.width, 8);
  assert.equal(raster.png.height, 8);
  assert.ok(raster.payload.href.startsWith("data:image/png;base64,"));
});

test("pgfplots top-view shader interp defaults to native-like dense raster sampling", () => {
  const ranges = { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -1, zMax: 1 };
  const geometry = { mapPoint3d: ({ x, y }) => ({ x, y }) };

  const commands = renderAxisSurfacePlot(
    {
      type: "function",
      is3d: true,
      options: { surf: true, shader: "interp", domain: "-2:2", "y domain": "-2:2", samples: 50 },
      expression: "x/exp(x^2+y^2)"
    },
    { view: "{0}{90}" },
    ranges,
    geometry,
    {},
    0
  );
  const raster = decodeAxisSurfaceRasterCommand(commands[0]);

  assert.equal(raster.png.width, 300);
  assert.equal(raster.png.height, 300);
});

test("pgfplots top-view shader interp raster interpolates vertex colors instead of interpolated z values", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 2 };
  const geometry = { mapPoint3d: ({ x, y }) => ({ x, y }) };

  const commands = renderAxisSurfacePlot(
    {
      type: "function",
      is3d: true,
      options: { surf: true, shader: "interp", domain: "0:1", "y domain": "0:1", samples: 2, "colormap name": "blackredwhite" },
      expression: "x+y"
    },
    {
      view: "{0}{90}",
      "pgfplots colormaps": {
        blackredwhite: [
          { position: 0, color: "black" },
          { position: 0.5, color: "red" },
          { position: 1, color: "white" }
        ]
      }
    },
    ranges,
    geometry,
    { pgfplotsSurfaceRasterScale: 2 },
    0
  );
  const raster = decodeAxisSurfaceRasterCommand(commands[0]);

  assert.deepEqual(pngPixel(raster.png, 1, 1), [198, 57, 57, 255]);
  assert.notDeepEqual(pngPixel(raster.png, 1, 1), [255, 0, 0, 255]);
});

test("pgfplots surface z ordering follows the 3D view direction", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = { mapPoint3d: ({ x, y }) => ({ x, y }) };
  const commands = renderAxisSurfaceCoordinatePlot(
    {
      type: "coordinates",
      options: { surf: true, "mesh/rows": "2", fill: "orange" },
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 1, z: 0 }
      ]
    },
    { view: "{90}{30}" },
    ranges,
    geometry,
    0
  );

  const fillCommands = commands.filter((command) => command.includes("axis surface fill"));
  const meshCommands = commands.filter((command) => command.includes("axis surface mesh"));

  assert.equal(commands.length, 4);
  assert.equal(fillCommands.length, 2);
  assert.equal(meshCommands.length, 2);
  assert.ok(commands[0].includes("axis surface fill"));
  assert.ok(commands[1].includes("axis surface mesh"));
  assert.ok(commands[2].includes("axis surface fill"));
  assert.ok(commands[3].includes("axis surface mesh"));
  assert.ok(
    fillCommands[0].includes("(1,0) -- (2,0) -- (2,1) -- (1,1) -- cycle"),
    `expected the positive-x patch to be filled first for view={90}{30}, got ${fillCommands[0]}`
  );
});

test("pgfplotsset colormap declarations feed surface colors", () => {
  const svg = tikzToSvg(String.raw`
\pgfplotsset{
  colormap={bluegreenred}{
    color(0cm)=(blue);
    color(0.5cm)=(green);
    color(1cm)=(red)
  }
}
\begin{tikzpicture}
  \begin{axis}[domain=-1:1, y domain=0:1, xmin=-1, xmax=1, ymin=0, ymax=1]
    \addplot3[surf, shader=interp, samples=2, colormap name=bluegreenred] {x};
  \end{axis}
\end{tikzpicture}`).svg;

  assert.match(svg, /fill="green"|fill="rgb\(0,\s*128,\s*0\)"|fill="rgb\(0\s+255\s+0\)"/);
  assert.doesNotMatch(svg, /fill="rgb\(163,\s*169,\s*158\)"/);
});

test("pgfplots surface draw color does not replace mapped faces or faceted mesh colors", () => {
  const axisOptions = {
    domain: "-2:2",
    "y domain": "-2:2",
    samples: "4",
    "colormap name": "whitered",
    "pgfplots colormaps": {
      whitered: [
        { position: 0, color: "white" },
        { position: 1, color: "orange!75!red" }
      ]
    }
  };
  const plot = {
    type: "function",
    is3d: true,
    options: { surf: true, draw: "black" },
    expression: "x^2-y^2"
  };
  const ranges = computeAxisRanges(axisOptions, [plot]);
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisSurfacePlot(plot, axisOptions, ranges, geometry, {}, 0);
  const fillColors = new Set(
    commands
      .filter((command) => command.startsWith(String.raw`\path[axis surface fill`))
      .map((command) => command.match(/fill=(.*?), opacity=/)?.[1])
      .filter(Boolean)
  );
  const meshCommands = commands.filter((command) => command.startsWith(String.raw`\draw[axis surface mesh`));
  const meshColors = new Set(
    meshCommands
      .map((command) => command.match(/draw=(.*?), fill=none/)?.[1])
      .filter(Boolean)
  );

  assert.ok(fillColors.size > 1, `expected mapped face colors, got ${[...fillColors].join(", ")}`);
  assert.ok(!fillColors.has("black"), "draw=black must not replace surface face colors");
  assert.ok(meshCommands.length > 0, "expected a faceted mesh layer");
  assert.ok(meshColors.size > 1, `expected mapped faceted colors, got ${[...meshColors].join(", ")}`);
  assert.ok(!meshColors.has("black"), "draw=black must not replace the default mapped faceted color");
});

test("pgfplots shallow surface colormap preserves fractional color variation", () => {
  const axisOptions = {
    domain: "-5:5",
    "y domain": "-5:5",
    samples: "50",
    enlargelimits: "false",
    view: "{65}{65}",
    width: "15cm",
    "pgfplots 3d surface": true,
    "colormap name": "whitered",
    "pgfplots colormaps": {
      whitered: [
        { position: 0, color: "white" },
        { position: 1, color: "orange!75!red" }
      ]
    }
  };
  const plot = {
    type: "function",
    is3d: true,
    options: { surf: true },
    expression: "(x^2+y^2)*sin(1/(x^2+y^2))"
  };
  const ranges = computeAxisRanges(axisOptions, [plot]);
  const geometry = createAxisGeometry(axisOptions, ranges);
  const fillColors = new Set(
    renderAxisSurfacePlot(plot, axisOptions, ranges, geometry, {}, 0)
      .filter((command) => command.startsWith(String.raw`\path[axis surface fill`))
      .map((command) => command.match(/fill=(.*?), opacity=/)?.[1])
      .filter(Boolean)
  );
  const overSaturatedFaces = renderAxisSurfacePlot(plot, axisOptions, ranges, geometry, {}, 0)
    .filter((command) => command.startsWith(String.raw`\path[axis surface fill`))
    .map((command) => command.match(/fill=(.*?), opacity=/)?.[1])
    .filter((color) => /^rgb\(255\s+96\./.test(String(color))).length;

  assert.ok(fillColors.size > 100, `expected native-like fractional surface color variation, got ${fillColors.size} colors`);
  assert.ok(
    overSaturatedFaces / (50 - 1) ** 2 < 0.1,
    `expected point meta range to avoid clipping most faces to the max color stop, got ${overSaturatedFaces}`
  );
});

test("pgfplots axis inline colormap option feeds surface colors", () => {
  const svg = tikzToSvg(String.raw`
\begin{tikzpicture}
  \begin{axis}[
    xmin=0,xmax=1,ymin=0,ymax=1,zmin=0,zmax=6,
    view={120}{35},
    colormap={pos}{color(0cm)=(white); color(6cm)=(blue)}
  ]
    \addplot3[surf,mark=none] coordinates {(0,0,6) (1,0,6) (0,1,6) (1,1,6)};
  \end{axis}
\end{tikzpicture}`).svg;

  assert.match(svg, /fill="blue"|fill="rgb\(0,\s*0,\s*255\)"/);
  assert.doesNotMatch(svg, /fill="rgb\(240,\s*45,\s*20\)"/);
});

test("pgfplots top-view shader surfaces normalize colormap per plot when point meta rel=per plot", () => {
  const commands = renderAxisSurfacePlot(
    {
      type: "function",
      is3d: true,
      options: {
        surf: true,
        shader: "interp",
        samples: 2,
        domain: "0:1",
        "y domain": "0:1",
        "colormap name": "blackwhite"
      },
      expression: "x",
      nodes: []
    },
    {
      view: "{0}{90}",
      "point meta rel": "per plot",
      "pgfplots colormaps": {
        blackwhite: [
          { position: 0, color: "black" },
          { position: 1, color: "white" }
        ]
      }
    },
    { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 10 },
    { mapPoint3d: ({ x, y }) => ({ x, y }) },
    {},
    0
  );
  const { png } = decodeAxisSurfaceRasterCommand(commands[0]);

  assert.deepEqual(pngPixel(png, png.width - 1, 0), [255, 255, 255, 255]);
  assert.notDeepEqual(pngPixel(png, png.width - 1, 0), [26, 26, 26, 255]);
});

test("pgfplots top-view shader surface keeps quiver as anti-aliased vector arrows", () => {
  const result = tikzToSvg(String.raw`
\pgfplotsset{
  colormap={blackwhite}{
    color(0cm)=(black);
    color(1cm)=(white)
  }
}
\begin{tikzpicture}
\begin{axis}[domain=-1:1, y domain=-1:1, xmin=-1, xmax=1, ymin=-1, ymax=1, view={0}{90}, axis equal image, point meta rel=per plot]
  \addplot3[surf, samples=8, shader=interp, colormap name=blackwhite] {x};
  \addplot3[blue,
    point meta={abs(x)},
    quiver={
      u={1},
      v={0},
      scale arrows=0.25,
      every arrow/.append style={-{Latex[scale length={max(0.01,\pgfplotspointmetatransformed/1000)}]}}
    },
    samples=5] {x};
\end{axis}
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const png = decodeFirstRasterImageFromSvg(result.svg);

  assert.deepEqual(result.diagnostics, []);
  assert.equal((result.svg.match(/<image\b/g) || []).length, 1);
  assert.equal(countBlueRasterPixels(png), 0, "surface raster should not bake in jagged quiver arrows");
  assert.equal((result.svg.match(/<path class="tikz-arrow-tip/g) || []).length, 25, "expected quiver arrows to stay as SVG arrow tips");
});

test("pgfplots quiver addplot3 lowers vector samples to arrow paths", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = { mapPoint: (point) => point, mapPoint3d: ({ x, y }) => ({ x, y }) };

  const commands = renderAddplot(
    {
      type: "function",
      is3d: true,
      options: {
        blue: true,
        domain: "0:1",
        "y domain": "0:0",
        samples: 2,
        quiver: "u={1}, v={0}, scale arrows=0.3"
      },
      expression: "0",
      nodes: []
    },
    {},
    ranges,
    geometry,
    {},
    0
  );

  assert.deepEqual(commands, [
    String.raw`\draw[axis quiver, blue, -stealth] (0,0) -- (0.3,0);`,
    String.raw`\draw[axis quiver, blue, -stealth] (1,0) -- (1.3,0);`
  ]);

  const latexTipCommands = renderAddplot(
    {
      type: "function",
      is3d: true,
      options: {
        blue: true,
        domain: "0:0",
        "y domain": "0:0",
        samples: 2,
        quiver: String.raw`u={1}, v={0}, scale arrows=0.3, every arrow/.append style={-{Latex[scale length={max(0.01,\pgfplotspointmetatransformed/1000)}]}}`
      },
      expression: "0",
      nodes: []
    },
    {},
    ranges,
    geometry,
    {},
    0
  );

  assert.deepEqual(latexTipCommands, [String.raw`\draw[axis quiver, blue, -{Latex[length=2.8pt,width=2.1pt]}] (0,0) -- (0.3,0);`]);
});

test("pgfplots quiver Latex scale length follows point meta transformation", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 2 };
  const geometry = { mapPoint: (point) => point, mapPoint3d: ({ x, y }) => ({ x, y }) };

  const commands = renderAddplot(
    {
      type: "function",
      is3d: true,
      options: {
        blue: true,
        domain: "0:1",
        "y domain": "0:0",
        samples: 2,
        "point meta": "x",
        quiver: String.raw`u={x}, v={0}, scale arrows=0.3, every arrow/.append style={-{Latex[scale length={max(0.01,\pgfplotspointmetatransformed/1000)}]}}`
      },
      expression: "0",
      nodes: []
    },
    { "point meta rel": "per plot" },
    ranges,
    geometry,
    {},
    0
  );

  assert.deepEqual(commands, [
    String.raw`\draw[axis quiver, blue, -{Latex[length=0.03pt,width=2.1pt]}] (0,0) -- (0,0);`,
    String.raw`\draw[axis quiver, blue, -{Latex[length=2.8pt,width=2.1pt]}] (1,0) -- (1.3,0);`
  ]);
});

test("pgfplots addplot lowering owns coordinate, function, and parametric plot primitives", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = { mapPoint: (point) => ({ x: point.x, y: point.y }), mapPoint3d: (point) => point };

  assert.deepEqual(
    renderAddplot(
      {
        type: "coordinates",
        options: { blue: true, "name path": "curve" },
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 }
        ],
        nodes: []
      },
      {},
      ranges,
      geometry,
      {},
      0
    ),
    [String.raw`\draw[axis plot, blue, name path=curve] (0,0) -- (1,1);`]
  );

  assert.deepEqual(
    renderAddplot(
      { type: "function", options: { domain: "0:1", samples: 2 }, expression: "x^2", nodes: [] },
      {},
      ranges,
      geometry,
      {},
      0
    ),
    [String.raw`\draw[axis plot, blue] (0,0) -- (1,1);`]
  );

  assert.deepEqual(
    renderAddplot(
      { type: "parametric", options: { domain: "0:1", samples: 2, red: true }, xExpression: "x", yExpression: "x", nodes: [] },
      {},
      ranges,
      geometry,
      {},
      0
    ),
    [String.raw`\draw[axis plot, red] (0,0) -- (1,1);`]
  );
});

test("pgfplots 3d axis lowering owns frame, ticks, and labels", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = {
    mapPoint3d: ({ x, y, z }) => ({ x: x + y * 0.1, y: z + y * 0.2 })
  };

  assert.deepEqual(renderAxis3DBox({}, ranges, geometry).slice(0, 2), [
    String.raw`\draw[axis line, black, line width=0.4pt] (0,0) -- (1,0) -- (1.1,0.2) -- (0.1,0.2) -- cycle;`,
    String.raw`\draw[axis line, black, line width=0.4pt] (0,1) -- (1,1) -- (1.1,1.2) -- (0.1,1.2) -- cycle;`
  ]);

  const tickCommands = renderAxis3DTicks({ xtick: "{0,1}", ytick: "{0,1}", ztick: "{0,1}" }, ranges, geometry);
  assert.ok(tickCommands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (0,0) -- (0,0.15);`));
  assert.ok(tickCommands.some((command) => command.includes("axis tick label") && command.endsWith("{1};")));

  assert.deepEqual(renderAxisLabels3D({ xlabel: "$x$", ylabel: "$y$", zlabel: "$z$", title: "Surface" }, ranges, geometry), [
    String.raw`\node[axis label, anchor=north] at (0.5,-0.72) {$x$};`,
    String.raw`\node[axis label, anchor=east] at (-0.531,0.391) {$y$};`,
    String.raw`\node[axis label, anchor=east, rotate=90] at (-1,0.5) {$z$};`,
    String.raw`\node[axis label, anchor=south] at (0.55,1.35) {Surface};`
  ]);
});

test("pgfplots 3d major grid lowers bottom and back grid planes", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = {
    mapPoint3d: ({ x, y, z }) => ({ x: x + y * 0.1, y: z + y * 0.2 })
  };
  const commands = renderAxis3DGrid(
    { grid: "major", xtick: "{0,1}", ytick: "{0,1}", ztick: "{0,1}", "axis grid color": "gray!30" },
    ranges,
    geometry
  );

  assert.ok(commands.includes(String.raw`\draw[axis 3d grid, gray!30, line width=0.4pt] (0,0) -- (0.1,0.2);`));
  assert.ok(commands.includes(String.raw`\draw[axis 3d grid, gray!30, line width=0.4pt] (0.1,0.2) -- (1.1,0.2);`));
  assert.ok(commands.includes(String.raw`\draw[axis 3d grid, gray!30, line width=0.4pt] (0.1,1.2) -- (1.1,1.2);`));
  assert.ok(commands.includes(String.raw`\draw[axis 3d grid, gray!30, line width=0.4pt] (0.1,0.2) -- (0.1,1.2);`));
});

test("pgfplots 3d grid=both derives boundary minor grids and ticks", () => {
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -50, zMax: 150 };
  const geometry = {
    mapPoint3d: ({ x, y, z }) => ({ x: x + y * 0.1, y: z + y * 0.2 })
  };
  const axisOptions = {
    grid: "both",
    "minor tick num": "1",
    xtick: "{-4,-2,0,2,4}",
    ytick: "{-4,-2,0,2,4}",
    ztick: "{0,100}",
    "axis grid color": "gray!30"
  };
  const gridCommands = renderAxis3DGrid(axisOptions, ranges, geometry);
  const tickCommands = renderAxis3DTicks(axisOptions, ranges, geometry);

  assert.ok(gridCommands.includes(String.raw`\draw[axis 3d grid, gray!30, line width=0.4pt] (-5.5,-51) -- (-4.5,-49);`));
  assert.ok(gridCommands.includes(String.raw`\draw[axis 3d grid, gray!30, line width=0.4pt] (-3.5,-51) -- (-2.5,-49);`));
  assert.ok(gridCommands.includes(String.raw`\draw[axis 3d grid, gray!30, line width=0.4pt] (-4.5,151) -- (5.5,151);`));
  assert.ok(tickCommands.some((command) => command.includes("axis minor tick")));
  assert.ok(tickCommands.every((command) => !command.includes("axis minor tick label")));
  assert.equal(new Set(gridCommands).size, gridCommands.length);
});

test("pgfplots 3d automatic major ticks scale with axis size", () => {
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5 };
  const geometry = {
    width: 15,
    height: 10,
    mapPoint3d: ({ x, y }) => ({ x, y })
  };

  const commands = renderAxis3DTicks({}, ranges, geometry);

  assert.ok(commands.some((command) => command.includes("axis tick label") && command.endsWith("{-4};")));
  assert.ok(commands.some((command) => command.includes("axis tick label") && command.endsWith("{4};")));
});

test("pgfplots 3d automatic major ticks use projected axis length", () => {
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5 };
  const geometry = {
    width: 15,
    height: 15,
    mapPoint3d: ({ x, y, z }) => ({ x: x + y * 0.2, y: y * 0.7 + z * 0.25 })
  };

  const commands = renderAxis3DTicks({}, ranges, geometry);
  const tickLabels = commands.filter((command) => command.includes("axis tick label"));

  assert.ok(tickLabels.some((command) => command.endsWith("{-4};")));
  assert.ok(tickLabels.some((command) => command.endsWith("{4};")));
  assert.ok(tickLabels.some((command) => command.endsWith("{-3};")));
  assert.ok(tickLabels.some((command) => command.endsWith("{3};")));
});

test("pgfplots 3d automatic ticks use the native 35pt maximum spacing", () => {
  const ranges = { xMin: 40, xMax: 90, yMin: 0, yMax: 60, zMin: 0, zMax: 0.01 };
  const geometry = createAxisGeometry(
    { width: "15cm", view: "{-15}{70}", "pgfplots 3d surface": true },
    ranges
  );
  const commands = renderAxis3DTicks({}, ranges, geometry);

  assert.ok(commands.some((command) => command.includes("axis tick label") && command.endsWith("{45};")));
  assert.ok(commands.some((command) => command.includes("axis tick label") && command.endsWith("{85};")));
});

test("pgfplots compact 3d axes inherit the native three-tick minimum", () => {
  const axisOptions = { width: "6cm", scale: "0.5", view: "{155}{45}", "pgfplots 3d surface": true };
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -125, zMax: 150 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxis3DTicks(axisOptions, ranges, geometry);
  const labels = commands.filter((command) => command.includes("axis tick label"));

  assert.ok(labels.some((command) => command.endsWith("{-5};")));
  assert.ok(labels.some((command) => command.endsWith("{5};")));
  assert.ok(!labels.some((command) => command.endsWith("{-4};")));
  assert.ok(!labels.some((command) => command.endsWith("{4};")));
});

test("pgfplots compact 3d z ticks keep native-like signed major labels", () => {
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -124.992, zMax: 150 };
  const geometry = createAxisGeometry(
    { width: "6cm", view: "{155}{45}", "pgfplots 3d surface": true },
    ranges
  );
  const commands = renderAxis3DTicks({ view: "{155}{45}" }, ranges, geometry);
  const zLabels = commands
    .filter((command) => command.includes("axis tick label"))
    .map((command) => command.match(/\{([^{}]+)\};$/)?.[1])
    .filter(Boolean)
    .slice(-3);

  assert.deepEqual(zLabels, ["-100", "0", "100"]);
});

test("pgfplots compact 3d z ticks use scaled tick labels for small positive ranges", () => {
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: 0.0155, zMax: 0.0175 };
  const geometry = createAxisGeometry(
    { width: "15cm", view: "{65}{65}", "pgfplots 3d surface": true },
    ranges
  );
  const commands = renderAxis3DTicks({ ztick: "{0.016,0.017}" }, ranges, geometry);
  const zLabels = commands
    .filter((command) => command.includes("axis tick label"))
    .map((command) => command.match(/\{([^{}]+)\};$/)?.[1])
    .filter(Boolean)
    .slice(-2);

  assert.deepEqual(zLabels, ["1.6", "1.7"]);
  assert.ok(commands.some((command) => command.includes(String.raw`10^{-2}`)));
});

test("pgfplots 3d scaled z tick multiplier extends beyond the upper tick edge", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 3.5e10 };
  const geometry = {
    width: 10,
    height: 8,
    mapPoint3d: ({ x, y, z }) => ({ x: x + y * 0.2, y: z / 1e10 + y * 0.1 })
  };
  const commands = renderAxis3DTicks({ xtick: "{}", ytick: "{}", ztick: "{0,3.5e10}" }, ranges, geometry);
  const multiplier = commands.find((command) => command.includes("axis tick scale label"));
  const point = multiplier?.match(/at \(([-0-9.]+),([-0-9.]+)\)/);

  assert.ok(point, `expected scaled z multiplier node in ${multiplier}`);
  assert.equal(Number(point[1]), 0, `expected near-zticklabel anchor to stay on the selected z edge, got ${point[1]}`);
  assert.ok(Number(point[2]) > 4.1, `expected multiplier beyond zmax, got ${point[2]}`);
  assert.match(multiplier, /inner sep=0pt, outer sep=0pt/);
  assert.match(multiplier, /\\cdot 10\^\{10\}/);
});

test("pgfplots boxed 3d axes draw unlabeled ticks on opposite frame edges", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = {
    mapPoint3d: ({ x, y, z }) => ({ x: x + y * 0.25, y: z + y * 0.2 })
  };
  const commands = renderAxis3DTicks({ xtick: "{0.5}", ytick: "{0.5}", ztick: "{0.5}" }, ranges, geometry);
  const ticks = commands.filter((command) => command.startsWith(String.raw`\draw[axis tick`));
  const labels = commands.filter((command) => command.includes("axis tick label"));

  assert.equal(ticks.length, 6);
  assert.equal(labels.length, 3);
});

test("pgfplots compact 3d automatic z ticks do not label beyond the z range", () => {
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: 0.01545, zMax: 0.01795 };
  const geometry = createAxisGeometry(
    { width: "15cm", view: "{65}{65}", "pgfplots 3d surface": true },
    ranges
  );
  const commands = renderAxis3DTicks({ view: "{65}{65}" }, ranges, geometry);
  const zLabels = commands
    .filter((command) => command.includes("axis tick label"))
    .map((command) => command.match(/\{([^{}]+)\};$/)?.[1])
    .filter(Boolean)
    .slice(-2);

  assert.deepEqual(zLabels, ["1.6", "1.7"]);
});

test("pgfplots 3d grid and ticks choose view-dependent projected hull edges", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = {
    mapPoint3d: ({ x, y, z }) => ({ x: -100 * x + 10 * y + z, y: -100 * x - 10 * y + z })
  };

  const gridCommands = renderAxis3DGrid(
    { view: "{155}{45}", grid: "major", xtick: "{0}", ytick: "{0}", ztick: "{0}", "axis grid color": "gray!30" },
    ranges,
    geometry
  );

  assert.ok(gridCommands.includes(String.raw`\draw[axis 3d grid, gray!30, line width=0.4pt] (0,0) -- (10,-10);`));
  assert.ok(gridCommands.includes(String.raw`\draw[axis 3d grid, gray!30, line width=0.4pt] (0,0) -- (1,1);`));
  assert.ok(gridCommands.includes(String.raw`\draw[axis 3d grid, gray!30, line width=0.4pt] (0,0) -- (-100,-100);`));

  const tickCommands = renderAxis3DTicks({ xtick: "{0}", ytick: "{0}", ztick: "{0}" }, ranges, geometry);
  assert.ok(tickCommands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (10,-10) -- (9.894,-9.894);`));
  assert.ok(tickCommands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (-100,-100) -- (-99.894,-99.894);`));
  assert.ok(tickCommands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (-100,-100) -- (-99.894,-100.106);`));
});

test("pgfplots 3d annotations share view-aware projected edge normals", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const projections = {
    left: ({ x, z }) => ({ x: -2 * x - z, y: -10 * x + z }),
    right: ({ x, z }) => ({ x: -2 * x - z, y: 10 * x + z })
  };
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const normalize = (vector) => {
    const length = Math.hypot(vector.x, vector.y);
    return length > 1e-9 ? { x: vector.x / length, y: vector.y / length } : null;
  };
  const boxCenter = (mapPoint3d) => {
    const corners = [];
    for (const x of [ranges.xMin, ranges.xMax]) {
      for (const y of [ranges.yMin, ranges.yMax]) {
        for (const z of [ranges.zMin, ranges.zMax]) corners.push(mapPoint3d({ x, y, z }));
      }
    }
    return corners.reduce((center, point) => ({ x: center.x + point.x / corners.length, y: center.y + point.y / corners.length }), { x: 0, y: 0 });
  };
  const zEdgeLayout = (mapPoint3d) => {
    const edge = [
      [ranges.xMin, ranges.yMin],
      [ranges.xMin, ranges.yMax],
      [ranges.xMax, ranges.yMin],
      [ranges.xMax, ranges.yMax]
    ]
      .map(([x, y]) => {
        const from = mapPoint3d({ x, y, z: ranges.zMin });
        const to = mapPoint3d({ x, y, z: ranges.zMax });
        return { from, to, midpoint: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } };
      })
      .reduce((best, candidate) => (candidate.midpoint.x < best.midpoint.x ? candidate : best));
    const tangent = normalize({ x: edge.to.x - edge.from.x, y: edge.to.y - edge.from.y });
    const outward = { x: edge.midpoint.x - boxCenter(mapPoint3d).x, y: edge.midpoint.y - boxCenter(mapPoint3d).y };
    let normal = tangent ? { x: -tangent.y, y: tangent.x } : normalize(outward) || { x: -1, y: 0 };
    if (tangent && dot(normal, outward) < 0) normal = { x: -normal.x, y: -normal.y };
    return { ...edge, normal, anchor: Math.abs(normal.x) >= Math.abs(normal.y) ? (normal.x >= 0 ? "west" : "east") : normal.y >= 0 ? "south" : "north" };
  };
  const parsePoint = (command) => {
    const match = command.match(/at \(([-0-9.]+),([-0-9.]+)\)|-- \(([-0-9.]+),([-0-9.]+)\);$/);
    assert.ok(match, `expected point in ${command}`);
    return { x: Number(match[1] ?? match[3]), y: Number(match[2] ?? match[4]) };
  };
  const parseAnnotations = (mapPoint3d) => {
    const tickCommands = renderAxis3DTicks({ xtick: "{}", ytick: "{}", ztick: "{0}", zlabel: "$z$" }, ranges, { mapPoint3d });
    const labelCommands = renderAxisLabels3D({ zlabel: "$z$" }, ranges, { mapPoint3d });
    const tick = tickCommands.filter((command) => command.startsWith(String.raw`\draw[axis tick`) && command.includes("--")).at(0);
    const tickLabel = tickCommands.filter((command) => command.includes("axis tick label") && command.endsWith("{0};")).at(-1);
    const label = labelCommands.find((command) => command.includes("rotate=90"));
    const tickMatch = tick.match(/\(([-0-9.]+),([-0-9.]+)\) -- \(([-0-9.]+),([-0-9.]+)\);$/);
    assert.ok(tickMatch, `expected z tick endpoints in ${tick}`);
    return {
      baseX: Number(tickMatch[1]),
      baseY: Number(tickMatch[2]),
      tickX: Number(tickMatch[3]),
      tickY: Number(tickMatch[4]),
      tickLabel: parsePoint(tickLabel),
      tickAnchor: tickLabel.match(/anchor=([^,\]]+)/)?.[1],
      label: parsePoint(label),
      labelAnchor: label.match(/anchor=([^,\]]+)/)?.[1]
    };
  };
  const left = parseAnnotations(projections.left);
  const right = parseAnnotations(projections.right);

  for (const [annotations, mapPoint3d] of [[left, projections.left], [right, projections.right]]) {
    const layout = zEdgeLayout(mapPoint3d);
    const tickDistance = dot({ x: annotations.tickX - annotations.baseX, y: annotations.tickY - annotations.baseY }, layout.normal);
    const labelDistance = dot({ x: annotations.tickLabel.x - annotations.baseX, y: annotations.tickLabel.y - annotations.baseY }, layout.normal);
    const axisLabelDistance = dot({ x: annotations.label.x - layout.midpoint.x, y: annotations.label.y - layout.midpoint.y }, layout.normal);
    assert.ok(tickDistance < 0);
    assert.ok(labelDistance > 0, `expected label clearance ${labelDistance} to remain outside the frame`);
    assert.equal(annotations.tickAnchor, layout.anchor);
    assert.ok(axisLabelDistance > 0);
    assert.equal(annotations.labelAnchor, layout.anchor);
  }
});

test("pgfplots 3d annotations handle degenerate projected edges", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const parsePoint = (command) => {
    const match = command.match(/at \(([-0-9.]+),([-0-9.]+)\)/);
    assert.ok(match, `expected node point in ${command}`);
    return { x: Number(match[1]), y: Number(match[2]) };
  };
  const parseZAnnotations = (mapPoint3d) => {
    const commands = renderAxis3DTicks({ xtick: "{}", ytick: "{}", ztick: "{0}" }, ranges, { mapPoint3d });
    const tick = commands.filter((command) => command.startsWith(String.raw`\draw[axis tick`) && command.includes("--")).at(0);
    const label = commands.filter((command) => command.includes("axis tick label") && command.endsWith("{0};")).at(-1);
    const match = tick.match(/\(([-0-9.]+),([-0-9.]+)\) -- \(([-0-9.]+),([-0-9.]+)\);$/);
    assert.ok(match, `expected z tick endpoints in ${tick}`);
    return {
      base: { x: Number(match[1]), y: Number(match[2]) },
      tick: { x: Number(match[3]), y: Number(match[4]) },
      label: parsePoint(label),
      anchor: label.match(/anchor=([^,\]]+)/)?.[1]
    };
  };
  const outward = parseZAnnotations(({ x, y }) => ({ x, y }));
  const collapsed = parseZAnnotations(() => ({ x: 1, y: 2 }));

  assert.ok(Number.isFinite(outward.tick.x) && Number.isFinite(outward.tick.y));
  assert.ok(outward.tick.x > outward.base.x && outward.tick.y > outward.base.y);
  assert.ok(outward.label.x < outward.base.x && outward.label.y < outward.base.y);
  assert.equal(outward.anchor, "east");

  assert.ok(Number.isFinite(collapsed.tick.x) && Number.isFinite(collapsed.tick.y));
  assert.ok(collapsed.tick.x > collapsed.base.x);
  assert.ok(collapsed.label.x < collapsed.base.x);
  assert.equal(collapsed.anchor, "east");
});

test("pgfplots 3d colorbar lowers colormap state to right-side primitives", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: -100, zMax: 100 };
  const geometry = {
    mapPoint3d: ({ x, y, z }) => ({ x: x + y * 0.1, y: (z + 100) / 200 + y * 0.2 })
  };
  const commands = renderAxis3DColorbar(
    {
      colorbar: true,
      "colormap name": "whitered",
      "pgfplots colormaps": {
        whitered: [
          { position: 0, color: "white" },
          { position: 1, color: "orange!75!red" }
        ]
      },
      "colorbar style": "{at={(-0.1,0)}, anchor=south west, height=0.25*\\pgfkeysvalueof{/pgfplots/parent axis height}, title={$f(x,y)$}, ytick={-100,0,100}}"
    },
    ranges,
    geometry
  );

  assert.ok(commands.some((command) => command.includes("axis colorbar") && /fill=rgb\(255\s+250\.[0-9]+\s+247\.03125/.test(command)));
  assert.ok(commands.some((command) => command.includes("axis colorbar") && /fill=rgb\(255\s+100\.[0-9]+\s+7\.96875/.test(command)));
  assert.ok(commands.some((command) => command.includes("axis colorbar frame")));
  assert.ok(commands.some((command) => command.includes("(-0.11,0) -- (0.39,0)")));
  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis colorbar title`) && command.endsWith("{$f(x,y)$};")));
  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis colorbar title`) && !command.includes("font=\\scriptsize")));
  assert.ok(commands.some((command) => command.endsWith("{-100};")));
  assert.ok(commands.some((command) => command.endsWith("{100};")));
});

test("pgfplots 3d colorbar uses scaled tick labels for small positive ranges", () => {
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: 0.0155, zMax: 0.0175 };
  const geometry = createAxisGeometry(
    { width: "15cm", view: "{65}{65}", "pgfplots 3d surface": true },
    ranges
  );
  const commands = renderAxis3DColorbar(
    {
      colorbar: true,
      "colorbar style": "{at={(-0.1,0)}, anchor=south west, title={$f(x,y)$}, ytick={0.016,0.017}}"
    },
    ranges,
    geometry
  );

  assert.ok(commands.some((command) => command.endsWith("{1.6};")));
  assert.ok(commands.some((command) => command.endsWith("{1.7};")));
  assert.ok(commands.some((command) => command.includes(String.raw`10^{-2}`)));
  assert.equal(commands.some((command) => command.endsWith("{0.016};")), false);
});

test("pgfplots 3d colorbar automatic ticks use native-like dense scaled labels", () => {
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: 0.01545, zMax: 0.01795 };
  const geometry = createAxisGeometry(
    { width: "15cm", view: "{65}{65}", "pgfplots 3d surface": true },
    ranges
  );
  const commands = renderAxis3DColorbar(
    {
      colorbar: true,
      "colorbar style": "{at={(-0.1,0)}, anchor=south west, title={$f(x,y)$}}"
    },
    ranges,
    geometry
  );
  const tickLabels = commands
    .filter((command) => command.includes("axis colorbar tick label"))
    .map((command) => command.match(/\{([^{}]+)\};$/)?.[1])
    .filter(Boolean);

  assert.deepEqual(tickLabels, ["1.55", "1.6", "1.65", "1.7", "1.75"]);
  assert.equal(tickLabels.includes("1.8"), false);
});

test("pgfplots short 3d colorbars reduce automatic tick density to their rendered height", () => {
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -125, zMax: 150 };
  const geometry = createAxisGeometry(
    { width: "6cm", view: "{155}{45}", "pgfplots 3d surface": true },
    ranges
  );
  const commands = renderAxis3DColorbar(
    {
      colorbar: true,
      "colorbar style": "{height=0.25*\\pgfkeysvalueof{/pgfplots/parent axis height}}"
    },
    ranges,
    geometry
  );
  const tickLabels = commands.filter((command) => command.includes("axis colorbar tick label"));

  assert.equal(tickLabels.length, 3);
  assert.ok(tickLabels.some((command) => command.endsWith("{-100};")));
  assert.ok(tickLabels.some((command) => command.endsWith("{0};")));
  assert.ok(tickLabels.some((command) => command.endsWith("{100};")));
});

test("pgfplots tall quarter-height colorbars keep native five-tick density", () => {
  const ranges = { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -0.5, zMax: 0.5 };
  const geometry = createAxisGeometry(
    { width: "15cm", view: "{335}{50}", "pgfplots 3d surface": true },
    ranges
  );
  const commands = renderAxis3DColorbar(
    {
      colorbar: true,
      "colorbar style": "{height=0.25*\\pgfkeysvalueof{/pgfplots/parent axis height}}"
    },
    ranges,
    geometry
  );
  const tickLabels = commands
    .filter((command) => command.includes("axis colorbar tick label"))
    .map((command) => command.match(/\{([^{}]+)\};$/)?.[1])
    .filter(Boolean);

  assert.deepEqual(tickLabels, ["-0.4", "-0.2", "0", "0.2", "0.4"]);
});

test("pgfplots colorbar keeps rounded endpoints just outside sampled surface extrema", () => {
  const ranges = { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -3.99737, zMax: 3.99737 };
  const geometry = createAxisGeometry(
    { width: "15cm", view: "{340}{25}", "pgfplots 3d surface": true },
    ranges
  );
  const commands = renderAxis3DColorbar(
    {
      colorbar: true,
      "colorbar style": "{height=0.25*\\pgfkeysvalueof{/pgfplots/parent axis height}}"
    },
    ranges,
    geometry
  );
  const tickLabels = commands
    .filter((command) => command.includes("axis colorbar tick label"))
    .map((command) => command.match(/\{([^{}]+)\};$/)?.[1])
    .filter(Boolean);

  assert.deepEqual(tickLabels, ["-4", "-2", "0", "2", "4"]);
});

test("pgfplots labels inherit the enclosing uniform tikz picture scale", () => {
  const source = String.raw`\begin{tikzpicture}[scale=0.5]
\begin{axis}[xmin=-1,xmax=1,ymin=-1,ymax=1,xlabel={$x$}]
\addplot {x};
\end{axis}
\end{tikzpicture}`;
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });

  assert.equal(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length, 0);
  assert.match(result.svg, /font-size="17\.57[0-9]+"/);
  assert.doesNotMatch(result.svg, /font-size="35\.14598"/);
  assert.match(result.svg, /stroke-width="0\.702919607/);
});

test("pgfplots picture scale transforms 3D surface geometry exactly once", () => {
  const axis = String.raw`\begin{axis}[width=6cm,view={155}{45},domain=-5:5,y domain=-5:5,samples=9]
\addplot3[surf] {y*y-x*x*x};
\end{axis}`;
  const render = (pictureOptions = "") => tikzToSvg(
    String.raw`\begin{tikzpicture}${pictureOptions}
${axis}
\end{tikzpicture}`,
    { margin: 0, mathRenderer: "svg-text" }
  );
  const frameBounds = (result) => {
    const frame = result.ir.items.find((item) => item.subtype === "axis-frame");
    assert.ok(frame, "expected lowered 3D axis bounds");
    const points = frame.commands.filter((command) => Number.isFinite(command.x) && Number.isFinite(command.y));
    return {
      minX: Math.min(...points.map((point) => point.x)),
      maxX: Math.max(...points.map((point) => point.x)),
      minY: Math.min(...points.map((point) => point.y)),
      maxY: Math.max(...points.map((point) => point.y))
    };
  };

  const base = frameBounds(render());
  const scaled = frameBounds(render("[scale=0.5]"));

  assert.equal(scaled.minX, base.minX * 0.5);
  assert.equal(scaled.maxX, base.maxX * 0.5);
  assert.equal(scaled.minY, base.minY * 0.5);
  assert.equal(scaled.maxY, base.maxY * 0.5);
});

test("pgfplots transform, ticks, and grid are isolated semantics", () => {
  const ranges = { xMin: 0, xMax: 10, yMin: -1, yMax: 1 };
  const transform = createDataToCanvasTransform({
    ranges,
    geometry: { origin: { x: 1, y: 2 }, width: 20, height: 10 }
  });

  assert.deepEqual(transformDataToCanvas({ x: 5, y: 0 }, transform), { x: 11, y: 7 });
  assert.deepEqual(createAxisTickModel({ "xtick distance": 5 }, ranges).x.values, [0, 5, 10]);
  assert.equal(createAxisGridModel({ "y grid": true }).y, true);
});

test("pgfplots data, relative, and direction coordinates honor reversed axes", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const transform = createDataToCanvasTransform({
    ranges,
    geometry: { origin: { x: 1, y: 2 }, width: 20, height: 10 },
    axisOptions: { "x dir": "reverse", "y dir": "reverse" }
  });

  assert.deepEqual(transform.mapPoint({ x: 0, y: 0 }), { x: 21, y: 12 });
  assert.deepEqual(transform.mapPoint({ x: 2, y: 1 }), { x: 1, y: 2 });

  const geometry = createAxisGeometry(
    { "scale only axis": true, width: "2cm", height: "1cm", "x dir": "reverse", "y dir": "reverse" },
    ranges
  );
  assert.deepEqual(
    renderAxisOverlayStatements(
      String.raw`\node at (rel axis cs:0,.25) {relative};
\node at (axis description cs:0,.25) {description};
\draw (axis cs:0,0) -- ++(axis direction cs:1,.5);`,
      ranges,
      geometry
    ),
    [
      String.raw`\node at (0,0.25) {relative};`,
      String.raw`\node at (0,0.25) {description};`,
      String.raw`\draw (2,1) -- ++(-1,-0.5);`
    ]
  );

  const noRelativeReversal = createAxisGeometry(
    {
      "scale only axis": true,
      width: "2cm",
      height: "1cm",
      "x dir": "reverse",
      "y dir": "reverse",
      "allow reversal of rel axis cs": "false"
    },
    ranges
  );
  assert.deepEqual(
    renderAxisOverlayStatements(
      String.raw`\node at (rel axis cs:0,.25) {relative};
\node at (normalized axis cs:0,.25) {normalized};`,
      ranges,
      noRelativeReversal
    ),
    [
      String.raw`\node at (2,0.75) {relative};`,
      String.raw`\node at (2,0.75) {normalized};`
    ]
  );
});

test("pgfplots grid lowering emits TikZ draw primitives from axis geometry", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "1cm" }, ranges);
  const commands = renderAxisGrid({ grid: "major", "axis grid color": "gray!30" }, [], ranges, geometry);

  assert.deepEqual(commands, [
    String.raw`\draw[axis grid, gray!30, line width=0.4pt] (0,0) -- (0,1);`,
    String.raw`\draw[axis grid, gray!30, line width=0.4pt] (1,0) -- (1,1);`,
    String.raw`\draw[axis grid, gray!30, line width=0.4pt] (2,0) -- (2,1);`,
    String.raw`\draw[axis grid, gray!30, line width=0.4pt] (0,0) -- (2,0);`,
    String.raw`\draw[axis grid, gray!30, line width=0.4pt] (0,1) -- (2,1);`
  ]);
});

test("pgfplots default major grid style follows TeX Live every axis grid", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const twoDimensionalGeometry = createAxisGeometry({ "scale only axis": true, width: "1cm", height: "1cm" }, ranges);
  const threeDimensionalGeometry = {
    mapPoint3d: ({ x, y, z }) => ({ x: x + y, y: z })
  };

  assert.equal(
    renderAxisGrid({ grid: "major", xtick: "{0}", ytick: "{}" }, [], ranges, twoDimensionalGeometry)[0],
    String.raw`\draw[axis grid, black!25, line width=0.4pt] (0,0) -- (0,1);`
  );
  assert.equal(
    renderAxis3DGrid({ grid: "major", xtick: "{0}", ytick: "{}", ztick: "{}" }, ranges, threeDimensionalGeometry)[0],
    String.raw`\draw[axis 3d grid, black!25, line width=0.4pt] (0,0) -- (1,0);`
  );
});

test("pgfplots wide major grid follows axis major tick spacing instead of dense integer grid", () => {
  const ranges = { xMin: 0, xMax: 104, yMin: 0, yMax: 0.98 };
  const axisOptions = { grid: "major", "axis lines": "middle", width: "14cm", height: "8cm" };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const gridCommands = renderAxisGrid(axisOptions, [], ranges, geometry);
  const tickCommands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const tickLabels = tickCommands
    .filter((command) => command.includes("axis tick label"))
    .map((command) => command.match(/\{([^{}]+)\};$/)?.[1])
    .filter(Boolean);

  assert.ok(gridCommands.length <= 18, `expected major-grid count near native tick count, got ${gridCommands.length}`);
  assert.ok(!gridCommands.some((command) => command.includes("(0.354,0)")), "major grid should not use dense 3-unit spacing");
  assert.ok(tickLabels.includes("10"), `expected native-like 10-unit x tick label, got ${tickLabels.join(",")}`);
});

test("pgfplots axis line lowering emits bounds, box, middle lines, and clean axes", () => {
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "2cm" }, ranges);

  assert.equal(
    renderAxisBounds(geometry),
    String.raw`\draw[axis bounds, draw=none, fill=none] (-0.3,-0.32) -- (2.207,-0.32) -- (2.207,2.225) -- (-0.3,2.225) -- cycle;`
  );
  assert.equal(
    renderAxisBox({ "axis lines": "box", "axis frame color": "gray" }, geometry),
    String.raw`\draw[axis frame, gray, line width=0.35pt] (0,0) -- (2,0) -- (2,2) -- (0,2) -- cycle;`
  );
  assert.deepEqual(renderAxisLines({ "axis lines": "middle" }, ranges, geometry), [
    String.raw`\draw[axis line, black, line width=0.4pt, -stealth] (0,1) -- (2,1);`,
    String.raw`\draw[axis line, black, line width=0.4pt, -stealth] (1,0) -- (1,2);`
  ]);
  assert.deepEqual(renderDatavisualizationCleanAxes({ "datavis clean padding": "0.1cm" }, ranges, geometry), [
    String.raw`\draw[axis clean line, black!50, line width=0.12pt] (0,-0.1) -- (2,-0.1);`,
    String.raw`\draw[axis clean line, black!50, line width=0.12pt] (-0.1,0) -- (-0.1,2);`,
    String.raw`\draw[axis clean boundary, black!25, line width=0.12pt, line cap=rect] (0,0) -- (2,0);`,
    String.raw`\draw[axis clean boundary, black!25, line width=0.12pt, line cap=rect] (0,2) -- (2,2);`,
    String.raw`\draw[axis clean boundary, black!25, line width=0.12pt, line cap=rect] (0,0) -- (0,2);`,
    String.raw`\draw[axis clean boundary, black!25, line width=0.12pt, line cap=rect] (2,0) -- (2,2);`
  ]);
});

test("pgfplots axis lines apply accumulating global and axis-specific styles", () => {
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const geometry = {
    lineRanges: ranges,
    mapPoint: ({ x, y }) => ({ x, y })
  };

  assert.deepEqual(
    renderAxisLines(
      {
        "axis lines": "middle",
        "axis line style": [String.raw`very thick,shorten <=-0.5\pgflinewidth`, "very thick"],
        "x axis line style": "red",
        "y axis line style": "blue"
      },
      ranges,
      geometry
    ),
    [
      String.raw`\draw[axis line, black, line width=0.4pt, very thick,shorten <=-0.5\pgflinewidth, very thick, red, -stealth] (-1,0) -- (1,0);`,
      String.raw`\draw[axis line, black, line width=0.4pt, very thick,shorten <=-0.5\pgflinewidth, very thick, blue, -stealth] (0,-1) -- (0,1);`
    ]
  );
});

test("pgfplots non-boxed axis lines use native open-axis height reservation", () => {
  const geometry = createAxisGeometry(
    { "axis lines": "left", width: "8cm", height: "7cm" },
    { xMin: 0, xMax: 2, yMin: 0, yMax: 5 }
  );

  assert.ok(Math.abs(geometry.height - (7 - parseDimension("45pt", {}))) < 1e-9);
});

test("pgfplots explicit middle axes without enlargelimits use native 45pt plot-box reserve", () => {
  const geometry = createAxisGeometry(
    { "axis x line": "middle", "axis y line": "middle", width: "14cm", height: "8cm" },
    { xMin: 5, xMax: 100, yMin: 0, yMax: 350 }
  );
  const expectedReserve = parseDimension("45pt", {});

  assert.ok(Math.abs(geometry.width - (14 - expectedReserve)) < 0.02, `expected width near native 45pt reserve, got ${geometry.width}cm`);
  assert.ok(Math.abs(geometry.height - (8 - expectedReserve)) < 0.02, `expected height near native 45pt reserve, got ${geometry.height}cm`);
});

test("pgfplots default boxed axis does not inflate the SVG bbox beyond tikztosvg baseline", () => {
  const source = String.raw`\documentclass[tikz]{standalone}
\usepackage{pgfplots}
\pgfplotsset{compat=newest}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=5,ymin=0,ymax=5]
    \addplot[mark=none] coordinates {(0,2) (5,2)};
  \end{axis}
\end{tikzpicture}
\end{document}`;
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 211.5 && size.width <= 212.3, `expected width close to tikztosvg 211.9pt, got ${size.width}pt`);
  assert.ok(size.height >= 180.8 && size.height <= 181.6, `expected height close to tikztosvg 181.18pt, got ${size.height}pt`);
});

test("pgfplots default middle axes preserve tikztosvg plot-area scale", () => {
  const geometry = createAxisGeometry(
    { "axis x line": "middle", "axis y line": "middle" },
    { xMin: -2, xMax: 2, yMin: -2, yMax: 2 }
  );

  assert.ok(geometry.width >= 6.8 && geometry.width <= 6.86, `expected native plot width near 6.83cm, got ${geometry.width}cm`);
  assert.ok(geometry.height >= 5.64 && geometry.height <= 5.7, `expected native plot height near 5.67cm, got ${geometry.height}cm`);
});

test("pgfplots fixture axis-middle-lines keeps native bbox close to tikztosvg", () => {
  const source = readFileSync("test/fixtures/examples/pgfplots/axis-middle-lines.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 209.3 && size.width <= 210.2, `expected width close to tikztosvg 209.76pt, got ${size.width}pt`);
  assert.ok(size.height >= 174.4 && size.height <= 175.3, `expected height close to tikztosvg 174.87pt, got ${size.height}pt`);
});

test("pgfplots compact non-enlarged middle axes use integer tick density", () => {
  const source = readFileSync("test/fixtures/examples/pgfplots/axis-middle-lines.tex", "utf8");
  let observed = null;
  expandPgfplotsAxes(source, [], {}, {}, (axisOptions, body, options) => {
    const addplots = parseAddplots(body, options, []);
    const ranges = computeAxisRanges(axisOptions, addplots);
    const geometry = createAxisGeometry(axisOptions, ranges);
    const commands = renderAxisTicks(axisOptions, addplots, ranges, geometry);
    observed = {
      xLabels: commands
        .filter((command) => command.includes("axis tick label, anchor=north"))
        .map((command) => command.match(/\{([^{}]*)\};$/)?.[1])
        .filter(Boolean),
      yLabels: commands
        .filter((command) => command.includes("axis tick label, anchor=east"))
        .map((command) => command.match(/\{([^{}]*)\};$/)?.[1])
        .filter(Boolean)
    };
    return "";
  });

  assert.deepEqual(observed, {
    xLabels: ["−2", "−1", "1", "2"],
    yLabels: ["−2", "−1", "1", "2"]
  });
});

test("pgfplots compact middle x tick count floor requires an enlarged x transform", () => {
  const axisOptions = { "axis x line": "middle", "axis y line": "middle" };
  const unchangedGeometry = {
    width: 5.5,
    transformRanges: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 }
  };
  const enlargedGeometry = {
    ...unchangedGeometry,
    transformRanges: { xMin: -2.4, xMax: 2.4, yMin: -2, yMax: 2 }
  };
  const roundoffOnlyGeometry = {
    ...unchangedGeometry,
    transformRanges: { xMin: -2 - 1e-12, xMax: 2 + 1e-12, yMin: -2, yMax: 2 }
  };

  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", -2, 2, unchangedGeometry, 7), 5);
  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", -2, 2, roundoffOnlyGeometry, 7), 5);
  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", -2, 2, enlargedGeometry, 7), 7);
});

test("pgfplots compact middle x tick floor never activates for a zero raw span", () => {
  const axisOptions = { "axis x line": "middle", "axis y line": "middle" };
  const geometry = {
    width: 5.5,
    transformRanges: { xMin: 1.9, xMax: 2.1, yMin: -2, yMax: 2 }
  };

  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", 2, 2, geometry, 7), 5);
});

test("pgfplots compact middle x enlargement detection uses the span-relative tolerance boundary", () => {
  const axisOptions = { "axis x line": "middle", "axis y line": "middle" };
  const belowToleranceGeometry = {
    width: 5.5,
    transformRanges: { xMin: -3.9e-6, xMax: 4, yMin: -2, yMax: 2 }
  };
  const aboveToleranceGeometry = {
    width: 5.5,
    transformRanges: { xMin: -4.1e-6, xMax: 4, yMin: -2, yMax: 2 }
  };

  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", 0, 4, belowToleranceGeometry, 7), 5);
  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", 0, 4, aboveToleranceGeometry, 7), 7);
});

test("pgfplots compact middle x enlargement detection accepts either expanded endpoint", () => {
  const axisOptions = { "axis x line": "middle", "axis y line": "middle" };
  const lowerOnlyGeometry = {
    width: 5.5,
    transformRanges: { xMin: -0.4, xMax: 4, yMin: -2, yMax: 2 }
  };
  const upperOnlyGeometry = {
    width: 5.5,
    transformRanges: { xMin: 0, xMax: 4.4, yMin: -2, yMax: 2 }
  };

  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", 0, 4, lowerOnlyGeometry, 7), 7);
  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", 0, 4, upperOnlyGeometry, 7), 7);
});

test("pgfplots compact middle x enlargement detection is independent of coordinate origin", () => {
  const axisOptions = { "axis x line": "middle", "axis y line": "middle" };
  const rawMin = 1e9;
  const rawMax = rawMin + 4;
  const ulpNoise = Number.EPSILON * rawMax * 2;
  const genuinelyEnlargedGeometry = {
    width: 5.5,
    transformRanges: { xMin: rawMin - 0.4, xMax: rawMax + 0.4 }
  };
  const roundoffOnlyGeometry = {
    width: 5.5,
    transformRanges: { xMin: rawMin - ulpNoise, xMax: rawMax + ulpNoise }
  };

  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", rawMin, rawMax, genuinelyEnlargedGeometry, 7), 7);
  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", rawMin, rawMax, roundoffOnlyGeometry, 7), 5);
});

test("pgfplots compact middle x enlargement detection follows tiny interval span", () => {
  const axisOptions = { "axis x line": "middle", "axis y line": "middle" };
  const rawMin = 0;
  const rawMax = 1e-15;
  const geometry = {
    width: 5.5,
    transformRanges: { xMin: -1e-16, xMax: 1.1e-15 }
  };

  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", rawMin, rawMax, geometry, 7), 7);
});

test("pgfplots compact middle x enlargement detection ignores a large coordinate origin", () => {
  const axisOptions = { "axis x line": "middle", "axis y line": "middle" };
  const rawMin = 1e15;
  const rawMax = rawMin + 4;
  const geometry = {
    width: 5.5,
    transformRanges: { xMin: rawMin - 0.4, xMax: rawMax + 0.4 }
  };

  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", rawMin, rawMax, geometry, 7), 7);
});

test("pgfplots y-only enlargement does not activate the compact middle x tick floor", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    "enlarge y limits": "true"
  };
  const geometry = {
    width: 5.5,
    transformRanges: { xMin: -2, xMax: 2, yMin: -2.4, yMax: 2.4 }
  };

  assert.equal(axisAutoMajorTickCountForOptions(axisOptions, "x", -2, 2, geometry, 7), 5);
});

test("pgfplots compact middle major grid follows corrected automatic tick density", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    grid: "major",
    xmin: "-2",
    xmax: "2",
    ymin: "-2",
    ymax: "2"
  };
  const ranges = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const tickCommands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const gridCommands = renderAxisGrid(axisOptions, [], ranges, geometry);
  const xLabelValues = tickCommands
    .filter((command) => command.includes("axis tick label, anchor=north"))
    .map((command) => command.match(/\{([^{}]*)\};$/)?.[1])
    .filter(Boolean);
  const expectedXGridCoordinates = [-2, -1, 1, 2].map((x) => testNumber(geometry.mapPoint({ x, y: 0 }).x));
  const xGridCoordinates = gridCommands
    .filter((command) => command.endsWith(`,${testNumber(geometry.height)});`))
    .map((command) => command.match(/\] \(([^,]+),0\) --/)?.[1])
    .filter(Boolean);

  assert.deepEqual(xLabelValues, ["−2", "−1", "1", "2"]);
  assert.deepEqual(xGridCoordinates, expectedXGridCoordinates);
});

test("pgfplots hides explicit ticks obscured by crossing middle axes unless disabled", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    xmin: "0",
    xmax: "24",
    ymin: "0",
    ymax: "24",
    xtick: "{0,2,...,24}",
    ytick: "{0,2,...,24}",
    "tick align": "outside"
  };
  const ranges = { xMin: 0, xMax: 24, yMin: 0, yMax: 24 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const xLabels = commands.filter((command) => command.includes("axis tick label, anchor=north"));
  const yLabels = commands.filter((command) => command.includes("axis tick label, anchor=east"));

  assert.equal(xLabels.some((command) => /\{0\};$/.test(command)), false);
  assert.equal(yLabels.some((command) => /\{0\};$/.test(command)), false);
  assert.equal(xLabels.some((command) => /\{2\};$/.test(command)), true);
  assert.equal(yLabels.some((command) => /\{2\};$/.test(command)), true);

  const framedGeometry = createAxisGeometry(
    { ...axisOptions, width: "8cm", height: "8cm", enlargelimits: "false" },
    ranges
  );
  assert.ok(
    framedGeometry.margin.left >= 0.73 && framedGeometry.margin.left <= 0.75,
    `expected the left frame reserve to follow the widest two-digit y tick, got ${framedGeometry.margin.left}cm`
  );
  assert.ok(
    framedGeometry.margin.right >= 0.28 && framedGeometry.margin.right <= 0.3,
    `expected the right frame reserve to follow the final x tick label, got ${framedGeometry.margin.right}cm`
  );

  const visibleOptions = {
    ...axisOptions,
    "hide obscured x ticks": "false",
    "hide obscured y ticks": "false"
  };
  const visibleCommands = renderAxisTicks(visibleOptions, [], ranges, createAxisGeometry(visibleOptions, ranges));
  assert.equal(visibleCommands.filter((command) => command.includes("axis tick label, anchor=north")).some((command) => /\{0\};$/.test(command)), true);
  assert.equal(visibleCommands.filter((command) => command.includes("axis tick label, anchor=east")).some((command) => /\{0\};$/.test(command)), true);
});

test("pgfplots dst-start fixture matches native boundary ticks and document width", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/dst-start.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);
  const tickLabels = result.ir.items
    .filter((item) => item.type === "textNode" && /^\d+$/.test(String(item.text || "")))
    .map((item) => String(item.text || ""));

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 210.8 && size.width <= 211.5, `expected width close to tikztosvg 211.29pt, got ${size.width}pt`);
  assert.ok(size.height >= 204.8 && size.height <= 206.2, `expected height close to tikztosvg 205.98pt, got ${size.height}pt`);
  assert.equal(tickLabels.includes("0"), false, "crossing axes should obscure the explicit origin ticks");
  assert.ok(tickLabels.includes("2") && tickLabels.includes("24"), `expected visible 2..24 tick labels, got ${tickLabels.join(",")}`);
});

test("pgfplots automatic major ticks honor the native 35pt maximum spacing", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    grid: "major",
    width: "11.5cm",
    height: "6.5cm",
    xmin: "-105.5",
    xmax: "105.5",
    ymin: "-120.5",
    ymax: "105.5"
  };
  const ranges = { xMin: -105.5, xMax: 105.5, yMin: -120.5, yMax: 105.5 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const tickCommands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const xLabelValues = tickCommands
    .filter((command) => command.includes("axis tick label, anchor=north"))
    .map((command) => command.match(/\{([^{}]*)\};$/)?.[1])
    .filter(Boolean);

  assert.deepEqual(xLabelValues, ["−100", "−80", "−60", "−40", "−20", "20", "40", "60", "80", "100"]);
});

test("pgfplots split middle axes keep native default bbox close to tikztosvg", () => {
  const source = String.raw`\documentclass[varwidth=true, border=2pt]{standalone}
\usepackage{pgfplots}
\usepackage{tikz}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[
    axis x line=middle,
    axis y line=middle,
    grid=major,
    grid style={dashed, gray!30},
    xmin=-1,
    xmax=6,
    ymin=-0.25,
    ymax=2.25,
    xlabel=$x$,
    ylabel=$y$,
    tick align=outside,
    minor tick num=-3,
    enlargelimits=true]
    \addplot[domain=0:1, red, thick,samples=20] {0.5*x*x};
    \addplot[domain=1:2, green, thick,samples=20] {x-0.5};
    \addplot[domain=2:3, blue, thick,samples=100] {-0.5*(x-2)*(x-2)+x-0.5};
    \addplot[domain=3:5, purple, thick,samples=20] {5-x};
    \addplot[domain=5:7, orange, thick,samples=3] {0};
    \addplot[domain=-3:0, orange, thick,samples=3] {0};
  \end{axis}
\end{tikzpicture}
\end{document}`;
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 194.0 && size.width <= 195.6, `expected width close to tikztosvg 194.68pt, got ${size.width}pt`);
  assert.ok(size.height >= 161.4 && size.height <= 162.2, `expected height close to tikztosvg 161.79pt, got ${size.height}pt`);
});

test("pgfplots explicit middle-axis width keeps chi-squared corpus bbox near tikztosvg", () => {
  const source = readFileSync("test/fixtures/implementation-examples/latex-examples-master/2d-chi-squared-pdf.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 408.6 && size.width <= 410.3, `expected width close to tikztosvg 409.11pt, got ${size.width}pt`);
  assert.ok(size.height >= 233.7 && size.height <= 234.8, `expected height close to tikztosvg 234.24pt, got ${size.height}pt`);
});

test("pgfplots explicit enlarged middle axes preserve the native 45pt inner plot reserve", () => {
  const geometry = createAxisGeometry(
    {
      width: "16cm",
      height: "9cm",
      "axis x line": "middle",
      "axis y line": "middle",
      enlargelimits: "true"
    },
    { xMin: -0.8, xMax: 8.8, yMin: -0.1, yMax: 1.1 }
  );
  const reserve = parseDimension("45pt", {});
  const margin = parseDimension("0.2pt", {});

  assert.ok(Math.abs(geometry.width - (16 - reserve)) < 1e-9);
  assert.ok(Math.abs(geometry.height - (9 - reserve)) < 1e-9);
  assert.deepEqual(geometry.margin, { left: margin, right: margin, top: margin, bottom: margin });
});

test("pgfplots restricted zero-bound middle axes transfer enlarge space to the free side", () => {
  const geometry = createAxisGeometry(
    {
      width: "16cm",
      height: "9cm",
      "axis x line": "middle",
      "axis y line": "middle",
      enlargelimits: "true",
      domain: "0.01:8",
      "restrict y to domain": "0:0.5"
    },
    { xMin: 0, xMax: 8, yMin: 0, yMax: 0.5 }
  );

  assert.deepEqual(geometry.transformRanges, {
    xMin: -0.789,
    xMax: 8.799,
    yMin: 0,
    yMax: 0.6,
    zMin: 0,
    zMax: 1
  });
});

test("pgfplots enlarged restricted middle axes choose chi-squared unit ticks from the transform range", () => {
  const axisOptions = {
    width: "16cm",
    height: "9cm",
    "axis x line": "middle",
    "axis y line": "middle",
    enlargelimits: "true",
    domain: "0.01:8",
    "restrict y to domain": "0:0.5"
  };
  const ranges = { xMin: 0, xMax: 8, yMin: 0, yMax: 0.5 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const labels = renderAxisTicks(axisOptions, [], ranges, geometry)
    .filter((command) => command.includes("axis tick label") && command.includes("anchor=north"));

  assert.ok(labels.some((command) => command.endsWith("{1};")), labels.join("\n"));
  assert.ok(labels.some((command) => command.endsWith("{8};")), labels.join("\n"));
  assert.ok(!labels.some((command) => command.endsWith("{0.5};")), labels.join("\n"));
});

test("pgfplots restricted zero-bound middle y axis preserves the native lower paint extent", () => {
  const axisOptions = {
    width: "16cm",
    height: "9cm",
    "axis x line": "middle",
    "axis y line": "middle",
    enlargelimits: "true",
    domain: "0.01:8",
    "restrict y to domain": "0:0.5"
  };
  const ranges = { xMin: 0, xMax: 8, yMin: 0, yMax: 0.5 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const lines = renderAxisLines(axisOptions, ranges, geometry);

  assert.ok(lines.some((line) => line.includes("(1.186,-0.824) -- (1.186,7.425)")), lines.join("\n"));
});

test("pgfplots light bulb fixture keeps legend text bounds close to tikztosvg", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/2d-light-bulb.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 397.2 && size.width <= 398.5, `expected width close to tikztosvg 397.81pt, got ${size.width}pt`);
  assert.ok(size.height >= 205.4 && size.height <= 206.6, `expected height close to tikztosvg 205.98pt, got ${size.height}pt`);
});

test("pgfplots plain text axis labels use native CMU width for layout and SVG rendering", () => {
  const axisOptions = {
    width: "14cm",
    height: "8cm",
    "axis x line": "middle",
    "axis y line": "middle",
    xlabel: "Energy savings",
    ylabel: String.raw`Amortization time\\in h`,
    "y label style": "at={(-0.1,1.0)}"
  };
  const ranges = { xMin: 5, xMax: 100, yMin: 0, yMax: 350 };
  const commands = renderAxisLabels(axisOptions, ranges, createAxisGeometry(axisOptions, ranges));

  assert.ok(commands[0].includes("tikzkit anchor text width scale=1.06, tikzkit text width scale=1.06"));
  assert.ok(commands[1].includes("tikzkit anchor text width scale=1.06, tikzkit text width scale=1.06"));
});

test("pgfplots activation-functions fixture keeps explicit middle-axis bbox close to tikztosvg", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/activation-functions.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 431.3 && size.width <= 432.6, `expected width close to tikztosvg 431.95pt, got ${size.width}pt`);
  assert.ok(size.height >= 194.8 && size.height <= 196.1, `expected height close to tikztosvg 195.41pt, got ${size.height}pt`);
});

test("pgfplots linear-functions omits unused middle-axis boundary reserves", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/linear-functions.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 181.7 && size.width <= 183.1, `expected width close to tikztosvg 182.33pt, got ${size.width}pt`);
  assert.ok(size.height >= 181.7 && size.height <= 183.1, `expected height close to tikztosvg 182.34pt, got ${size.height}pt`);
});

test("pgfplots activation-functions keeps x and y labels attached to middle-axis tips", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/activation-functions.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");
  const xLabel = textNodes.find((item) => item.text === "x");
  const yLabel = textNodes.find((item) => item.text === "y");

  assert.ok(xLabel, "expected xlabel node");
  assert.ok(yLabel, "expected ylabel node");
  assert.equal(xLabel.font?.sizePt, 10);
  assert.equal(yLabel.font?.sizePt, 10);
  assert.equal(xLabel.font?.family, "serif");
  assert.equal(yLabel.font?.family, "serif");
  assert.equal(xLabel.style?.textWidthScale, 1.06);
  assert.equal(yLabel.style?.textWidthScale, 1.06);
  assert.equal(xLabel.style?.textWidthScaleExplicit, true);
  assert.equal(yLabel.style?.textWidthScaleExplicit, true);
  assert.match(result.svg, /<text[^>]*>x<\/text>/);
  assert.match(result.svg, /<text[^>]*>y<\/text>/);
  assert.ok(xLabel.x >= 14.28 && xLabel.x <= 14.30, `expected xlabel beside the right axis tip, got x=${xLabel.x}`);
  assert.ok(xLabel.y >= 2.32 && xLabel.y <= 2.34, `expected xlabel above the horizontal axis, got y=${xLabel.y}`);
  assert.ok(yLabel.x >= 7.41 && yLabel.x <= 7.43, `expected ylabel right of the vertical axis, got x=${yLabel.x}`);
  assert.ok(yLabel.y >= 6.278 && yLabel.y <= 6.29, `expected ylabel below the top axis tip, got y=${yLabel.y}`);
});

test("pgfplots activation-functions preserves the left edge of every legend formula in final IR and SVG", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/activation-functions.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0 });
  const rows = result.ir.items.filter(
    (item) => item.type === "textNode" && /\\varphi_[1-5]/.test(String(item.text || ""))
  );

  assert.equal(rows.length, 5);
  assert.ok(rows.every((row) => row.svgTextAnchor === "start"));
  assert.ok(rows.every((row) => Math.abs(row.svgTextX - rows[0].svgTextX) < 1e-9));

  const foreignObjectXs = [...result.svg.matchAll(
    /<foreignObject\b[^>]*\bx="([0-9.]+)"[^>]*>[\s\S]*?<div\b[^>]*class="tikz-math"/g
  )].map((match) => Number(match[1]));
  const legendXs = foreignObjectXs.slice(-5);
  assert.equal(legendXs.length, 5);
  assert.ok(legendXs.every((x) => Math.abs(x - legendXs[0]) < 1e-9));
});

test("pgfplots bias-variance keeps plain legend rows left aligned in final IR", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/bias-variance.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0 });
  const rows = result.ir.items.filter(
    (item) => item.type === "textNode" && ["training error", "validation"].includes(String(item.text || ""))
  );

  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.svgTextAnchor === "start"));
  assert.ok(rows.every((row) => Math.abs(row.svgTextX - rows[0].svgTextX) < 1e-9));
});

test("pgfplots trigonometric middle-axis bbox stays tight when y tick labels do not touch bounds", () => {
  const source = String.raw`\documentclass[varwidth=false, border=2pt]{standalone}
\usepackage{pgfplots}
\usepackage{tikz}
\begin{document}
\begin{tikzpicture}
  \begin{axis}[
    axis x line=middle,
    axis y line=middle,
    grid=major,
    width=16cm,
    height=8cm,
    grid style={dashed, gray!30},
    xmin=0,
    xmax=7,
    ymin=-1.1,
    ymax=1.1,
    xlabel=$x$,
    ylabel=$y$,
    xtick={0,pi/2,pi,1.5*pi,2*pi},
    xticklabels={0,$\frac{\pi}{2}$,$\pi$,$\frac{3 \cdot \pi}{2}$,$2 \pi$},
    legend cell align=left,
    legend pos=south east,
    legend style={draw=none},
    tick align=outside,
    enlargelimits=false]
    \addplot[domain=0:7, red, ultra thick,samples=200] {sin(deg(x))};
    \addplot[domain=0:7, blue, ultra thick,dotted,samples=200] {cos(deg(x))};
    \legend{$\sin(x)$, $\cos(x)$}
  \end{axis}
\end{tikzpicture}
\end{document}`;
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 439.7 && size.width <= 441.2, `expected width close to tikztosvg 440.48pt, got ${size.width}pt`);
  assert.ok(size.height >= 181.6 && size.height <= 183.1, `expected height close to tikztosvg 182.34pt, got ${size.height}pt`);
});

test("pgfplots middle y auto ticks stay sparse for short positive ranges", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    grid: "major",
    "grid style": "dashed, gray!30",
    xmin: "-1",
    xmax: "6",
    ymin: "-0.25",
    ymax: "2.25",
    xlabel: "$x$",
    ylabel: "$y$",
    "tick align": "outside",
    "minor tick num": "-3",
    enlargelimits: "true"
  };
  const ranges = { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const yLabels = commands
    .filter((command) => command.includes("axis tick label, anchor=east"))
    .map((command) => command.match(/\{([^{}]*)\};$/)?.[1])
    .filter(Boolean);
  const gridCommands = renderAxisGrid(axisOptions, [], ranges, geometry);
  const yGridLines = gridCommands.filter((command) => command.includes("] (0,") && command.includes(`-- (${testNumber(geometry.width)},`));
  const originY = testNumber(geometry.mapPoint({ x: 0, y: 0 }).y);

  assert.deepEqual(yLabels, ["1", "2"]);
  assert.equal(yGridLines.length, 2);
  assert.ok(!gridCommands.includes(String.raw`\draw[axis grid, black!25, line width=0.4pt, dashed, gray!30] (0,${originY}) -- (${testNumber(geometry.width)},${originY});`));
});

test("pgfplots middle y auto ticks keep fractional density for restricted pdf ranges", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    grid: "major",
    "grid style": "dashed, gray!30",
    width: "16cm",
    height: "9cm",
    "tick align": "outside",
    enlargelimits: "true"
  };
  const ranges = { xMin: -0.798999, xMax: 8.799, yMin: -0.05, yMax: 0.55 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const yLabels = commands
    .filter((command) => command.includes("axis tick label, anchor=east"))
    .map((command) => command.match(/\{([^{}]*)\};$/)?.[1])
    .filter(Boolean);
  const gridCommands = renderAxisGrid(axisOptions, [], ranges, geometry);
  const yGridLines = gridCommands.filter((command) => /\] \(0,[^)]+\) -- \([0-9.]+,[^)]+\);$/.test(command));

  assert.deepEqual(yLabels, ["0.1", "0.2", "0.3", "0.4", "0.5"]);
  assert.equal(yGridLines.length, 5);
});

test("pgfplots tick distance normalization follows native nearest 1/2/5 thresholds", () => {
  assert.deepEqual(majorTickValues(0, 350, 6), [0, 50, 100, 150, 200, 250, 300, 350]);
});

test("pgfplots middle x auto ticks keep native horizontal spacing for wide numeric ranges", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    xmin: "-1",
    xmax: "6",
    ymin: "-0.25",
    ymax: "2.25"
  };
  const ranges = { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const xLabels = commands
    .filter((command) => command.includes("axis tick label, anchor=north"))
    .map((command) => command.match(/\{([^{}]*)\};$/)?.[1])
    .filter(Boolean);

  assert.deepEqual(xLabels, ["2", "4", "6"]);
});

test("pgfplots middle y auto ticks keep native half-step labels for activation ranges", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    width: "16cm",
    height: "8cm",
    ymin: "-1",
    ymax: "2",
    enlargelimits: "false",
    "y tick label style": "/pgf/number format/fixed,/pgf/number format/fixed zerofill,/pgf/number format/precision=1"
  };
  const ranges = { xMin: -2, xMax: 2, yMin: -1, yMax: 2 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const yLabels = commands
    .filter((command) => command.includes("axis tick label, anchor=east"))
    .map((command) => command.match(/\{([^{}]*)\};$/)?.[1])
    .filter(Boolean);

  assert.ok(yLabels.includes("−0.5"), `expected native half-step y label −0.5, got ${yLabels.join(",")}`);
  assert.ok(yLabels.includes("0.5"), `expected native half-step y label 0.5, got ${yLabels.join(",")}`);
  assert.ok(yLabels.includes("1.5"), `expected native half-step y label 1.5, got ${yLabels.join(",")}`);
});

test("pgfplots middle axis auto major grid omits origin grid lines", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    grid: "major",
    "grid style": "dashed, gray!30",
    xmin: "-1",
    xmax: "6",
    ymin: "-0.25",
    ymax: "2.25"
  };
  const ranges = { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const gridCommands = renderAxisGrid(axisOptions, [], ranges, geometry);
  const xGridLines = gridCommands.filter((command) => command.includes(",0) -- (") && command.endsWith(`,${testNumber(geometry.height)});`));
  const yGridLines = gridCommands.filter((command) => command.includes("] (0,") && command.includes(`-- (${testNumber(geometry.width)},`));
  const origin = geometry.mapPoint({ x: 0, y: 0 });

  assert.equal(xGridLines.length, 3);
  assert.equal(yGridLines.length, 2);
  assert.ok(!gridCommands.includes(String.raw`\draw[axis grid, black!25, line width=0.4pt, dashed, gray!30] (${testNumber(origin.x)},0) -- (${testNumber(origin.x)},${testNumber(geometry.height)});`));
  assert.ok(!gridCommands.includes(String.raw`\draw[axis grid, black!25, line width=0.4pt, dashed, gray!30] (0,${testNumber(origin.y)}) -- (${testNumber(geometry.width)},${testNumber(origin.y)});`));
});

test("pgfplots minor tick num derives native-like automatic minor tick marks", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    xmin: "-1",
    xmax: "6",
    ymin: "-0.25",
    ymax: "2.25",
    "minor tick num": "-3"
  };
  const ranges = { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const minorTicks = commands.filter((command) => command.includes("axis minor tick"));

  assert.ok(minorTicks.length >= 10, `expected automatic minor ticks from minor tick num, got ${minorTicks.length}`);
  assert.ok(minorTicks.includes(String.raw`\draw[axis minor tick, gray, line width=0.2pt] (1.951,0.517) -- (1.951,0.617);`));
  assert.ok(minorTicks.includes(String.raw`\draw[axis minor tick, gray, line width=0.2pt] (0.925,1.702) -- (1.025,1.702);`));
});

test("pgfplots middle axis ticks use native gray thin tick style", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    xmin: "-1",
    xmax: "6",
    ymin: "-0.25",
    ymax: "2.25",
    "minor tick num": "-3"
  };
  const ranges = { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);

  assert.ok(commands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (2.926,0.492) -- (2.926,0.642);`));
  assert.ok(commands.includes(String.raw`\draw[axis minor tick, gray, line width=0.2pt] (1.951,0.517) -- (1.951,0.617);`));
});

test("pgfplots middle y axis label sits close to the axis tip without expanding bbox", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    xmin: "-1",
    xmax: "6",
    ymin: "-0.25",
    ymax: "2.25",
    xlabel: "$x$",
    ylabel: "$y$"
  };
  const ranges = { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisLabels(axisOptions, ranges, geometry);

  assert.ok(commands.includes(String.raw`\node[axis label, anchor=north west] at (0.975,5.764) {$y$};`));
});

test("pgfplots enlarged middle-axis labels use final transformed axis endpoints", () => {
  const partedAxisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    xmin: "-1",
    xmax: "6",
    ymin: "-0.25",
    ymax: "2.25",
    xlabel: "$x$",
    ylabel: "$y$",
    enlargelimits: "true"
  };
  const partedRanges = { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 };
  const partedGeometry = createAxisGeometry(partedAxisOptions, partedRanges);
  const partedCommands = renderAxisLabels(partedAxisOptions, partedRanges, partedGeometry);

  assert.deepEqual(partedGeometry.transformRanges, {
    xMin: -1.7,
    xMax: 6.7,
    yMin: -0.5,
    yMax: 2.5,
    zMin: 0,
    zMax: 1
  });
  assert.ok(partedCommands.includes(String.raw`\node[axis label, anchor=south east] at (6.923,0.949) {$x$};`));
  assert.ok(partedCommands.includes(String.raw`\node[axis label, anchor=north west] at (1.387,5.785) {$y$};`));

  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    xmin: "-1.5",
    xmax: "1.5",
    xlabel: "$x$",
    ylabel: "$y$",
    enlargelimits: "true"
  };
  const ranges = { xMin: -1.5, xMax: 1.5, yMin: 0, yMax: 2.475 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisLabels(axisOptions, ranges, geometry);

  assert.ok(commands.includes(String.raw`\node[axis label, anchor=south east] at (6.923,0.474) {$x$};`));
  assert.ok(commands.includes(String.raw`\node[axis label, anchor=north west] at (3.427,5.785) {$y$};`));

  const positiveAxisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    xmin: "1",
    xmax: "2",
    ymin: "3",
    ymax: "4",
    xlabel: "$x$",
    ylabel: "$y$",
    enlargelimits: "true"
  };
  const positiveRanges = { xMin: 1, xMax: 2, yMin: 3, yMax: 4 };
  const positiveGeometry = createAxisGeometry(positiveAxisOptions, positiveRanges);
  const positiveAxisLines = renderAxisLines(positiveAxisOptions, positiveRanges, positiveGeometry);
  const positiveCommands = renderAxisLabels(positiveAxisOptions, positiveRanges, positiveGeometry);

  assert.deepEqual(positiveGeometry.transformRanges, {
    xMin: 0.9,
    xMax: 2.1,
    yMin: 2.9,
    yMax: 4.1,
    zMin: 0,
    zMax: 1
  });
  assert.ok(positiveAxisLines.includes(String.raw`\draw[axis line, black, line width=0.35pt] (0,0.474) -- (6.853,0.474);`));
  assert.ok(positiveAxisLines.includes(String.raw`\draw[axis line, black, line width=0.35pt] (0.571,0) -- (0.571,5.694);`));
  assert.ok(positiveCommands.includes(String.raw`\node[axis label, anchor=south east] at (6.923,0.474) {$x$};`));
  assert.ok(positiveCommands.includes(String.raw`\node[axis label, anchor=north west] at (0.571,5.785) {$y$};`));

  const styled = renderAxisLabels(
    { ...axisOptions, "xlabel style": "at={(0.25,0.75)},anchor=west" },
    ranges,
    geometry
  );
  assert.ok(styled.includes(String.raw`\node[axis label, anchor=west] at (1.713,4.27) {$x$};`));

  const withoutTransformRanges = renderAxisLabels(
    { "axis x line": "middle", "axis y line": "middle", xlabel: "$x$", ylabel: "$y$" },
    { xMin: 0, xMax: 2, yMin: 0, yMax: 1 },
    {
      ...createAxisGeometry(
        { "scale only axis": true, width: "2cm", height: "1cm" },
        { xMin: 0, xMax: 2, yMin: 0, yMax: 1 }
      ),
      transformRanges: undefined
    }
  );
  assert.ok(withoutTransformRanges.some((command) => command.includes("{$x$};")));
  assert.ok(withoutTransformRanges.some((command) => command.includes("{$y$};")));
});

test("pgfplots axis label style at uses axis description coordinates", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    width: "14cm",
    height: "8cm",
    xmin: "5",
    xmax: "100",
    ymin: "0",
    ymax: "350",
    ylabel: String.raw`Amortization time\\in h`,
    "y label style": "at={(-0.1,1.0)}"
  };
  const ranges = { xMin: 5, xMax: 100, yMin: 0, yMax: 350 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisLabels(axisOptions, ranges, geometry);

  assert.ok(
    commands.includes(
      String.raw`\node[axis label, anchor=north west, tikzkit anchor text width scale=1.06, tikzkit text width scale=1.06] at (-1.242,6.418) {Amortization time in h};`
    ),
    `expected ylabel to honor axis description at coordinate, got ${commands.join("\n")}`
  );
});

test("pgfplots axis description cs label styles position and rotate bias-variance labels", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    width: "8cm",
    height: "8cm",
    xmin: "0",
    xmax: "2",
    ymin: "0",
    ymax: "2",
    ticks: "none",
    xlabel: "error",
    ylabel: "model complexity",
    "x label style": "at={(axis description cs:0.5,-0.05)},anchor=north",
    "y label style": "at={(axis description cs:-0.05,0.5)},anchor=south,rotate=90"
  };
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 2 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisLabels(axisOptions, ranges, geometry);
  const expectedPlotSize = 8 - parseDimension("45.68pt", {});
  const x = testNumber(geometry.origin.x + geometry.width * 0.5);
  const below = testNumber(geometry.origin.y - geometry.height * 0.05);
  const left = testNumber(geometry.origin.x - geometry.width * 0.05);
  const y = testNumber(geometry.origin.y + geometry.height * 0.5);

  assert.ok(Math.abs(geometry.width - expectedPlotSize) < 0.02, `expected native 45.68pt x reserve, got ${geometry.width}cm`);
  assert.ok(Math.abs(geometry.height - expectedPlotSize) < 0.02, `expected native 45.68pt y reserve, got ${geometry.height}cm`);

  assert.ok(
    commands.some((command) => command.includes(`anchor=north`) && command.includes(`at (${x},${below}) {error};`)),
    `expected x label at the horizontal center below the axis, got ${commands.join("\n")}`
  );
  assert.ok(
    commands.some((command) => command.includes("tikzkit anchor text width scale=1.06, tikzkit text width scale=1.06")),
    `expected plain axis labels to keep native CMU width, got ${commands.join("\n")}`
  );
  assert.ok(
    commands.some(
      (command) =>
        command.includes("anchor=south") &&
        command.includes("rotate=90") &&
        command.includes(`at (${left},${y}) {model complexity};`)
    ),
    `expected rotated y label at the vertical center left of the axis, got ${commands.join("\n")}`
  );
});

test("pgfplots accepts braced rotation values from inherited label styles", () => {
  const axisOptions = {
    width: "8cm",
    height: "8cm",
    xmin: "0",
    xmax: "2",
    ymin: "0",
    ymax: "2",
    ylabel: "$f(x)$",
    "y label style": "at={(axis description cs:0,0.5)},anchor=south,rotate={90}"
  };
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 2 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisLabels(axisOptions, ranges, geometry);

  assert.ok(
    commands.some((command) => command.includes("anchor=south") && command.includes("rotate=90")),
    `expected braced label rotation to survive style serialization, got ${commands.join("\n")}`
  );
});

test("pgfplots explicit axis-description labels own their native node bbox", () => {
  const axisOptions = {
    "axis lines": "middle",
    width: "13.5cm",
    height: "8.625cm",
    xmin: "0",
    xmax: "125",
    ymin: "0",
    ymax: "0.045",
    xtick: "{40,70,80}",
    ytick: "empty",
    xlabel: "$x$",
    ylabel: "$f(x)$",
    "x label style": "at={(axis description cs:0.5,0)},anchor=north,font=\\boldmath\\Large",
    "y label style": "at={(axis description cs:0,0.5)},anchor=south,rotate=90,font=\\boldmath\\Large"
  };
  const ranges = { xMin: 0, xMax: 125, yMin: 0, yMax: 0.045 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const labels = renderAxisLabels(axisOptions, ranges, geometry);
  const ticks = renderAxisTicks(axisOptions, [], ranges, geometry);

  assert.deepEqual(geometry.margin, { left: 0, right: 0, top: 0, bottom: 0 });
  assert.ok(labels.every((command) => command.includes("tikzkit layout bbox")), labels.join("\n"));
  assert.ok(
    ticks.filter((command) => command.includes("axis tick label")).every((command) => command.includes("tikzkit layout bbox")),
    ticks.join("\n")
  );
});

test("pgfplots axis labels degrade TeX line breaks to spaces unless alignment is requested", () => {
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    width: "14cm",
    height: "8cm",
    xmin: "5",
    xmax: "100",
    ymin: "0",
    ymax: "350",
    ylabel: String.raw`Amortization time\\in h`,
    "y label style": "at={(-0.1,1.0)}"
  };
  const ranges = { xMin: 5, xMax: 100, yMin: 0, yMax: 350 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisLabels(axisOptions, ranges, geometry);

  assert.ok(
    commands.includes(
      String.raw`\node[axis label, anchor=north west, tikzkit anchor text width scale=1.06, tikzkit text width scale=1.06] at (-1.242,6.418) {Amortization time in h};`
    ),
    `expected PGFPlots axis label to preserve a word boundary for non-aligned TeX line breaks, got ${commands.join("\n")}`
  );
});

test("pgfplots tick lowering emits TikZ tick and label primitives from axis geometry", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "1cm" }, ranges);
  const commands = renderAxisTicks({ xtick: "{0,2}", ytick: "{0,1}", "axis tick label font": "\\scriptsize" }, [], ranges, geometry);

  assert.ok(commands.some((command) => command === String.raw`\draw[axis tick, gray, line width=0.2pt] (0,0) -- (0,0.15);`));
  assert.ok(commands.some((command) => command === String.raw`\draw[axis tick, gray, line width=0.2pt] (2,0) -- (2,0.15);`));
  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis tick label, anchor=north, font=\scriptsize`) && command.endsWith("{0};")));
  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis tick label, anchor=east, font=\scriptsize`) && command.endsWith("{1};")));
  assert.deepEqual(renderAxisTicks({ ticks: "none" }, [], ranges, geometry), []);
});

test("pgfplots axis-level font is inherited by tick, label, and legend roles", () => {
  const axisOptions = {
    font: String.raw`\sansmath\sffamily`,
    xlabel: "n",
    ylabel: "m",
    xtick: "{0,1}",
    ytick: "{0,1}"
  };
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const labels = renderAxisLabels(axisOptions, ranges, geometry);
  const ticks = renderAxisTicks(axisOptions, [], ranges, geometry);

  assert.ok(labels.every((command) => command.includes(String.raw`font=\normalsize\sansmath\sffamily`)), labels.join("\n"));
  assert.ok(
    ticks.filter((command) => command.includes("axis tick label")).every((command) => command.includes(String.raw`font=\normalsize\sansmath\sffamily`)),
    ticks.join("\n")
  );
  assert.equal(legendFontOption(axisOptions), String.raw`font=\normalsize\sansmath\sffamily`);
});

test("pgfplots box ticklabel pos places labels on the requested upper sides", () => {
  const axisOptions = {
    "scale only axis": true,
    width: "2cm",
    height: "1cm",
    xtick: "{1}",
    ytick: "{0.5}",
    xticklabels: "{X}",
    yticklabels: "{Y}",
    "xticklabel pos": "top",
    "yticklabel pos": "right"
  };
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const xLabel = commands.find((command) => command.endsWith("{X};"));
  const yLabel = commands.find((command) => command.endsWith("{Y};"));
  const pointFromCommand = (command) => {
    const match = String(command || "").match(/\bat\s+\(([-\d.]+),([-\d.]+)\)/);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: NaN, y: NaN };
  };
  const top = geometry.mapPoint({ x: 1, y: ranges.yMax });
  const right = geometry.mapPoint({ x: ranges.xMax, y: 0.5 });
  const xPoint = pointFromCommand(xLabel);
  const yPoint = pointFromCommand(yLabel);

  assert.match(xLabel, /anchor=south/);
  assert.match(yLabel, /anchor=west/);
  assert.ok(xPoint.y >= top.y, `expected top tick label on or above y=${top.y}, got ${xLabel}`);
  assert.ok(Math.abs(yPoint.x - right.x) < 1e-6, `expected right tick label anchored on x=${right.x}, got ${yLabel}`);
});

test("pgfplots rotated box ticks use the native near-ticklabel normal alignment", () => {
  const axisOptions = {
    "scale only axis": true,
    width: "4cm",
    height: "2cm",
    xtick: "{1}",
    xticklabels: "{1946}",
    "x tick label style": "rotate=45,align=center"
  };
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const command = renderAxisTicks(axisOptions, [], ranges, geometry).find((item) => item.endsWith("{1946};"));

  assert.match(command, /anchor=near xticklabel/);
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \node[anchor=near xticklabel,rotate=45] at (1,0) {1946};
  \end{tikzpicture}`);
  const label = result.ir.items.find((item) => item.type === "textNode" && item.text === "1946");
  assert.equal(label.x, 1);
  assert.ok(label.y < -0.35, `expected the rotated node boundary below its anchor, got y=${label.y}`);
});

test("pgfplots implicit middle-axis tick align centers major and minor ticks and label points", () => {
  const axisOptions = {
    "axis lines": "middle",
    width: "4cm",
    height: "4cm",
    xtick: "{1}",
    ytick: "{1}",
    xticklabels: "{X}",
    yticklabels: "{Y}",
    "x minor tick values": "{-0.5}",
    "y minor tick values": "{-0.5}"
  };
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const xBase = geometry.mapPoint({ x: 1, y: 0 });
  const yBase = geometry.mapPoint({ x: 0, y: 1 });
  const xMinorBase = geometry.mapPoint({ x: -0.5, y: 0 });
  const yMinorBase = geometry.mapPoint({ x: 0, y: -0.5 });

  assert.ok(commands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (${testNumber(xBase.x)},${testNumber(xBase.y - 0.075)}) -- (${testNumber(xBase.x)},${testNumber(xBase.y + 0.075)});`));
  assert.ok(commands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (${testNumber(yBase.x - 0.075)},${testNumber(yBase.y)}) -- (${testNumber(yBase.x + 0.075)},${testNumber(yBase.y)});`));
  assert.ok(commands.includes(String.raw`\draw[axis minor tick, gray, line width=0.2pt] (${testNumber(xMinorBase.x)},${testNumber(xMinorBase.y - 0.05)}) -- (${testNumber(xMinorBase.x)},${testNumber(xMinorBase.y + 0.05)});`));
  assert.ok(commands.includes(String.raw`\draw[axis minor tick, gray, line width=0.2pt] (${testNumber(yMinorBase.x - 0.05)},${testNumber(yMinorBase.y)}) -- (${testNumber(yMinorBase.x + 0.05)},${testNumber(yMinorBase.y)});`));

  const xLabel = commands.find((command) => command.endsWith("{X};"));
  const yLabel = commands.find((command) => command.endsWith("{Y};"));
  assert.ok(xLabel?.includes(`at (${testNumber(xBase.x)},${testNumber(xBase.y - 0.075)})`), xLabel);
  assert.ok(yLabel?.includes(`at (${testNumber(yBase.x - 0.075)},${testNumber(yBase.y)})`), yLabel);
  assert.match(xLabel, /font=\\normalsize/);
  assert.match(yLabel, /font=\\normalsize/);
  assert.doesNotMatch(xLabel, /inner sep=/);
  assert.doesNotMatch(yLabel, /inner sep=/);
});

test("pgfplots axis-lines style respects PGFKeys order when it resets tick alignment", () => {
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const beforeAxisLines = {
    width: "4cm",
    height: "4cm",
    xtick: "{1}",
    xticklabels: "{X}",
    "tick align": "inside",
    "axis lines": "middle"
  };
  const afterAxisLines = {
    width: "4cm",
    height: "4cm",
    xtick: "{1}",
    xticklabels: "{X}",
    "axis lines": "middle",
    "tick align": "inside"
  };
  const centeredGeometry = createAxisGeometry(beforeAxisLines, ranges);
  const insideGeometry = createAxisGeometry(afterAxisLines, ranges);
  const centeredBase = centeredGeometry.mapPoint({ x: 1, y: 0 });
  const insideBase = insideGeometry.mapPoint({ x: 1, y: 0 });
  const centered = renderAxisTicks(beforeAxisLines, [], ranges, centeredGeometry);
  const inside = renderAxisTicks(afterAxisLines, [], ranges, insideGeometry);

  assert.ok(centered.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (${testNumber(centeredBase.x)},${testNumber(centeredBase.y - 0.075)}) -- (${testNumber(centeredBase.x)},${testNumber(centeredBase.y + 0.075)});`));
  assert.ok(inside.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (${testNumber(insideBase.x)},${testNumber(insideBase.y)}) -- (${testNumber(insideBase.x)},${testNumber(insideBase.y + 0.15)});`));
});

test("pgfplots native middle tick-label defaults do not widen boxed axes", () => {
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const middleOptions = { "axis lines": "middle", width: "4cm", height: "4cm", xtick: "{1}", xticklabels: "{middle}" };
  const boxedOptions = { width: "4cm", height: "4cm", xtick: "{1}", xticklabels: "{boxed}" };
  const middleLabel = renderAxisTicks(middleOptions, [], ranges, createAxisGeometry(middleOptions, ranges)).find((command) =>
    command.endsWith("{middle};")
  );
  const boxedLabel = renderAxisTicks(boxedOptions, [], ranges, createAxisGeometry(boxedOptions, ranges)).find((command) =>
    command.endsWith("{boxed};")
  );

  assert.match(middleLabel, /font=\\normalsize/);
  assert.doesNotMatch(middleLabel, /inner sep=/);
  assert.match(boxedLabel, /font=\\normalsize/);
  assert.doesNotMatch(boxedLabel, /inner sep=/);
});

test("pgfplots named profiles apply native tick roles and explicit styles win", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ width: "4cm", height: "3cm" }, ranges);
  const labelFor = (axisOptions, suffix) =>
    renderAxisTicks(
      { ...axisOptions, xtick: "{0}", ytick: "{1}", xticklabels: `{${suffix}X}`, yticklabels: `{${suffix}Y}` },
      [],
      ranges,
      geometry
    );

  assert.match(labelFor({ small: true }, "small").find((command) => command.endsWith("{smallX};")), /font=\\footnotesize/);
  assert.match(labelFor({ footnotesize: true }, "foot").find((command) => command.endsWith("{footX};")), /font=\\footnotesize/);
  assert.match(labelFor({ tiny: true }, "tiny").find((command) => command.endsWith("{tinyX};")), /font=\\tiny/);

  const explicit = labelFor(
    {
      small: true,
      "tick label style": String.raw`font=\large`,
      "x tick label style": String.raw`font=\tiny`
    },
    "explicit"
  );
  assert.match(explicit.find((command) => command.endsWith("{explicitX};")), /font=\\tiny/);
  assert.match(explicit.find((command) => command.endsWith("{explicitY};")), /font=\\large/);
});

test("pgfplots named profiles apply native 2d label and title roles", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ width: "4cm", height: "3cm" }, ranges);
  const commands = renderAxisLabels(
    {
      footnotesize: true,
      xlabel: "$x$",
      ylabel: "$y$",
      title: "Title",
      "x label style": String.raw`font=\large`
    },
    ranges,
    geometry
  );

  assert.match(commands.find((command) => command.endsWith("{$x$};")), /font=\\large/);
  assert.match(commands.find((command) => command.endsWith("{$y$};")), /font=\\small/);
  assert.match(commands.find((command) => command.endsWith("{Title};")), /font=\\small/);
});

test("pgfplots title styles append native yshift and visual node options", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  const geometry = {
    origin: { x: 0, y: 0 },
    width: 4,
    height: 3,
    mapPoint: ({ x, y }) => ({ x: x * 4, y: y * 3 }),
    mapAxisDescriptionPoint: ({ x, y }) => ({ x: x * 4, y: y * 3 })
  };
  const command = renderAxisLabels(
    { title: "Title", "title style": String.raw`font=\bfseries,align=center,yshift=10pt` },
    ranges,
    geometry
  )[0];

  assert.match(command, /font=[^,]*\\bfseries/);
  assert.match(command, /align=center/);
  assert.match(command, /anchor=south/);
  assert.match(command, /at \(2,3\.562\)/);
});

test("pgfplots standard box axes subtract the native 45pt reserve on both dimensions", () => {
  const ranges = { xMin: 2012, xMax: 2023, yMin: 0, yMax: 20 };
  const geometry = createAxisGeometry({ width: "14cm", height: "9cm" }, ranges);

  assert.ok(Math.abs(geometry.width - (14 - parseDimension("45pt", {}))) < 1e-9);
  assert.ok(Math.abs(geometry.height - (9 - parseDimension("45pt", {}))) < 1e-9);
});

test("pgfplots multiline footnotesize ticks preserve native optical layout extents", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \begin{axis}[
      xmin=0,xmax=1,ymin=0,ymax=1,
      xtick={0},xticklabels={2012\\2956},
      tick label style={font=\footnotesize}
    ]
    \end{axis}
  \end{tikzpicture}`);
  const layoutBoxes = result.ir.items.filter((item) => item.type === "bbox" && item.subtype === "node-layout");
  const tickBox = layoutBoxes.find((item) => Math.min(...item.commands.map((command) => Number(command.y) || 0)) < -0.75);

  assert.ok(tickBox);
  const xs = tickBox.commands.map((command) => Number(command.x) || 0);
  const ys = tickBox.commands.map((command) => Number(command.y) || 0);
  assert.ok((Math.max(...xs) - Math.min(...xs)) * 28.4527559 > 27);
  assert.ok((Math.max(...ys) - Math.min(...ys)) * 28.4527559 > 22);
});

test("pgfplots 3d ticks, labels, titles, and colorbar ticks use role fonts", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = { mapPoint3d: ({ x, y, z }) => ({ x: x + y * 0.1, y: z + y * 0.2 }) };

  const tickCommands = renderAxis3DTicks({ tiny: true, xtick: "{0}", ytick: "{}", ztick: "{}" }, ranges, geometry);
  assert.match(tickCommands.find((command) => command.endsWith("{0};")), /font=\\tiny/);

  const labelCommands = renderAxisLabels3D(
    {
      tiny: true,
      xlabel: "$x$",
      title: "Title",
      "label style": String.raw`font=\small`,
      "title style": String.raw`font=\large`
    },
    ranges,
    geometry
  );
  assert.match(labelCommands.find((command) => command.endsWith("{$x$};")), /font=\\small/);
  assert.match(labelCommands.find((command) => command.endsWith("{Title};")), /font=\\large/);

  const colorbarCommands = renderAxis3DColorbar(
    {
      colorbar: true,
      tiny: true,
      "colorbar style": String.raw`{ytick={0,1},tick label style={font=\scriptsize}}`
    },
    ranges,
    geometry
  );
  assert.ok(colorbarCommands.filter((command) => command.includes("axis colorbar tick label")).every((command) => /font=\\scriptsize/.test(command)));
});

test("activation-functions public lowering keeps default PGFPlots text at normalsize", () => {
  const source = readFileSync(new URL("./fixtures/examples/latex-examples/activation-functions.tex", import.meta.url), "utf8");
  const result = tikzToSvg(source);
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(textNodes.length > 10);
  assert.ok(textNodes.every((item) => item.font?.sizePt === 10), textNodes.map((item) => `${item.text}:${item.font?.sizePt}`).join("\n"));
});

test("pgfplots middle-axis tick align applies native inside and outside offsets", () => {
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  for (const [align, startFactor, endFactor, labelFactor] of [
    ["inside", 0, 1, 0],
    ["outside", -1, 0, -1]
  ]) {
    const axisOptions = {
      "axis lines": "middle",
      width: "4cm",
      height: "4cm",
      xtick: "{1}",
      ytick: "{1}",
      xticklabels: "{X}",
      yticklabels: "{Y}",
      "x minor tick values": "{-0.5}",
      "y minor tick values": "{-0.5}",
      "tick align": align
    };
    const geometry = createAxisGeometry(axisOptions, ranges);
    const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
    const xBase = geometry.mapPoint({ x: 1, y: 0 });
    const yBase = geometry.mapPoint({ x: 0, y: 1 });
    const xMinorBase = geometry.mapPoint({ x: -0.5, y: 0 });
    const yMinorBase = geometry.mapPoint({ x: 0, y: -0.5 });
    const xLabel = commands.find((command) => command.endsWith("{X};"));
    const yLabel = commands.find((command) => command.endsWith("{Y};"));

    assert.ok(commands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (${testNumber(xBase.x)},${testNumber(xBase.y + startFactor * 0.15)}) -- (${testNumber(xBase.x)},${testNumber(xBase.y + endFactor * 0.15)});`), `${align} x tick: ${commands.join("\n")}`);
    assert.ok(commands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (${testNumber(yBase.x + startFactor * 0.15)},${testNumber(yBase.y)}) -- (${testNumber(yBase.x + endFactor * 0.15)},${testNumber(yBase.y)});`), `${align} y tick: ${commands.join("\n")}`);
    assert.ok(commands.includes(String.raw`\draw[axis minor tick, gray, line width=0.2pt] (${testNumber(xMinorBase.x)},${testNumber(xMinorBase.y + startFactor * 0.1)}) -- (${testNumber(xMinorBase.x)},${testNumber(xMinorBase.y + endFactor * 0.1)});`), `${align} x minor tick: ${commands.join("\n")}`);
    assert.ok(commands.includes(String.raw`\draw[axis minor tick, gray, line width=0.2pt] (${testNumber(yMinorBase.x + startFactor * 0.1)},${testNumber(yMinorBase.y)}) -- (${testNumber(yMinorBase.x + endFactor * 0.1)},${testNumber(yMinorBase.y)});`), `${align} y minor tick: ${commands.join("\n")}`);
    assert.ok(xLabel?.includes(`at (${testNumber(xBase.x)},${testNumber(xBase.y + labelFactor * 0.15)})`), `${align} x label: ${xLabel}`);
    assert.ok(yLabel?.includes(`at (${testNumber(yBase.x + labelFactor * 0.15)},${testNumber(yBase.y)})`), `${align} y label: ${yLabel}`);
  }
});

test("pgfplots per-axis tick align overrides the common middle-axis alignment", () => {
  const axisOptions = {
    "axis lines": "middle",
    width: "4cm",
    height: "4cm",
    xtick: "{1}",
    ytick: "{1}",
    xticklabels: "{X}",
    yticklabels: "{Y}",
    "tick align": "outside",
    "xtick align": "inside",
    "ytick align": "center"
  };
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const xBase = geometry.mapPoint({ x: 1, y: 0 });
  const yBase = geometry.mapPoint({ x: 0, y: 1 });
  const xLabel = commands.find((command) => command.endsWith("{X};"));
  const yLabel = commands.find((command) => command.endsWith("{Y};"));

  assert.ok(commands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (${testNumber(xBase.x)},${testNumber(xBase.y)}) -- (${testNumber(xBase.x)},${testNumber(xBase.y + 0.15)});`));
  assert.ok(commands.includes(String.raw`\draw[axis tick, gray, line width=0.2pt] (${testNumber(yBase.x - 0.075)},${testNumber(yBase.y)}) -- (${testNumber(yBase.x + 0.075)},${testNumber(yBase.y)});`));
  assert.ok(xLabel?.includes(`at (${testNumber(xBase.x)},${testNumber(xBase.y)})`), xLabel);
  assert.ok(yLabel?.includes(`at (${testNumber(yBase.x - 0.075)},${testNumber(yBase.y)})`), yLabel);
});

test("pgfplots middle-axis tick labels preserve explicit font inner sep and distance overrides", () => {
  const axisOptions = {
    "axis lines": "middle",
    width: "4cm",
    height: "4cm",
    xtick: "{1}",
    ytick: "none",
    xticklabels: "{kept}",
    "axis tick label font": "\\tiny",
    "axis tick label inner sep": "2pt",
    "x axis tick label distance": "0.4cm"
  };
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const xBase = geometry.mapPoint({ x: 1, y: 0 });
  const label = commands.find((command) => command.endsWith("{kept};"));

  assert.match(label, /font=\\tiny/);
  assert.match(label, /inner sep=2pt/);
  assert.ok(label?.includes(`at (${testNumber(xBase.x)},${testNumber(xBase.y - 0.4)})`), label);
});

test("pgfplots middle-axis tick labels accept an explicit zero distance", () => {
  const axisOptions = {
    "axis lines": "middle",
    width: "4cm",
    height: "4cm",
    xtick: "{1}",
    ytick: "{1}",
    xticklabels: "{X}",
    yticklabels: "{Y}",
    "tick align": "outside",
    "x axis tick label distance": "0pt",
    "y axis tick label distance": "0pt"
  };
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const xBase = geometry.mapPoint({ x: 1, y: 0 });
  const yBase = geometry.mapPoint({ x: 0, y: 1 });
  const xLabel = commands.find((command) => command.endsWith("{X};"));
  const yLabel = commands.find((command) => command.endsWith("{Y};"));

  assert.ok(xLabel?.includes(`at (${testNumber(xBase.x)},${testNumber(xBase.y)})`), xLabel);
  assert.ok(yLabel?.includes(`at (${testNumber(yBase.x)},${testNumber(yBase.y)})`), yLabel);

  for (const invalidDistance of ["-1pt", "not-a-distance"]) {
    const fallbackOptions = {
      ...axisOptions,
      ytick: "none",
      "x axis tick label distance": invalidDistance
    };
    const fallbackCommands = renderAxisTicks(fallbackOptions, [], ranges, createAxisGeometry(fallbackOptions, ranges));
    const fallbackLabel = fallbackCommands.find((command) => command.endsWith("{X};"));
    assert.ok(
      fallbackLabel?.includes(`at (${testNumber(xBase.x)},${testNumber(xBase.y - 0.15)})`),
      `${invalidDistance}: ${fallbackLabel}`
    );
  }
});

test("pgfplots middle-axis alignment keeps automatic origin suppression and tick text", () => {
  const axisOptions = { "axis lines": "middle", width: "4cm", height: "4cm" };
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const labels = commands.filter((command) => command.includes("axis tick label"));

  assert.ok(labels.some((command) => command.endsWith("{−1};")), labels.join("\n"));
  assert.ok(labels.some((command) => command.endsWith("{1};")), labels.join("\n"));
  assert.ok(!labels.some((command) => command.endsWith("{0};")), labels.join("\n"));
});

test("pgfplots tick lowering uses compact tick-label nodes after computing ticklabel cs offsets", () => {
  const axisOptions = { "axis lines": "middle", width: "4cm", height: "4cm", xtick: "{1}", xticklabels: "{A}" };
  const ranges = { xMin: 0, xMax: 4, yMin: -1, yMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);
  const labelCommand = commands.find((command) => command.includes("{A};"));

  assert.ok(labelCommand, "expected lowered x tick label node");
  assert.match(labelCommand, /axis tick label, anchor=north/);
  assert.match(labelCommand, /font=\\normalsize/);
  assert.match(labelCommand, /tikzkit text width scale=1\.0001/);
  assert.doesNotMatch(labelCommand, /inner sep=/);
});

test("pgfplots middle axis auto ticks keep terminal boundary labels", () => {
  const axisOptions = {
    "axis lines": "middle",
    width: "16cm",
    height: "8cm",
    "x tick label style": "/pgf/number format/fixed,/pgf/number format/fixed zerofill,/pgf/number format/precision=1",
    "y tick label style": "/pgf/number format/fixed,/pgf/number format/fixed zerofill,/pgf/number format/precision=1"
  };
  const ranges = { xMin: -2, xMax: 2, yMin: -1, yMax: 2 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisTicks(axisOptions, [], ranges, geometry);

  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis tick label,`) && command.includes("anchor=north") && command.endsWith("{2.0};")), "expected x terminal label");
  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis tick label,`) && command.includes("anchor=east") && command.endsWith("{2.0};")), "expected y terminal label");
});

test("pgfplots boxed auto ticks keep terminal max tick labels", () => {
  const ranges = { xMin: 0, xMax: 5, yMin: 0, yMax: 5 };
  const geometry = createAxisGeometry({}, ranges);
  const commands = renderAxisTicks({}, [], ranges, geometry);

  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis tick label, anchor=north`) && command.endsWith("{5};")), "expected x max tick label");
  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis tick label, anchor=east`) && command.endsWith("{5};")), "expected y max tick label");
  assert.ok(commands.some((command) => command === String.raw`\draw[axis tick, gray, line width=0.2pt] (0,0) -- (0,0.15);`), "expected bottom ticks to use PGFPlots inside gray style");
  assert.ok(commands.some((command) => command === String.raw`\draw[axis tick, gray, line width=0.2pt] (0,5.672) -- (0,5.522);`), "expected top ticks on box axis");
  assert.ok(commands.some((command) => command === String.raw`\draw[axis tick, gray, line width=0.2pt] (6.853,0) -- (6.703,0);`), "expected right ticks on box axis");
  assert.ok(commands.some((command) => command.includes("anchor=north") && command.includes("at (0,-0.028) {0};")), "boxed x labels should preserve the native baseline compensation");
  assert.ok(commands.some((command) => command.includes("anchor=east") && command.includes("at (0,0) {0};")), "boxed y labels should place their node boundary on the axis");
});

test("pgfplots label lowering reserves complete default tick-label nodes", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "1cm" }, ranges);
  const commands = renderAxisLabels(
    { xlabel: "$x$", ylabel: "$y$", title: "Title", "axis label font": "\\small" },
    ranges,
    geometry
  );

  assert.ok(
    commands.includes(String.raw`\node[axis label, tikzkit layout bbox, anchor=north, font=\small] at (1,-0.461) {$x$};`),
    commands.join("\n")
  );
  assert.ok(
    commands.includes(String.raw`\node[axis label, tikzkit layout bbox, anchor=center, font=\small, rotate=90] at (-1.1,0.5) {$y$};`),
    commands.join("\n")
  );
  assert.ok(
    commands.includes(String.raw`\node[axis label, tikzkit layout bbox, anchor=south] at (1,1.211) {Title};`),
    commands.join("\n")
  );
});

test("pgfplots legend lowering owns legend box, samples, labels, and entry splitting", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "1cm" }, ranges);
  const commands = renderLegendEntries(
    { "legend entries": "{$x$,{two, words}}", "legend pos": "south east", "legend style": "font=\\tiny" },
    ranges,
    geometry,
    [],
    [{ options: { blue: true, thick: true } }, { options: { dashed: true } }]
  );

  assert.deepEqual(splitLegendEntries("{$x$,{two, words}}"), ["$x$", "{two, words}"]);
  assert.equal(legendFontOption({}), "font=\\normalsize");
  assert.equal(legendFontOption({ "legend style": "font=\\tiny" }), "font=\\tiny");
  assert.ok(commands[0].startsWith(String.raw`\draw[axis legend box, draw=black, fill=white`));
  assert.ok(commands.some((command) => command.includes(String.raw`\draw[axis legend image, blue, thick]`)));
  assert.ok(commands.some((command) => command.includes(String.raw`\draw[axis legend image, red, dashed]`)));
  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis legend, anchor=center, font=\tiny]`) && command.endsWith("{$x$};")));
});

test("pgfplots legend lowering honors draw and fill from legend style", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "1cm" }, ranges);
  const commands = renderLegendEntries(
    { "legend entries": "{$x$}", "legend pos": "south east", "legend style": "draw=none,fill=none,font=\\scriptsize" },
    ranges,
    geometry,
    [],
    [{ options: { blue: true } }]
  );

  assert.ok(
    commands[0].startsWith(String.raw`\draw[axis legend box, draw=none, fill=none, line width=0.4pt]`),
    `expected legend style draw/fill to affect the legend box, got ${commands[0]}`
  );
  assert.ok(commands.some((command) => command.includes(String.raw`\node[axis legend, anchor=center, font=\scriptsize]`)));
});

test("pgfplots tiny pmatrix legends use native matrix rows and box dimensions", () => {
  const ranges = { xMin: -100, xMax: 100, yMin: -100, yMax: 100 };
  const geometry = createAxisGeometry({ width: "10cm", height: "10cm" }, ranges);
  const entries = [
    String.raw`$\begin{pmatrix}0\\0\end{pmatrix} + U$`,
    String.raw`$\begin{pmatrix}0\\12\end{pmatrix} + U$`,
    String.raw`$\begin{pmatrix}0\\-42\end{pmatrix} + U$`,
    String.raw`$\begin{pmatrix}0\\50\end{pmatrix} + U$`
  ];
  const commands = renderLegendEntries(
    { "legend pos": "north west", "legend cell align": "left", "legend style": "legend pos=north west,font=\\tiny" },
    ranges,
    geometry,
    entries,
    entries.map((_entry, index) => ({ options: { [["red", "blue", "purple", "lime"][index]]: true, thick: true } }))
  );

  const width = legendBoxWidthFromCommand(commands[0]);
  const height = legendBoxHeightFromCommand(commands[0]);
  const rowYs = commands.filter((command) => command.includes(String.raw`\node[axis legend`)).map(legendNodeYFromCommand);
  assert.ok(width >= 2.12 && width <= 2.2, `expected native-like 2.18cm legend width, got ${width}cm`);
  assert.ok(height >= 1.91 && height <= 1.94, `expected native 1.926cm legend height, got ${height}cm`);
  assert.equal(rowYs.length, 4);
  for (let index = 0; index < rowYs.length - 1; index += 1) {
    assert.ok(
      Math.abs((rowYs[index] - rowYs[index + 1]) * 28.45274 - 12.7) <= 0.08,
      `expected native 12.70pt pmatrix row pitch, got ${(rowYs[index] - rowYs[index + 1]) * 28.45274}pt`
    );
  }
});

test("pgfplots legend lowering reserves native-like width for math-heavy entries", () => {
  const ranges = { xMin: -2, xMax: 2, yMin: -1, yMax: 2 };
  const geometry = createAxisGeometry(
    {
      width: "16cm",
      height: "8cm",
      "axis x line": "middle",
      "axis y line": "middle",
      enlargelimits: "false"
    },
    ranges
  );
  const entries = [
    String.raw`$\varphi_1(x)=\frac{1}{1+e^{-x}}$`,
    String.raw`$\varphi_2(x)=\tanh(x)$`,
    String.raw`$\varphi_3(x)=\max(0, x)$`,
    String.raw`$\varphi_4(x)=\log(e^x + 1)$`,
    String.raw`$\varphi_5(x)=\max(x, e^x - 1)$`
  ];
  const commands = renderLegendEntries(
    { "legend pos": "north west", "legend cell align": "{left}" },
    ranges,
    geometry,
    entries,
    entries.map((_entry, index) => ({ options: { "pgfplots plus": true }, index }))
  );

  const width = legendBoxWidthFromCommand(commands[0]);
  const height = legendBoxHeightFromCommand(commands[0]);
  assert.ok(width >= 4.54 && width <= 4.59, `expected math-heavy legend width close to tikztosvg 4.57cm, got ${width}cm`);
  assert.ok(height >= 2.44 && height <= 2.48, `expected math-heavy legend height close to tikztosvg 2.46cm, got ${height}cm`);

  const rowYs = commands.filter((command) => command.includes(String.raw`\node[axis legend`)).map(legendNodeYFromCommand);
  const rowCommands = commands.filter((command) => command.includes(String.raw`\node[axis legend`));
  const rowXs = rowCommands.map(legendNodeXFromCommand);
  const ptPerCm = 28.45274;
  assert.equal(rowYs.length, 5);
  assert.ok(rowCommands.every((command) => command.includes("anchor=west")), "expected legend cell align=left to use west anchors");
  assert.ok(rowXs.every((x) => Math.abs(x - rowXs[0]) < 1e-9), `expected every math row to share one left edge, got ${rowXs.join(", ")}`);
  assert.ok(Math.abs((rowYs[0] - rowYs[1]) * ptPerCm - 13.4742) <= 0.05, "expected the fraction row to use its taller TeX row box");
  for (let index = 1; index < rowYs.length - 1; index += 1) {
    assert.ok(Math.abs((rowYs[index] - rowYs[index + 1]) * ptPerCm - 13) <= 0.05, "expected ordinary legend rows to use PGFPlots' 13pt matrix row pitch");
  }
});

test("pgfplots compact function legends use native short-math matrix dimensions", () => {
  const ranges = { xMin: 0, xMax: Math.PI, yMin: -1, yMax: 1 };
  const axisOptions = {
    "axis x line": "middle",
    "axis y line": "middle",
    "enlarge x limits": "true",
    "enlarge y limits": "true",
    "legend style": "at={(0.2,0.37)}, anchor=north, fill=none"
  };
  const commands = renderLegendEntries(
    axisOptions,
    ranges,
    createAxisGeometry(axisOptions, ranges),
    [String.raw`$\cos x$`, String.raw`$x$`],
    [{ options: { blue: true, "very thick": true } }, { options: { red: true, "very thick": true } }]
  );
  const widthPt = legendBoxWidthFromCommand(commands[0]) * 28.45274;
  const heightPt = legendBoxHeightFromCommand(commands[0]) * 28.45274;

  assert.ok(Math.abs(widthPt - 48.86) <= 0.35, `expected native 48.86pt compact legend width, got ${widthPt}pt`);
  assert.ok(Math.abs(heightPt - 23.52) <= 0.15, `expected native 23.52pt compact legend height, got ${heightPt}pt`);
});

test("pgfplots legend cell alignment maps left, center, and right to native cell anchors", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "3cm", height: "2cm" }, ranges);
  const entries = [String.raw`$x$`, String.raw`$x^2+1$`];
  const render = (align) => renderLegendEntries(
    { "legend entries": entries.join(","), "legend pos": "north west", "legend cell align": `{${align}}` },
    ranges,
    geometry,
    [],
    [{ options: {} }, { options: {} }]
  ).filter((command) => command.includes(String.raw`\node[axis legend`));

  const left = render("left");
  const center = render("center");
  const right = render("right");
  assert.ok(left.every((command) => command.includes("anchor=west")));
  assert.ok(center.every((command) => command.includes("anchor=center")));
  assert.ok(right.every((command) => command.includes("anchor=east")));
  assert.ok(left.map(legendNodeXFromCommand).every((x) => x === legendNodeXFromCommand(left[0])));
  assert.ok(center.map(legendNodeXFromCommand).every((x) => x === legendNodeXFromCommand(center[0])));
  assert.ok(right.map(legendNodeXFromCommand).every((x) => x === legendNodeXFromCommand(right[0])));
  assert.ok(legendNodeXFromCommand(left[0]) < legendNodeXFromCommand(center[0]));
  assert.ok(legendNodeXFromCommand(center[0]) < legendNodeXFromCommand(right[0]));
});

test("pgfplots legend lowering reserves native-like width for long plain text entries", () => {
  const ranges = { xMin: 5, xMax: 100, yMin: 0, yMax: 350 };
  const axisOptions = {
    width: "14cm",
    height: "8cm",
    xmin: "5",
    xmax: "100",
    ymin: "0",
    ymax: "350",
    "axis x line": "middle",
    "axis y line": "middle",
    "legend pos": "north east",
    "legend cell align": "left"
  };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const entries = [
    "1.50 EUR and 0.30 EUR/kWh",
    "3.00 EUR and 0.30 EUR/kWh",
    "5.00 EUR and 0.30 EUR/kWh"
  ];
  const commands = renderLegendEntries(
    axisOptions,
    ranges,
    geometry,
    entries,
    entries.map((_entry, index) => ({ options: { "pgfplots plus": true }, index }))
  );

  const width = legendBoxWidthFromCommand(commands[0]);
  assert.ok(width >= 5.55 && width <= 5.75, `expected plain-text legend width close to tikztosvg 5.64cm, got ${width}cm`);
});

test("pgfplots legend lowering uses native-like sample line length", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 1 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "1cm" }, ranges);
  const commands = renderLegendEntries(
    { "legend entries": "{$x$}", "legend pos": "north west" },
    ranges,
    geometry,
    [],
    [{ options: { blue: true, thick: true } }]
  );

  const width = legendSampleWidthFromCommand(commands[1]);
  assert.ok(width >= 0.59 && width <= 0.62, `expected legend sample line close to tikztosvg 0.598cm, got ${width}cm`);
});

test("pgfplots legend lowering uses native-like sample left inset", () => {
  const ranges = { xMin: 5, xMax: 100, yMin: 0, yMax: 350 };
  const axisOptions = {
    width: "14cm",
    height: "8cm",
    xmin: "5",
    xmax: "100",
    ymin: "0",
    ymax: "350",
    "axis x line": "middle",
    "axis y line": "middle",
    "legend pos": "north east",
    "legend cell align": "left"
  };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const entries = [
    "1.50 EUR and 0.30 EUR/kWh",
    "3.00 EUR and 0.30 EUR/kWh",
    "5.00 EUR and 0.30 EUR/kWh"
  ];
  const commands = renderLegendEntries(
    axisOptions,
    ranges,
    geometry,
    entries,
    entries.map((_entry, index) => ({ options: { "pgfplots plus": true }, index }))
  );

  const inset = legendSampleLeftInsetFromCommands(commands[0], commands[1]);
  assert.ok(inset >= 0.1 && inset <= 0.13, `expected sample inset close to tikztosvg 0.112cm, got ${inset}cm`);
});

test("pgfplots plain legends use native matrix padding and CMR10 kerning", () => {
  const commands = renderLegendEntries(
    { "legend entries": "{Wahlbeteiligung}", "legend pos": "north east" },
    {},
    { origin: { x: 0, y: 0 }, width: 8, height: 4 },
    [],
    [{ options: { blue: true, dashed: true, mark: "triangle*" } }]
  );
  const widthPt = legendBoxWidthFromCommand(commands[0]) * 28.45274;
  const insetPt = legendSampleLeftInsetFromCommands(commands[0], commands[1]) * 28.45274;

  assert.ok(Math.abs(widthPt - 98.33) <= 0.08, `expected native 98.33pt legend width, got ${widthPt}pt`);
  assert.ok(Math.abs(insetPt - 3.2) <= 0.03, `expected native 3.2pt sample inset, got ${insetPt}pt`);
});

test("pgfplots plot style helper preserves cycle colors and explicit style options", () => {
  assert.equal(selectPlotStyle({ "pgfplots plus": true, dashed: true }, 1), "red, dashed");
  assert.equal(selectPlotStyle({ draw: "black", "line width": "1pt", dotted: true }, 0), "draw=black, line width=1pt, dotted");
  assert.equal(selectPlotStyle({ "pgfplots explicit options": true, "ultra thick": true, dashed: true }, 0), "black, ultra thick, dashed");
  assert.equal(selectPlotStyle({ "pgfplots explicit options": true, semithick: true }, 0), "black, semithick");
});

test("pgfplots marks lowering owns mark decisions and TikZ mark primitives", () => {
  assert.equal(shouldRenderPlotMarks({ mark: "none" }), false);
  assert.equal(shouldRenderPlotMarks({ "only marks": true }), true);
  assert.equal(
    renderPlotMark({ x: 1, y: 2 }, { mark: "o", blue: true, "mark size": "2pt" }, 0),
    String.raw`\draw[axis mark, draw=blue] (1,2) circle(0.07);`
  );
  assert.equal(
    renderPlotMark({ x: 1, y: 2 }, { mark: "square*", red: true, "mark size": "2pt" }, 0),
    String.raw`\draw[axis mark, draw=red, fill=red, fill opacity=1] (0.93,1.93) -- (1.07,1.93) -- (1.07,2.07) -- (0.93,2.07) -- cycle;`
  );
  assert.match(renderPlotMark({ x: 1, y: 2 }, { mark: "x", blue: true, "mark size": "1pt" }, 0), /axis mark, draw=blue/);
});

test("pgfplots plot path lowering owns straight, const, smooth, gap, and draw decisions", () => {
  const points = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }];

  assert.equal(axisPlotPointChain(points, {}, {}), "(0,0) -- (1,1) -- (2,0)");
  assert.equal(axisPlotPointChain(points, { "const plot": true }, {}), "(0,0) -- (1,0) -- (1,1) -- (2,1) -- (2,0)");
  assert.match(axisPlotPointChain(points, {}, { smooth: true }), /\.\. controls/);
  assert.equal(axisPlotPointChain(points, {}, { "axis plot gap": "1pt" }), "(0.025,0.025) -- (0.975,0.975) (1.025,0.975) -- (1.975,0.025)");
  assert.equal(shouldRenderAxisPlotPath({ "only marks": true }), false);
  assert.equal(shouldRenderAxisPlotPath({ draw: "none" }), false);
  assert.equal(shouldRenderAxisPlotPath({ draw: "none", "name path": "curve" }), true);
});

test("pgfplots bar and comb visualizers lower data points through axis geometry", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 2 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "2cm" }, ranges);

  assert.equal(isAxisBarPlot({ ybar: true }, {}, "y"), true);
  assert.equal(isAxisCombPlot({}, { ycomb: true }, "y"), true);
  assert.deepEqual(renderAxisBars([{ x: 1, y: 2 }], { "bar width": 0.2 }, geometry, { blue: true }, 0, "y"), [
    String.raw`\draw[axis bar, fill=blue!30, draw=blue] (0.9,0) -- (1.1,0) -- (1.1,2) -- (0.9,2) -- cycle;`
  ]);
  assert.deepEqual(renderAxisComb([{ x: 1, y: 2 }], {}, ranges, geometry, { red: true, thick: true }, 0, "y"), [
    String.raw`\draw[axis comb, red, thick] (1,0) -- (1,2);`
  ]);
});

test("pgfplots symbolic categories preserve TeX labels and map bars to category positions", () => {
  const parsed = parseAddplots(
    String.raw`\addplot[red,fill=red!15] coordinates {($x_1$,96) ($x_2$,126) ($x_{10}$,110)};`
  );
  const labels = symbolicCoordinateLabels(String.raw`{$x_1$,$x_2$,$x_{10}$}`);
  const normalized = normalizePgfplotsSymbolicCoordinates(parsed, {
    "symbolic x coords": String.raw`{$x_1$,$x_2$,$x_{10}$}`,
    xtick: "data"
  });

  assert.deepEqual(labels, [String.raw`$x_1$`, String.raw`$x_2$`, String.raw`$x_{10}$`]);
  assert.deepEqual(normalized.addplots[0].points.map((point) => point.x), [0, 1, 2]);
  assert.deepEqual(normalized.axisOptions["pgfplots symbolic x labels"], labels);
  assert.deepEqual(axisTickValues("data", "x", normalized.addplots), [0, 1, 2]);
});

test("pgfplots physical bar width and plot shift stay in canvas units", () => {
  const ranges = { xMin: 0, xMax: 14, yMin: 87_000, yMax: 130_000 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "7cm", height: "7cm" }, ranges);
  const [command] = renderAxisBars(
    [{ x: 0, y: 96_000 }],
    { "bar width": "7pt" },
    geometry,
    { red: true, fill: "red!15", shift: "(-1.5,0)" },
    0,
    "y",
    ranges
  );
  const points = [...command.matchAll(/\((-?[0-9.]+),(-?[0-9.]+)\)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
  assert.equal(points.length, 4);
  assert.ok(Math.abs(points[1].x - points[0].x - parseDimension("7pt", {})) < 0.002);
  assert.ok(points.every((point) => point.y >= -1e-9 && point.y <= geometry.height + 1e-9));
  assert.match(command, /axis bar, fill=red!15, draw=red/);
});

test("pgfplots split y axes place ticks and colored labels on their requested sides", () => {
  const ranges = { xMin: 0, xMax: 14, yMin: 15, yMax: 50 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "7cm", height: "7cm" }, ranges);
  const tickCommands = renderAxisTicks(
    { "axis y line*": "right", "axis x line": "none", ytick: "{15,50}" },
    [],
    ranges,
    geometry
  );
  const yLabels = tickCommands.filter((command) => command.includes("axis tick label"));
  assert.equal(yLabels.length, 2);
  assert.ok(yLabels.every((command) => command.includes("anchor=west")));
  assert.ok(yLabels.every((command) => command.includes("at (7,")));
  assert.ok(!tickCommands.some((command) => /\{0\};$/.test(command)), "axis x line=none should suppress x ticks and labels");

  const labelCommands = renderAxisLabels(
    { ylabel: "weight", "ylabel style": "at={(1.25,0.5)},color=blue" },
    ranges,
    geometry
  );
  assert.equal(labelCommands.length, 1);
  assert.match(labelCommands[0], /text=blue/);
  assert.match(labelCommands[0], /rotate=90/);
});

test("pgfplots plot node lowering owns nodes near coords and inline plot labels", () => {
  const ranges = { xMin: 0, xMax: 2, yMin: 0, yMax: 2 };
  const geometry = createAxisGeometry({ "scale only axis": true, width: "2cm", height: "2cm" }, ranges);

  assert.deepEqual(renderNodesNearCoords({ options: {}, points: [{ x: 1, y: 2 }] }, { "nodes near coords": true }, geometry), [
    String.raw`\node[axis near coord, anchor=south, font=\scriptsize] at (1,2.08) {2};`
  ]);
  assert.deepEqual(
    renderNodesNearCoords(
      { is3d: true, options: {}, points: [{ x: 1, y: 2, z: 3 }] },
      { "nodes near coords": true },
      {
        mapPoint: () => assert.fail("3d near-coordinate nodes must not use the 2d mapper"),
        mapPoint3d: ({ x, y, z }) => ({ x: x + y, y: z })
      }
    ),
    [String.raw`\node[axis near coord, anchor=south, font=\scriptsize] at (3,3.08) {3};`]
  );
  assert.deepEqual(
    renderAxisPlotInlineNodes(
      [{ options: { pos: 0.5, right: true, xshift: "2pt", pin: "north:{peak}" }, text: "$f(x)$" }],
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 }
      ],
      "blue"
    ),
    [
      String.raw`\draw[axis plot node connector, gray, thin] (1,0) -- (1.07,0);`,
      String.raw`\node[axis plot node, anchor=west, text=blue, pin={north:{peak}}] at (1.07,0) {$f(x)$};`
    ]
  );
});

test("pgfplots geometry owns axis sizing, origin, margins, and mapping", () => {
  const geometry = createAxisGeometry(
    { "scale only axis": true, width: "4cm", height: "2cm", at: "(1cm,2cm)" },
    { xMin: 0, xMax: 5, yMin: 0, yMax: 5 }
  );

  assert.equal(geometry.width, 4);
  assert.equal(geometry.height, 2);
  assert.deepEqual(geometry.origin, { x: 1, y: 2 });
  assert.deepEqual(geometry.mapPoint({ x: 5, y: 5 }), { x: 5, y: 4 });
  assert.equal(parseAxisDimension("1cm", 0), 1);
  assert.ok(Math.abs(parseAxisDimension(String.raw`0.8*\textwidth`, 0) - parseDimension("276pt", {})) < 1e-9);
  assert.deepEqual(parseAxisAt("{(2cm,3cm)}"), { x: 2, y: 3 });
});

test("pgfplots default enlarged middle-axis framing uses native TeX reserves", () => {
  const geometry = createAxisGeometry(
    {
      "axis x line": "middle",
      "axis y line": "middle",
      xmin: "-1",
      xmax: "6",
      ymin: "-0.25",
      ymax: "2.25",
      enlargelimits: "true"
    },
    { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 }
  );
  const autoYGeometry = createAxisGeometry(
    {
      "axis x line": "middle",
      "axis y line": "middle",
      xmin: "-1",
      xmax: "6",
      enlargelimits: "true"
    },
    { xMin: -1, xMax: 6, yMin: 0, yMax: 2.25 }
  );
  const reserve = parseDimension("45pt", {});
  const margin = parseDimension("0.2pt", {});

  assert.ok(Math.abs(geometry.width - (PGFPLOTS_DEFAULT_AXIS_WIDTH - reserve)) < 1e-9);
  assert.ok(Math.abs(geometry.height - (PGFPLOTS_DEFAULT_AXIS_HEIGHT - reserve)) < 1e-9);
  assert.deepEqual(geometry.margin, { left: margin, right: margin, top: margin, bottom: margin });
  assert.equal(autoYGeometry.margin.top, margin);
  assert.ok(autoYGeometry.margin.bottom > margin);
});

test("pgfplots default non-enlarged middle-axis framing preserves existing reserves", () => {
  const geometry = createAxisGeometry(
    { "axis x line": "middle", "axis y line": "middle" },
    { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 }
  );

  assert.equal(TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_X, 1.607);
  assert.equal(TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_Y, 1.603);
  assert.ok(Math.abs(geometry.width - (PGFPLOTS_DEFAULT_AXIS_WIDTH - TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_X)) < 1e-9);
  assert.ok(Math.abs(geometry.height - (PGFPLOTS_DEFAULT_AXIS_HEIGHT - TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_Y)) < 1e-9);
});

test("pgfplots partially explicit enlarged middle-axis framing preserves inferred reserves", () => {
  const axisOptions = { "axis x line": "middle", "axis y line": "middle", enlargelimits: "true" };
  const ranges = { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 };
  const widthOnlyGeometry = createAxisGeometry({ ...axisOptions, width: "10cm" }, ranges);
  const heightOnlyGeometry = createAxisGeometry({ ...axisOptions, height: "10cm" }, ranges);
  const expectedWidthOnlyHeight =
    (10 * PGFPLOTS_DEFAULT_AXIS_HEIGHT) / PGFPLOTS_DEFAULT_AXIS_WIDTH - TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_Y;
  const expectedHeightOnlyWidth =
    (10 * PGFPLOTS_DEFAULT_AXIS_WIDTH) / PGFPLOTS_DEFAULT_AXIS_HEIGHT - TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_X;

  assert.ok(
    Math.abs(widthOnlyGeometry.height - expectedWidthOnlyHeight) < 1e-9,
    `expected width-only inferred height ${expectedWidthOnlyHeight}cm, got ${widthOnlyGeometry.height}cm`
  );
  assert.ok(
    Math.abs(heightOnlyGeometry.width - expectedHeightOnlyWidth) < 1e-9,
    `expected height-only inferred width ${expectedHeightOnlyWidth}cm, got ${heightOnlyGeometry.width}cm`
  );
});

test("pgfplots geometry treats split axis x/y middle options as middle axes", () => {
  const geometry = createAxisGeometry(
    { width: "16cm", height: "8cm", "axis x line": "middle", "axis y line": "middle" },
    { xMin: -2, xMax: 2, yMin: -1, yMax: 2 }
  );
  const tightGeometry = createAxisGeometry(
    { width: "16cm", height: "8cm", "axis x line": "middle", "axis y line": "middle", ticks: "none" },
    { xMin: -2, xMax: 2, yMin: -1, yMax: 2 }
  );
  const expectedReserve = parseDimension("45pt", {});

  assert.ok(Math.abs(geometry.width - (16 - expectedReserve)) < 0.02, `expected split middle width to use native 45pt reserve, got ${geometry.width}cm`);
  assert.ok(Math.abs(geometry.height - (8 - expectedReserve)) < 0.02, `expected split middle height to use native 45pt reserve, got ${geometry.height}cm`);
  assert.deepEqual(geometry.margin, { left: 0.48, right: 0.41, top: 0.3, bottom: 0.24 });
  assert.ok(Math.abs(tightGeometry.width - (16 - expectedReserve)) < 0.02);
  assert.ok(Math.abs(tightGeometry.height - (8 - expectedReserve)) < 0.02);
  assert.deepEqual(tightGeometry.margin, { left: 0.06, right: 0.12, top: 0.06, bottom: 0.06 });
});

test("pgfplots explicit middle axes reserve native space for top description y labels", () => {
  const geometry = createAxisGeometry(
    {
      width: "14cm",
      height: "8cm",
      "axis x line": "middle",
      "axis y line": "middle",
      ylabel: String.raw`Amortization time\\in h`,
      "y label style": "at={(-0.1,1.0)}"
    },
    { xMin: 5, xMax: 100, yMin: 0, yMax: 350 }
  );

  assert.deepEqual(geometry.margin, { left: 0.48, right: 0.492, top: 0.23, bottom: 0.618 });
});

test("pgfplots geometry preserves log-axis and 3D projection metadata", () => {
  const geometry = createAxisGeometry(
    { "scale only axis": true, width: "3cm", height: "3cm", xmode: "log", "pgfplots 3d surface": true },
    { xMin: 1, xMax: 100, yMin: 0, yMax: 10, zMin: 0, zMax: 5 }
  );

  assert.equal(geometry.xLog, true);
  assert.deepEqual(geometry.mapPoint({ x: 10, y: 5 }), { x: 1.5, y: 1.5 });
  assert.ok(Number.isFinite(geometry.mapPoint3d({ x: 10, y: 5, z: 2 }).x));
});

test("pgfplots perspective 3D geometry reserves the native description bbox", () => {
  const ranges = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -49, zMax: 151 };
  const geometry = createAxisGeometry(
    { "pgfplots 3d surface": true },
    ranges
  );

  assert.deepEqual(geometry.margin, { left: 0.52, right: 0.43, top: 0.073, bottom: 0.32 });
  assert.ok(Math.abs(geometry.width - (PGFPLOTS_DEFAULT_AXIS_WIDTH - PGFPLOTS_DEFAULT_PERSPECTIVE_3D_RESERVE_X)) < 1e-9);
  assert.ok(Math.abs(geometry.height - (PGFPLOTS_DEFAULT_AXIS_HEIGHT - PGFPLOTS_DEFAULT_PERSPECTIVE_3D_RESERVE_Y)) < 1e-9);

  const origin = geometry.mapPoint3d({ x: ranges.xMin, y: ranges.yMin, z: ranges.zMin });
  const basis = (point) => {
    const mapped = geometry.mapPoint3d(point);
    return { x: mapped.x - origin.x, y: mapped.y - origin.y };
  };
  assertAxisPointsNearlyEqual(basis({ x: ranges.xMax, y: ranges.yMin, z: ranges.zMin }), { x: 4.618, y: -0.776 }, 0.01);
  assertAxisPointsNearlyEqual(basis({ x: ranges.xMin, y: ranges.yMax, z: ranges.zMin }), { x: 2.153, y: 1.665 }, 0.01);
  assertAxisPointsNearlyEqual(basis({ x: ranges.xMin, y: ranges.yMin, z: ranges.zMax }), { x: 0, y: 3.203 }, 0.01);
});

test("pgfplots explicit perspective 3D axes do not add an unpainted right gutter", () => {
  const geometry = createAxisGeometry(
    { width: "15cm", view: "{45}{45}", "pgfplots 3d surface": true },
    { xMin: -90, xMax: 90, yMin: -90, yMax: 90, zMin: -4, zMax: 4 }
  );

  assert.deepEqual(geometry.margin, { left: 0.52, right: 0, top: 0.073, bottom: 0.32 });
  assert.match(renderAxisBounds(geometry), /\(13\.462,11\.429\)/);
});

test("pgfplots default surf domains stay tight instead of inheriting 2D auto enlargement", () => {
  const surface = {
    type: "function",
    is3d: true,
    options: { surf: true },
    expression: "-(x*x/16+y*y/4-1)"
  };

  const ranges = computeAxisRanges({ "pgfplots 3d surface": true }, [surface]);

  assert.deepEqual(
    { xMin: ranges.xMin, xMax: ranges.xMax, yMin: ranges.yMin, yMax: ranges.yMax },
    { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }
  );
  assert.ok(Math.abs(ranges.zMin + 6.8125) < 0.001);
  assert.equal(ranges.zMax, 1);
});

test("pgfplots 3D z labels use the native near-ticklabel default offset", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
\begin{axis}[xlabel=$x$,ylabel=$y$,zlabel=$z$,axis lines=left]
\addplot3[surf] {x+y};
\end{axis}
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });

  const zLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "$z$");
  assert.ok(zLabel, "expected a generated z axis label");
  assert.ok(Math.abs(zLabel.x + 1) < 1e-6, `expected a 1cm z label offset, received ${zLabel.x}`);
});

test("pgfplots axis equal image keeps x and y data units square for top-view surfaces", () => {
  const geometry = createAxisGeometry(
    { "axis equal image": true, "pgfplots 3d surface": true, view: "{0}{90}" },
    { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -1, zMax: 1 }
  );
  const twoDimensionalGeometry = createAxisGeometry(
    { "axis equal image": true },
    { xMin: -2, xMax: 2, yMin: -2, yMax: 2 }
  );

  assert.ok(Math.abs(geometry.width - geometry.height) < 1e-9);
  assert.equal(geometry.width, twoDimensionalGeometry.width);
  assert.equal(geometry.height, twoDimensionalGeometry.height);
  assertAxisPointsNearlyEqual(geometry.mapPoint3d({ x: -2, y: -2, z: 0 }), geometry.mapPoint({ x: -2, y: -2 }));
  assertAxisPointsNearlyEqual(geometry.mapPoint3d({ x: 2, y: 2, z: 0 }), geometry.mapPoint({ x: 2, y: 2 }));
});

test("pgfplots 3d geometry applies view azimuth and elevation projection", () => {
  const topView = createAxisGeometry(
    { "scale only axis": true, width: "4cm", height: "4cm", "pgfplots 3d surface": true, view: "{0}{90}" },
    { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 }
  );
  const bottom = topView.mapPoint3d({ x: 0.25, y: 0.75, z: 0 });
  const top = topView.mapPoint3d({ x: 0.25, y: 0.75, z: 1 });

  assert.ok(Math.abs(top.x - bottom.x) < 1e-9);
  assert.ok(Math.abs(top.y - bottom.y) < 1e-9);

  const oblique = createAxisGeometry(
    { "scale only axis": true, width: "4cm", height: "4cm", "pgfplots 3d surface": true, view: "{155}{45}" },
    { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 }
  );

  assert.notDeepEqual(oblique.mapPoint3d({ x: 0.25, y: 0.75, z: 0 }), oblique.mapPoint3d({ x: 0.25, y: 0.75, z: 1 }));

  const reversed = createAxisGeometry(
    {
      "scale only axis": true,
      width: "4cm",
      height: "4cm",
      "pgfplots 3d surface": true,
      view: "{155}{45}",
      "x dir": "reverse",
      "z dir": "reverse"
    },
    { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 }
  );

  assertAxisPointsNearlyEqual(
    reversed.mapPoint3d({ x: 0.25, y: 0.75, z: 0.2 }),
    oblique.mapPoint3d({ x: 0.75, y: 0.75, z: 0.8 })
  );
});

test("pgfplots 3d geometry defaults to stretch-to-fill plot box scaling", () => {
  const ranges = { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 };
  const geometry = createAxisGeometry(
    { "scale only axis": true, width: "4cm", height: "3cm", "pgfplots 3d surface": true, view: "{10}{65}" },
    ranges
  );
  const corners = [];
  for (const x of [0, 1]) {
    for (const y of [0, 1]) {
      for (const z of [0, 1]) {
        corners.push(geometry.mapPoint3d({ x, y, z }));
      }
    }
  }

  assert.ok(Math.abs(Math.min(...corners.map((point) => point.x))) < 1e-9);
  assert.ok(Math.abs(Math.max(...corners.map((point) => point.x)) - geometry.width) < 1e-9);
  assert.ok(Math.abs(Math.min(...corners.map((point) => point.y))) < 1e-9);
  assert.ok(Math.abs(Math.max(...corners.map((point) => point.y)) - geometry.height) < 1e-9);
});

test("pgfplots default 3d surf z buffer follows native reverse-y scanline order", () => {
  const axisOptions = {
    "pgfplots 3d surface": true,
    view: "{10}{65}",
    samples: "3",
    domain: "-1:1",
    "y domain": "-1:1",
    "colormap name": "whitered",
    "pgfplots colormaps": {
      whitered: [
        { position: 0, color: "white" },
        { position: 1, color: "orange!75!red" }
      ]
    }
  };
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisSurfacePlot(
    { type: "function", is3d: true, options: { surf: true }, expression: "x*y" },
    axisOptions,
    ranges,
    geometry,
    {},
    0
  );

  assert.ok(
    commands[0].includes("(0.511,2.932) -- (3.409,2.648) -- (3.92,4.254) -- (1.022,3.777)"),
    `native default z buffer should start with the reverse-y scanline cell, got ${commands[0]}`
  );

  const sortedCommands = renderAxisSurfacePlot(
    { type: "function", is3d: true, options: { surf: true, "z buffer": "sort" }, expression: "x*y" },
    axisOptions,
    ranges,
    geometry,
    {},
    0
  );
  assert.ok(
    sortedCommands[0].includes("(0,2.086) -- (2.898,1.043) -- (3.409,2.648) -- (0.511,2.932)"),
    `explicit z buffer=sort should still use depth sorting, got ${sortedCommands[0]}`
  );
});

test("pgfplots surf keeps native mesh continuity at isolated zero-over-zero samples", () => {
  const axisOptions = {
    "pgfplots 3d surface": true,
    view: "{335}{50}",
    samples: "3",
    domain: "-1:1",
    "y domain": "-1:1"
  };
  const ranges = { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -0.5, zMax: 0.5 };
  const geometry = createAxisGeometry(axisOptions, ranges);
  const commands = renderAxisSurfacePlot(
    { type: "function", is3d: true, options: { surf: true }, expression: "x*y*y/(x*x+y*y*y*y)" },
    axisOptions,
    ranges,
    geometry,
    {},
    0
  );

  assert.equal(
    commands.filter((command) => command.includes("axis surface fill")).length,
    4,
    "all four cells around the center sample should remain present"
  );
});

test("pgfplots default 3d geometry matches the native Manhattan plot footprint", () => {
  const source = readFileSync("test/fixtures/examples/latex-examples/3d-manhattan-bar-plot.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 206 && size.width <= 209, `expected native content width near 206.3pt, got ${size.width}pt`);
  assert.ok(size.height >= 163 && size.height <= 165, `expected native content height near 163.8pt, got ${size.height}pt`);
});

test("pgfplots 3d compact explicit width keeps native projected plot width", () => {
  const geometry = createAxisGeometry(
    { width: "15cm", view: "{65}{65}", "pgfplots 3d surface": true },
    { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -125, zMax: 150 }
  );
  const projectedWidthPt = geometry.width * 28.45274;

  assert.ok(projectedWidthPt >= 382.5 && projectedWidthPt <= 383.6, `expected 15cm oblique 3D projected box width near tikztosvg 383pt, got ${projectedWidthPt}pt`);
});

test("pgfplots compact 6cm 3d axes preserve the native explicit-width label reserve", () => {
  const geometry = createAxisGeometry(
    { width: "6cm", view: "{155}{45}", "pgfplots 3d surface": true },
    { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -125, zMax: 150 }
  );
  const expected = 6 - parseDimension("43.77pt", {});

  assert.ok(Math.abs(geometry.width - expected) < 1e-9, `expected native 43.77pt reserve, got ${geometry.width}cm`);
});

test("pgfplots oblique 3d colorbar axis bbox keeps native top reserve", () => {
  const source = readFileSync("test/fixtures/implementation-examples/latex-examples-master/3d-function-4.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 437.6 && size.width <= 438.8, `expected width close to tikztosvg 438.17pt, got ${size.width}pt`);
  assert.ok(size.height >= 335.7 && size.height <= 337.1, `expected height close to tikztosvg 336.15pt, got ${size.height}pt`);
});

test("pgfplots oblique 3d scaled z ticks reserve native top space", () => {
  const source = readFileSync("test/fixtures/implementation-examples/latex-examples-master/3d-function-8.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 439.5 && size.width <= 443, `expected width close to tikztosvg 440.48pt, got ${size.width}pt`);
  assert.ok(size.height >= 339.2 && size.height <= 341.1, `expected height close to tikztosvg 339.93pt, got ${size.height}pt`);
});

test("pgfplots top-view axis equal image reserves native y tick label width", () => {
  const source = readFileSync("test/fixtures/implementation-examples/latex-examples-master/3d-gradient-colored.tex", "utf8");
  const result = tikzToSvg(source, { margin: 0, mathRenderer: "svg-text" });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const size = svgDocumentSizePt(result.svg);

  assert.equal(errors.length, 0, errors.map((diagnostic) => diagnostic.message).join("; "));
  assert.ok(size.width >= 186 && size.width <= 187.4, `expected width close to tikztosvg 186.78pt, got ${size.width}pt`);
  assert.ok(size.height >= 181.3 && size.height <= 182.8, `expected height close to tikztosvg 182.02pt, got ${size.height}pt`);
});

test("pgfplots ticks and coordinate parsing preserve preprocess behavior", () => {
  assert.deepEqual(parsePgfplotsCoordinateList("(pi,2) (5,2,3)"), [
    { x: Math.PI, y: 2, raw: "(pi,2)" },
    { x: 5, y: 2, z: 3, raw: "(5,2,3)" }
  ]);
  assert.deepEqual(
    axisTickValues("data", "x", [
      { points: [{ x: 2 }, { x: 2 }, { x: 5 }] }
    ]),
    [2, 5]
  );
  assert.deepEqual(createAxisTickModel({ "xtick distance": "pi/2" }, { xMin: 0, xMax: Math.PI, yMin: 0, yMax: 1 }).x.values, [
    0,
    1.571,
    3.142
  ]);
});
