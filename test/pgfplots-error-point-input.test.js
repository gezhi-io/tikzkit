import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseAddplots, parsePgfplotsTablePoints } from "../src/pgfplots/addplotParser.js";
import { createPgfplotsDateContext } from "../src/pgfplots/dateCoordinates.js";

const coordinates = String.raw`\addplot[point meta=explicit symbolic,plot coordinates/math parser=false] coordinates {
  (1,2) +- (.25,0) [007]
  (3,4) -= (1,2) += (3,4) [B]
  (5,6) += (-2,.5) -= (0,1e-2) [C]
  (7,8) += (9,10) [D] (9,10) -= (11,12) [E]
  (11,12) +- (9,10) += (,45) -= (12,) [F]
  (13,14) [tag(91,92)] (15,16) + = (1,2) + - (3,4) [space] (17,18)
};`;
const table = String.raw`\addplot[point meta=explicit symbolic] table[
  col sep=comma,row sep=\\,x error=s,y error minus index=3,y error plus index=2,meta=tag
] {x,y,s,m,tag\\1,2,.4,.8,row\\3,4,0,,zero\\};`;
const overlap = String.raw`\addplot[point meta=explicit symbolic] table[
  col sep=comma,row sep=\\,x error plus=m,x error=s,x error minus index=3,
  y error index=2,y error minus=m,meta=tag
] {x,y,s,m,tag\\1,2,.4,.8,overlap\\};`;
const named = String.raw`\addplot[table/x error minus=lo,/pgfplots/table/x error plus=hi] table[
  col sep=comma,row sep=\\,y error=hi,y error minus=lo,meta=tag
] {x,y,lo,hi,tag\\1,2,.1,.3,names\\};`;
const indexed = String.raw`\addplot table[header=false,row sep=\\,x index=1,y index=2,
  x error index=0,x error plus index=3,y error index=3] {7 1 2 9\\};`;

function points(body) {
  const diagnostics = [];
  const [plot] = parseAddplots(body, {}, diagnostics);
  assert.deepEqual(diagnostics, []);
  return plot.points;
}

test("coordinate suffixes set signed per-side values in order; only the base tuples are samples", () => {
  const data = points(coordinates);
  assert.deepEqual(data.map(p => [p.x, p.y]), [[1,2],[3,4],[5,6],[7,8],[9,10],[11,12],[13,14],[15,16],[17,18]]);
  assert.deepEqual(data.map(p => p.errors), [
    { x: { plus: .25, minus: .25 }, y: { plus: 0, minus: 0 } },
    { x: { plus: 3, minus: 1 }, y: { plus: 4, minus: 2 } },
    { x: { plus: -2, minus: 0 }, y: { plus: .5, minus: .01 } },
    { x: { plus: 9 }, y: { plus: 10 } }, { x: { minus: 11 }, y: { minus: 12 } },
    { x: { minus: 12 }, y: { plus: 45 } }, undefined,
    { x: { plus: 3, minus: 3 }, y: { plus: 4, minus: 4 } }, undefined
  ]);
  assert.deepEqual(data.map(p => p.meta), ["007","B","C","D","E","F","tag(91,92)","space",undefined]);
  assert.deepEqual(data.at(-1), { x: 17, y: 18, raw: "(17,18)" });
});

test("point meta ends the point: a subsequent error suffix is not another sample", () => {
  const diagnostics = [];
  const [plot] = parseAddplots(String.raw`\addplot coordinates {(1,2)[17] += (3,4) (7,8)};`, {}, diagnostics);
  assert.deepEqual(plot.points, [{ x: 1, y: 2, raw: "(1,2)", meta: 17 }]);
  assert.match(diagnostics[0]?.message ?? "", /coordinate|error/i);
  const invalid = [];
  assert.equal(parseAddplots(String.raw`\addplot coordinates {(1,2)- = (3,4)};`, {}, invalid)[0].points.length, 0);
  assert.match(invalid[0]?.message ?? "", /coordinate|error/i);
});

test("3D rows, raw coordinates and bracketed meta survive; z errors are not x/y samples", () => {
  const data = points(String.raw`\addplot3 coordinates {(1,2,3) +- (.5,1,99) [8]

    (4,5,6)[{text (9,8) and ]}] (7,8,9)};`);
  assert.deepEqual(data.rows.map(row => row.length), [1, 2]);
  assert.strictEqual(data.rows[1][0], data[1]);
  assert.deepEqual(data.map(p => [p.rawX, p.rawY, p.rawZ, p.z, p.meta]),
    [["1","2","3",3,8],["4","5","6",6,"text (9,8) and ]"],["7","8","9",9,undefined]]);
  assert.deepEqual(data[0].errors, { x: { plus: .5, minus: .5 }, y: { plus: 1, minus: 1 } });
  assert.ok(!Object.hasOwn(data[2], "errors"));
});

test("a comment-only line does not start a new scanline or separate an error from its point", () => {
  const data = points(String.raw`\addplot coordinates {(1,2)
% ignored (91,92)
+- (3,4) (5,6)

(7,8)};`);
  assert.deepEqual(data.rows.map(row => row.length), [2, 1]);
  assert.deepEqual(data[0].errors, { x: { plus: 3, minus: 3 }, y: { plus: 4, minus: 4 } });
});

