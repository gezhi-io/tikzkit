import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseOptions } from "../src/engine/options.js";
import { closePathCommand as Z, lineToCommand as L, moveToCommand as M } from "../src/engine/pathBuilder.js";
import { assembleFillBetweenPaths as assemble, joinFillBetweenPaths as joinPaths,
  prepareFillBetweenPaths as prepare } from "../src/pgfplots/fillBetweenAssembly.js";

const C = (x1, y1, x2, y2, x, y) => ({ type: "curveTo", x1, y1, x2, y2, x, y });
const first = [M(1, 2), L(9, 4)];
const second = [M(8, 6), L(4, 7), M(2, 9), L(1, 10)];
const forward = [...first, L(8, 6), L(4, 7), L(2, 9), L(1, 10), Z()];
const reversed = [...first, L(1, 10), L(2, 9), L(4, 7), L(8, 6), Z()];
const kept = [...first, L(8, 6), L(4, 7), M(2, 9), L(1, 10), Z()];
const wrapperCases = [
  ["", forward], ["reverse=auto", forward], ["reverse=false", forward],
  ["reverse=true", reversed], ["reverse", reversed], ["inner moveto=keep", kept],
  ["/pgf/fill between/reverse=auto", forward], ["/pgf/fill between/reverse=false", forward],
  ["/pgf/fill between/reverse=true", reversed], ["/pgf/fill between/reverse", reversed],
  ["/pgf/fill between/inner moveto=keep", kept],
  ["reverse,/pgf/fill between/reverse=false", forward], ["/pgf/fill between/reverse=false,reverse", reversed],
  ["inner moveto=keep,/pgf/fill between/inner moveto=connect", forward]
];

test("PGFPlots accepts short and qualified fill-between keys, including a valueless reverse", () => {
  for (const [keys, expected] of wrapperCases) {
    assert.deepEqual(assemble(first, second, parseOptions(keys)), expected, keys);
  }
  assert.deepEqual(assemble(first, second, { reverse: false }), forward);
  assert.deepEqual(assemble(first, second, { reverse: true }), reversed);
});

test("auto compares only the first segment, breaking equal x by y at TeX dimension precision", () => {
  const up = [M(2, 1), L(2, 5), L(-8, -3)];
  const down = [M(3, 6), L(3, 2), L(10, 18)];
  const same = [M(1, 1), L(1, 1), L(8, 9)];
  assert.equal(prepare(up, up).reverse, true);
  assert.equal(prepare(up, down).reverse, false);
  assert.equal(prepare(same, down).reverse, true);
  assert.equal(prepare(same, up).reverse, false);
  assert.equal(prepare([M(0, 0)], up).reverse, true);
  assert.equal(prepare([M(0, 0), L(1e-8, -1)], down).reverse, true);
  assert.deepEqual(assemble([M(1, 1), L(3, -2), L(-7, 6)], [M(2, 4), L(7, 6), L(9, 3)]),
    [M(1, 1), L(3, -2), L(-7, 6), L(9, 3), L(7, 6), L(2, 4), Z()]);
  assert.deepEqual(assemble([], down), []);
  assert.deepEqual(joinPaths(up, [], true), []);
});

test("auto uses cubic endpoints and reversal swaps controls on each cubic", () => {
  const a = [M(2, 5), C(-20, 3, -1, 4, 3, -2)];
  const b = [M(1, 6), C(5, 2, 4, -7, 4, 9), C(7, 1, 2, 3, -6, 3)];
  assert.deepEqual(prepare(a, b), { first: a, second: b, reverse: true });
  assert.deepEqual(assemble(a, b),
    [...a, L(-6, 3), C(2, 3, 7, 1, 4, 9), C(4, -7, 5, 2, 1, 6), Z()]);
  assert.deepEqual(assemble(a, b, { reverse: false }), [...a, L(1, 6), ...b.slice(1), Z()]);
});

test("prepare connects the last inner move in a run, drops trailing moves, then tests direction", () => {
  const a = Object.freeze([M(0, 0), M(-2, 2), M(4, 4), L(6, 6), M(8, 8), M(9, 9)].map(Object.freeze));
  const b = [M(7, 7), L(8, 6)];
  assert.deepEqual(prepare(a, b), { first: [M(0, 0), L(4, 4), L(6, 6)], second: b, reverse: true });
  assert.deepEqual(prepare(a, b, { "inner moveto": "keep" }), { first: a, second: b, reverse: false });
  assert.deepEqual(prepare([M(0, 0), M(2, 3), M(-1, -2)], b).first, [M(0, 0)]);
});

