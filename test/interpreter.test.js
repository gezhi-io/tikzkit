import assert from "node:assert/strict";
import test from "node:test";
import { parseTikz, interpretTikz, tikzToSvg } from "../src/index.js";
import { parseDimension } from "../src/math.js";
import { TIKZ_LINE_WIDTHS, TIKZ_UNIT, lineWidthFromPt, lineWidthFromTikzDimension, stealthArrowLengthFromLineWidth, stealthArrowShortenFromLength } from "../src/tikz-metrics.js";

function expectClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${actual} to be close to ${expected}`);
}

test("interprets draw, foreach, pgfmath, named coordinates, and calc expressions", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=10]
  \pgfmathsetmacro{\r}{2}
  \coordinate (A) at (0,0);
  \coordinate (B) at (\r,0);
  \foreach \y in {0,1} { \draw[blue, thick] ($(A)+(0,\y)$) -- ($(B)+(0,\y)$); }
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const interpreted = interpretTikz(parsed.ast);

  assert.equal(interpreted.diagnostics.length, 0);
  assert.equal(interpreted.ir.items.length, 2);
  assert.deepEqual(interpreted.ir.items[0].commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 20, y: 0 }
  ]);
  assert.deepEqual(interpreted.ir.items[1].commands, [
    { type: "moveTo", x: 0, y: 10 },
    { type: "lineTo", x: 20, y: 10 }
  ]);
  assert.equal(interpreted.ir.items[0].style.stroke, "blue");
  assert.equal(interpreted.ir.items[0].style.lineWidth, TIKZ_LINE_WIDTHS.thick);
});

test("evaluates dimension expressions with units inside arithmetic", () => {
  expectClose(parseDimension("{1.3cm*0.3}"), 0.39);
  expectClose(parseDimension("{{(1.3cm)*0.3}}"), 0.39);
  expectClose(parseDimension("1cm+2pt"), 1 + 2 / 28.4527559);
  expectClose(parseDimension("1cm-2pt"), 1 - 2 / 28.4527559);
});

test("keeps consecutive arc segments in one filled TikZ path", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[fill=green!30, thick] (-1,0)
    arc (180:0:1)
    arc (0:180:0.25)
    arc (0:180:0.75);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const filledPaths = result.ir.items.filter((item) => item.type === "path" && item.style?.fill !== "none");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(filledPaths.length, 1);
  assert.equal(filledPaths[0].commands[0].type, "moveTo");
  assert.ok(
    filledPaths[0].commands.filter((command) => command.type === "curveTo").length >= 6,
    `expected combined arc path to keep multiple cubic arc segments, got ${JSON.stringify(filledPaths[0].commands)}`
  );
});

test("renders TikZ arc operations as smooth cubic curves", () => {
  const { ir, diagnostics } = interpretTikz(parseTikz(String.raw`
\begin{tikzpicture}
  \draw (1,0) arc (0:180:1);
\end{tikzpicture}`).ast);
  const arc = ir.items.find((item) => item.type === "path" && item.shape === "arc");
  const drawCommands = arc?.commands.slice(1) || [];
  const end = arc?.commands.at(-1);

  assert.deepEqual(diagnostics, []);
  assert.ok(arc, "expected arc path");
  assert.ok(drawCommands.every((command) => command.type === "curveTo"), `expected only cubic arc drawing commands, got ${JSON.stringify(drawCommands)}`);
  assert.ok(drawCommands.length >= 2, `expected arc to be split into cubic segments, got ${drawCommands.length}`);
  expectClose(end.x, -1, 1e-6);
  expectClose(end.y, 0, 1e-6);
});

test("respects arc delta angle and explicit zero end angles", () => {
  const { ir, diagnostics } = interpretTikz(parseTikz(String.raw`
\begin{tikzpicture}
  \draw[fill=red!40] (0,0) -- ++(0:.4)
    arc[start angle=0,delta angle=-120,radius=.4];
  \draw (1,0) arc[start angle=0,end angle=0,radius=.2];
\end{tikzpicture}`).ast);
  const arcs = ir.items.filter((item) => item.type === "path" && item.shape === "arc");
  const deltaArc = arcs[0];
  const zeroArc = arcs[1];

  assert.deepEqual(diagnostics, []);
  assert.ok(deltaArc, "expected a delta-angle arc");
  assert.equal(deltaArc.commands.filter((command) => command.type === "curveTo").length, 2);
  expectClose(deltaArc.commands.at(-1).x, -0.2, 1e-6);
  expectClose(deltaArc.commands.at(-1).y, -0.2 * Math.sqrt(3), 1e-6);
  assert.ok(zeroArc, "expected an explicit zero-end-angle arc");
  assert.equal(zeroArc.commands.filter((command) => command.type === "curveTo").length, 1);
  expectClose(zeroArc.commands.at(-1).x, 1, 1e-6);
  expectClose(zeroArc.commands.at(-1).y, 0, 1e-6);
});

test("uses injected text engine metrics when sizing math node boxes", () => {
  const textEngineCalls = [];
  const textEngine = {
    validate() {
      return null;
    },
    measure(request) {
      textEngineCalls.push(request);
      if (request.mode !== "math") return null;
      return {
        cacheKey: "fake-math:x",
        width: 240,
        height: 70,
        baselineY: 48,
        midLineY: 35,
        renderSourceText: request.text
      };
    }
  };
  const result = interpretTikz(parseTikz(String.raw`
\begin{tikzpicture}
  \node[draw, inner sep=0pt] {$x$};
\end{tikzpicture}`).ast, { textEngine, textEngineUnit: TIKZ_UNIT });
  const box = result.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(textEngineCalls.some((call) => call.mode === "math" && call.text === "$x$"), `expected math text engine call, got ${JSON.stringify(textEngineCalls)}`);
  assert.ok(box, "expected a drawn node box");
  assert.ok(box.width > 2.3 && box.width < 2.5, `expected text engine width near 2.4cm, got ${box.width}`);
  assert.ok(box.height > 0.65 && box.height < 0.8, `expected text engine height near 0.7cm, got ${box.height}`);
});

test("uses injected text engine metrics when sizing plain node boxes", () => {
  const textEngineCalls = [];
  const textEngine = {
    validate() {
      return null;
    },
    measure(request) {
      textEngineCalls.push(request);
      if (request.mode !== "text") return null;
      return {
        cacheKey: "fake-text:wide",
        width: 310,
        height: 50,
        baselineY: 34,
        midLineY: 25,
        renderSourceText: request.text
      };
    }
  };
  const result = interpretTikz(parseTikz(String.raw`
\begin{tikzpicture}
  \node[draw, inner sep=0pt] {Wide};
\end{tikzpicture}`).ast, { textEngine, textEngineUnit: TIKZ_UNIT });
  const box = result.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(textEngineCalls.some((call) => call.mode === "text" && call.text === "Wide"), `expected plain text engine call, got ${JSON.stringify(textEngineCalls)}`);
  assert.ok(box, "expected a drawn node box");
  assert.ok(box.width > 3.0 && box.width < 3.2, `expected text engine width near 3.1cm, got ${box.width}`);
  assert.ok(box.height > 0.45 && box.height < 0.55, `expected text engine height near 0.5cm, got ${box.height}`);
});

test("logical TeX box metrics alone bypass the legacy plain-text minimum height", () => {
  const textEngine = {
    validate() {
      return null;
    },
    measure(request) {
      if (request.mode !== "text") return null;
      return {
        cacheKey: `fake-text:${request.text}`,
        width: 100,
        height: 25,
        baselineY: 20,
        midLineY: 12.5,
        renderSourceText: request.text,
        ...(request.text === "Logical" ? { measurementKind: "tex-box" } : {})
      };
    }
  };
  const result = interpretTikz(parseTikz(String.raw`
\begin{tikzpicture}
  \node[draw] (logical) {Logical};
  \node[draw] (fallback) at (2,0) {Fallback};
\end{tikzpicture}`).ast, { textEngine, textEngineUnit: 100 });
  const boxes = Object.fromEntries(result.ir.items.filter((item) => item.type === "nodeBox" && item.id).map((item) => [item.id, item]));

  assert.deepEqual(result.diagnostics, []);
  assert.ok(boxes.logical.height > 0.48 && boxes.logical.height < 0.49, `expected typed logical height without clamp, got ${boxes.logical.height}`);
  assert.ok(boxes.fallback.height > 0.51 && boxes.fallback.height < 0.52, `expected fallback height with legacy clamp, got ${boxes.fallback.height}`);
});

test("sizes a plain node from its logical TeX box", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[draw,dashed] {concatenate};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox");
  const svgPtPerCm = 72 / 2.54;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(box, "expected a node box");
  assert.ok(Math.abs(box.width * svgPtPerCm - 58.11) < 0.25, `expected logical node width near 58.11pt, got ${box.width * svgPtPerCm}`);
  assert.ok(Math.abs(box.height * svgPtPerCm - 12.88) < 0.25, `expected logical node height near 12.88pt, got ${box.height * svgPtPerCm}`);
});

test("passes TikZ text width to injected text engine when sizing plain node boxes", () => {
  const textEngineCalls = [];
  const textEngine = {
    validate() {
      return null;
    },
    measure(request) {
      textEngineCalls.push(request);
      if (request.mode !== "text") return null;
      return {
        cacheKey: "fake-text:wrapped",
        width: 100,
        height: request.textWidthPt ? 90 : 30,
        baselineY: 60,
        midLineY: 45,
        renderSourceText: request.text
      };
    }
  };
  const result = interpretTikz(parseTikz(String.raw`
\begin{tikzpicture}
  \node[draw, inner sep=0pt, text width=1cm] {wrapped text};
\end{tikzpicture}`).ast, { textEngine, textEngineUnit: TIKZ_UNIT });
  const box = result.ir.items.find((item) => item.type === "nodeBox");
  const textCall = textEngineCalls.find((call) => call.mode === "text" && call.text === "wrapped text");
  const expectedTextWidthPt = parseDimension("1cm") * 28.4527559;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(textCall, `expected plain text engine call, got ${JSON.stringify(textEngineCalls)}`);
  assert.ok(
    Math.abs(textCall.textWidthPt - expectedTextWidthPt) < 1e-6,
    `expected textWidthPt ${expectedTextWidthPt}, got ${textCall.textWidthPt}`
  );
  assert.ok(box, "expected a drawn node box");
  assert.ok(box.height > 0.85 && box.height < 0.95, `expected wrapped text engine height near 0.9cm, got ${box.height}`);
});

test("resolves calc scalar multiplication of vector coordinates", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{calc}
\begin{tikzpicture}
  \def\thetas{5}
  \def\thetav{0.4}
  \draw ($(-0.25,0)+1/(1+exp(\thetas*\thetav))*(0,1)$) --
        ($(0,0)+{0.9+-2.8*(-0.4)^2}*(1,0)$);
  \coordinate (A) at (2,4);
  \coordinate (B) at (4,0);
  \draw ($0.5*(A)+0.5*(B)$) -- (0,0);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  expectClose(paths[0].commands[0].x, -0.25);
  expectClose(paths[0].commands[0].y, 1 / (1 + Math.exp(2)));
  expectClose(paths[0].commands[1].x, 0.9 - 2.8 * 0.4 ** 2);
  expectClose(paths[0].commands[1].y, 0);
  expectClose(paths[1].commands[0].x, 3);
  expectClose(paths[1].commands[0].y, 2);
});

test("evaluates unbraced pgfmath length macros inside foreach timelines", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \pgfmathtruncatemacro\start{2010}
  \pgfmathtruncatemacro\ende{2012}
  \pgfmathtruncatemacro\differenz{\ende-\start}
  \draw[->] (0,0) -- (\textwidth,0);
  \foreach \j in {0,...,\differenz} {
    \pgfmathsetlengthmacro\tmp{\j*\textwidth/\differenz}
    \pgfmathtruncatemacro\jahr{\start+\j}
    \draw (\tmp,0) node[rotate=45,left,yshift=-6pt] {\jahr};
  }
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const yearLabels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const axis = result.ir.items.find((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(yearLabels, ["2010", "2011", "2012"]);
  assert.ok(axis.commands[1].x > 10, `expected textwidth-scaled axis, got ${axis.commands[1].x}`);
});

test("applies leading font switches before tikzset timeline styles", () => {
  const source = String.raw`
\begin{tikzpicture}
  \small \sf
  \tikzset{label/.style={draw=gray, ultra thin, rounded corners=.25ex, fill=gray!20, text width=4cm, text badly centered, inner sep=.5ex, above=2em, anchor=west, rotate=45}}
  \tikzset{tick/.style={below=3pt}}
  \draw (1,0) node(A1)[tick]{1} node(B1)[label]{event};
  \foreach \nn in {1} { \draw[blue] (B\nn.west) -- ++(0,-.75); }
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const interpreted = interpretTikz(parsed.ast);
  const diagnostics = [...parsed.diagnostics, ...interpreted.diagnostics];
  const box = interpreted.ir.items.find((item) => item.type === "nodeBox" && item.id === "B1");
  const label = interpreted.ir.items.find((item) => item.type === "textNode" && item.text === "event");
  const connector = interpreted.ir.items.find((item) => item.type === "path" && item.style?.stroke === "blue");

  assert.deepEqual(diagnostics, []);
  assert.ok(box, "expected label style draw/fill to create a node box");
  assert.equal(box.style.fill, "rgb(230 230 230)");
  assert.ok(label.rotation > 40 && label.rotation < 50, `expected rotated label, got ${label.rotation}`);
  assert.ok(interpreted.ir.coordinates.B1.x > 2, `expected west-anchored rotated label center to sit right of tick, got ${interpreted.ir.coordinates.B1.x}`);
  assert.ok(interpreted.ir.coordinates.B1.y > 1.8, `expected label center above axis, got ${interpreted.ir.coordinates.B1.y}`);
  assert.ok(Math.abs(connector.commands[0].x - 1) < 0.08, `expected connector to start near B1 west anchor x=1, got ${connector.commands[0].x}`);
  assert.ok(connector.commands[0].y > 0.6, `expected connector to start above axis, got ${connector.commands[0].y}`);
});

test("wraps fixed-width diamond text with TeX metrics and native aspect geometry", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes}
\tikzset{decision/.style={diamond,draw,text width=4.5em,text badly centered,inner sep=0pt}}
\begin{tikzpicture}
  \node[decision] at (0,0) {do bounding boxes intersect?};
  \node[decision] at (4,0) {does line a intersect line segment b?};
  \node[decision] at (8.7,0) {does line b intersect line segment a?};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const diamonds = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "diamond");
  const diamondText = result.ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(diamonds.length, 3);
  assert.equal(diamondText.length, 3);
  diamondText.forEach((item) => assert.equal(item.textAlign, "center"));
  diamonds.forEach((diamond) => expectClose(diamond.width, diamond.height, 1e-10));
  expectClose(diamonds[0].width, 3.10, 0.03);
  expectClose(diamonds[1].width, 3.51, 0.03);
  expectClose(diamonds[2].width, 3.93, 0.03);
  assert.equal((result.svg.match(/>does line<\/tspan>/g) || []).length, 2);
  assert.match(result.svg, />a intersect<\/tspan>/);
  assert.match(result.svg, />b<\/tspan>/);
  assert.doesNotMatch(result.svg, />b intersect<\/tspan>/);
  assert.doesNotMatch(result.svg, />line b<\/tspan>/);
});

test("maps TikZ paragraph alignment styles onto wrapped text nodes", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[text width=5em,text centered] at (0,0) {centered block};
  \node[text width=5em,text badly ragged right] at (3,0) {left block};
  \node[text width=5em,text ragged left] at (6,0) {right block};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(textNodes.map((item) => item.textAlign), ["center", "left", "right"]);
});

test("resolves declared timeline coordinate systems before polar fallback", () => {
  const result = tikzToSvg(String.raw`
\tikzdeclarecoordinatesystem{timeline}{%
  \pgfmathsetmacro\myx{(#1-1975)/3}
  \pgfpointxy{\myx}{0}
}
\begin{tikzpicture}
  \draw (timeline cs:1975) -- (timeline cs:2020);
  \draw (timeline cs:1980) -- ++(0,0.2) node[above,font=\tiny]{1980};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path" && item.subtype !== "grid-line");
  const tickLabel = result.ir.items.find((item) => item.type === "textNode" && item.text === "1980");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths[0].commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 15, y: 0 }
  ]);
  assert.ok(Math.abs(paths[1].commands[0].x - 5 / 3) < 1e-6, `expected 1980 tick at x=5/3, got ${paths[1].commands[0].x}`);
  assert.ok(Math.abs(tickLabel.x - 5 / 3) < 1e-6, `expected 1980 label at x=5/3, got ${tickLabel.x}`);
});

test("renders path edges, intersection cs coordinates, and inline angle pics", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary {angles,calc,quotes}
\begin{tikzpicture}[angle radius=.75cm]
  \node (A) at (-2,0)     [red,left]   {$A$};
  \node (B) at ( 3,.5)    [red,right]  {$B$};
  \node (C) at (-2,2)     [blue,left]  {$C$};
  \node (D) at ( 3,2.5)   [blue,right] {$D$};
  \node (E) at (60:-5mm)  [below]      {$E$};
  \node (F) at (60:3.5cm) [above]      {$F$};

  \coordinate (X) at (intersection cs:first line={(A)--(B)}, second line={(E)--(F)});
  \coordinate (Y) at (intersection cs:first line={(C)--(D)}, second line={(E)--(F)});

  \path
    (A) edge [red, thick]  (B)
    (C) edge [blue, thick] (D)
    (E) edge [thick]       (F)
      pic ["$\alpha$", draw, fill=yellow]   {angle = F--X--A}
      pic ["$\beta$",  draw, fill=green!30] {angle = B--X--F}
      pic ["$\gamma$", draw, fill=yellow]   {angle = E--Y--D}
      pic ["$\delta$", draw, fill=green!30] {angle = C--Y--E};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const edges = result.ir.items.filter((item) => item.type === "path" && item.subtype === "edge");
  const anglePics = result.ir.items.filter((item) => item.type === "path" && item.subtype === "angle-pic");
  const angleLabels = result.ir.items.filter((item) => item.type === "textNode" && /^\$\\(?:alpha|beta|gamma|delta)\$$/.test(item.text));

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.coordinates.X.x > 0.15 && result.ir.coordinates.X.x < 0.3, `expected X on the oblique EF line, got ${JSON.stringify(result.ir.coordinates.X)}`);
  assert.ok(result.ir.coordinates.Y.x > 1.1 && result.ir.coordinates.Y.x < 1.4, `expected Y on the oblique EF line, got ${JSON.stringify(result.ir.coordinates.Y)}`);
  assert.ok(result.ir.coordinates.Y.y > 2.2 && result.ir.coordinates.Y.y < 2.45, `expected Y on upper blue line, got ${JSON.stringify(result.ir.coordinates.Y)}`);
  assert.equal(edges.length, 3);
  assert.deepEqual(edges.map((edge) => edge.style.stroke), ["red", "blue", "black"]);
  assert.ok(edges.every((edge) => {
    const [from, to] = edge.commands;
    return Math.hypot((to?.x ?? 0) - (from?.x ?? 0), (to?.y ?? 0) - (from?.y ?? 0)) > 1;
  }), "expected node edge operations to produce visible non-zero lines");
  assert.equal(anglePics.length, 4);
  assert.deepEqual(anglePics.map((pic) => pic.style.fill), ["yellow", "rgb(179 255 179)", "yellow", "rgb(179 255 179)"]);
  assert.deepEqual(angleLabels.map((node) => node.text), ["$\\alpha$", "$\\beta$", "$\\gamma$", "$\\delta$"]);
});

test("inherits current path color for bare fill inline nodes", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[event/.style={fill,text=white,font=\tiny}]
  \draw[blue!80] (0,0) -- ++(0,-.8) node[below,event]{A};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox");
  const label = result.ir.items.find((item) => item.type === "textNode" && item.text === "A");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.style.fill, "rgb(51 51 255)");
  assert.equal(label.style.fill, "white");
});

test("applies picture xscale and yscale to coordinates without scaling node shape", () => {
  const source = String.raw`
\begin{tikzpicture}[xscale=2,yscale=0.5]
  \draw (1,2) -- ++(1,2);
  \node[draw, minimum width=1cm, minimum height=1cm] (A) at (1,2) {A};
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const interpreted = interpretTikz(parsed.ast);
  const path = interpreted.ir.items.find((item) => item.type === "path");
  const box = interpreted.ir.items.find((item) => item.type === "nodeBox" && item.id === "A");

  assert.deepEqual([...parsed.diagnostics, ...interpreted.diagnostics], []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 2, y: 1 },
    { type: "lineTo", x: 4, y: 2 }
  ]);
  assert.equal(box.x, 2);
  assert.equal(box.y, 1);
  assert.equal(box.width, 1);
  assert.equal(box.height, 1);
});

test("interprets foreach count and evaluate options in dynamic coordinate names", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (n-3-1) at (0,0);
  \coordinate (n-3-2) at (1,0);
  \coordinate (n-3-4) at (0,1);
  \coordinate (n-3-5) at (1,1);
  \foreach \i [count=\j from 1] in {3} \draw (n-\i-1) -- node[midway] {\j} (n-\i-2);
  \foreach \k [evaluate=\k as \m using {int(\k+1)}] in {4} \draw (n-3-\k) -- (n-3-\m);
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const interpreted = interpretTikz(parsed.ast);
  const paths = interpreted.ir.items.filter((item) => item.type === "path");

  assert.deepEqual([...parsed.diagnostics, ...interpreted.diagnostics], []);
  assert.deepEqual(paths.map((path) => path.commands), [
    [
      { type: "moveTo", x: 0, y: 0 },
      { type: "lineTo", x: 1, y: 0 }
    ],
    [
      { type: "moveTo", x: 0, y: 1 },
      { type: "lineTo", x: 1, y: 1 }
    ]
  ]);
  assert.ok(interpreted.ir.items.some((item) => item.type === "textNode" && item.text === "1"));
});

test("interprets foreach count starting from option in coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}
  \foreach \Text [count=\Xc starting from 0] in {{A},{B},{C}} {
    \node at (\Xc,0) {\Text};
  }
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const interpreted = interpretTikz(parsed.ast);
  const textNodes = interpreted.ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual([...parsed.diagnostics, ...interpreted.diagnostics], []);
  assert.deepEqual(textNodes.map((node) => node.x), [0, 1, 2]);
});

test("lays out multiple tikzpictures inline instead of overlaying their local coordinates", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw (0,0) -- (2,0);
  \node at (1,0) {P};
\end{tikzpicture}

\vspace{30pt}between pictures

\begin{tikzpicture}[mylabel/.style={above=3pt, rotate=-45}]
  \draw (0,0) -- (2,0);
  \node[mylabel] at (1,0) {P};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const labels = result.ir.items.filter((item) => item.type === "textNode" && item.text === "P");
  const prose = result.ir.items.find((item) => item.type === "textNode" && item.text === "between pictures");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(labels.length, 2);
  assert.ok(prose, "expected document prose between tikzpictures to be rendered");
  assert.ok(labels[1].x > labels[0].x + 2.5, `expected second picture to be shifted right, got ${labels.map((item) => item.x)}`);
  assert.ok(prose.x > labels[0].x && prose.x < labels[1].x, `expected prose between pictures, got prose=${prose.x}, labels=${labels.map((item) => item.x)}`);
});

test("uses foreach coordinate variables as path circle centers", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \foreach \p in {(.6,.6),(3.1,.6),(2.35,2.25),(1,2.7)} \fill[black] \p circle(.035);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const circles = result.ir.items.filter((item) => item.shape === "circle" && item.style?.fill === "black");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    circles.map((circle) => [circle.cx, circle.cy]),
    [
      [0.6, 0.6],
      [3.1, 0.6],
      [2.35, 2.25],
      [1, 2.7]
    ]
  );
});

test("expands foreach segments while preserving the current path", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw (0,0) \foreach \x in {1,...,3} { -- (\x,0) } -- cycle;
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 1, y: 0 },
    { type: "lineTo", x: 2, y: 0 },
    { type: "lineTo", x: 3, y: 0 },
    { type: "closePath" }
  ]);
});

test("evaluates inline pgfmathparse results inside foreach node text", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \foreach \i in {1,2} {
    \node at (\i,0) {$\times \pgfmathparse{int(mod(\i+4,2))}\pgfmathresult$};
  }
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(texts, [String.raw`$\times 1$`, String.raw`$\times 0$`]);
  assert.doesNotMatch(result.svg, /pgfmathparse|pgfmathresult/);
});

test("maps TikZ stroke presets and explicit dimensions into SVG stroke units", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) -- (1,0);
  \draw[ultra thin] (0,1) -- (1,1);
  \draw[very thick] (0,2) -- (1,2);
  \draw[line width=1mm] (0,3) -- (1,3);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const widths = ir.items.map((item) => item.style.lineWidth);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(widths, [
    TIKZ_LINE_WIDTHS.default,
    TIKZ_LINE_WIDTHS.ultraThin,
    TIKZ_LINE_WIDTHS.veryThick,
    lineWidthFromTikzDimension("1mm", TIKZ_LINE_WIDTHS.default)
  ]);
});

test("maps shadows.blur blur shadow to soft node shadows", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shadows.blur}
\begin{tikzpicture}
  \node[draw, fill=Gold, rounded corners=5pt, blur shadow={shadow blur steps=15}] (box) {Box};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "box");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(box?.shadows?.length, `expected blur shadow metadata, got ${JSON.stringify(box)}`);
  assert.equal(box.shadows[0].blur, true);
  assert.match(result.svg, /tikzkit-blur-shadow/);
});

test("applies shadows.blur filters and every-shadow overrides to path preactions", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shadows.blur}
\begin{tikzpicture}[every shadow/.style={shadow blur radius=1mm,shadow opacity=60}]
  \filldraw[blur shadow={shadow opacity=25},fill=yellow!20] (0,0) rectangle (2,1);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.shadows.length, 1);
  assert.equal(path.shadows[0].blur, true);
  expectClose(path.shadows[0].blurRadius, 0.1, 1e-12);
  expectClose(path.shadows[0].style.opacity, 0.25, 1e-12);
  assert.match(result.svg, /class="tikz-path-shadow"/);
  assert.match(result.svg, /filter="url\(#tikzkit-blur-shadow-100\)"/);
});

test("renders circuitikz npn and pnp transistor nodes with B C E anchors", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
\draw
  (0,0) node[pnp] (pnp2) {Q2}
  (pnp2.B) node[pnp, xscale=-1, anchor=B] (pnp1) {}
  (pnp1) node[left, inner sep=0pt] {Q1}
  (pnp1.C) node[npn, anchor=C] (npn1) {Q3}
  (pnp2.C) node[npn, xscale=-1, anchor=C] (npn2)
    {\scalebox{-1}[1]{Q4}}
  (pnp1.E) -- (pnp2.E)  (npn1.E) -- (npn2.E)
  (pnp1.B) node[circ] {} |- (pnp2.C) node[circ] {}
;
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const transistorBoxes = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circuitikzTransistor");
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(transistorBoxes.length, 4);
  assert.ok(paths.some((path) => path.commands.some((command) => Math.abs(command.x || 0) > 0.2 || Math.abs(command.y || 0) > 0.2)));
  assert.doesNotMatch(result.svg, /scalebox/);
  assert.match(result.svg, />Q4</);
  assert.match(result.svg, /tikz-node-circuitikzTransistor/);
});

test("matches graphicx resizebox dimensions around a single TikZ picture", () => {
  const result = tikzToSvg(String.raw`
\documentclass[border=2pt]{standalone}
\usepackage{tikz}
\begin{document}
\resizebox{250px}{250px}{
  \begin{tikzpicture}
    \draw (0,0) circle (1.3cm);
  \end{tikzpicture}
}
\end{document}`, { mathRenderer: "svg-text" });

  const size = result.svg.match(/width="([\d.]+)pt" height="([\d.]+)pt"/);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.pictures[0].graphicxResize.width, "250px");
  assert.equal(result.ast.pictures[0].graphicxResize.height, "250px");
  assert.ok(size, "expected a physical SVG document size");
  assert.ok(Math.abs(Number(size[1]) - 254) < 0.1, `expected 254pt width, got ${size[1]}`);
  assert.ok(Math.abs(Number(size[2]) - 254) < 0.1, `expected 254pt height, got ${size[2]}`);
  assert.match(result.svg, /<g transform="translate\([^)]*\) scale\([^)]*\)">/);
});

test("renders labels attached to coordinate statements", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate[label=above:$p$] (p) at (2,9);
  \coordinate[label=left:$u$] (u) at (0,3);
  \coordinate[label=right:$x$] (x) at (7,2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = (text) => ir.items.find((item) => item.type === "textNode" && item.text === text);
  const p = label("$p$");
  const u = label("$u$");
  const x = label("$x$");

  assert.deepEqual(diagnostics, []);
  assert.ok(p && Math.abs(p.x - 2) < 1e-6 && p.y > 9, `expected p above coordinate, got ${JSON.stringify(p)}`);
  assert.ok(u && u.x < 0 && Math.abs(u.y - 3) < 1e-6, `expected u left of coordinate, got ${JSON.stringify(u)}`);
  assert.ok(x && x.x > 7 && Math.abs(x.y - 2) < 1e-6, `expected x right of coordinate, got ${JSON.stringify(x)}`);
});

test("places bare directional nodes like equivalent anchors without an extra gap", () => {
  const right = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[right] at (0,0) {$x$};
\end{tikzpicture}`, { mathRenderer: "svg-text" }).ir.items.find((item) => item.type === "textNode");
  const west = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[anchor=west] at (0,0) {$x$};
\end{tikzpicture}`, { mathRenderer: "svg-text" }).ir.items.find((item) => item.type === "textNode");

  assert.ok(right && west, "expected both text nodes");
  assert.ok(Math.abs(right.x - west.x) < 1e-6, `expected right node x=${right.x} to match anchor west x=${west.x}`);
  assert.ok(Math.abs(right.y - west.y) < 1e-6, `expected right node y=${right.y} to match anchor west y=${west.y}`);
});

