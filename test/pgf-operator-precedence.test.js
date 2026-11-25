import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateMath } from "../src/engine/math.js";
import { evaluateRestrictedExpression } from "../src/engine/safe-expression.js";
import { evaluateAxisExpression } from "../src/pgfplots/expressions.js";
import { createRawGnuplotRuntime, parseRawGnuplotProgram } from "../src/pgfplots/rawGnuplotRuntime.js";
import { interpretTikz, parseTikz } from "../src/index.js";

// MacTeX PGF 3.1.11a: pgfmathparser.code.tex (equal precedence pops),
// pgfmathfunctions.basic.code.tex (neg=500) and .comparison.code.tex (ifdim).
const powers = [
  ["2^3^2", 64], ["(2^3)^2", 64], ["2^(3^2)", 512],
  ["-2^2", -4], ["(-2)^2", 4], ["-2^3^2", -64], ["(-2)^3^2", 64],
  ["2^-2", .25], ["2^-1^2", .5], ["(2^-1)^2", .25], ["2^(-1)^2", .25],
  ["2^2^-1", .25], ["2^+3^2", 64], ["2^-2*2", .0625],
  ["4/-2*2", -1], ["4/(-2)*2", -4], ["2- -2^2", 6]
];
const booleans = [
  ["0||7", 1], ["-2||0", 1], ["0||-.25", 1], ["0||0", 0],
  ["1&&2", 1], ["-.25&&.125", 1], ["0&&-3", 0], ["-3&&0", 0],
  ["1||0&&0", 0], ["1||(0&&0)", 1], ["2*(0||7)+(2&&-3)", 3],
  [".000001||0", 0], [".00001||0", 1], [".00000762939453125&&1", 1],
  [".00000762939453124999&&1", 0], ["0||-.00000762939453124999", 0],
  ["and(.000001,1)", 0], ["or(0,-.000001)", 0]
];
// Same final dimension comparison; basic PGF and FPU evaluate its inputs differently.
const modeCases = [["1e-5||0", 0, 1], [".000005+.000005||0", 0, 1], ["or(.000005+.000005,0)", 0, 1]];

test("basic PGF powers, signs and numeric booleans match native results", () => {
  for (const [expr, expected] of [...powers, ...booleans, ...modeCases]) {
    assert.equal(evaluateMath(expr), expected, expr);
    assert.equal(evaluateAxisExpression(expr, 0, { "use fpu": false }), expected, expr);
  }
});

test("PGFPlots FPU keeps PGF operator binding and compares booleans as dimensions", () => {
  for (const [expr, basic, fpu = basic] of [...powers, ...booleans, ...modeCases]) {
    assert.equal(evaluateAxisExpression(expr, 0), fpu, expr);
  }
});

test("plot-function and raw gnuplot powers stay separate from PGF caret chains", () => {
  const plot = { dialect: "gnuplot", fixedPointDivision: false };
  const gnu = createRawGnuplotRuntime(parseRawGnuplotProgram("plot 2**3**2"));
  assert.equal(gnu.evaluate("2**3**2"), 512);
  assert.equal(gnu.evaluate("1||0&&0"), 1);
  assert.equal(evaluateMath("2**3**2"), 512, "existing non-PGF spelling");
  assert.equal(evaluateMath("2**-1*2"), 1);
  assert.equal(evaluateMath("2**-1*2", {}, plot), 1);
  for (const options of [plot, {}, plot, {}]) {
    const legacy = options === plot;
    const vars = { p: "2^3^2" };
    const declarations = [{ type: "function", name: "f", params: [], body: "1||0&&0" }];
    assert.equal(evaluateRestrictedExpression("p+f()", vars, { ...options, declarations }).value, legacy ? 513 : 64);
  }
  assert.equal(evaluateMath("2^3^2", {}, { fixedPointDivision: false }), 64, "precision is not a dialect");
});

test("PGF macro coordinates and gnuplot-style plot powers reach the interpreter IR", () => {
  const parsed = parseTikz(String.raw`\begin{tikzpicture}
    \pgfmathsetmacro{\p}{-2^3^2}
    \coordinate (op) at (\p,{0||-.25});
    \draw[domain=0:1,samples=2] plot function {2**3**2};
    \draw[domain=0:1,samples=2] plot function {1||0&&0};
  \end{tikzpicture}`);
  const { ir, diagnostics } = interpretTikz(parsed.ast);
  assert.deepEqual([...parsed.diagnostics, ...diagnostics], []);
  assert.deepEqual(ir.coordinates.op, { x: -64, y: 1 });
  assert.deepEqual(ir.items.filter(item => item.type === "path").map(path => path.commands.map(point => point.y)),
    [[512, 512], [1, 1]]);
});

