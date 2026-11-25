import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { evaluateMath, evaluateMathResult } from "../src/engine/math.js";
import { createMathRuntime, evaluateRestrictedExpression } from "../src/engine/safe-expression.js";
import { evaluateAxisExpression } from "../src/pgfplots/expressions.js";

// Independent pdfTeX results from fixtures/native-rounding-boundaries.tex.
const native = [
  ["round(2.499999)", 3, 2], ["round(-2.499999)", -3, -2],
  ["round(2.49999)", 2, 2], ["round(-2.49999)", -2, -2],
  ["round(2.49999237060546875)", 3, 2], ["round(-2.49999237060546875)", -3, -2],
  ["round(2.49999237060546874)", 2, 2], ["round(-2.49999237060546874)", -2, -2],
  ["round(0.499999)", 1, 0], ["round(-0.499999)", -1, 0],
  ["round(0.000001)", 0, 0], ["round(-0.000001)", 0, 0],
  ["floor(2.999999)", 3, 2], ["floor(-2.000001)", -2, -3],
  ["floor(2.99999)", 2, 2], ["floor(-2.00001)", -3, -3],
  ["floor(-0.000001)", 0, -1], ["floor(-0.00001)", -1, -1],
  ["ceil(2.000001)", 2, 3], ["ceil(-2.999999)", -3, -2],
  ["ceil(2.00001)", 3, 3], ["ceil(-2.99999)", -2, -2],
  ["ceil(0.000001)", 0, 1], ["ceil(0.00001)", 1, 1],
  ["round(0.49999+0.000004)", 0, 0], ["round(0.249996+0.249996)", 1, 0],
  ["floor(3-0.000001)", 3, 2], ["ceil(2+0.000001)", 2, 3],
  ["round(32.5/17)", 2, 2], ["floor(398/12)", 33, 33], ["ceil(-398/12)", -33, -33],
  ["round(0.249996*2)", 1, 0], ["floor(1.499999*2)", 3, 2],
  ["ceil(1.000001*2)", 2, 3], ["round(0.999999/2)", 1, 0],
  ["floor(-0.00001/2)", 0, -1], ["round(1.499999*2-0.5)", 3, 2],
  ["round(5.000001/2)", 3, 3], ["round(-5.000001/2)", -3, -3],
  ["round(0.499992370605468749999)", 0, 0],
  ["round(0.499992370605468750000)", 1, 0],
  ["floor(int(2.999999))", 2, 2], ["floor(int(-2.999999))", -3, -2],
  ["round(2.499999e0)", 2, 2], ["ceil(1e-6)", 0, 1], ["floor(-1e-6)", 0, -1],
  ["round(0.2499999e1)", 2, 2], ["floor(0.2999999e1)", 2, 2],
  ["ceil(0.2000001e1)", 2, 3], ["round(24.99999e-1)", 2, 2],
  ["floor(29.99999e-1)", 2, 2], ["ceil(20.00001e-1)", 2, 3],
  ["ceil(9999e-5)", 0, 1], ["round(0.0002499999e4)", 2, 2]
];

for (const [expression, fixed, floating] of native) {
  test(`ordinary PGF scaled-point rounding: ${expression}`, () => {
    assert.equal(evaluateMath(expression), fixed);
    assert.equal(evaluateAxisExpression(expression, 0, { "use fpu": false }), fixed);
  });
  test(`PGFPlots floating rounding remains distinct: ${expression}`, () => {
    assert.equal(evaluateAxisExpression(expression, 0), floating);
  });
}

test("decimal token precision survives string variables and declarations", () => {
  assert.equal(evaluateMath("round(v)", { v: "2.49999237060546874" }), 2);
  assert.equal(evaluateMath(String.raw`round(\v)`, { v: "2.49999237060546875" }), 3);
  assert.equal(evaluateRestrictedExpression("round(v)", { v: "2.49999237060546874" }).value, 2);
  assert.equal(evaluateRestrictedExpression("round(boundary)", {}, {
    declarations: [{ name: "boundary", type: "constant", body: "2.49999237060546874" }]
  }).value, 2);
});

test("native rounding does not globally quantize ordinary coordinates or int", () => {
  assert.equal(evaluateMath("0.249996+0.249996"), .499992);
  assert.equal(evaluateMath("int(2.999999)"), 2);
  assert.equal(evaluateMath("floor(int(2.999999))"), 2);
  assert.equal(evaluateMath("round(2.499999)+0.000001"), 3.000001);
});

test("rounding runtime and PGFPlots use fpu=false select the correct arithmetic", () => {
  assert.equal(createMathRuntime().round.fn(2.499999), 3);
  assert.equal(createMathRuntime({ fixedPointRounding: false }).round.fn(2.499999), 2);
  assert.equal(evaluateAxisExpression("round(2.499999)", 0, { "use fpu": "false" }), 3);
  assert.equal(evaluateAxisExpression("round(2.499999)", 0, { "use fpu": "true" }), 2);
});

test("invalid arguments remain errors and rounding cannot execute variable getters", () => {
  for (const expression of ["round(sqrt(-1))", "floor(1/0)", "ceil(missing)", "round(unknown(1))"]) {
    assert.equal(evaluateMathResult(expression).ok, false, expression);
  }
  let calls = 0;
  const variables = Object.defineProperty({}, "v", { get() { calls += 1; return 2.499999; } });
  assert.equal(evaluateRestrictedExpression("round(v)", variables).diagnostic.code, "math-invalid-variable");
  assert.equal(calls, 0);
  assert.equal(evaluateRestrictedExpression("round(v)", { v: "v" }).diagnostic.code, "math-expression-limit");
});

test("fixed-point boundary corrections reach macros and actual scene coordinates", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \pgfmathsetmacro{\r}{round(2.499999)}
    \coordinate (rounded) at (\r,0);
    \coordinate (floor) at ({floor(-2.000001)},1);
    \coordinate (ceil) at ({ceil(2.000001)},2);
    \coordinate (sum) at ({round(0.249996+0.249996)},3);
  \end{tikzpicture}`);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ir.coordinates.rounded.x, 3);
  assert.equal(result.ir.coordinates.floor.x, -2);
  assert.equal(result.ir.coordinates.ceil.x, 2);
  assert.equal(result.ir.coordinates.sum.x, 1);
});

test("use fpu switches actual plotted coordinates without leaking to the next axis", () => {
  for (const [useFpu, expected] of [[true, 2], [false, 3], [true, 2]]) {
    const result = tikzToSvg(String.raw`\begin{tikzpicture}
      \begin{axis}[use fpu=${useFpu},width=8cm,height=5cm,xmin=0,xmax=1,
        ymin=0,ymax=4,enlargelimits=false]
      \addplot[domain=0:1,samples=2]{round(2.499999)};
      \addplot[domain=0:1,samples=2]{${expected}};
      \end{axis}\end{tikzpicture}`);
    assert.deepEqual(result.diagnostics, []);
    const plots = result.ir.items.filter(item => item.subtype === "axis-plot");
    assert.equal(plots.length, 2);
    assert.deepEqual(plots[0].commands, plots[1].commands);
  }
});

test("ordinary dimension overflow is not silently clamped or applied to plot FPU", () => {
  assert.equal(evaluateMathResult("floor(16384)").diagnostic.code, "math-nonfinite");
  assert.equal(evaluateMathResult("ceil(-16384)").diagnostic.code, "math-nonfinite");
  assert.equal(evaluateAxisExpression("floor(16384)", 0), 16384);
  assert.equal(evaluateAxisExpression("ceil(-16384)", 0), -16384);
});
