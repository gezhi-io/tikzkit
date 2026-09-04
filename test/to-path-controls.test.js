import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { interpretTikz, parseTikz } from "../src/index.js";

function renderedPaths(source) {
  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  assert.deepEqual(diagnostics, []);
  return ir.items.filter((item) => item.type === "path");
}

function cubic(path) {
  const curve = path.commands.at(-1);
  assert.equal(curve.type, "curveTo");
  return curve;
}

function closeTo(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
}

test("uses controls as start-relative and target-relative cubic points", () => {
  const [path] = renderedPaths(String.raw`
\begin{tikzpicture}
  \draw (0,0) to[controls=+(0,1) and +(0,1)] (3,0);
\end{tikzpicture}`);
  const curve = cubic(path);

  closeTo(curve.x1, 0);
  closeTo(curve.y1, 1);
  closeTo(curve.x2, 3);
  closeTo(curve.y2, 1);
});

test("uses absolute coordinates for explicit curve controls", () => {
  const [path] = renderedPaths(String.raw`
\begin{tikzpicture}
  \draw (0,0) to[controls={(1,2) and (4,-1)}] (5,0);
\end{tikzpicture}`);
  const curve = cubic(path);

  closeTo(curve.x1, 1);
  closeTo(curve.y1, 2);
  closeTo(curve.x2, 4);
  closeTo(curve.y2, -1);
});

test("mixes an explicit outgoing control with an automatic incoming arm", () => {
  const [path] = renderedPaths(String.raw`
\begin{tikzpicture}
  \draw (0,0) to[out=0,in=180,out control=+(0,1),in distance=5mm] (3,0);
\end{tikzpicture}`);
  const curve = cubic(path);

  closeTo(curve.x1, 0);
  closeTo(curve.y1, 1);
  closeTo(curve.x2, 2.5);
  closeTo(curve.y2, 0);
});

test("lets later same-side distance and control options select the computation mode", () => {
  const [distanceLast, controlLast] = renderedPaths(String.raw`
\begin{tikzpicture}
  \draw (0,0) to[out control=+(0,1),out distance=4mm] (3,0);
  \draw (0,2) to[out distance=4mm,out control=+(0,1)] (3,2);
\end{tikzpicture}`);
  const automatic = cubic(distanceLast);
  const explicit = cubic(controlLast);

  closeTo(automatic.x1, Math.SQRT1_2 * 0.4);
  closeTo(automatic.y1, Math.SQRT1_2 * 0.4);
  closeTo(explicit.x1, 0);
  closeTo(explicit.y1, 3);
});

test("resets only the requested side after controls", () => {
  const [path] = renderedPaths(String.raw`
\begin{tikzpicture}
  \draw (0,0) to[controls=+(0,1) and +(0,1),out distance=5mm] (3,0);
\end{tikzpicture}`);
  const curve = cubic(path);

  closeTo(curve.x1, Math.SQRT1_2 * 0.5);
  closeTo(curve.y1, Math.SQRT1_2 * 0.5);
  closeTo(curve.x2, 3);
  closeTo(curve.y2, 1);
});

test("follows PGF relative curve computation when relative and controls are combined", () => {
  const [path] = renderedPaths(String.raw`
\begin{tikzpicture}
  \draw (0,0) to[relative,controls=+(0,2) and +(0,2)] (2,0);
\end{tikzpicture}`);
  const curve = cubic(path);

  assert.ok(curve.x1 > 0.5 && curve.x1 < 0.6);
  assert.ok(curve.y1 > 0.5 && curve.y1 < 0.6);
  assert.ok(curve.x2 > 1.4 && curve.x2 < 1.5);
  assert.ok(curve.y2 > 0.5 && curve.y2 < 0.6);
});

test("carries explicit controls through a chain join", () => {
  const [join] = renderedPaths(String.raw`
\usetikzlibrary{chains}
\begin{tikzpicture}[start chain=nodes going right]
  \node[draw,on chain] (a) {A};
  \node[draw,on chain,join=by {controls=+(0,8mm) and +(0,8mm)}] (b) {B};
\end{tikzpicture}`);
  const start = join.commands[0];
  const curve = cubic(join);

  assert.ok(curve.y1 > start.y + 0.5);
  assert.ok(curve.y2 > curve.y + 0.5);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the explicit-control ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/paths/curve-control-${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
    const curves = ir.items.filter(
      (item) => item.type === "path" && item.commands.at(-1)?.type === "curveTo"
    );

    assert.deepEqual(diagnostics, []);
    assert.ok(curves.length >= 2, `expected explicit-control curves, got ${curves.length}`);
  });
}

test("records the reviewed topaths slice in both extension registries", () => {
  const markdown = readFileSync("docs/extension-registry.md", "utf8");
  const csv = readFileSync("docs/extension-registry.csv", "utf8");

  assert.match(markdown, /^\| tikzlibrary \| topaths \| 6 \| found \| yes \|/m);
  assert.match(csv, /^tikzlibrary,topaths,6,partial,/m);
});
