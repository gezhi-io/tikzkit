import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseAddplots } from "../src/pgfplots/addplotParser.js";
import { matrixPlotKind, matrixPlotSettings, surveyMatrixPlot } from "../src/pgfplots/matrixSurvey.js";

const xy = (x, y) => ({ x, y });
const skew = "(0,0) (2,0)\n\n(0,2) (4,4)";
const six = "(0,0) (1,0) (2,0) (0,1) (1,1) (2,1)";

function parse(source, axis = {}, diagnostics = []) {
  const [plot] = parseAddplots(source, { pgfplotsAxisOptions: axis }, diagnostics);
  return plot;
}

function survey(source, axis = {}, diagnostics = []) {
  return surveyMatrixPlot(parse(source, axis, diagnostics), axis, diagnostics);
}

function bounds(points) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}

test("recognizes the two image styles and low-level surface, not an ordinary surf", () => {
  assert.equal(matrixPlotKind({}, { surf: true }), null);
  assert.equal(matrixPlotKind({}, { "mesh input": "image" }), null);
  assert.equal(matrixPlotKind({ "mesh input": "image" }, { surf: true }), "matrix*");
  assert.equal(matrixPlotKind({ surf: true }, { "mesh input": "image" }), "matrix*");
  assert.equal(matrixPlotKind({ "imagesc*": true }, {}), "matrix*");
  assert.equal(matrixPlotKind({}, { "/pgfplots/imagesc": true }), "matrix");
  assert.equal(matrixPlotKind({ "matrix plot": true }, { "matrix plot*": true }), "matrix");
  assert.equal(matrixPlotKind({ "matrix plot*": true }, { "mesh input": "lattice" }), null);
});

test("styles reset an earlier prefixed shader, z buffer and mesh input, but not a later assignment", () => {
  const axis = Object.freeze({ "/pgfplots/z buffer": "sort", shader: "interp", "/pgfplots/mesh input": "patches" });
  for (const name of ["matrix plot", "matrix plot*", "imagesc", "imagesc*"]) {
    const reset = matrixPlotSettings(axis, { ["/pgfplots/" + name]: true });
    assert.deepEqual([reset["mesh input"],reset.shader,reset["z buffer"]], ["image","flat corner","none"]);
    assert.equal(Object.hasOwn(reset, "/pgfplots/z buffer"), false);
    const override = matrixPlotSettings({ [name]: true }, { "/pgfplots/shader": "interp", "/pgfplots/z buffer": "sort" });
    assert.deepEqual([override.shader,override["z buffer"]], ["interp","sort"]);
  }
  const late = matrixPlotSettings({}, { "/pgfplots/shader": "interp", "imagesc*": true, shader: "faceted" });
  assert.equal(late.shader, "faceted");
  const lowLevel = matrixPlotSettings({ surf: true }, { "mesh input": "image", "z buffer": "default" });
  assert.deepEqual([lowLevel.shader,lowLevel["z buffer"]], ["faceted","none"]);
});

test("reflects native aa,ab,bb,ba corners; ranges follow scanlines, not polygon extrema", () => {
  const plot = parse(`\\addplot[matrix plot*,point meta=\\coordindex] coordinates {${skew}};`);
  const { cells, rangePoints } = surveyMatrixPlot(plot, {});
  assert.deepEqual(cells.map(c => c.corners), [
    [xy(-2.5,-2.5), xy(.5,-1.5), xy(1.5,1.5), xy(-1.5,.5)],
    [xy(.5,-1.5), xy(3.5,-.5), xy(4.5,2.5), xy(1.5,1.5)],
    [xy(-1.5,.5), xy(1.5,1.5), xy(2.5,4.5), xy(-.5,3.5)],
    [xy(1.5,1.5), xy(4.5,2.5), xy(5.5,5.5), xy(2.5,4.5)]
  ]);
  for (const [i, c] of cells.entries()) {
    assert.equal(c.point, plot.points[i]);
    assert.equal(c.index, i);
    assert.equal(c.meta, i);
    assert.equal(c.color, undefined);
  }
  assert.deepEqual(bounds(rangePoints), [-2,6,-1,4]);
  assert.deepEqual(bounds(cells.flatMap(c => c.corners)), [-2.5,5.5,-2.5,5.5]);
});