test("table symmetric selectors expand in key order; each side prefers a name over its index", () => {
  const symmetric = { x: { plus: .4, minus: .4 }, y: { plus: .4, minus: .8 } };
  assert.deepEqual(points(table).map(p => [p.errors, p.meta]), [
    [symmetric, "row"], [{ x: { plus: 0, minus: 0 }, y: { plus: 0 } }, "zero"]
  ]);
  assert.deepEqual(points(overlap)[0].errors, symmetric);
  assert.deepEqual(points(named)[0].errors, { x: { plus: .3, minus: .1 }, y: { plus: .3, minus: .1 } });
  assert.deepEqual(points(indexed)[0].errors, { x: { plus: 9, minus: 7 }, y: { plus: 9, minus: 9 } });
});

test("absent or nonfinite errors stay absent; selecting errors does not change dates, z or table meta", () => {
  const content = "day,y,z,err,tag\n2024-01-03,2,9,nan,001\n2024-01-04,3,8,-.2,002";
  const options = { "col sep": "comma", x: "day", z: "z", meta: "tag", "y error plus": "err" };
  const data = parsePgfplotsTablePoints(content, options, [], { "point meta": "explicit symbolic" },
    { pgfplotsDateContext: createPgfplotsDateContext({ "date coordinates in": "x", "date ZERO": "2024-01-01" }) });
  assert.deepEqual(data.map(p => [p.x, p.z, p.dateCoordinates.x, p.meta]),
    [[2,9,"2024-01-03","001"],[3,8,"2024-01-04","002"]]);
  assert.ok(!Object.hasOwn(data[0], "errors"));
  assert.deepEqual(data[1].errors, { y: { plus: -.2 } });
  assert.ok(!Object.hasOwn(parsePgfplotsTablePoints(content, { "col sep": "comma" })[1], "errors"));
  const [p, q] = points(String.raw`\addplot[plot coordinates/math parser=false] coordinates {(0,1)+-(inf,-3)(2,3)+=(,nan)};`);
  assert.deepEqual(p.errors, { y: { plus: -3, minus: -3 } });
  assert.ok(!Object.hasOwn(q, "errors"));
});

test("coordinate math is optional; a table error cell is a number, not a math expression", () => {
  const vector = "coordinates {(1,2) += ({max(1,2)/4},2e-1)};";
  assert.deepEqual(points("\\addplot " + vector)[0].errors, { x: { plus: .5 }, y: { plus: .2 } });
  assert.deepEqual(points("\\addplot[plot coordinates/math parser=false] " + vector)[0].errors, { y: { plus: .2 } });
  const data = parsePgfplotsTablePoints("x y err\n1 2 false\n3 4 2*3\n5 6 +.5e-1", { "y error": "err" });
  assert.deepEqual(data.map(p => p.errors), [undefined, undefined, { y: { plus: .05, minus: .05 } }]);
});

test("pdflatex reads the same per-point inputs at the PGFPlots error survey", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1"
}, () => {
  const body = [coordinates, table, overlap, named, indexed, String.raw`\addplot3 coordinates {(2,3,4)+-(5,6,7)[three]};`].join("\n");
  const source = String.raw`\documentclass{article}\usepackage{pgfplots}\pgfplotsset{compat=1.18}\makeatletter
\let\nativepoint\pgfplots@errorbars@survey@point
\def\pgfplots@errorbars@survey@point{\typeout{E|\pgfplots@current@point@error@x@plus|\pgfplots@current@point@error@x@minus|\pgfplots@current@point@error@y@plus|\pgfplots@current@point@error@y@minus|\pgfplots@current@point@meta}\nativepoint}
\begin{document}\begin{tikzpicture}\begin{axis}[plot coordinates/math parser=false,point meta=explicit symbolic,
error bars/x dir=both,error bars/x explicit,error bars/y dir=both,error bars/y explicit]
${body}
\end{axis}\end{tikzpicture}\end{document}`;
  const cwd = mkdtempSync(join(tmpdir(), "pgfplots-error-input-"));
  try {
    writeFileSync(join(cwd, "probe.tex"), source);
    const r = spawnSync("pdflatex", ["-draftmode", "-no-shell-escape", "-halt-on-error", "-interaction=nonstopmode", "probe.tex"],
      { cwd, encoding: "utf8" });
    assert.equal(r.status, 0, r.error?.message ?? r.stdout?.slice(-1200));
    const log = readFileSync(join(cwd, "probe.log"), "utf8");
    const rows = [...log.matchAll(/^E\|([^\r\n]*)/gm)].map(([, line]) => line.split("|").map((s, i) =>
      s === "" ? undefined : i < 4 ? Number(s) : s));
    assert.deepEqual(parseAddplots(body).flatMap(plot => plot.points.map(({ errors, meta }) =>
      [errors?.x?.plus, errors?.x?.minus, errors?.y?.plus, errors?.y?.minus, meta])), rows);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
