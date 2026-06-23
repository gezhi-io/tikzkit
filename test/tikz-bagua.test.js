import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

test("expands classic taiji with a sampled curved boundary instead of a half disk", () => {
  const result = tikzToSvg(String.raw`
\documentclass[tikz]{standalone}
\usepackage{tikz-bagua}
\begin{document}
\begin{tikzpicture}
  \node at (0,0) {\taiji[2]};
\end{tikzpicture}
\end{document}`);

  const fill = result.ir.items.find((item) => item.subtype === "bagua-taiji-fill" && item.style?.fill === "black");
  const xs = (fill?.commands || []).map((command) => command.x).filter(Number.isFinite);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(fill, "expected a black taiji fill path");
  assert.ok(fill.commands.length > 60, `expected sampled classic taiji boundary, got ${fill.commands.length} commands`);
  assert.ok(Math.min(...xs) < -0.05, "expected classic taiji boundary to enter the left half");
  assert.ok(Math.max(...xs) > 0.05, "expected classic taiji boundary to enter the right half");
});

test("expands modern xtaiji with the native left-hand first lobe", () => {
  const result = tikzToSvg(String.raw`
\documentclass[tikz]{standalone}
\usepackage{tikz-bagua}
\begin{document}
\begin{tikzpicture}
  \node at (0,0) {\xtaiji[2]};
\end{tikzpicture}
\end{document}`);

  const fill = result.ir.items.find((item) => item.subtype === "bagua-taiji-fill" && item.style?.fill === "black");
  const firstLobeXs = (fill?.commands || []).slice(0, 20).map((command) => command.x).filter(Number.isFinite);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(fill, "expected a black xtaiji fill path");
  assert.ok(Math.min(...firstLobeXs) < -0.1, "expected native xtaiji first lobe to enter the left half");
});
