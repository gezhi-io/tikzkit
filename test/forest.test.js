import assert from "node:assert/strict";
import test from "node:test";
import { forestExtension, tikzToSvg } from "../src/index.js";

test("exposes forest as a built-in extension module", () => {
  assert.equal(forestExtension.name, "forest");
  assert.ok(forestExtension.commands.includes("forest"));
});

test("expands Case 172 style forest branch-and-bound trees", () => {
  const source = String.raw`\documentclass{standalone}
\usepackage{forest}
\tikzset{
  tree node/.style = {align=center, inner sep=0pt, draw, circle, minimum size=18},
  tree node label/.style={font=\scriptsize},
}
\forestset{
  branch and bound/.style={
    for tree={
      tree node,
      math content,
      s sep'+=20mm,
      l sep'+=5mm,
      thick,
      edge+={thick},
    },
    before typesetting nodes={
      for tree={
        split option={content}{:}{content,branch label},
      },
    },
  },
}
\begin{document}
\begin{forest}
  branch and bound,
  [P_0[P_1:0][P_2:1[P_3:0[P_5:0][P_6:1]][P_4:1]]]
\end{forest}
\end{document}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const edges = result.ir.items.filter((item) => item.type === "path" && item.subtype === "forest-edge");
  const nodeBoxes = result.ir.items.filter((item) => item.type === "nodeBox" && item.subtype === "forest-node");
  const branchLabels = result.ir.items.filter((item) => item.type === "textNode" && /x_\\d/.test(item.text));
  const textNode = (text) => result.ir.items.find((item) => item.type === "textNode" && item.text === text);
  const xSpan = Math.max(...nodeBoxes.map((item) => item.x)) - Math.min(...nodeBoxes.map((item) => item.x));
  const ySpan = Math.max(...nodeBoxes.map((item) => item.y)) - Math.min(...nodeBoxes.map((item) => item.y));

  assert.deepEqual(result.diagnostics, []);
  for (const label of ["$P_0$", "$P_1$", "$P_2$", "$P_3$", "$P_4$", "$P_5$", "$P_6$"]) {
    assert.ok(labels.includes(label), `expected forest node ${label}`);
  }
  for (const label of ["$x_1 \\leq 0$", "$x_1 \\geq 1$", "$x_2 \\leq 0$", "$x_2 \\geq 1$", "$x_3 \\leq 0$", "$x_3 \\geq 1$"]) {
    assert.ok(labels.includes(label), `expected branch label ${label}`);
  }
  assert.equal(edges.length, 6);
  assert.equal(nodeBoxes.length, 7);
  assert.ok(xSpan > 4.2 && xSpan < 4.45, `expected native-like forest sibling span, got ${xSpan}`);
  assert.ok(ySpan > 4.4 && ySpan < 4.9, `expected forest l sep to expand level spacing, got ${ySpan}`);
  assert.ok(branchLabels.every((item) => item.style.fontScale >= 0.95), "expected branch labels to match forest edge label size");
  assert.ok(Math.abs(textNode("$P_0$").x - textNode("$P_3$").x) < 0.01, "expected P0 and P3 to share a branch column");
  assert.ok(Math.abs(textNode("$P_1$").x - textNode("$P_5$").x) < 0.01, "expected P1 and P5 to share a branch column");
  assert.ok(Math.abs(textNode("$P_2$").x - textNode("$P_6$").x) < 0.01, "expected P2 and P6 to share a branch column");
});
