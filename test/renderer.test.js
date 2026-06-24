import assert from "node:assert/strict";
import test from "node:test";
import { renderSvg, tikzToSvg } from "../src/index.js";
import { mathFallbackText, normalizeTikzText } from "../src/tex-text.js";
import { createArrowTip, lineWidthFromPt } from "../src/tikz-metrics.js";

function formatted(value) {
  const rounded = Math.round((value + Number.EPSILON) * 1e6) / 1e6;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

test("renders stable svg for paths, text nodes, circles, and markers", () => {
  const svg = renderSvg({
    items: [
      {
        type: "path",
        style: { stroke: "black", fill: "none", lineWidth: 1 },
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 1, y: 1 }
        ]
      },
      {
        type: "path",
        shape: "circle",
        style: { stroke: "none", fill: "blue", lineWidth: 1 },
        cx: 1,
        cy: 0,
        r: 0.25,
        commands: []
      },
      { type: "textNode", x: 0.5, y: 0.5, text: "Hi", style: { fill: "black" } },
      { type: "marker", kind: "arrow", x: 0.5, y: 0.5, angle: 45, style: { stroke: "black", fill: "black" } }
    ],
    coordinates: {}
  });

  assert.match(svg, /viewBox="-10 -110 145 145"/);
  assert.match(svg, /<path d="M 0 0 L 100 -100"/);
  assert.match(svg, /<circle cx="100" cy="0" r="25"/);
  assert.match(svg, /<text x="50" y="-50"/);
  assert.match(svg, /font-family="KaTeX_Main, 'Times New Roman', Times, serif"/);
  assert.match(svg, /M -6 -5 L 6 0 L -6 5 z/);
  assert.match(svg, /transform="translate\(50 -50\) rotate\(-45\)"/);
});

test("renders TikZ green as xcolor pure green instead of CSS named green", () => {
  const svg = renderSvg({
    items: [
      {
        type: "path",
        style: { stroke: "green", fill: "green", lineWidth: 1 },
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 1, y: 0 }
        ]
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /stroke="rgb\(0 255 0\)"/);
  assert.match(svg, /fill="rgb\(0 255 0\)"/);
});

test("renders TikZ even odd fill rule for compound paths", () => {
  const { svg, diagnostics } = tikzToSvg(String.raw`
\begin{tikzpicture}
  \fill[even odd rule,red!30] circle (2) circle (1);
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.match(svg, /fill-rule="evenodd"/);
});

test("renders path ball shading as SVG radial gradients", () => {
  const svg = renderSvg({
    items: [
      {
        type: "path",
        shape: "circle",
        cx: 0,
        cy: 0,
        r: 1,
        style: { stroke: "black", fill: "yellow", lineWidth: 1, shading: "ball", ballColor: "yellow" },
        commands: []
      },
      {
        type: "path",
        shape: "ellipse",
        cx: 2,
        cy: 0,
        rx: 0.2,
        ry: 0.4,
        style: { stroke: "black", fill: "black", lineWidth: 1, shading: "ball", ballColor: "black" },
        commands: []
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /<radialGradient[^>]+id="tikz-ball-/);
  assert.match(svg, /stop-color="white"/);
  assert.match(svg, /stop-color="yellow"/);
  assert.match(svg, /<circle[^>]+fill="url\(#tikz-ball-/);
  assert.match(svg, /<ellipse[^>]+fill="url\(#tikz-ball-/);
});

test("renders top and bottom color path shading as SVG linear gradients", () => {
  const direct = renderSvg({
    items: [
      {
        type: "path",
        style: { stroke: "black", fill: "blue", lineWidth: 1, shading: "axis", topColor: "white", bottomColor: "blue" },
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 1, y: 0 },
          { type: "lineTo", x: 1, y: -1 },
          { type: "lineTo", x: 0, y: -1 },
          { type: "closePath" }
        ]
      }
    ],
    coordinates: {}
  });

  assert.match(direct, /<linearGradient[^>]+id="tikz-axis-/);
  assert.match(direct, /stop-color="white"/);
  assert.match(direct, /stop-color="blue"/);
  assert.match(direct, /fill="url\(#tikz-axis-/);

  const interpreted = tikzToSvg(String.raw`\begin{tikzpicture}
    \draw[draw=black,top color=white,bottom color=blue] (0,0) rectangle (1,1);
  \end{tikzpicture}`);
  assert.equal(interpreted.diagnostics.length, 0);
  assert.match(interpreted.svg, /<linearGradient[^>]+id="tikz-axis-/);
  assert.match(interpreted.svg, /fill="url\(#tikz-axis-/);
});

test("renders standalone decoration markers around their own origin after translation", () => {
  const svg = renderSvg({
    items: [
      {
        type: "marker",
        x: 1,
        y: 1,
        angle: 45,
        style: { fill: "black" }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /transform="translate\(100 -100\) rotate\(-45\)"/);
  assert.doesNotMatch(svg, /rotate\(-45 100 -100\)/);
});

test("renders default TikZ to arrow tip close to native PGF size", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[->] (0,0) -- (1,0);
\end{tikzpicture}`);
  const arrowPath = result.svg.match(/class="tikz-arrow-tip tikz-arrow-to" d="M (-?[0-9.]+) ([0-9.]+)/);

  assert.ok(arrowPath, "expected inline to arrow path");
  const back = Math.abs(Number(arrowPath[1]));
  const halfWidth = Number(arrowPath[2]);
  assert.ok(Math.abs(back - lineWidthFromPt(1.196)) < 0.2, `expected native default to arrow back near 1.196pt, got ${back}`);
  assert.ok(Math.abs(halfWidth - lineWidthFromPt(1.594)) < 0.25, `expected native default to arrow half width near 1.594pt, got ${halfWidth}`);
});

test("renders TikZ north east line patterns as SVG pattern fills", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[circle,draw=red,pattern=north east lines,pattern color=red] at (0,0) {};
\end{tikzpicture}`);
  const box = result.ir.items.find((item) => item.type === "nodeBox");

  assert.equal(box.style.pattern, "north east lines");
  assert.equal(box.style.patternColor, "red");
  assert.match(result.svg, /<defs><pattern[^>]+id="tikz-pattern-/);
  assert.match(result.svg, /<path d="M -4 8 L 8 -4 M 0 12 L 12 0"/);
  assert.match(result.svg, /fill="url\(#tikz-pattern-/);
});

test("normalizes nested rotated TikZ node snippets as boxed image content", () => {
  const graphic = normalizeTikzText(String.raw`
\begin{tikzpicture}
  \node[rectangle, draw, rotate=90, minimum height=0.5cm, minimum width=1.5cm] (out) {softmax};
\end{tikzpicture}`);

  assert.equal(graphic.kind, "image");
  assert.equal(graphic.plot, "boxed-text");
  assert.equal(graphic.label, "softmax");
  assert.equal(graphic.width, 0.5);
  assert.equal(graphic.height, 1.5);
  assert.equal(graphic.rotate, 90);
});

test("renders nested rotated TikZ node snippets as vertical boxed labels", () => {
  const svg = renderSvg({
    items: [
      {
        type: "textNode",
        x: 0,
        y: 0,
        text: String.raw`\begin{tikzpicture}\node[rectangle, draw, rotate=90, minimum height=0.5cm, minimum width=1.5cm] (out) {softmax};\end{tikzpicture}`,
        style: { fill: "black" }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /tikz-boxed-text/);
  assert.match(svg, /rotate\(-90 0 0\)/);
  assert.match(svg, />softmax</);
});

test("uses tight cubic Bezier extrema when bbox library mode is enabled", () => {
  const loose = renderSvg({
    items: [
      {
        type: "path",
        style: { stroke: "black", fill: "none", lineWidth: 1 },
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "curveTo", x1: -1, y1: 1, x2: 1, y2: 2, x: 2, y: 0 }
        ]
      }
    ]
  });
  const tight = renderSvg({
    items: [
      {
        type: "path",
        tightBezierBounds: true,
        style: { stroke: "black", fill: "none", lineWidth: 1 },
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "curveTo", x1: -1, y1: 1, x2: 1, y2: 2, x: 2, y: 0 }
        ]
      }
    ]
  });

  const looseViewBox = loose.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
  const tightViewBox = tight.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);

  assert.ok(looseViewBox[3] > 200, `expected loose bounds to include control points, got ${looseViewBox}`);
  assert.ok(tightViewBox[3] < 150, `expected tight bounds to use curve extrema, got ${tightViewBox}`);
  assert.ok(tightViewBox[2] < looseViewBox[2], `expected tight width to shrink, got ${tightViewBox} vs ${looseViewBox}`);
});

test("supports PGF bbox library bezier bounding box option from TikZ source", () => {
  const source = String.raw`
\usepgflibrary{bbox}
\begin{tikzpicture}[bezier bounding box]
  \draw (0,0) .. controls (-1,1) and (1,2) .. (2,0);
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const path = result.ir.items.find((item) => item.type === "path");
  const viewBox = result.svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.tightBezierBounds, true);
  assert.ok(viewBox[3] < 150, `expected bbox library mode to tighten Bezier viewBox, got ${viewBox}`);
});

