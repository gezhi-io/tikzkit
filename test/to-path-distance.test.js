import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { interpretTikz, parseTikz } from "../src/index.js";

function renderedPaths(source) {
  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  assert.deepEqual(diagnostics, []);
  return ir.items.filter((item) => item.type === "path");
}

function curveArmLengths(path) {
  const start = path.commands[0];
  const curve = path.commands.at(-1);
  assert.equal(start.type, "moveTo");
  assert.equal(curve.type, "curveTo");
  return {
    out: Math.hypot(curve.x1 - start.x, curve.y1 - start.y),
    in: Math.hypot(curve.x2 - curve.x, curve.y2 - curve.y)
  };
}

function vectorAngle(x, y) {
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function closeTo(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
}

test("uses PGF default in and out angles when only one curve angle is supplied", () => {
  const [outOnly, inOnly] = renderedPaths(String.raw`
\begin{tikzpicture}
  \draw (0,0) to[out=20] (2,0);
  \draw (0,1) to[in=160] (2,1);
\end{tikzpicture}`);
  const outCurve = outOnly.commands.at(-1);
  const inCurve = inOnly.commands.at(-1);

  closeTo(vectorAngle(outCurve.x1, outCurve.y1), 20);
  closeTo(vectorAngle(outCurve.x2 - outCurve.x, outCurve.y2 - outCurve.y), 135);
  closeTo(vectorAngle(inCurve.x1, inCurve.y1 - 1), 45);
  closeTo(vectorAngle(inCurve.x2 - inCurve.x, inCurve.y2 - inCurve.y), 160);
});

test("activates the default curve-to path and clamps both arms with min and max distance", () => {
  const [minimum, maximum] = renderedPaths(String.raw`
\begin{tikzpicture}
  \draw (0,0) to[min distance=8mm] (1,0);
  \draw (0,1) to[max distance=4mm] (4,1);
\end{tikzpicture}`);

  const minArms = curveArmLengths(minimum);
  const maxArms = curveArmLengths(maximum);
  closeTo(minArms.out, 0.8);
  closeTo(minArms.in, 0.8);
  closeTo(maxArms.out, 0.4);
  closeTo(maxArms.in, 0.4);
});

test("applies independent in and out looseness and distance bounds", () => {
  const [path] = renderedPaths(String.raw`
\begin{tikzpicture}
  \draw (0,0) to[
    out=0,
    in=180,
    out looseness=.1,
    in looseness=3,
    out min distance=7mm,
    in max distance=5mm
  ] (3,0);
\end{tikzpicture}`);

  const arms = curveArmLengths(path);
  closeTo(arms.out, 0.7);
  closeTo(arms.in, 0.5);
});

test("carries exact in and out distance constraints through a chain join", () => {
  const [join] = renderedPaths(String.raw`
\usetikzlibrary{chains}
\begin{tikzpicture}[
  start chain=nodes going right,
  every join/.style={->}
]
  \node[draw,on chain] (a) {A};
  \node[
    draw,
    on chain,
    join=by {bend left=25,out distance=4mm,in distance=9mm}
  ] (b) {B};
\end{tikzpicture}`);

  const arms = curveArmLengths(join);
  closeTo(arms.out, 0.4);
  closeTo(arms.in, 0.9);
});

test("applies bend and explicit angle keys in source order", () => {
  const [bendLast, outLast] = renderedPaths(String.raw`
\begin{tikzpicture}
  \draw (0,0) to[out=10,bend left=30] (2,0);
  \draw (0,1) to[bend left=30,out=10] (2,1);
\end{tikzpicture}`);
  const bendCurve = bendLast.commands.at(-1);
  const outCurve = outLast.commands.at(-1);

  closeTo(vectorAngle(bendCurve.x1, bendCurve.y1), 30);
  closeTo(vectorAngle(outCurve.x1, outCurve.y1 - 1), 10);
});

test("applies exact and maximum distance keys in source order", () => {
  const [maximumLast, distanceLast] = renderedPaths(String.raw`
\begin{tikzpicture}
  \draw (0,0) to[distance=1cm,out max distance=4mm] (4,0);
  \draw (0,1) to[out max distance=4mm,distance=1cm] (4,1);
\end{tikzpicture}`);
  const maximumArms = curveArmLengths(maximumLast);
  const distanceArms = curveArmLengths(distanceLast);

  closeTo(maximumArms.out, 0.4);
  closeTo(maximumArms.in, 1);
  closeTo(distanceArms.out, 1);
  closeTo(distanceArms.in, 1);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the curve-distance ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/paths/curve-distance-${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
    const curves = ir.items.filter(
      (item) => item.type === "path" && item.commands.at(-1)?.type === "curveTo"
    );

    assert.deepEqual(diagnostics, []);
    assert.ok(curves.length >= 2, `expected visible constrained curves, got ${curves.length}`);
  });
}
