import assert from "node:assert/strict";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

test("renders arrows and trees TCS logo macro with visible cyclic branches", () => {
  const source = String.raw`
\usetikzlibrary {arrows,trees}
\tikzset{
  ld/.style={level distance=#1},lw/.style={line width=#1},
  level 1/.style={ld=4.5mm, trunk,          lw=1ex ,sibling angle=60},
  level 2/.style={ld=3.5mm, trunk!80!leaf a,lw=.8ex,sibling angle=56},
  level 3/.style={ld=2.75mm,trunk!60!leaf a,lw=.6ex,sibling angle=52},
  level 4/.style={ld=2mm,   trunk!40!leaf a,lw=.4ex,sibling angle=48},
  level 5/.style={ld=1mm,   trunk!20!leaf a,lw=.3ex,sibling angle=44},
  level 6/.style={ld=1.75mm,leaf a,         lw=.2ex,sibling angle=40},
}
\pgfarrowsdeclare{leaf}{leaf}
  {\pgfarrowsleftextend{-2pt} \pgfarrowsrightextend{1pt}}
{
  \pgfpathmoveto{\pgfpoint{-2pt}{0pt}}
  \pgfpatharc{150}{30}{1.8pt}
  \pgfpatharc{-30}{-150}{1.8pt}
  \pgfusepathqfill
}

\newcommand{\logo}[5]
{
  \colorlet{border}{#1}
  \colorlet{trunk}{#2}
  \colorlet{leaf a}{#3}
  \colorlet{leaf b}{#4}
  \begin{tikzpicture}
    \scriptsize\scshape
    \draw[border,line width=1ex,yshift=.3cm,
          yscale=1.45,xscale=1.05,looseness=1.42]
      (1,0) to [out=90, in=0]    (0,1)  to [out=180,in=90]  (-1,0)
            to [out=-90,in=-180] (0,-1) to [out=0,  in=-90] (1,0) -- cycle;

    \coordinate (root) [grow cyclic,rotate=90]
    child {
      child [line cap=round] foreach \a in {0,1} {
        child foreach \b in {0,1} {
          child foreach \c in {0,1} {
            child foreach \d in {0,1} {
              child foreach \leafcolor in {leaf a,leaf b}
                { edge from parent [color=\leafcolor,-#5] }
        } } }
      } edge from parent [shorten >=-1pt,serif cm-,line cap=butt]
    };

    \node [align=center,below] at (0pt,-.5ex)
    { \textcolor{border}{T}heoretical \\ \textcolor{border}{C}omputer \\
      \textcolor{border}{S}cience };
  \end{tikzpicture}
}
\begin{minipage}{3cm}
  \logo{green!80!black}{green!25!black}{green}{green!80}{leaf}\\
  \logo{green!50!black}{black}{green!80!black}{red!80!green}{leaf}\\
  \logo{red!75!black}{red!25!black}{red!75!black}{orange}{leaf}\\
  \logo{black!50}{black}{black!50}{black!25}{}
\end{minipage}`;

  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const paths = result.ir.items.filter((item) => item.type === "path");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const strokeColors = new Set(paths.map((item) => item.style?.stroke).filter(Boolean));
  const fillColors = new Set(paths.map((item) => item.style?.fill).filter((value) => value && value !== "none"));
  const viewBox = result.svg.match(/\bviewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number);

  assert.deepEqual(result.diagnostics, []);
  assert.ok(viewBox, "expected rendered SVG viewBox");
  assert.ok(viewBox[2] > 400, `expected TCS logo JS bbox to match the 5.5cm reference width, got ${viewBox[2]}`);
  assert.ok(paths.length > 120, `expected generated tree paths, got ${paths.length}`);
  assert.ok(strokeColors.size > 3, `expected logo colors to survive macro expansion, got ${[...strokeColors].join(", ")}`);
  assert.ok(fillColors.size > 2, `expected visible leaf fills, got ${[...fillColors].join(", ")}`);
  const terminalLeafCircles = paths.filter((item) => item.shape === "circle" && item.style?.stroke === "none" && item.style?.fill !== "none");
  assert.equal(terminalLeafCircles.length, 0, "expected declared leaf arrow tips to render as leaf paths, not circle placeholders");
  assert.match(result.svg, /font-family="TikZKitCMSC10, TikZKitCMUSerif, serif"/);
  assert.doesNotMatch(result.svg, /fill="(?:green|red|black)![^"]+"/);
  assert.match(result.svg, /<tspan[^>]*fill="rgb\([^"]+\)"[^>]*>T<\/tspan>heoretical/);
  assert.match(result.svg, /<tspan[^>]*fill="[^"]+"[^>]*>T<\/tspan>heoretical/);
  assert.match(result.svg, /<tspan[^>]*fill="[^"]+"[^>]*>C<\/tspan>omputer/);
  assert.match(result.svg, /<tspan[^>]*fill="[^"]+"[^>]*>S<\/tspan>cience/);
  const firstInitial = result.svg.match(/<tspan x="([^"]+)" dy="[^"]+" fill="[^"]+">T<\/tspan>heoretical/);
  assert.ok(firstInitial, "expected first colored initial to carry an explicit line-start x coordinate");
  const firstInitialX = Number(firstInitial[1]);
  const widthScale = Number(result.svg.match(/class="tikz-typewriter-text" transform="[^"]*scale\(([\d.]+) 1\)/)?.[1] || 1);
  const effectiveInitialX = firstInitialX * widthScale;
  assert.ok(
    effectiveInitialX < -160 && effectiveInitialX > -190,
    `expected colored initial to match tikztosvg small-caps line width, got effective x=${effectiveInitialX} from x=${firstInitialX} scale=${widthScale}`
  );
  assert.doesNotMatch(
    result.svg,
    /<tspan x="[^"]+" dy="[^"]+"><tspan fill=/,
    "segmented text lines must be flat so colored initials and black text share the same line anchor"
  );
  assert.equal(
    labels[0]?.text,
    "\\textcolor{green!80!black}{T}heoretical \\\\ \\textcolor{green!80!black}{C}omputer \\\\ \\textcolor{green!80!black}{S}cience"
  );
  assert.equal(labels[0]?.style?.fill, "black");
  assert.equal(labels[0]?.style?.fontScale, 1.575);
  assert.equal(labels[0]?.style?.fontSizeBaseScale, 2.25);
  assert.equal(labels[0]?.style?.textWidthScale, 1);
  assert.ok(
    labels[0]?.y > -1.98 && labels[0]?.y < -1.82,
    `expected TCS logo label block baseline to match tikztosvg reference, got y=${labels[0]?.y}`
  );

  const tabularSource = source.replace("\\begin{minipage}{3cm}", "\\begin{tabular}{c}").replace("\\end{minipage}", "\\end{tabular}");
  const tabularResult = tikzToSvg(tabularSource, { mathRenderer: "svg-text" });
  const tabularPaths = tabularResult.ir.items.filter((item) => item.type === "path");
  assert.deepEqual(tabularResult.diagnostics, []);
  assert.ok(tabularPaths.length > 120, `expected tabular logo stack paths, got ${tabularPaths.length}`);
});