test("renders styled coordinate statements as visible node anchors", () => {
  const source = String.raw`
\begin{tikzpicture}[node distance=3cm, line width=3pt, white,
  element/.style={circle, draw, minimum width=4em}]
  \coordinate[element, fill=red] (top);
  \coordinate[element, below left of=top, fill=blue] (mid);
  \path[->] (top) edge[bend left] (mid);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items
    .filter((item) => item.type === "nodeBox" && item.id)
    .map((item) => [item.id, item]));
  const edgePath = ir.items.find((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(diagnostics, []);
  assert.equal(boxes.top?.shape, "circle");
  assert.equal(boxes.mid?.shape, "circle");
  assert.equal(boxes.top?.style.fill, "red");
  assert.equal(boxes.mid?.style.fill, "blue");
  assert.ok(boxes.top.width > 1 && boxes.top.height > 1, `expected 4em-sized top coordinate node, got ${JSON.stringify(boxes.top)}`);
  assert.ok(edgePath?.commands?.[0]?.type === "moveTo");
  assert.notDeepEqual(edgePath.commands[0], { type: "moveTo", x: 0, y: 0 });
});

test("keeps the current point at the edge host for consecutive edge operations", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \path (0,0) edge (1,0) edge (0,1);
\end{tikzpicture}`);
  const edges = result.ir.items.filter((item) => item.type === "path" && item.subtype === "edge");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(edges.length, 2);
  assert.deepEqual(edges.map((edge) => edge.commands[0]), [
    { type: "moveTo", x: 0, y: 0 },
    { type: "moveTo", x: 0, y: 0 }
  ]);
  assert.deepEqual(edges.map((edge) => edge.commands.at(-1)), [
    { type: "lineTo", x: 1, y: 0 },
    { type: "lineTo", x: 0, y: 1 }
  ]);
});

test("uses an anonymous coordinate as an invisible tree root", () => {
  const source = String.raw`\begin{tikzpicture}[level 1/.style={sibling distance=2cm}]
    \coordinate
      child[grow=left] {node[draw] {A}}
      child[grow=right] {node[draw] {B}};
  \end{tikzpicture}`;
  const result = tikzToSvg(source);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.equal(result.diagnostics.length, 0);
  assert.equal(boxes.length, 2);
  assert.equal(paths.length, 2);
  assert.ok(boxes.some((box) => box.x < 0));
  assert.ok(boxes.some((box) => box.x > 0));
});

test("supports a node-less child as an intermediate tree level", () => {
  const source = String.raw`\begin{tikzpicture}
    \coordinate
      child[grow=down,level distance=0pt]
      [edge from parent fork down]
      child {node[draw] {A}}
      child {node[draw] {B}};
  \end{tikzpicture}`;
  const result = tikzToSvg(source);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.equal(result.diagnostics.length, 0);
  assert.equal(boxes.length, 2);
  assert.equal(paths.length, 3);
  assert.ok(boxes.every((box) => box.y < -1));
  assert.ok(paths.filter((path) => path.commands.length === 4).length >= 2);
});

test("routes custom tree parent south to child west paths orthogonally", () => {
  const source = String.raw`\begin{tikzpicture}[
    branch/.style={grow=down,edge from parent path={(\tikzparentnode.south) |- (\tikzchildnode.west)}}]
    \node[draw] {P}
      child[branch] {node[draw] {C}};
  \end{tikzpicture}`;
  const result = tikzToSvg(source);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.equal(result.diagnostics.length, 0);
  assert.equal(path.commands.length, 3);
  assert.equal(path.commands[0].x, path.commands[1].x);
  assert.equal(path.commands[1].y, path.commands[2].y);
});

test("keeps orthogonal west-anchored tree children in one vertical column", () => {
  const source = String.raw`\begin{tikzpicture}[
    branch/.style={grow=down,xshift=1em,anchor=west,edge from parent path={(\tikzparentnode.south) |- (\tikzchildnode.west)}},
    first/.style={level distance=6ex},
    second/.style={level distance=12ex}]
    \node[draw] {P}
      child[branch,first] {node[draw] {A}}
      child[branch,second] {node[draw] {B}};
  \end{tikzpicture}`;
  const result = tikzToSvg(source);
  const children = result.ir.items.filter((item) => item.type === "nodeBox").slice(1);

  assert.equal(result.diagnostics.length, 0);
  assert.equal(children.length, 2);
  assert.ok(Math.abs((children[0].x - children[0].width / 2) - (children[1].x - children[1].width / 2)) < 1e-9);
  assert.notEqual(children[0].y, children[1].y);
});

test("does not apply sibling offsets across different tree grow directions", () => {
  const source = String.raw`\begin{tikzpicture}
    \coordinate
      child[grow=left] {node[draw] {L}}
      child[grow=right] {node[draw] {R}}
      child[grow=down] {node[draw] {D}};
  \end{tikzpicture}`;
  const result = tikzToSvg(source);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");

  assert.equal(result.diagnostics.length, 0);
  assert.equal(boxes.length, 3);
  assert.ok(boxes.every((box) => Math.abs(box.x) < 1e-9 || Math.abs(box.y) < 1e-9));
});

test("ignores an isolated TeX control-space line before a drawing command", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \
  \draw (0,0) -- (2,0);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(path?.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 2, y: 0 }
  ]);
});

test("parses arrows.meta value syntax and scales the selected tip", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[arrows={-{Latex[scale=0.5]}}] (0,0) -- (2,0);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path?.style?.markerEnd?.kind, "latex");
  assert.ok(path.style.markerEnd.length > 0 && path.style.markerEnd.length < 8);
  assert.ok(path.style.markerEnd.width > 0 && path.style.markerEnd.width < 8);
  assert.match(result.svg, /tikz-arrow-latex/);
});

test("keeps stroked circular node outlines inside the SVG bounds for scaled Latex edge tips", () => {
  const source = String.raw`
    \tikzset{vertex/.style={draw,circle,minimum size=10pt,inner sep=0pt}}
    \tikzset{edge/.style={arrows={{Latex[scale=0.5]}-},thick}}
    \begin{tikzpicture}
      \node[vertex] (a) at (0,0) {};
      \node[vertex] (b) at (4,0) {};
      \draw (a) edge[edge] (b);
    \end{tikzpicture}
  `;
  const result = tikzToSvg(source);
  const viewBox = result.svg.match(/\bviewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);

  assert.ok(viewBox, "expected an SVG viewBox");
  assert.ok(Math.abs(viewBox[0] + 18.276) < 0.01, `expected the left circle stroke in bounds, got ${viewBox}`);
  assert.ok(Math.abs(viewBox[2] - 436.552) < 0.02, `expected both circle outlines in bounds, got ${viewBox}`);
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-latex"/);
});

test("lays out horizontal rectangle split node parts and named anchors", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.multipart}
\begin{tikzpicture}
  \node[rectangle split, rectangle split horizontal, rectangle split parts=3, draw] (a)
    {A\nodepart{two}\nodepart{three}C};
  \draw (a.one) -- (a.three);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "a");
  const texts = result.ir.items.filter((item) => item.type === "textNode");
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.shape, "rectangleSplit");
  assert.equal(box.parts, 3);
  assert.equal(box.partWidths.length, 3);
  assert.deepEqual(texts.map((item) => item.text), ["A", "C"]);
  assert.ok(path.commands[0].x < path.commands[1].x, `expected one-to-three anchor path, got ${JSON.stringify(path.commands)}`);
  const layout = box.shapeData.rectangleSplit;
  assert.ok(Math.abs(path.commands[0].x - (box.x + layout.parts[0].originX)) < 0.01);
  assert.ok(Math.abs(path.commands[1].x - (box.x + layout.parts[2].originX)) < 0.01);
  assert.doesNotMatch(result.svg, /nodepart/);
});

test("uses rectangle split text origins for unequal IEEE-754 fields", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.multipart,calc}
\begin{tikzpicture}
  \node[rectangle split,rectangle split horizontal,rectangle split parts=3,draw] (a)
    {\nodepart{one}0\nodepart{two}01001100\nodepart{three}01001111000000001111111};
  \draw ($(a.two)+(-0.13,0)$) -- ($(a.three)+(-0.13,0)$);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "a");
  const path = result.ir.items.find((item) => item.type === "path");
  const layout = box.shapeData.rectangleSplit;
  const expectedStart = box.x + layout.parts[1].originX - 0.13;
  const expectedEnd = box.x + layout.parts[2].originX - 0.13;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(path.commands[0].x - expectedStart) < 0.01, `expected exponent brace to start at part two origin, got ${JSON.stringify(path.commands)}`);
  assert.ok(Math.abs(path.commands[1].x - expectedEnd) < 0.01, `expected exponent brace to end at part three origin, got ${JSON.stringify(path.commands)}`);
  assert.ok(path.commands[1].x - path.commands[0].x < box.width / 2, "expected exponent span to cover only the eight-bit field");
  assert.ok(layout.parts[1].originY < -0.1, `expected bare part anchor on the TeX baseline, got ${layout.parts[1].originY}`);
});

test("matches PGF horizontal split accumulation, separators, and global typewriter font", () => {
  const result = tikzToSvg(String.raw`
\tikzset{
  font=\tt,
  every picture/.style={thick},
  node/.style={rectangle split,rectangle split horizontal,rectangle split parts=#1,draw,
    rectangle split empty part width=1.5,rectangle split part fill={white}}
}
\begin{tikzpicture}
  \node[node=5] (a) {\nodepart{one}\nodepart{two}7\nodepart{three}\nodepart{four}11\nodepart{five}};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "a");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const widthPt = box.width * 28.4527559;
  const heightPt = box.height * 28.4527559;

  assert.deepEqual(result.diagnostics, []);
  // dvisvgm's 69.449bp native extent is 69.709 TeX pt before bp conversion.
  assert.ok(widthPt >= 69.65 && widthPt <= 69.75, `expected native split width near 69.71 TeX pt, got ${widthPt}pt`);
  assert.ok(heightPt >= 13.0 && heightPt <= 13.15, `expected native split height near 13.05 TeX pt, got ${heightPt}pt`);
  const oneDigitPartPt = box.partWidths[1] * 28.4527559;
  assert.ok(oneDigitPartPt >= 11.88 && oneDigitPartPt <= 11.96, `expected a cmtt10 digit plus native split padding near 11.92pt, got ${oneDigitPartPt}pt`);
  assert.ok(box.separatorWidth > 0, `expected thick split separators, got ${JSON.stringify(box)}`);
  assert.ok(labels.every((item) => /Typewriter|mono/i.test(item.style.fontFamily)), `expected global \\tt font, got ${JSON.stringify(labels)}`);
  assert.match(result.svg, /class="tikz-rectangle-split"/);
});

test("uses cmtt10 advances for a wide horizontal rectangle split", () => {
  const result = tikzToSvg(String.raw`
\tikzset{font=\tt,every picture/.style={thick},node/.style={rectangle split,rectangle split horizontal,rectangle split parts=#1,draw,
  rectangle split empty part width=1.5,rectangle split part fill={orange!50,blue!50,white}}}
\begin{tikzpicture}
  \node[node=13] (A) {
    \nodepart{one}\tiny False
    \nodepart{two}5
    \nodepart{three}
    \nodepart{four}-3
    \nodepart{five}
    \nodepart{six}0
    \nodepart{seven}
    \nodepart{eight}4
    \nodepart{nine}
    \nodepart{ten}17
    \nodepart{eleven}
    \nodepart{twelve}42
    \nodepart{thirteen}
  };
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "A");
  const layout = box.shapeData.rectangleSplit;
  const widthPt = box.width * 28.4527559;
  const partOriginsPt = layout.parts.map((part) => part.originX * 28.4527559);

  assert.deepEqual(result.diagnostics, []);
  // Local PGF 3.1.10 reports a 192.42pt outer-anchor span. The scene node
  // excludes the default 0.4pt outer separation on both sides, leaving its
  // 191.47pt drawing box. A digit-to-empty advance is 12.716pt.
  assert.ok(widthPt >= 191.4 && widthPt <= 191.55, `expected wide split drawing width near 191.47pt, got ${widthPt}pt`);
  assert.ok(Math.abs((partOriginsPt[2] - partOriginsPt[1]) - 12.716) < 0.08, JSON.stringify(partOriginsPt));
  assert.ok(Math.abs((partOriginsPt[3] - partOriginsPt[2]) - 13.271) < 0.08, JSON.stringify(partOriginsPt));
});

test("preserves the inline TeX box spacing around nested tikz nodes", () => {
  const result = tikzToSvg(String.raw`
\tikzset{font=\tt,every picture/.style={thick},node/.style={rectangle split,rectangle split horizontal,rectangle split parts=#1,draw,
  rectangle split empty part width=1.5}}
\begin{tikzpicture}
  \node[draw,fill=yellow] at (3,3) {\tikz \node[node=5] (A)
    {\nodepart{one}\nodepart{two}7\nodepart{three}\nodepart{four}11\nodepart{five}};};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const inner = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "A");
  const outer = result.ir.items.find((item) => item.type === "nodeBox" && item.id !== "A");
  const xShiftPt = (outer.x - inner.x) * 28.4527559;
  const horizontalPaddingPt = (outer.width - inner.width) * 28.4527559;
  const verticalPaddingPt = (outer.height - inner.height) * 28.4527559;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(xShiftPt >= 2.6 && xShiftPt <= 2.65, `expected trailing cmtt cell to shift the wrapper by half a cell, got ${xShiftPt}pt`);
  assert.ok(horizontalPaddingPt >= 12.65 && horizontalPaddingPt <= 12.8, `expected native inline box horizontal padding, got ${horizontalPaddingPt}pt`);
  assert.ok(verticalPaddingPt >= 7.4 && verticalPaddingPt <= 7.5, `expected native inline box vertical padding, got ${verticalPaddingPt}pt`);
});

test("keeps split-part anchors for an inline tikz node at the current point", () => {
  const result = tikzToSvg(String.raw`
\tikzset{node/.style={rectangle split,rectangle split horizontal,rectangle split parts=#1,draw,
  rectangle split empty part width=1.5}}
\begin{tikzpicture}
  \node[draw,fill=yellow] {
    \tikz \node[node=3] (A) {\nodepart{one}\tiny False\nodepart{two}5\nodepart{three}};
  };
  \node at ($(A.one)+(0,0.6)$) {isLeaf};
  \draw (A.one) -- (A.three);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const inner = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "A");
  const partPath = result.ir.items.find((item) => item.type === "path" && item.commands.length === 2);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(inner?.shape, "rectangleSplit");
  assert.equal(inner?.parts, 3);
  assert.ok(partPath.commands[0].x < partPath.commands[1].x, JSON.stringify(partPath.commands));
  assert.equal(result.ir.items.some((item) => item.type === "textNode" && item.text.includes("nodepart")), false);
});

test("uses the native five-point filled circle for classic star arrow starts", () => {
  const result = tikzToSvg(String.raw`
\tikzset{>=stealth,pointer/.style={*->}}
\begin{tikzpicture}
  \draw[pointer,thick] (0,0) -- (2,0);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");
  const markerWidthPt = path.style.markerStart.width / (100 / 28.4527559);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.style.markerStart.kind, "circle");
  assert.ok(markerWidthPt >= 4.95 && markerWidthPt <= 5.05, `expected PGF star width near 5pt, got ${markerWidthPt}pt`);
  assert.match(result.svg, /tikz-arrow-circle[^>]+d="M -14\.7\d+ 0 A 8\.8\d+ 8\.8\d+/);
  assert.match(result.svg, /tikz-arrow-circle[^>]+transform="translate\(4\.3\d+ 0\) rotate\(180\)"/);
});

test("optically centers rectangle split text inside each part", () => {
  const result = tikzToSvg(String.raw`
\tikzset{font=\tt,node/.style={rectangle split,rectangle split horizontal,rectangle split parts=#1,draw}}
\begin{tikzpicture}
  \node[node=5] {\nodepart{one}\nodepart{two}7\nodepart{three}\nodepart{four}11\nodepart{five}};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const labels = result.ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(labels.every((item) => item.texBoxVerticalAlign), JSON.stringify(labels));
  assert.match(result.svg, /tikz-text-engine-cache" transform="translate\([^ ]+ 2\.8\d+\)"/);
});

test("repeats the final rectangle split fill across remaining parts like PGF", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle split, rectangle split horizontal, rectangle split parts=5,
    rectangle split part fill={white}, draw] (single) {\nodepart{one}\nodepart{two}1\nodepart{three}\nodepart{four}4\nodepart{five}};
  \node[rectangle split, rectangle split horizontal, rectangle split parts=5,
    rectangle split part fill={blue,white,purple,white}, draw] (list) at (3,0) {\nodepart{one}\nodepart{two}1\nodepart{three}\nodepart{four}4\nodepart{five}};
\end{tikzpicture}`;
  const result = tikzToSvg(source);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "rectangleSplit");

  assert.deepEqual(boxes[0]?.partFills, ["white", "white", "white", "white", "white"]);
  assert.deepEqual(boxes[1]?.partFills, ["blue", "white", "purple", "white", "white"]);
});

test("renders rectangle split part fills with TikZ xcolor named colors", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[rectangle split,rectangle split horizontal,rectangle split parts=3,
    rectangle split part fill={green,purple,blue},draw]
    {1\nodepart{two}2\nodepart{three}3};
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /class="tikz-split-part"[^>]+fill="rgb\(0 255 0\)"/);
  assert.match(result.svg, /class="tikz-split-part"[^>]+fill="rgb\(191 0 64\)"/);
  assert.match(result.svg, /class="tikz-split-part"[^>]+fill="blue"/);
});

test("evaluates calc let point components independently for each path", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{calc}
\begin{tikzpicture}
  \coordinate (A) at (1,2);
  \coordinate (B) at (3,4);
  \coordinate (C) at (5,6);
  \draw let \p1=(A), \p2=(B) in (\x1,\y2) -- (0,0);
  \draw let \p1=(C), \p2=(C) in (\x1,\y2) -- (0,0);
\end{tikzpicture}`);
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths[0].commands[0], { type: "moveTo", x: 1, y: 4 });
  assert.deepEqual(paths[1].commands[0], { type: "moveTo", x: 5, y: 6 });
});

test("expands calc let numbers inside node names and brunnian scaled anchors", () => {
  const result = tikzToSvg(String.raw`
\tikzset{every node/.style={knot crossing,inner sep=1.5pt}}
\begin{tikzpicture}
  \node (k0) at (0,-1) {};
  \node (k1) at (1,0) {};
  \draw let
    \n0=0,
    \n1={int(Mod(0+1,3))} in
    (k\n0) .. controls (k\n0.16 south east) and (k\n1.4 north west) .. (k\n1.center);
\end{tikzpicture}`);
  const path = result.ir.items.find((item) => item.type === "path");
  const curve = path?.commands.find((command) => command.type === "curveTo");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(path?.commands[0].x > 0, JSON.stringify(path?.commands[0]));
  assert.ok(path?.commands[0].y < -1, JSON.stringify(path?.commands[0]));
  assert.ok(curve?.x1 > 0.8, JSON.stringify(curve));
  assert.ok(curve?.y1 < -1.8, JSON.stringify(curve));
  assert.ok(curve?.x2 < 1, JSON.stringify(curve));
  assert.deepEqual({ x: curve?.x, y: curve?.y }, { x: 1, y: 0 });
});

test("clips explicit cubic curves at bare node borders while preserving center anchors", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[circle,draw,minimum size=20pt,inner sep=0pt] (a) at (0,0) {};
  \node[circle,draw,minimum size=20pt,inner sep=0pt] (b) at (2,0) {};
  \draw (a) .. controls (0.5,1) and (1.5,1) .. (b);
  \draw (a.center) .. controls (0.5,-1) and (1.5,-1) .. (b.center);
\end{tikzpicture}`);
  const paths = result.ir.items.filter((item) => item.type === "path" && item.style?.stroke !== "none");
  const clipped = paths.at(-2)?.commands;
  const centered = paths.at(-1)?.commands;

  assert.deepEqual(result.diagnostics, []);
  assert.ok(clipped[0].x > 0, JSON.stringify(clipped));
  assert.ok(clipped[0].y > 0, JSON.stringify(clipped));
  assert.ok(clipped.at(-1).x < 2, JSON.stringify(clipped));
  assert.ok(clipped.at(-1).y > 0, JSON.stringify(clipped));
  assert.deepEqual(centered[0], { type: "moveTo", x: 0, y: 0 });
  assert.deepEqual({ x: centered.at(-1).x, y: centered.at(-1).y }, { x: 2, y: 0 });
});

test("maps ordinal nodepart selectors and minimum size in horizontal rectangle splits", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[rectangle split,rectangle split horizontal,rectangle split parts=3,
    minimum size=18pt,inner sep=5pt,draw] (A) {\nodepart{second}12};
  \draw (A.one) -- (A.three);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const box = result.ir.items.find((item) => item.type === "nodeBox");
  const label = result.ir.items.find((item) => item.type === "textNode");
  const partAnchorPath = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(label.text, "12");
  expectClose(label.x, box.x);
  assert.ok(box.partWidths[1] > box.partWidths[0], JSON.stringify(box.partWidths));
  assert.ok(box.partWidths[1] > box.partWidths[2], JSON.stringify(box.partWidths));
  assert.ok(box.height >= parseDimension("18pt") - 1e-9, `expected 18pt minimum height, got ${box.height}cm`);
  assert.ok(partAnchorPath.commands[0].y < 0, JSON.stringify(partAnchorPath.commands));
  expectClose(partAnchorPath.commands[0].y, partAnchorPath.commands[1].y);
});

test("treats unitless node xshift and yshift values as TeX points", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node (origin) at (0,0) {};
  \node[xshift=28.4527559, yshift=-28.4527559] (shifted) at (origin) {x};
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(result.ir.coordinates.shifted.x - 1) < 1e-6, JSON.stringify(result.ir.coordinates.shifted));
  assert.ok(Math.abs(result.ir.coordinates.shifted.y + 1) < 1e-6, JSON.stringify(result.ir.coordinates.shifted));
});

test("positions bare coordinate statements with positioning library syntax", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (a) at (0,0);
  \coordinate[right=30mm of a] (b);
  \coordinate[right=20mm of b] (c);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.coordinates.a.x, 0);
  assert.equal(ir.coordinates.a.y, 0);
  assert.ok(Math.abs(ir.coordinates.b.x - 3) < 1e-6, `expected b at 3cm, got ${JSON.stringify(ir.coordinates.b)}`);
  assert.ok(Math.abs(ir.coordinates.c.x - 5) < 1e-6, `expected c at 5cm, got ${JSON.stringify(ir.coordinates.c)}`);
  assert.equal(ir.coordinates.b.y, 0);
  assert.equal(ir.coordinates.c.y, 0);
});

test("keeps coordinates after standalone text spacing commands", () => {
  const source = String.raw`
\begin{tikzpicture}
  \linespread{0.8}
  \coordinate (a) at (0,0);
  \coordinate[right=30mm of a] (b);
  \draw (a) -- (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.coordinates.a, { x: 0, y: 0 });
  assert.ok(Math.abs(ir.coordinates.b.x - 3) < 1e-6, `expected b at 3cm, got ${JSON.stringify(ir.coordinates.b)}`);
  const path = ir.items.find((item) => item.type === "path");
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 3, y: 0 }
  ]);
});

test("expands parameterized styles inside coordinate option prefixes", () => {
  const source = String.raw`
\begin{tikzpicture}[ys/.style={yshift=#1}]
  \coordinate (a) at (0,0);
  \draw ([ys=10mm] a) -- (a);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 1 },
    { type: "lineTo", x: 0, y: 0 }
  ]);
});

test("expands single-argument TikZ styles into node options", () => {
  const source = String.raw`
\begin{tikzpicture}
  \tikzset{atom/.style={circle, shading=ball, ball color=#1, minimum size=15pt}}
  \node[atom=blue] (a) at (0,0) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "a");

  assert.deepEqual(diagnostics, []);
  assert.equal(box?.shape, "circle");
  assert.equal(box?.style.ballColor, "blue");
  assert.ok(box.width > 0.5 && box.width < 0.6, `expected 15pt atom node, got ${JSON.stringify(box)}`);
});

test("uses color option as the current fill color on fill paths", () => {
  const source = String.raw`
\begin{tikzpicture}
  \fill[color=green,opacity=0.2] (0,0) -- (1,0) -- (0,1) -- cycle;
  \fill[color=blue] (2,0) -- (3,0) -- (2,1) -- cycle;
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(paths[0].style.fill, "green");
  assert.equal(paths[0].style.stroke, "none");
  assert.equal(paths[0].style.opacity, 0.2);
  assert.equal(paths[1].style.fill, "blue");
  assert.equal(paths[1].style.stroke, "none");
});

test("uses the current TikZ color for bare draw fills regardless of option order", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[fill,color=white] (0,0) -- (1,0) -- (0,1) -- cycle;
  \draw[color=red,fill] (2,0) -- (3,0) -- (2,1) -- cycle;
  \draw[fill=blue,color=white] (4,0) -- (5,0) -- (4,1) -- cycle;
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(paths.map((path) => path.style.stroke), ["white", "red", "white"]);
  assert.deepEqual(paths.map((path) => path.style.fill), ["white", "red", "blue"]);
});

test("maps TikZ dash pattern presets into SVG dash arrays", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[dotted] (0,0) -- (1,0);
  \draw[densely dotted, thick] (0,1) -- (1,1);
  \draw[thick, densely dotted] (0,2) -- (1,2);
  \draw[loosely dashed] (0,3) -- (1,3);
  \draw[dash dot] (0,4) -- (1,4);
  \draw[dash pattern=on 2pt off 1pt on 0.5pt off 1pt] (0,5) -- (1,5);
  \draw[dotted, very thick] (0,6) -- (1,6);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const dashArrays = ir.items.map((item) => item.style.dashArray);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(dashArrays, [
    [TIKZ_LINE_WIDTHS.default, lineWidthFromTikzDimension("2pt")],
    [TIKZ_LINE_WIDTHS.thick, lineWidthFromTikzDimension("1pt")],
    [TIKZ_LINE_WIDTHS.thick, lineWidthFromTikzDimension("1pt")],
    [lineWidthFromTikzDimension("3pt"), lineWidthFromTikzDimension("6pt")],
    [
      lineWidthFromTikzDimension("3pt"),
      lineWidthFromTikzDimension("2pt"),
      TIKZ_LINE_WIDTHS.default,
      lineWidthFromTikzDimension("2pt")
    ],
    [
      lineWidthFromTikzDimension("2pt"),
      lineWidthFromTikzDimension("1pt"),
      lineWidthFromTikzDimension("0.5pt"),
      lineWidthFromTikzDimension("1pt")
    ],
    [TIKZ_LINE_WIDTHS.veryThick, lineWidthFromTikzDimension("2pt")]
  ]);
  assert.equal(ir.items[1].style.lineWidth, TIKZ_LINE_WIDTHS.thick);
});

test("names paths and materializes intersections as coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}
  \path[name path=h] (0,0) -- (2,0);
  \path[name path=v] (1,-1) -- (1,1);
  \path[name intersections={of=h and v, by=I}];
  \draw (I) circle (0.1);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(ir.coordinates.I, { x: 1, y: 0 });
  const circle = ir.items.find((item) => item.shape === "circle");
  assert.equal(circle.cx, 1);
  assert.equal(circle.cy, 0);
  assert.equal(circle.r, 0.1);
});

test("treats name path global as a named path for intersections", () => {
  const { ir, diagnostics } = tikzToSvg(String.raw`
\begin{tikzpicture}
  \path[name path global=h] (0,0) -- (2,0);
  \path[name path global=v] (1,-1) -- (1,1);
  \path[name intersections={of=h and v, name=i}];
\end{tikzpicture}`);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.coordinates["i-1"], { x: 1, y: 0 });
});

test("sorts named path intersections by either source path and strips alias options", () => {
  const source = String.raw`
\begin{tikzpicture}
  \path[name path=descending] (2,0) -- (-2,0);
  \path[name path=route] (-1,-1) -- (-1,1) -- (1,1) -- (1,-1);
  \path[name intersections={of=descending and route, sort by=route,
    by={[label=below:left]left,[label=below:right]right}}];
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.coordinates.left, { x: -1, y: 0 });
  assert.deepEqual(ir.coordinates.right, { x: 1, y: 0 });
});

test("materializes labels embedded in named intersection aliases", () => {
  const source = String.raw`
\begin{tikzpicture}
  \path[name path=h] (-1,0) -- (1,0);
  \path[name path=v] (0,-1) -- (0,1);
  \path[name intersections={of=h and v, by={[label=above:C]C}}];
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.coordinates.C, { x: 0, y: 0 });
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "C");
  assert.ok(label, "expected the by-alias label to become a text node");
  assert.ok(label.y > 0, `expected C label above the intersection, got ${label?.x},${label?.y}`);
});

test("materializes shaped nodes embedded in named intersection aliases", () => {
  const source = String.raw`
\tikzset{intersection mark/.style={circle,draw=purple,fill=yellow!50,minimum size=7pt,label=above:$C$}}
\begin{tikzpicture}
  \path[name path=h] (-1,0) -- (1,0);
  \path[name path=v] (0,-1) -- (0,1);
  \path[name intersections={of=h and v,
    by={[intersection mark]C}}];
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.coordinates.C, { x: 0, y: 0 });
  const marker = ir.items.find((item) => item.type === "nodeBox" && item.id === "C");
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "$C$");
  assert.ok(marker, "expected the by-alias coordinate style to create a node box");
  assert.equal(marker.shape, "circle");
  assert.ok(label && label.y > marker.y, "expected the alias label above the styled marker");
});