test("resolves current bounding box anchors after tight Bezier paths", () => {
  const source = String.raw`
\usepgflibrary{bbox}
\begin{tikzpicture}[bezier bounding box]
  \draw (0,0) .. controls (-1,1) and (1,2) .. (2,0);
  \draw (current bounding box.south west) rectangle (current bounding box.north east);
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const rectangle = result.ir.items.filter((item) => item.type === "path").at(-1);
  const ys = rectangle.commands.filter((command) => "y" in command).map((command) => command.y);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.max(...ys) < 1.3, `expected current bounding box to use tight Bezier max y, got ${ys}`);
  assert.ok(Math.min(...ys) === 0, `expected current bounding box lower edge at curve endpoint y, got ${ys}`);
});

test("renders TikZ arrow tips as inline paths and shortens stroked path endpoints", () => {
  const svg = renderSvg({
    items: [
      {
        type: "path",
        style: { stroke: "black", fill: "none", lineWidth: 1.4, markerEnd: { kind: "to" } },
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 1, y: 0 }
        ]
      },
      {
        type: "path",
        style: { stroke: "blue", fill: "none", lineWidth: 2.8, markerStart: { kind: "stealth" } },
        commands: [
          { type: "moveTo", x: 0, y: 1 },
          { type: "lineTo", x: 1, y: 1 }
        ]
      },
      {
        type: "path",
        style: {
          stroke: "red",
          fill: "none",
          lineWidth: 4.2,
          markerEnd: { kind: "stealth", stroke: "orange", fill: "red", width: 28, length: 35 }
        },
        commands: [
          { type: "moveTo", x: 0, y: 2 },
          { type: "lineTo", x: 1, y: 2 }
        ]
      },
      {
        type: "path",
        style: { stroke: "black", fill: "none", lineWidth: 1.4, markerEnd: { kind: "latex" } },
        commands: [
          { type: "moveTo", x: 0, y: 3 },
          { type: "lineTo", x: 1, y: 3 }
        ]
      }
    ],
    coordinates: {}
  });

  assert.doesNotMatch(svg, /<marker\b/);
  assert.doesNotMatch(svg, /marker-end=/);
  assert.match(svg, /class="tikz-arrowed-path"/);
  assert.match(svg, /<path d="M 0 0 L 98\.6 0"/);
  assert.match(svg, /<path class="tikz-arrow-tip tikz-arrow-to"[^>]+C [^>]+transform="translate\(100 0\) rotate\(0\)"/);
  assert.match(svg, /<path d="M 8\.777371 -100 L 100 -100"/);
  assert.match(svg, /<path class="tikz-arrow-tip tikz-arrow-stealth"[^>]+transform="translate\(0 -100\) rotate\(180\)"/);
  assert.match(svg, /<path class="tikz-arrow-tip tikz-arrow-latex"/);
  assert.match(svg, /stroke="orange"/);
  assert.match(svg, /fill="red"/);
});

test("scales default to arrow tips from IR with the current line width", () => {
  const lineWidth = lineWidthFromPt(1.2);
  const svg = renderSvg({
    items: [
      {
        type: "path",
        style: { stroke: "black", fill: "none", lineWidth, markerEnd: createArrowTip("to") },
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 3, y: 0 }
        ]
      }
    ],
    coordinates: {}
  });
  const tipPath = svg.match(/<path class="tikz-arrow-tip tikz-arrow-to"[^>]+d="([^"]+)"/)?.[1];
  assert.ok(tipPath, "expected inline to arrow path");
  const start = tipPath.match(/^M (-?[\d.]+) ([\d.]+)/);
  assert.ok(start, `expected movable to arrow path, got ${tipPath}`);

  assert.ok(Math.abs(Number(start[1]) + lineWidthFromPt(3.027441)) < 0.01, `expected TikZ-like arrow back, got ${start[1]}`);
  assert.ok(Math.abs(Number(start[2]) - lineWidthFromPt(3.831243)) < 0.01, `expected TikZ-like arrow height, got ${start[2]}`);
});

test("uses TikZ butt caps on dashed arrow stems while keeping arrow tips rounded", () => {
  const svg = renderSvg({
    items: [
      {
        type: "path",
        style: {
          stroke: "black",
          fill: "none",
          lineWidth: lineWidthFromPt(1.2),
          dashArray: [lineWidthFromPt(1.2), lineWidthFromPt(2)],
          markerEnd: createArrowTip("to")
        },
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 3, y: 0 }
        ]
      }
    ],
    coordinates: {}
  });
  const stemPath = svg.match(/<g class="tikz-arrowed-path">(<path[^>]+>)/)?.[1];
  const tipPath = svg.match(/(<path class="tikz-arrow-tip tikz-arrow-to"[^>]+>)/)?.[1];

  assert.ok(stemPath, "expected arrow stem path");
  assert.ok(tipPath, "expected arrow tip path");
  assert.match(stemPath, /stroke-linecap="butt"/);
  assert.match(stemPath, /stroke-linejoin="miter"/);
  assert.match(tipPath, /stroke-linecap="round"/);
  assert.match(tipPath, /stroke-linejoin="round"/);
});

test("uses PGF butt caps for dashed, dotted, and double dashed paths", () => {
  const dashed = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[double, dashed, ultra thick, gray] (0,0) -- (2,0);
\end{tikzpicture}`);
  const dotted = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[dotted, thick] (0,0) -- (2,0);
\end{tikzpicture}`);

  assert.match(dashed.svg, /class="tikz-double-outer"[^>]+stroke-linecap="butt"/);
  assert.match(dashed.svg, /class="tikz-double-inner"[^>]+stroke-linecap="butt"/);
  assert.match(dotted.svg, /stroke-linecap="butt"/);
});

test("uses PGF butt caps and miter joins for solid paths unless line cap is explicit", () => {
  const defaultPath = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw (0,0) -- (1,0);
\end{tikzpicture}`);
  const roundPath = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[line cap=round,line join=round] (0,0) -- (1,0);
