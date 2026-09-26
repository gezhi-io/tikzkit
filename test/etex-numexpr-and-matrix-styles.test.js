import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";
import { expandTheNumexpr } from "../src/tex/etexArithmetic.js";

function fills(source) {
  return tikzToSvg(source, { mathRenderer: "svg-text" })
    .ir.items.filter((item) => item.type === "path")
    .map((item) => item.style?.fill)
    .filter(Boolean);
}

test("evaluates e-TeX integer arithmetic in \\the\\numexpr", () => {
  assert.equal(expandTheNumexpr(String.raw`blue!\the\numexpr20+10*3\relax`), "blue!50");
  assert.equal(expandTheNumexpr(String.raw`\the\numexpr3*4\relax`), "12");
  assert.equal(expandTheNumexpr(String.raw`\the\numexpr (2+3)*4\relax`), "20");
  // Local e-TeX rounds division; TeX's separate \divide primitive truncates.
  assert.equal(expandTheNumexpr(String.raw`\the\numexpr7/2\relax`), "4");
  // `\theta` shares the `\the` prefix but is a different command.
  assert.equal(expandTheNumexpr(String.raw`\theta_0`), String.raw`\theta_0`);
  // A variable that is not bound yet is left for the loop body to retry.
  const diagnostics = [];
  assert.equal(
    expandTheNumexpr(String.raw`blue!\the\numexpr20+10*\x\relax`, diagnostics),
    String.raw`blue!\the\numexpr20+10*\x\relax`
  );
  assert.deepEqual(diagnostics, []);
});

test("numexpr rounds each division and preserves fused multiply/divide scaling", () => {
  for (const [expression, expected] of [
    ["-7/2", "-4"], ["7/-2", "-4"], ["-7/-2", "4"],
    ["7/2*20", "80"], ["(7/2)*20", "80"], ["3*13/5", "8"],
    ["2147483647*2/2", "2147483647"], ["1+3/2+3/2", "5"]
  ]) {
    assert.equal(expandTheNumexpr(`\\the\\numexpr${expression}\\relax`), expected, expression);
  }
});

test("numexpr does not consume following conditional or unrelated command tokens", () => {
  for (const suffix of [String.raw`\else`, String.raw`\fi`, String.raw`\or`, String.raw`\relaxation`]) {
    assert.equal(expandTheNumexpr(String.raw`\the\numexpr2+3` + suffix), "5" + suffix);
  }
  assert.equal(expandTheNumexpr(String.raw`\the\numexpression2+3\relax`), String.raw`\the\numexpression2+3\relax`);
});

test("numexpr leaves invalid, overflowing and unsupported integer expressions intact", () => {
  for (const expression of ["1/0", "2147483647+1", "(2147483647*2)/2", "2^3", "1.5+2", "1<2"]) {
    const source = `\\the\\numexpr${expression}\\relax`;
    const diagnostics = [];
    assert.equal(expandTheNumexpr(source, diagnostics), source, expression);
    assert.ok(diagnostics.some((entry) => entry.code === "numexpr-unsupported"), expression);
  }
});

test("foreach accepts whitespace between the and numexpr", () => {
  const render = (command) => fills(String.raw`\begin{tikzpicture}
    \foreach \x in {1,3,5} {\fill[blue!` + command + String.raw`\x/2*20\relax]
      (\x,0) rectangle ++(0.5,0.5);}
  \end{tikzpicture}`);
  const expected = ["rgb(204 204 255)", "rgb(153 153 255)", "rgb(102 102 255)"];
  assert.deepEqual(render(String.raw`\the\numexpr`), expected);
  assert.deepEqual(render(String.raw`\the \numexpr `), expected);
});

test("foreach resolves \\the\\numexpr once the loop variable is bound", () => {
  const values = fills(String.raw`
\begin{tikzpicture}
  \foreach \x in {0,...,2}
    \fill[blue!\the\numexpr20+10*\x\relax] (\x*0.5,0) rectangle ++(0.4,0.4);
\end{tikzpicture}`);
  assert.equal(values.length, 3);
  assert.equal(new Set(values).size, 3, `expected three distinct shades, got ${JSON.stringify(values)}`);
});

test("matrix column styles apply before row styles like PGF's inner style order", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{matrix}
\begin{tikzpicture}
  \matrix (m) [matrix of nodes,
    nodes={draw, minimum size=0.7cm},
    row 1/.style={nodes={fill=blue!20}},
    column 2/.style={nodes={fill=red!20}}
  ] {
    a & b & c \\
    d & e & f \\
  };
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const fillOf = (id) => result.ir.items.find((item) => item.type === "nodeBox" && item.id === id)?.style?.fill;
  // Row 1 wins over column 2 at the overlap, because `row` is applied after
  // `column` in PGF's matrix/inner style order.
  assert.equal(fillOf("m-1-1"), "rgb(204 204 255)");
  assert.equal(fillOf("m-1-2"), "rgb(204 204 255)");
  assert.equal(fillOf("m-2-2"), "rgb(255 204 204)");
  assert.equal(fillOf("m-2-1"), "none");
  assert.equal(fillOf("m-2-3"), "none");
});
