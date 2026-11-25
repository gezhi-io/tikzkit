import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const optional = { skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" };
const ptPerCm = 72.27 / 2.54;
const tolerancePt = .025;
const samples = "id value\n100 5\n200 2\n300 22\n400 3\n500 4\n600 3\n700 -10\n800 5\n900 6\n";
const fromFile = "table[x=id,y=value] {samples.dat}";
const empty = "coordinates {}";
const prepared = (keys, data = empty, extra = "") => ({ keys: `boxplot prepared={${keys}}${extra && "," + extra}`, data });
const raw = (keys = "", data = fromFile) => ({ keys: `boxplot={${keys}}`, data });
const curve = coords => ({ data: `coordinates {${coords}}` });
const ordinary = curve("(-1,1) (5,2)");
const five = "lower whisker=-2,lower quartile=2,median=3,upper quartile=4,upper whisker=6";
const manual = "lower whisker=42,lower quartile=45,median=47,upper quartile=47.5,upper whisker=48";
const manualOutliers = String.raw`table[row sep=\\,y index=0] {40\\34\\56\\}`;
// pgfplots.libs.statistics.tex: the manual's raw table, with no outliers.
const manualSamples = String.raw`table[row sep=\\,y index=0] {data\\1\\2\\1\\5\\4\\10\\7\\10\\9\\8\\9\\9\\}`;
const anchored = "boxplot/draw position=5,boxplot/draw relative anchor=.25,boxplot/whisker extend=2";
const widthPlots = [1, 4, 9].map(n => prepared(five + ",sample size=" + n));
const cases = [
  { id: "ordinary", plots: [{ data: fromFile }], range: [100, 900, -10, 22], positions: [] },
  { id: "raw-file", plots: [raw("average=auto"), curve("(0,.8) (9,1.15)")],
    range: [-10, 22, .6, 1.4], positions: [[0, 1]], ticks: [[-10, 22], [1]] },
  { id: "manual-vertical", axis: "/pgfplots/boxplot/draw direction=y,boxplot/box extend=.4",
    plots: [prepared(manual + ",average=46,draw position=-2", manualOutliers,
      "/pgfplots/boxplot/draw relative anchor=.25,/pgfplots/boxplot/whisker extend=2")],
    range: [-2.5, -.5, 34, 56], positions: [[0, -2]], ticks: [[-2], [34, 40, 56]] },
  { id: "mixed-kinds", plots: [curve("(-11,.8) (9,1.1)"), raw(), prepared(five), raw("", manualSamples),
    curve("(-2,.75) (20,2.25)"), prepared(manual)],
    range: [-11, 48, .6, 2.4], positions: [[1, 1], [2, 1], [3, 2], [5, 2]], ticks: [[-11, 9], [.8, 1.1]] },
  { id: "relative-cap", axis: "boxplot/draw direction=y,boxplot/box extend=1.5,boxplot/draw relative anchor=1",
    setup: String.raw`\pgfplotstableread{samples.dat}\loadedSamples`,
    plots: [raw("draw position=-3", String.raw`table[x=id,y=value]{\loadedSamples}`)],
    range: [-4.5, -3, -10, 22], positions: [[0, -3]] },
  { id: "row-lanes", plots: [prepared(five + String.raw`,draw position=\thisrow{lane}`,
    String.raw`table[x=lane,y=value,row sep=\\]{lane value\\2 13\\7 3\\4 11\\}`)],
    range: [-2, 13, 2, 7], positions: [[0, 4]], ticks: [[3, 11, 13], [2, 4, 7]] },
  { id: "mixed-width-reset", axis: String.raw`boxplot/variable width,boxplot/variable width min target=.25,boxplot/box extend=2,boxplot/draw relative anchor=1,boxplot/whisker extend={\pgfkeysvalueof{/pgfplots/boxplot/box extend}*1.5}`,
    plots: [prepared(five + ",sample size=4"), raw(), prepared(five + ",sample size=16")],
    range: [-10, 22, -2, 2], positions: [[0, 1], [1, 1], [2, 2]] },
  { id: "quartiles-only", axis: anchored + ",boxplot/box extend=.4",
    plots: [prepared("lower quartile=2,upper quartile=6")], range: [2, 6, 4.9, 5.3], positions: [[0, 5]] },
  { id: "whiskers-only", axis: anchored + ",boxplot/box extend=3",
    plots: [prepared("lower whisker=2,upper whisker=6")], range: [2, 6, 4.5, 6.5], positions: [[0, 5]] },
  { id: "median-average", axis: "boxplot/draw relative anchor=1,boxplot/whisker extend=3",
    plots: [prepared("median=-3,average=7")], range: [-3, 7, .2, 1], positions: [[0, 1]] },
  { id: "unpainted-quartile", plots: [prepared("draw position=8,draw relative anchor=0,lower quartile=-4"), ordinary],
    range: [-4, 5, 1, 8.8], positions: [[0, 8]] },
  { id: "outliers-only", plots: [prepared("draw position=8", "coordinates {(100,3) (200,7)}"), ordinary],
    range: [-1, 7, 1, 8], positions: [[0, 8]], ticks: [[3, 7], [8]] },
  // A prepared plot without any statistics or outliers consumes an ordinal but
  // contributes no limits or data ticks. Empty raw input instead fails in TeX.
  { id: "empty-slot", axis: "xtick distance=2,ytick distance=.5", plots: [prepared("draw position=20"), ordinary, prepared(five)],
    range: [-2, 6, 1, 2.4], positions: [[2, 2]], ticks: [[-2, 0, 2, 4, 6], [1, 1.5, 2]] },
  ...Object.entries({
    default: "", fixed: ",boxplot/whisker extend=.8",
    expression: String.raw`,boxplot/whisker extend={0.5*\pgfkeysvalueof{/pgfplots/boxplot/box extend}}`
  }).map(([cap, option]) => ({
    id: "variable-width-" + cap, plots: widthPlots,
    axis: "boxplot/variable width,boxplot/box extend=1" + option,
    range: [-2, 6, .5, 3.5], positions: [[0, 1], [1, 2], [2, 3]]
  })),
  { id: "variable-width-equal", axis: "boxplot/variable width,boxplot/box extend=1",
    plots: [4, 4].map(n => prepared(five + ",sample size=" + n)),
    range: [-2, 6, .5, 2.5], positions: [[0, 1], [1, 2]] }
];

const settings = String.raw`\usepackage{pgfplots}\usepgfplotslibrary{statistics}\pgfplotsset{compat=1.18}`;
// Read the actual completed TikZ soft paths (just as "save path" does). The
// mark callbacks observe the PGF transform at the instant the mark is drawn.
const instrumentation = String.raw`\makeatletter\pgfplotsset{lua backend=false}
\newwrite\oraclefile \immediate\openout\oraclefile=probe.points
\def\record#1{\immediate\write\oraclefile{\caseid|#1}}
\newdimen\oraclex \newdimen\oracley
\def\oracleorigin{\pgfplotspointrelaxisxy{0}{0}\oraclex=\pgf@x \oracley=\pgf@y}
\def\oraclepoint#1#2{\pgf@x=\dimexpr#1-\oraclex\relax \pgf@y=\dimexpr#2-\oracley\relax}
\def\addcmd#1#2#3{\oraclepoint{#2}{#3}\edef\trace{\trace #1,\strip@pt\pgf@x,\strip@pt\pgf@y;}}
\def\capture#1{\begingroup\pgfgetpath\savedpath\oracleorigin\def\trace{}%
  \def\pgfsyssoftpath@movetotoken{\addcmd{M}}\def\pgfsyssoftpath@linetotoken{\addcmd{L}}%
  \def\pgfsyssoftpath@closepathtoken{\addcmd{Z}}\savedpath\record{path|#1|\trace}\endgroup}
\tikzset{oracle capture/.code={\tikz@addmode{\capture{#1}}}}
\pgfplotsset{
  boxplot/every whisker/.append style={/tikz/oracle capture=whisker},
  boxplot/every box/.append style={/tikz/oracle capture=box},
  boxplot/every median/.append style={/tikz/oracle capture=median},
  boxplot/every average/.append style={/tikz/mark=oracleavg}}
\def\centermark#1{\begingroup\pgfgettransformentries\ma\mb\mc\md\mx\my\oracleorigin
  \oraclepoint{\mx}{\my}\record{center|#1|\strip@pt\pgf@x|\strip@pt\pgf@y}\endgroup}
\pgfdeclareplotmark{oracleout}{\centermark{outlier}}
\pgfdeclareplotmark{oracleavg}{\centermark{average}}
\let\originalboxdraw\pgfplotsplothandlervisstart@boxplot@prepared@draw
\def\pgfplotsplothandlervisstart@boxplot@prepared@draw{%
  \record{position|\plotnum|\pgfplotsboxplotvalue{draw position}}\originalboxdraw}
\def\gauge#1{\pgfpointdiff{\pgfpointanchor{oracleSW}{center}}{\pgfpointanchor{#1}{center}}%
  \record{gauge|#1|\strip@pt\pgf@x|\strip@pt\pgf@y}}
\def\rangelog{\record{range|\pgfkeysvalueof{/pgfplots/xmin}|\pgfkeysvalueof{/pgfplots/xmax}|\pgfkeysvalueof{/pgfplots/ymin}|\pgfkeysvalueof{/pgfplots/ymax}}}`;

function picture(c, native = false) {
  const [xmin, xmax, ymin, ymax] = c.range;
  const ticks = c.ticks ? "xtick=data,ytick=data" : String.raw`xtick=\empty,ytick=\empty`;
  const readTicks = native && c.ticks ? String.raw`,xticklabel={\record{tick|x|\tick}},yticklabel={\record{tick|y|\tick}}` : "";
  const plots = c.plots.map(p => {
    const keys = p.keys ? `${p.keys},mark=${native ? "oracleout" : "*"}` : "mark=none";
    const probe = native && !p.keys ? String.raw` \pgfextra{\capture{curve}}` : "";
    return String.raw`\addplot[${keys}] ${p.data}${probe};`;
  });
  return String.raw`${native ? `\\def\\caseid{${c.id}}` : ""}${c.setup || ""}\begin{tikzpicture}
  \begin{axis}[scale only axis,width=6cm,height=4cm,enlargelimits=false,clip=false,${ticks}${readTicks},${c.axis || ""}]
  ${plots.join("\n")}
  \coordinate (gaugeLo) at (axis cs:${(3 * xmin + xmax) / 4},${(3 * ymin + ymax) / 4});
  \coordinate (gaugeHi) at (axis cs:${(xmin + 3 * xmax) / 4},${(ymin + 3 * ymax) / 4});
  ${native ? String.raw`\coordinate (oracleSW) at (rel axis cs:0,0);\pgfplotsextra{\rangelog\gauge{gaugeLo}\gauge{gaugeHi}}` : ""}
  \end{axis}\end{tikzpicture}`;
}

function nativeRecords() {
  const dir = mkdtempSync(join(tmpdir(), "pgfplots-boxplot-"));
  try {
    writeFileSync(join(dir, "samples.dat"), samples);
    writeFileSync(join(dir, "probe.tex"), [String.raw`\documentclass{article}`, settings, instrumentation,
      "\\begin{document}", ...cases.map(c => picture(c, true)), "\\end{document}"].join("\n"));
    const run = spawnSync(process.env.QA_LATEX_ENGINE || "pdflatex",
      ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "probe.tex"],
      { cwd: dir, encoding: "utf8", timeout: 30000 });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout.slice(-1800));
    return readFileSync(join(dir, "probe.points"), "utf8").trim().split(/\r?\n/).map(s => s.split("|"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function near(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: got ${actual}, native ${expected} (+/- ${tolerance})`);
}

function segments(commands) {
  let current, start;
  const result = [];
  for (const [kind, x, y] of commands) {
    const next = kind === "Z" ? start : [x, y];
    if (kind === "M") start = next;
    else {
      assert.ok(current && next && (kind === "L" || kind === "Z"), `unexpected path operation ${kind}`);
      result.push([...current, ...next]);
    }
    current = next;
  }
  return result;
}

function checkPath(path, native, label) {
  const ops = { moveTo: "M", lineTo: "L", closePath: "Z" };
  const actual = segments(path.commands.map(p => [ops[p.type], p.x * ptPerCm, p.y * ptPerCm]));
  const expected = segments(native.trim().split(";").filter(Boolean).map(s => {
    const [kind, x, y] = s.trim().split(",");
    return [kind, Number(x), Number(y)];
  }));
  // Equivalent rectangle winding and the grouping of moves do not change the ink.
  assert.equal(actual.length, expected.length, `${label} segment count`);
  for (const segment of actual) {
    const reversed = [...segment.slice(2), ...segment.slice(0, 2)];
    const i = expected.findIndex(ref => [segment, reversed].some(s => s.every((v, j) => Math.abs(v - ref[j]) <= tolerancePt)));
    assert.notEqual(i, -1, `${label}: segment ${segment} (TeX pt); unmatched native segments ${JSON.stringify(expected)}`);
    expected.splice(i, 1);
  }
}

function markCenter(path) {
  // Both the filled circle and the diamond in these cases are centrally symmetric.
  const vertices = path.commands.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  return ["x", "y"].map(k => (Math.min(...vertices.map(p => p[k])) + Math.max(...vertices.map(p => p[k]))) * ptPerCm / 2);
}

test("linear boxplot surveys, marks and strokes match installed PGFPlots statistics", optional, async t => {
  const records = nativeRecords();
  for (const c of cases) await t.test(c.id, () => {
    const get = (kind, role) => records.filter(row => row[0] === c.id && row[1] === kind &&
      (role === undefined || row[2] === role)).map(row => row.slice(role === undefined ? 2 : 3));
    const ranges = get("range");
    assert.equal(ranges.length, 1, "one measured native axis range");
    c.range.forEach((v, i) => near(Number(ranges[0][i]), v, .00001, "native limit"));
    assert.deepEqual(get("position").map(row => row.map(Number)), c.positions, "native plot index and draw position");

    const { ir, diagnostics } = tikzToSvg(settings + "\n" + picture(c), {
      pgfplotsTableResolver: name => name === "samples.dat" ? samples : undefined
    });
    assert.deepEqual(diagnostics, []);
    for (const name of ["gaugeLo", "gaugeHi"]) {
      const measured = get("gauge", name);
      assert.equal(measured.length, 1);
      for (const [i, dim] of ["x", "y"].entries()) {
        near(ir.coordinates[name]?.[dim] * ptPerCm, Number(measured[0][i]), tolerancePt, `${name} ${dim} (TeX pt)`);
      }
    }
    for (const role of ["curve", "whisker", "box", "median"]) {
      const paths = ir.items.filter(p => p.subtype === (role === "curve" ? "axis-plot" : `axis-boxplot-${role}`));
      const measured = get("path", role);
      assert.equal(paths.length, measured.length, `${role} path count`);
      paths.forEach((path, i) => checkPath(path, measured[i][0], `${role} ${i}`));
    }
    for (const [role, subtype] of [["outlier", "axis-boxplot-outlier"], ["average", "axis-boxplot-average"]]) {
      const paths = ir.items.filter(p => p.subtype === subtype);
      const measured = get("center", role);
      assert.equal(paths.length, measured.length, `${role} count`);
      paths.forEach((p, i) => markCenter(p).forEach((v, j) => near(v, Number(measured[i][j]), tolerancePt, `${role} ${i} (TeX pt)`)));
    }
    if (c.ticks) for (const [i, dim] of ["x", "y"].entries()) {
      const numericSort = (a, b) => a - b;
      const native = get("tick", dim).map(([v]) => Number(v)).sort(numericSort);
      assert.deepEqual(native, c.ticks[i], `native ${dim}tick=data`);
      const labels = ir.items.filter(p => p.type === "textNode" && (dim === "x" ? p.y < 0 : p.x < 0))
        .map(p => Number(p.text.replace(/\u2212/g, "-"))).sort(numericSort);
      assert.deepEqual(labels, native, `public ${dim}tick=data`);
    }
  });
});