test("interprets spy outlines with connected magnified path content", () => {
  const source = String.raw`
\begin{tikzpicture}[spy using outlines={circle, magnification=8, size=2cm, connect spies}]
  \draw[red] (2.9,0) -- (2.9,4);
  \draw[help lines] (0,0) grid (4,4);
  \draw (0,0) -- (3,3) -- (3,0);
  \spy [black] on (3,3) in node [left] at (6,5.5);
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(parsed.ast);
  const sourceOutline = ir.items.find((item) => item.subtype === "spy-on");
  const lensOutline = ir.items.find((item) => item.subtype === "spy-in");
  const connection = ir.items.find((item) => item.subtype === "spy-connection");
  const magnified = ir.items.filter((item) => item.subtype === "spy-magnified");

  assert.deepEqual([...parsed.diagnostics, ...diagnostics], []);
  assert.ok(sourceOutline, "expected source spy outline");
  assert.ok(lensOutline, "expected target spy lens outline");
  assert.ok(connection, "expected spy connection path");
  assert.ok(magnified.length >= 2, "expected clipped magnified path content in the lens");
  assert.equal(sourceOutline.shape, "circle");
  assert.equal(lensOutline.shape, "circle");
  assert.ok(Math.abs(sourceOutline.r - 0.125) < 1e-6, `unexpected source outline radius ${sourceOutline.r}`);
  assert.ok(Math.abs(lensOutline.r - 1) < 1e-6, `unexpected lens radius ${lensOutline.r}`);
  assert.ok(Math.abs(lensOutline.cx - 5) < 1e-6, `expected left-anchored lens center x=5, got ${lensOutline.cx}`);
  assert.ok(Math.abs(lensOutline.cy - 5.5) < 1e-6, `expected lens center y=5.5, got ${lensOutline.cy}`);
});

test("preserves ball shading on path circle and ellipse shapes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[shading=ball,ball color=yellow] (0,0) circle [radius=2];
  \draw[shading=ball,ball color=black] (1,0) ellipse [x radius=0.2, y radius=0.4];
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const circle = ir.items.find((item) => item.type === "path" && item.shape === "circle");
  const ellipse = ir.items.find((item) => item.type === "path" && item.shape === "ellipse");

  assert.deepEqual(diagnostics, []);
  assert.equal(circle.style.shading, "ball");
  assert.equal(circle.style.ballColor, "yellow");
  assert.equal(circle.style.fill, "yellow");
  assert.equal(ellipse.style.shading, "ball");
  assert.equal(ellipse.style.ballColor, "black");
  assert.equal(ellipse.style.fill, "black");
});

test("uses declared radial shadings on shaped nodes", () => {
  const source = String.raw`
\documentclass{standalone}
\usepackage{tikz}
\usetikzlibrary{shadings}
\pgfdeclareradialshading{atomshade}{\pgfpoint{0cm}{0cm}}{
  color(0cm)=(pgftransparent!0);
  color(0.5cm)=(pgftransparent!40);
  color(1cm)=(pgftransparent!100)
}
\begin{document}
\begin{tikzpicture}
  \node[circle, shading=atomshade, minimum size=1cm] at (0,0) {};
\end{tikzpicture}
\end{document}`;

  const parsed = parseTikz(source);
  const interpreted = interpretTikz(parsed.ast);
  const node = interpreted.ir.items.find((item) => item.type === "nodeBox" && item.shape === "circle");

  assert.deepEqual([...parsed.diagnostics, ...interpreted.diagnostics], []);
  assert.equal(node.style.shading, "radial");
  assert.equal(node.style.shadingName, "atomshade");
  assert.equal(node.style.radialStops.length, 3);
  assert.equal(node.style.radialStops[0].opacity, 0);
  assert.equal(node.style.radialStops[2].opacity, 1);
});

test("keeps axial path fading semantics on filled paths", () => {
  const source = String.raw`
\begin{tikzpicture}
  \fill[fill=blue, path fading=west] (0,0) rectangle (2,0.2);
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const interpreted = interpretTikz(parsed.ast);
  const path = interpreted.ir.items.find((item) => item.type === "path");

  assert.deepEqual([...parsed.diagnostics, ...interpreted.diagnostics], []);
  assert.equal(path.style.fill, "blue");
  assert.equal(path.style.pathFading, "west");
});

test("resolves xcolor colorlet aliases before path style normalization", () => {
  const source = String.raw`
\usepackage{xcolor}
\colorlet{mewnol}{blue!75!cyan}
\begin{tikzpicture}
  \fill[fill=mewnol, path fading=west] (0,0) rectangle (2,0.2);
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const interpreted = interpretTikz(parsed.ast);
  const path = interpreted.ir.items.find((item) => item.type === "path");

  assert.deepEqual([...parsed.diagnostics, ...interpreted.diagnostics], []);
  assert.equal(path.style.fill, "rgb(0 64 255)");
  assert.equal(path.style.pathFading, "west");
});

test("parses TeX empty-group macro terminators inside dimensions", () => {
  const source = String.raw`
\begin{tikzpicture}
  \def\r{3}
  \draw[dashed] (0,0) ellipse (\r{} and \r/3);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const ellipse = ir.items.find((item) => item.type === "path" && item.shape === "ellipse");
  const start = ellipse?.commands.find((command) => command.type === "moveTo");

  assert.deepEqual(diagnostics, []);
  assert.ok(start);
  assert.ok(Math.abs(start.x - 3) < 1e-6, `expected ellipse x radius from \\r{} to be 3, got ${start.x}`);
});

test("renders TikZ angles library angle pics with quote labels", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (x) at (1,0);
  \coordinate (o) at (0,0);
  \coordinate (y) at (0,1);
  \pic [draw=gray, text=gray, ->, "$\theta$", angle eccentricity=1.4] {angle = x--o--y};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const angle = ir.items.find((item) => item.type === "path" && item.subtype === "angle-pic");
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "$\\theta$");

  assert.deepEqual(diagnostics, []);
  assert.ok(angle, "expected angle pic path");
  assert.equal(angle.style.stroke, "gray");
  assert.ok(angle.style.markerEnd, "expected -> on angle pic");
  assert.ok(label, "expected angle quote label");
  assert.equal(label.style.fill, "gray");
  assert.ok(label.x > 0.35 && label.y > 0.35, `expected label on angle bisector, got ${label?.x},${label?.y}`);
});

test("uses PGF counterclockwise sweeps for reflex angle pics and renders right angle pics", () => {
  const source = String.raw`
\usetikzlibrary{angles,quotes}
\begin{tikzpicture}[angle radius=8mm]
  \coordinate (right) at (1,0);
  \coordinate (up) at (0,1);
  \coordinate (origin) at (0,0);
  \pic[draw=blue, fill=blue!20, "$90^\circ$"] {right angle=right--origin--up};
  \pic[draw=red, fill=red!20, "$270^\circ$", angle eccentricity=1.3] {angle=up--origin--right};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const pics = ir.items.filter((item) => item.type === "path" && item.subtype === "angle-pic");
  const labels = ir.items.filter((item) => item.type === "textNode" && /circ/.test(item.text));
  const reflex = pics.find((item) => item.style.stroke === "red");
  const right = pics.find((item) => item.style.stroke === "blue");

  assert.deepEqual(diagnostics, []);
  assert.equal(pics.length, 2);
  assert.ok(right?.commands.some((command) => command.type === "lineTo"), "expected right angle square sides");
  expectClose(right?.commands[1]?.x, 0.8, 1e-6);
  assert.equal(right?.style.fill, "rgb(204 204 255)");
  assert.ok(reflex?.commands.some((command) => command.type === "curveTo"), "expected PGF-style cubic arc segments");
  assert.ok(reflex?.commands.some((command) => command.x < -0.2), "expected 270-degree reflex sector to pass through the left half-plane");
  assert.equal(reflex?.style.fill, "rgb(255 204 204)");
  assert.equal(labels.length, 2);
});

test("interprets PGF random list items and shade ball color paths", () => {
  const source = String.raw`
\pgfmathdeclarerandomlist{colors}{{red!80}{teal}}
\begin{tikzpicture}
  \pgfmathrandomitem{\randColor}{colors}
  \shade[ball color=\randColor] (0,0) circle(0.3);
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(parsed.ast);
  const circle = ir.items.find((item) => item.type === "path" && item.shape === "circle");

  assert.deepEqual([...parsed.diagnostics, ...diagnostics], []);
  assert.ok(circle);
  assert.equal(circle.style.stroke, "none");
  assert.equal(circle.style.shading, "ball");
  assert.equal(circle.style.ballColor, "rgb(255 51 51)");
  assert.equal(circle.style.fill, "rgb(255 51 51)");
});

test("does not promote circle operation fill option to draw path fill", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw circle [fill, radius=2pt] node [anchor=south] {text};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const circle = ir.items.find((item) => item.type === "path" && item.shape === "circle");

  assert.deepEqual(diagnostics, []);
  assert.equal(circle.style.stroke, "black");
  assert.equal(circle.style.fill, "none");
});

test("creates marking arrows along a decorated path", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[postaction={decorate}, decoration={markings, mark=at position 0.5 with {\arrow{>}}}] (0,0) -- (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  const marker = ir.items.find((item) => item.type === "marker");
  assert.ok(marker);
  assert.equal(marker.kind, "to");
  assert.equal(marker.x, 1);
  assert.equal(marker.y, 0);
  assert.equal(Math.round(marker.angle), 0);
});

test("uses parent path style for marking arrows on arc shapes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[-stealth, postaction=decorate,
    decoration={markings, mark=between positions 0.1 and 1 step 0.1 with {\arrow{stealth}}}]
    (0,0) arc(180:0:1) arc(-180:0:1);
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const markers = result.ir.items.filter((item) => item.type === "marker");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(markers.length > 4, `expected repeated arc markers, got ${markers.length}`);
  assert.equal(markers.every((marker) => marker.style.stroke === "black"), true);
});

test("lays out TikZ node child trees with grow and sibling distances", () => {
  const source = String.raw`
\begin{tikzpicture}[font=\tt\scriptsize, grow=up, level 1/.style={sibling distance=30mm}, level 2/.style={sibling distance=20mm}]
  \node[align=center](root){root}
    child{node{right}
      child{node{right leaf}}
      child{node{left leaf}}
    }
    child{node{left}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const edges = ir.items.filter((item) => item.type === "path" && item.subtype === "tree-edge");

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(labels, ["root", "right", "right leaf", "left leaf", "left"]);
  assert.equal(edges.length, 4);
  assert.ok(ir.items.find((item) => item.type === "textNode" && item.text === "right" && item.x > 1.4 && item.y > 1.4));
  assert.ok(ir.items.find((item) => item.type === "textNode" && item.text === "left" && item.x < -1.4 && item.y > 1.4));
  assert.ok(labels.every((label) => typeof label === "string"));
});

test("honors tree edge-from-parent options and down-grow child order", () => {
  const source = String.raw`
\begin{tikzpicture}[sibling distance=4cm, level distance=12mm]
  \node {root}
    child {node (left) {left}}
    child {node (right) {right} edge from parent [draw=none]
      child {node {deep}}
    };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const texts = ir.items.filter((item) => item.type === "textNode");
  const root = texts.find((item) => item.text === "root");
  const left = texts.find((item) => item.text === "left");
  const right = texts.find((item) => item.text === "right");
  const deep = texts.find((item) => item.text === "deep");
  const visibleEdges = ir.items.filter((item) => item.type === "path" && item.subtype === "tree-edge" && item.style?.stroke !== "none");

  assert.deepEqual(diagnostics, []);
  assert.ok(left.x < root.x, `expected first down-grow child on the left, got left=${left.x}, root=${root.x}`);
  assert.ok(right.x > root.x, `expected second down-grow child on the right, got right=${right.x}, root=${root.x}`);
  assert.ok(deep.y < right.y, `expected nested child below parent, got deep=${deep.y}, right=${right.y}`);
  assert.equal(visibleEdges.length, 2, "expected the draw=none parent edge to be hidden");
});

test("matches native TikZ defaults for the evaluation tree fixture", () => {
  const source = String.raw`
\tikzstyle{vertex}=[draw,fill=black!15,circle,minimum size=20pt,inner sep=0pt]
\begin{tikzpicture}
  \node[vertex] {+}
    child {
      node[vertex] {+}
      child {
        node[vertex] {+}
        child { node[vertex] {i} }
        child { node[vertex] {++i} }
      }
      child { node[vertex] {i++} }
    }
    child { node[vertex] {++i} };
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const nodes = result.ir.items.filter((item) => item.type === "nodeBox");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const edges = result.ir.items.filter((item) => item.type === "path" && item.subtype === "tree-edge");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(nodes.length, 7);
  assert.equal(edges.length, 6);
  assert.deepEqual(labels.map((item) => item.text), ["+", "+", "+", "i", "++i", "i++", "++i"]);
  assert.deepEqual(nodes.map(({ x, y }) => [x, y]), [
    [0, 0],
    [-0.75, -1.5],
    [-1.5, -3],
    [-2.25, -4.5],
    [-0.75, -4.5],
    [0, -3],
    [0.75, -1.5]
  ]);
  assert.ok(nodes.every((node) => node.shape === "circle"));
  assert.ok(nodes.every((node) => Math.abs(node.width - 20 / 28.4527559) < 1e-6));
  assert.ok(nodes.every((node) => node.style.fill === "rgb(217 217 217)"));
  assert.ok(labels.every((label, index) => label.x === nodes[index].x && label.y === nodes[index].y));
});

test("renders basic mindmap concept nodes with cyclic child placement", () => {
  const source = String.raw`
\begin{tikzpicture}[
  root concept/.append style={concept color=blue!20,minimum size=2cm},
  level 1 concept/.append style={sibling angle=45},
  mindmap
]
  \node[concept] {Root concept}
    [clockwise from=45]
    child { node[concept] (c1) {child}}
    child { node[concept] (c2) {child}}
    child { node[concept] (c3) {child}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");
  const texts = ir.items.filter((item) => item.type === "textNode");

  assert.deepEqual(diagnostics, []);
  assert.equal(boxes.length, 4);
  assert.equal(texts.length, 4);
  assert.equal(boxes.every((box) => box.shape === "circle"), true);
  assert.equal(boxes[0].style.fill, "rgb(204 204 255)");
  assert.ok(boxes[0].width >= 1.99 && boxes[0].height >= 1.99);
  assert.ok(texts.some((item) => item.text === "child" && item.x > 3 && item.y > 1.5));
  assert.ok(texts.some((item) => item.text === "child" && item.x > 4.5 && Math.abs(item.y) < 0.2));
  assert.ok(texts.some((item) => item.text === "child" && item.x > 3 && item.y < -1.5));
});

test("uses monospace text metrics when clipping TikZ child tree edges", () => {
  const source = String.raw`
\begin{tikzpicture}[font=\tt\scriptsize, grow=up, level 1/.style={sibling distance=30mm}]
  \node[align=center](root){AC{-}{-}A\\CC{-}{-}A\\ACG-A\\A-GTA\\A-G-A}
    child{node{AGTA\\AG-A}}
    child{node{ACGA}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edge = ir.items.find((item) => item.type === "path" && item.subtype === "tree-edge");

  assert.deepEqual(diagnostics, []);
  assert.ok(edge.commands[0].x > 0.4, `expected tree edge to start outside the monospace root text, got ${edge.commands[0].x}`);
  assert.ok(edge.commands[1].x < 1.2, `expected tree edge to stop before the monospace child text, got ${edge.commands[1].x}`);
});

test("inherits tikzpicture path thickness on generated child tree edges", () => {
  const source = String.raw`
\begin{tikzpicture}[very thick]
  \node {root} child { node {child} };
  \draw (0,0) -- (1,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const treeEdge = ir.items.find((item) => item.type === "path" && item.subtype === "tree-edge");
  const drawnEdge = ir.items.find((item) => item.type === "path" && item.subtype !== "tree-edge");

  assert.deepEqual(diagnostics, []);
  assert.ok(treeEdge && drawnEdge);
  assert.equal(treeEdge.style.lineWidth, drawnEdge.style.lineWidth);
});

test("supports coordinate-system projection, path rotation, midway labels, and node labels", () => {
  const source = String.raw`
\definecolor{olivegreen}{rgb}{0,0.6,0}
\begin{tikzpicture}
  \draw[ultra thick,red] (0,0) -- (60:2.5cm |- 0,0) node[midway,below] {$x$};
  \draw (1,0) arc (0:60:1) node at ($(60/2:0.7)$) {$\alpha$};
  \draw[ultra thick, blue] (60:2.5cm) -- (60:2.5cm |- 0,0) node[midway,right] {$y$};
  \draw[ultra thick,olivegreen,rotate=60] (0,0) -- node[midway,left] {$r$} (2.5,0) coordinate (B);
  \draw[xshift=-1cm] (B) node[circle,fill,inner sep=1pt,label=above:$P$](e){};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const xProjectionLabel = ir.items.find((item) => item.type === "textNode" && item.text === "$x$" && item.x < 1);
  const rLabel = ir.items.find((item) => item.type === "textNode" && item.text.includes("$r$"));
  const yLabel = ir.items.find((item) => item.type === "textNode" && item.text.includes("$y$"));
  const pLabel = ir.items.find((item) => item.type === "textNode" && item.text.includes("$P$"));
  const arc = ir.items.find((item) => item.type === "path" && item.shape === "arc");
  const rotated = ir.items.find((item) => item.type === "path" && item.style.stroke === "rgb(0 153 0)");

  assert.equal(diagnostics.length, 0);
  assert.ok(Math.abs(ir.coordinates.B.x - 1.25) < 0.02, `expected rotated B.x around 1.25, got ${ir.coordinates.B?.x}`);
  assert.ok(Math.abs(ir.coordinates.B.y - 2.165) < 0.02, `expected rotated B.y around 2.165, got ${ir.coordinates.B?.y}`);
  assert.ok(arc);
  assert.ok(arc.commands.some((command) => command.type === "curveTo"), `expected angle arc to draw cubic curves, got ${JSON.stringify(arc.commands)}`);
  assert.equal(xProjectionLabel.style.fill, "red");
  assert.equal(yLabel.style.fill, "blue");
  assert.equal(rLabel.style.fill, "rgb(0 153 0)");
  assert.ok(rLabel.x > 0.3 && rLabel.x < 0.9, `expected midway r label near rotated segment, got ${rLabel?.x}`);
  assert.ok(rLabel.y > 0.8 && rLabel.y < 1.4, `expected midway r label near rotated segment, got ${rLabel?.y}`);
  assert.ok(yLabel.x > 1.3 && yLabel.y > 0.8 && yLabel.y < 1.4, `expected y label midway on vertical projection, got ${yLabel?.x},${yLabel?.y}`);
  assert.ok(Math.abs(ir.coordinates.e.x - ir.coordinates.B.x) < 1e-6, `expected P marker to stay on B.x, got ${ir.coordinates.e?.x}`);
  assert.ok(Math.abs(ir.coordinates.e.y - ir.coordinates.B.y) < 1e-6, `expected P marker to stay on B.y, got ${ir.coordinates.e?.y}`);
  assert.ok(pLabel && Math.abs(pLabel.x - ir.coordinates.B.x) < 1e-6 && pLabel.y > 2.1, `expected label=above:$P$ above B, got ${pLabel?.x},${pLabel?.y}`);
  assert.equal(rotated.commands.at(-1).type, "lineTo");
  assert.ok(Math.abs(rotated.commands.at(-1).x - 1.25) < 0.0001);
  assert.ok(Math.abs(rotated.commands.at(-1).y - 2.16506) < 0.0001);
});

test("places TikZ labels outside the target node box", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=0.85]
  \draw[ultra thick,rotate=60] (0,0) -- (2.5,0) coordinate (B);
  \draw[xshift=-1cm] (B) node[circle,fill,inner sep=1pt,label=above:$P$](e){};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const marker = ir.coordinates.e;
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "$P$");

  assert.deepEqual(diagnostics, []);
  assert.ok(marker, "expected named marker coordinate");
  assert.ok(label, "expected label=above:$P$ text");
  assert.ok(Math.abs(label.x - marker.x) < 1e-6, `expected P label centered above marker, got ${label.x},${marker.x}`);
  assert.ok(label.y - marker.y > 0.34, `expected P label center to clear marker box, got gap ${label.y - marker.y}`);
});

test("supports compact elliptical arc radii with negative x radius", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[dashed] (2.6,0) arc (-90:90:-0.5 and 1.5);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const arc = ir.items.find((item) => item.type === "path" && item.shape === "arc");
  const curvePoints = arc.commands
    .filter((command) => command.type === "curveTo")
    .flatMap((command) => [
      { x: command.x1, y: command.y1 },
      { x: command.x2, y: command.y2 },
      { x: command.x, y: command.y }
    ]);
  const xs = curvePoints.map((point) => point.x);
  const ys = curvePoints.map((point) => point.y);

  assert.deepEqual(diagnostics, []);
  assert.ok(arc, "expected compact elliptical arc to produce an arc path");
  assert.ok(Math.min(...xs) < 2.15, `expected negative x radius to bow left, got x values ${xs.join(",")}`);
  assert.ok(Math.max(...ys) > 2.95, `expected arc to reach top y near 3, got y values ${ys.join(",")}`);
});

test("supports macro-expanded dimension expressions in polar coordinates and arc radii", () => {
  const source = String.raw`
\begin{tikzpicture}
  \newcommand\R{1.3cm}
  \draw[fill=green!15] (0,0) -- (170:{\R*0.3}) arc (170:45:{{(\R)*0.3}});
\end{tikzpicture}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const arc = result.ir.items.find((item) => item.type === "path" && item.shape === "arc");
  const arcPoints = arc?.commands?.filter((command) => command.type === "lineTo") || [];
  const radialEnd = arcPoints[0];

  assert.deepEqual(result.diagnostics, []);
  assert.ok(arc, "expected macro dimension expression to produce a continuous arc path");
  assert.ok(radialEnd && Math.hypot(radialEnd.x, radialEnd.y) > 0.35, `expected polar radius near 0.39cm, got ${JSON.stringify(radialEnd)}`);
  assert.ok(arcPoints.some((point) => Math.hypot(point.x, point.y) > 0.35), `expected nonzero arc points, got ${JSON.stringify(arcPoints)}`);
});

test("supports TikZ orthogonal path operators with inline labels", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle,fill,inner sep=0,minimum size=0.2cm] (start) at (0,0) {};
  \node (target) at (1,1) {};
  \draw (start) |- node[pos=0.2,right] {START} (target);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "START");

  assert.equal(diagnostics.length, 0);
  assert.equal(path.commands.length, 3);
  expectClose(path.commands[0].x, 0);
  expectClose(path.commands[0].y, 0.1 + parseDimension("0.2pt"));
  assert.deepEqual(path.commands[1], { type: "lineTo", x: 0, y: 1 });
  assert.equal(path.commands[2].type, "lineTo");
  assert.ok(path.commands[2].x > 0.84 && path.commands[2].x < 1, `expected final segment to stop at target node border, got ${path.commands[2].x}`);
  assert.equal(path.commands[2].y, 1);
  assert.ok(label);
  assert.ok(label.x > 0.4 && label.x < 0.5 && label.y > 0.44 && label.y < 0.49, `expected pos=.2 to map to 40% of the first orthogonal leg, got ${label?.x},${label?.y}`);
});

test("uses the second orthogonal leg tangent at the default inline-node position", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[->,thick] (0,-1) |- node[sloped,above=0.19cm,right=0.3cm] {rate $b$} (2,-2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "rate $b$");

  assert.deepEqual(diagnostics, []);
  assert.ok(label);
  assert.equal(label.rotation ?? 0, 0);
  assert.ok(label.x > 0.65 && label.x < 1.05, `expected the cumulative right shift and west anchor after the elbow, got ${label.x}`);
  assert.ok(label.y > -1.84 && label.y < -1.78, `expected the earlier above shift to remain active, got ${label.y}`);
});

test("approximates snake path morphing on decorated straight segments", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[decorate, decoration={snake, segment length=2mm, amplitude=0.3mm}] (0,0) -- (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.equal(diagnostics.length, 0);
  assert.ok(path.commands.length > 4, `expected snake to add intermediate commands, got ${path.commands.length}`);
  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: 0 });
  const last = path.commands.at(-1);
  assert.ok(last.type === "curveTo" || last.type === "lineTo");
  assert.equal(last.x, 2);
  assert.equal(last.y, 0);
  assert.ok(
    path.commands.some(
      (command) =>
        command.type === "lineTo" && Math.abs(command.y) > 0.001 ||
        command.type === "curveTo" && (Math.abs(command.y) > 0.001 || Math.abs(command.y1) > 0.001 || Math.abs(command.y2) > 0.001),
    ),
  );
  assert.ok(path.commands.some((command) => command.type === "curveTo"), "expected snake decoration to use smooth cubic segments like native PGF");
});

test("matches PGF snake fixed startup and cosine/sine control points", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[decorate, decoration={snake, segment length=2mm, amplitude=0.4mm}] (0,0) -- (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const [move, startup, cosine, sine] = path.commands;

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(move, { type: "moveTo", x: 0, y: 0 });
  assert.equal(startup.type, "curveTo");
  expectClose(startup.x1, 0.025);
  expectClose(startup.y1, 0);
  expectClose(startup.x2, 0.0375);
  expectClose(startup.y2, 0.04);
  expectClose(startup.x, 0.0625);
  expectClose(startup.y, 0.04);
  assert.equal(cosine.type, "curveTo");
  expectClose(cosine.x1, 0.0806);
  expectClose(cosine.y1, 0.04);
  expectClose(cosine.x2, 0.0962);
  expectClose(cosine.y2, 0.02048);
  expectClose(cosine.x, 0.1125);
  expectClose(cosine.y, 0);
  assert.equal(sine.type, "curveTo");
  expectClose(sine.x1, 0.1288);
  expectClose(sine.y1, -0.02048);
  expectClose(sine.x2, 0.1444);
  expectClose(sine.y2, -0.04);
  expectClose(sine.x, 0.1625);
  expectClose(sine.y, -0.04);
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 2, y: 0 });
});

test("recursively applies the Koch snowflake decoration to nested decorate operations", () => {
  const source = String.raw`
\usetikzlibrary{decorations.fractals}
\begin{tikzpicture}[decoration=Koch snowflake]
  \draw decorate{ decorate{ (0,0) -- (3,0) }};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(path.commands.length, 17);
  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: 0 });
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 3, y: 0 });
  assert.ok(path.commands.some((command) => command.y > 0.8), "expected the recursive Koch peaks above the source segment");
});

test("keeps snake decoration lengths independent from late arrow tip shortening", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[-stealth, thick, decorate, decoration={snake, pre length=0.01mm, segment length=2mm, amplitude=0.3mm, post length=1.5mm}] (0,0) -- (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const lastDecorated = path.commands.at(-2);
  const visiblePostLength = parseDimension("1.5mm");

  assert.deepEqual(diagnostics, []);
  assert.equal(path.commands.at(-1).type, "lineTo");
  assert.equal(path.commands.at(-1).x, 2);
  assert.ok(lastDecorated.type === "curveTo" || lastDecorated.type === "lineTo");
  expectClose(lastDecorated.x, 2 - visiblePostLength, 1e-6);
});

test("interprets smooth plot coordinate lists as continuous curves", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[-stealth] plot [smooth, tension=1] coordinates { (0,0) (1,1) (2,0) (3,1) };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(path.commands[0].type, "moveTo");
  assert.equal(path.commands[0].x, 0);
  assert.equal(path.commands[0].y, 0);
  assert.ok(path.commands.some((command) => command.type === "curveTo"), `expected smooth plot to emit curves, got ${JSON.stringify(path.commands)}`);
  assert.equal(path.commands.at(-1).type, "curveTo");
  assert.equal(path.commands.at(-1).x, 3);
  assert.equal(path.commands.at(-1).y, 1);
});

test("matches PGF smooth plot tension control points", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw plot [smooth, tension=1] coordinates { (0,0) (1,1) (2,0) (3,1) };
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const curves = path.commands.filter((command) => command.type === "curveTo");

  assert.deepEqual(diagnostics, []);
  assert.equal(curves.length, 3);
  assert.deepEqual(curves[0], { type: "curveTo", x1: 0, y1: 0, x2: 0.445, y2: 1, x: 1, y: 1 });
  assert.deepEqual(curves[1], { type: "curveTo", x1: 1.555, y1: 1, x2: 1.445, y2: 0, x: 2, y: 0 });
  assert.deepEqual(curves[2], { type: "curveTo", x1: 2.555, y1: 0, x2: 3, y2: 1, x: 3, y: 1 });
});

test("interprets TikZ sine and cosine path operators as PGF cubic curves", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) sin (2,1) cos (4,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "curveTo", x1: 0.652, y1: 0.512, x2: 1.276, y2: 1, x: 2, y: 1 },
    { type: "curveTo", x1: 2.724, y1: 1, x2: 3.348, y2: 0.512, x: 4, y: 0 }
  ]);
});

test("approximates snakes brace path replacement decorations", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[decorate, decoration={brace, mirror, raise=0.5cm}] (0,0) -- (1,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const curveCommands = path.commands.filter((command) => command.type === "curveTo");

  assert.equal(diagnostics.length, 0);
  assert.ok(curveCommands.length >= 2, `expected brace to use curved replacement path, got ${JSON.stringify(path.commands)}`);
  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: -0.5 });
  assert.equal(path.commands.at(-1).x, 1);
  assert.equal(path.commands.at(-1).y, -0.5);
  assert.ok(path.commands.some((command) => command.y < -0.55), "expected mirrored brace cusp below the raised baseline");
});

test("uses brace decoration amplitude for path replacement depth", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[decorate, decoration={brace, amplitude=3pt}] (0,0) -- (3,0);
  \draw[decorate, decoration={brace, amplitude=15pt}] (0,-1) -- (3,-1);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");
  const smallTop = Math.max(...paths[0].commands.map((command) => command.y ?? -Infinity));
  const largeTop = Math.max(...paths[1].commands.map((command) => command.y ?? -Infinity));
  const smallDepth = smallTop;
  const largeDepth = largeTop + 1;

  assert.equal(diagnostics.length, 0);
  assert.ok(largeDepth > smallDepth * 3, `expected 15pt brace to be visibly deeper than 3pt: ${smallDepth}, ${largeDepth}`);
});

test("replaces complete decorated subpaths with native-style normal ticks", () => {
  const source = String.raw`
\usetikzlibrary{decorations.pathreplacing}
\begin{tikzpicture}
  \draw[decorate,decoration={ticks,segment length=.25cm,amplitude=.1cm}]
    (0,0) -- (1,0) -- (1,1);
\end{tikzpicture}`;
  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const [firstMove, firstTick, secondMove, secondTick] = path.commands;
  const terminalTick = path.commands.at(-1);

  assert.deepEqual(diagnostics, []);
  assert.equal(path.commands.length, 16, `expected periodic ticks only at complete state origins, got ${JSON.stringify(path.commands)}`);
  assert.deepEqual(firstMove, { type: "moveTo", x: 0, y: 0.1 });
  assert.deepEqual(firstTick, { type: "lineTo", x: 0, y: -0.1 });
  assert.deepEqual(secondMove, { type: "moveTo", x: 0.25, y: 0.1 });
  assert.deepEqual(secondTick, { type: "lineTo", x: 0.25, y: -0.1 });
  assert.deepEqual(terminalTick, { type: "lineTo", x: 1.1, y: 0.75 });
});

test("replaces paths with fixed-radius and expanding wave arcs", () => {
  const source = String.raw`
\usetikzlibrary{decorations.pathreplacing}
\begin{tikzpicture}
  \draw[decorate,decoration={waves,segment length=1cm,radius=.25cm,angle=45}] (0,0) -- (4,0);
  \draw[decorate,decoration={expanding waves,segment length=1cm,angle=30}] (0,-1) -- (4,-1);
\end{tikzpicture}`;
  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const [fixed, expanding] = ir.items.filter((item) => item.type === "path");
  const fixedArcs = fixed.commands.filter((command) => command.type === "curveTo");
  const expandingArcs = expanding.commands.filter((command) => command.type === "curveTo");

  assert.deepEqual(diagnostics, []);
  assert.equal(fixedArcs.length, 4, `expected one fixed-radius arc per 1cm state, got ${JSON.stringify(fixed.commands)}`);
  assert.equal(expandingArcs.length, 4, `expected initial empty state followed by the terminal growing arc, got ${JSON.stringify(expanding.commands)}`);
  assert.equal(fixed.commands[0].type, "moveTo");
  expectClose(fixed.commands[0].x, 0.926776695297);
  expectClose(fixed.commands[0].y, 0.176776695297);
  assert.equal(expanding.commands[0].type, "moveTo");
  expectClose(expanding.commands[0].x, 0.866025403784);
  expectClose(expanding.commands[0].y, -0.5);
  assert.ok(expandingArcs.at(-1).y < -2.4, `expected the last expanding arc to grow below the source path, got ${JSON.stringify(expandingArcs.at(-1))}`);
  assert.deepEqual(fixed.commands.at(-1), { type: "moveTo", x: 4, y: 0 });
  assert.deepEqual(expanding.commands.at(-1), { type: "moveTo", x: 4, y: -1 });
});

test("renders border decoration as a red postaction over the preserved source path", () => {
  const source = String.raw`
\usetikzlibrary{decorations.pathreplacing}
\begin{tikzpicture}[decoration={border,segment length=.5cm,amplitude=.2cm,angle=90}]
  \draw[postaction={decorate,draw,red}] (0,0) -- (1,0) -- (1,1);
\end{tikzpicture}`;
  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");
  const [sourcePath, borderPath] = paths;

  assert.deepEqual(diagnostics, []);
  assert.equal(paths.length, 2);
  assert.equal(sourcePath.style.stroke, "black");
  assert.equal(borderPath.style.stroke, "red");
  assert.equal(borderPath.subtype, "postaction-decoration");
  assert.equal(borderPath.commands.length, 8);
  assert.deepEqual(borderPath.commands.slice(0, 4), [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 0, y: 0.2 },
    { type: "moveTo", x: 0.5, y: 0 },
    { type: "lineTo", x: 0.5, y: 0.2 }
  ]);
  assert.deepEqual(borderPath.commands.at(-1), { type: "lineTo", x: 0.8, y: 0.5 });
});

test("places text decorations along invisible paths", () => {
  const source = String.raw`
\begin{tikzpicture}
  \path[decorate, decoration={text along path, text={|\footnotesize\bf\color{white}|Decorated}, raise=0.2cm}]
    (0,0) -- (4,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.subtype === "decoration-text");

  assert.deepEqual(diagnostics, []);
  assert.ok(label, "expected decoration text node");
  assert.equal(label.text, String.raw`\footnotesize\bf Decorated`);
  assert.equal(label.style.fill, "white");
  assert.ok(Math.abs(label.x - 2) < 1e-6, `expected midpoint x=2, got ${label.x}`);
  assert.ok(Math.abs(label.y - 0.2) < 1e-6, `expected raised y=0.2, got ${label.y}`);
  assert.ok(Math.abs(label.rotation) < 1e-6, `expected horizontal text, got ${label.rotation}`);
});

