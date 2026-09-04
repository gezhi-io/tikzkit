import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { starGeometry } from "../src/tikz/libraries/shapes.geometric.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

function circleCenter(item) {
  const move = item?.commands?.find((command) => command.type === "moveTo");
  const curve = item?.commands?.find((command) => command.type === "curveTo");
  return move && curve ? { x: (move.x + curve.x) / 2, y: move.y } : null;
}

test("star geometry applies PGF half-angle miter radii", () => {
  const outerRadius = 50;
  const innerRadius = 25;
  const outerSep = 4;
  const count = 5;
  const geometry = starGeometry({ width: outerRadius * 2, height: outerRadius * 2 }, {
    starPoints: count,
    starPointRatio: 2,
    starUsesPointRatio: true,
    starOuterSep: outerSep
  });
  const angle = Math.PI / count;
  const outerSide = Math.hypot(outerRadius - innerRadius * Math.cos(angle), innerRadius * Math.sin(angle));
  const innerSide = Math.hypot(outerRadius * Math.cos(angle) - innerRadius, outerRadius * Math.sin(angle));

  close(geometry.anchorOuterRadius, outerRadius + outerSep * outerSide / (innerRadius * Math.sin(angle)));
  close(geometry.anchorInnerRadius, innerRadius + outerSep * innerSide / (outerRadius * Math.sin(angle)));
});

test("star named point anchors include PGF mitered outer separation", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.geometric}
\begin{tikzpicture}
  \node[star,star points=5,star point ratio=2,star rotate=18,
    minimum size=30mm,outer sep=2mm,draw] (s) {};
  \fill[red] (s.outer point 1) circle (1pt);
  \fill[blue] (s.inner point 1) circle (1pt);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const star = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "s");
  const markers = result.ir.items.filter((item) => item.type === "path" && item.commands?.some((command) => command.type === "curveTo"));
  const outer = circleCenter(markers[0]);
  const inner = circleCenter(markers[1]);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(star.shape, "star");
  assert.ok(outer && inner);
  assert.ok(Math.hypot(outer.x - star.x, outer.y - star.y) > star.width / 2);
  assert.ok(Math.hypot(inner.x - star.x, inner.y - star.y) > star.width / 4);
});

test("star compass anchors and automatic edges use the expanded concave border", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{arrows.meta,shapes.geometric}
\begin{tikzpicture}[>=Latex]
  \node[star,star points=6,star point ratio=1.8,minimum size=28mm,
    outer sep=2mm,draw] (s) {};
  \draw[->] (-3,0) -- (s);
  \draw[->] (s) -- (3,0);
  \fill (s.west) circle (1pt);
  \fill (s.east) circle (1pt);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const star = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "s");
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);
  const markers = result.ir.items.filter((item) => item.type === "path" && !item.style?.markerEnd && item.commands?.some((command) => command.type === "curveTo"));
  const west = circleCenter(markers[0]);
  const east = circleCenter(markers[1]);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(arrows.length, 2);
  assert.ok(west && east);
  close(arrows[0].commands.at(-1).x, west.x, 0.02);
  close(arrows[1].commands[0].x, east.x, 0.02);
  close(west.y, star.y, 0.02);
  close(east.y, star.y, 0.02);
});
