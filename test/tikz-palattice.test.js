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

test("matches tikz-palattice case 118 unit semantics for markers, labels, valves, and legend", () => {
  const source = String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage[english]{babel}
\usepackage{tikz-palattice}
\begin{document}
\begin{lattice}
  \source{Gun}{0.4}
  \drift{0.167}
  \quadrupole{Q1}{0.4}
  \drift{0.1}
  \kicker{K1}{0.12}
  \drift{0.2}
  \screen{S1}
  \drift{0.2}
  \cavity{RF}{0.8}
  \drift{0.35}
  \dipole{B1}{0.65}{45}[r]
  \drift{0.25}
  \sextupole{SX}{0.25}
  \marker{BPM}[0.55]
  \rotate{45}
  \drift{0.5}[diagnostics]
  \savecoordinate{tap}[center]
  \goto{tap}
  \setangle{0}
  \valve{V1}
  \completelegend{(0,-1.4)}
\end{lattice}
\end{document}`;

  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);

  const sourceShape = result.ir.items.find((item) => item.subtype === "palattice-source");
  assert.ok(sourceShape);
  assert.equal(sourceShape.commands[0].y, 0.5);
  assert.equal(sourceShape.commands[2].y, -0.5);

  const gunLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "Gun");
  assert.ok(gunLabel);
  assert.ok(gunLabel.y < -0.7);

  const markerLine = result.ir.items.find((item) => item.subtype === "palattice-marker");
  const markerStart = markerLine.commands[0];
  const markerEnd = markerLine.commands[1];
  assert.ok(Math.hypot(markerEnd.x - markerStart.x, markerEnd.y - markerStart.y) > 1.09);

  const bpmLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "BPM");
  assert.ok(bpmLabel);
  assert.ok(bpmLabel.x < markerStart.x);
  assert.ok(bpmLabel.y > markerStart.y);

  const valve = result.ir.items.find((item) => item.subtype === "palattice-valve" && item.commands?.[0]?.y > 0);
  assert.ok(valve);
  assert.ok(Math.abs(valve.commands[1].x - valve.commands[0].x) < 0.03);

  assert.ok(result.ir.items.some((item) => item.subtype === "palattice-legend-frame"));
  const legendSource = result.ir.items.find((item) => item.subtype === "palattice-legend-source");
  assert.ok(legendSource);
  assert.equal(legendSource.commands.filter((command) => command.type === "lineTo").length, 2);
  assert.ok(result.ir.items.some((item) => item.subtype === "palattice-legend-screen" && item.shape === "circle"));
  assert.ok(result.ir.items.some((item) => item.subtype === "palattice-legend-valve"));
});