\end{tikzpicture}`);

  assert.match(defaultPath.svg, /stroke-linecap="butt"/);
  assert.match(defaultPath.svg, /stroke-linejoin="miter"/);
  assert.match(roundPath.svg, /stroke-linecap="round"/);
  assert.match(roundPath.svg, /stroke-linejoin="round"/);
});

test("shortens curved arrow stems along the terminal tangent", () => {
  const svg = renderSvg({
    items: [
      {
        type: "path",
        style: { stroke: "black", fill: "none", lineWidth: lineWidthFromPt(0.4), markerEnd: createArrowTip("latex") },
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "curveTo", x1: 0.783, y1: 0, x2: 1.217, y2: 0, x: 2, y: 0 }
        ]
      }
    ],
    coordinates: {}
  });
  const stem = svg.match(/<g class="tikz-arrowed-path">(<path[^>]+>)/)?.[1] || "";
  const endX = Number(stem.match(/ C [^"]+ ([\d.]+) 0"/)?.[1]);

  assert.ok(Number.isFinite(endX), `expected shortened cubic stem, got ${stem}`);
  assert.ok(endX < 200, `expected curved stem to stop behind arrow tip, got ${endX}`);
  assert.ok(endX > 180, `expected curved stem to remain near target, got ${endX}`);
  assert.match(svg, /transform="translate\(200 0\) rotate\(0\)"/);
});

test("renders a white page background by default for native TikZ raster comparisons", () => {
  const ir = {
    items: [
      {
        type: "path",
        style: { stroke: "black", fill: "none", lineWidth: 1 },
        commands: [
          { type: "moveTo", x: 0, y: 0 },
          { type: "lineTo", x: 1, y: 0 }
        ]
      }
    ],
    coordinates: {}
  };

  assert.match(renderSvg(ir), /class="tikz-background"[^>]+fill="white"/);
  assert.doesNotMatch(renderSvg(ir, { background: "none" }), /class="tikz-background"/);
});

test("renders math text nodes through KaTeX inside SVG foreignObject", () => {
  const svg = renderSvg({
    items: [{ type: "textNode", x: 0, y: 0, text: "$x^2 + y^2$", style: { fill: "blue" } }],
    coordinates: {}
  });

  assert.match(svg, /<foreignObject /);
  assert.match(svg, /class="tikz-math/);
  assert.match(svg, /class="katex"/);
  assert.doesNotMatch(svg, /requiredExtensions=/);
  assert.doesNotMatch(svg, /<text[^>]*>\$x\^2 \+ y\^2\$<\/text>/);
});

test("renders contour-wrapped math labels as plain math content", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node at (0,0) {\contour{white}{$a+\sqrt{b/A}$}};
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /class="katex"/);
  assert.doesNotMatch(result.svg, /contour/);
});

test("keeps contour outlines on SVG text math fallbacks", () => {
  const svg = renderSvg(
    {
      items: [
        {
          type: "textNode",
          x: 0,
          y: 0,
          text: String.raw`\contour{white}{$a+\sqrt{b/A}$}`,
          style: { fill: "rgb(166 0 0)" }
        }
      ],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /stroke="white"/);
  assert.match(svg, /stroke-width="1\.4"/);
  assert.match(svg, /paint-order="stroke fill"/);
  assert.match(svg, /√\(b\/A\)/);
  assert.doesNotMatch(svg, /contour/);
});

test("keeps square root symbols readable in SVG math text fallback", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$a-\sqrt{b/A}$`, style: { fill: "red" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /√\(b\/A\)/);
  assert.doesNotMatch(svg, /sqrtb\/A/);
});

