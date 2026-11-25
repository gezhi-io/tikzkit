import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parsePathSegments } from "../src/frontend/parser.js";
import { tikzToSvg } from "../src/index.js";
import { tikzPlotFileRuns } from "../src/tikz/pathOperations/plotFile.js";

const tex = String.raw;
const pathItems = result => result.ir.items.filter(item => item.type === "path" && item.shape !== "plot-mark");
const endpoints = item => item.commands.map(({ type, x, y }) => [type, x, y]);

function render(source, options) {
  const result = tikzToSvg(source, options);
  assert.deepEqual(result.diagnostics, []);
  return result;
}

function xMarks(result) {
  return result.ir.items.filter(item => item.mark === "x").map(({ commands: [a, b] }) =>
    ["x", "y"].map(k => {
      const center = Number(((a[k] + b[k]) / 2).toFixed(8));
      return center === 0 ? 0 : center;
    }));
}

test("file is a balanced path operation; its options, filename and the following path stay separate", () => {
  const segments = parsePathSegments(tex`(0,0) -- plot[mark=x,mark indices={1,3}]
    file {plots/\series{}.table} -- ++(1,0) node {plot file {not a reference}}`);
  assert.deepEqual(segments.map(s => s.kind), ["coordinate", "operator", "plotFile", "operator", "coordinate", "node"]);
  assert.deepEqual(segments[2], { kind: "plotFile", filename: tex`plots/\series{}.table`, options: { mark: "x", "mark indices": "1,3" } });
});

test("the three literal manual sine plots use the installed 20-point table and select the native marks", t => {
  // Only the caller (this test), never the renderer, locates or reads a TeX installation.
  const lookup = spawnSync("kpsewhich", ["--format=doc", "pgfmanual-sine.table"], { encoding: "utf8" });
  if (lookup.status !== 0) return t.skip("PGF manual tables not installed");
  const name = "plots/pgfmanual-sine.table";
  const table = readFileSync(lookup.stdout.trim(), "utf8");
  const xy = table.trim().split(/\r?\n/).filter(line => !line.startsWith("#"))
    .map(line => line.trim().split(/\s+/).slice(0, 2).map(Number));
  assert.equal(xy.length, 20);
  const [reference] = pathItems(render(tex`\tikz \draw plot[smooth] coordinates {${xy.map(p => `(${p})`).join("")}};`));
  for (const [source, indices] of [
    [tex`\tikz \draw plot[mark=x,mark repeat=3,smooth] file {plots/pgfmanual-sine.table};`, [1, 4, 7, 10, 13, 16, 19]],
    [tex`\tikz \draw plot[mark=x,mark repeat=3,mark phase=6,smooth] file {plots/pgfmanual-sine.table};`, [6, 9, 12, 15, 18]],
    [tex`\tikz \draw plot[mark=x,mark indices={1,4,...,10,11,12,...,16,20},smooth]
  file {plots/pgfmanual-sine.table};`, [1, 4, 7, 10, 11, 12, 13, 14, 15, 16, 20]]
  ]) {
    const result = render(source, { dataFiles: { [name]: table } });
    assert.deepEqual(pathItems(result).map(p => p.commands), [reference.commands]);
    assert.deepEqual(xMarks(result), indices.map(i => xy[i - 1]), source);
  }
});

test("leading comments do not lift the pen; internal comments, blanks, o and u jump without resetting marks", () => {
  const rows = ["", "  # header", "% header", "+1e0\t-2E0 i", "2 3 % note", "# new set",
    "3 4 i", "4 5", "", "", "5 6", "99 99 o", "6 7", "NaN NaN u", "7 8 o extra", "", ""];
  const result = render(tex`\tikz \draw (0,0) -- plot[mark=x,mark repeat=2] file{sets} -- ++(1,1);`,
    { dataFiles: new Map([["sets", rows.join("\r\n")]]) });
  assert.deepEqual(endpoints(pathItems(result)[0]), [
    ["moveTo", 0, 0], ["lineTo", 1, -2], ["lineTo", 2, 3], ["moveTo", 3, 4], ["lineTo", 4, 5],
    ["moveTo", 5, 6], ["moveTo", 6, 7], ["moveTo", 7, 8], ["lineTo", 8, 9]
  ]);
  assert.deepEqual(xMarks(result), [[1, -2], [3, 4], [5, 6], [7, 8]]);
});

test("sharp resets to moveto at jumps; smooth reuses the first action, and a trailing jump keeps the saved pen", () => {
  const source = tex`\begin{tikzpicture}
    \draw (0,0) -- plot file{breaks} -- ++(1,1);
    \draw (0,0) -- plot[smooth] file{breaks} -- ++(1,1);
    \end{tikzpicture}`;
  const result = render(source, { dataFiles: { breaks: "0 0 u\n1 2\n2 3\n\n4 5\n5 6\n99 99 o" } });
  // MacTeX pgfsyssoftpath trace, with x=y=1pt in the probe.
  assert.deepEqual(pathItems(result).map(endpoints), [
    [["moveTo", 0, 0], ["moveTo", 1, 2], ["lineTo", 2, 3], ["moveTo", 4, 5], ["lineTo", 5, 6], ["lineTo", 6, 7]],
    [["moveTo", 0, 0], ["lineTo", 1, 2], ["curveTo", 2, 3], ["lineTo", 4, 5], ["curveTo", 5, 6], ["lineTo", 6, 7]]
  ]);
});

