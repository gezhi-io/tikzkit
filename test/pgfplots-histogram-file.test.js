import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parseAddplots } from "../src/pgfplots/addplotParser.js";

function parseFile(source, data, parserOptions = {}) {
  const diagnostics = [], requested = [];
  const plots = parseAddplots(source, { ...parserOptions, pgfplotsTableResolver(name) {
    requested.push(name);
    return data;
  } }, diagnostics);
  assert.deepEqual(diagnostics, []);
  return { plots, requested };
}

test("the manual cumulative histogram receives one x sample and a padded y per file row", () => {
  const { plots, requested } = parseFile(String.raw`
    \addplot+ [hist={data=x,cumulative}] file {plotdata/pgfplots.randn.dat};`,
    "   1.8131109e+00\n   8.6034974e-01\n  -5.9978685e-01\n");
  assert.deepEqual(requested, ["plotdata/pgfplots.randn.dat"]);
  assert.equal(plots[0].source, "file");
  assert.equal(plots[0].options.hist, "data=x,cumulative");
  assert.deepEqual(plots[0].points.map(p => [p.x, p.y]), [[1.8131109, 0], [.86034974, 0], [-.59978685, 0]]);
});

test("file-local skip first defaults to true when specified and resets between plots", () => {
  const { plots } = parseFile(String.raw`
    \addplot file [skip first] {observations};
    \addplot file [ignore first] {observations};
    \addplot[plot file/skip first] file[ignore first=false] {observations};
    \addplot file [/pgfplots/plot file/skip first=false,ignore first=true] {observations};
    \addplot file {observations};`, " # note\r\n\r\n% note\r\n$ flags\r\n10\r\n20\r\n30\r\n");
  assert.deepEqual(plots.map(p => p.points.map(row => row.x)), [[20, 30], [20, 30], [10, 20, 30], [20, 30], [10, 20, 30]]);
});

test("the two-dimensional stream consumes only x/y and the selected explicit meta field", () => {
  const [plain, numeric, symbolic] = parseFile(String.raw`
    \addplot file{measurements};
    \addplot[/pgfplots/point meta/explicit,point meta/expand] file{measurements};
    \addplot[scatter src=explicit symbolic] file{measurements} node[right]{End} \closedcycle;`,
    "2\n3\t4\n5 6 007 unused\n7 8 {group A} rest").plots;
  assert.ok(plain.points.every(p => !("z" in p) && !("meta" in p) && !("columns" in p)));
  assert.deepEqual(plain.points.map(p => [p.x, p.y]), [[2, 0], [3, 4], [5, 6], [7, 8]]);
  assert.deepEqual(numeric.points.slice(0, 3).map(p => p.meta), [0, 0, 7]);
  assert.deepEqual(symbolic.points.map(p => p.meta), ["0", "0", "007", "group A"]);
  assert.equal(symbolic.nodes[0].text, "End");
  assert.equal(symbolic.closedCycle, true);
});

test("file comments and blank lines match the native survey without manufacturing a zero row", () => {
  // TeX's % ends the input line without a space. With no preceding space the
  // first appended padding zero joins the field: native reads '13%note' as 130.
  const data = "\n# leading\n1 2\n# ordinary comment\n3 4 % annotation\n% commented line\n5\n\n\n7\n$ flags\n13%note\n";
  const [normal, noJumps] = parseFile(String.raw`
    \addplot file{data};\addplot[empty line=none] file{data};`, data).plots;
  assert.deepEqual(normal.points.map(p => [p.x, p.y, Boolean(p.breakBefore)]),
    [[1, 2, false], [3, 4, false], [5, 0, true], [7, 0, true], [130, 0, true]]);
  assert.deepEqual(noJumps.points.map(p => p.x), [1, 3, 5, 7, 130]);
  assert.ok(noJumps.points.every(p => !p.breakBefore));
});

