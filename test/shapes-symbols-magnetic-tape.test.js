import assert from "node:assert/strict";
import test from "node:test";
import { parseDimension } from "../src/engine/math.js";
import { tikzToSvg } from "../src/index.js";
import {
  magneticTapeBorderPoint,
  magneticTapeGeometry,
  magneticTapeLayoutSize
} from "../src/tikz/libraries/shapes.symbols.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("magnetic tape layout uses PGF circular sqrt(2) content sizing", () => {
  const natural = magneticTapeLayoutSize(1, 0.5);
  const minimum = magneticTapeLayoutSize(1, 0.5, {
    minimumWidth: 1.8,
    minimumHeight: 1.3
  });

  close(natural.width, Math.SQRT2);
  close(natural.height, Math.SQRT2);
  close(minimum.width, 1.8);
  close(minimum.height, 1.8);
});

test("magnetic tape geometry clamps its tail and exposes PGF tail anchors", () => {
  const geometry = magneticTapeGeometry({ width: 1.3, height: 1.3 }, {
    magneticTapeTail: 1.4,
    magneticTapeTailExtend: 0.25,
    magneticTapeOuterSep: 0.01
  });

  close(geometry.radius, 0.65);
  close(geometry.tailHeight, 0.65);
  close(geometry.bounds.maxX, 0.9);
  close(geometry.anchors["tail east"].x, 0.91);
  close(geometry.anchors["tail east"].y, -0.325);
  close(geometry.anchors["tail south east"].y, -0.66);
  close(geometry.anchors["tail north east"].y, 0.01);
  close(magneticTapeBorderPoint(geometry, { x: 1, y: 0 }).x, 0.66);
});

test("TikZ magnetic tape nodes render curved tails and clip paths to their border", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.symbols,positioning,arrows.meta}
\begin{tikzpicture}[node distance=8mm]
  \node[magnetic tape,draw,minimum size=14mm,magnetic tape tail=.3,
    magnetic tape tail extend=3mm] (store) {Store};
  \node[draw,right=of store] (next) {Next};
  \draw[->] (-2,0) -- (store);
  \draw[->] (store) -- (next);
  \draw (store.tail east) -- ++(4mm,0);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const store = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "store");
  const paths = result.ir.items.filter((item) => item.type === "path");
  const geometry = magneticTapeGeometry(store, store.shapeData);
  const outerSep = parseDimension("0.2pt");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(store?.shape, "magneticTape");
  assert.match(result.svg, /tikz-node-magneticTape/);
  assert.ok(geometry.outlineCommands.some((command) => command.type === "curveTo"));
  assert.ok(geometry.bounds.maxX > geometry.radius);
  assert.ok(paths.length >= 3);
  close(paths[0].commands.at(-1).x, store.x - geometry.radius - outerSep, 0.04);
  close(paths[1].commands[0].x, store.x + geometry.radius + outerSep, 0.04);
  close(paths[2].commands[0].x, store.x + geometry.anchors["tail east"].x, 0.04);
});

test("magnetic tape radius follows a native TeX subscript-sequence box", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.symbols}
\begin{tikzpicture}
  \node[magnetic tape,draw,minimum size=17mm] (store) {$a_1,a_2,\ldots$};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const store = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "store");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(store.width >= 2.31 && store.width <= 2.34, `expected native-like magnetic tape diameter, got ${store.width}cm`);
  close(store.width, store.height);
});
