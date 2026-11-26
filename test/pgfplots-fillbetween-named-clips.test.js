import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseOptions } from "../src/engine/options.js";
import { namedFillBetweenClipBoxes } from "../src/pgfplots/fillBetweenNamedClips.js";
import { createAxisGeometry } from "../src/pgfplots/geometry.js";

const ranges = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
const axis = parseOptions("compat=1.18,hide axis,scale only axis,enlargelimits=false,width=10cm,height=10cm");
const geometry = createAxisGeometry(axis, ranges);
const box = (minX, minY, maxX, maxY) => ({ minX, minY, maxX, maxY });
const clips = (body, options) => namedFillBetweenClipBoxes(body, ranges, geometry, axis, options);

test("named rectangles use both projected corners; paint and multiple option groups do not enlarge them", () => {
  const body = String.raw`
    % \draw[name path=comment] (1,1) rectangle (2,2);
    \path[name path=window][draw=none] (axis cs:8,6) rectangle (axis cs:2,1);
    \draw[ink][/tikz/name path global={second window}]
      (rel axis cs:.9,.2) rectangle (axis cs:3,7);
    \path[named ink] (0,2) rectangle (4,8);
    \draw (1,2) [blue] rectangle (3,6) [name path=trailing];`;
  const paths = clips(body, { pgfplotsStyleDefinitions: {
    ink: parseOptions("blue,thick,dashed"), "named ink": parseOptions("fill=red,name path=styled")
  } });
  assert.deepEqual([...paths], [
    ["window", { ...box(2, 1, 8, 6), flipX: true, flipY: true }],
    ["second window", { ...box(3, 2, 9, 7), flipX: true }], ["styled", box(0, 2, 4, 8)],
    ["trailing", box(1, 2, 3, 6)]
  ]);
});

test("a named shape's bounding box is not a rectangular clip contour", () => {
  const body = String.raw`
    \draw[name path=triangle] (0,0)--(3,0)--(1,4)--cycle;
    \path[name path=polygon] (0,0)--(3,0)--(3,2)--(0,2)--cycle;
    \draw[name path=circle] (2,2) circle (2);
    \draw[name path=compound] (0,0) rectangle (2,3) (3,3) rectangle (4,4);
    \path[name path=curve] (0,0) rectangle (2,3) .. controls (3,2) and (3,1) .. (4,0);
    \draw[name path=rounded,rounded corners=2pt] (0,0) rectangle (2,3);
    \draw[name path=turned,rotate=15] (0,0) rectangle (2,3);
    \draw[name path=moved,warp] (0,0) rectangle (2,3);
    \draw[name path=nodecorner] (some node) rectangle (2,3);
    \fill[name path=other] (0,0) rectangle (2,3);`;
  assert.deepEqual([...clips(body, { pgfplotsStyleDefinitions: { warp: { xshift: "2cm" } } })], []);
  assert.equal(namedFillBetweenClipBoxes(String.raw`\path[name path=W] (0,0) rectangle (1,1);`,
    ranges, { ...geometry, is3d: true }, axis).size, 0);
});

test("registration follows statement order, including unsupported path and addplot overwrites", () => {
  const start = String.raw`\path[name path=window] (1,1) rectangle (3,4);`;
  const fill = String.raw`\addplot fill between[of=A and B,soft clip=window];`;
  const replace = String.raw`\draw[name path global=window] (4,8) rectangle (9,6);`;
  assert.deepEqual(clips(start + fill).get("window"), box(1, 1, 3, 4));
  const rebound = { ...box(4, 6, 9, 8), flipY: true };
  assert.deepEqual(clips(start + fill + replace).get("window"), rebound);
  for (const shadow of [
    String.raw`\draw[name path=window] (1,1)--(2,2)--cycle;`,
    String.raw`\draw (1,1)--(2,2)--cycle [name path=window];`,
    String.raw`\draw (1,1)[xshift=2cm] rectangle (3,4) [name path=window];`,
    String.raw`\path[name path=window,xscale=2] (1,1) rectangle (3,4);`,
    String.raw`\addplot+[blue][/tikz/name path global=window] coordinates {(0,0)(2,3)};`,
    String.raw`\filldraw[name path=window] (2,2) circle (1);`
  ]) {
    assert.equal(clips(start + shadow).has("window"), false, shadow);
    assert.deepEqual(clips(shadow + replace).get("window"), rebound);
  }
});

