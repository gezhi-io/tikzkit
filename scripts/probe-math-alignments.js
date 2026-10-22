#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { runCommand } from "../src/adapters/externalLatex.js";
import { LATEX_10PT_FONT_PROFILE } from "../src/tex/fontProfiles.js";

const expressions = [
  String.raw`x_i^2+\frac{a_1}{b_j}`, String.raw`\sqrt[3]{1+x_i^2}`,
  String.raw`\begin{pmatrix}x_i&1\\0&y_j\end{pmatrix}`,
  String.raw`\mathbf{A}_i+\boldsymbol{\alpha_j}`,
  String.raw`\begin{aligned}x&=1\\y&=2\end{aligned}`,
  String.raw`\begin{aligned}x&=x^2\\y&=y^2\\z&=z^2\end{aligned}`,
  String.raw`\begin{aligned}x&=\frac{a_1}{b_2}\\y_i&=\sqrt{1+x^2}\end{aligned}`,
  String.raw`\begin{aligned}x&=1&z&=2\\y_i&=x^2&w_j&=3\end{aligned}`,
  String.raw`\begin{aligned}x&=1\\[2pt]y&=2\\[-2pt]z&=3\end{aligned}`,
  String.raw`\begin{aligned}[t]x&=1\\y&=\frac{1}{2}\end{aligned}`,
  String.raw`\begin{aligned}[b]x&=\frac{1}{2}\\y&=2\end{aligned}`,
  String.raw`f(x)=\begin{cases}x^2&x\geq0\\-x&x<0\end{cases}`,
  String.raw`f(x)=\begin{cases}\frac{1}{x}&\text{if }x>0\\0&\text{otherwise}\end{cases}`,
  String.raw`\begin{cases}\sqrt{x_i}&\text{for }x_i\geq0\\\frac{a_i}{b_j}&\text{if }b_j\ne0\end{cases}`,
  String.raw`\begin{cases}x&\text{first case}\\[3pt]0&\text{otherwise}\end{cases}`,
  String.raw`\begin{aligned}f(x)&=\begin{cases}x&x>0\\0&x\leq0\end{cases}\\g(x)&=x_i\end{aligned}`
];
const sizes = [...Object.values(LATEX_10PT_FONT_PROFILE), {sizePt:6,baselineSkipPt:7}, {sizePt:10.95,baselineSkipPt:13.6}];
const probes = sizes.flatMap(size => ["normal", "bold"].flatMap(mathVersion =>
  expressions.map(tex => ({ tex, ...size, mathVersion }))));
const directory = path.resolve(process.argv[2] || "outputs/qa/native-math-alignment-probes");
await mkdir(directory, { recursive: true });
const source = String.raw`\documentclass{article}
\usepackage{amsmath}
\newcommand{\Probe}[4]{\begingroup\fontsize{#2}{#3}\selectfont
\setbox0=\hbox{$#4$}\typeout{TIKZKITBOX:#1:\the\wd0:\the\ht0:\the\dp0}\endgroup}
\begin{document}
` + probes.map((p, i) => `{\\${p.mathVersion === "bold" ? "boldmath" : "unboldmath"}\\Probe{${i}}{${p.sizePt}}{${p.baselineSkipPt}}{${p.tex}}}`).join("\n") + "\n\\end{document}\n";
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