test("file inherits plot-file defaults and native comment characters from the enclosing settings", () => {
  const options = { pgfplotsStyleOptions: { "plot file/ignore first": true, "table/comment chars": "!,;", compat: "1.3" } };
  const [inherited, override] = parseFile(String.raw`
    \addplot file{data}; \addplot[empty line=jump] file[skip first=false]{data};`,
    "! before header\n; before header\n10\n20\n! note\n30\n\n40", options).plots;
  assert.deepEqual(inherited.points.map(p => [p.x, Boolean(p.breakBefore)]), [[20, false], [30, false], [40, false]]);
  assert.deepEqual(override.points.map(p => [p.x, Boolean(p.breakBefore)]), [[10, false], [20, false], [30, false], [40, true]]);
});

test("file names use only the supplied resolver; an empty resource is not a missing resource", () => {
  for (const name of ["package.json", "https://example.invalid/samples", "1 2"]) {
    const diagnostics = [];
    const [plot, next] = parseAddplots(`\\addplot file{${name}};\\addplot coordinates {(1,2)};`, {}, diagnostics);
    assert.deepEqual(plot.points, []);
    assert.deepEqual(next.points.map(p => [p.x, p.y]), [[1, 2]]);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].severity, "warning");
    assert.ok(diagnostics[0].message.includes(name));
  }
  const { plots, requested } = parseFile(String.raw`\addplot file{samples without suffix};`, "");
  assert.deepEqual(requested, ["samples without suffix"]);
  assert.deepEqual(plots[0].points, []);
});

test("ordinary table keeps its column rules; file has no automatic table header", () => {
  const diagnostics = [];
  const [table, file] = parseAddplots(String.raw`\addplot table{samples.dat}; \addplot file{samples.dat};`,
    { pgfplotsTableResolver: () => "7\n8" }, diagnostics);
  assert.deepEqual(table.points, []);
  assert.ok(diagnostics.some(d => /table y column/.test(d.message)));
  assert.deepEqual(file.points.map(p => [p.x, p.y]), [[7, 0], [8, 0]]);
  const [unskipped] = parseFile(String.raw`\addplot file{data};`, "x y\n7").plots;
  assert.equal(unskipped.points.length, 2);
  assert.ok(Number.isNaN(unskipped.points[0].x) && Number.isNaN(unskipped.points[0].y));
});

test("a resolved file renders the same cumulative histogram as explicit padded coordinates", () => {
  const picture = input => String.raw`\begin{tikzpicture}\begin{axis}[ybar interval,ymin=0]
    \addplot+[hist={bins=3,data min=0,data max=3,data=x,cumulative}] ${input};
    \end{axis}\end{tikzpicture}`;
  const file = picture("file[skip first]{samples.dat}");
  const data = "value\n0\n.2\n1.1\n2.2\n3";
  const explicit = tikzToSvg(picture("coordinates {(0,0)(.2,0)(1.1,0)(2.2,0)(3,0)}"));
  const provided = tikzToSvg(file, { pgfplotsTableResolver: name => name === "samples.dat" ? data : undefined });
  assert.deepEqual(provided.diagnostics, []);
  assert.equal(provided.svg, explicit.svg);
  const bars = provided.ir.items.filter(p => p.subtype === "axis-bar");
  assert.equal(bars.flatMap(p => p.commands).filter(c => c.type === "closePath").length, 3);
  const inherited = tikzToSvg("\\pgfplotsset{plot file/ignore first}\n" + picture("file{samples.dat}"),
    { pgfplotsTableResolver: () => data.replace("value", "0") });
  assert.deepEqual(inherited.diagnostics, []);
  assert.equal(inherited.svg, explicit.svg);
  const scoped = tikzToSvg(picture("file{samples.dat}").replace("ybar interval,ymin", "ybar interval,plot file/skip first,ymin"),
    { pgfplotsTableResolver: () => data.replace("value", "0") });
  assert.deepEqual(scoped.diagnostics, []);
  assert.equal(scoped.svg, explicit.svg, "file reader honors defaults on the enclosing axis");
  const embedded = tikzToSvg(`\\begin{filecontents*}{samples.dat}\n${data}\n\\end{filecontents*}\n${file}`);
  assert.deepEqual(embedded.diagnostics, []);
  assert.equal(embedded.svg, explicit.svg);
});
