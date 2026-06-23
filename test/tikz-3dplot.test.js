import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

test("projects tdplotdrawarc labels through the rotated theta plane", () => {
  const result = tikzToSvg(String.raw`
\documentclass[tikz]{standalone}
\usepackage{tikz-3dplot}
\begin{document}
\tdplotsetmaincoords{60}{110}
\pgfmathsetmacro{\thetavec}{30}
\pgfmathsetmacro{\phivec}{60}
\begin{tikzpicture}[scale=5,tdplot_main_coords]
  \coordinate (O) at (0,0,0);
  \tdplotsetthetaplanecoords{\phivec}
  \tdplotdrawarc[tdplot_rotated_coords]{(0,0,0)}{0.5}{0}{\thetavec}{anchor=south west}{$\theta$}
\end{tikzpicture}
\end{document}`);

  const theta = result.ir.items.find((item) => item.type === "textNode" && item.text === String.raw`$\theta$`);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(theta, "expected theta label");
  assert.ok(theta.x > 0.4 && theta.x < 0.9, `expected theta x near projected z/vector arc, got ${theta.x}`);
  assert.ok(theta.y > 1.5, `expected theta y to sit above the origin on the theta arc, got ${theta.y}`);
});