test("retains decorations.text alignment, indents, fit options, and signed raise", () => {
  const source = String.raw`
\begin{tikzpicture}
  \path[decorate, decoration={text along path, text={fitted text},
    text align={align=right,left indent=1cm,right indent=2mm,fit to path stretching spaces},
    raise=-2pt}] (0,0) -- (6,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.subtype === "decoration-text");

  assert.deepEqual(diagnostics, []);
  assert.ok(label, "expected decoration text node");
  assert.equal(label.pathTextAlign, "right");
  assert.ok(Math.abs(label.pathLeftIndent - 1) < 1e-6, `expected 1cm left indent, got ${label.pathLeftIndent}`);
  assert.ok(Math.abs(label.pathRightIndent - 0.2) < 1e-6, `expected 2mm right indent, got ${label.pathRightIndent}`);
  assert.equal(label.pathTextFitToPath, true);
  assert.equal(label.pathTextFitToPathStretchingSpaces, true);
  assert.ok(Math.abs(label.pathRaise + 2 / 28.45274) < 1e-6, `expected negative 2pt raise, got ${label.pathRaise}`);
});

test("places text decorations declared through postaction", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[postaction={decorate,decoration={text along path,raise=0.1cm,text align=center,text={Aktion {$a_k$}}}}]
    (0,0) to[bend left] (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.subtype === "decoration-text");

  assert.deepEqual(diagnostics, []);
  assert.ok(label, "expected postaction decoration text node");
  assert.equal(label.text, String.raw`Aktion {$a_k$}`);
  assert.ok(Array.isArray(label.pathCommands), "expected decoration text to retain the decorated path");
  assert.ok(label.pathCommands.some((command) => command.type === "curveTo"), "expected curved path commands for bend-left text");
  assert.ok(label.x > 0.5 && label.x < 1.5, `expected text near path midpoint, got x=${label.x}`);
  assert.ok(label.y > 0, `expected raised text above curved path, got y=${label.y}`);
});

test("supports decorations.text effects along path with reversed character ordering", () => {
  const source = String.raw`
\begin{tikzpicture}
  \path[decorate, decoration={text effects along path,text={normal},text align=center,
    text effects/.cd,characters={text along path}}] (0,1) -- (4,1);
  \path[decorate,text effects={reverse text},decoration={text effects along path,text={normal},text align=center,
    text effects/.cd,characters={text along path}}] (0,0) -- (4,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = ir.items.filter((item) => item.type === "textNode" && item.subtype === "decoration-text");

  assert.deepEqual(diagnostics, []);
  assert.equal(labels.length, 2);
  assert.equal(labels[0].pathTextReverse, false);
  assert.equal(labels[1].pathTextReverse, true);
  assert.equal(labels[1].pathTextAlign, "center");
});

test("preserves decorations.text repeat text cycle semantics", () => {
  const source = String.raw`
\begin{tikzpicture}
  \path[decorate,decoration={text effects along path,text={AB },
    text effects/.cd,repeat text}] (0,1) -- (6,1);
  \path[decorate,decoration={text effects along path,text={WXY},
    text effects/.cd,repeat text=1}] (0,0) -- (6,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = ir.items.filter((item) => item.type === "textNode" && item.subtype === "decoration-text");

  assert.deepEqual(diagnostics, []);
  assert.equal(labels.length, 2);
  assert.equal(labels[0].text, "AB ", "an explicit terminal text space must remain a glyph box");
  assert.equal(labels[0].pathTextRepeat, -1, "bare repeat text repeats until the path ends");
  assert.equal(labels[1].pathTextRepeat, 1, "a positive value means one extra source-text copy");
});

test("preserves repeated decorations.text circle replacement mappings", () => {
  const source = String.raw`
\begin{tikzpicture}[decoration={text effects along path,
  text={010-101}, text align=center,
  text effects/.cd,
    replace characters=0 with {\fill[purple] circle[radius=2pt];},
    replace characters=1 with {\fill[orange] circle[radius=3pt];},
    replace characters=- with {\draw[blue,line width=.5pt] circle[radius=1pt];}}]
  \path[decorate] (0,0) -- (4,0);
\end{tikzpicture}`;
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const label = result.ir.items.find((item) => item.subtype === "decoration-text");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(Object.keys(label.pathTextCharacterReplacements).sort(), ["-", "0", "1"]);
  assert.equal(label.pathTextCharacterReplacements["0"].fill, "rgb(191 0 64)");
  assert.equal(label.pathTextCharacterReplacements["1"].fill, "rgb(255 128 0)");
  assert.equal(label.pathTextCharacterReplacements["-"].fill, "none");
  assert.equal(label.pathTextCharacterReplacements["-"].stroke, "blue");
  assert.equal((result.svg.match(/class="tikz-decoration-replacement"/g) || []).length, 7);
  assert.match(result.svg, /stroke-width="1\.757299/);
  assert.doesNotMatch(result.svg, />0<\/text>|>1<\/text>|>-<\/text>/);
});

test("renders general shadows as path preactions around the path bounding-box center", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shadows}
\begin{tikzpicture}[even odd rule]
  \draw[general shadow={fill=red,shadow scale=1.25,shadow xshift=2pt,shadow yshift=-1pt}]
    (0,0) circle (.5) (0.5,0) circle (.5);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.shadows.length, 1);
  assert.equal(path.shadows[0].scale, 1.25);
  expectClose(path.shadows[0].xshift, 2 / 28.4527559, 1e-12);
  expectClose(path.shadows[0].yshift, -1 / 28.4527559, 1e-12);
  assert.equal(path.shadows[0].style.fill, "red");
  assert.equal(path.shadows[0].style.stroke, "none");
  assert.match(result.svg, /class="tikz-path-shadow"/);
  assert.match(result.svg, /fill="red"/);
  assert.match(result.svg, /fill-rule="evenodd"/);
  assert.match(result.svg, /stroke="black" fill="none"/);
});

test("lowers documented drop-shadow defaults and caller opacity overrides", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shadows}
\begin{tikzpicture}
  \filldraw[drop shadow,fill=white] (0,0) circle (.5) (0.5,0) circle (.5);
  \filldraw[drop shadow={opacity=.25},fill=white] (0,1.5) circle (.5) (0.5,1.5) circle (.5);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths.length, 2);
  assert.equal(paths[0].commands.filter((command) => command.type === "closePath").length, 2);
  assert.equal(paths[1].commands.filter((command) => command.type === "closePath").length, 2);
  assert.equal(paths[0].shadows.length, 1);
  assert.equal(paths[1].shadows.length, 1);
  assert.equal(paths[0].shadows[0].scale, 1);
  expectClose(paths[0].shadows[0].xshift, 0.5 * 4.30554 / 28.4527559, 1e-12);
  expectClose(paths[0].shadows[0].yshift, -0.5 * 4.30554 / 28.4527559, 1e-12);
  assert.equal(paths[0].shadows[0].style.fill, "rgb(128 128 128)");
  expectClose(paths[0].shadows[0].style.opacity, 0.5, 1e-12);
  expectClose(paths[1].shadows[0].style.opacity, 0.25, 1e-12);
  assert.equal((result.svg.match(/class="tikz-path-shadow"/g) || []).length, 2);
});

test("runs every shadow between drop-shadow defaults and caller options", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shadows}
\begin{tikzpicture}[every shadow/.style={opacity=.8,fill=blue!50!black,shadow xshift=1pt}]
  \filldraw[drop shadow={opacity=.25},fill=white] (0,0) circle (.5);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.shadows.length, 1);
  assert.equal(path.shadows[0].style.fill, "rgb(0 0 128)");
  expectClose(path.shadows[0].style.opacity, 0.25, 1e-12);
  expectClose(path.shadows[0].xshift, 1 / 28.4527559, 1e-12);
});

test("applies drop-shadow defaults to node preactions", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shadows}
\begin{tikzpicture}
  \node[drop shadow,fill=white,draw] at (0,0) {Shadow};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const node = result.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(node.shadows.length, 1);
  assert.equal(node.shadows[0].style.fill, "rgb(128 128 128)");
  expectClose(node.shadows[0].style.opacity, 0.5, 1e-12);
  assert.match(result.svg, /class="tikz-node-shadow"/);
});

test("copies ordinary path fill and draw styles behind copy shadows", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shadows}
\begin{tikzpicture}
  \filldraw[copy shadow={opacity=.5},fill=blue!20,draw=blue,thick] (0,0) rectangle (2,1);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.shadows.length, 1);
  assert.equal(path.shadows[0].style.fill, "rgb(204 204 255)");
  assert.equal(path.shadows[0].style.stroke, "blue");
  expectClose(path.shadows[0].style.opacity, 0.5, 1e-12);
  expectClose(path.shadows[0].xshift, 0.5 * 4.30554 / 28.4527559, 1e-12);
  expectClose(path.shadows[0].yshift, 0.5 * 4.30554 / 28.4527559, 1e-12);
  assert.match(result.svg, /class="tikz-path-shadow"/);
  assert.match(result.svg, /stroke="blue" fill="rgb\(204 204 255\)"/);
});

test("copies ordinary node fill and draw styles behind copy shadows", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shadows}
\begin{tikzpicture}
  \node[copy shadow,fill=blue!20,draw=blue] at (0,0) {Copy};
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const node = result.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(node.shadows.length, 1);
  assert.equal(node.shadows[0].style.fill, "rgb(204 204 255)");
  assert.equal(node.shadows[0].style.stroke, "blue");
  assert.match(result.svg, /class="tikz-node-shadow"/);
});

test("paints the farther double-copy shadow before the nearer copy", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shadows}
\begin{tikzpicture}
  \filldraw[double copy shadow={shadow xshift=1ex,shadow yshift=1ex,opacity=.5},fill=blue!20,draw=blue]
    (0,0) rectangle (2,1);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find((item) => item.type === "path");
  const ex = 4.30554 / 28.4527559;

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.shadows.length, 2);
  expectClose(path.shadows[0].xshift, ex * 2, 1e-12);
  expectClose(path.shadows[0].yshift, ex * 2, 1e-12);
  expectClose(path.shadows[1].xshift, ex, 1e-12);
  expectClose(path.shadows[1].yshift, ex, 1e-12);
  assert.equal(path.shadows[0].style.fill, "rgb(204 204 255)");
  assert.equal(path.shadows[1].style.stroke, "blue");
  assert.equal((result.svg.match(/class="tikz-path-shadow"/g) || []).length, 2);
});

test("keeps pgfmathsetmacro inside foreach-expanded text decorations", () => {
  const source = String.raw`
\begin{tikzpicture}
  \newcommand*{\labelstyle}{\footnotesize\bf\color{black}}
  \newcommand{\makearc}[2]{
    \pgfmathsetmacro{\astart}{#1+20}
    \path[decorate, decoration={text along path, text={|\labelstyle|#2}}]
      (\astart:2) arc (\astart:\astart+20:2);
  }
  \foreach \x in {0,60,...,120} {
    \makearc{\x}{text \x}
  }
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = ir.items.filter((item) => item.type === "textNode" && item.subtype === "decoration-text");
  const centers = labels.map((label) => `${label.x.toFixed(3)},${label.y.toFixed(3)}`);

  assert.deepEqual(diagnostics, []);
  assert.equal(labels.length, 3);
  assert.deepEqual(labels.map((label) => label.text), [
    String.raw`\footnotesize\bf text 0`,
    String.raw`\footnotesize\bf text 60`,
    String.raw`\footnotesize\bf text 120`
  ]);
  assert.equal(new Set(centers).size, 3);
});

test("offsets inline node labels away from path endpoints", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[->] (0,0) -- (3,0) node[right] {$x$};
  \draw[->] (0,0) -- (0,2) node[above] {$y$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  const xLabel = ir.items.find((item) => item.type === "textNode" && item.text === "$x$");
  const yLabel = ir.items.find((item) => item.type === "textNode" && item.text === "$y$");
  assert.ok(xLabel.x > 3);
  assert.equal(xLabel.y, 0);
  assert.equal(yLabel.x, 0);
  assert.ok(yLabel.y > 2);
});

test("places inline labels between path coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) -- node[above] {$m$} (2,0);
  \draw (0,0) -- node[left] {$n$} (0,-2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const mLabel = ir.items.find((item) => item.type === "textNode" && item.text === "$m$");
  const nLabel = ir.items.find((item) => item.type === "textNode" && item.text === "$n$");

  assert.equal(diagnostics.length, 0);
  assert.equal(mLabel.x, 1);
  assert.ok(mLabel.y > 0);
  assert.ok(nLabel.x < 0);
  assert.equal(nLabel.y, -1);
});

test("inherits path-level placement options for inline nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[above] (0,0) to node {A} (2,0);
  \draw[below] (0,-1) to node {B} (2,-1);
  \draw[left] (3,0) to node {L} (3,-2);
  \draw[right] (4,0) to node {R} (4,-2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = Object.fromEntries(
    ir.items
      .filter((item) => item.type === "textNode" && ["A", "B", "L", "R"].includes(item.text))
      .map((item) => [item.text, item])
  );

  assert.deepEqual(diagnostics, []);
  assert.ok(labels.A.y > 0, `expected path-level above to move A above the path, got ${labels.A.y}`);
  assert.ok(labels.B.y < -1, `expected path-level below to move B below the path, got ${labels.B.y}`);
  assert.ok(labels.L.x < 3, `expected path-level left to move L left of the path, got ${labels.L.x}`);
  assert.ok(labels.R.x > 4, `expected path-level right to move R right of the path, got ${labels.R.x}`);
});

test("registers inline path nodes when node name appears before options", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) -- +(0,-1)
    node (e1) [draw] {1881}
    node (e2) [draw, below=of e1] {born};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const first = ir.items.find((item) => item.type === "textNode" && item.text === "1881");
  const second = ir.items.find((item) => item.type === "textNode" && item.text === "born");

  assert.deepEqual(diagnostics, []);
  assert.ok(first, "expected first named inline node to render");
  assert.ok(second, "expected second named inline node to render");
  assert.ok(ir.coordinates.e1, "expected e1 coordinate to be registered");
  assert.ok(ir.coordinates.e2, "expected e2 coordinate to be registered");
  assert.ok(second.y < first.y, `expected below=of e1 placement, got ${second.y} vs ${first.y}`);
});

test("expands parameterized inline node styles with defaults", () => {
  const source = String.raw`
\begin{tikzpicture}[
  TN/.style args={#1/#2}{fill=#1, fill opacity=#2, draw=gray!15, below},
  TN/.default=gray!50/0.5
]
  \draw (0,0) -- +(0,-1)
    node (e1) [TN] {1881}
    node (e2) [TN=blue!30/0.3, below=of e1] {1885};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");
  const first = ir.items.find((item) => item.type === "textNode" && item.text === "1881");
  const second = ir.items.find((item) => item.type === "textNode" && item.text === "1885");

  assert.deepEqual(diagnostics, []);
  assert.equal(boxes.length, 2);
  assert.equal(boxes[0].style.fill, "rgb(192 192 192)");
  assert.equal(boxes[0].style.fillOpacity, 0.5);
  assert.equal(boxes[1].style.fill, "rgb(179 179 255)");
  assert.equal(boxes[1].style.fillOpacity, 0.3);
  assert.ok(second.y < first.y, `expected parameterized TN node to keep below=of placement, got ${second.y} vs ${first.y}`);
});

test("uses TikZ auto placement for inline path nodes without explicit side", () => {
  const source = String.raw`
\begin{tikzpicture}[auto]
  \path (8,-6) -- node[pos=0.5] (v) {VBlank} (0,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const pathPoint = { x: 4, y: -3 };

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.v.x < pathPoint.x - 0.25, `expected auto node to move left of the path point, got ${ir.coordinates.v.x}`);
  assert.ok(ir.coordinates.v.y < pathPoint.y - 0.25, `expected auto node to move below the path point, got ${ir.coordinates.v.y}`);
});

test("uses path text color for inline edge labels instead of stroke color", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[color=red,text=black] (0,0) -- node[above] {$\omega$} (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === String.raw`$\omega$`);

  assert.deepEqual(diagnostics, []);
  assert.equal(label.style.fill, "black");
});

test("rotates sloped inline labels along their path segment", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) -- node[sloped, above] {$a$} (2,2);
  \draw (0,0) -- node[above] {$b$} (2,2);
  \draw (0,0) -- node[sloped, above] {$c$} (-2,2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const a = ir.items.find((item) => item.type === "textNode" && item.text === "$a$");
  const b = ir.items.find((item) => item.type === "textNode" && item.text === "$b$");
  const c = ir.items.find((item) => item.type === "textNode" && item.text === "$c$");

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(a.rotation - 45) < 1e-6, `expected sloped label to rotate 45 degrees, got ${a.rotation}`);
  assert.equal(b.rotation, undefined);
  assert.ok(Math.abs(c.rotation + 45) < 1e-6, `expected upside-left label to stay upright at -45 degrees, got ${c.rotation}`);
});

test("substitutes foreach variables inside inline node labels", () => {
  const source = String.raw`
\begin{tikzpicture}
  \foreach \x in {1,2}
    \draw (0,\x) -- node[above] {$I_{\x}$} (1,\x);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.equal(diagnostics.length, 0);
  assert.deepEqual(labels, ["$I_{1}$", "$I_{2}$"]);
});

test("does not draw a node border unless draw or fill is requested", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node at (0,0) {$x^2$};
  \node[draw] at (1,0) {$y^2$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  assert.equal(ir.items.filter((item) => item.type === "textNode").length, 2);
  assert.equal(ir.items.filter((item) => item.type === "nodeBox").length, 1);
});

test("does not draw inline path label boxes from inherited picture draw color", () => {
  const source = String.raw`
\begin{tikzpicture}[white, draw=white]
  \draw[fill=orange] (0,0) rectangle (2,4) node[midway] {$p(\neg E|H)$};
  \draw[black] (0,4) -- (2,4) node[midway, above] {$p(H)$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = ir.items.filter((item) => item.type === "textNode");
  const boxes = ir.items.filter((item) => item.type === "nodeBox");

  assert.deepEqual(diagnostics, []);
  assert.equal(labels.length, 2);
  assert.equal(boxes.length, 0);
  assert.equal(labels[0].style.fill, "white");
  assert.equal(labels[1].style.fill, "black");
});

test("sizes filled inline path math label backgrounds with TeX-like formula metrics", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[very thick, stealth-] (0,0) to node[midway, fill=white] {\${\bf T}_{12}$} (2,0);
  \draw[-stealth, very thick, dashed, bend left=90] (5.5,0) to
    node[pos=0.33, align=center, fill=white] {\${\bf O'}_{3,id_{t+1}}$\\$\mathcal{N}(y_{t+1};\mu_{id_{t+1}},\sigma_{id_{t+1}})$}
    (7,2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labelBoxes = ir.items.filter((item) => item.type === "nodeBox" && item.style.fill === "white");

  assert.deepEqual(diagnostics, []);
  assert.equal(labelBoxes.length, 2);
  assert.ok(labelBoxes[0].width > 0.78 && labelBoxes[0].width < 0.9, `expected native-sized T label background, got ${labelBoxes[0].width}`);
  assert.ok(labelBoxes[1].width > 3.3 && labelBoxes[1].width < 3.9, `expected native-sized observation label background, got ${labelBoxes[1].width}`);
});

test("treats unitless node inner sep values as TeX points", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, fill, inner sep=1] (origin) at (0,0) {};
  \node[circle, fill, inner sep=0.7] (tip) at (1,1) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));

  assert.deepEqual(diagnostics, []);
  assert.ok(boxes.origin.width > 0.09 && boxes.origin.width < 0.11, `expected 1pt inner sep dot, got ${boxes.origin.width}`);
  assert.ok(boxes.tip.width > 0.06 && boxes.tip.width < 0.08, `expected 0.7pt inner sep dot, got ${boxes.tip.width}`);
});

test("sizes playing-card suit math nodes from glyph width instead of macro names", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle,draw,inner sep=0.1em] (c) {$\clubsuit$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "c");

  assert.deepEqual(diagnostics, []);
  assert.ok(box.width > 0.3 && box.width < 0.4, `expected suit box width near native TikZ, got ${box.width}`);
  assert.ok(box.height > 0.33 && box.height < 0.4, `expected suit box height near native TikZ, got ${box.height}`);
});

test("keeps vector object math nodes close to native TikZ height", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle,draw,minimum width=7em,thick] (o) {$\vec{o}_\clubsuit$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "o");

  assert.deepEqual(diagnostics, []);
  expectClose(box.width, parseDimension("7em"));
  assert.ok(box.height > 0.54 && box.height < 0.6, `expected vector object height near native TikZ, got ${box.height}`);
});

test("keeps TeX subscript formula node widths close to native TikZ metrics", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle,draw,fill=white] (f) {$f_\psi$};
  \node[rectangle,draw,ultra thick] (a) at (2,0) {\large $a_\phi$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const f = ir.items.find((item) => item.type === "nodeBox" && item.id === "f");
  const a = ir.items.find((item) => item.type === "nodeBox" && item.id === "a");

  assert.deepEqual(diagnostics, []);
  assert.ok(f.width > 0.56 && f.width < 0.7, `expected f_psi box width near native TikZ, got ${f.width}`);
  assert.ok(a.width > 0.58 && a.width < 0.74, `expected large a_phi box width near native TikZ, got ${a.width}`);
});

test("renders check accent math labels without spelling out the command", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node at (0,0) {$\check{S}_i$};
\end{tikzpicture}`, { mathRenderer: "svg-text" });

  assert.deepEqual(result.diagnostics, []);
  assert.doesNotMatch(result.svg, /checkS/);
  assert.match(result.svg, /Š/);
  assert.match(result.svg, /baseline-shift="sub">i/);
});

test("keeps single-symbol math circle nodes compact like native TikZ", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle,draw] (times) {$\times$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "times");

  assert.deepEqual(diagnostics, []);
  assert.ok(box.width > 0.58 && box.width < 0.75, `expected compact times circle diameter, got ${box.width}`);
});

test("sizes circular vector formulas with long subscripts for positioning", () => {
  const source = String.raw`
\usetikzlibrary{positioning}
\begin{tikzpicture}
  \node[circle, draw, thick] (z) {$\vec{a}_{real}$};
  \node[circle, draw, thick, right=5em of z] (x) {$\vec{b}_{fake}$};
  \node[circle, draw, thick, right=2em of x, yshift=7.5em] (D) {$\vec{b}$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));

  assert.deepEqual(diagnostics, []);
  assert.ok(boxes.z.width > 1.06 && boxes.z.width < 1.18, `expected native-like z circle diameter, got ${boxes.z.width}`);
  assert.ok(boxes.x.width > 1.18 && boxes.x.width < 1.3, `expected native-like x circle diameter, got ${boxes.x.width}`);
  assert.ok(boxes.D.width > 0.62 && boxes.D.width < 0.78, `expected compact vector-only D circle diameter, got ${boxes.D.width}`);
  assert.ok(Math.abs(ir.coordinates.x.x - 2.94) < 0.04, `expected right=5em positioning near native x center, got ${ir.coordinates.x.x}`);
  assert.ok(Math.abs(ir.coordinates.D.x - 4.62) < 0.08, `expected D center near native placement, got ${ir.coordinates.D.x}`);
});

test("keeps multiline math circle nodes close to TikZ text metrics", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[align=center, circle, draw, thick] (s) at (0,0) {$s_1$\\{\scriptsize$\alpha_{t-1}(s_1)$}};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "s");

  assert.deepEqual(diagnostics, []);
  assert.ok(box, "expected circular node box");
  assert.ok(box.width >= 1.56, `expected native-like multiline formula circle diameter, got ${box.width}`);
  assert.ok(box.width <= 1.64, `expected native-like multiline formula circle diameter, got ${box.width}`);
});

test("matches native TikZ shape extents and anchors for text nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (r) at (0,1)   [draw, rectangle] {rectangle};
  \node (c) at (1.5,0) [draw, circle]    {circle};
  \node (e) at (3,1)   [draw, ellipse]   {ellipse};
  \draw[->] (r.east)  -- (e.west);
  \draw[->] (r.south) -- (c.north west);
  \draw[->] (e.south) -- (c.north east);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));
  const paths = ir.items.filter((item) => item.type === "path" && item.style?.markerEnd);

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(boxes.r.width - 1.62) < 0.04, `expected rectangle width near native TikZ, got ${boxes.r.width}`);
  assert.ok(Math.abs(boxes.r.height - 0.55) < 0.03, `expected rectangle height near native TikZ, got ${boxes.r.height}`);
  assert.ok(Math.abs(boxes.c.width - 1.14) < 0.05, `expected circle diameter near native TikZ, got ${boxes.c.width}`);
  assert.ok(Math.abs(boxes.e.width - 1.66) < 0.06, `expected ellipse width near native TikZ, got ${boxes.e.width}`);
  assert.ok(Math.abs(boxes.e.height - 0.77) < 0.05, `expected ellipse height near native TikZ, got ${boxes.e.height}`);

  assert.ok(Math.abs(paths[0].commands[0].x - boxes.r.width / 2) < 0.02, "expected arrow to start at rectangle east anchor");
  assert.ok(Math.abs(paths[0].commands[1].x - (boxes.e.x - boxes.e.width / 2)) < 0.02, "expected arrow to end at ellipse west anchor");

  const circleRadius = boxes.c.width / 2;
  const diag = circleRadius / Math.SQRT2;
  assert.ok(Math.abs(paths[1].commands[1].x - (boxes.c.x - diag)) < 0.02, "expected circle north west anchor on circular border");
  assert.ok(Math.abs(paths[1].commands[1].y - (boxes.c.y + diag)) < 0.02, "expected circle north west anchor on circular border");
  assert.ok(Math.abs(paths[2].commands[1].x - (boxes.c.x + diag)) < 0.02, "expected circle north east anchor on circular border");
  assert.ok(Math.abs(paths[2].commands[1].y - (boxes.c.y + diag)) < 0.02, "expected circle north east anchor on circular border");
});

test("keeps explicit ellipse minimum width and height as final native TikZ extents", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[ellipse, draw, minimum width=80pt, minimum height=20pt] (a) {Agent};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "a");

  assert.deepEqual(diagnostics, []);
  assert.ok(box, "expected ellipse node box");
  assert.ok(Math.abs(box.width - parseDimension("80pt")) < 0.02, `expected ellipse width near 80pt, got ${box.width}`);
  assert.ok(Math.abs(box.height - parseDimension("20pt")) < 0.02, `expected ellipse height near 20pt, got ${box.height}`);
});

test("uses PGF outer sep when placing nodes by explicit anchors", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[fill=red] (4,2) circle[radius=0.1];
  \node at (4,2) [draw, rectangle, anchor=south west] {rectangle};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.shape === "rectangle");
  const lineWidth = box.style.lineWidth / TIKZ_UNIT;
  const left = box.x - box.width / 2;
  const bottom = box.y - box.height / 2;

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(left - (4 + lineWidth / 2)) < 0.01, `expected west border at outer sep from anchor, got ${left}`);
  assert.ok(Math.abs(bottom - (2 + lineWidth / 2)) < 0.01, `expected south border at outer sep from anchor, got ${bottom}`);
});

