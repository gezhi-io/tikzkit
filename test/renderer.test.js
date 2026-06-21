import assert from "node:assert/strict";
import test from "node:test";
import { renderSvg } from "../src/index.js";
import { mathFallbackText } from "../src/tex-text.js";

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

test("renders distinct SVG marker definitions for TikZ arrow tip styles", () => {
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

  assert.match(svg, /id="arrow-to-/);
  assert.match(svg, /id="arrow-stealth-/);
  assert.match(svg, /id="arrow-latex-/);
  assert.match(svg, /markerUnits="userSpaceOnUse"/);
  assert.match(svg, /orient="auto-start-reverse"/);
  assert.match(svg, /marker-start="url\(#arrow-stealth-/);
  assert.match(svg, /marker-end="url\(#arrow-stealth-[^"]+"/);
  assert.match(svg, /stroke="orange"/);
  assert.match(svg, /fill="red"/);
  assert.match(svg, /id="arrow-latex-[^"]+[\s\S]*fill="black"/);
  assert.match(svg, /markerWidth="35"/);
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

  assert.match(plain, /font-size="30"/);
  assert.match(math, /font-size="27"/);
});

test("applies leading TeX font size macros to SVG text scale", () => {
  const svg = renderSvg(
    {
      items: [{ type: "textNode", x: 0, y: 0, text: String.raw`\large $t$`, style: { fill: "black" } }],
      coordinates: {}
    },
    { mathRenderer: "svg-text" }
  );

  assert.match(svg, /font-size="32\.4"/);
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

  assert.match(svg, /class="tikz-rich-line"[^>]+font-size:30px/);
  assert.match(svg, /class="tikz-rich-line"[^>]+font-size:19\.5px/);
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
