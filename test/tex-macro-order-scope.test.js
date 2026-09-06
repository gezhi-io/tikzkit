import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { preprocessTikzSource } from "../src/frontend/latex-shell.js";

function values(source) {
  return [...preprocessTikzSource(source).source.matchAll(/QA\[([^\]]*)\]/g)].map((match) => match[1].trim());
}

test("macro definitions take effect in source order without retroactive expansion", () => {
  assert.deepEqual(values(String.raw`QA[\qaValue] \def\qaValue{1} QA[\qaValue] \def\qaValue{2} QA[\qaValue]`), [String.raw`\qaValue`, "1", "2"]);
});

test("replacement bodies resolve referenced macros lazily at each invocation", () => {
  assert.deepEqual(values(String.raw`\def\qaValue{1}\def\qaAlias{\qaValue} QA[\qaAlias] \def\qaValue{2} QA[\qaAlias]`), ["1", "2"]);
});

test("brace scopes restore shadowed definitions and remove new local definitions", () => {
  assert.deepEqual(values(String.raw`\def\qaValue{1} {\def\qaValue{2} QA[\qaValue] {\def\qaValue{3} QA[\qaValue]} QA[\qaValue] \def\qaLocal{4}} QA[\qaValue] QA[\qaLocal]`), ["2", "3", "2", "1", String.raw`\qaLocal`]);
});

test("explicit TeX groups restore definitions while escaped braces are not groups", () => {
  assert.deepEqual(values(String.raw`\def\qaValue{1} \begingroup\def\qaValue{2} QA[\qaValue]\endgroup QA[\qaValue] \bgroup\def\qaValue{3} QA[\qaValue]\egroup QA[\qaValue] \{\def\qaValue{4}\} QA[\qaValue]`), ["2", "1", "3", "1", "4"]);
});

test("global definitions override saved local definitions across enclosing groups", () => {
  assert.deepEqual(values(String.raw`\def\qaValue{1} {\def\qaValue{2} {\gdef\qaValue{3}} QA[\qaValue]} QA[\qaValue] {\global\def\qaValue{4}} QA[\qaValue]`), ["3", "3", "4"]);
});

test("TikZ scopes and separate pictures restore macro definitions", () => {
  const result = preprocessTikzSource(String.raw`\def\qaValue{1}
\begin{tikzpicture}\def\qaValue{2}
\begin{scope}[shift={(1,0)}]\def\qaValue{3}\draw (0,0)--(\qaValue,0);\end{scope}
\draw (0,0)--(\qaValue,0);\end{tikzpicture}
\begin{tikzpicture}\draw (0,0)--(\qaValue,0);\end{tikzpicture}`);
  assert.deepEqual([...result.source.matchAll(/--\((\d),0\)/g)].map((match) => match[1]), ["3", "2", "1"]);
  assert.deepEqual(result.diagnostics, []);
});

test("expanded custom environments keep their implicit local macro scope", () => {
  assert.deepEqual(values(String.raw`\def\qaValue{1}\newenvironment{qagroup}{\def\qaValue{2}}{} \begin{qagroup}QA[\qaValue]\end{qagroup} QA[\qaValue]`), ["2", "1"]);
});

test("definitions in replacement bodies execute only when the outer macro is called", () => {
  assert.deepEqual(values(String.raw`\def\qaValue{1}\def\qaSet#1{\def\qaValue{#1}} QA[\qaValue] \qaSet{2} QA[\qaValue] {\qaSet{3} QA[\qaValue]} QA[\qaValue]`), ["1", "2", "3", "2"]);
  assert.deepEqual(values(String.raw`\def\qaMaker#1{\def\qaInner##1{#1:##1}} \qaMaker{A} QA[\qaInner{B}]`), ["A:B"]);
});