test("renders repeated TikZ node labels with every label style", () => {
  const source = String.raw`
\begin{tikzpicture}[every label/.style={scale=0.5}]
  \node[
    label=above:Graphics,
    label=left:Design,
    label=below:Typography,
    label=right:Coding,
    circle, shading=ball, ball color=blue!60,
    text=white] {TikZ};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const ball = ir.items.find((item) => item.type === "nodeBox" && item.shape === "circle");
  const labels = Object.fromEntries(
    ir.items
      .filter((item) => item.type === "textNode" && item.text !== "TikZ")
      .map((item) => [item.text, item])
  );

  assert.deepEqual(diagnostics, []);
  assert.equal(ball.style.shading, "ball");
  assert.equal(ball.style.ballColor, "rgb(102 102 255)");
  assert.deepEqual(Object.keys(labels).sort(), ["Coding", "Design", "Graphics", "Typography"]);
  assert.ok(labels.Graphics.y > 0.6, `expected Graphics above the circle, got ${labels.Graphics.y}`);
  assert.ok(labels.Typography.y < -0.6, `expected Typography below the circle, got ${labels.Typography.y}`);
  assert.ok(labels.Design.x < -0.6, `expected Design left of the circle, got ${labels.Design.x}`);
  assert.ok(labels.Coding.x > 0.6, `expected Coding right of the circle, got ${labels.Coding.x}`);
  assert.equal(labels.Graphics.style.fill, "black");
  assert.ok(Math.abs(labels.Graphics.style.fontScale - 0.5) < 1e-6, `expected every label scale, got ${labels.Graphics.style.fontScale}`);
});

test("uses local label distance and TeX relation spacing for angular labels", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (a) at (1,1);
  \node[label={[label distance=0.1cm]0:$x = y \approx 0.739085$}] at (a) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text.includes("0.739085"));

  assert.deepEqual(diagnostics, []);
  assert.ok(label, "expected the fixed-point label");
  assert.ok(
    Math.abs(label.x - 2.653) < 0.015,
    `expected native east-label center near x=2.653cm, got ${label.x}`
  );
  assert.equal(label.y, 1);
});

test("extrapolates inline path nodes for pos values outside zero to one", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}
    \path (0,0) -- node[pos=3] {far} (1,0);
    \path (0,0) -- node[pos=-0.5] {before} (0,2);
  \end{tikzpicture}`);
  const labels = new Map(
    result.ir.items
      .filter((item) => item.type === "textNode")
      .map((item) => [item.text, item])
  );

  assert.equal(labels.get("far").x, 3);
  assert.equal(labels.get("far").y, 0);
  assert.equal(labels.get("before").x, 0);
  assert.equal(labels.get("before").y, -1);
});

test("preserves negative numeric angles when placing node labels and pins", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle,minimum size=4pt,label=-90:$B$,pin=-45:$P$] (a) at (2,1) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "$B$");
  const pin = ir.items.find((item) => item.type === "textNode" && item.text === "$P$");

  assert.deepEqual(diagnostics, []);
  assert.ok(label && label.y < 1, `expected -90 degree label below the node, got ${label?.x},${label?.y}`);
  assert.ok(pin && pin.x > 2 && pin.y < 1, `expected -45 degree pin below-right of the node, got ${pin?.x},${pin?.y}`);
});

test("renders repeated TikZ node pins with every pin style and border edges", () => {
  const source = String.raw`
\begin{tikzpicture}[every pin/.style={scale=0.5}]
  \node[
    pin=above:Graphics,
    pin=left:Design,
    pin=below:Typography,
    pin=right:Coding,
    circle, shading=ball, ball color=blue!60,
    text=white] {TikZ};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const pins = Object.fromEntries(
    ir.items
      .filter((item) => item.type === "textNode" && item.text !== "TikZ")
      .map((item) => [item.text, item])
  );
  const edges = ir.items.filter((item) => item.subtype === "pin-edge");
  const topEdge = edges.find((edge) => edge.commands[0]?.y > 0);
  const rightEdge = edges.find((edge) => edge.commands[0]?.x > 0);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(Object.keys(pins).sort(), ["Coding", "Design", "Graphics", "Typography"]);
  assert.equal(edges.length, 4);
  assert.ok(pins.Graphics.y > 0.7, `expected Graphics above the circle, got ${pins.Graphics.y}`);
  assert.ok(pins.Typography.y < -0.7, `expected Typography below the circle, got ${pins.Typography.y}`);
  assert.ok(pins.Design.x < -0.7, `expected Design left of the circle, got ${pins.Design.x}`);
  assert.ok(pins.Coding.x > 0.7, `expected Coding right of the circle, got ${pins.Coding.x}`);
  assert.ok(Math.abs(pins.Graphics.style.fontScale - 0.5) < 1e-6, `expected every pin scale, got ${pins.Graphics.style.fontScale}`);
  assert.ok(edges.every((edge) => edge.style.stroke === "gray" || edge.style.stroke === "rgb(128 128 128)"), "expected default every pin edge help-lines color");
  assert.ok(topEdge, "expected top pin edge to start at the node border");
  assert.ok(rightEdge, "expected right pin edge to start at the node border");
  assert.ok(topEdge.commands[0].y > 0.5 && topEdge.commands[0].y < pins.Graphics.y, `expected top edge from circle border to pin, got ${JSON.stringify(topEdge.commands)}`);
  assert.ok(rightEdge.commands[0].x > 0.5 && rightEdge.commands[0].x < pins.Coding.x, `expected right edge from circle border to pin, got ${JSON.stringify(rightEdge.commands)}`);
});

test("inherits path color into labels attached to inline path nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[red,dashed] (0,0) -- (1,1) node[circle,fill,inner sep=1pt,label=above:{$P$}]{};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "{$P$}");

  assert.deepEqual(diagnostics, []);
  assert.ok(label, "expected attached label text");
  assert.equal(label.style.fill, "red");
});

test("inherits fill color into inline nodes attached to fill paths", () => {
  const source = String.raw`
\begin{tikzpicture}
  \fill[red] (0,0) circle (1pt) node[above right] {$P=(x,y)$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "$P=(x,y)$");

  assert.deepEqual(diagnostics, []);
  assert.ok(label, "expected inline node text");
  assert.equal(label.style.fill, "red");
});

test("supports common node anchor and shift positioning controls", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[anchor=west, xshift=0.2] at (1,1) {$a$};
  \node[anchor=north, yshift=-0.1] at (2,2) {$b$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.equal(diagnostics.length, 0);
  const a = ir.items.find((item) => item.type === "textNode" && item.text === "$a$");
  const b = ir.items.find((item) => item.type === "textNode" && item.text === "$b$");
  assert.ok(a.x > 1.35);
  assert.equal(a.y, 1);
  assert.equal(b.x, 2);
  assert.ok(b.y < 1.7);
});

test("resolves braced polar coordinates in shift prefixes and calc offsets", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (h) at (1,2);
  \node[circle,draw] (a) at ([shift=({0:2em})]h) {};
  \draw (h) -- ($(h) + ({90:2em})$);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "a");
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(box.x - (1 + parseDimension("2em"))) < 0.0001, `expected shifted node x=1+2em, got ${box.x}`);
  assert.ok(Math.abs(box.y - 2) < 0.0001, `expected shifted node y=2, got ${box.y}`);
  const end = path.commands.at(-1);
  assert.equal(end.type, "lineTo");
  expectClose(end.x, 1);
  expectClose(end.y, 2 + parseDimension("2em"));
});

test("resolves calc interpolation offsets with whitespace after the target coordinate", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (2,0);
  \coordinate (C) at ($(A)!0.3!(B) +(0,0.08)$);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.coordinates.C, { x: 0.6, y: 0.08 });
});

test("renders tqft option-only pics and registers cobordism boundary anchors", () => {
  const source = String.raw`
\begin{tikzpicture}[every tqft/.append style={transform shape, rotate=90, tqft/circle x radius=7pt, tqft/boundary separation=1cm, tqft/view from=incoming}]
  \pic[tqft/cylinder to prior, name=a, every incoming lower boundary component/.style={draw}, every outgoing lower boundary component/.style={draw}, cobordism edge/.style={draw}];
  \pic[tqft/cup, cobordism edge/.style={draw}, at=(a-outgoing boundary)];
  \draw ($(a-incoming boundary.west)!0.5!(a-outgoing boundary.west) +(0,0.08)$) -- (a-outgoing boundary.east);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const tqftPaths = ir.items.filter((item) => item.subtype?.startsWith?.("tqft-"));
  const annotation = ir.items.find((item) => item.type === "path" && !item.subtype);

  assert.deepEqual(diagnostics, []);
  assert.ok(tqftPaths.length >= 4, `expected tqft body and boundary paths, got ${tqftPaths.length}`);
  assert.ok(
    tqftPaths.find((item) => item.subtype === "tqft-cobordism")?.commands.every((command) => command.type !== "closePath"),
    "expected mixed TQFT cobordism body to stay open like PGF's fullpath outline"
  );
  const boundaryPath = tqftPaths.find((item) => item.subtype?.endsWith?.("-boundary"));
  assert.notEqual(boundaryPath.commands.at(-1).type, "closePath", "expected tqft boundary components to render as open half-arcs");
  assert.ok(ir.coordinates["a-incoming boundary"], "expected incoming boundary coordinate");
  assert.ok(ir.coordinates["a-outgoing boundary"], "expected outgoing boundary coordinate");
  assert.ok(
    ir.coordinates["a-outgoing boundary"].x > 1.5 && Math.abs(ir.coordinates["a-outgoing boundary"].y + 0.5) < 0.1,
    `expected every tqft rotate/boundary separation style to place outgoing boundary horizontally, got ${JSON.stringify(ir.coordinates["a-outgoing boundary"])}`
  );
  assert.ok(Math.hypot(annotation.commands[0].x, annotation.commands[0].y) > 0.5, `expected calc annotation to use tqft anchors, got ${JSON.stringify(annotation.commands[0])}`);
});

test("places tqft adjacent-between anchors inside cobordisms instead of on boundary midpoints", () => {
  const source = String.raw`
\begin{tikzpicture}[every tqft/.append style={transform shape, rotate=90, tqft/boundary separation=1cm, tqft/view from=incoming}]
  \pic[tqft/pair of pants, name=b, cobordism edge/.style={draw}];
  \pic[tqft/reverse pair of pants, name=c, cobordism edge/.style={draw}, at=(b-outgoing boundary 1)];
  \coordinate (temp1) at ($(b-between outgoing 1 and 2)!0.2!(c-between incoming 1 and 2) +(0,0.72)$);
  \coordinate (temp2) at ($(b-between outgoing 1 and 2)!0.8!(c-between incoming 1 and 2) +(0,0.72)$);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const leftInterior = ir.coordinates["b-between outgoing 1 and 2"];
  const rightInterior = ir.coordinates["c-between incoming 1 and 2"];

  assert.deepEqual(diagnostics, []);
  assert.ok(leftInterior, "expected pair-of-pants outgoing interior anchor");
  assert.ok(rightInterior, "expected reverse pair-of-pants incoming interior anchor");
  assert.ok(
    Math.abs(leftInterior.x - rightInterior.x) > 0.2,
    `expected adjacent TQFT between anchors to span the bridge interior, got ${JSON.stringify({ leftInterior, rightInterior })}`
  );
  assert.ok(
    Math.abs(ir.coordinates.temp1.x - ir.coordinates.temp2.x) > 0.2,
    `expected interpolated labels to separate, got ${JSON.stringify({ temp1: ir.coordinates.temp1, temp2: ir.coordinates.temp2 })}`
  );
});

test("inherits picture-level font size into inline path labels", () => {
  const normal = interpretTikz(parseTikz(String.raw`
\begin{tikzpicture}
  \draw (0,0) -- (3,0) node[right] {to};
\end{tikzpicture}`).ast).ir.items.find((item) => item.type === "textNode" && item.text === "to");
  const scripted = interpretTikz(parseTikz(String.raw`
\begin{tikzpicture}[font=\scriptsize]
  \draw (0,0) -- (3,0) node[right] {to};
\end{tikzpicture}`).ast).ir.items.find((item) => item.type === "textNode" && item.text === "to");

  assert.equal(scripted.style.fontScale, 0.7);
  assert.ok(scripted.x < normal.x, `expected scriptsize label to sit closer to path end, got ${scripted.x} >= ${normal.x}`);
});

test("uses TikZ positioning node distance pairs as vertical and horizontal edge gaps", () => {
  const source = String.raw`
\begin{tikzpicture}[node distance=1.1cm and 1.6cm,box/.style={draw,minimum width=1.4cm,minimum height=.65cm,align=center}]
  \node[box] (input) {Input\\$x$};
  \node[box,right=of input] (encode) {Encode\\$f(x)$};
  \node[box,right=of encode] (latent) {Latent\\$z$};
  \node[box,below=of encode] (loss) {Loss\\$\mathcal L$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));
  const defaultOuterSep = TIKZ_LINE_WIDTHS.default / TIKZ_UNIT / 2;
  const horizontalGap = ir.coordinates.encode.x - ir.coordinates.input.x - (boxes.input.width + boxes.encode.width) / 2;
  const verticalGap = ir.coordinates.encode.y - ir.coordinates.loss.y - (boxes.encode.height + boxes.loss.height) / 2;

  assert.equal(ir.coordinates.input.x, 0);
  assert.ok(Math.abs(horizontalGap - (1.6 + defaultOuterSep * 2)) < 1e-6, `expected right=of visible gap to include outer sep, got ${horizontalGap}`);
  assert.ok(Math.abs(verticalGap - (1.1 + defaultOuterSep * 2)) < 1e-6, `expected below=of visible gap to include outer sep, got ${verticalGap}`);
  assert.equal(ir.coordinates.loss.x, ir.coordinates.encode.x);
  assert.equal(ir.coordinates.latent.x, ir.coordinates.encode.x * 2);
});

test("uses positioning on grid to keep node centres one requested distance apart", () => {
  const source = String.raw`
\begin{tikzpicture}[every node/.style={draw,rectangle}]
  \node (a1) at (0,0) {not gridded};
  \node (b1) [above=1cm of a1] {fooy};
  \node (a2) at (2,0) {gridded};
  \node (b2) [on grid,above=1cm of a2] {fooy};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  const plainDistance = ir.coordinates.b1.y - ir.coordinates.a1.y;
  const griddedDistance = ir.coordinates.b2.y - ir.coordinates.a2.y;
  assert.ok(plainDistance > 1.2, `expected border placement to include node heights, got ${plainDistance}`);
  assert.ok(Math.abs(griddedDistance - 1) < 1e-6, `expected on grid centres to be 1cm apart, got ${griddedDistance}`);

  const inherited = interpretTikz(parseTikz(String.raw`
\begin{tikzpicture}[on grid]
  \node (a) at (0,0) {wide};
  \node [above=1cm of a] (b) {tiny};
\end{tikzpicture}`).ast).ir.coordinates;
  assert.ok(Math.abs(inherited.b.y - inherited.a.y - 1) < 1e-6, "expected picture-level on grid to reach child nodes");
});

test("aligns base and mid positioning through their corresponding text anchors", () => {
  const source = String.raw`
\begin{tikzpicture}[node distance=1ex,font=\huge]
  \node (baseX) at (0,1) {X};
  \node (baseA) [base right=of baseX] {a};
  \node (baseY) [base right=of baseA] {y};
  \coordinate (baseXMark) at (baseX.base east);
  \coordinate (baseAMark) at (baseA.base west);
  \coordinate (baseYMark) at (baseY.base west);
  \node (midX) at (0,0) {X};
  \node (midA) [mid right=of midX] {a};
  \node (midY) [mid right=of midA] {y};
  \coordinate (midXMark) at (midX.mid east);
  \coordinate (midAMark) at (midA.mid west);
  \coordinate (midYMark) at (midY.mid west);
  \node (gridX) at (0,-1) {X};
  \node [on grid,base right=1cm of gridX] (gridY) {y};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(ir.coordinates.baseXMark.y - ir.coordinates.baseAMark.y) < 1e-6, "expected base right to align baselines");
  assert.ok(Math.abs(ir.coordinates.baseXMark.y - ir.coordinates.baseYMark.y) < 1e-6, "expected chained base right to retain baseline");
  assert.ok(Math.abs(ir.coordinates.midXMark.y - ir.coordinates.midAMark.y) < 1e-6, "expected mid right to align mid anchors");
  assert.ok(Math.abs(ir.coordinates.midXMark.y - ir.coordinates.midYMark.y) < 1e-6, "expected chained mid right to retain mid anchor");
  assert.ok(ir.coordinates.baseA.x > ir.coordinates.baseX.x, "expected base right to advance horizontally");
  assert.ok(ir.coordinates.midA.x > ir.coordinates.midX.x, "expected mid right to advance horizontally");
  assert.ok(Math.abs(ir.coordinates.gridY.y - ir.coordinates.gridX.y) < 1e-6, "expected on grid to override base anchors with center placement");
});

test("accepts compact positioning syntax without whitespace before of", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw] (base) {};
  \node[circle, draw, above right=0.1em and 2emof base] (n) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.n.x > ir.coordinates.base.x + 0.7, `expected compact 2emof syntax to position right of base, got ${ir.coordinates.n.x}`);
  assert.ok(ir.coordinates.n.y > ir.coordinates.base.y, `expected compact 2emof syntax to position above base, got ${ir.coordinates.n.y}`);
});

test("uses compact empty node boxes for positioning library spacing", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (top) {};
  \node[below=1cm of top] (next) {};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const gap = Math.abs(ir.coordinates.top.y - ir.coordinates.next.y);

  assert.deepEqual(diagnostics, []);
  assert.ok(gap > 1.22 && gap < 1.27, `expected native-like empty node center gap near 1.24cm, got ${gap}`);
});

test("uses TeX-like mixed text metrics for drawn rectangle node positioning", () => {
  const source = String.raw`
\begin{tikzpicture}[node distance=1.5cm]
  \node[rectangle, very thick, draw] (learning) {Learning algorithm, $L$};
  \node[rectangle, very thick, draw, below=of learning] (inference) {Labelling function, $h$};
  \node[left=of learning] (train) {Training data, $\vec{s}$};
  \node[right=of inference] (lab) {Label, $y$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox").map((item) => [item.id, item]));

  assert.deepEqual(diagnostics, []);
  assert.ok(boxes.learning.width > 3.35, `expected Learning box to contain mixed text, got ${boxes.learning.width}`);
  assert.ok(boxes.inference.width > 3.3, `expected inference box to contain mixed text, got ${boxes.inference.width}`);
  assert.ok(ir.coordinates.train.x < -4.65, `expected wider left gap from Learning box, got ${ir.coordinates.train.x}`);
  assert.ok(ir.coordinates.lab.x > 4, `expected wider right gap from inference box, got ${ir.coordinates.lab.x}`);
});

test("uses TikZ text node boxes for positioning math label chains", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (X1) {$\vec{e}_{1}$};
  \node[rectangle,right=0.5em of X1] (x_dots_1) {$\dots$};
  \node[right=0.5em of x_dots_1] (Xj) {$\vec{e}_{j}$};
  \node[rectangle,right=1em of Xj] (x_dots_2) {$\dots$};
  \node[right=1em of x_dots_2] (Xn) {$\vec{e}_{n}$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.Xj.x > 1.45 && ir.coordinates.Xj.x < 1.7, `expected Xj near native TikZ placement, got ${ir.coordinates.Xj.x}`);
  assert.ok(ir.coordinates.Xn.x > 3.35 && ir.coordinates.Xn.x < 3.65, `expected Xn near native TikZ placement, got ${ir.coordinates.Xn.x}`);
});

test("parses unnamed node cells inside matrix of nodes", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \tikzset{
    table/.style={
      matrix of nodes,
      nodes={draw},
      column 4/.style={nodes={fill=gray!20}},
      row 4/.style={nodes={fill=gray!20}}
    }
  }
  \matrix[table] (m) {
    A & B & C & D \\
    E & F & G & H \\
    I & J & K & L \\
    M & N & O & \node[black, fill=cyan!50]{$0.449497$}; \\
  };
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const texts = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const highlightedText = result.ir.items.find((item) => item.type === "textNode" && item.text === "$0.449497$");
  const highlighted = result.ir.items.find(
    (item) => item.type === "nodeBox" && Math.abs(item.x - highlightedText.x) < 0.001 && Math.abs(item.y - highlightedText.y) < 0.001
  );

  assert.deepEqual(result.diagnostics, []);
  assert.ok(texts.includes("$0.449497$"));
  assert.equal(highlighted?.style?.fill, "rgb(128 255 255)");
});

test("registers TikZ matrix cell aliases declared with vertical bars", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \matrix (m) [matrix of nodes,column sep={1cm,between origins}] at (0,0) {
    |(left)| 00 & |(right)| 01 \\
  };
  \draw (left) -- (right);
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.coordinates.left);
  assert.ok(result.ir.coordinates.right);
  assert.ok(result.ir.coordinates.left.x < result.ir.coordinates.right.x);
});

test("anchors matrices to an aliased cell and honors between-origins spacing", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \matrix [matrix of nodes,column sep={0.8cm,between origins},row sep={0.8cm,between origins},anchor=origin.center] at (0.5,0.5) {
    & |(top)| 00 & \\
    |(row)| 0 & |(origin)| \phantom{0} & \\
  };
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(Math.abs(result.ir.coordinates.origin.x - 0.5) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.origin.y - 0.5) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.top.y - 1.3) < 1e-9);
  assert.ok(Math.abs(result.ir.coordinates.row.x + 0.3) < 1e-9);
});

test("keeps calc node corners axis aligned for rectangle path operations", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[scale=.8]
  \node (a) at (0,1) {A};
  \node (b) at (2,0) {B};
  \draw ($(a.north west)+(135:0)$) rectangle ($(b.south east)+(-45:0)$);
\end{tikzpicture}`);
  const rectangle = result.ir.items.find((item) => item.type === "path" && item.commands?.at(-1)?.type === "closePath");
  assert.ok(rectangle);
  assert.equal(rectangle.commands[0].y, rectangle.commands[1].y);
  assert.equal(rectangle.commands[1].x, rectangle.commands[2].x);
});

test("uses TeX-like formula width when positioning math output labels", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw] (h) {};
  \node[right=1.5em of h] (mu) {$\pi_\theta(s, \alpha_3)$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const delta = ir.coordinates.mu.x - ir.coordinates.h.x;

  assert.deepEqual(diagnostics, []);
  assert.ok(delta > 1.46 && delta < 1.54, `expected positioned formula label center near native TikZ, got ${delta}`);
});

test("keeps TikZ positioning shifts when an explicit at coordinate follows the options", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw] (ref) at (0,0) {A};
  \node[draw, above=1cm of ref] at (2,0) (top) {B};
  \node[draw, right=1cm of ref] at (0,-2) (side) {C};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.coordinates.top.x, 2);
  assert.ok(ir.coordinates.top.y > 1.1, `expected above=... shift to raise explicit at coordinate, got ${ir.coordinates.top.y}`);
  assert.ok(ir.coordinates.side.x > 1.1, `expected right=... shift to move explicit at coordinate, got ${ir.coordinates.side.x}`);
  assert.equal(ir.coordinates.side.y, -2);
});

test("keeps legacy right-of distance as an offset when a node also has an explicit at coordinate", () => {
  const source = String.raw`
\begin{tikzpicture}[node distance=3cm]
  \node[draw] (prediction) at (4,0) {Prediction};
  \node[draw, right of=prediction] at (6,-2) (update) {Update};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.coordinates.update.x, 9);
  assert.equal(ir.coordinates.update.y, -2);
});

test("uses TikZ diagonal factor for bare directional node shifts with explicit at", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, minimum width=2em, minimum height=2em, inner sep=0em, below right=2.5em] (n) at (0,0) {13};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(ir.coordinates.n.x - 0.973) < 0.02, `expected x to use diagonal distance factor, got ${ir.coordinates.n.x}`);
  assert.ok(Math.abs(ir.coordinates.n.y + 0.973) < 0.02, `expected y to use diagonal distance factor, got ${ir.coordinates.n.y}`);
});

