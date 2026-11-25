import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseOptions } from "../src/engine/options.js";
import { renderAddplot } from "../src/pgfplots/addplotLowering.js";
import { applyPgfplotsCycleStyles } from "../src/pgfplots/axisTikzLowering.js";

// Geometry/ink oracle: MacTeX 2025, compat=1.18, x=y=1cm, statistics
// library, dvisvgm driver. Exercise the contract *after* the data survey.
const ranges = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
const frame = { lineRanges: ranges, mapPoint: ({ x, y }) => ({ x, y }) };
const cmPerPt = 2.54 / 72.27;
const stats = { direction: "x", position: 3, relativeAnchor: .25, boxExtend: 2, whiskerExtend: 1,
  lowerWhisker: 1, lowerQuartile: 2, median: 4, average: 4.5, upperQuartile: 6, upperWhisker: 8,
  outliers: [0, 9], ensureMark: true, partStyles: {} };
const series = (options = {}, box = {}, points = [{ x: 0, y: 3 }, { x: 9, y: 3 }]) => ({
  type: "coordinates", options, boxplot: { ...stats, ...box }, points
});

function paths(commands) {
  const { ir, diagnostics } = tikzToSvg(`\\begin{tikzpicture}\n${commands.join("\n")}\n\\end{tikzpicture}`);
  assert.deepEqual(diagnostics, []);
  return ir.items.filter(item => item.type === "path");
}

function lower(plot, axis = {}, geometry = frame, deferred = [], index = 0) {
  const commands = renderAddplot(plot, axis, ranges, geometry, {}, index, deferred);
  return { body: paths(commands), later: paths(deferred ?? []) };
}

const vertices = path => path.commands.map(c => c.type === "closePath" ? "Z" : [c.x, c.y]);
const centered = paths => paths.map(({ cx, cy }) => [cx, cy]);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00001, `${actual} != ${expected}`);
const inks = path => [path.style.stroke, path.style.fill];
const summaryRoles = ["whisker", "whisker", "box", "median", "average"].map(role => "axis-boxplot-" + role);

for (const [direction, handler] of [["x", "boxplot prepared"], ["y", "boxplot"]]) {
  test(`${handler}: native ${direction}-direction visits two compound whiskers, box, median, average, then outliers`, () => {
    const xy = (a, b) => direction === "x" ? [a, b] : [b, a];
    // Prepared draw position can come from the row: it is not recoverable
    // from the scalar outlier values and the final category position.
    const centers = [xy(0, 2), xy(9, 3)];
    const plot = series({ [handler]: true }, { direction }, centers.map(([x, y]) => ({ x, y })));
    const { body, later } = lower(plot);
    assert.deepEqual(body.map(path => path.subtype), summaryRoles);
    const [lo, hi, box, median, avg] = body;
    for (const [path, q, w] of [[lo, 2, 1], [hi, 6, 8]]) {
      assert.deepEqual(path.commands.map(c => c.type), ["moveTo", "lineTo", "moveTo", "lineTo"]);
      assert.deepEqual(vertices(path), [xy(q, 3), xy(w, 3), xy(w, 2.75), xy(w, 3.75)]);
    }
    const [[x0, y0], [x1, y1]] = [xy(2, 2.5), xy(6, 4.5)];
    assert.deepEqual(vertices(box), [[x0,y0], [x0,y1], [x1,y1], [x1,y0], "Z"]);
    assert.deepEqual(vertices(median), [xy(4, 2.5), xy(4, 4.5)]);
    const [mx, my] = xy(4.5, 3.5); // box cs:average,0.5, not boxplot cs:average
    assert.equal(avg.commands.length, 5);
    near(avg.commands[0].x, mx); near(avg.commands[0].y, my + 2 * cmPerPt);
    near(avg.commands[1].x, mx + 1.5 * cmPerPt); near(avg.commands[1].y, my);
    assert.deepEqual(inks(box), ["black", "none"]);
    assert.deepEqual(inks(avg), ["black", "black"]);
    assert.deepEqual(centered(later), centers);
    assert.ok(later.every(path => path.subtype === "axis-boxplot-outlier"));
  });
}

