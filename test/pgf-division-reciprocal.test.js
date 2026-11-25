import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { tikzToSvg } from "../src/index.js";
import { evaluateMath, evaluateMathResult } from "../src/engine/math.js";
import { evaluateRestrictedExpression } from "../src/engine/safe-expression.js";
import { evaluateAxisExpression } from "../src/pgfplots/expressions.js";
import { PGF_SP, pgfDimension, pgfPrintDimension } from "../src/engine/pgf-fixed-point.js";

// Independent MacTeX results from fixtures/native-division-reciprocal.tex.
// In particular, reciprocal(x) and 1/x are NOT interchangeable in basic PGF.
const native = [
  ["75/6", 12.5], ["1/3", .33333], ["-1/3", -.33333],
  ["1/-3", -.33333], ["-1/-3", .33333], ["1/1.5", .6667],
  ["1/2.5", .4], ["2/1.5", 1.3333], ["10/3.3", 3.0303],
  ["1/1.1", .9091], ["2.99999/1.5", 2], ["4.99999/2.5", 2.001],
  ["7.49999/2.5", 3.001], ["1/0.1", 10], ["1/0.3", 3.33337],
  ["1/0.7", 1.4286], ["1/0.99", 1.0101], ["1/0.99999", 1],
  ["-1/0.3", -3.33337], ["1/-0.3", -3.33337], ["-1/-0.3", 3.33337],
  ["0.3/0.1", 3.00003], ["0.6/0.2", 3.00003], ["0.9/0.3", 3.00002],
  ["0/1.5", 0], ["0.00002/1.5", 0], ["0.00003/1.5", 0],
  ["1/100.1", .01], ["1/101.25", .00987], ["1/1234.5", .00081],
  ["1234.5/1.2345", 1000.0023], ["12.345/6.789", 1.8184], ["100/7.7", 12.98701],
  ["divide(75,6)", 12.5], ["divide(1,0.3)", 3.33337], ["divide(-2.5,1.25)", -2],
  ["reciprocal(1)", 1], ["reciprocal(3)", .33333], ["reciprocal(-3)", -.33333],
  ["reciprocal(0.1)", 10], ["reciprocal(0.3)", 3.33337], ["reciprocal(0.7)", 1.4286],
  ["reciprocal(0.99)", 1.0101], ["reciprocal(0.99999)", 1],
  ["reciprocal(1.1)", .90921], ["reciprocal(1.5)", .66675], ["reciprocal(2.5)", .40009],
  ["reciprocal(-0.3)", -3.33337], ["reciprocal(-1.5)", -.66675],
  ["reciprocal(100)", .01], ["reciprocal(100.1)", .00989],
  ["reciprocal(100.99999)", .00989], ["reciprocal(101)", .00989],
  ["reciprocal(101.25)", .00987], ["reciprocal(-101.25)", -.0098],
  ["reciprocal(1234.5)", .00081], ["reciprocal(-1234.5)", -.0008],
  ["reciprocal(0.0001)", 10000], ["reciprocal(0.001)", 1000], ["reciprocal(0.01)", 100],
  ["floor(0.6/0.2)", 3], ["floor(0.9/0.3)", 3], ["floor(7.49999/2.5)", 3],
  ["floor(4.99999/2.5)", 2], ["round(1.24999/2.5)", 1],
  ["floor(3*reciprocal(0.3))", 10], ["floor(10*reciprocal(1.1))", 9],
  ["ceil(3*reciprocal(1.5))", 3], ["ceil(3*reciprocal(-1.5))", -2],
  ["round(1e-5/1.5)", 0], ["1/(0.1+0.2)", 3.33337],
  ["reciprocal(0.1+0.2)", 3.33337], ["divide(1,reciprocal(0.3))", .29999],
  ["1/(1+exp(5*0.4))", .1192], ["(1980-1975)/3", 1.66666], ["2/(4-1)", .66666],
  ["div(7.49999,2.5)", 3], ["div(-7.49999,2.5)", -3],
  ["div(7.49999,-2.5)", -3], ["div(-7.49999,-2.5)", 3]
];

for (const [expression, expected] of native) {
  test(`native PGF division: ${expression}`, () => {
    assert.equal(evaluateMath(expression), expected);
    assert.equal(evaluateAxisExpression(expression, 0, { "use fpu": false }), expected);
  });
}