test("normalizes common TeX text macros before SVG text rendering", () => {
  const svg = renderSvg({
    items: [
      { type: "textNode", x: 0, y: 0, text: String.raw`\scalebox{.5}{$\times 1$}`, style: { fill: "blue" } },
      { type: "textNode", x: 1, y: 0, text: String.raw`\textcolor{red}{A}\\\emph{B}`, style: { fill: "black" } },
      { type: "textNode", x: 2, y: 0, text: String.raw`\includegraphics[width=2cm]{router.pdf}`, style: { fill: "black" } }
    ],
    coordinates: {}
  });

  assert.match(svg, /class="katex"/);
  assert.match(svg, /tikz-image-placeholder/);
  assert.match(svg, />router</);
  assert.doesNotMatch(svg, /\\scalebox|\\textcolor|\\includegraphics/);
});

test("keeps TeX phantom text invisible while preserving node box metrics", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[rectangle,draw,inner sep=0pt] (ghost) {\phantom{\sffamily\Large node n}};
  \node[rectangle,draw,inner sep=0pt] (visible) at (4,0) {\sffamily\Large node n};
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  const boxes = Object.fromEntries(result.ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));
  assert.ok(Math.abs(boxes.ghost.width - boxes.visible.width) < 0.05, `expected phantom width to match content, got ${boxes.ghost.width} vs ${boxes.visible.width}`);
  assert.doesNotMatch(result.svg, /phantom|sffamily|Large/);
  assert.equal((result.svg.match(/node n/g) || []).length, 1);
});

test("preserves TeX hspace as visible SVG text spacing", () => {
  const svg = renderSvg({
    items: [{ type: "textNode", x: 0, y: 0, text: String.raw`\Huge diamond\hspace{2.6cm}node`, style: { fill: "black" } }],
    coordinates: {}
  });

  assert.match(svg, /xml:space="preserve"/);
  assert.match(svg, /diamond(?: |\u00a0){6,}node/);
});

