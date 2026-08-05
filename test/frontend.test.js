import assert from "node:assert/strict";
import test from "node:test";
import {
  createDiagnostic,
  createDocumentAst,
  createPictureAst,
  hasErrors,
  parseTikz,
  preprocessTikzSource,
  tokenizeTikzLikeSource
} from "../src/frontend/index.js";
import { preprocessTikzSource as compatPreprocessTikzSource } from "../src/preprocess.js";
import { parseTikz as compatParseTikz } from "../src/parser.js";
import { expandTexLiteEnvironments } from "../src/frontend/latex-shell.js";

test("frontend layer exposes parse, AST factories, diagnostics, and tokenization", () => {
  const tokens = tokenizeTikzLikeSource(String.raw`\draw[red] (0,0) -- (1,0);`);
  const parsed = parseTikz(String.raw`\draw (0,0) -- (1,0);`);
  const diagnostic = createDiagnostic("bad", { severity: "error" });

  assert.ok(tokens.some((token) => token.type === "control" && token.value === "\\draw"));
  assert.equal(createDocumentAst().type, "document");
  assert.equal(createPictureAst().type, "tikzpicture");
  assert.equal(parsed.diagnostics.length, 0);
  assert.match(preprocessTikzSource(String.raw`\documentclass{standalone}\begin{document}\tikz \draw (0,0)--(1,0);\end{document}`).source, /\\draw/);
  assert.equal(hasErrors([diagnostic]), true);
  assert.equal(compatParseTikz, parseTikz);
  assert.equal(compatPreprocessTikzSource, preprocessTikzSource);
});

test("collects standalone document border as the preview margin", () => {
  const source = String.raw`\documentclass[varwidth=true, border=2pt]{standalone}
\usepackage{tikz}
\begin{document}
\tikz \draw (0,0) -- (1,0);
\end{document}`;

  const preprocessed = preprocessTikzSource(source);

  assert.ok(Math.abs(preprocessed.previewBorder - 2 * 2.54 / 72.27) < 1e-9);
});

test("explicit PreviewBorder overrides the standalone document border", () => {
  const source = String.raw`\documentclass[border=2pt]{standalone}
\usepackage[pdftex,active,tightpage]{preview}
\setlength\PreviewBorder{2mm}
\usepackage{tikz}
\begin{document}
\tikz \draw (0,0) -- (1,0);
\end{document}`;

  assert.equal(preprocessTikzSource(source).previewBorder, 0.2);
});

test("keeps the first beamer frame with its preamble styles and removes layout wrappers", () => {
  const source = String.raw`\documentclass{beamer}
\usepackage{tikz}
\tikzset{shared/.style={draw,fill=blue!20}}
\begin{document}
\begin{frame}<1->[fragile]{First page}
  \begin{figure}
    \begin{tikzpicture}\node[shared] {First};\end{tikzpicture}
  \end{figure}
\end{frame}
\begin{frame}{Second page}
  \begin{tikzpicture}\node[shared] {Second};\end{tikzpicture}
\end{frame}
\end{document}`;

  const result = preprocessTikzSource(source);
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.source, /shared\/\.style=\{draw,fill=blue!20\}/);
  assert.match(result.source, /\{First\}/);
  assert.doesNotMatch(result.source, /Second|\\(?:begin|end)\{(?:frame|figure)\}/);
});

test("lowers cmyk definecolor values through the tikztosvg DeviceCMYK profile", () => {
  const result = preprocessTikzSource(String.raw`
\definecolor{printcyan}{cmyk}{1,0,0,0}
\begin{tikzpicture}
  \draw[printcyan] (0,0) -- (1,0);
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.doesNotMatch(result.source, /\\definecolor/);
  assert.match(result.source, /\\draw\[rgb\(0 173 239\)\]/);
});

test("inherits global pgfplots tick and axis-label styles into each axis", () => {
  const result = preprocessTikzSource(String.raw`
\pgfplotsset{
  tick label style={font=\sansmath\sffamily},
  every axis label/.append style={font=\sffamily\footnotesize}
}
\begin{tikzpicture}
  \begin{axis}[xmin=0,xmax=1,ymin=0,ymax=1,xtick={0},ytick={},xlabel={$x$},
    ylabel={$f(x)$},x label style={font=\boldmath\Large},
    y label style={at={(axis description cs:0,0.5)},anchor=south,rotate=90,font=\boldmath\Large}]
    \addplot coordinates {(0,0) (1,1)};
  \end{axis}
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.source, /axis tick label[^\]]*font=[^,\]]*\\sansmath\\sffamily/);
  assert.match(result.source, /axis label[^\]]*font=\\boldmath\\Large/);
  assert.doesNotMatch(result.source, /axis label[^\]]*font=\\sffamily\\footnotesize\\boldmath\\Large/);
  assert.match(result.source, /axis label[^\]]*anchor=south[^\]]*rotate=90/);
  assert.match(result.source, /axis label[^\]]*anchor=south[^\]]*font=\\boldmath\\Large/);
});

