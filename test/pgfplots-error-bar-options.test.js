import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseOptions } from "../src/engine/options.js";
import { createAxisOptions } from "../src/pgfplots/axisOptions.js";
import { errorBarEndpoints, resolveErrorBarOptions, resolvePlotErrorBars } from "../src/pgfplots/errorBars.js";

const config = (axis = "", plot = "") => resolveErrorBarOptions(parseOptions(axis), parseOptions(plot));
const endpoint = (axis, side, x, y) => ({ axis, side, x, y });

test("direction enables a dimension, not an error value or a point's payload", () => {
  assert.equal(config(), null);
  assert.equal(config("error bars/y explicit,error bars/x fixed=3"), null);
  assert.equal(config("error bars/z dir=both,error bars/z fixed=1"), null);
  assert.equal(config("x dir=reverse,y dir=both,mark=o"), null);
  assert.equal(config("error bars/y dir=both", "error bars/y dir=none"), null);
  assert.deepEqual(errorBarEndpoints({ x: 3, y: 5, errors: { y: { plus: 7 } } }, null), []);
  const c = config("every error bar/.append style={}", "/pgfplots/error bars/.cd,y dir=both");
  assert.deepEqual(c, { x: { dir: "none", mode: "fixed", value: 0 }, y: { dir: "both", mode: "fixed", value: 0 },
    barStyle: { thin: true }, mark: "-", markOptions: { rotate: "90" } });
  assert.deepEqual(errorBarEndpoints({ x: 2, y: 3 }, c), [endpoint("y","plus",2,3), endpoint("y","minus",2,3)]);
});

test("prefixed, .cd and grouped forms agree; neither directory nor overrides leak", () => {
  const expected = config("error bars/x dir=minus,/pgfplots/error bars/x fixed relative=.25,error bars/y dir=plus,error bars/y explicit");
  assert.deepEqual(config("error bars/.cd,x dir=minus,x fixed relative=.25,y dir=plus,y explicit"), expected);
  assert.deepEqual(config("error bars={x dir=minus,x fixed relative=.25,y dir=plus,y explicit}"), expected);
  assert.deepEqual(resolveErrorBarOptions({ "error bars": { "x dir": "minus", "x fixed relative": .25,
    "y dir": "plus", "y explicit": true } }), expected);
  assert.equal(config("error bars/.cd,x fixed=1,/pgfplots/.cd,y dir=both"), null);
  assert.equal(config("error bars/.cd,x fixed=1,/tikz/.cd,x dir=plus"), null);
  assert.equal(config("error bars/.cd,x fixed=1", "x dir=plus"), null);
  assert.equal(config("error bars={x fixed=1},y dir=both"), null);
  const axis = parseOptions("error bars/x dir=both,error bars/x fixed=2");
  const points = Object.freeze({ x: 10, y: 3 });
  assert.deepEqual(errorBarEndpoints(points, resolveErrorBarOptions(axis, { "error bars": "x dir=minus,x explicit" })), []);
  assert.deepEqual(errorBarEndpoints(points, resolveErrorBarOptions(axis)), [endpoint("x","plus",12,3), endpoint("x","minus",8,3)]);
});

test("axis normalization preserves absolute family keys and scope resets", () => {
  const raw = parseOptions("/pgfplots/error bars/.cd,x fixed=2,/pgfplots/error bars/y dir=plus," +
    "/pgfplots/every error bar/.style={red},/pgfplots/.cd,x dir=reverse");
  const normalized = resolvePlotErrorBars(createAxisOptions(raw), { options: {} });
  assert.deepEqual(normalized, resolveErrorBarOptions(raw));
  assert.equal(normalized.x.dir, "none");
  assert.equal(normalized.x.value, 2);
  assert.equal(normalized.y.dir, "plus");
  assert.deepEqual(normalized.barStyle, { red: true });
});