test("optional and delimited invocations retain order and can consume source after an alias", () => {
  assert.deepEqual(values(String.raw`\def\qaValue{1}\newcommand{\qaPair}[2][\qaValue]{#1:#2}\def\qaAlias{\qaPair} QA[\qaAlias{A}] \def\qaValue{2} QA[\qaPair{B}] QA[\qaPair[3]{C}] \def\qaDelimited(#1,#2);{#1:#2} QA[\qaDelimited(4,5);] \def\qaTemplate#1/#2;{#1:#2} QA[\qaTemplate 6/7;]`), ["1:A", "2:B", "3:C", "4:5", "6:7"]);
});

test("unused arguments are consumed without executing their definitions", () => {
  assert.deepEqual(values(String.raw`\def\qaValue{1}\newcommand{\qaDiscard}[1]{fixed} QA[\qaDiscard{\def\qaValue{2}}] QA[\qaValue]`), ["fixed", "1"]);
});

test("conditional branches execute definitions only in the selected branch and scope", () => {
  assert.deepEqual(values(String.raw`\newif\ifqaFlag\def\qaValue{1} \ifqaFlag\def\qaValue{2}\else\def\qaValue{3}\fi QA[\qaValue] {\qaFlagtrue\ifqaFlag\def\qaValue{4}\fi QA[\qaValue]} \ifqaFlag QA[wrong]\else QA[\qaValue]\fi`), ["3", "4", "3"]);
});

test("delegated math and extension macros remain available to their owners", () => {
  const result = preprocessTikzSource(String.raw`\newcommand{\overmat}[3]{discard}\newcommand{\DrawArrow}[1]{discard}\begin{tikzpicture}\node {$\overmat{A}{B}{C}$};\end{tikzpicture}`);
  assert.match(result.source, /\\overmat\{A\}\{B\}\{C\}/);
  assert.doesNotMatch(result.source, /discard|newcommand/);
});

test("recursive macros stop at the configured depth with a diagnostic", () => {
  const result = preprocessTikzSource(String.raw`\def\qaLoop{\qaLoop}\qaLoop`, { macroExpansionPasses: 3 });
  assert.match(result.source, /\\qaLoop/);
  assert.ok(result.diagnostics.some((entry) => /macro expansion limit/i.test(entry.message)));
});

test("replacement tokens do not merge an unresolved control word with following letters", () => {
  assert.deepEqual(values(String.raw`\def\qaIdentity#1{#1} QA[\qaIdentity{\qaUnknown}Suffix]`), [String.raw`\qaUnknown Suffix`]);
});