test("axis names survive scopes, but an unhandled scoped transform cannot leave a stale rectangle", () => {
  const start = String.raw`\path[name path=outer] (0,0) rectangle (1,1);`;
  const inside = String.raw`\begin{scope}[blue]
    \draw[name path local=outer] (4,3) rectangle (7,5);
    \path[name path={scoped name}] (3,2) rectangle (4,3);
    \path[name path global={global window}] (8,8) rectangle (5,4);`;
  assert.deepEqual(clips(start + inside).get("outer"), box(4, 3, 7, 5));
  const after = clips(start + inside + String.raw`\end{scope}
    {[rotate=20]\draw[name path global={global window}] (0,0) rectangle (2,2);}
    \draw[name path=after] (3,4) rectangle (5,6);`);
  assert.deepEqual([...after], [
    ["outer", box(4, 3, 7, 5)], ["scoped name", box(3, 2, 4, 3)], ["after", box(3, 4, 5, 6)]
  ]);
  const aliases = clips(String.raw`\path[name path=A,name path=B,/tikz/name path global=C] (0,0) rectangle (2,1);`);
  for (const name of ["A", "B", "C"]) assert.deepEqual(aliases.get(name), box(0, 0, 2, 1));
});

test("local pdflatex resolves bare and keyed path names to the same clipped fill as the literal rectangle", {
  skip: process.env.TIKZKIT_TEST_PDFLATEX !== "1" && "set TIKZKIT_TEST_PDFLATEX=1 to replay"
}, () => {
  const dir = mkdtempSync(join(tmpdir(), "fillbetween-named-clips-"));
  try {
    const oracle = String.raw`\documentclass{article}
\usepackage{pgfplots}
\usepgfplotslibrary{fillbetween}
\pgfplotsset{compat=1.18}
\def\Probe#1#2{\addplot fill between[of=A and B,soft clip={#2},
  /pgf/fill between/result stream/next ready/.code={\global\let#1=\pgfretval}];}
\def\Same#1#2{\ifdefined#1\else\errmessage{Missing \string#1}\fi
  \ifx#1#2\else\errmessage{Different paths: \string#1, \string#2}\fi}
\begin{document}
\begin{tikzpicture}
\begin{axis}[hide axis,clip=false,xmin=0,xmax=30,ymin=0,ymax=15,x=1pt,y=1pt]
\path[name path=A] (0pt,7pt)--(30pt,7pt);
\path[name path=B] (0pt,4pt)--(30pt,4pt);
\path[name path=window,name path={copy window}] (3pt,1pt) rectangle (12pt,9pt);
\draw[blue,name path global={second window}] (16pt,9pt) rectangle (25pt,1pt);
\Probe\Literal{(3pt,1pt) rectangle (12pt,9pt)}
\Probe\Bare{window}
\Probe\Keyed{name=window}
\Probe\Copy{copy window}
\Probe\SpaceLiteral{(16pt,9pt) rectangle (25pt,1pt)}
\Probe\SpaceBare{second window}
\Probe\SpaceKeyed{name={second window}}
\path[name path=triangle] (3pt,1pt)--(12pt,9pt)--(3pt,9pt)--cycle;
\Probe\Triangle{triangle}
\begin{scope}
  \path (19pt,1pt) rectangle (29pt,9pt) [name path=window];
  \path[name path local={scoped local}] (16pt,9pt) rectangle (25pt,1pt);
  \draw[name path global={scoped global}] (3pt,1pt) rectangle (12pt,9pt);
\end{scope}
\Probe\Later{window}
\Probe\LaterLiteral{(19pt,1pt) rectangle (29pt,9pt)}
\Probe\ScopedLocal{scoped local}
\Probe\ScopedGlobal{name={scoped global}}
\end{axis}
\end{tikzpicture}
\Same\Bare\Literal \Same\Keyed\Literal \Same\Copy\Literal
\Same\SpaceBare\SpaceLiteral \Same\SpaceKeyed\SpaceLiteral \Same\Later\LaterLiteral
\Same\ScopedLocal\SpaceLiteral \Same\ScopedGlobal\Literal
\ifx\Bare\Later\errmessage{Window failed to change after redefinition}\fi
\ifdefined\Triangle\else\errmessage{Missing triangular fill}\fi
\ifx\Triangle\Literal\errmessage{Triangle cannot be replaced by its rectangular bounds}\fi
\end{document}`;
    writeFileSync(join(dir, "oracle.tex"), oracle);
    execFileSync("pdflatex", ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "oracle.tex"],
      { cwd: dir, timeout: 30000 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