test("numeric holes retain positions and signed infinities; explicit values do not replace default y", () => {
  const grid = "(0,1)[nan] (1,1)[-inf] (2,1)[inf] (0,2)[0] (1,2)[-3] (2,2)[9]";
  const source = `\\addplot coordinates {${grid}};`;
  const axis = { "matrix plot": true, "mesh/cols": 3 };
  assert.deepEqual(survey(source, axis).cells.map(c => c.meta), [1,1,1,2,2,2]);
  const { cells, rangePoints } = survey(source, { ...axis, "point meta": "explicit" });
  assert.deepEqual(cells.map(c => c.meta), [NaN,-Infinity,Infinity,0,-3,9]);
  assert.equal(cells[0].corners.length, 4);
  assert.deepEqual(bounds(rangePoints), [-.5,2.5,.5,2.5]);
});

test("the manual's distorted 3x3 table uses every neighbor, including its center hole", () => {
  const source = String.raw`\addplot[imagesc,point meta=explicit] table[meta=C] {
    x y C
    0 0 0
    1 -.1 1
    2 .2 2

    -.2 1 3
    1 1 nan
    2 1 5

    0 2 6
    1.3 2 7
    2 2.5 8
  };`;
  const { cells, rangePoints, scanlineLength } = survey(source);
  assert.equal(scanlineLength, 3);
  assert.deepEqual(cells.map(c => c.meta), [0,1,2,3,NaN,5,6,7,8]);
  const expected = [xy(.45,.475),xy(1.5,.525),xy(1.575,1.625),xy(.525,1.5)];
  cells[4].corners.forEach((p,i) => {
    assert.ok(Math.abs(p.x - expected[i].x) < 1e-12);
    assert.ok(Math.abs(p.y - expected[i].y) < 1e-12);
  });
  assert.deepEqual(bounds(rangePoints), [-.8,2.5,-.2,2.5]);
});

test("explicit mesh colors distinguish empty input from valid black, gray and named colors", () => {
  const axis = { "matrix plot*": true, "mesh/color input": "explicit" };
  const { cells } = survey(String.raw`\addplot coordinates {
    (0,0)[color=red] (1,0)[] (2,0)[rgb=0,0,0] \par
    (0,1)[gray=0.5] (1,1)[1,0,1] (2,1)
  };`, axis);
  assert.deepEqual(cells.map(c => c.color), ["red",null,"rgb(0 0 0)","rgb(127.5 127.5 127.5)","rgb(255 0 255)",null]);
  assert.ok(cells.every(c => !Number.isFinite(c.meta)));
  assert.deepEqual(cells.map(c => c.index), [0,1,2,3,4,5]);
});

test("table scanlines and selected meta survive the parser, including blank color cells", () => {
  const source = String.raw`\addplot[matrix plot*,mesh/ordering=y varies,mesh/color input=explicit]
    table[x=X,y=Y,meta=C] {
      Y X C
      5 2 color=blue
      3 2 {}
      0 2 color=red

      5 8 color=yellow
      3 8 color=green
      0 8 0,0,0
    };`;
  const plot = parse(source);
  assert.deepEqual(plot.coordinateRows.map(r => r.length), [3,3]);
  const { cells, rangePoints } = surveyMatrixPlot(plot, {});
  assert.deepEqual(cells.map(c => c.color), ["blue",null,"red","yellow","green","rgb(0 0 0)"]);
  assert.deepEqual(cells[1].corners, [xy(-1,4),xy(-1,1.5),xy(5,1.5),xy(5,4)]);
  assert.deepEqual(bounds(rangePoints), [-1,11,-1.5,6]);
});

test("explicit row separator, table/meta index, dims and plot-level ordering override axis settings", () => {
  const table = String.raw`table[row sep=\\,meta index=2] {
    x y C\\
    0 0 9\\1 0 8\\2 0 nan\\
    0 2 5\\1 2 4\\2 2 3\\
  };`;
  const axis = { "matrix plot*": true, "mesh/ordering": "colwise", "mesh/cols": 3 };
  const source = `\\addplot[mesh/ordering=rowwise,point meta=explicit] ${table}`;
  const { cells, rangePoints } = survey(source, axis);
  assert.deepEqual(cells.map(c => c.meta), [9,8,NaN,5,4,3]);
  assert.deepEqual(bounds(rangePoints), [-.5,2.5,-1,3]);
  const expr = survey(`\\addplot[mesh/ordering=rowwise,point meta={\\thisrow{C}+\\coordindex}] ${table}`, axis);
  assert.deepEqual(expr.cells.map(c => c.meta), [9,9,NaN,8,8,8]);
});