test("inherits an axis-local every axis append style into PGFPlots font roles", () => {
  const result = preprocessTikzSource(String.raw`
\begin{tikzpicture}
  \begin{axis}[
    every axis/.append style={font=\small\sffamily},
    xmin=0,xmax=1,ymin=0,ymax=1,xtick={0},ytick={0},xlabel=Time,ylabel=Value,
  ]
    \addplot coordinates {(0,0) (1,1)};
  \end{axis}
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.match(result.source, /axis tick label[^\]]*font=\\small\\sffamily/);
  assert.match(result.source, /axis label[^\]]*font=\\small\\sffamily/);
});

test("expands def macros when TeX whitespace separates def from the control sequence", () => {
  const result = preprocessTikzSource(String.raw`
\def \leveldist {-1.9}
\begin{tikzpicture}
  \node at (0,1*\leveldist) {child};
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  assert.doesNotMatch(result.source, /\\leveldist/);
  assert.match(result.source, /\(0,1\*-1\.9\)/);
});

test("expands custom TeX environments without treating their definitions as pictures", () => {
  const source = String.raw`
\newenvironment{diagram}[2][red]{
  \begin{tikzpicture}\draw[#1] (0,0) -- (#2,0);
}{
  \end{tikzpicture}
}
\begin{document}
\begin{diagram}[blue]{2}\node at (1,0) {A};\end{diagram}
\end{document}`;
  const diagnostics = [];
  const expanded = expandTexLiteEnvironments(source, diagnostics);
  assert.deepEqual(diagnostics, []);
  assert.doesNotMatch(expanded, /\\newenvironment|\\begin\{diagram\}/);
  assert.match(expanded, /\\begin\{tikzpicture\}\\draw\[blue\] \(0,0\) -- \(2,0\);/);

  const parsed = parseTikz(source);
  assert.equal(parsed.ast.figures.length, 1);
  assert.deepEqual(parsed.diagnostics, []);
});

test("frontend parser can select one active tikzpicture while keeping preamble context", () => {
  const source = String.raw`
\tikzset{shared/.style={draw,fill=blue!20}}
\begin{tikzpicture}
  \node[shared] {First};
\end{tikzpicture}
middle text
\begin{tikzpicture}[scale=2]
  \node[shared] {Second};
\end{tikzpicture}`;

  const parsed = parseTikz(source, { activeFigureId: "figure:1" });

  assert.deepEqual(parsed.diagnostics, []);
  assert.equal(parsed.ast.figures.length, 2);
  assert.equal(parsed.ast.activeFigureId, "figure:1");
  assert.equal(parsed.ast.pictures.length, 1);
  assert.equal(parsed.ast.pictures[0].figureId, "figure:1");
  assert.equal(parsed.ast.pictures[0].options.scale, "2");
  assert.deepEqual(parsed.ast.pictures[0].styles.shared, { draw: true, fill: "blue!20" });
  assert.equal(parsed.ast.pictures[0].statements[0].text, "Second");
});

test("frontend lowers nested inline tikz nodes into fitted background and named split nodes", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw,fill=yellow] at (3,3) {
    \tikz \node[rectangle split,rectangle split parts=3] (A) {
      \nodepart{one}\nodepart{two}7\nodepart{three}
    };
  };
  \draw (A) -- (4,0);
\end{tikzpicture}`;
  const result = preprocessTikzSource(source);

  assert.match(result.source, /\\node\[rectangle split,rectangle split parts=3,xshift=-0\.2625em\] \(A\) at \(3,3\)/);
  assert.match(result.source, /\{\[on background layer\]/);
  assert.match(result.source, /\\node\[draw,fill=yellow,inner xsep=0\.5964em,inner ysep=0\.3333em,xshift=0\.2625em,fit=\(A\)\]/);
  assert.doesNotMatch(result.source, /\\tikz\s+\\node/);
});

test("frontend lowers nested inline tikz nodes when the outer node uses the current point", () => {
  const source = String.raw`
\begin{tikzpicture}
  \node[draw,fill=yellow] {
    \tikz \node[rectangle split,rectangle split horizontal,rectangle split parts=3] (A) {
      \nodepart{one}\tiny False\nodepart{two}5\nodepart{three}
    };
  };
  \draw (A.one) -- (A.three);
\end{tikzpicture}`;
  const result = preprocessTikzSource(source);

  assert.match(result.source, /\\node\[rectangle split,rectangle split horizontal,rectangle split parts=3,xshift=-0\.2625em\] \(A\) at \(0,0\)/);
  assert.match(result.source, /\\node\[draw,fill=yellow,inner xsep=0\.5964em,inner ysep=0\.3333em,xshift=0\.2625em,fit=\(A\)\]/);
  assert.doesNotMatch(result.source, /\\tikz\s+\\node/);
});

test("parses calc let bindings as a scoped path segment", () => {
  const parsed = parseTikz(String.raw`
\usetikzlibrary{calc}
\begin{tikzpicture}
  \coordinate (A) at (1,2);
  \coordinate (B) at (3,4);
  \draw let \p1=(A), \p{target}=(B) in (\x1,\y{target}) -- (0,0);
\end{tikzpicture}`);
  const statement = parsed.ast.pictures[0].statements.at(-1);

  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(statement.path.segments[0], {
    kind: "let",
    bindings: [
      { kind: "point", name: "1", value: "A" },
      { kind: "point", name: "target", value: "B" }
    ]
  });
  assert.equal(statement.path.segments[1].raw, "\\x1,\\y{target}");
});
