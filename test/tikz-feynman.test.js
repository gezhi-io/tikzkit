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

test("expands grouped incoming vertices in tikz-feynman diagrams", () => {
  const result = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{tikz-feynman}
\begin{document}
\begin{tikzpicture}
\feynmandiagram [inline=(a.base)] {
  {i1, i2} -- a [dot]
  -- [charged boson, half left, edge label=$q$] b [crossed dot]
  -- [charged boson, half left, edge label=$q$] a,
};
\end{tikzpicture}
\end{document}`);

  const bosons = result.ir.items.filter((item) => item.type === "path" && item.subtype === "feynman-boson");
  const plainEdges = result.ir.items.filter((item) => item.type === "path" && item.subtype === "feynman-plain");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(bosons.length >= 2, `expected grouped loop to preserve charged boson edges, got ${bosons.length}`);
  assert.ok(bosons.some((item) => item.commands.some((command) => command.type === "curveTo")), "expected half left propagators to render as curved paths");
  assert.ok(plainEdges.length >= 2, `expected grouped incoming legs, got ${plainEdges.length}`);
});

test("renders inline tikz-feynman equation documents used by real case 206", () => {
  const result = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{tikz-feynman}
\begin{document}
$\displaystyle\partial_t \frac{\partial^2 V}{\partial^2 \chi}
  = \raisebox{0.5ex}{\feynmandiagram [inline=(a.base)] {
  a [dot] -- [charged boson, quarter left, edge label=$q$] b
  -- [photon, quarter left] c [dot]
  -- [charged boson, quarter left, edge label=$q$] d [crossed dot]
  -- [charged boson, quarter left, edge label=$q$] a,
  f1 -- c,
  i1 -- a,
  };}
  \enskip+\enskip
  \raisebox{0.5ex}{\feynmandiagram [inline=(a.base)] {
  {i1, i2} -- a [dot]
  -- [charged boson, half left, edge label=$q$] b [crossed dot]
  -- [charged boson, half left, edge label=$q$] a,
  };}$
\end{document}`, { mathRenderer: "svg-text" });

  const textNodes = result.ir.items.filter((item) => item.type === "textNode");
  const bosons = result.ir.items.filter((item) => item.type === "path" && item.subtype === "feynman-boson");
  const dots = result.ir.items.filter((item) => item.type === "nodeBox" && item.subtype === "feynman-dot");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(textNodes.some((item) => item.text.includes("\\partial_t")), "expected equation prefix");
  assert.doesNotMatch(result.svg, /displaystylepartial/);
  assert.doesNotMatch(result.svg, />[^<]*frac/);
  assert.match(result.svg, /\u2202/);
  assert.match(result.svg, /tikz-inline-fraction/);
  assert.ok(textNodes.some((item) => item.text === "$+$"), "expected plus sign between diagrams");
  assert.ok(bosons.length >= 6, `expected both feynman loops, got ${bosons.length} boson paths`);
  assert.ok(bosons.filter((item) => item.commands.some((command) => command.type === "curveTo")).length >= 4, "expected quarter/half left loop propagators to be curved");
  assert.ok(dots.length >= 3, `expected feynman dot vertices, got ${dots.length}`);
});