test("invalid mesh dimensions and source yield a diagnostic and no partial cells", () => {
  for (const [kind, source] of [
    ["DIMENSIONS", `\\addplot[matrix plot] coordinates {${six}};`],
    ["DIMENSIONS", `\\addplot[matrix plot,mesh/rows=3,mesh/cols=3] coordinates {${six}};`],
    ["DIMENSIONS", `\\addplot[matrix plot,mesh/cols=2.5] coordinates {${six}};`],
    ["DIMENSIONS", `\\addplot[matrix plot,mesh/cols=1] coordinates {${six}};`],
    ["DIMENSIONS", "\\addplot[matrix plot] coordinates {(0,0) (1,0)\n\n(0,2)};"],
    ["SOURCE", "\\addplot[matrix plot,mesh/cols=2] table[meta=absent] {x y\n0 0\n1 0\n0 1\n1 1};"],
    ["SOURCE", "\\addplot[matrix plot,mesh/cols=2] coordinates {(0,0) (1,0) (0,1) (1,1) (2,2)+bad};"],
    ["SOURCE", "\\addplot[matrix plot,mesh/cols=2] coordinates {(0,0) (1,0) (nan,2) (1,2)};"],
    ["SOURCE", "\\addplot[matrix plot] coordinates {};"],
    ["SOURCE", "\\addplot3[matrix plot] coordinates {(0,0,1)};"],
    ["SOURCE", "\\addplot[matrix plot] {x};"]
  ]) {
    const diagnostics = [];
    assert.equal(survey(source, {}, diagnostics), null, source);
    assert.ok(diagnostics.some(d => d.code === "PGFPLOTS_MATRIX_" + kind && d.severity === "error"), source);
  }
  const diagnostics = [];
  assert.equal(survey("\\addplot coordinates {(0,0)};", {}, diagnostics), null);
  assert.deepEqual(diagnostics, []);
});

const limitCases = [
  ["", skew, [-2,6,-1,4]],
  ["mesh/cols=2", skew.replace("\n\n"," "), [-2,6,-1,4]],
  ["mesh/rows=2", skew.replace("\n\n"," "), [-1,6,0,4]],
  ["empty line=none,mesh/cols=2", skew, [-1,4,0,4]],
  ["mesh/cols=3", "(0,0) (1,0)\n\n(2,0) (0,2) (1,2) (2,2)", [-.5,3,0,2]],
  ["", "(0,0)\n\n(2,0) (0,2) (4,4)", [0,6,0,4]]
];

test("limits use only scanline ends known during the survey", () => {
  for (const [opts, coords, expected] of limitCases) {
    const diagnostics = [];
    const result = survey(`\\addplot[matrix plot*,${opts}] coordinates {${coords}};`, {}, diagnostics);
    assert.equal(result.cells.length, (coords.match(/\(/g) || []).length);
    assert.deepEqual(bounds(result.rangePoints), expected, opts);
    assert.equal(diagnostics.some(d => d.code === "PGFPLOTS_MATRIX_LIMITS"), opts.startsWith("mesh/rows") || opts.startsWith("empty line"));
  }
});

test("installed PGFPlots agrees on numeric limits, without rendering a PDF", t => {
  const engine = process.env.QA_LATEX_ENGINE || "pdflatex";
  if (spawnSync(engine, ["--version"]).error?.code === "ENOENT") return t.skip("TeX not installed");
  const dir = mkdtempSync(join(tmpdir(), "pgfplots-matrix-survey-"));
  try {
    const body = limitCases.map(([opts, coords], i) => String.raw`\begin{tikzpicture}
      \begin{axis}[hide axis,enlargelimits=false]\addplot[matrix plot*,${opts}] coordinates {${coords}};
      \pgfplotsextra{\typeout{M|${i}|\pgfkeysvalueof{/pgfplots/xmin}|\pgfkeysvalueof{/pgfplots/xmax}|\pgfkeysvalueof{/pgfplots/ymin}|\pgfkeysvalueof{/pgfplots/ymax}}}
      \end{axis}\end{tikzpicture}`);
    writeFileSync(join(dir, "probe.tex"), [String.raw`\documentclass{article}\usepackage{pgfplots}\pgfplotsset{compat=1.18}\begin{document}`,
      ...body, "\\end{document}"].join("\n"));
    const run = spawnSync(engine, ["-no-shell-escape", "-draftmode", "-halt-on-error", "-interaction=nonstopmode", "probe.tex"],
      { cwd: dir, encoding: "utf8", timeout: 20000, env: { ...process.env, max_print_line: "500" } });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout.slice(-2000));
    const logs = [...run.stdout.matchAll(/^M\|(\d+)\|([^\r\n]+)$/gm)];
    assert.equal(logs.length, limitCases.length);
    for (const [, i, record] of logs) {
      const [opts, coords] = limitCases[i];
      const { rangePoints } = survey(`\\addplot[matrix plot*,${opts}] coordinates {${coords}};`);
      assert.deepEqual(bounds(rangePoints), record.split("|").map(Number), opts);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