test("pgfpointxy takes basis factors, even for pt fields; plot transforms and local basis do not leak", () => {
  const result = render(tex`\begin{tikzpicture}[x=2cm,y=4cm,xshift=1cm]
    \draw (0,0) -- plot[x={(3cm,1cm)},y={(1cm,2cm)},xshift=5cm] file {xy} -- ++(1,0);
    \draw plot file {xy} -- ++(1,0);
    \end{tikzpicture}`, { dataFiles: { xy: "1pt 1\n2pt -1" } });
  assert.deepEqual(pathItems(result).map(endpoints), [
    [["moveTo", 1, 0], ["lineTo", 10, 3], ["lineTo", 11, 0], ["lineTo", 7, -4]],
    [["moveTo", 3, 4], ["lineTo", 5, -4], ["lineTo", 7, -4]]
  ]);
});

test("the installed PGF outlier switch handles all three kinds of discontinuity", () => {
  const segment = { filename: "xy" };
  const env = { dataFiles: { xy: "1cm 2bp\n{1pt + 2} 3\n0 0 o\n1 1\n\nNaN NaN u\n2 2" } };
  const a = { x: 1864679 / 65536, y: 131563 / 65536 };
  const b = { x: 3, y: 3 }, c = { x: 1, y: 1 }, d = { x: 2, y: 2 };
  for (const [mode, expected] of [["jump", [[a, b], [c], [d]]],
    ["ignore", [[a, b, c, d]]], ["plot", [[a, b, { x: 0, y: 0 }, c, d]]]]) {
    const diagnostics = [];
    assert.deepEqual(tikzPlotFileRuns(segment, { "/pgf/handle outlier points in plots": mode }, env, diagnostics), expected);
    assert.deepEqual(diagnostics, []);
  }
});

test("malformed rows are diagnosed with their file and line, never padded to the origin", () => {
  const diagnostics = [];
  const runs = tikzPlotFileRuns({ filename: "bad rows" }, {}, { dataFiles: { "bad rows": "1 2\nwrong\n3 4" } }, diagnostics);
  assert.deepEqual(runs, [[{ x: 1, y: 2 }], [{ x: 3, y: 4 }]]);
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0].message, /bad rows.*line 2/i);
});

test("filecontents and filecontents* shadow caller data; ignored row tails are never document commands", () => {
  for (const environment of ["filecontents", "filecontents*"]) {
    const name = "plots/my.data";
    const result = render(tex`\begin{${environment}}[overwrite]{${name}}
1 2 i \tikz \draw (5,5); \usepackage{not-a-package}
  % inside the table
3 4 i
\end{${environment}}
\tikz \draw plot file {${name}};
`, { dataFiles: { [name]: "8 8" }, pgfplotsTableResolver: () => assert.fail("embedded data must win") });
    assert.equal(result.ast.pictures.length, 1);
    assert.ok(!result.ast.packages.some(p => p.name === "not-a-package"));
    assert.deepEqual(pathItems(result).map(endpoints), [[["moveTo", 1, 2], ["moveTo", 3, 4]]]);
  }
});

test("expanded filenames use exact caller keys and foreach variables at the time of each plot", () => {
  const requested = [];
  const result = render(tex`\def\folder{sets}
    \begin{tikzpicture}
    \foreach \name/\height in {a/2,b/5} {
      \draw plot[variable=\name,samples=99] file {\folder/\name.table};
    }
    \draw plot file {"series with spaces"};
    \end{tikzpicture}`, {
    dataFiles: { "sets/a.table": tex`1 {\height}`, "series with spaces": "7 8" },
    pgfplotsTableResolver(name) { requested.push(name); return name === "sets/b.table" ? tex`2 {\height}` : undefined; }
  });
  assert.deepEqual(requested, ["sets/b.table"]);
  assert.deepEqual(pathItems(result).map(endpoints), [
    [["moveTo", 1, 2]], [["moveTo", 2, 5]], [["moveTo", 7, 8]]
  ]);
});

test("a quoted filecontents name can expand a macro and be opened as a braced filename with spaces", () => {
  const result = render(tex`\def\name{two words}
    \begin{filecontents*}{"\name"}
1 2
    \end{filecontents*}
    \tikz \draw plot file {{\name}};`);
  assert.deepEqual(pathItems(result).map(endpoints), [[["moveTo", 1, 2]]]);
});

test("missing names never trigger implicit I/O, basename fallback or inherited-property lookup", t => {
  t.mock.method(globalThis, "fetch", () => assert.fail("the renderer must not fetch a plot file"));
  const names = ["package.json", "../package.json", "https://example.invalid/x.table", "plots/same.table", "constructor", "__proto__", "getter"];
  const dataFiles = Object.assign(Object.create({ constructor: "4 5" }), { "same.table": "0 0" });
  Object.defineProperty(dataFiles, "getter", { enumerable: true, get: () => assert.fail("not a text entry") });
  const result = tikzToSvg(tex`\begin{tikzpicture}
    ${names.map(name => tex`\draw plot file {${name}};`).join("\n")}
    \draw (1,2) -- (3,4);
    \end{tikzpicture}`, { dataFiles });
  assert.equal(result.diagnostics.length, names.length);
  for (const [i, d] of result.diagnostics.entries()) {
    assert.equal(d.severity, "warning");
    assert.equal(d.code, "tikz-plot-file-not-found");
    assert.ok(d.message.includes(names[i]));
  }
  assert.deepEqual(pathItems(result).map(endpoints), [[["moveTo", 1, 2], ["lineTo", 3, 4]]]);
  const empty = render(tex`\tikz \draw (2,3) plot file {empty} -- ++(1,1);`, { dataFiles: { empty: "" } });
  assert.deepEqual(endpoints(pathItems(empty)[0]), [["moveTo", 2, 3], ["lineTo", 1, 1]]);
});
