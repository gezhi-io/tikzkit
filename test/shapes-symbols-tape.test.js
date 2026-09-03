import assert from "node:assert/strict";
import test from "node:test";
import { parseDimension } from "../src/engine/math.js";
import { tikzToSvg } from "../src/index.js";
import {
  tapeBorderPoint,
  tapeGeometry,
  tapeLayoutSize
} from "../src/tikz/libraries/shapes.symbols.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("tape layout applies bend height before PGF minimum-height sizing", () => {
  const natural = tapeLayoutSize(2, 0.8, { bendHeight: 0.5 });
  const minimum = tapeLayoutSize(2, 0.8, {
    bendHeight: 0.5,
    minimumHeight: 2
  });
  const oneBend = tapeLayoutSize(2, 0.8, {
    bendHeight: 0.5,
    bendTop: "none",
    minimumHeight: 2
  });

  close(natural.width, 2);
  close(natural.height, 0.8);
  close(tapeGeometry(natural, { bendHeight: 0.5 }).bounds.maxY, 0.9);
  close(tapeGeometry(natural, { bendHeight: 0.5 }).bounds.minY, -0.9);
  close(minimum.height, 1);
  close(tapeGeometry(minimum, { bendHeight: 0.5 }).bounds.maxY, 1);
  close(oneBend.height, 1.5);
});

test("tape geometry swaps the two elliptical half-wave bends", () => {
  const inward = tapeGeometry({ width: 2, height: 0.8 }, {
    bendHeight: 0.5,
    bendTop: "in and out",
    bendBottom: "none"
  });
  const outward = tapeGeometry({ width: 2, height: 0.8 }, {
    bendHeight: 0.5,
    bendTop: "out and in",
    bendBottom: "none"
  });

  assert.equal(inward.outlineCommands.filter((command) => command.type === "curveTo").length, 2);
  assert.equal(outward.outlineCommands.filter((command) => command.type === "curveTo").length, 2);
  assert.ok(inward.boundaryPoints.find((point) => Math.abs(point.x + 0.5) < 1e-6).y < inward.boundaryPoints.find((point) => Math.abs(point.x - 0.5) < 1e-6).y);
  assert.ok(outward.boundaryPoints.find((point) => Math.abs(point.x + 0.5) < 1e-6).y > outward.boundaryPoints.find((point) => Math.abs(point.x - 0.5) < 1e-6).y);
  close(inward.anchors.east.x, 1);
  close(inward.anchors.north.y, 0.65);
});

test("tape south anchors preserve the local PGF top-style branch behavior", () => {
  const geometry = tapeGeometry({ width: 2, height: 0.8 }, {
    bendHeight: 0.5,
    bendTop: "none",
    bendBottom: "in and out",
    outerXSep: 0.02,
    outerYSep: 0.02
  });

  close(geometry.bounds.minY, -0.9);
  close(geometry.anchors.south.y, -0.42);
  close(geometry.anchors["south east"].y, -0.42);
  close(geometry.anchors["south west"].y, -0.42);
});

test("TikZ tape nodes render bends, named anchors, and border clipping", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.symbols,positioning,arrows.meta}
\begin{tikzpicture}[node distance=8mm]
  \node[tape,draw,minimum width=22mm,minimum height=12mm,
    tape bend top=out and in,tape bend bottom=in and out,
    tape bend height=8pt] (log) {Log};
  \node[draw,right=of log] (next) {Next};
  \draw[->] (-2,0) -- (log);
  \draw[->] (log) -- (next);
  \draw (log.north) -- ++(0,4mm);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const log = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "log");
  const paths = result.ir.items.filter((item) => item.type === "path");
  const geometry = tapeGeometry(log, log.shapeData);
  const outerSep = parseDimension("0.2pt");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(log?.shape, "tape");
  assert.match(result.svg, /tikz-node-tape/);
  assert.ok(geometry.outlineCommands.some((command) => command.type === "curveTo"));
  assert.ok(paths.length >= 3);
  close(paths[0].commands.at(-1).x, log.x - log.width / 2 - outerSep, 0.04);
  close(paths[1].commands[0].x, log.x + log.width / 2 + outerSep, 0.04);
  close(paths[2].commands[0].y, log.y + geometry.anchors.north.y, 0.04);
  close(tapeBorderPoint(geometry, { x: 1, y: 0 }).x, log.width / 2 + outerSep, 0.04);
});
