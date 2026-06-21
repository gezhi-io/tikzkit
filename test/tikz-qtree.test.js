import assert from "node:assert/strict";
import test from "node:test";
import { tikzQtreeExtension, tikzToSvg } from "../src/index.js";

test("exposes tikz-qtree as a built-in extension module", () => {
  assert.equal(tikzQtreeExtension.name, "tikz-qtree");
  assert.ok(tikzQtreeExtension.commands.includes("Tree"));
});

test("expands common tikz-qtree bracket trees into ordinary TikZ nodes and edges", () => {
  const source = String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz}
\usepackage{tikz-qtree}
\begin{document}
\begin{tikzpicture}[level distance=36pt,sibling distance=18pt]
\Tree [.S [.NP [.Det the ] [.N cat ] ]
          [.VP [.V sat ]
               [.PP [.P on ]
                    [.NP [.Det the ] [.N mat ] ] ] ] ]
\end{tikzpicture}
\end{document}`;

  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "S"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text === "cat"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "qtree-edge"));
});

test("supports explicit qtree roof edges and node labels", () => {
  const source = String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-qtree}
\begin{document}
\begin{tikzpicture}
\Tree [.CP [.NP \node(wh){what}; ]
           [.C$'$ [.I did ]
                  [.VP \edge[roof]; {a very long predicate phrase} ] ] ]
\draw[->] (wh) -- +(1,-1);
\end{tikzpicture}
\end{document}`;

  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("what")));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "qtree-roof"));
});
