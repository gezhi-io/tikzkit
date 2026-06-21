import assert from "node:assert/strict";
import test from "node:test";
import { tikzDecofontsExtension, tikzToSvg } from "../src/index.js";

test("exposes tikz-decofonts as a built-in extension module", () => {
  assert.equal(tikzDecofontsExtension.name, "tikz-decofonts");
  assert.equal(tikzDecofontsExtension.phase, "preprocess");
  assert.ok(tikzDecofontsExtension.commands.includes("tkzpixl"));
  assert.equal(typeof tikzDecofontsExtension.preprocess, "function");
});

test("expands tikz-decofonts text effects into ordinary TikZ drawings", () => {
  const result = tikzToSvg(String.raw`
\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-decofonts}
\begin{document}
\tkzpixl[color=violet,height=1cm,border]{Ab 12!?}
\tkzbicolor[colors=blue/red,style=ndiag]{\Huge\sffamily DECORATION}
\tkzsurround[color=orange,node=AAA]{$I=\int_a^b f(x)\,\mathrm{d}x$}
\tkzunderline[color=blue,width=1.5pt,height=8mm]{underlining}
\tkzcomicbubble[width=3cm,coltxt=red,colframe=teal,colbg=yellow!15,rcorners]{Let's play!}
\tkzfittextinarrow[width=4cm,color=teal,txtcolor=yellow]{\bfseries Demo}
\tkzcircledtxt[auto=2,fill=false,rule color=orange]{99}
\tkzbrush[color=blue]{TIKZ}
\tkzink[color=olive,thick=5]{INK}
\end{document}`);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.subtype === "decofonts-pixl"));
  assert.ok(result.ir.items.some((item) => item.subtype === "decofonts-surround"));
  assert.ok(result.ir.items.some((item) => item.subtype === "decofonts-underline"));
  assert.ok(result.ir.items.some((item) => item.subtype === "decofonts-fit-arrow"));
  assert.ok(result.ir.items.some((item) => item.type === "nodeBox" && item.shape === "ellipse"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && /DECORATION/.test(item.text)));
});