test("stored PGF key definitions are not executed or expanded as macro invocations", () => {
  const result = preprocessTikzSource(String.raw`\def\qaValue{1}\tikzset{qa/.code={\def\qaValue{#1}}} QA[\qaValue]`);
  assert.match(result.source, /\\def\\qaValue\{#1\}/);
  assert.match(result.source, /QA\[1\]/);
});

test("declared arrow setup and drawing programs retain their own deferred macro definitions", () => {
  const declaration = String.raw`\pgfarrowsdeclare{qa saved}{qa saved}{
\def\qaValue{2}\pgfarrowssave\qaValue
\pgfarrowsleftextend{0pt}\pgfarrowsrightextend{\qaValue pt}
}{\pgfpathmoveto{\pgfqpoint{0pt}{0pt}}\pgfpathlineto{\pgfqpoint{\qaValue pt}{0pt}}\pgfusepathqstroke}`;
  const result = preprocessTikzSource(String.raw`\def\qaValue{1}` + declaration + String.raw` \draw[-{qa saved}] (0,0)--(1,0); QA[\qaValue]`);
  const encoded = result.source.match(/tikzkit declared arrow=([0-9a-f]+)/);
  assert.ok(encoded, "expected the arrow owner to lower the preserved declaration");
  const arrow = JSON.parse(decodeURIComponent(Buffer.from(encoded[1], "hex").toString("latin1")));
  assert.match(arrow.program.setup, /\\def\\qaValue\{2\}\\pgfarrowssave\\qaValue/);
  assert.match(arrow.program.drawing, /\\qaValue pt/);
  assert.match(result.source, /QA\[1\]/);
  assert.deepEqual(result.diagnostics, []);
});

test("explicit macro groups retain the markers needed by standalone legend lowering", () => {
  const result = preprocessTikzSource(String.raw`\def\qaValue{1}\begin{tikzpicture}
\begingroup\def\qaValue{2}\def\qaEntries{one,two}
\csname pgfplots@init@cleared@structures\endcsname
[legend entries={\qaEntries},legend style={at={(2,-3)},anchor=center}]
\csname pgfplots@addlegendimage\endcsname{blue,area legend}
\csname pgfplots@addlegendimage\endcsname{red,sharp plot}
\csname pgfplots@createlegend\endcsname
\endgroup QA[\qaValue]\end{tikzpicture}`);
  assert.doesNotMatch(result.source, /pgfplots@createlegend|\\begingroup|\\endgroup/);
  assert.match(result.source, /QA\[1\]/);
  assert.match(result.source, /\\draw\[blue,area legend\]/);
  assert.deepEqual(result.diagnostics, []);
});

test("deferred neuralnetwork label callbacks use the definition visible at each layer", () => {
  const result = preprocessTikzSource(String.raw`\usepackage{neuralnetwork}
\begin{neuralnetwork}
\newcommand{\qaCaption}[2]{$A_#2$}
\inputlayer[count=1,bias=false,text=\qaCaption]
\renewcommand{\qaCaption}[2]{$B_#2$}
\outputlayer[count=1,text=\qaCaption]
\end{neuralnetwork}`);
  assert.match(result.source, /\{\$A_1\$\}/);
  assert.match(result.source, /\{\$B_1\$\}/);
});

test("native LaTeX oracle agrees on ordering, grouping, lazy bodies, and discarded arguments", async (t) => {
  let engine = process.env.QA_LATEX_ENGINE || "pdflatex";
  if (!process.env.QA_LATEX_ENGINE && spawnSync(engine, ["--version"]).status !== 0) engine = "/Library/TeX/texbin/pdflatex";
  if (spawnSync(engine, ["--version"]).status !== 0) return t.skip("native LaTeX unavailable");
  const directory = await mkdtemp(path.join(os.tmpdir(), "tikzkit-macro-oracle-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const body = String.raw`\def\qaValue{1}\def\qaAlias{\qaValue}
\typeout{QA[\qaAlias]}\def\qaValue{2}\typeout{QA[\qaAlias]}
{\def\qaValue{3}\typeout{QA[\qaAlias]}}\typeout{QA[\qaAlias]}
\newenvironment{qagroup}{\def\qaValue{4}}{}
\begin{qagroup}\typeout{QA[\qaValue]}\end{qagroup}\typeout{QA[\qaValue]}
\newcommand{\qaDiscard}[1]{fixed}\qaDiscard{\def\qaValue{9}}\typeout{QA[\qaValue]}
{\def\qaValue{5}{\gdef\qaValue{6}}\typeout{QA[\qaValue]}}\typeout{QA[\qaValue]}
{\global\def\qaValue{7}}\typeout{QA[\qaValue]}`;
  const source = String.raw`\documentclass{article}\begin{document}` + body + String.raw`\end{document}`;
  const file = path.join(directory, "oracle.tex");
  await writeFile(file, source);
  const native = spawnSync(engine, ["-interaction=nonstopmode", "-halt-on-error", `-output-directory=${directory}`, file], { encoding: "utf8", timeout: 20000 });
  assert.equal(native.status, 0, native.stdout + native.stderr);
  const expected = [...native.stdout.matchAll(/QA\[([^\]]*)\]/g)].map((match) => match[1]);
  assert.deepEqual(expected, ["1", "2", "3", "2", "4", "2", "2", "6", "6", "7"]);
  assert.deepEqual(values(source), expected);
});