test("each part starts a fresh draw; the average uses the active inks, not every mark or deferred path paint", () => {
  const options = parseOptions("color=blue,fill=white,draw=none,mark=square*,mark options={draw=red,fill=blue,mark size=5pt},very thick,dashed,opacity=.6,boxplot prepared");
  const partStyles = {
    whisker: { draw: "red", fill: "none", "line width": "1pt" },
    box: { draw: "none", fill: "red", opacity: ".35" },
    average: { "/tikz/mark": "triangle*", "mark size": "4pt", draw: "red", fill: "red", "line width": "2pt" }
  };
  const { body: [lo, hi, box, median, avg], later: [out] } = lower(series(options, { partStyles }));
  assert.deepEqual([lo, hi, box, median, avg, out].map(inks), [
    ["red","none"], ["red","none"], ["none","red"], ["blue","white"], ["blue","white"], ["red","blue"]
  ]);
  near(lo.style.lineWidth, cmPerPt * 100);
  near(avg.style.lineWidth, 1.2 * cmPerPt * 100);
  assert.equal(box.style.fillOpacity, .35);
  for (const item of [lo, hi, median, avg, out]) {
    assert.equal(item.style.strokeOpacity, .6);
    assert.deepEqual(item.style.dashArray, median.style.dashArray);
  }
  assert.equal(avg.commands.length, 4);
  near(avg.commands[0].y, 3.5 + 4 * cmPerPt);
  near(out.commands[0].x, -5 * cmPerPt);
});

test("part styles can reuse disabled inks without enabling fill on the other parts", () => {
  const options = parseOptions("color=blue,draw=red,draw=none,fill=white,fill=none,boxplot");
  const { body } = lower(series(options, { partStyles: { box: { fill: true }, median: { blue: true } } }));
  assert.deepEqual(body.map(inks), [
    ["red","none"], ["red","none"], ["red","white"], ["blue","none"], ["red","white"]
  ]);
});

test("only an absent average style installs the default diamond", () => {
  const options = parseOptions("boxplot prepared,mark=none");
  const defaults = lower(series(options));
  assert.deepEqual(defaults.body.map(p => p.subtype), summaryRoles);
  assert.equal(defaults.later.length, 0);
  const replaced = lower(series(options, { partStyles: { average: {} } }));
  assert.deepEqual(replaced.body.map(p => p.subtype), summaryRoles.slice(0, 4));
  const inherited = lower(series({ ...options, mark: "o" }, { partStyles: { average: {} } }));
  assert.equal(inherited.body.at(-1).shape, "circle");
  assert.deepEqual(inks(inherited.body.at(-1)), ["black", "none"]);
});

test("ensure mark executes at handler selection, leaving subsequent mark options in charge", () => {
  for (const handler of ["boxplot", "boxplot prepared"]) {
    for (const [keys, ensureMark, kind] of [
      [handler, false, null], [handler, true, "circle"], ["mark=none," + handler, true, "circle"],
      [handler + ",mark=none", true, null], [handler + ",mark={}", true, null],
      ["mark=+,mark=none," + handler + ",mark=square*", true, "square"],
      ["mark=+," + handler + ",/tikz/mark=none", true, null],
      [handler + ",mark options={mark=none}", true, null],
      [handler + ",every mark/.append style={mark=square*}", true, "square"],
      [handler + ",mark options={mark=*}", false, null],
      ["mark=o," + handler, false, "open"]
    ]) {
      const { body, later } = lower(series(parseOptions(keys), { ensureMark }));
      assert.equal(body.length, 5, keys); // average is independent of the outlier mark
      assert.equal(later.length, kind === null ? 0 : 2, keys);
      if (kind === "circle" || kind === "open") {
        assert.equal(later[0].shape, "circle");
        assert.equal(later[0].style.fill, kind === "open" ? "none" : "black");
      } else if (kind === "square") {
        near(later[0].commands[0].x, -2 * cmPerPt);
        near(later[0].commands[0].y, 3 - 2 * cmPerPt);
      }
    }
  }
});