test("division and reciprocal propagate through variables, macros and coordinates", () => {
  assert.equal(evaluateMath(String.raw`\a/\b`, { a: "7.49999", b: "2.5" }), 3.001);
  assert.equal(evaluateRestrictedExpression("reciprocal(r)", { r: "0.1+0.2" }).value, 3.33337);
  assert.equal(evaluateRestrictedExpression("inverse(1.5)", {}, {
    declarations: [{ name: "inverse", type: "function", params: ["t"], body: "reciprocal(t)" }]
  }).value, .66675);
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \pgfmathsetmacro{\q}{7.49999/2.5}
    \pgfmathsetmacro{\r}{reciprocal(1.5)}
    \coordinate (q) at (\q,0);
    \coordinate (r) at (\r,1);
    \coordinate (carry) at ({floor(7.49999/2.5)},2);
    \coordinate (nested) at ({ceil(3*reciprocal(1.5))},3);
  \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.coordinates.q.x, 3.001);
  assert.equal(result.ir.coordinates.r.x, .66675);
  assert.equal(result.ir.coordinates.carry.x, 3);
  assert.equal(result.ir.coordinates.nested.x, 3);
});

test("PGFPlots FPU division remains floating and does not leak between axes", () => {
  for (const useFpu of [true, false, true]) {
    const expected = useFpu ? 1 / 1.5 : .6667;
    assert.equal(evaluateAxisExpression("1/1.5", 0, { "use fpu": useFpu }), expected);
    assert.equal(evaluateAxisExpression("divide(1,1.5)", 0, { "use fpu": useFpu }), expected);
    assert.equal(evaluateAxisExpression("reciprocal(1.5)", 0, { "use fpu": useFpu }), useFpu ? 1 / 1.5 : .66675);
  }
  assert.equal(evaluateAxisExpression("1/0.000001", 0), 1000000);
});

test("invalid division is bounded, diagnosed and remains lazy in conditionals", () => {
  for (const expression of ["1/0", "divide(1,0)", "reciprocal(0)",
    "reciprocal(0.000001)", "1/0.000001", "reciprocal(0.00002)",
    "16384/2", "divide(sqrt(-1),2)", "reciprocal(sqrt(-1))"]) {
    assert.equal(evaluateMathResult(expression).diagnostic?.code, "math-nonfinite", expression);
  }
  assert.equal(evaluateMath("0 ? reciprocal(0) : 2"), 2);
  assert.equal(evaluateMath("1 ? 2 : divide(1,0)"), 2);
  for (const expression of ["divide(1)", "reciprocal(1,2)"]) {
    assert.equal(evaluateMathResult(expression).diagnostic?.code, "math-arity", expression);
  }
  let calls = 0;
  const variables = Object.defineProperty({}, "r", { get() { calls++; return .3; } });
  assert.equal(evaluateRestrictedExpression("reciprocal(r)", variables).diagnostic.code, "math-invalid-variable");
  assert.equal(calls, 0);
});

test("TeX's printed dimensions round-trip every fractional scaled point", () => {
  for (let sp = -PGF_SP; sp <= PGF_SP; sp++) {
    const value = sp / PGF_SP;
    assert.equal(pgfDimension(pgfPrintDimension(value)), value);
  }
  // print_scaled chooses a shorter round-tripping token than toFixed(5).
  assert.equal(pgfPrintDimension(pgfDimension(.1)), "0.1");
  assert.equal(pgfPrintDimension(pgfDimension(1 / 3)), "0.33333");
  assert.equal(pgfPrintDimension(pgfDimension(-.3)), "-0.3");
  assert.equal(pgfPrintDimension(NaN), "NaN");
  assert.equal(pgfPrintDimension(Infinity), "NaN");
});

test("native signed division cross-product covers small remainders and carries", () => {
  const samples = JSON.parse(readFileSync(new URL("./fixtures/native-division-grid.json", import.meta.url), "utf8"));
  assert.equal(samples.length, 208);
  for (const [expression, expected] of samples) assert.equal(evaluateMath(expression), expected, expression);
});

test("gnuplot-compatible floating evaluation does not inherit PGF dimension limits", () => {
  assert.equal(evaluateMath("1/3", {}, { fixedPointDivision: false }), 1 / 3);
  assert.equal(evaluateMathResult("1/3", {}, { fixedPointDivision: false }).value, 1 / 3);
  assert.equal(evaluateMathResult("1/3").value, .33333);
  assert.ok(Number.isFinite(evaluateMath("gamma(40)/(gamma(20)*gamma(20))", {}, { fixedPointDivision: false })));
});