test("every error bar can be replaced or extended; mark options replace rather than append", () => {
  const axis = Object.freeze(parseOptions("every error bar/.append style={dashed,draw=blue},error bars/y dir=plus," +
    "error bars/error bar style={line width=.8pt},error bars/error mark=o,error bars/error mark options={rotate=30,fill=white}"));
  const plot = parseOptions("ultra thick,mark=*,error bars/.cd,error bar style={draw=red,line width=1.1pt}," +
    "error mark=+,error mark options={mark size=4pt}");
  const c = resolveErrorBarOptions(axis, plot);
  assert.deepEqual(c.barStyle, { thin: true, dashed: true, draw: "red", "line width": "1.1pt" });
  assert.equal(c.mark, "+"); assert.deepEqual(c.markOptions, { "mark size": "4pt" });
  const other = resolveErrorBarOptions(axis);
  assert.deepEqual(other.barStyle, { thin: true, dashed: true, draw: "blue", "line width": ".8pt" });
  assert.equal(other.mark, "o"); assert.deepEqual(other.markOptions, { rotate: "30", fill: "white" });
  const replaced = resolveErrorBarOptions(axis, parseOptions("every error bar/.style={green,very thick}," +
    "every error bar/.prefix style={draw=black},error bars/error mark options={}"));
  assert.deepEqual(Object.entries(replaced.barStyle), [["draw","black"],["green",true],["very thick",true]]);
  assert.deepEqual(replaced.markOptions, {});
  const repeated = resolveErrorBarOptions(axis, "error bars/.cd,error bar style={opacity=.5},error bar style={draw=purple}");
  assert.deepEqual(Object.entries(repeated.barStyle).slice(-2), [["opacity",".5"],["draw","purple"]]);
});

test("fixed and explicit survey preserves signed coordinates, signed errors, and source side order", () => {
  const c = config("error bars/.cd,x dir=both,x fixed relative=.25,y dir=minus,y fixed=-2");
  assert.deepEqual(errorBarEndpoints({ x: -8, y: 6, errors: { x: { plus: 100 } } }, c), [
    endpoint("x","plus",-10,6), endpoint("x","minus",-6,6), endpoint("y","minus",-8,8)
  ]);
  const e = config("", "error bars/.cd,x dir=both,x explicit relative,y dir=both,y explicit");
  assert.deepEqual(errorBarEndpoints({ x: -8, y: -6, errors: { x: { plus: ".25", minus: ".5" }, y: { plus: -2, minus: -3 } } }, e), [
    endpoint("x","plus",-10,-6), endpoint("x","minus",-4,-6), endpoint("y","plus",-8,-8), endpoint("y","minus",-8,-3)
  ]);
  assert.deepEqual(errorBarEndpoints({ x: 0, y: 6, errors: { x: { plus: 3, minus: 0 }, y: { minus: 0 } } }, e), [
    endpoint("x","plus",0,6), endpoint("x","minus",0,6), endpoint("y","minus",0,6)
  ]);
});

test("missing, empty and unbounded errors skip just that side; zero is not missing", () => {
  const c = config("error bars/.cd,x dir=both,x explicit,y dir=both,y explicit");
  assert.deepEqual(errorBarEndpoints({ x: 1, y: 2 }, c), []);
  for (const missing of [undefined, null, "", "   ", NaN, "nan", Infinity, "-inf", false]) {
    const p = { x: 1, y: 2, errors: { x: { plus: missing, minus: 4 }, y: { plus: "0e2", minus: missing } } };
    assert.deepEqual(errorBarEndpoints(p, c), [endpoint("x","minus",-3,2), endpoint("y","plus",1,2)]);
  }
  assert.deepEqual(errorBarEndpoints({ x: 1, y: 2, errors: { x: { minus: 4 }, y: { plus: 1 } } },
    config("error bars/.cd,x dir=plus,x explicit,y dir=minus,y explicit")), []);
  assert.deepEqual(errorBarEndpoints({ x: "", y: 4, errors: { y: { plus: 2 } } }, c), []);
});