test("the resolved cycle supplies outlier shape and ink, but not the average marker fill", () => {
  const plot = series({ "pgfplots plus": true, "boxplot prepared": true });
  const cycled = applyPgfplotsCycleStyles([series(), plot])[1];
  const { body, later } = lower(cycled, {}, frame, [], 1);
  assert.deepEqual(inks(body[2]), ["red", "none"]);
  assert.deepEqual(inks(body[4]), ["red", "red"]);
  assert.deepEqual(inks(later[0]), ["red", "rgb(204 0 0)"]);
  near(later[0].commands[0].x, -2 * cmPerPt);
  const reset = lower({ ...cycled, options: { ...cycled.options, "mark options": "mark size=3pt" } });
  assert.deepEqual(inks(reset.later[0]), ["red", "red"]);
  near(reset.later[0].commands[0].x, -3 * cmPerPt);
  const custom = { pgfplotsCycleLists: { pens: [{ blue: true, mark: "none" }] } };
  const [noMarkCycle] = applyPgfplotsCycleStyles([plot], { "cycle list name": "pens" }, custom);
  assert.deepEqual(centered(lower(noMarkCycle).later), [[0,3], [9,3]]);
});

test("missing quartiles short-circuit whiskers; a zero median is still painted", () => {
  const { body } = lower(series({ boxplot: true }, { upperQuartile: null, median: 0, average: null }));
  assert.deepEqual(body.map(vertices), [
    [[8,3],[1,3],[1,2.75],[1,3.75]], [[1,3],[8,3],[8,2.75],[8,3.75]], [[0,2.5],[0,4.5]]
  ]);
});

test("reversed enlarged viewport clips the actual summary; only accepted outlier centers reach the mark phase", () => {
  const geometry = { lineRanges: { ...ranges, xMin: -1, xMax: 11 }, mapPoint: ({ x, y }) => ({ x: 10 - x, y }) };
  const rect = { minX: -1, minY: 0, maxX: 11, maxY: 10 };
  const points = [-1.1, -1, 10.5, 12].map(x => ({ x, y: 3 }));
  const plot = series({ "boxplot prepared": true }, { lowerWhisker: -2, average: 11.01 }, points);
  const global = lower(plot, {}, geometry);
  for (const path of global.body) assert.deepEqual(path.clipRect, rect);
  assert.equal(global.body[0].commands[1].x, 12); // no replacement cap at the clip edge
  assert.deepEqual(centered(global.later), [[11,3], [-.5,3]]);
  assert.ok(global.later.every(path => !path.clipRect));
  for (const clipMarkers of [true, false]) {
    const { body } = lower(plot, { "clip mode": "individual", "clip marker paths": clipMarkers }, geometry, null);
    assert.deepEqual(centered(body.slice(5)), [[11,3], [-.5,3]]);
    for (const path of body.slice(5)) assert.deepEqual(path.clipRect, clipMarkers ? rect : undefined);
  }
  const off = lower(plot, { clip: false, "clip marker paths": true }, geometry, null).body;
  assert.ok(off.every(path => !path.clipRect));
  assert.deepEqual(centered(off.slice(5)), [[11.1,3], [11,3], [-.5,3], [-2,3]]);
});