test("places nodes on named chains instead of leaving them at the origin", () => {
  const source = String.raw`
\begin{tikzpicture}[start chain=1 going right, start chain=2 going right]
  \node[state,on chain=1] (a) {$a$};
  \node[state,on chain=1] (b) {$b$};
  \node[on chain=1] (dots) {\dots};
  \node[state,on chain=2] (c) at (0,-2) {$c$};
  \node[state,on chain=2] (d) {$d$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.b.x > ir.coordinates.a.x + 1, `expected chain 1 to advance right, got ${JSON.stringify(ir.coordinates)}`);
  assert.ok(ir.coordinates.d.x > ir.coordinates.c.x + 1, `expected chain 2 to advance right, got ${JSON.stringify(ir.coordinates)}`);
  assert.equal(ir.coordinates.c.y, -2);
  assert.equal(ir.coordinates.d.y, -2);
});

test("adds chain join edges with join=by arrow styles", () => {
  const source = String.raw`
\begin{tikzpicture}[start chain=1 going right]
  \node[on chain=1] (x) {$x$};
  \node[on chain=1,join=by o-latex] (w) {$w$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const join = ir.items.find(
    (item) =>
      item.type === "path" &&
      item.style?.markerStart?.kind === "open-circle" &&
      item.style?.markerEnd?.kind === "latex"
  );

  assert.deepEqual(diagnostics, []);
  assert.ok(join, `expected on-chain join edge, got ${JSON.stringify(ir.items)}`);
  assert.equal(join.commands[0].type, "moveTo");
  assert.equal(join.commands.at(-1).type, "lineTo");
  assert.ok(join.commands.at(-1).x > join.commands[0].x, `expected join to advance right, got ${JSON.stringify(join.commands)}`);
});

test("keeps multiple named chains and exposes begin/end aliases across continue-chain scopes", () => {
  const source = String.raw`
\begin{tikzpicture}[start chain=top going right, start chain=bottom going below]
  \node[draw,on chain=top] (a) {A};
  \node[draw,on chain=top] (b) {B};
  \begin{scope}[continue chain=bottom going right]
    \node[draw,on chain] (c) at (0,-2) {C};
    \node[draw,on chain] (d) {D};
  \end{scope}
  \draw (top-begin) -- (top-end);
  \draw (bottom-begin) -- (bottom-end);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.b.x > ir.coordinates.a.x, `expected top chain to advance right, got ${JSON.stringify(ir.coordinates)}`);
  assert.ok(ir.coordinates.d.x > ir.coordinates.c.x, `expected continued bottom chain to advance right, got ${JSON.stringify(ir.coordinates)}`);
  assert.equal(ir.coordinates.c.y, -2);
  assert.equal(ir.coordinates["top-begin"].x, ir.coordinates.a.x);
  assert.equal(ir.coordinates["top-end"].x, ir.coordinates.b.x);
  assert.equal(ir.coordinates["bottom-begin"].x, ir.coordinates.c.x);
  assert.equal(ir.coordinates["bottom-end"].x, ir.coordinates.d.x);
  assert.equal(paths.length, 2);
});

test("interprets documented braced scope shorthand with whitespace and restores outer styles", () => {
  const source = String.raw`
\begin{tikzpicture}
  { [ultra thick]
    { [red, shift={(0,1)}]
      \draw (0,0) -- (1,0);
    }
    \draw (0,0) -- (1,0);
  }
  { [green]
    \draw (0,0) -- (1,0);
  }
  \draw (0,0) -- (1,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(paths.length, 4);
  assert.equal(paths[0].style.stroke, "red");
  assert.equal(paths[0].style.lineWidth, TIKZ_LINE_WIDTHS.ultraThick);
  assert.equal(paths[0].commands[0].y, 1);
  assert.equal(paths[1].style.stroke, "black");
  assert.equal(paths[1].style.lineWidth, TIKZ_LINE_WIDTHS.ultraThick);
  assert.equal(paths[2].style.stroke, "rgb(0 255 0)");
  assert.equal(paths[2].style.lineWidth, TIKZ_LINE_WIDTHS.thin);
  assert.equal(paths[3].style.stroke, "black");
  assert.equal(paths[3].style.lineWidth, TIKZ_LINE_WIDTHS.thin);
});

test("places chains with the local placed positioning syntax without changing the stored direction", () => {
  const source = String.raw`
\begin{tikzpicture}[node distance=7mm, start chain=flow placed below]
  \node[draw,on chain={flow placed {at={(0,0)}}}] (a) {A};
  \node[draw,on chain] (b) {B};
  \node[draw,on chain=flow placed right] (c) {C};
  \node[draw,on chain] (d) {D};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.b.y < ir.coordinates.a.y, `expected placed below to lower B, got ${JSON.stringify(ir.coordinates)}`);
  assert.ok(ir.coordinates.c.x > ir.coordinates.b.x, `expected local placed right to move C right, got ${JSON.stringify(ir.coordinates)}`);
  assert.equal(ir.coordinates.c.y, ir.coordinates.b.y);
  assert.equal(ir.coordinates.d.x, ir.coordinates.c.x);
  assert.ok(ir.coordinates.d.y < ir.coordinates.c.y, `expected default placed below to resume for D, got ${JSON.stringify(ir.coordinates)}`);
});

test("continues a placed chain with a new stored placement inside a scope", () => {
  const source = String.raw`
\begin{tikzpicture}[node distance=7mm, start chain=flow placed below]
  \node[draw,on chain={flow placed {at={(0,0)}}}] (a) {A};
  \node[draw,on chain] (b) {B};
  \begin{scope}[continue chain=flow placed right]
    \node[draw,on chain] (c) {C};
    \node[draw,on chain] (d) {D};
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.b.y < ir.coordinates.a.y, `expected initial placed below chain, got ${JSON.stringify(ir.coordinates)}`);
  assert.ok(ir.coordinates.c.x > ir.coordinates.b.x, `expected continued placed right chain, got ${JSON.stringify(ir.coordinates)}`);
  assert.ok(ir.coordinates.d.x > ir.coordinates.c.x, `expected stored placed right chain to continue, got ${JSON.stringify(ir.coordinates)}`);
  assert.equal(ir.coordinates.d.y, ir.coordinates.c.y);
});

test("changes placed chain placement from the documented node option", () => {
  const source = String.raw`
\begin{tikzpicture}[node distance=7mm, start chain=flow placed below]
  \node[draw,on chain={flow placed {at={(0,0)}}}] (a) {A};
  \node[draw,continue chain=flow placed right,on chain] (b) {B};
  \node[draw,on chain] (c) {C};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.b.x > ir.coordinates.a.x, `expected node continue option to place B right of A, got ${JSON.stringify(ir.coordinates)}`);
  assert.ok(ir.coordinates.c.x > ir.coordinates.b.x, `expected stored placed right to continue for C, got ${JSON.stringify(ir.coordinates)}`);
  assert.equal(ir.coordinates.c.y, ir.coordinates.b.y);
});

test("starts a branch at the active chain fork and continues it later", () => {
  const source = String.raw`
\begin{tikzpicture}[start chain=trunk going right]
  \node[draw,on chain] (a) {A};
  \node[draw,on chain] (b) {B};
  \begin{scope}[start branch=numbers going below]
    \node[draw,on chain,join] (one) {1};
    \node[draw,on chain,join] (two) {2};
  \end{scope}
  \node[draw,on chain] (c) {C};
  \begin{scope}[continue branch=numbers]
    \node[draw,on chain,join] (three) {3};
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const joins = ir.items.filter((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(ir.coordinates["trunk/numbers-begin"], ir.coordinates.b);
  assert.ok(ir.coordinates.one.y < ir.coordinates.b.y, `expected first branch node below fork, got ${JSON.stringify(ir.coordinates)}`);
  assert.ok(ir.coordinates.two.y < ir.coordinates.one.y, `expected branch to continue below, got ${JSON.stringify(ir.coordinates)}`);
  assert.ok(ir.coordinates.c.x > ir.coordinates.b.x, `expected trunk to remain horizontal, got ${JSON.stringify(ir.coordinates)}`);
  assert.ok(ir.coordinates.three.y < ir.coordinates.two.y, `expected continued branch to resume after its endpoint, got ${JSON.stringify(ir.coordinates)}`);
  assert.equal(joins.length, 3);
});

test("chains an existing node in without drawing it again", () => {
  const source = String.raw`
\begin{tikzpicture}[node distance=5mm,start chain=walk going right]
  \node[draw] (existing) at (0,2) {E};
  \node[draw,on chain,join] (a) {A};
  \node[draw,on chain,join] (b) {B};
  \chainin (existing) [join];
  \node[draw,on chain,join] (c) {C};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const joins = ir.items.filter((item) => item.type === "path");
  const existingBoxes = ir.items.filter((item) => item.type === "nodeBox" && item.id === "existing");

  assert.deepEqual(diagnostics, []);
  assert.equal(existingBoxes.length, 1);
  assert.deepEqual(ir.coordinates["walk-3"], ir.coordinates.existing);
  assert.equal(ir.coordinates.c.y, ir.coordinates.existing.y);
  assert.ok(ir.coordinates.c.x > ir.coordinates.existing.x, `expected chain to continue from the chained-in node, got ${JSON.stringify(ir.coordinates)}`);
  assert.equal(joins.length, 3);
});

test("supports diamond node shape and compass anchors", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[shape=diamond, draw, minimum width=4cm, minimum height=2cm, inner sep=0] (n) at (0,0) {diamond node};
  \draw (n.north) -- (n.east) -- (n.south west) -- (n.30);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "n");
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(box.shape, "diamond");
  assert.equal(path.commands[0].type, "moveTo");
  assert.equal(path.commands[0].x, 0);
  assert.ok(path.commands[0].y > 1, `expected north anchor above center, got ${path.commands[0].y}`);
  assert.equal(path.commands[1].type, "lineTo");
  assert.ok(path.commands[1].x > 2, `expected east anchor right of center, got ${path.commands[1].x}`);
  assert.equal(path.commands[1].y, 0);
  assert.equal(path.commands[2].type, "lineTo");
  assert.ok(path.commands[2].x < 0 && path.commands[2].y < 0, `expected south west anchor in lower-left quadrant, got ${path.commands[2].x},${path.commands[2].y}`);
  assert.ok(path.commands.at(-1).x > 0 && path.commands.at(-1).x < path.commands[1].x);
  assert.ok(path.commands.at(-1).y > 0 && path.commands.at(-1).y < path.commands[0].y);
});

test("supports built-in TikZ shapes library geometric and symbol nodes", () => {
  const source = String.raw`
\usetikzlibrary{shapes}
\begin{tikzpicture}
  \node[regular polygon, regular polygon sides=5, draw, minimum size=1cm] (p) at (0,0) {P};
  \node[star, star points=6, draw, right=1.8cm of p] (s) {S};
  \node[trapezium, trapezium left angle=70, trapezium right angle=110, draw, right=1.8cm of s] (t) {T};
  \node[cloud, draw, right=1.8cm of t] (c) {C};
  \draw (p.east) -- (s.west) -- (t.north) -- (c.180);
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const shapes = boxes.map((item) => item.shape);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(shapes, ["regularPolygon", "star", "trapezium", "cloud"]);
  assert.equal(path.commands.length, 4);
  assert.ok(path.commands[0].x > boxes[0].x, `expected regular polygon east anchor on right border`);
  assert.ok(path.commands[1].x < boxes[1].x, `expected star west anchor on left border`);
  assert.ok(path.commands[2].y > boxes[2].y, `expected trapezium north anchor above center`);
  assert.match(result.svg, /class="tikz-node-shape tikz-node-regularPolygon"/);
  assert.match(result.svg, /class="tikz-node-shape tikz-node-star"/);
  assert.match(result.svg, /class="tikz-node-shape tikz-node-trapezium"/);
  assert.match(result.svg, /class="tikz-node-shape tikz-node-cloud"/);
});

test("expands simple tikzset pic definitions with isosceles triangle anchors", () => {
  const source = String.raw`
\usetikzlibrary{shapes.geometric}
\tikzset{
  marker node/.style={isosceles triangle, minimum height=2.5mm, inner sep=0pt, anchor=apex},
  marker/.pic={
    \node[marker node, pic actions, rotate=-90](-o){};
    \node[marker node, pic actions, rotate=90](-u){};
  }
}
\begin{tikzpicture}
  \pic[fill=blue] (m) at (2,0) {marker};
  \draw (m-o.apex) -- (m-u.apex);
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(boxes.map((item) => item.id), ["m-o", "m-u"]);
  assert.deepEqual(boxes.map((item) => item.shape), ["isoscelesTriangle", "isoscelesTriangle"]);
  assert.equal(boxes[0].style.fill, "blue");
  assert.equal(path.commands[0].x, 2);
  assert.equal(path.commands[1].x, 2);
  assert.match(result.svg, /class="tikz-node-shape tikz-node-isoscelesTriangle"/);
});

test("uses minimum height as the apex-to-base axis for rotated isosceles triangles", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node[isosceles triangle,isosceles triangle apex angle=44,draw,inner sep=0pt,anchor=lower side,rotate=90,minimum height=4cm] (triangle) at (1.6,-0.05) {};
  \draw (triangle.lower side) -- (triangle.apex);
\end{tikzpicture}`);
  const box = result.ir.items.find((item) => item.type === "nodeBox");
  const axis = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.shape, "isoscelesTriangle");
  assert.ok(Math.abs(box.width - 4) < 0.01, `expected 4cm apex-to-base axis, got ${box.width}`);
  assert.ok(Math.abs(box.height - 3.23) < 0.03, `expected apex-angle-derived base width, got ${box.height}`);
  assert.ok(Math.abs(axis.commands[0].x - 1.6) < 0.01);
  assert.ok(Math.abs(axis.commands[0].y + 0.05) < 0.01, `expected lower-side anchor at the placement point, got ${axis.commands[0].y}`);
  assert.ok(Math.abs(axis.commands.at(-1).x - 1.6) < 0.01);
  assert.ok(Math.abs(axis.commands.at(-1).y - 3.95) < 0.01, `expected apex above the lower side, got ${axis.commands.at(-1).y}`);
});

test("treats usetikzlibrary declarations as built-in library imports", () => {
  const source = String.raw`
\begin{tikzpicture}
  \usetikzlibrary{shapes}
  \node[star, draw] (s) at (0,0) {S};
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const box = result.ir.items.find((item) => item.type === "nodeBox");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(box.shape, "star");
});

test("keeps text, mid, and base anchors distinct inside nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[shape=diamond, minimum width=4cm, minimum height=2cm] (n) {diamond\hspace{2cm}node};
  \draw (n.text) -- (n.mid) -- (n.base);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.ok(path.commands[0].x < path.commands[1].x, `expected text anchor left of mid, got ${JSON.stringify(path.commands)}`);
  assert.ok(path.commands[2].y < path.commands[1].y, `expected base anchor below mid, got ${JSON.stringify(path.commands)}`);
});

test("sizes diamond nodes from hspace and directional inner sep", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[shape=diamond, draw, inner xsep=0.5cm, inner ysep=0.5cm] (n) {\Huge diamond\hspace{2.6cm}node};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "n");

  assert.deepEqual(diagnostics, []);
  assert.equal(box.shape, "diamond");
  assert.ok(box.width > 7, `expected diamond width to include hspace and xsep, got ${box.width}`);
  assert.ok(box.height > 4, `expected diamond height to expand around wide text, got ${box.height}`);
});

test("sizes rectangle nodes with TeX hspace once instead of counting rendered spacer glyphs", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[name=n,shape=rectangle,draw,inner xsep=1.5cm,inner ysep=0.5cm]
    {\Huge rectan\smash{g}le\hspace{3cm}node};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const box = ir.items.find((item) => item.type === "nodeBox" && item.id === "n");

  assert.deepEqual(diagnostics, []);
  assert.equal(box.shape, "rectangle");
  assert.ok(box.width > 10.7 && box.width < 11.8, `expected native-like one-time hspace width, got ${box.width}`);
});

test("tikzToSvg emits svg path, inline arrow tip, y-axis flip, and diagnostics for unsupported syntax", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[red, dashed, ->] (0,0) -- (1,1);
  \unknownthing (0,0);
\end{tikzpicture}`;

  const result = tikzToSvg(source);

  assert.match(result.svg, /<svg[^>]+viewBox=/);
  assert.match(result.svg, /<path[^>]+stroke="red"/);
  assert.match(result.svg, /stroke-dasharray=/);
  assert.doesNotMatch(result.svg, /marker-end=/);
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-to"/);
  assert.match(result.svg, /L 99\.[0-9]+ -99\.[0-9]+/);
  assert.equal(result.diagnostics.some((d) => d.severity === "warning"), true);
});

test("keeps common TikZ arrow tip styles distinct in the drawing IR", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[->] (0,0) -- (1,0);
  \draw[<-] (0,1) -- (1,1);
  \draw[<->] (0,2) -- (1,2);
  \draw[-stealth] (0,3) -- (1,3);
  \draw[stealth-] (0,4) -- (1,4);
  \draw[-latex'] (0,5) -- (1,5);
  \draw[very thick, draw=red, -{Stealth[color=orange, fill=red, width=8pt, length=10pt]}] (0,5) -- (1,5);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");
  const customTip = paths[6].style.markerEnd;

  assert.deepEqual(diagnostics, []);
  assert.equal(paths[0].style.markerEnd.kind, "to");
  assert.equal(paths[1].style.markerStart.kind, "to");
  assert.equal(paths[2].style.markerStart.kind, "to");
  assert.equal(paths[2].style.markerEnd.kind, "to");
  assert.equal(paths[3].style.markerEnd.kind, "stealth");
  assert.equal(paths[4].style.markerStart.kind, "stealth");
  assert.equal(paths[5].style.markerEnd.kind, "latex");
  assert.equal(customTip.kind, "stealth");
  assert.equal(customTip.stroke, "orange");
  assert.equal(customTip.fill, "red");
  assert.equal(Math.round(customTip.width), Math.round(lineWidthFromTikzDimension("8pt")));
  assert.equal(Math.round(customTip.length), Math.round(lineWidthFromTikzDimension("10pt")));
});

test("renders arrows.meta Bar tips as perpendicular line caps", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[{Bar[width=4mm,line width=0.4pt]}-{Bar[width=4mm,line width=0.4pt]}] (0,0) -- (2,0);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find((item) => item.type === "path" && item.style.markerStart && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.style.markerStart.kind, "bar");
  assert.equal(path.style.markerEnd.kind, "bar");
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-bar" d="M 0 -20 L 0 20"/);
});

test("renders TikZ star arrow tips as filled endpoint dots", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[*-] (0,0) -- (1,0);
  \draw[-*] (0,-1) -- (1,-1);
  \draw[>=stealth,*->] (0,-2) -- (1,-2);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.equal(paths[0].style.markerStart.kind, "circle");
  assert.equal(paths[1].style.markerEnd.kind, "circle");
  assert.equal(paths[2].style.markerStart.kind, "circle");
  assert.equal(paths[2].style.markerEnd.kind, "stealth");
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-circle"/);
  assert.match(result.svg, /tikz-arrow-circle[^>]+fill="black" stroke="black" stroke-width="/);
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-stealth"/);
});

test("draws plot mark x coordinates as small cross paths", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[shift={(1,2)}] plot[mark=x] coordinates{(0,0)};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const mark = ir.items.find((item) => item.shape === "plot-mark");

  assert.deepEqual(diagnostics, []);
  assert.ok(mark, "expected plot[mark=x] to create a plot-mark path");
  assert.equal(mark.commands.length, 4);
  assert.ok(mark.commands.every((command) => Math.abs(command.x - 1) < 0.1 && Math.abs(command.y - 2) < 0.1));
});

test("uses PGF plot mark fill semantics for filled and open circle marks", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[blue, mark size=4pt] plot[mark=*] coordinates{(0,0)}
    plot[mark=o] coordinates{(1,0)}
    plot[mark=+] coordinates{(2,0)};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const marks = ir.items.filter((item) => item.shape === "plot-mark");

  assert.deepEqual(diagnostics, []);
  assert.equal(marks.length, 3);
  assert.equal(marks[0].mark, "*");
  assert.equal(marks[0].style.fill, "blue");
  assert.ok(marks[0].commands.length > 4, "expected filled circle mark to use circle path commands");
  assert.equal(marks[1].mark, "o");
  assert.equal(marks[1].style.fill, "none");
  assert.ok(marks[1].commands.length > 4, "expected open circle mark to use circle path commands");
  assert.equal(marks[2].mark, "+");
  assert.equal(marks[2].commands.length, 4);
  assert.ok(marks[0].commands.some((command) => Math.abs(command.x) > 0.12), "expected mark size=4pt to enlarge plot marks");
});

test("substitutes foreach variables used as node option keys", () => {
  const source = String.raw`
\begin{tikzpicture}
  \foreach \placement in {above,below}
    \draw (0,0) node[\placement,inner sep=0.1] {\placement};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const above = ir.items.find((item) => item.type === "textNode" && item.text === "above");
  const below = ir.items.find((item) => item.type === "textNode" && item.text === "below");

  assert.deepEqual(diagnostics, []);
  assert.ok(above.y > 0, `expected above label to move up, got ${above?.y}`);
  assert.ok(below.y < 0, `expected below label to move down, got ${below?.y}`);
});

test("keeps arrow endpoints clear of target node interiors", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, fill, inner sep=0.2em] (a) at (0,0) {};
  \node[circle, draw, fill, inner sep=0.2em] (b) at (1,0) {};
  \draw[-stealth, thick] (a) -- (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const targetBox = ir.items.filter((item) => item.type === "nodeBox").at(1);
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const endpoint = arrow.commands.at(-1);
  const outerSep = parseDimension("0.2pt");
  const targetWest = targetBox.x - targetBox.width / 2 - outerSep;

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(endpoint.x - targetWest) < 1e-6, `expected arrow tip on target border, got ${endpoint.x} vs ${targetWest}`);
});

test("renders dashed double arrows as paired strokes with the label preserved", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[-stealth, double, dashed, thick] (5.5,0) -- node[above] {dropout} (8.6, 0);
\end{tikzpicture}`, { mathRenderer: "svg-text" });
  const path = result.ir.items.find((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(path.style.doubleColor, "white");
  assert.match(result.svg, /class="tikz-arrowed-path tikz-double-path"/);
  assert.match(result.svg, /class="tikz-double-outer"/);
  assert.match(result.svg, /class="tikz-double-inner"/);
  assert.match(result.svg, /stroke-dasharray=/);
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-stealth"/);
  assert.match(result.svg, />dropout</);
});

test("recognizes TikZ shapes.arrows node shapes and sizing options", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[single arrow, draw, minimum height=1.1cm] (a) at (0,0) {};
  \node[double arrow, fill=gray!60, minimum height=3.6cm] (b) at (4,0) {Fast};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");

  assert.deepEqual(diagnostics, []);
  assert.equal(boxes[0].shape, "singleArrow");
  assert.equal(boxes[1].shape, "doubleArrow");
  assert.ok(boxes[0].width > boxes[0].height, "single arrow should add head length to its node box");
  assert.ok(boxes[1].width > boxes[1].height, "double arrow should add both arrow heads to its node box");
});

test("breaks paths around intermediate text node borders", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (a) at (0,0) {};
  \node (label) at (2,0) {Line 1};
  \node (b) at (4,0) {};
  \draw (a) -- (label) -- (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.equal(diagnostics.length, 0);
  assert.equal(path.commands.length, 4);
  assert.equal(path.commands[2].type, "moveTo");
  assert.ok(path.commands[1].x < ir.coordinates.label.x);
  assert.ok(path.commands[2].x > ir.coordinates.label.x);
});

test("keeps decimal coordinates distinct from numeric node anchors", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (1) at (6,-3.25) {};
  \draw[very thick, stealth-stealth] (1.5, 0) -- node[above] {\tt git pull} node[below] {\tt git push} (4.5, 0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerStart && item.style.markerEnd);
  const labels = ir.items.filter((item) => item.type === "textNode" && item.text.includes("git"));

  assert.deepEqual(diagnostics, []);
  assert.equal(arrow.commands[0].x, 1.5);
  assert.equal(arrow.commands[0].y, 0);
  assert.equal(arrow.commands.at(-1).x, 4.5);
  assert.equal(arrow.commands.at(-1).y, 0);
  const pull = labels.find((label) => label.text === String.raw`\tt git pull`);
  const push = labels.find((label) => label.text === String.raw`\tt git push`);
  assert.ok(pull && push, "expected both git labels");
  assert.equal(pull.x, 3);
  assert.equal(push.x, 3);
  assert.ok(pull.y > 0.18 && pull.y < 0.24, `expected pull label above path, got ${pull.y}`);
  assert.ok(push.y < -0.18 && push.y > -0.24, `expected push label below path, got ${push.y}`);
  assert.ok(Math.abs(pull.y + push.y) < 1e-6, `expected labels to be symmetric around path, got ${pull.y}, ${push.y}`);
});

test("clips curved to-path arrows against node borders", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, minimum width=0.5cm, minimum height=0.3cm] (a) at (0,0) {A};
  \node[draw, minimum width=0.5cm, minimum height=0.3cm] (b) at (2,0) {B};
  \draw[-stealth] (a) to[out=20,in=160] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const [sourceBox, targetBox] = ir.items.filter((item) => item.type === "nodeBox");
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const start = arrow.commands[0];
  const end = arrow.commands.at(-1);
  const outerSep = parseDimension("0.2pt");

  assert.deepEqual(diagnostics, []);
  assert.equal(end.type, "curveTo");
  assert.ok(start.x >= sourceBox.x + sourceBox.width / 2 + outerSep - 1e-6, `expected curve to start at source border, got ${start.x}`);
  assert.ok(Math.abs(end.x - (targetBox.x - targetBox.width / 2 - outerSep)) < 1e-6, `expected curve to end at target border, got ${end.x}`);
});

test("extends curved arrow tips past circular node borders by half the path width", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle,draw,minimum size=12pt,inner sep=0pt] (source) at (-2,1) {};
  \node[circle,draw,minimum size=25pt,inner sep=0pt] (target) at (0,0) {};
  \draw[->,thick] (source) to[out=0,in=150] (target);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const target = ir.items.find((item) => item.type === "nodeBox" && item.id === "target");
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const end = arrow.commands.at(-1);
  const defaultOuterSep = parseDimension("0.2pt");
  const arrowHalfWidth = TIKZ_LINE_WIDTHS.thick / TIKZ_UNIT / 2;
  const endRadius = Math.hypot(end.x - target.x, end.y - target.y);

  assert.deepEqual(diagnostics, []);
  assert.equal(end.type, "curveTo");
  expectClose(endRadius, target.width / 2 + defaultOuterSep + arrowHalfWidth);
});

test("approximates TikZ bend left and bend right edge arrows as curves", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw] (a) at (0,0) {A};
  \node[draw] (b) at (2,0) {B};
  \draw[-stealth] (a) edge[bend left=40] (b);
  \draw[-stealth] (a) edge[bend right=40] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const arrows = ir.items.filter((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(diagnostics, []);
  assert.equal(arrows.length, 2);
  assert.equal(arrows[0].commands.at(-1).type, "curveTo");
  assert.equal(arrows[1].commands.at(-1).type, "curveTo");
  assert.notEqual(Math.sign(arrows[0].commands.at(-1).y1), Math.sign(arrows[1].commands.at(-1).y1));
});

test("uses PGF to-path looseness control distance", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) to[out=0,in=180] (2,0);
  \draw (0,1) to[out=0,in=180,looseness=2] (2,1);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const [normal, loose] = ir.items.filter((item) => item.type === "path");
  const normalCurve = normal.commands.at(-1);
  const looseCurve = loose.commands.at(-1);

  assert.deepEqual(diagnostics, []);
  assert.equal(normalCurve.type, "curveTo");
  assert.ok(Math.abs(normalCurve.x1 - 0.783) < 1e-6, `expected PGF 0.3915 control arm, got ${normalCurve.x1}`);
  assert.ok(Math.abs(normalCurve.x2 - 1.217) < 1e-6, `expected mirrored PGF control arm, got ${normalCurve.x2}`);
  assert.ok(Math.abs(looseCurve.x1 - 1.566) < 1e-6, `expected looseness=2 to double out arm, got ${looseCurve.x1}`);
  assert.ok(Math.abs(looseCurve.x2 - 0.434) < 1e-6, `expected looseness=2 to double in arm, got ${looseCurve.x2}`);
});

test("curves looseness-only to paths between anchors on the same node", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, thick] (h1) {$\vec{h}_1$};
  \draw[-stealth] (h1.45) to[looseness=9] node[sloped, above] {$a$} (h1.90);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const curve = path.commands.at(-1);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "$a$");

  assert.deepEqual(diagnostics, []);
  assert.equal(curve.type, "curveTo");
  assert.ok(curve.x1 > path.commands[0].x, `expected TikZ default out=45 control point, got x1=${curve.x1}`);
  assert.ok(curve.y1 > path.commands[0].y, `expected TikZ default out=45 control point, got y1=${curve.y1}`);
  assert.ok(curve.x2 < curve.x, `expected TikZ default in=135 control point, got x2=${curve.x2}`);
  assert.ok(curve.y2 > curve.y, `expected TikZ default in=135 control point, got y2=${curve.y2}`);
  assert.ok(label.y > curve.y, `expected sloped label to sit on the outer loop, got ${label.y}`);
  assert.ok(label.rotation !== undefined, "expected curved sloped label to carry a rotation");
});

test("attaches bend edges to the border along the curve tangent, not the chord", () => {
  // Regression for gallery case 020: with a vertical chord, a bend must move the
  // departure point onto the bottom edge off the centre line. Chord-based clipping
  // would leave the arrow on the centre line (start.x == 0) and hook into the corner.
  const source = String.raw`
\begin{tikzpicture}
  \node[draw, minimum width=2cm, minimum height=1cm] (a) at (0,0) {A};
  \node[draw, minimum width=2cm, minimum height=1cm] (b) at (0,-3) {B};
  \draw[-stealth] (a) edge[bend left=45] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const [aBox] = ir.items.filter((item) => item.type === "nodeBox");
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const start = arrow.commands[0];
  const aBottom = aBox.y - aBox.height / 2 - parseDimension("0.2pt");

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(start.y - aBottom) < 1e-6, `expected bend to depart from bottom border, got y=${start.y} vs ${aBottom}`);
  assert.ok(Math.abs(start.x) > 1e-3, `expected bend tangent to shift departure off the chord centre, got x=${start.x}`);
});

test("applies edge-local snake decoration along bent arrows", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw] (a) at (0,0) {A};
  \node[draw] (b) at (2,0) {B};
  \draw[-stealth] (a) edge[bend left=40, decorate, decoration={snake, segment length=2mm, amplitude=0.3mm}] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const arrow = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const drawCommands = arrow.commands.filter((command) => command.type === "lineTo" || command.type === "curveTo");

  assert.deepEqual(diagnostics, []);
  assert.ok(drawCommands.length > 8, `expected snake to create many smooth edge segments, got ${drawCommands.length}`);
  assert.ok(
    drawCommands.some(
      (command) =>
        Math.abs(command.y) > 0.05 ||
        (Number.isFinite(command.y1) && Math.abs(command.y1) > 0.05) ||
        (Number.isFinite(command.y2) && Math.abs(command.y2) > 0.05),
    ),
  );
});

test("applies snake decoration to ellipse outlines", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[ultra thick, decorate, decoration={snake, segment length=1mm, amplitude=0.3mm}] (0,0) ellipse (0.23 and 3.05);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const outline = ir.items.find((item) => item.type === "path");
  const drawCommands = outline.commands.filter((command) => command.type === "lineTo" || command.type === "curveTo");

  assert.deepEqual(diagnostics, []);
  assert.ok(drawCommands.length > 80, `expected decorated ellipse to become many snake segments, got ${drawCommands.length}`);
  assert.ok(
    drawCommands.some(
      (command) =>
        Math.abs(Math.abs(command.x) - 0.23) > 0.005 ||
        (Number.isFinite(command.x1) && Math.abs(Math.abs(command.x1) - 0.23) > 0.005) ||
        (Number.isFinite(command.x2) && Math.abs(Math.abs(command.x2) - 0.23) > 0.005),
    ),
  );
});

test("projects path circles through TikZ picture basis vectors", () => {
  const source = String.raw`
\begin{tikzpicture}[y={(-0.86cm,0.5cm)},x={(0.86cm,0.5cm)}, z={(0cm,1cm)}]
  \draw circle (2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const circle = ir.items.find((item) => item.type === "path" && item.shape === "circle");
  const points = circle.commands.filter((command) => command.type === "moveTo" || command.type === "curveTo");
  const xs = points.map((command) => command.x);
  const ys = points.map((command) => command.y);

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 3.3, `expected projected circle width to follow x/y basis, got ${xs}`);
  assert.ok(Math.max(...ys) - Math.min(...ys) < 2.2, `expected projected circle height to be compressed, got ${ys}`);
});

test("uses scalar TikZ x and y basis dimensions for coordinates", () => {
  const source = String.raw`
\begin{tikzpicture}[x=6cm,y=2cm]
  \draw (1,1) -- (2,1);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 6, y: 2 },
    { type: "lineTo", x: 12, y: 2 }
  ]);
});

test("registers tikzmarknode anchors embedded in formula node text", () => {
  const source = String.raw`
\usetikzlibrary{tikzmark}
\begin{tikzpicture}
  \node {$\tikzmarknode{a}{a}+\tikzmarknode{b}{b}$};
  \draw (a.south) -- (b.north);
\end{tikzpicture}`;

  const result = tikzToSvg(source);
  const label = result.ir.items.find((item) => item.type === "textNode");
  const edge = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.ir.coordinates.a, "expected tikzmarknode a coordinate");
  assert.ok(result.ir.coordinates.b, "expected tikzmarknode b coordinate");
  assert.ok(result.ir.coordinates.a.x < result.ir.coordinates.b.x, "expected mark coordinates to follow formula order");
  assert.doesNotMatch(label.text, /tikzmarknode/);
  assert.deepEqual(edge.commands.map((command) => command.type), ["moveTo", "lineTo"]);
  assert.notDeepEqual(edge.commands[0], { type: "moveTo", x: 0, y: 0 });
});

test("scales path circle radii with the TikZ coordinate transform", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=0.85]
  \draw (0,0) circle (2.5cm);
  \draw[rotate=60] (0,0) -- (2.5,0) coordinate (B);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const circle = ir.items.find((item) => item.type === "path" && item.shape === "circle");
  const start = circle.commands.find((command) => command.type === "moveTo");
  const b = ir.coordinates.B;

  assert.deepEqual(diagnostics, []);
  assert.ok(Math.abs(start.x - 2.125) < 1e-6, `expected scaled circle radius 2.125, got ${start.x}`);
  assert.ok(Math.abs(Math.hypot(b.x, b.y) - 2.125) < 1e-6, `expected B to sit on the scaled circle, got ${JSON.stringify(b)}`);
});

test("scales path arc radii with the TikZ coordinate transform", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=0.85]
  \draw (1,0) arc (0:60:1);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const arc = ir.items.find((item) => item.type === "path" && item.shape === "arc");
  const end = arc.commands.at(-1);

  assert.deepEqual(diagnostics, []);
  assert.ok(arc, "expected scaled arc path");
  assert.ok(Math.abs(arc.commands[0].x - 0.85) < 1e-6, `expected scaled arc start x=0.85, got ${arc.commands[0].x}`);
  assert.ok(Math.abs(end.x - 0.425) < 1e-6, `expected scaled arc end x=0.425, got ${end.x}`);
  assert.ok(Math.abs(end.y - 0.736121593217) < 1e-6, `expected scaled arc end y=0.7361, got ${end.y}`);
});

test("keeps the PGF zigzag state machine active across a decorated edge", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (a) at (0,0) {};
  \node (b) at (2,0) {};
  \path[-stealth, decorate, decoration={zigzag, segment length=2mm, amplitude=0.3mm}] (a) edge[bend left] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path" && item.style.markerEnd);
  const lineCommands = path.commands.filter((command) => command.type === "lineTo");

  assert.deepEqual(diagnostics, []);
  assert.ok(lineCommands.length > 8, `expected zigzag edge to be flattened, got ${lineCommands.length}`);
  assert.ok(lineCommands.some((command) => Math.abs(command.y) > 0.03));
});

test("treats unitless path morphing dimensions as TeX points", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[decorate, decoration={zigzag, segment length=6, amplitude=2}] (0,0) -- (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");
  const yValues = path.commands.map((command) => command.y).filter(Number.isFinite);
  const xValues = path.commands.map((command) => command.x).filter(Number.isFinite);
  const maxOffset = Math.max(...yValues.map((value) => Math.abs(value)));

  assert.deepEqual(diagnostics, []);
  assert.ok(maxOffset > 0.04 && maxOffset < 0.09, `expected unitless amplitude=2 to mean 2pt, got ${maxOffset}cm`);
  assert.ok(
    xValues.some((value) => value > 0.04 && value < 0.07),
    "expected segment length=6 to create a native quarter-segment zigzag apex"
  );
});

test("registers directed inline path node anchors at the displayed node center", () => {
  const source = String.raw`
\begin{tikzpicture}
  \fill (0,0) circle (2pt) node[above] (p) {$P$};
  \draw (p.south) -- (1,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edge = ir.items.find((item) => item.type === "path" && !item.shape);
  const start = edge.commands[0];

  assert.deepEqual(diagnostics, []);
  assert.ok(ir.coordinates.p.y > 0.25, `expected named inline node center above origin, got ${ir.coordinates.p.y}`);
  assert.ok(start.y > -0.02, `expected p.south to stay near the origin, got ${start.y}`);
});

test("draws arrowed edge operations inside path statements", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw] (a) at (0,0) {A};
  \node[draw] (b) at (2,0) {B};
  \path[-stealth, thick] (a) edge[bend left=45] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edge = ir.items.find((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(diagnostics, []);
  assert.ok(edge, "expected path edge to produce a visible arrow");
  assert.equal(edge.commands.at(-1).type, "curveTo");
  assert.equal(edge.style.stroke, "black");
});

test("applies inline edge style options to the generated path", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node (a) at (0,0) {A};
  \node (b) at (1,0) {B};
  \draw (a) edge[very thick, draw=red, -{Stealth[color=orange, fill=red, width=8pt, length=10pt]}] (b);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edge = ir.items.find((item) => item.type === "path" && item.style.markerEnd);

  assert.deepEqual(diagnostics, []);
  assert.equal(edge.style.stroke, "red");
  assert.equal(edge.style.lineWidth, TIKZ_LINE_WIDTHS.veryThick);
  assert.equal(edge.style.markerEnd.stroke, "orange");
  assert.equal(edge.style.markerEnd.fill, "red");
});

