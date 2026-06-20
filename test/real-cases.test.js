import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz, interpretTikz, renderSvg, tikzToSvg } from "../src/index.js";
import { readFileSync } from "node:fs";
import { PACKT_CASES, PACKT_ROOT } from "../scripts/packt-real-cases.js";

test("renders 20 Packt TikZ examples without diagnostics", () => {
  const results = PACKT_CASES.map((relativePath) => {
    const source = readFileSync(`${PACKT_ROOT}/${relativePath}`, "utf8");
    const result = tikzToSvg(source);
    return {
      relativePath,
      diagnostics: result.diagnostics,
      svgLength: result.svg.length,
      itemCount: result.ir.items.length
    };
  });

  const failures = results.filter((result) => result.diagnostics.length > 0 || result.itemCount === 0);
  assert.deepEqual(failures, []);
  assert.equal(results.length, 20);
  assert.equal(results.every((result) => result.svgLength > 100), true);
});

test("supports grid, option-radius shapes, arcs, inline nodes, to curves, plot functions, and repeated markings", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[thin,dotted] (-1,-1) grid (1,1);
  \draw[fill=yellow] (0,0) circle [radius=2];
  \draw (0.5,0.5) ellipse [x radius=0.2, y radius=0.4];
  \draw (-1,-1) arc [start angle=185, end angle=355, x radius=1, y radius=0.5];
  \draw (0,0) node[draw, fill=yellow, text=blue] {TikZ};
  \node[draw] (A) {A};
  \node[draw, right=of A] (B) {B};
  \draw[->] (A) to[out=45, in=225] (B);
  \draw[domain=-1:1,samples=8,color=gray!50] plot (\x, \x*\x);
  \draw[-stealth,postaction=decorate, decoration={markings, mark = between positions 0.2 and 1 step 0.2 with {\arrow{stealth}}}] (0,-2) -- (2,-2);
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const interpreted = interpretTikz(parsed.ast);
  const diagnostics = [...parsed.diagnostics, ...interpreted.diagnostics];
  const svg = renderSvg(interpreted.ir);

  assert.deepEqual(diagnostics, []);
  assert.equal(interpreted.ir.items.filter((item) => item.subtype === "grid-line").length, 6);
  assert.equal(interpreted.ir.items.some((item) => item.shape === "arc"), true);
  assert.equal(interpreted.ir.items.filter((item) => item.type === "textNode").length >= 3, true);
  assert.equal(interpreted.ir.items.filter((item) => item.type === "marker").length, 5);
  assert.match(svg, /stroke="rgb\(192 192 192\)"/);
});
