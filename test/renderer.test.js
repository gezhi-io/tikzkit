import assert from "node:assert/strict";
import test from "node:test";
import { renderSvg, tikzToSvg } from "../src/index.js";
import { mathFallbackText } from "../src/tex-text.js";
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
  assert.match(svg, /rotate\(-45 50 -50\)/);
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
  assert.match(svg, /β_t\+2\(s₄\)/);
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

  assert.match(svg, />G\(z⃗\) \+ x⃗/);
  assert.match(svg, /fake/);
  assert.doesNotMatch(svg, /\\vec/);
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