test("renders edge operations attached to node statements", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, minimum size=1cm, inner sep=0] (a) at (0,0) {$a$};
  \node[circle, draw, minimum size=1cm, inner sep=0] (b) at (2,0) {$b$}
    edge[gray, thin, stealth-] (a);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edge = ir.items.find((item) => item.type === "path" && item.style.stroke === "gray");

  assert.deepEqual(diagnostics, []);
  assert.ok(edge, "expected node-attached edge to produce a path");
  assert.equal(edge.style.markerStart.kind, "stealth");
  const outerSep = parseDimension("0.2pt");
  assert.equal(edge.commands[0].type, "moveTo");
  expectClose(edge.commands[0].x, 1.5 - outerSep);
  expectClose(edge.commands[0].y, 0);
  assert.equal(edge.commands[1].type, "lineTo");
  expectClose(edge.commands[1].x, 0.5 + outerSep);
  expectClose(edge.commands[1].y, 0);
});

test("keeps repeated node-attached edges rooted at the source node", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[circle, draw, minimum size=1cm, inner sep=0] (a) at (0,0) {$a$};
  \node[circle, draw, minimum size=1cm, inner sep=0] (c) at (2,2) {$c$};
  \node[circle, draw, minimum size=1cm, inner sep=0] (b) at (2,0) {$b$}
    edge[gray, thin, stealth-] (a)
    edge[gray, thin, stealth-] (c);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const edges = ir.items.filter((item) => item.type === "path" && item.style.stroke === "gray");

  assert.deepEqual(diagnostics, []);
  assert.equal(edges.length, 2);
  const outerSep = parseDimension("0.2pt");
  const starts = edges.map((edge) => edge.commands[0]);
  assert.equal(starts[0].type, "moveTo");
  expectClose(starts[0].x, 1.5 - outerSep);
  expectClose(starts[0].y, 0);
  assert.equal(starts[1].type, "moveTo");
  expectClose(starts[1].x, 2);
  expectClose(starts[1].y, 0.5 + outerSep);
});

test("renders the circuitikz current shunt bipoles used by case 869", () => {
  const source = String.raw`
\begin{tikzpicture}[american, voltage shift=0.5]
  \draw (0,0)
    to[isource, l=$I_0$, v=$V_0$] (0,3)
    to[short, -*, i=$I_0$] (2,3)
    to[R=$R_1$, i>_=$i_1$] (2,0) -- (0,0);
  \draw (2,3) -- (4,3)
    to[R=$R_2$, i>_=$i_2$]
    (4,0) to[short, -*] (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const circuitPaths = ir.items.filter((item) => String(item.subtype || "").startsWith("circuitikz-"));
  const labels = ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const dots = ir.items.filter((item) => item.subtype === "circuitikz-terminal-dot");

  assert.deepEqual(diagnostics, []);
  assert.ok(circuitPaths.some((item) => item.subtype === "circuitikz-isource"), "expected current source symbol");
  assert.ok(circuitPaths.filter((item) => item.subtype === "circuitikz-resistor").length >= 2, "expected two resistor symbols");
  assert.ok(circuitPaths.filter((item) => item.subtype === "circuitikz-current-arrow").length >= 3, "expected current arrows");
  assert.equal(dots.length, 2);
  for (const label of ["$I_0$", "$V_0$", "$R_1$", "$R_2$", "$i_1$", "$i_2$"]) {
    assert.ok(labels.includes(label), `expected ${label} label`);
  }
});

test("renders circuitikz diamond and dot terminals used by case 1296", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0,0) to[R, d-*] (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const resistor = ir.items.find((item) => item.subtype === "circuitikz-resistor");
  const diamond = ir.items.find((item) => item.subtype === "circuitikz-terminal-diamond");
  const dots = ir.items.filter((item) => item.subtype === "circuitikz-terminal-dot");

  assert.deepEqual(diagnostics, []);
  assert.ok(resistor, "expected R to render as a resistor even without a label");
  assert.ok(diamond, "expected d-* to create a diamond terminal at the start");
  assert.equal(dots.length, 1);
  expectClose(diamond.commands[0].x, 0);
  expectClose(diamond.commands[0].y, 0.08);
  expectClose(dots[0].cx, 2);
});

test("renders circuitikz inductor styles and the variable-inductor arrow", () => {
  const source = String.raw`
\documentclass{standalone}
\usepackage{circuitikz}
\begin{document}
\begin{tikzpicture}
  \draw (0,1.5) to[L,l=$L_{\mathrm{cute}}$] ++(4,0);
  \draw (0,0) to[cute inductor, inductors/scale=.75,
    inductors/width=1.6, inductors/coils=9, l=$L_{\mathrm{long}}$] ++(4,0);
  \ctikzset{inductor=american, inductors/scale=1.5}
  \draw (0,-1.5) to[L,l=$L_{\mathrm{american}}$] ++(4,0);
  \ctikzset{inductor=european, inductors/scale=1}
  \draw (0,-3) to[vL,l=$L_{\mathrm{variable}}$] ++(4,0);
\end{tikzpicture}
\end{document}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const inductors = ir.items.filter((item) => item.subtype === "circuitikz-inductor");
  const tunable = ir.items.find((item) => item.subtype === "circuitikz-inductor-tunable-arrow");
  const labels = ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const variableLabel = ir.items.find((item) => item.type === "textNode" && item.text === "$L_{\\mathrm{variable}}$");

  assert.deepEqual(diagnostics, []);
  assert.equal(inductors.length, 4);
  assert.deepEqual(inductors.map((item) => item.inductorKind), ["cute", "cute", "american", "european"]);
  assert.deepEqual(inductors.map((item) => item.coils), [5, 9, 4, 0]);
  assert.ok(tunable?.style?.markerEnd, "expected the variable-inductor tuning arrow");
  assert.equal(tunable.style.markerEnd.kind, "latexslim");
  assert.ok(tunable.commands[1].y - tunable.commands[0].y > 0.95, "expected the European tuning arrow to span the full generic body height");
  assert.ok(variableLabel.y > tunable.commands[1].y + 0.25, "expected the variable-inductor label to clear its tuning arrow");
  for (const label of ["$L_{\\mathrm{cute}}$", "$L_{\\mathrm{long}}$", "$L_{\\mathrm{american}}$", "$L_{\\mathrm{variable}}$"]) {
    assert.ok(labels.includes(label), `expected ${label} label`);
  }
});

test("renders circuitikz cute chokes and exposes named inductor core anchors", () => {
  const source = String.raw`
\begin{tikzpicture}[american]
  \draw (0,0) to[cute choke, name=K1] ++(3,0);
  \draw (0,-1) to[cute choke, twolineschoke, name=K2] ++(3,0);
  \ctikzset{bipoles/cutechoke/cthick=2, twolineschoke}
  \draw (0,-2) to[cute choke, name=K3] ++(3,0);
  \draw (0,-3) to[cute choke, onelinechoke, name=K4] ++(3,0);

  \ctikzset{american}
  \draw (4,0) to[L, name=A] ++(2,0);
  \draw[thick] (A.core west) -- (A.core east);
  \ctikzset{cute inductors}
  \draw (4,-1.5) to[L, name=C] ++(2,0);
  \draw[densely dashed] (C.core west) -- (C.core east);
  \ctikzset{european, bipoles/inductors/core distance=4pt}
  \draw (4,-3) to[L, name=E] ++(2,0);
  \draw[thick, double] (E.core west) -- (E.core east);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const chokes = ir.items.filter((item) => item.subtype === "circuitikz-choke");
  const cores = ir.items.filter((item) => item.subtype === "circuitikz-choke-core");
  const inductors = ir.items.filter((item) => item.subtype === "circuitikz-inductor");
  const userCoreLines = ir.items.filter((item) => item.type === "path" && !item.subtype && item.commands?.length === 2);

  assert.deepEqual(diagnostics, []);
  assert.equal(chokes.length, 4);
  assert.deepEqual(
    inductors.map((item) => item.inductorKind),
    ["american", "cute", "european"],
    "expected later \\ctikzset style switches to override the tikzpicture's initial american default"
  );
  assert.deepEqual(cores.map((item) => item.coreIndex), [1, 1, 2, 1, 2, 1]);
  assert.ok(cores[3].style.lineWidth > cores[0].style.lineWidth, "expected cthick=2 to widen the choke core");
  assert.equal(userCoreLines.length, 3, "expected all three manual core-anchor lines");
  for (const name of ["A", "C", "E"]) {
    assert.ok(ir.coordinates[`${name}.core west`], `expected ${name}.core west`);
    assert.ok(ir.coordinates[`${name}.core east`], `expected ${name}.core east`);
    assert.ok(ir.coordinates[`${name}.core west`].x < ir.coordinates[`${name}.core east`].x, `expected ${name} core anchors in wire order`);
    assert.ok(ir.coordinates[`${name}.core west`].y > ir.coordinates[name].y, `expected ${name} core anchors above the coil`);
  }
  assert.ok(
    ir.coordinates["E.core west"].y - ir.coordinates.E.y > ir.coordinates["C.core west"].y - ir.coordinates.C.y,
    "expected the 4pt per-inductor core distance to raise E's core line"
  );
});

test("keeps circuitikz bipole path arrows on the post-component lead used by case 860", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[<->] (0,0) to[R] ++(3,0) node[npn, anchor=B]{};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const arrowedPaths = ir.items.filter((item) => item.type === "path" && (item.style?.markerStart || item.style?.markerEnd));
  const resistor = ir.items.find((item) => item.subtype === "circuitikz-resistor");
  const postLead = arrowedPaths.find((item) => {
    const first = item.commands?.[0];
    const last = item.commands?.at(-1);
    return first?.type === "moveTo" && last?.type === "lineTo" && first.x > 2 && last.x > first.x;
  });

  assert.deepEqual(diagnostics, []);
  assert.ok(resistor, "expected resistor symbol");
  assert.equal(resistor.style.markerStart, undefined);
  assert.equal(resistor.style.markerEnd, undefined);
  assert.ok(postLead, "expected arrowed lead after the resistor");
  assert.ok(postLead.style.markerStart, "expected reverse arrow at the component-side lead");
  assert.ok(postLead.style.markerEnd, "expected forward arrow at the transistor-side lead");
  assert.ok(!arrowedPaths.some((item) => item.commands?.[0]?.x === 0), "should not put a circuitikz arrow at the absolute path start");
});

test("applies circuitikz shorten <= to the post-component lead used by case 860", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[shorten <=10pt] (0,0) to[R] ++(3,0) node[npn, anchor=B]{};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const wire = ir.items.find((item) =>
    item.type === "path" &&
    !item.subtype &&
    item.commands?.some((command) => command.type === "moveTo" && command.x > 2)
  );
  const postLeadStart = wire?.commands?.find((command) => command.type === "moveTo" && command.x > 2);

  assert.deepEqual(diagnostics, []);
  assert.ok(wire, "expected split wire path");
  expectClose(postLeadStart.x, 2.06 + parseDimension("10pt", {}));
  expectClose(postLeadStart.y, 0);
});

test("renders circuitikz siunitx and RP voltage arrows used by case 863", () => {
  const source = String.raw`
\documentclass[border=4mm]{standalone}
\usepackage[siunitx,RPvoltages]{circuitikz}
\begin{document}
\begin{tikzpicture}
\draw (0,0) to[R=2<\ohm>, i=?, v=84<\volt>] (2,0) --
    (2,2) to[V<=84<\volt>] (0,2)
    -- (0,0);
\end{tikzpicture}
\end{document}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = ir.items.filter((item) => item.type === "textNode");
  const labelText = labels.map((item) => item.text);
  const question = labels.find((item) => item.text === "?");
  const voltageArrows = ir.items.filter((item) => item.subtype === "circuitikz-voltage-arrow");
  const currentArrow = ir.items.find((item) => item.subtype === "circuitikz-current-arrow");

  assert.deepEqual(diagnostics, []);
  assert.ok(labelText.includes("2 Ω"), "expected siunitx resistor label");
  assert.equal(labelText.filter((text) => text === "84 V").length, 2);
  assert.ok(labelText.every((text) => !String(text).includes("<")), "expected unit angle syntax to be normalized");
  assert.ok(!labelText.includes("+"));
  assert.ok(!labelText.includes("-"));
  assert.equal(voltageArrows.length, 2);
  assert.ok(voltageArrows.every((item) => item.style?.markerEnd), "expected RP voltage arrows to use arrow tips");
  assert.ok(question?.x > 1.55, `expected current label near the right lead, got x=${question?.x}`);
  assert.ok(currentArrow?.commands?.some((command) => Number(command.x) > 1.55), "expected current arrow near the right lead");
});

test("renders american circuitikz voltage-source polarity inside the source circle", () => {
  const source = String.raw`
\usepackage[siunitx,RPvoltages]{circuitikz}
\begin{circuitikz}[american]
  \draw (2,0) to[V<=5<\volt>] (0,0);
\end{circuitikz}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const symbols = ir.items.filter((item) => item.type === "textNode");
  const plus = symbols.find((item) => item.text === "+");
  const minus = symbols.find((item) => item.text === "-");
  const sourceLine = ir.items.find((item) => item.subtype === "circuitikz-voltage-source-line");

  assert.deepEqual(diagnostics, []);
  assert.ok(plus?.x < 1, `expected backward V< plus terminal on the target side, got x=${plus?.x}`);
  assert.ok(minus?.x > 1, `expected backward V< minus terminal on the source side, got x=${minus?.x}`);
  assert.equal(sourceLine, undefined, "american voltage sources use +/- symbols rather than a central line");
});

test("places circuitikz voltage and annotation labels on their explicit sides", () => {
  const source = String.raw`
\documentclass[tikz]{standalone}
\usepackage[RPvoltages]{circuitikz}
\begin{document}
\begin{tikzpicture}
  \draw (0,0) to[R={$R_1$}, v^>={$V_R$}] (3,0)
    to[C={$C_1$}, a^={$\tau=R_1C_1$}] (3,-2);
\end{tikzpicture}
\end{document}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const labels = ir.items.filter((item) => item.type === "textNode");
  const voltage = labels.find((item) => item.text === "$V_R$");
  const annotation = labels.find((item) => item.text === "$\\tau=R_1C_1$");

  assert.deepEqual(diagnostics, []);
  assert.ok(voltage?.y > 0, `expected v^ voltage label above the horizontal bipole, got y=${voltage?.y}`);
  assert.ok(annotation?.x > 3.5, `expected a^ annotation to extend right from the downward bipole, got x=${annotation?.x}`);
});

test("renders circuitikz flow ornaments used by case 871", () => {
  const source = String.raw`
\begin{tikzpicture}[american, voltage shift=0.5]
  \draw (0,0)
    to[isource, l=$I_0$, v=$V_0$] (0,3)
    to[short, -*, f=$I_0$] (2,3)
    to[R=$R_1$, f>_=$i_1$] (2,0) -- (0,0);
  \draw (2,3) -- (4,3)
    to[R=$R_2$, f>_=$i_2$]
    (4,0) to[short, -*] (2,0);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const flowArrows = ir.items.filter((item) => item.subtype === "circuitikz-flow-arrow");
  const labels = ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(diagnostics, []);
  assert.equal(flowArrows.length, 3);
  for (const label of ["$I_0$", "$i_1$", "$i_2$"]) {
    assert.ok(labels.includes(label), `expected ${label} flow label`);
  }
});

test("renders circuitikz op amp feedback circuit used by case 875", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=0.8, transform shape]
  \ctikzset{amplifiers/fill=cyan!20, component text=left}
  \draw (0,0) node[above]{$v_i$} to[short, o-] ++(1,0)
    node[op amp, noinv input up, anchor=+](OA){\texttt{OA1}}
    (OA.-) -- ++(0,-1) coordinate(FB)
    to[R=$R_1$] ++(0,-2) node[ground]{}
    (FB) to[R=$R_2$, *-] (FB -| OA.out) -- (OA.out)
    to[short, *-o] ++(1,0) node[above]{$v_o$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const opAmp = ir.items.find((item) => item.subtype === "circuitikz-op-amp");
  const ground = ir.items.find((item) => item.subtype === "circuitikz-ground");
  const openTerminals = ir.items.filter((item) => item.subtype === "circuitikz-terminal-open");
  const filledTerminals = ir.items.filter((item) => item.subtype === "circuitikz-terminal-dot");
  const resistors = ir.items.filter((item) => item.subtype === "circuitikz-resistor");
  const componentLabel = ir.items.find((item) => item.type === "textNode" && item.text === String.raw`\texttt{OA1}`);
  const horizontalResistor = resistors.find((item) => {
    const xs = item.commands.map((command) => command.x).filter(Number.isFinite);
    const ys = item.commands.map((command) => command.y).filter(Number.isFinite);
    return Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys);
  });

  assert.deepEqual(diagnostics, []);
  assert.ok(opAmp, "expected op amp triangle node");
  assert.match(opAmp.style.fill, /rgb\(/);
  assert.ok(opAmp.width > 1.3 && opAmp.width < 1.45, `expected scaled op amp width near circuitikz default, got ${opAmp.width}`);
  assert.ok(componentLabel && componentLabel.x < opAmp.x, "expected left-biased component label");
  assert.ok(ground, "expected ground symbol");
  assert.equal(openTerminals.length, 2);
  assert.equal(filledTerminals.length, 2);
  assert.equal(resistors.length, 2);
  assert.ok(horizontalResistor, "expected R2 to resolve through OA.out into a horizontal resistor");
  const horizontalYs = horizontalResistor.commands.map((command) => command.y).filter(Number.isFinite);
  assert.ok(Math.max(...horizontalYs) - Math.min(...horizontalYs) < 0.5, "expected R2 resistor body to stay horizontal under picture scale");
});

test("renders circuitikz MOSFET path components and gate anchors used by case 1039", () => {
  const source = String.raw`
\begin{tikzpicture}
\draw[yscale=1.1, xscale=.8]
  (2,4.5) -- (0,4.5) to[Tpmos=p1, n=p1] (0,3)
     to[Tnmos=n1, n=n1] (0,1.5)
     to[Tnmos=n2, n=n2] (0,0) node[ground] {}
  (2,4.5) to[Tpmos=p2,n=p2] (2,3) to[short, -*] (0,3)
  (p1.G) -- (n1.G) to[short, *-o] ($(n1.G)+(3,0)$)
  (n2.G) ++(2,0) node[circ] {} -| (p2.G)
  (n2.G) to[short, -o] ($(n2.G)+(3,0)$)
  (0,3) to[short, -o] (-1,3)
;
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const mosfets = ir.items.filter((item) => item.subtype === "circuitikz-mosfet");
  const openTerminals = ir.items.filter((item) => item.subtype === "circuitikz-terminal-open");
  const filledTerminals = ir.items.filter((item) => item.subtype === "circuitikz-terminal-dot");
  const gateWire = ir.items.find((item) =>
    item.type === "path" &&
    item.commands.some((command) => Number(command.x) > 3) &&
    item.commands.some((command) => Number(command.y) > 1 && Number(command.y) < 2)
  );

  assert.deepEqual(diagnostics, []);
  assert.equal(mosfets.length, 4);
  assert.ok(mosfets.some((item) => item.mosfetKind === "pmos"), "expected PMOS symbols");
  assert.ok(mosfets.some((item) => item.mosfetKind === "nmos"), "expected NMOS symbols");
  assert.ok(openTerminals.length >= 3, "expected open output/input terminals");
  assert.ok(filledTerminals.length >= 3, "expected connection dots");
  assert.ok(gateWire, "expected wires to resolve from MOSFET .G anchors");
});

test("renders circuitikz triode amplifier components used by case 1041", () => {
  const source = String.raw`
\begin{tikzpicture}
\draw (0,0) node (start) {}
                to[sV=$V_i$] ++(0,2+\ctikzvalof{tubes/height})
                to[C=$C_i$] ++(2,0) coordinate(Rg)
                to[R=$R_g$] (Rg |- start)
(Rg)            to[short,*-] ++(1,0)
                node[triode,anchor=control] (Tri) {} ++(2,0)
(Tri.cathode)   to[R=$R_c$,-*] (Tri.cathode |- start)
(Tri.anode)     to [R=$R_a$] ++(0,2)
                to [short] ++(3.5,0) node(Vatop) {}
                to [V<=$V_a$] (Vatop |- start)
                to [short] (start)
(Tri.anode)     ++(0,0.2) to[C=$C_o$,*-o] ++(2,0)
(Tri.cathode)   ++(0,-0.2) to[short,*-] ++(1.5,0) node(Cctop) {}
                to[C=$C_c$,-*] (start -| Cctop)
;
\draw[red,thin,dashed] (Tri.north west) rectangle (Tri.south east);
\draw (Tri.east) node[right] {12AX7};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const capacitors = ir.items.filter((item) => item.subtype === "circuitikz-capacitor");
  const voltageSources = ir.items.filter((item) => item.subtype === "circuitikz-voltage-source");
  const triode = ir.items.find((item) => item.subtype === "circuitikz-triode");
  const labels = ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const paths = ir.items.filter((item) => item.type === "path");
  const svg = tikzToSvg(source, { mathRenderer: "svg-text" }).svg;

  assert.deepEqual(diagnostics, []);
  assert.equal(capacitors.length, 3);
  assert.equal(voltageSources.length, 2);
  assert.ok(triode, "expected triode tube node");
  assert.ok(ir.coordinates["Tri.anode"].y > ir.coordinates.Tri.y, "expected anode anchor above triode center");
  assert.ok(ir.coordinates["Tri.cathode"].y < ir.coordinates.Tri.y, "expected cathode anchor below triode center");
  assert.ok(ir.coordinates["Tri.control"].x < ir.coordinates.Tri.x, "expected control anchor left of triode center");
  assert.ok(labels.includes("12AX7"), "expected tube label");
  assert.ok(paths.some((path) => path.commands.some((command) => Number(command.y) > 4)), "expected upper anode rail to stay high");
  assert.match(svg, /tikz-node-circuitikzTriode/);
});

test("renders circuitikz pentode tube anchors and partial border labels used by case 1043", () => {
  const source = String.raw`
\begin{tikzpicture}[circuitikz/tubes/fill=cyan!20,
            circuitikz/tubes/partial borders=121212]
\draw (0,0) node[pentode,anchor=control](V){};
\draw (4,0) node[pentode,anchor=control,
            circuitikz/tubes/width=1.4,
            circuitikz/tubes/height=1](H){};
\draw[red, font=\ttfamily\small\bfseries]
                ([shift={(-.2,-.2)}]V.ne) node{1}
                ([shift={(.1,0)}]V.e) node{2}
                ([shift={(-.2,.2)}]V.se) node{3}
                ([shift={(.2,.2)}]V.sw) node{4}
                ([shift={(-.1,0)}]V.w) node{5}
                ([shift={(.2,-.2)}]V.nw) node{6}
                ([shift={(.2,-.2)}]H.nw) node{1}
                ([shift={(0,.1)}]H.n) node{2}
                ([shift={(-.2,-.2)}]H.ne) node{3}
                ([shift={(-.2,.2)}]H.se) node{4}
                ([shift={(0,-.1)}]H.s) node{5}
                ([shift={(.2,.2)}]H.sw) node{6}
                ;
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const pentodes = ir.items.filter((item) => item.subtype === "circuitikz-pentode");
  const labels = ir.items.filter((item) => item.type === "textNode" && /^[1-6]$/.test(item.text));
  const svg = tikzToSvg(source, { mathRenderer: "svg-text" }).svg;

  assert.deepEqual(diagnostics, []);
  assert.equal(pentodes.length, 2);
  assert.equal(labels.length, 12);
  assert.ok(ir.coordinates["V.ne"].x > ir.coordinates.V.x, "expected short ne anchor on right side of V");
  assert.ok(ir.coordinates["V.nw"].x < ir.coordinates.V.x, "expected short nw anchor on left side of V");
  assert.ok(ir.coordinates["H.e"].x > ir.coordinates.H.x, "expected short e anchor on right side of H");
  assert.ok(labels.some((label) => label.x < ir.coordinates.V.x && label.y > ir.coordinates.V.y), "expected labels around V northwest side");
  assert.ok(labels.some((label) => label.x > ir.coordinates.H.x && label.y > ir.coordinates.H.y), "expected labels around H northeast side");
  assert.match(svg, /tikz-node-circuitikzPentode/);
  assert.match(svg, /fill="rgb\(204 255 255\)"/);
});

test("expands circuitikz quadpole anchor macro pins used by case 1056", () => {
  const source = String.raw`
\begin{tikzpicture}[cute inductors]
\def\coordx(#1)[#2:#3]#4{node[circle, #4, draw, inner sep=1pt,pin={[#4, overlay, inner sep=0.5pt, font=\scriptsize, pin distance=#2cm, pin edge={#4, overlay,}]#3:#1}](#1){}}
  \foreach \comp/\pos/\case in {transformer/0/0,transformer core/4/1,gyrator/8/2}{
    \draw (\pos,0) node[\comp](T){};
    \ifcase\case
      \foreach \a/\d/\t in {inner dot A1/0.2/75, inner dot A2/0.2/-75, inner dot B1/0.1/-45, inner dot B2/0.1/45}
      \path (T.\a) \coordx(\a)[\d:\t]{red};
    \or
      \foreach \a/\d/\t in {outer dot A1/0.2/75, outer dot A2/0.2/-75, outer dot B1/0.2/-45, outer dot B2/0.2/45}
      \path (T.\a) \coordx(\a)[\d:\t]{blue};
    \or
      \foreach \a/\t in {A1/120, A2/-120, B1/120, B2/-120, base/-90}
      \path (T.\a) \coordx(\a)[0.2:\t]{green!50!black};
    \fi
  }
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const quadpoles = ir.items.filter((item) => item.type === "nodeBox" && String(item.subtype || "").startsWith("circuitikz-quadpole"));
  const pinTexts = ir.items.filter((item) => item.type === "textNode").map((item) => item.text);
  const pinEdges = ir.items.filter((item) => item.subtype === "pin-edge");

  assert.deepEqual(diagnostics, []);
  assert.equal(quadpoles.length, 3);
  assert.ok(quadpoles.some((item) => item.shapeData?.quadpoleKind === "transformer"));
  assert.ok(quadpoles.some((item) => item.shapeData?.quadpoleKind === "transformer core"));
  assert.ok(quadpoles.some((item) => item.shapeData?.quadpoleKind === "gyrator"));
  for (const name of ["inner dot A1", "outer dot A2", "A1", "base"]) {
    assert.ok(pinTexts.includes(name), `expected pin text ${name}`);
  }
  assert.ok(ir.coordinates["T.inner dot A1"], "expected transformer inner dot anchor");
  assert.ok(ir.coordinates["T.outer dot B2"], "expected transformer core outer dot anchor");
  assert.ok(ir.coordinates["T.base"], "expected gyrator base anchor");
  assert.ok(
    pinEdges.every((edge) => {
      const [from, to] = edge.commands;
      return Math.hypot(to.x - from.x, to.y - from.y) > 0.08;
    }),
    "expected macro-expanded pin distances to produce visible pin edges"
  );
});

test("registers circuitikz transformer coil subnode anchors used by case 1065", () => {
  const source = String.raw`
\begin{tikzpicture}[american]
\begin{scope}
  \ctikzset{transformer L1/.style={inductors/coils=1, inductors/width=0.2}}
  \draw (0,0) node[transformer core](T1){};
\end{scope}
\draw (3,0) node[transformer](T2){};
\ctikzset{cute inductors, quadpoles style=inline}
\ctikzset{transformer L1/.style={inductors/coils=2, inductors/width=0.2}}
\draw (6,0) node[transformer core](T3){};
\ctikzset{transformer L1/.style={american inductors, inductors/coils=1, inductors/width=0.2}}
\ctikzset{transformer L2/.style={inductors/coils=7, inductors/width=1.0}}
\draw (9,0) node[transformer](T4){};
\foreach \t in {T1, T2, T3, T4} {
  \foreach \l in {L1, L2} {
    \foreach \a/\c in {a/blue, b/red}
    \node [circle, fill=\c, inner sep=1pt] at (\t-\l.\a) {};
  }
}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const boxes = Object.fromEntries(ir.items.filter((item) => item.type === "nodeBox" && item.id).map((item) => [item.id, item]));
  const markerDots = ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circle" && !item.id);
  const dotPositions = new Set(markerDots.map((item) => `${item.x.toFixed(3)},${item.y.toFixed(3)}`));

  assert.deepEqual(diagnostics, []);
  assert.equal(markerDots.length, 16);
  assert.equal(dotPositions.size, 16);
  for (const name of ["T1-L1.a", "T1-L1.b", "T2-L2.a", "T3-L1.a", "T4-L2.b"]) {
    assert.ok(ir.coordinates[name], `expected transformer coil anchor ${name}`);
  }
  assert.ok(boxes.T3.width < boxes.T2.width, `expected inline quadpole style to narrow T3, got T3=${boxes.T3.width}, T2=${boxes.T2.width}`);
  assert.ok(ir.coordinates["T4-L2.b"].y < ir.coordinates["T4-L2.a"].y, "expected L2 b anchor below L2 a anchor");
});