test("renders inline TikZ draw snippets as image placeholders instead of source text", () => {
  const svg = renderSvg({
    items: [
      {
        type: "textNode",
        x: 0,
        y: 0,
        text: String.raw`\tikz \draw[x=1.5ex, y=1ex, thick] (0, 0) sin (0.5, 0.5) cos (1, 0);\\ $\cos(2\pi f t)$`,
        style: { fill: "black" }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /tikz-image-placeholder|tikz-axis-placeholder/);
  assert.doesNotMatch(svg, /\\tikz|\\draw|sin \(0\.5/);
});

test("sizes inline TikZ draw snippets from TeX x/y units", () => {
  const graphic = normalizeTikzText(String.raw`\tikz \draw[x=3.5ex, y=1ex, thick] (0, 0) sin (0.5, 0.5) cos (1, 0) sin (1.5, -0.5) cos (2, 0) (0.6, -0.5) -- (1.4, 0.5);\\ \tikz \draw[x=3.5ex, y=1ex, thick] (0, 0) sin (0.5, 0.5) cos (1, 0) sin (1.5, -0.5) cos (2, 0);`);

  assert.equal(graphic.kind, "image");
  assert.equal(graphic.plot, "polyline");
  assert.ok(graphic.polylines.length >= 3, `expected wave and cutoff polylines, got ${graphic.polylines.length}`);
  assert.ok(graphic.width > 1.0 && graphic.width < 1.2, `expected width from 7ex, got ${graphic.width}`);
  assert.ok(graphic.height > 0.35 && graphic.height < 0.5, `expected stacked inline height, got ${graphic.height}`);
});

test("renders nested pgfplots sine snippets as FM wave placeholders", () => {
  const svg = renderSvg({
    items: [
      {
        type: "textNode",
        x: 0,
        y: 0,
        text: String.raw`\begin{tikzpicture}\begin{axis}\addplot expression {2*sin(2*pi*3*x - 8*cos(2*pi*0.25*x))};\end{axis}\end{tikzpicture}\\ $FM(t)$`,
        style: { fill: "black" }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /tikz-fm-wave/);
  assert.match(svg, />FM\(t\)</);
  assert.doesNotMatch(svg, /<rect[^>]+tikz-axis-placeholder/);
});

test("normalizes Case 065 nested PGFPlots activation axes as compact polylines", () => {
  const graphic = normalizeTikzText(String.raw`\begin{tikzpicture}\begin{axis}[
    samples=1000, domain=-2.6:2.6,
    hide axis,
    xtick=\empty,
    ytick=\empty,
    xlabel=\empty,
    ylabel=\empty,
    xmin=-2.1, xmax=2.1,
    ymin=-0.1, ymax=1.1,
    x=0.5em, y=0.5em,
    trig format = rad
  ]
    \addplot expression [no markers, smooth, thick, black] {max(0, min(1, x*0.6 + 0.5))};
  \end{axis}\end{tikzpicture}`);

  assert.equal(graphic.kind, "image");
  assert.equal(graphic.plot, "polyline");
  assert.ok(graphic.width > 0.8 && graphic.width < 0.9, `expected compact axis width, got ${graphic.width}`);
  assert.ok(graphic.height > 0.3 && graphic.height < 0.38, `expected compact axis height, got ${graphic.height}`);
  assert.ok(graphic.polylines[0].length >= 24, `expected sampled activation curve, got ${graphic.polylines[0].length}`);
  const ys = graphic.polylines[0].map((point) => point.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.45, "expected activation curve to vary vertically");
});

test("renders nested pgfplots gaussian placeholders with injected comparison grids", () => {
  const svg = renderSvg({
    items: [
      {
        type: "textNode",
        x: 0,
        y: 0,
        text: String.raw`\begin{tikzpicture}
          \begin{axis}[axis lines=none, ticks=none,xmax=3, xmin=-3,ymax=1.1]
            \addplot[ultra thick,black, no markers,samples=200] {exp(-x^2)};
          \end{axis}
          \begin{scope}[on background layer]
            \draw[black!45,line width=0.18pt,dash pattern=on 1pt off 1.2pt,step=1cm] ($(current bounding box.south west)+(-1,-1)$) grid ($(current bounding box.north east)+(1,1)$);
          \end{scope}
        \end{tikzpicture}`,
        style: { fill: "black" }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /tikz-axis-grid/);
  assert.match(svg, /class="tikz-axis-placeholder tikz-gaussian"/);
  assert.match(svg, /class="tikz-gaussian-axis"/);
  assert.match(svg, /class="tikz-gaussian-fill"/);
  assert.doesNotMatch(svg, /<rect[^>]+stroke="#111"/);
  assert.match(svg, /stroke-dasharray=/);
  assert.doesNotMatch(svg, /\\begin\{tikzpicture\}|addplot/);
});

test("scales nested TikZ image placeholders by node fontScale", () => {
  const svg = renderSvg({
    items: [
      {
        type: "nodeBox",
        x: 0,
        y: 0,
        width: 1.4,
        height: 1.4,
        shape: "rectangle",
        style: { stroke: "black", fill: "rgb(255 204 204)" }
      },
      {
        type: "textNode",
        x: 0,
        y: 0,
        text: String.raw`\begin{tikzpicture}\draw (0,0) -- (6,0) -- (6,3);\end{tikzpicture}`,
        style: { fill: "black", fontScale: 0.2 }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /viewBox="-80 -80 160 160"/);
  assert.match(svg, /tikz-inline-polyline/);
  assert.match(svg, /M -60 30 L 60 30 L 60 -30/);
  assert.doesNotMatch(svg, /M -300 75/);
});

test("renders preprocessed PGFPlots axis plots inside scaled node boxes", () => {
  const svg = renderSvg({
    items: [
      {
        type: "nodeBox",
        x: 0,
        y: 0,
        width: 1.4,
        height: 1.4,
        shape: "rectangle",
        style: { stroke: "black", fill: "rgb(255 204 204)" }
      },
      {
        type: "textNode",
        x: 0,
        y: 0,
        text: String.raw`\begin{tikzpicture}
          \draw[axis frame, draw=none, fill=none] (-0.3,-0.32) -- (6.55,-0.32) -- (6.55,3.32) -- (-0.3,3.32) -- cycle;
          \draw[axis plot, black] (0,0) -- (3,3) -- (6,0);
        \end{tikzpicture}`,
        style: { fill: "black", fontScale: 0.2 }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /tikz-inline-polyline/);
  assert.match(svg, /M -62\.5 30 L -2\.5 -30 L 57\.5 30/);
  assert.doesNotMatch(svg, /tikz-gaussian/);
});

test("renders preprocessed axis plot FM labels as FM wave placeholders", () => {
  const svg = renderSvg({
    items: [
      {
        type: "textNode",
        x: 0,
        y: 0,
        text: String.raw`\begin{tikzpicture}\draw[axis plot, black, thick] (0,0) -- (1,1);\end{tikzpicture}\\ $FM(t)$`,
        style: { fill: "black" }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /tikz-fm-wave/);
  assert.doesNotMatch(svg, /tikz-axis-placeholder"><rect/);
});

test("uses textcolor macros as SVG text fill colors", () => {
  const svg = renderSvg({
    items: [{ type: "textNode", x: 0, y: 0, text: String.raw`\textcolor{blue}{carrier wave}`, style: { fill: "black" } }],
    coordinates: {}
  });

  assert.match(svg, /<text[^>]+fill="blue"[^>]*>carrier wave<\/text>/);
});

test("can render math as plain SVG text for raster comparison tools", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\alpha \times x$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /<text /);
  assert.match(svg, /α × x/);
  assert.match(svg, /font-style="italic"/);
  assert.doesNotMatch(svg, /<foreignObject /);
});

test("renders sum limits and scalable delimiters compactly in SVG math fallback", () => {
  const formula = String.raw`\sigma\left(w_0 + \sum\limits_{i=1}^{n}{w_ix_i}\right)`;
  const text = mathFallbackText(formula);
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: `$${formula}$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.equal(text, "σ(w₀ + ∑ⁿᵢ₌₁w_ix_i)");
  assert.doesNotMatch(text, /left|right|limits|sum/);
  assert.match(svg, /σ\(w₀ \+ ∑ⁿᵢ₌₁/);
  assert.doesNotMatch(svg, /left|right|limits|sumlimits/);
});

test("keeps alphabetic math subscripts portable in SVG text fallback", () => {
  const text = mathFallbackText(String.raw`\alpha_{t-1}(s_1)`);
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\beta_{t+2}(s_4)$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.equal(text, "α_t-1(s₁)");
  assert.doesNotMatch(svg, /�|ₜ|ᵦ|ₑ|ₕ|ᵢ|ⱼ|ₖ|ₗ|ₘ|ₙ|ₒ|ₚ|ᵣ|ₛ|ᵤ|ᵥ|ₓ/);
  assert.match(svg, /<tspan>β<\/tspan><tspan[^>]+baseline-shift="sub">t\+2<\/tspan>\(<tspan>s<\/tspan><tspan[^>]+baseline-shift="sub">4<\/tspan>\)/);
  assert.doesNotMatch(svg, /beta|_\{t\+2\}|s_4/);
});

test("renders simple numeric math subscripts as separate SVG tspans", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$I_{16}$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, new RegExp(`<tspan>I</tspan><tspan[^>]+font-size="${formatted(lineWidthFromPt(10) * 0.9 * 0.7)}"[^>]+baseline-shift="sub">16</tspan>`));
  assert.doesNotMatch(svg, /I₁₆/);
});

test("renders simple fraction math labels as stacked SVG text fallback", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\frac{1}{f_s}$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.doesNotMatch(svg, /frac1fs/);
  assert.match(svg, />1<\/tspan>/);
  assert.match(svg, /<line /);
  assert.match(svg, /<tspan>f<\/tspan><tspan[^>]+baseline-shift="sub">s<\/tspan>/);
});

test("renders simple alphabetic math subscripts as separate SVG tspans", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\mu_a$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /<tspan>μ<\/tspan><tspan[^>]+baseline-shift="sub">a<\/tspan>/);
  assert.doesNotMatch(svg, /μ_a/);
});

test("renders command-valued math subscripts as separate SVG tspans", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\pi_\theta(s_0)$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /<tspan>π<\/tspan><tspan[^>]+baseline-shift="sub">θ<\/tspan>/);
  assert.match(svg, /<tspan>s<\/tspan><tspan[^>]+baseline-shift="sub">0<\/tspan>/);
  assert.doesNotMatch(svg, /π_θ|s₀/);
});

test("renders degree superscripts as a degree symbol in SVG math fallback", () => {
  const text = mathFallbackText(String.raw`-90^\circ`);
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$-90^\circ$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.equal(text, "-90°");
  assert.match(svg, />-90°</);
  assert.doesNotMatch(svg, /\^deg|deg/);
});

test("renders common TikZ math symbol macros in SVG text fallback", () => {
  const text = mathFallbackText(String.raw`\boldsymbol\pounds\boldsymbol\pounds + \star`);
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\boldsymbol\pounds\boldsymbol\pounds + \star$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.equal(text, "££ + ⋆");
  assert.match(svg, /££ \+ ⋆/);
  assert.doesNotMatch(svg, /pounds|star|boldsymbol/);
});

test("renders triangle label macros and textit labels without leaking TeX command names", () => {
  const text = mathFallbackText(String.raw`\blacktriangleright`);
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\blacktriangleright$ \textit{labest}`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.equal(text, "▶");
  assert.match(svg, /▶/);
  assert.match(svg, /labest/);
  assert.doesNotMatch(svg, /blacktriangleright|textit/);
});

test("renders playing-card suit macros in SVG text fallback", () => {
  const text = mathFallbackText(String.raw`\clubsuit \diamondsuit \heartsuit \spadesuit`);
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\clubsuit \diamondsuit \heartsuit \spadesuit$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.equal(text, "♣ ♦ ♥ ♠");
  assert.match(svg, /♣ ♦ ♥ ♠/);
  assert.doesNotMatch(svg, /clubsuit|diamondsuit|heartsuit|spadesuit/);
});

test("wraps plain node text to TikZ text width before shrinking", () => {
  const result = tikzToSvg(
    String.raw`
\begin{tikzpicture}
  \node[rectangle,draw,text width=13.5em,align=center] {\texttt{"How many outlined objects are above the spade?"}};
\end{tikzpicture}`,
    { mathRenderer: "svg-text" }
  );

  assert.equal(result.diagnostics.length, 0);
  assert.match(result.svg, /<tspan[^>]*>"How many outlined objects<\/tspan>/);
  assert.match(result.svg, /<tspan[^>]*>are above the spade\?"<\/tspan>/);
});

test("renders mixed math identifiers with alphabetic subscripts as SVG tspans", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$(I_n, Q_n)$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /<tspan>I<\/tspan><tspan[^>]+baseline-shift="sub">n<\/tspan>/);
  assert.match(svg, /<tspan>Q<\/tspan><tspan[^>]+baseline-shift="sub">n<\/tspan>/);
  assert.doesNotMatch(svg, /I_n|Q_n/);
});

test("renders grouped alphabetic math subscripts inside longer SVG fallback formulas", () => {
  const svg = renderSvg(
    {
      items: [
        { type: "textNode", x: 0, y: 0, text: String.raw`$G_{AB}(\vec{a})$`, style: { fill: "black" } },
        { type: "textNode", x: 2, y: 0, text: String.raw`$G_{BA}(\vec{b})$`, style: { fill: "black" } }
      ],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /<tspan>G<\/tspan><tspan[^>]+baseline-shift="sub">AB<\/tspan>\(a⃗\)/);
  assert.match(svg, /<tspan>G<\/tspan><tspan[^>]+baseline-shift="sub">BA<\/tspan>\(b⃗\)/);
  assert.doesNotMatch(svg, /G_AB|G_BA/);
});

test("does not promote scoped math bold commands to whole-label bold", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$({\bf 0}, G_3)$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  const textOpen = svg.match(/<text[^>]+>/)?.[0] || "";
  assert.doesNotMatch(textOpen, /font-weight="700"/);
  assert.doesNotMatch(svg, /\( 0/);
  assert.match(svg, /<tspan[^>]+font-weight="700"[^>]*>0<\/tspan>/);
  assert.match(svg, /<\/tspan>, <tspan>G<\/tspan>/);
  assert.match(svg, /<tspan>G<\/tspan><tspan[^>]+baseline-shift="sub">3<\/tspan>/);
  assert.doesNotMatch(svg, /G_3/);
});

test("renders combined math subscript and superscript groups as SVG tspans", () => {
  const svg = renderSvg(
    {
      items: [
        { type: "textNode", x: 0, y: 0, text: String.raw`$\mu_{id_0}^1$`, style: { fill: "black" } },
        { type: "textNode", x: 1, y: 0, text: "${\\bf O'}_{0,id_0}^1$", style: { fill: "black" } },
        { type: "textNode", x: 2, y: 0, text: String.raw`$\sigma_{id_n}^1$`, style: { fill: "black" } }
      ],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /<tspan>μ<\/tspan><tspan[^>]+baseline-shift="super">1<\/tspan><tspan[^>]+baseline-shift="sub">id₀<\/tspan>/);
  assert.match(svg, /<tspan>O'<\/tspan><tspan[^>]+baseline-shift="super">1<\/tspan><tspan[^>]+baseline-shift="sub">0,id₀<\/tspan>/);
  assert.match(svg, /<tspan>σ<\/tspan><tspan[^>]+baseline-shift="super">1<\/tspan><tspan[^>]+baseline-shift="sub">id<tspan[^>]+baseline-shift="sub">n<\/tspan><\/tspan>/);
  assert.doesNotMatch(svg, /\^1|μ_id|O'₀/);
});

test("adds TeX-like operator spacing in scripted SVG math fallback labels", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$y=A(x-a)^2+b$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /<tspan dx="[^"]+"[^>]*>=<\/tspan>/);
  assert.match(svg, /<tspan dx="[^"]+"[^>]*>\+<\/tspan>/);
  assert.doesNotMatch(svg, />y=A\(x-a\)<\/tspan>/);
});

test("renders mixed text and TeX arrows compactly in SVG text fallback", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`LSTM$_\leftarrow$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, />LSTM←</);
  assert.doesNotMatch(svg, /LSTM_/);
  assert.doesNotMatch(svg, /leftarrow|rightarrow/);
});

test("preserves vector accents in SVG math text fallback", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$G(\vec{z}) + \vec{x}_{fake}$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, />G\(z⃗\) \+/);
  assert.match(svg, /<tspan>x⃗<\/tspan><tspan[^>]+baseline-shift="sub">fake<\/tspan>/);
  assert.doesNotMatch(svg, /\\vec/);
});

test("preserves tilde accents in SVG math text fallback", () => {
  const text = mathFallbackText(String.raw`\tilde q`);
  assert.equal(text, "q̃");

  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\tilde q$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, />q̃</);
  assert.doesNotMatch(svg, /tilde q|\\tilde/);
});

test("preserves nested wide-tilde vector accents in SVG math text fallback", () => {
  const text = mathFallbackText(String.raw`\vec{\widetilde{x}}_j`);
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\vec{\widetilde{x}}_j$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.equal(text, "x̃⃗_j");
  assert.match(svg, /<tspan>x̃⃗<\/tspan><tspan[^>]+baseline-shift="sub">j<\/tspan>/);
  assert.doesNotMatch(svg, /vecwidetilde|widetilde|\\vec|\\widetilde/);
});

test("renders vector atoms with command-valued subscripts as SVG tspans", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\vec{o}_\clubsuit$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /<tspan>o⃗<\/tspan><tspan[^>]+baseline-shift="sub">♣<\/tspan>/);
  assert.doesNotMatch(svg, /o⃗_♣|clubsuit|\\vec/);
});

test("uses compact SVG bounds for TeX math fallback labels", () => {
  const svg = renderSvg(
    {
      type: "drawing",
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$\vec{h}_{3\rightarrow 4}^\ell$`, style: { fill: "black" } }]
    },
    { mathRenderer: "svg-text" }
  );
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);

  assert.ok(viewBox[2] < 150, `expected compact math fallback bounds, got ${viewBox?.join(" ")}`);
});

test("does not promote partial textcolor macros to whole-node fill", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`\textcolor{red}{AACG}AC`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /fill="black"/);
  assert.doesNotMatch(svg, /<text[^>]+fill="red"/);
  assert.match(svg, /fill="red"[^>]*>AACG/);
});

test("uses TikZ-like text scale for SVG text fallbacks", () => {
  const plain = renderSvg({
    items: [{ type: "textNode", x: 0, y: 0, text: "Agent", style: { fill: "black" } }],
    coordinates: {}
  });
  const math = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$I_{12}$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(plain, new RegExp(`font-size="${formatted(lineWidthFromPt(10))}"`));
  assert.match(math, new RegExp(`font-size="${formatted(lineWidthFromPt(9))}"`));
});

test("applies leading TeX font size macros to SVG text scale", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`\large $t$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, new RegExp(`font-size="${formatted(lineWidthFromPt(10) * 1.2 * 0.9)}"`));
  assert.doesNotMatch(svg, /\\large/);
});

test("treats explicit TeX font size commands as overriding inherited node fonts", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[font={\scriptsize\ttfamily}]
  \node[rectangle,draw,inner sep=0pt] (small) {node n};
  \node[rectangle,draw,inner sep=0pt] (large) at (4,0) {\sffamily\Large node n};
\end{tikzpicture}`);
  const boxes = Object.fromEntries(result.ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(boxes.large.width > boxes.small.width * 1.8, `expected local Large to override scriptsize, got ${boxes.small.width} -> ${boxes.large.width}`);
  assert.match(textNodes[0].style.fontFamily, /Typewriter/);
  assert.match(textNodes[1].style.fontFamily, /SansSerif/);
  assert.match(result.svg, new RegExp(`font-size="${formatted(lineWidthFromPt(10) * 1.44)}"`));
  assert.match(result.svg, new RegExp(`font-size="${formatted(lineWidthFromPt(10) * 0.7)}"`));
});

test("uses the KaTeX font stack for SVG math text fallback", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`$x_1$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /font-family="KaTeX_Main, 'Times New Roman', Times, serif"/);
});

test("renders mixed multiline text and inline math with KaTeX by default", () => {
  const svg = renderSvg({
    items: [
      {
        type: "textNode",
        x: 0,
        y: 0,
        text: String.raw`Agent 1\\$(\theta_1', \psi_1')$`,
        style: { fill: "black" }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /class="tikz-rich-text"/);
  assert.match(svg, /class="katex"/);
  assert.match(svg, /Agent 1/);
  assert.match(svg, /θ/);
});

test("preserves grouped vector macros in mixed KaTeX rich text", () => {
  const svg = renderSvg({
    items: [
      {
        type: "textNode",
        x: 0,
        y: 0,
        text: String.raw`Training data, $\vec{s}$`,
        style: { fill: "black" }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /class="katex"/);
  assert.doesNotMatch(svg, /katex-error|\\vecs|\\vec\{/);
});

test("applies per-line TeX font size macros in KaTeX rich text", () => {
  const svg = renderSvg({
    items: [
      {
        type: "textNode",
        x: 0,
        y: 0,
        text: String.raw`$s_1$\\{\scriptsize$\alpha_{t-1}(s_1)$}`,
        style: { fill: "black" }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, new RegExp(`class="tikz-rich-line"[^>]+font-size:${formatted(lineWidthFromPt(10))}px`));
  assert.match(svg, new RegExp(`class="tikz-rich-line"[^>]+font-size:${formatted(lineWidthFromPt(7))}px`));
});

test("normalizes mathcal shorthand before KaTeX rendering", () => {
  const svg = renderSvg({
    items: [
      {
        type: "textNode",
        x: 0,
        y: 0,
        text: String.raw`$\mathcalN(y;\mu,\sigma)$`,
        style: { fill: "black" }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /class="katex"/);
  assert.doesNotMatch(svg, /katex-error|mathcalN/);
});

test("renders mixed text and math lines without raw TeX delimiters", () => {
  const svg = renderSvg(
    {
      items: [
        {
          type: "textNode",
          x: 0,
          y: 0,
          text: String.raw`Agent 1\\$(\theta_1', \psi_1')$`,
          style: { fill: "black" }
        }
      ],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, />Agent 1</);
  assert.doesNotMatch(svg, /\$|\\theta|\\psi/);
});

test("renders overmat tensor matrix blocks in SVG text fallback", () => {
  const svg = renderSvg(
    {
      items: [
        {
          type: "textNode",
          x: 0,
          y: 0,
          text: String.raw`\[
            {\mathbf M} = {\left[
            \begin{matrix}
              \left[\overmat{Layer 1}{\begin{matrix}1 & 0 & 0\\1 & 0 & 1\\1 & 0 & 0\end{matrix}}{red}\right] &
              \left[\overmat{1 $\rightarrow$ 2}{\begin{matrix}1 & 0 & 0\\0 & 1 & 0\\0 & 0 & 0\end{matrix}}{gray}\right]\\
              \left[\undermat{2 $\rightarrow$ 1}{\begin{matrix}0 & 0 & 0\\1 & 0 & 0\\0 & 0 & 0\end{matrix}}{gray}\right] &
              \left[\undermat{Layer 2}{\begin{matrix}0 & 1 & 1\\1 & 0 & 0\\1 & 0 & 0\end{matrix}}{echodrk}\right]
            \end{matrix}\right]}\]`,
          style: { fill: "black" }
        }
      ],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /tikz-tensor-matrix/);
  assert.match(svg, />Layer 1</);
  assert.match(svg, />Layer 2</);
  assert.doesNotMatch(svg, /\\overmat|\\begin\{matrix\}/);
});

test("keeps complex Case 035 observation labels legible in SVG text fallback", () => {
  const svg = renderSvg(
    {
      items: [
        {
          type: "textNode",
          x: 0,
          y: 0,
          text:
            "$" +
            String.raw`{\bf O'}_{3,id_{t+1}}` +
            "$" +
            String.raw`\\$\mathcal{N}(y_{t+1};\mu_{id_{t+1}},\sigma_{id_{t+1}})$`,
          style: { fill: "black" }
        }
      ],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /baseline-shift="sub"/);
  assert.match(svg, />O'/);
  assert.match(svg, />μ</);
  assert.match(svg, />σ</);
  assert.doesNotMatch(svg, /O'_3,id_t\+1|μ_id_t\+1|σ_id_t\+1|\\mathcal/);
});

test("renders brace-stripped mathcal shorthand without raw macro text", () => {
  const svg = renderSvg(
    {
      items: [
        {
          type: "textNode",
          x: 0,
          y: 0,
          text: String.raw`Env. 1\\$(\mathcalT, \mathcalR)$`,
          style: { fill: "black" }
        }
      ],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, />Env. 1</);
  assert.match(svg, /𝒯/);
  assert.match(svg, /ℛ/);
  assert.doesNotMatch(svg, /mathcal|\\/);
});

test("approximates TikZ ball shaded circle nodes as filled SVG ellipses", () => {
  const svg = renderSvg({
    items: [
      {
        type: "nodeBox",
        shape: "circle",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        style: { stroke: "none", fill: "color-mix(in srgb, blue 60%, white)", lineWidth: 1 }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /<ellipse /);
  assert.match(svg, /fill="color-mix\(in srgb, blue 60%, white\)"/);
});

test("renders ball shaded circle node boxes as SVG radial gradients", () => {
  const svg = renderSvg({
    items: [
      {
        type: "nodeBox",
        shape: "circle",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        style: { stroke: "none", fill: "rgb(102 102 255)", lineWidth: 1, shading: "ball", ballColor: "rgb(102 102 255)" }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /<radialGradient[^>]+id="tikz-ball-rgb-102-102-255"/);
  assert.match(svg, /<ellipse[^>]+fill="url\(#tikz-ball-rgb-102-102-255\)"/);
});

test("includes circular node boxes in the SVG viewBox bounds", () => {
  const svg = renderSvg({
    items: [
      {
        type: "nodeBox",
        shape: "circle",
        x: 0,
        y: 2,
        width: 0.5,
        height: 0.5,
        style: { stroke: "black", fill: "white", lineWidth: 1 }
      }
    ],
    coordinates: {}
  });

  assert.match(svg, /viewBox="-35 -235 70 70"/);
  assert.doesNotMatch(svg, /viewBox="-10 -110 120 120"/);
});
