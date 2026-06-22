import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const WALMES_ROOT = "work/walmes-tikz/src";
export const WALMES_EXPECTED_PGF_COUNT = 311;
export const WALMES_REPOSITORY_URL = "https://github.com/walmes/Tikz";

export const WALMES_SANITIZED_PREAMBLE = String.raw`\documentclass[border=4mm]{standalone}
\usepackage{xcolor}
\usepackage{tikz}
\usepackage{pgfplots}
\usepackage{pgfplotstable}
\usepackage{pgfcalendar}
\usepackage{pgfgantt}
\pgfplotsset{compat=newest}
\usepgfplotslibrary{groupplots}
\usetikzlibrary{
  arrows,
  arrows.meta,
  positioning,
  matrix,
  calc,
  decorations.pathreplacing,
  decorations.pathmorphing,
  decorations.markings,
  decorations.text,
  shapes,
  backgrounds,
  shadows,
  trees,
  fit,
  snakes,
  patterns,
  mindmap,
  intersections,
  calendar,
  plotmarks,
  spy,
  tikzmark
}
\definecolor{fgcolor}{rgb}{0.345,0.345,0.345}
\definecolor{darkgreen}{rgb}{0.13,0.53,0.53}
\definecolor{shadecolor}{rgb}{0.97,0.97,0.97}
\definecolor{messagecolor}{rgb}{0,0,0}
\definecolor{warningcolor}{rgb}{1,0,1}
\definecolor{errorcolor}{rgb}{1,0,0}
\newcommand{\hlnum}[1]{\textcolor{purple}{#1}}
\newcommand{\hlstr}[1]{\textcolor{blue}{#1}}
\newcommand{\hlcom}[1]{\textcolor{gray}{#1}}
\newcommand{\hlopt}[1]{#1}
\newcommand{\hlstd}[1]{\textcolor{fgcolor}{#1}}
\newcommand{\hlkwa}[1]{\textbf{#1}}
\newcommand{\hlkwb}[1]{#1}
\newcommand{\hlkwc}[1]{\textcolor{green!50!black}{#1}}
\newcommand{\hlkwd}[1]{\textbf{#1}}
\begin{document}
<>
\end{document}`;

export function hasWalmesCorpus(root = WALMES_ROOT) {
  return existsSync(root);
}

export async function listWalmesPgfFiles(root = WALMES_ROOT) {
  const files = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".pgf")) files.push(absolutePath);
    }
  }
  await walk(root);
  return files.sort((left, right) => left.localeCompare(right));
}

export function wrapWalmesPgf(body) {
  return WALMES_SANITIZED_PREAMBLE.replace("<>", String(body));
}

export async function loadWalmesCases(root = WALMES_ROOT) {
  const files = await listWalmesPgfFiles(root);
  return Promise.all(
    files.map(async (filePath) => {
      const relativePath = path.relative(root, filePath).split(path.sep).join("/");
      const body = await readFile(filePath, "utf8");
      return {
        title: path.basename(relativePath, ".pgf").replace(/[-_]+/g, " "),
        origin: "walmes/Tikz",
        path: relativePath,
        sourceUrl: `${WALMES_REPOSITORY_URL}/blob/master/src/${relativePath}`,
        source: wrapWalmesPgf(body)
      };
    })
  );
}
