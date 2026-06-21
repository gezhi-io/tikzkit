import assert from "node:assert/strict";
import test from "node:test";
import { tikzPalatticeExtension, tikzToSvg } from "../src/index.js";

test("exposes tikz-palattice as a built-in extension module", () => {
  assert.equal(tikzPalatticeExtension.name, "tikz-palattice");
  assert.ok(tikzPalatticeExtension.commands.includes("lattice"));
});

test("expands common tikz-palattice lattice elements into ordinary TikZ drawings", () => {
  const source = String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-palattice}
\begin{document}
\begin{lattice}
  \source{Gun}{0.4}
  \drift{0.2}
  \quadrupole{Q1}{0.4}
  \drift{0.1}[gap]
  \kicker{K1}{0.12}
  \screen{S1}
  \cavity{RF}{0.8}
  \dipole{B1}{0.6}{45}[r]
  \marker{mark}[0.5]
  \rotate{45}
  \drift{0.4}
  \savecoordinate{tap}[center]
  \goto{tap}
  \setangle{0}
  \valve{V1}
  \completelegend{(0,-1.2)}
\end{lattice}
\end{document}`;

  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "palattice-drift"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "palattice-quadrupole"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "palattice-dipole"));
  assert.ok(result.ir.items.some((item) => item.type === "path" && item.subtype === "palattice-marker"));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("Q1")));
  assert.ok(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("Quadrupole")));
});