test("plot function samples round floating values without converting them to TeX dimensions", () => {
  const tex = [
    "\\begin{tikzpicture}",
    "\\draw[domain=0:1,samples=2] plot function {floor(2.999999)};",
    "\\draw[domain=0:1,samples=2] plot function {floor(20000.25+x)-20000};",
    "\\draw[domain=0:1,samples=2] plot function {ceil(-2.999999)};",
    "\\end{tikzpicture}"
  ].join("\n");
  const parsed = parseTikz(tex);
  const { ir, diagnostics } = interpretTikz(parsed.ast);
  assert.deepEqual([...parsed.diagnostics, ...diagnostics], []);
  assert.deepEqual(ir.items.filter(item => item.type === "path").map(path => path.commands.map(p => p.y)),
    [[2, 2], [0, 1], [-2, -2]]);
  assert.equal(evaluateMath("floor(2.999999)"), 3, "ordinary PGF still rounds the argument to scaled points");
});

test("boolean normalization preserves lazy branches and diagnoses invalid visited operands", () => {
  assert.equal(evaluateMath("7||unknown()"), 1);
  assert.equal(evaluateMath("-0&&unknown()"), 0);
  for (const expr of ["0||sqrt(-1)", "2&&sqrt(-1)", "(1/0)||1"]) {
    assert.equal(evaluateRestrictedExpression(expr).diagnostic?.code, "math-nonfinite", expr);
  }
  assert.equal(evaluateRestrictedExpression("0||missing").diagnostic?.code, "math-unknown-variable");
});

// Opt in so the JS regression suite also works on machines without MacTeX.
test("replay the operator probes in native basic PGF and FPU", { skip: !process.env.PGF_MATH_PDFLATEX }, (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "pgf-operator-probe-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const controls = [...powers, ...booleans, ...modeCases].map(([expr]) => expr);
  const grid = [];
  for (const a of ["2", "-2", "(-2)", ".5"]) for (const b of ["+1", "1", "-1", "2", "-2", "(-2)"]) for (const c of ["1", "2"]) {
    grid.push(`${a}^${b}^${c}`, `(${a}^${b})^${c}`, `${a}^(${b}^${c})`);
  }
  const values = ["0", "-0", ".125", "-.25", "7", ".000001", ".00001"];
  for (const a of values) for (const b of values) for (const c of values) {
    for (const op of ["&&", "||"]) for (const next of ["&&", "||"]) grid.push(`${a}${op}${b}${next}${c}`);
  }
  const basic = [...new Set([...controls, ...grid])];
  const sources = [...basic, ...controls];
  const commands = (expressions, start) => expressions.map((expr, i) => String.raw`\pgfmathparse{${expr}}\typeout{OP${start + i}=\pgfmathresult}`).join("\n");
  const tex = String.raw`\documentclass{article}\usepackage{pgf}\usepgflibrary{fpu}\begin{document}
    ${commands(basic, 0)}
    \pgfkeys{/pgf/fpu=true,/pgf/fpu/output format=fixed}
    ${commands(controls, basic.length)}
    \end{document}`;
  writeFileSync(join(cwd, "probe.tex"), tex);
  const run = spawnSync(process.env.PGF_MATH_PDFLATEX, ["-no-shell-escape", "-halt-on-error", "-interaction=nonstopmode", "probe.tex"],
    { cwd, encoding: "utf8", timeout: 15000 });
  assert.equal(run.status, 0, run.error?.message || run.stdout);
  const actual = [...run.stdout.matchAll(/^OP(\d+)=(-?[\d.]+)\s*$/gm)].map(m => [Number(m[1]), Number(m[2])]);
  assert.equal(actual.length, sources.length);
  for (const [i, [index, value]] of actual.entries()) {
    const expr = sources[i];
    const fpu = i >= basic.length;
    const js = fpu ? evaluateAxisExpression(expr, 0) : evaluateMath(expr);
    assert.equal(index, i);
    // Grouping is under test, not FPU pow precision (locally 512.00012).
    if (fpu && expr === "2^(3^2)") assert.ok(Math.abs(js - value) < .001, expr);
    else assert.equal(js, value, expr);
  }
});
