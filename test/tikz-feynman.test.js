import assert from "node:assert/strict";
import test from "node:test";
import { tikzFeynmanExtension, tikzToSvg } from "../src/index.js";

test("exposes tikz-feynman as a built-in extension module", () => {
  assert.equal(tikzFeynmanExtension.name, "tikz-feynman");
  assert.ok(tikzFeynmanExtension.commands.includes("feynmandiagram"));
});

test("expands common tikz-feynman diagram syntax into nodes and propagators", () => {
  const source = String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage[compat=1.1.0]{tikz-feynman}
\begin{document}
\begin{tikzpicture}
\feynmandiagram [horizontal=a to b] {
  i1 [particle=\(e^{-}\)] -- [fermion] a -- [photon, edge label=\(\gamma\), momentum'=\(k\)] b -- [anti fermion] f1 [particle=\(\mu^{+}\)],
  i2 [particle=\(e^{+}\)] -- [anti fermion] a,
  b -- [gluon] g [particle=\(g\)],
  b -- [charged scalar, edge label'=\(\tilde q\)] s [particle=\(s\)];
};
\end{tikzpicture}
\end{document}`;

  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("e^{-}")));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("\\gamma")));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "feynman-fermion"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "feynman-boson"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "feynman-gluon"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "feynman-scalar"));
  assert.ok(result.ir.items.some((item) => item.type === "marker" && item.subtype === "feynman-momentum"));
});

test("expands feynman environment vertex commands and diagram star edges", () => {
  const source = String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-feynman}
\begin{document}
\begin{tikzpicture}
\begin{feynman}
  \vertex (a) at (0,0) {\(a\)};
  \vertex [dot] (b) at (2,0) {};
  \vertex (c) at (4,0) {\(c\)};
  \diagram* {
    (a) -- [majorana, momentum=\(p\)] (b) -- [ghost, edge label'=\(c\)] (c);
  };
\end{feynman}
\end{tikzpicture}
\end{document}`;

  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.type === "nodeBox" && item.subtype === "feynman-dot"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "feynman-majorana"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "feynman-ghost"));
});

test("keeps tikz-feynman photon lines wavy when momentum markings are present", () => {
  const result = tikzToSvg(String.raw`
\documentclass[tikz,border=10pt]{standalone}
\usepackage[compat=1.1.0]{tikz-feynman}
\begin{document}
\begin{tikzpicture}
\begin{feynman}
  \vertex [dot] (a) at (0,0) {};
  \vertex [dot] (b) at (2,0) {};
  \diagram* {
    (a) -- [photon, edge label=\(\gamma\), momentum'=\(k\)] (b);
  };
\end{feynman}
\end{tikzpicture}
\end{document}`);
  const photon = result.ir.items.find((item) => item.type === "path" && item.subtype === "feynman-boson");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(photon, "expected photon path");
  assert.ok(photon.commands.length > 8, `expected photon to keep snake decoration, got ${photon.commands.length} commands`);
  assert.ok(result.ir.items.some((item) => item.type === "marker" && item.subtype === "feynman-momentum"), "expected momentum marking on photon");
});