test("places inline nodes after rectangle path operations on the rectangle edge", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw (0.6,2.1) rectangle (4.2,3.8) node[pos=0.5, above]{KCL};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "KCL");

  assert.deepEqual(diagnostics, []);
  assert.ok(label);
  assert.ok(Math.abs(label.x - 2.4) < 1e-6);
  assert.ok(label.y > 3.0);
  assert.ok(label.y < 3.8);
});

test("applies xslant/yslant shear and pt-based yshift in scope transforms", () => {
  // Claude: 锁定 yslant/xslant 斜切与 yshift 的裸数字按 pt 解析（修复多层网络伪三维图，如 case 043）。
  const source = String.raw`
\begin{tikzpicture}
  \begin{scope}[yslant=0.5,xslant=-0.6]
    \draw (1,0) -- (0,1);
  \end{scope}
  \begin{scope}[yshift=28.4527559]
    \draw (0,0) -- (1,0);
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  assert.equal(diagnostics.length, 0);
  // xslant=-0.6 / yslant=0.5 把 (x,y) 剪成 (x-0.6y, 0.5x+y)
  assert.deepEqual(ir.items[0].commands, [
    { type: "moveTo", x: 1, y: 0.5 },
    { type: "lineTo", x: -0.6, y: 0.7 }
  ]);
  // yshift=28.4527559(裸数字)= 28.45pt = 1cm, 而不是 28.45cm
  assert.deepEqual(ir.items[1].commands, [
    { type: "moveTo", x: 0, y: 1 },
    { type: "lineTo", x: 1, y: 1 }
  ]);
});

test("uses rendered tensor matrix dimensions for node anchors", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=0.58]
\tikzset{mybox/.style={text=black, very thick, rectangle, rounded corners, inner sep=10pt, inner ysep=20pt}}
\node [mybox, scale=1.0] (box) at (10.5, 2) {\[
  {\mathbf M} = {\left[
  \begin{matrix}
    \left[\overmat{Layer 1}{\begin{matrix}1 & 0 & 0\\1 & 0 & 1\\1 & 0 & 0\end{matrix}}{red}\right] &
    \left[\overmat{1 $\rightarrow$ 2}{\begin{matrix}1 & 0 & 0\\0 & 1 & 0\\0 & 0 & 0\end{matrix}}{gray}\right]\\
    \left[\undermat{2 $\rightarrow$ 1}{\begin{matrix}0 & 0 & 0\\1 & 0 & 0\\0 & 0 & 0\end{matrix}}{gray}\right] &
    \left[\undermat{Layer 2}{\begin{matrix}0 & 1 & 1\\1 & 0 & 0\\1 & 0 & 0\end{matrix}}{echodrk}\right]
  \end{matrix}\right]}\]
};
\node[scale=0.8] at (box.north) {\bf Tensor form:};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const title = ir.items.find((item) => item.type === "textNode" && item.text === String.raw`\bf Tensor form:`);

  assert.deepEqual(diagnostics, []);
  assert.ok(title, "expected title node");
  assert.ok(title.y > 2.1 && title.y < 3.1, `expected tensor title to attach to the rendered matrix box, got y=${title.y}`);
});

test("uses leading math font size macros when sizing circular nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw,circle,minimum size=10pt,inner sep=0pt] (x0) at (0,0) {$\tiny +1$};
  \node[draw,circle,minimum size=10pt,inner sep=0pt] (x1) at (1,0) {$\tiny x_1$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const circles = ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circle");

  assert.deepEqual(diagnostics, []);
  assert.equal(circles.length, 2);
  for (const circle of circles) {
    assert.ok(circle.width > 0.34 && circle.width < 0.37, `expected tiny math circle to stay near 10pt, got ${circle.width}`);
    assert.equal(circle.width, circle.height);
  }
});

test("inherits standalone xcolor declarations through draws and nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \color{blue}
  \draw (0,0) -- (1,0);
  \node at (0.5,0.25) {$x$};
  \begin{scope}
    \color{red}
    \draw (0,1) -- (1,1);
  \end{scope}
  \draw (0,2) -- (1,2);
\end{tikzpicture}`;
  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "$x$");

  assert.deepEqual(diagnostics, []);
  assert.equal(paths.length, 3);
  assert.equal(paths[0].style.stroke, "blue");
  assert.equal(paths[1].style.stroke, "red");
  assert.equal(paths[2].style.stroke, "blue");
  assert.equal(label?.style.fill, "blue");
});

test("keeps simple math subscripts inside compact minimum-size circles", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw,circle,minimum size=10pt,inner sep=0pt] (x1) at (0,0) {$x_1$};
  \node[draw,circle,minimum size=10pt,inner sep=0pt] (y9) at (1,0) {$y_9$};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const circles = ir.items.filter((item) => item.type === "nodeBox" && item.shape === "circle");

  assert.deepEqual(diagnostics, []);
  assert.equal(circles.length, 2);
  for (const circle of circles) {
    assert.ok(circle.width > 0.39 && circle.width < 0.43, `expected compact script circle near TeX's 12pt diameter, got ${circle.width}`);
    assert.equal(circle.width, circle.height);
  }
});

test("scales TikZ grid step with picture coordinate scale", () => {
  const source = String.raw`
\begin{tikzpicture}[scale=3]
  \draw[step=1cm] (-1.2,0.2) grid (1.2,1.2);
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const gridLines = ir.items.filter((item) => item.subtype === "grid-line");
  const verticals = gridLines.filter((item) => item.commands[0].x === item.commands[1].x);
  const horizontals = gridLines.filter((item) => item.commands[0].y === item.commands[1].y);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(verticals.map((line) => line.commands[0].x), [-3, 0, 3]);
  assert.deepEqual(horizontals.map((line) => line.commands[0].y), [3]);
});

test("supports per-plot options and polar basis vectors for calibration cases", () => {
  const source = String.raw`
\begin{tikzpicture}[x=(30:1),y=(90:1)]
  \draw[samples=3,variable=\t] plot[domain=0:2] (\t,{\t});
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const plot = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(plot.commands.length, 3);
  assert.deepEqual(plot.commands[0], { type: "moveTo", x: 0, y: 0 });
  assert.deepEqual(plot.commands[2], { type: "lineTo", x: 1.73205, y: 3 });
});

test("samples PGF plot expressions with radian trig suffixes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[samples=9,variable=\t] plot[domain=0:6.28318530718] ({cos(3*\t r)*cos(\t r)},{cos(3*\t r)*sin(\t r)});
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const plot = ir.items.find((item) => item.type === "path");
  const ys = plot.commands.map((command) => Math.abs(command.y || 0));

  assert.deepEqual(diagnostics, []);
  assert.equal(plot.commands.length, 9);
  assert.ok(Math.max(...ys) > 0.45, `expected radian polar plot to produce petals, got ${JSON.stringify(plot.commands)}`);
});

test("samples TikZ plot function curves and applies scoped transforms", () => {
  const source = String.raw`
\begin{tikzpicture}[domain=-0.25:9,xscale=0.8,yscale=5]
  \def\A{-3}; \def\B{0.8};
  \draw[thick] plot[id=x] function{1/(1+exp(-\A-\B*x))};
  \begin{scope}[xshift=2cm,rotate=90]
    \filldraw[fill opacity=0.3,fill=gray!70!black]
      plot[domain=(0.5-0.25):(0.5+0.25),samples=9]
      function {-0.14*gamma(40)/(gamma(40*0.5)*gamma((1-0.5)*40))*x**(0.5*40-1)*(1-x)**((1-0.5)*40-1)};
  \end{scope}
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const paths = ir.items.filter((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(paths.length, 2);
  assert.equal(paths[0].commands.length, 25);
  assert.ok(paths[0].commands.at(-1).y > paths[0].commands[0].y, "expected logistic plot to rise");
  assert.equal(paths[1].commands.length, 9);
  assert.ok(paths[1].commands.some((command) => command.x < 2), "expected rotated beta density to extend left from the shifted baseline");
  assert.equal(paths[1].style.fill, "rgb(90 90 90)");
  assert.equal(paths[1].style.fillOpacity, 0.3);
});

test("renders TikZ ycomb plot function samples as stems from the x-axis", () => {
  const source = String.raw`
\begin{tikzpicture}
  \draw[ycomb,samples=3,domain=0:2] plot function {x-1};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual(diagnostics, []);
  assert.equal(path.commands.length, 6);
  assert.deepEqual(path.commands.map((command) => command.type), ["moveTo", "lineTo", "moveTo", "lineTo", "moveTo", "lineTo"]);
  assert.deepEqual(
    path.commands.map((command) => [command.x, command.y]),
    [
      [0, 0],
      [0, -1],
      [1, 0],
      [1, 0],
      [2, 0],
      [2, 1]
    ]
  );
});

test("treats bare directional node offsets as TeX points", () => {
  const source = String.raw`
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \path (A) node[right=5] {pt};
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const label = ir.items.find((item) => item.type === "textNode" && item.text === "pt");

  assert.deepEqual(diagnostics, []);
  assert.ok(label.x > 0.1 && label.x < 0.7, `expected right=5 to be a small pt offset, got ${label.x}`);
});

test("executes tikzset code args and ifnum conditionals inside macro-expanded scopes", () => {
  const source = String.raw`
\tikzset{
  start date/.code args={#1/#2}{\def\dstart{#1}\def\mstart{#2}},
  end date/.code args={#1/#2}{\def\dend{#1}\def\mend{#2}},
  event color/.style={fill=#1!50,draw=#1}
}
\newcommand{\eventpoint}[2][]{
  \begin{scope}[#1]
    \pgfmathsetmacro{\yy}{(13-\mstart)}
    \ifnum\mstart=\mend
      \filldraw (0,\yy) rectangle (1,\yy+1) node[midway] {#2};
    \else
      \filldraw (0,\yy) rectangle (2,\yy+1) node[midway] {#2};
      \filldraw (0,0) rectangle (1,1) node[midway] {#2};
    \fi
  \end{scope}
}
\begin{tikzpicture}
  \eventpoint[start date=15/7,end date=25/7,event color=green]{same}
  \eventpoint[start date=17/8,end date=19/9,event color=red]{split}
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(parsed.ast);
  const eventRects = ir.items.filter(
    (item) => item.type === "path" && item.commands?.some((command) => command.type === "closePath")
  );

  assert.deepEqual([...parsed.diagnostics, ...diagnostics], []);
  assert.equal(eventRects.length, 3);
  assert.equal(eventRects.filter((item) => item.style.fill === "rgb(128 255 128)").length, 1);
  assert.equal(eventRects.filter((item) => item.style.fill === "rgb(255 128 128)").length, 2);
});

test("applies pre-picture pgfmath macros to picture basis and foreach ranges", () => {
  const source = String.raw`
\newcommand{\target}{4}
\newcommand{\anno}{1}
\pgfmathsetmacro{\myend}{\target+1-\anno}
\pgfmathsetmacro{\myspacing}{2/(\target-\anno)}
\begin{tikzpicture}[x=\myspacing cm,y=1cm]
  \foreach \tick in {0,...,\myend}{
    \draw (\tick,0) -- (\tick,1);
  }
\end{tikzpicture}`;

  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const xs = ir.items.map((item) => item.commands[0].x);

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(xs, [0, 0.666666666667, 1.333333333333, 2, 2.666666666667]);
});

test("expands def-defined nested foreach lists and node contents styles", () => {
  const source = String.raw`
\tikzset{
  tile base/.style={minimum size=9mm,inner sep=0},
  tile 0/.style={tile base,fill=gray,node contents={}},
  tile 2/.style={tile base,fill=red,node contents={2}},
  tile 4/.style={tile base,fill=blue,node contents={4}},
  tile 8/.style={tile base,fill=green,node contents={8}}
}
\begin{tikzpicture}
  \def\pixels{
    {0,2},
    {4,8},
  }
  \foreach \line [count=\y] in \pixels {
    \foreach \pix [count=\x] in \line {
      \path (\x,-\y) node[name=t-\x-\y,tile \pix];
    }
  }
\end{tikzpicture}`;

  const parsed = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(parsed.ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");
  const labels = ir.items.filter((item) => item.type === "textNode").map((item) => item.text).filter(Boolean).sort();

  assert.deepEqual([...parsed.diagnostics, ...diagnostics], []);
  assert.equal(boxes.length, 4);
  assert.deepEqual(labels, ["2", "4", "8"]);
});

test("sizes fit nodes from referenced node bounds", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw,minimum size=1cm,inner sep=0pt] (a) at (0,0) {};
  \node[draw,minimum size=1cm,inner sep=0pt] (b) at (2,0) {};
  \node[fit=(a)(b),inner sep=1mm,fill=red] {};
\end{tikzpicture}`;
  const parsed = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(parsed.ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");
  const fit = boxes.at(-1);
  assert.deepEqual([...parsed.diagnostics, ...diagnostics], []);
  assert.ok(Math.abs(fit.x - 1) < 1e-6, `expected fit center at x=1, got ${fit.x}`);
  assert.ok(fit.width > 3.2 && fit.width < 3.23, `expected fit width to include node bounds and inner sep, got ${fit.width}`);
  assert.ok(fit.height > 1.2 && fit.height < 1.23, `expected fit height to include node bounds and inner sep, got ${fit.height}`);
});

test("sizes fit nodes with independent horizontal and vertical inner separation", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw,minimum width=1cm,minimum height=.5cm,inner sep=0pt] (a) at (0,0) {};
  \node[fit=(a),inner xsep=2mm,inner ysep=1mm,draw] {};
\end{tikzpicture}`;
  const parsed = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(parsed.ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");
  const fit = boxes.at(-1);
  assert.deepEqual([...parsed.diagnostics, ...diagnostics], []);
  assert.ok(Math.abs(fit.width - 1.4) < 0.02, `expected independent x separation, got ${fit.width}`);
  assert.ok(Math.abs(fit.height - 0.7) < 0.02, `expected independent y separation, got ${fit.height}`);
});

test("circumscribes ellipse fit nodes using the PGF shape radius formula", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw,minimum width=3cm,minimum height=1cm,inner sep=0pt] (a) at (0,0) {};
  \node[ellipse,fit=(a),inner sep=0pt,draw] {};
\end{tikzpicture}`;
  const { ir, diagnostics } = interpretTikz(parseTikz(source).ast);
  const fit = ir.items.filter((item) => item.type === "nodeBox").at(-1);

  assert.deepEqual(diagnostics, []);
  assert.equal(fit.shape, "ellipse");
  assert.ok(Math.abs(fit.width - 3 * Math.SQRT2) < 0.02, `expected ellipse width to circumscribe the fit box, got ${fit.width}`);
  assert.ok(Math.abs(fit.height - Math.SQRT2) < 0.02, `expected ellipse height to circumscribe the fit box, got ${fit.height}`);
});

test("interprets unitless TikZ node minimum dimensions as TeX points", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[rectangle,draw,minimum size=12,inner sep=0] at (0,0) {};
  \node[circle,draw,minimum size=18,inner sep=0] at (1,0) {};
\end{tikzpicture}`;
  const parsed = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(parsed.ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");

  assert.deepEqual([...parsed.diagnostics, ...diagnostics], []);
  assert.equal(boxes.length, 2);
  expectClose(boxes[0].width, parseDimension("12pt"), 1e-6);
  expectClose(boxes[0].height, parseDimension("12pt"), 1e-6);
  expectClose(boxes[1].width, parseDimension("18pt"), 1e-6);
  expectClose(boxes[1].height, parseDimension("18pt"), 1e-6);
});

test("renders shapes.misc cross out and strike out without rectangle outlines", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.misc}
\begin{tikzpicture}
  \node[draw,cross out,minimum size=12pt,inner sep=0] at (0,0) {};
  \node[draw,strike out,minimum size=12pt,inner sep=0] at (1,0) {};
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /class="tikz-shape-cross-out"/);
  assert.match(result.svg, /class="tikz-shape-strike-out"/);
  const [cross] = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "crossOut");
  const [strike] = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "strikeOut");
  assert.ok(cross.foregroundOuterSep.x > 0, "cross foreground should use the inherited rectangle outer separation");
  assert.ok(cross.foregroundOuterSep.y > 0, "cross foreground should use the inherited rectangle outer separation");
  assert.deepEqual(strike.foregroundOuterSep, cross.foregroundOuterSep, "strike foreground should use the same inherited outer separation");
  const halfVisibleWidth = cross.width / 2;
  const renderedCross = result.svg.match(/class="tikz-shape-cross-out" d="M ([^ ]+) ([^ ]+) L ([^ ]+) ([^ "]+)/);
  assert.ok(renderedCross, "expected cross-out foreground path");
  assert.ok(Math.abs(Number(renderedCross[1])) > halfVisibleWidth * 100, "cross foreground should extend beyond the visible box");
  assert.equal([...result.svg.matchAll(/<rect\b/g)].length, 1, "only the SVG background should be a rectangle");
});

test("renders the equilateral triangle heights fixture with scoped geometry and labels", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \draw[line width=1.5pt,fill=gray!2] (0,0) -- (60:4) -- (4,0) -- cycle;
  \coordinate[label=left:$A$] (A) at (0,0);
  \coordinate[label=right:$B$] (B) at (4,0);
  \coordinate[label=above:$C$] (C) at (2,3.464);
  \coordinate[label=below:$c$] (c) at ($(A)!.5!(B)$);
  \coordinate[label=left:$b$] (b) at ($(A)!.5!(C)$);
  \coordinate[label=right:$a$] (a) at ($(B)!.5!(C)$);
  \draw[fill=green!30] (0,0) -- (0:.75cm) arc (0:60:.75cm);
  \begin{scope}[shift={(4cm,0cm)}]
    \draw[fill=green!30] (0,0) -- (-180:.75cm) arc (180:120:.75cm);
    \draw[color=gray,dashed] (0,0) -- node[sloped,above=-.1cm] {$\scriptstyle h_b$} (150:3.464cm);
  \end{scope}
  \begin{scope}[shift={(60:4)}]
    \draw[fill=green!30] (0,0) -- (-120:.75cm) arc (-120:-60:.75cm);
    \draw[color=gray,dashed] (0,0) -- node[right=-.1cm] {$\scriptstyle h_c$} (-90:3.464cm);
  \end{scope}
  \draw[color=gray,dashed] (0,0) -- node[sloped,above=-.1cm] {$\scriptstyle h_a$} (30:3.464cm);
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path");
  const heights = paths.filter((path) => path.style.stroke === "gray" && path.style.dashArray);
  const angleFills = paths.filter((path) => path.style.fill === "rgb(179 255 179)");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const label = (text) => labels.find((item) => item.text === text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(angleFills.length, 3);
  assert.equal(heights.length, 3);
  assert.deepEqual([result.ir.coordinates.A, result.ir.coordinates.B, result.ir.coordinates.C], [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 2, y: 3.464 }
  ]);
  assert.deepEqual([result.ir.coordinates.a, result.ir.coordinates.b, result.ir.coordinates.c], [
    { x: 3, y: 1.732 },
    { x: 1, y: 1.732 },
    { x: 2, y: 0 }
  ]);
  assert.ok(Math.abs(label(String.raw`$\scriptstyle h_a$`).rotation - 30) < 1e-6);
  assert.ok(Math.abs(label(String.raw`$\scriptstyle h_b$`).rotation + 30) < 1e-6);
  assert.ok(label(String.raw`$\scriptstyle h_c$`).x > 2);
  assert.ok(paths.some((path) => Math.abs(path.style.lineWidth - lineWidthFromPt(1.5)) < 1e-9));
});

test("keeps scaled equilateral-triangle polar arcs and calc midpoint labels aligned", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[scale=0.8]
  \draw[line width=1.5pt,fill=gray!2] (0,0) -- (60:4) -- (4,0) -- cycle;
  \coordinate[label=left:$A$] (A) at (0,0);
  \coordinate[label=right:$B$] (B) at (4,0);
  \coordinate[label=above:$C$] (C) at (2,3.464);
  \coordinate[label=below:$c$] (c) at ($(A)!.5!(B)$);
  \coordinate[label=left:$b$] (b) at ($(A)!.5!(C)$);
  \coordinate[label=right:$a$] (a) at ($(B)!.5!(C)$);
  \draw[fill=green!30] (0,0) -- (0:.75cm) arc (0:60:.75cm);
  \draw (.35cm,.25cm) node {$\alpha$};
  \begin{scope}[shift={(4cm,0cm)}]
    \draw[fill=green!30] (0,0) -- (-180:.75cm) arc (180:120:.75cm);
    \draw (150:.5cm) node {$\beta$};
  \end{scope}
  \begin{scope}[shift={(60:4)}]
    \draw[fill=green!30] (0,0) -- (-120:.75cm) arc (-120:-60:.75cm);
    \draw (-90:.5cm) node {$\gamma$};
  \end{scope}
  \draw[line width=1.5pt] (A) -- (B) -- (C) -- cycle;
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const fills = result.ir.items.filter((item) => item.type === "path" && item.style.fill === "rgb(179 255 179)");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const label = (text) => labels.find((item) => item.text === text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(fills.length, 3);
  assert.deepEqual(result.ir.coordinates, {
    A: { x: 0, y: 0 },
    B: { x: 3.2, y: 0 },
    C: { x: 1.6, y: 2.7712 },
    c: { x: 1.6, y: 0 },
    b: { x: 0.8, y: 1.3856 },
    a: { x: 2.4, y: 1.3856 }
  });
  assert.ok(label("$\\alpha$").x < 0.5 && label("$\\alpha$").y > 0);
  assert.ok(label("$\\beta$").x > 2.8 && label("$\\beta$").y > 0);
  assert.ok(label("$\\gamma$").x === 1.6 && label("$\\gamma$").y > 2.3);
});

test("keeps named canvas coordinates stable across shifted scopes for concentric triangle circles", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{calc,shapes.misc}
\tikzstyle{point}=[thick,draw=gray,cross out,inner sep=0pt,minimum width=4pt,minimum height=4pt]
\begin{tikzpicture}
  \node[point] (TriangleCenter) at (0,0) {};
  \draw[thick,draw=blue] (TriangleCenter) circle(2.345cm);
  \begin{scope}[shift={(30:-2.309)}]
    \draw[line width=1.5pt,fill=gray!2] (0,0) -- (60:4) -- (4,0) -- cycle;
    \draw[thick,draw=green] (TriangleCenter) circle(1.12cm);
    \coordinate[label=left:$A$] (A) at (0,0);
    \coordinate[label=right:$B$] (B) at (4,0);
    \coordinate[label=above:$C$] (C) at (2,3.464);
  \end{scope}
  \coordinate[label=below:$c$] (c) at ($(A)!.5!(B)$);
  \coordinate[label=left:$b$] (b) at ($(A)!.5!(C)$);
  \coordinate[label=right:$a$] (a) at ($(B)!.5!(C)$);
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const circles = result.ir.items.filter((item) => item.type === "path" && item.shape === "circle");
  const center = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "TriangleCenter");
  const { coordinates } = result.ir;

  assert.deepEqual(result.diagnostics, []);
  assert.equal(center.shape, "crossOut");
  assert.deepEqual([center.x, center.y], [0, 0]);
  assert.deepEqual(circles.map(({ cx, cy, r }) => ({ cx, cy, r })), [
    { cx: 0, cy: 0, r: 2.345 },
    { cx: 0, cy: 0, r: 1.12 }
  ]);
  expectClose(coordinates.A.x, -1.999652657338, 1e-12);
  expectClose(coordinates.A.y, -1.1545, 1e-12);
  expectClose(coordinates.B.x, 2.000347342662, 1e-12);
  expectClose(coordinates.C.y, 2.3095, 1e-12);
  expectClose(coordinates.a.x, (coordinates.B.x + coordinates.C.x) / 2, 1e-12);
  expectClose(coordinates.b.x, (coordinates.A.x + coordinates.C.x) / 2, 1e-12);
  expectClose(coordinates.c.x, (coordinates.A.x + coordinates.B.x) / 2, 1e-12);
  expectClose(coordinates.a.y, (coordinates.B.y + coordinates.C.y) / 2, 1e-12);
  expectClose(coordinates.b.y, (coordinates.A.y + coordinates.C.y) / 2, 1e-12);
  expectClose(coordinates.c.y, (coordinates.A.y + coordinates.B.y) / 2, 1e-12);
  assert.match(result.svg, /class="tikz-shape-cross-out"/);
});

test("applies path-local every node styles to empty endpoint nodes", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{shapes.misc}
\tikzset{point/.style={thick,draw=gray,cross out,inner sep=0pt,minimum width=4pt,minimum height=4pt}}
\begin{tikzpicture}
  \coordinate (A) at (1,2);
  \coordinate (B) at (3,5);
  \coordinate (C) at (1.5,.5);
  \coordinate (D) at (4,1.5);
  \path[every node/.style={point}]
    node at (A) {} node at (B) {} node at (C) {} node at (D) {};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const crosses = result.ir.items.filter((item) => item.type === "nodeBox" && item.shape === "crossOut");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(crosses.map(({ x, y }) => ({ x, y })), [
    { x: 1, y: 2 },
    { x: 3, y: 5 },
    { x: 1.5, y: 0.5 },
    { x: 4, y: 1.5 }
  ]);
  assert.match(result.svg, /class="tikz-shape-cross-out"/);
});

test("applies picture scale to earth geometry while preserving default text and stroke sizes", () => {
  const result = tikzToSvg(String.raw`
\definecolor{sky}{HTML}{AAEEEE}
\begin{tikzpicture}[scale=1.2]
  \draw[fill=sky] (0,0) circle (1.5cm);
  \draw[fill=brown] (0,0) circle (1cm);
  \begin{scope}[shift={(-1.35cm,0)},rotate=48]
    \draw (0,0) -- node {} (2.5cm,0);
  \end{scope}
  \draw (0,0) -- (0,1.5cm);
  \draw (0,0) -- node[anchor=east] {$r$} (138:1cm);
  \draw[fill=gray!30] (0,0) -- (138:.75cm) arc (138:90:.75cm);
  \draw (110:.5cm) node {$\varphi$};
  \draw[lime] (138:1cm) arc (138:90:1cm);
  \node[lime] at (-.2,.85) {$x$};
  \draw[blue] (0,1cm) -- node[anchor=west] {$h$} (0,1.5cm);
  \node at (0,-.2) {Erde};
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path");
  const circles = paths.filter((item) => item.shape === "circle");
  const arcs = paths.filter((item) => item.shape === "arc");
  const texts = result.ir.items.filter((item) => item.type === "textNode" && item.text);
  const text = (value) => texts.find((item) => item.text === value);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(circles.length, 2);
  expectClose(circles[0].commands[0].x, 1.8, 1e-12);
  expectClose(circles[1].commands[0].x, 1.2, 1e-12);
  assert.equal(circles[0].style.fill, "#AAEEEE");
  assert.equal(circles[1].style.fill, "rgb(191 128 64)");
  assert.equal(arcs.length, 2);
  expectClose(arcs[0].commands.at(-1).x, 0, 1e-12);
  expectClose(arcs[0].commands.at(-1).y, 0.9, 1e-12);
  expectClose(arcs[1].commands.at(-1).x, 0, 1e-12);
  expectClose(arcs[1].commands.at(-1).y, 1.2, 1e-12);
  expectClose(paths[2].commands[0].x, -1.62, 1e-12);
  expectClose(paths[2].commands[1].x, 0.387391819077, 1e-12);
  expectClose(paths[2].commands[1].y, 2.229434476432, 1e-12);
  assert.equal(text("$r$").style.fontScale, 1);
  assert.equal(text("$\\varphi$").style.fontScale, 1);
  assert.equal(text("$x$").style.fontScale, 1);
  assert.equal(text("$h$").style.fontScale, 1);
  assert.equal(text("Erde").style.fontScale, 1);
  expectClose(text("$h$").x, 0.254791552534, 1e-12);
  expectClose(text("$h$").y, 1.5, 1e-12);
  expectClose(text("Erde").y, -0.24, 1e-12);
  assert.ok(paths.every((path) => Math.abs(path.style.lineWidth - lineWidthFromPt(0.4)) < 1e-9));
});

test("uses named canvas coordinates as local scope shifts under picture scale", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}[scale=3.5]
  \coordinate (DEnd) at (.867cm,.5cm);
  \begin{scope}[shift={(DEnd)}]
    \draw (0,0) -- (180:.3cm) arc (180:210:.3cm);
  \end{scope}
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  expectClose(path.commands[0].x, result.ir.coordinates.DEnd.x);
  expectClose(path.commands[0].y, result.ir.coordinates.DEnd.y);
  expectClose(path.commands[1].x, result.ir.coordinates.DEnd.x - 1.05);
  expectClose(path.commands[1].y, result.ir.coordinates.DEnd.y);
});

test("renders node append after command edges between tikzlastnode anchors", () => {
  const result = tikzToSvg(String.raw`
\begin{tikzpicture}
  \tikzset{XOR/.style={draw,circle,minimum size=13pt,append after command={
    [shorten >=\pgflinewidth,shorten <=\pgflinewidth]
    (\tikzlastnode.north) edge (\tikzlastnode.south)
    (\tikzlastnode.east) edge (\tikzlastnode.west)
  }}}
  \node[XOR] at (0,0) {};
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.svg, /class="tikz-append-after-command"/);
  assert.match(result.svg, /class="tikz-append-after-command"[^>]*d="M [^"]+ M [^"]+"/);
});

test("binds the current tree level into parameterized level styles", () => {
  const source = String.raw`
\begin{tikzpicture}[level/.style={sibling distance=60mm/#1}]
  \node[draw] {root}
    child { node[draw] {left} child { node[draw] {a} } child { node[draw] {b} } }
    child { node[draw] {right} };
\end{tikzpicture}`;
  const parsed = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(parsed.ast);
  const boxes = ir.items.filter((item) => item.type === "nodeBox");
  const firstLevel = boxes.filter((box) => Math.abs(box.y + 1.5) < 1e-6).sort((a, b) => a.x - b.x);
  const secondLevel = boxes.filter((box) => Math.abs(box.y + 3) < 1e-6).sort((a, b) => a.x - b.x);

  assert.deepEqual([...parsed.diagnostics, ...diagnostics], []);
  assert.deepEqual(firstLevel.map((box) => box.x), [-3, 3]);
  assert.deepEqual(secondLevel.map((box) => box.x), [-4.5, -1.5]);
});