test("the shared survey/render gate accepts grouped bars and excludes unreviewed handlers", () => {
  const on = { "error bars/y dir": "both" };
  const ordinaryAxis = { get title() { assert.fail("non-error path read unrelated options"); } };
  const ordinaryPlot = { get points() { assert.fail("non-error path inspected its data"); }, options: { mark: "*", "pgfplots explicit options": true } };
  assert.equal(resolvePlotErrorBars(ordinaryAxis, ordinaryPlot), null);
  for (const flags of [{ is3d: true }, { pgfplotsStacked: true }, { histogram: { bins: 3 } }]) {
    assert.equal(resolvePlotErrorBars(on, flags), null);
  }
  for (const opts of [{ "pgfplots 3d surface": true }, { "pgfplots ternary axis": true }, { xmode: "log" },
    { "y scale": "log" }, { "stack plots": "y" }, { "xbar stacked": true }, { "ybar interval stacked": true },
    { "/pgfplots/xmode/log": true }, { "stack plots/y": true }, { "xbar interval": ".8" },
    { "/tikz/ybar interval": true }, { hist: "bins=4" }]) {
    assert.equal(resolvePlotErrorBars({ ...on, ...opts }, { options: {} }), null);
    assert.equal(resolvePlotErrorBars(on, { options: opts }), null);
  }
  for (const flag of ["xbar", "ybar"]) {
    const plot = { options: { [flag]: true, "stack plots": "false" }, barGroup: { direction: flag[0] } };
    assert.deepEqual(resolvePlotErrorBars(on, plot), resolveErrorBarOptions(on, plot.options));
  }
});