test("keep reverses the order of subpaths, including a trailing move-only subpath", () => {
  const a = [M(0, 0), L(2, 1), M(3, 2), L(6, 7)];
  const b = [M(1, 2), L(2, 5), M(9, 7), C(7, 6, 8, 4, 11, 3), M(13, 10)];
  assert.deepEqual(assemble(a, b, { "inner moveto": "keep", reverse: true }),
    [...a, L(13, 10), M(11, 3), C(8, 4, 7, 6, 9, 7), M(2, 5), L(1, 2), Z()]);
});

test("join uses the pre-clip reverse flag and never reconnects holes opened by clipping", () => {
  const { reverse } = prepare([M(0, 0), L(5, 2), L(2, 2)], [M(0, 4), L(5, 8)]);
  assert.equal(reverse, true);
  const a = [M(5, 2), L(2, 2), M(2, 7), L(4, 9)];
  const b = [M(0, 4), L(1, 4), M(3, 6), L(5, 8)];
  assert.deepEqual(joinPaths(a, b, reverse), [...a, L(5, 8), L(3, 6), M(1, 4), L(0, 4), Z()]);
  assert.deepEqual(joinPaths(a, b, false), [...a, L(0, 4), L(1, 4), M(3, 6), L(5, 8), Z()]);
});

test("closed boundaries retain native moves, closing order and pre-connect close coordinates", () => {
  const a = [M(0, 1), L(2, 3)];
  assert.deepEqual(assemble([...a, Z()], [M(1, 4), L(3, 6)], { reverse: false }),
    [...a, Z(), L(1, 4), L(3, 6)]);
  const closed = [M(1, 4), L(3, 6), L(8, 9), Z()];
  assert.deepEqual(assemble(a, closed, { reverse: true }), [...a, M(8, 9), L(3, 6), L(1, 4), Z()]);
  const two = [...closed, M(11, 14), L(13, 16), L(18, 19), Z()];
  assert.deepEqual(assemble(a, two, { "inner moveto": "keep", reverse: true }),
    [...a, M(18, 19), L(13, 16), L(11, 14), M(1, 4), M(8, 9), L(3, 6), L(1, 4), Z(), Z()]);
  const mixed = [M(1, 4), L(3, 6), M(8, 9), L(10, 12), Z(), M(11, 14), L(13, 16), L(18, 19)];
  assert.deepEqual(assemble(a, mixed, { reverse: true }),
    [...a, M(18, 19), L(13, 16), L(11, 14), L(8, 9), M(10, 12), L(8, 9), L(3, 6), L(1, 4), Z()]);
});

test("local pdflatex reproduces the PGFPlots wrapper key cases", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 to replay"
}, () => {
  const dir = mkdtempSync(join(tmpdir(), "fillbetween-assembly-"));
  try {
    const probe = String.raw`\documentclass{article}
\usepackage{pgfplots}
\usepgfplotslibrary{fillbetween}
\pgfplotsset{compat=1.18}
\makeatletter
\newwrite\audit
\def\record#1{\immediate\write\audit{#1}}
\def\ptvalue#1{\strip@pt\dimexpr#1\relax}
\def\capture#1{\begingroup\let\saved=\pgfretval
  \def\pgfsyssoftpath@movetotoken##1##2{\record{M \ptvalue{##1} \ptvalue{##2}}}%
  \def\pgfsyssoftpath@linetotoken##1##2{\record{L \ptvalue{##1} \ptvalue{##2}}}%
  \def\pgfsyssoftpath@closepathtoken##1##2{\record{Z}}%
  \record{CASE #1}\saved\endgroup}
\def\probe#1#2{\addplot fill between[of=WA and WB,#2,/pgf/fill between/result stream/next ready/.code={\capture{#1}}];}
\makeatother
\begin{document}
\immediate\openout\audit=oracle.trace
\begin{tikzpicture}
\begin{axis}[axis lines=none,clip=false,xmin=0,xmax=20,ymin=0,ymax=20,x=1pt,y=1pt]
\path[name path=WA] (1pt,2pt)--(9pt,4pt);
\path[name path=WB] (8pt,6pt)--(4pt,7pt)(2pt,9pt)--(1pt,10pt);
${wrapperCases.map(([keys], i) => String.raw`\probe{${i}}{${keys}}`).join("\n")}
\end{axis}
\end{tikzpicture}
\immediate\closeout\audit
\end{document}`;
    writeFileSync(join(dir, "oracle.tex"), probe);
    execFileSync("pdflatex", ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "oracle.tex"],
      { cwd: dir, timeout: 30000 });
    const measured = readFileSync(join(dir, "oracle.trace"), "utf8").trimEnd().split(/\r?\n/);
    const expected = wrapperCases.flatMap(([, path], i) => ["CASE " + i, ...path.map(c =>
      c.type === "closePath" ? "Z" : [c.type === "moveTo" ? "M" : "L", c.x, c.y].join(" "))]);
    assert.deepEqual(measured, expected);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
