#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { runCommand } from "../src/adapters/externalLatex.js";

const expressions = [
  String.raw`\sqrt{x}`, String.raw`\sqrt{1+x_i^2}`, String.raw`\sqrt[3]{x_i+1}`,
  String.raw`\sqrt{\frac{a_i}{b_j}}`, String.raw`\sqrt{1+\sqrt{1+x_i^2}}`,
  String.raw`\sqrt{\dfrac{1}{\dfrac{1}{x_i}}}`,
  String.raw`\begin{pmatrix}2&1\\0&3\end{pmatrix}`,
  String.raw`A=\begin{pmatrix}2&1\\0&3\end{pmatrix}`,
  String.raw`\begin{bmatrix}a_i&\frac{1}{2}\\\sqrt{x}&b_j^2\end{bmatrix}`,
  String.raw`\begin{pmatrix}1&0&0\\0&1&0\\0&0&1\\a&b&c\end{pmatrix}`,
  String.raw`\left\{\begin{array}{lr}a_i&12\\b_j&3\\c&4\end{array}\right.`,
  String.raw`\mathbf{A}_i+\mathbf{x}_{j}`, String.raw`\boldsymbol{\alpha_i+\Theta_B}`,
  String.raw`\frac{\mathbf{x}_i}{\boldsymbol{\beta_j}}`, String.raw`\mathbf{ABC}`,
  String.raw`\mathbf{\alpha+\Theta}+\boldsymbol{x}_i`,
  String.raw`\begin{Bmatrix}a&b\\c&d\end{Bmatrix}`,
  String.raw`\begin{vmatrix}a&b\\c&d\end{vmatrix}`,
  String.raw`\begin{Vmatrix}a&b\\c&d\end{Vmatrix}`,
  String.raw`\begin{matrix}a&b\\[2pt]c&d\\[-2pt]e&f\end{matrix}`,
  String.raw`\mathbf{\Delta\Omega}+\boldsymbol{\Delta\Omega}`
];
const probes = [10, 7, 5].flatMap(sizePt => ["normal", "bold"].flatMap(mathVersion =>
  expressions.map(tex => ({ tex, sizePt, mathVersion }))));
const directory = path.resolve(process.argv[2] || "outputs/qa/native-math-structure-probes");
await mkdir(directory, { recursive: true });
const source = String.raw`\documentclass{article}
\usepackage{amsmath}
\newcommand{\Probe}[4]{\begingroup\fontsize{#2}{#3}\selectfont
\setbox0=\hbox{$#4$}\typeout{TIKZKITBOX:#1:\the\wd0:\the\ht0:\the\dp0}\endgroup}
\begin{document}
` + probes.map((p, i) => `{\\${p.mathVersion === "bold" ? "boldmath" : "unboldmath"}\\Probe{${i}}{${p.sizePt}}{${({10:12,7:8,5:6})[p.sizePt]}}{${p.tex}}}`).join("\n") + "\n\\end{document}\n";
await writeFile(path.join(directory, "probe.tex"), source);
const result = await runCommand("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", "probe.tex"], { cwd: directory });
if (result.exitCode) throw new Error(result.stdout + result.stderr);
const log = await readFile(path.join(directory, "probe.log"), "utf8");
for (const m of log.matchAll(/TIKZKITBOX:(\d+):([\d.-]+)pt:([\d.-]+)pt:([\d.-]+)pt/g)) {
  probes[Number(m[1])].native = { width: Number(m[2]), height: Number(m[3]), depth: Number(m[4]) };
}
if (probes.some(p => !p.native)) throw new Error("Missing native box measurements");
await writeFile(path.join(directory, "boxes.json"), JSON.stringify({
  sourceSha256: createHash("sha256").update(source).digest("hex"), mathExtension: "ams", probes
}, null, 2) + "\n");
console.log(`${probes.length} native box measurements: ${directory}/boxes.json`);