test("replay linear survey and paint defaults against installed PGFPlots",
  { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" }, t => {
    const cases = [
      { id: "zero", plot: "ultra thick,error bars/.cd,y dir=both", coords: "(2,3)", points: [{ x: 2, y: 3 }] },
      { id: "signed", axis: "error bars/x dir=both,error bars/x fixed relative=.25",
        plot: "error bars/.cd,y dir=minus,y fixed relative=-.5", coords: "(-8,6) (0,0)", points: [{ x:-8,y:6 },{ x:0,y:0 }] },
      { id: "missing", plot: "error bars/.cd,x dir=both,x explicit,y dir=both,y explicit",
        coords: "(2,4) += (-1,0) (5,7) -= (2,1) (1,2) +- (nan,3) (3,3)", points: [
          { x:2,y:4,errors:{ x:{plus:-1},y:{plus:0} } }, { x:5,y:7,errors:{ x:{minus:2},y:{minus:1} } },
          { x:1,y:2,errors:{ x:{plus:NaN,minus:NaN},y:{plus:3,minus:3} } }, { x:3,y:3 }] },
      { id: "asym", plot: "error bars/.cd,x dir=both,x explicit relative,y dir=both,y explicit relative",
        coords: "(-8,-6) += (.25,.5) -= (.5,-.5)", points: [{ x:-8,y:-6,errors:{ x:{plus:.25,minus:.5},y:{plus:.5,minus:-.5} } }] },
      { id: "style", axis: "error bars/y dir=both,error bars/y fixed=1,error bars/error bar style={thick,blue}," +
        "error bars/error mark=o,error bars/error mark options={rotate=30,mark size=3pt}",
        plot: "ultra thick,error bars/.cd,error bar style={line width=1.1pt,red},error mark=+,error mark options={mark size=4pt}",
        coords: "(0,1)", points: [{ x:0,y:1 }], width: 1.1 },
      { id: "every", axis: "every error bar/.style={line width=1.4pt},error bars/y dir=plus",
        plot: "error bars/y fixed=1", coords: "(1,2)", points: [{ x:1,y:2 }], width: 1.4 },
      { id: "decimal", plot: "error bars/.cd,x dir=both,x fixed relative=.123,y dir=both,y fixed=-.287",
        coords: "(-3.7,2.9)", points: [{ x:-3.7,y:2.9 }], tolerance: 2e-6 }
    ];
    const tmp = mkdtempSync(join(tmpdir(), "pgfplots-error-bars-"));
    try {
      const source = String.raw`\documentclass{article}\usepackage{pgfplots}\pgfplotsset{compat=1.18}
\makeatletter
\let\realstream\pgfplots@PREPARE@errorbar@stream@it@
\def\pgfplots@PREPARE@errorbar@stream@it@#1#2{\begingroup
  \pgfplotscoordmath{x}{tostring}{\pgfplots@current@point@x}\let\px\pgfmathresult
  \pgfplotscoordmath{y}{tostring}{\pgfplots@current@point@y}\let\py\pgfmathresult
  \pgfplotscoordmath{#1}{tostring}{\pgfplots@error@coord}
  \typeout{E|\id|\px|\py|#1|#2|\pgfmathresult}\endgroup\realstream#1#2}
\let\realbar\pgfplots@errorbar@draw
\def\pgfplots@errorbar@draw#1#2{\begingroup
  \pgfkeysgetvalue{/pgfplots/error bars/error mark}{\mm}\pgfkeysgetvalue{/pgfplots/error bars/error mark options}{\mo}
  \typeout{P|\id|\number\pgflinewidth|\mm|\mo}\endgroup\realbar{#1}{#2}}
\begin{document}
` + cases.map(c => String.raw`\begingroup\def\id{${c.id}}\begin{tikzpicture}
\begin{axis}[hide axis,width=4cm,height=4cm,xmin=-12,xmax=12,ymin=-12,ymax=12,${c.axis ?? ""}]
\addplot[${c.plot}] coordinates {${c.coords}};\end{axis}\end{tikzpicture}\endgroup`).join("\n") + "\\end{document}";
      writeFileSync(join(tmp,"probe.tex"), source);
      const run = spawnSync("pdflatex", ["-no-shell-escape","-interaction=nonstopmode","-halt-on-error","probe.tex"],
        { cwd: tmp, encoding: "utf8" });
      assert.equal(run.status, 0, run.error?.message ?? run.stdout?.slice(-1600));
      const lines = readFileSync(join(tmp,"probe.log"), "utf8").split(/\r?\n/);
      let count = 0, maxDelta = 0;
      for (const c of cases) {
        const resolved = config(c.axis, c.plot);
        const endpoints = c.points.flatMap(p => errorBarEndpoints(p, resolved));
        const surveyed = lines.filter(l => l.startsWith("E|" + c.id + "|")).map(l => {
          const [,, x,y,axis,side,value] = l.split("|");
          return { ...endpoint(axis, side === "+" ? "plus" : "minus", +x, +y), [axis]: +value };
        });
        const order = points => points.map(({ axis, side }) => [axis, side]);
        assert.deepEqual(order(endpoints), order(surveyed), c.id);
        for (const [i, point] of endpoints.entries()) {
          for (const key of ["x", "y"]) {
            const delta = Math.abs(point[key] - surveyed[i][key]);
            assert.ok(delta <= (c.tolerance ?? 0), `${c.id} endpoint ${i} ${key}: ${point[key]} vs ${surveyed[i][key]}`);
            maxDelta = Math.max(maxDelta, delta);
          }
        }
        const paint = lines.filter(l => l.startsWith("P|" + c.id + "|"));
        assert.equal(paint.length, endpoints.length, c.id + " paint count");
        for (const line of paint) {
          const [,, pen, mark, markOptions] = line.split("|");
          assert.equal(+pen, Math.round((c.width ?? .4) * 65536), c.id + " pen");
          assert.equal(mark, resolved.mark);
          assert.deepEqual(parseOptions(markOptions), resolved.markOptions);
        }
        count += paint.length;
      }
      t.diagnostic(`${cases.length} original PGFPlots plots, ${count} surveyed and painted endpoints; max coordinate difference ${maxDelta.toPrecision(2)} data units`);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
