import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

test("lays out groupplots from plot boxes and publishes named group anchors", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\documentclass{standalone}
\usepackage{pgfplots}
\usepgfplotslibrary{groupplots}
\begin{document}
\begin{tikzpicture}
\begin{groupplot}[
  group style={
    group name=measurements,
    group size=2 by 2,
    x descriptions at=edge bottom,
    y descriptions at=edge left,
    horizontal sep=0.5cm,
    vertical sep=0.5cm
  },
  width=4cm,
  height=3.5cm,
  xmin=0,xmax=2,
  ymin=0,ymax=2,
  xlabel={time},
  ylabel={concentration}
]
  \nextgroupplot \addplot coordinates {(0,0) (2,2)};
  \nextgroupplot \addplot coordinates {(0,2) (2,0)};
  \nextgroupplot \addplot coordinates {(0,1) (2,1)};
  \nextgroupplot \addplot coordinates {(0,0) (2,2)};
\end{groupplot}
\draw[color=magenta,line width=7pt] (measurements c1r1.east) -- (measurements c2r1.west);
\draw[color=cyan,line width=7pt] (measurements c1r1.south) -- (measurements c1r2.north);
\end{tikzpicture}
\end{document}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const labels = ir.items.filter((item) => item.type === "textNode");
  assert.equal(labels.filter((item) => item.text === "time").length, 2);
  assert.equal(labels.filter((item) => item.text === "concentration").length, 2);

  const guides = ir.items.filter((item) => item.type === "path" && item.style?.lineWidth > 20);
  assert.equal(guides.length, 2, "expected guides resolved from named groupplot anchors");
  const anchorGuide = guides.find((item) => Math.abs(item.commands[1].x - item.commands[0].x) > Math.abs(item.commands[1].y - item.commands[0].y));
  assert.ok(anchorGuide, "expected a horizontal named-anchor guide");
  const [start, end] = anchorGuide.commands;
  assert.equal(start.type, "moveTo");
  assert.equal(end.type, "lineTo");
  assert.ok(Math.abs(end.x - start.x - 0.5) < 1e-9, "groupplot anchor gap must equal horizontal sep");
  assert.ok(Math.abs(end.y - start.y) < 1e-9, "adjacent groupplot anchor midpoints must share y");

  const verticalGuide = guides.find((item) => item !== anchorGuide);
  const [top, bottom] = verticalGuide.commands;
  assert.ok(Math.abs(bottom.x - top.x) < 1e-9, "stacked groupplot anchors must share x");
  assert.ok(Math.abs(Math.abs(bottom.y - top.y) - 0.5) < 1e-9, "groupplot anchor gap must equal vertical sep");
});

test("keeps groupplot empty cells addressable without rendering their axis", () => {
  const { diagnostics, ir } = tikzToSvg(String.raw`
\usepackage{pgfplots}
\usepgfplotslibrary{groupplots}
\begin{tikzpicture}
\begin{groupplot}[
  group style={
    group name=slots,
    group size=2 by 1,
    horizontal sep=0.4cm,
    every plot/.style={title={base}},
    plot c2r1/.style={title={second}}
  },
  width=3cm,height=2cm
]
  \nextgroupplot[group/empty plot]
  \nextgroupplot \addplot coordinates {(0,0) (1,1)};
\end{groupplot}
\draw[line width=6pt] (slots c1r1.center) -- (slots c2r1.center);
\end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const guide = ir.items.find((item) => item.type === "path" && item.style?.lineWidth > 20);
  assert.ok(guide, "empty group cells must retain their named center anchor");
  assert.equal(ir.items.filter((item) => item.type === "textNode" && item.text === "0").length, 2);
  assert.equal(ir.items.filter((item) => item.type === "textNode" && item.text === "second").length, 1);
});

test("moves top/right groupplot descriptions and tick labels onto their retained outer edges", () => {
  const source = readFileSync("test/fixtures/examples/pgfplots/groupplots-edge-descriptions-top-right.tex", "utf8");
  const { diagnostics, ir } = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  const frames = ir.items
    .filter((item) => item.type === "path" && item.subtype === "axis-frame" && item.style?.stroke === "black")
    .map((item) => item.commands);
  assert.ok(frames.length >= 4, "expected four groupplot frames");
  const topFrame = frames[0];
  const rightFrame = frames[2];
  const topY = topFrame[2].y;
  const rightX = rightFrame[1].x;
  const texts = ir.items.filter((item) => item.type === "textNode" && item.text);

  assert.equal(texts.filter((item) => item.text === "time $t$ / h").length, 2);
  assert.equal(texts.filter((item) => item.text === "$c$ / mol/L").length, 2);
  assert.ok(
    texts.filter((item) => ["0", "0.5", "1", "1.5", "2"].includes(item.text) && item.y > topY).length >= 5,
    "top x tick labels must be above the top-row frames"
  );
  assert.ok(
    texts.filter((item) => ["0", "0.5", "1", "1.5", "2"].includes(item.text) && item.x > rightX).length >= 5,
    "right y tick labels must be right of the retained outer frames"
  );
});