test("a plot-local clip=false disables the center test but cannot remove an enclosing global clip", () => {
  const plot = series({ "boxplot prepared": true, clip: false }, {}, [{ x: -1, y: 3 }]);
  const global = lower(plot);
  assert.ok(global.body.every(path => path.clipRect));
  assert.deepEqual(centered(global.later), [[-1,3]]);
  assert.equal(global.later[0].clipRect, undefined);
  const individual = lower(plot, { "clip mode": "individual" }, frame, null);
  assert.ok(individual.body.every(path => !path.clipRect));
  assert.deepEqual(centered(individual.body.slice(5)), [[-1,3]]);
});

test("raw and prepared twins have the same paths; only the outlier phase moves between plots", () => {
  for (const [mode, defer, clipMarks] of [["", true, false], ["clip mode=individual", false, false],
    ["clip marker paths=true", false, true]]) {
    const { ir, diagnostics } = tikzToSvg(String.raw`\usepgfplotslibrary{statistics}\pgfplotsset{compat=1.18}
      \begin{tikzpicture}\begin{axis}[hide axis,scale only axis,width=10cm,height=5cm,
        xmin=0,xmax=20,ymin=0,ymax=5,enlargelimits=false,${mode}]
        \addplot+[boxplot={draw position=2,average=auto}]
          coordinates {(99,0)(99,1)(99,2)(99,3)(99,4)(99,5)(99,6)(99,7)(99,20)};
        \addplot+[boxplot prepared={draw position=2,lower whisker=0,lower quartile=2,median=4,
          upper quartile=6,upper whisker=7,average=16/3}] coordinates {(99,20)};
      \end{axis}\end{tikzpicture}`);
    assert.deepEqual(diagnostics, []);
    assert.ok(!ir.items.some(p => ["axis-plot", "axis-mark"].includes(p.subtype)));
    const series = ir.items.filter(p => p.subtype?.startsWith("axis-boxplot-"));
    const out = "axis-boxplot-outlier";
    assert.deepEqual(series.map(p => p.subtype), defer
      ? [...summaryRoles, ...summaryRoles, out, out] : [...summaryRoles, out, ...summaryRoles, out]);
    const groups = ["blue", "red"].map(color => series.filter(p => p.style.stroke === color));
    assert.deepEqual(groups[0].slice(0, 5).map(vertices), groups[1].slice(0, 5).map(vertices));
    assert.deepEqual(groups.map(group => group.at(-1).style.fill), ["rgb(0 0 204)", "rgb(204 0 0)"]);
    for (const group of groups) {
      assert.equal(group.length, 6);
      for (const item of group.slice(0, 5)) assert.deepEqual(item.clipRect, { minX: 0, minY: 0, maxX: 10, maxY: 5 });
      assert.equal(Boolean(group[5].clipRect), clipMarks);
    }
  }
});

test("boundary marks expand the final viewport only when their ink is unclipped", () => {
  // MacTeX: width/height of the completed tikzpicture's TeX box in pt.
  // The 5pt quick marks contribute their radius, not another half pen width.
  for (const [mode, width] of [["", 123.80615], ["clip marker paths=true", 114.20615], ["clip=false", 180.70923]]) {
    const { svg, diagnostics } = tikzToSvg(String.raw`\usepgfplotslibrary{statistics}\pgfplotsset{compat=1.18}
      \begin{tikzpicture}\begin{axis}[scale only axis,width=4cm,height=3cm,xmin=0,xmax=4,ymin=0,ymax=3,
        enlargelimits=false,xtick=\empty,ytick=\empty,${mode}]
        \addplot[boxplot prepared={draw position=1.5,lower whisker=0,lower quartile=1,median=2,
          upper quartile=3,upper whisker=4,average=2.5},mark size=5pt] coordinates {(99,0)(99,4)(99,6)};
      \end{axis}\end{tikzpicture}`, { margin: 0 });
    assert.deepEqual(diagnostics, []);
    const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    assert.ok(Math.abs(w / (100 * cmPerPt) - width) < .025, `native width: ${width}pt (${mode})`);
    assert.ok(Math.abs(h / (100 * cmPerPt) - 85.75919) < .025);
  }
});
