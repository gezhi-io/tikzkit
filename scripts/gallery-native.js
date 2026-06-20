import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { REAL_GALLERY_CASES } from "../web/real-gallery-data.js";

const outputRoot = "outputs/real-gallery/native";
await mkdir(outputRoot, { recursive: true });
const fallbackAssets = await ensureFallbackAssets(path.join(outputRoot, "_assets"));

const rows = [];
for (const [index, item] of REAL_GALLERY_CASES.entries()) {
  const id = String(index + 1).padStart(3, "0");
  const workDir = path.join(outputRoot, id);
  await mkdir(workDir, { recursive: true });
  const texPath = path.join(workDir, "case.tex");
  await writeFile(texPath, toStandaloneTex(item.source), "utf8");
  const assetFallbacks = await materializeFallbackAssets(item.source, workDir, fallbackAssets);

  const latex = spawnSync("xelatex", ["-interaction=nonstopmode", "-halt-on-error", "case.tex"], {
    cwd: workDir,
    encoding: "utf8"
  });
  let pngPath = "";
  let ok = latex.status === 0;
  if (ok) {
    const pngBase = path.join(workDir, "native");
    const raster = spawnSync("pdftocairo", ["-png", "-singlefile", "-r", "144", path.join(workDir, "case.pdf"), pngBase], {
      encoding: "utf8"
    });
    ok = raster.status === 0;
    pngPath = `${pngBase}.png`;
  }
  rows.push({
    id,
    origin: item.origin,
    path: item.path,
    ok,
    texPath,
    pngPath,
    assetFallbacks,
    error: ok ? "" : (latex.stderr || latex.stdout || "").slice(-2000)
  });
}

await writeFile(path.join(outputRoot, "report.json"), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
process.stdout.write(`gallery:native wrote ${rows.filter((row) => row.ok).length}/${rows.length} native PNGs\n`);

function toStandaloneTex(source) {
  if (/\\documentclass/.test(source)) return source;
  return String.raw`\documentclass[crop,tikz]{standalone}
\usepackage{tikz}
\usepackage{pgfplots}
\usetikzlibrary{arrows,calc,positioning,matrix,decorations.pathmorphing,decorations.markings,decorations.pathreplacing,backgrounds,fit,shapes}
\pgfplotsset{compat=1.18}
\begin{document}
${source}
\end{document}
`;
}

async function ensureFallbackAssets(assetDir) {
  await mkdir(assetDir, { recursive: true });
  const assets = {
    "router.pdf": String.raw`\documentclass[tikz,border=1pt]{standalone}
\begin{document}
\begin{tikzpicture}[line cap=round,line join=round]
  \draw[rounded corners=3pt,fill=blue!12,draw=blue!70!black,very thick] (-1,-0.55) rectangle (1,0.55);
  \draw[blue!70!black,thick] (-0.65,0.1) -- (-0.25,0.1) -- (-0.25,0.35);
  \draw[blue!70!black,thick] (0.65,0.1) -- (0.25,0.1) -- (0.25,0.35);
  \draw[blue!70!black,thick] (-0.65,-0.1) -- (-0.25,-0.1) -- (-0.25,-0.35);
  \draw[blue!70!black,thick] (0.65,-0.1) -- (0.25,-0.1) -- (0.25,-0.35);
  \node[font=\scriptsize\ttfamily,blue!60!black] at (0,0) {router};
\end{tikzpicture}
\end{document}
`,
    "switch.pdf": String.raw`\documentclass[tikz,border=1pt]{standalone}
\begin{document}
\begin{tikzpicture}[line cap=round,line join=round]
  \draw[rounded corners=3pt,fill=green!12,draw=green!50!black,very thick] (-1,-0.55) rectangle (1,0.55);
  \foreach \x in {-0.6,-0.2,0.2,0.6} {
    \draw[green!50!black,thick] (\x,-0.25) -- (\x,0.25);
    \fill[green!50!black] (\x,0.28) circle (0.035);
  }
  \node[font=\scriptsize\ttfamily,green!35!black] at (0,0) {switch};
\end{tikzpicture}
\end{document}
`
  };

  const result = {};
  for (const [name, source] of Object.entries(assets)) {
    const stem = path.basename(name, ".pdf");
    const texPath = path.join(assetDir, `${stem}.tex`);
    await writeFile(texPath, source, "utf8");
    const compile = spawnSync("xelatex", ["-interaction=nonstopmode", "-halt-on-error", `${stem}.tex`], {
      cwd: assetDir,
      encoding: "utf8"
    });
    if (compile.status === 0) result[name] = path.join(assetDir, name);
  }
  return result;
}

async function materializeFallbackAssets(source, workDir, fallbackAssets) {
  const used = [];
  const matches = String(source).matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g);
  for (const match of matches) {
    const fileName = path.basename(match[1]);
    const fallback = fallbackAssets[fileName];
    if (!fallback) continue;
    await copyFile(fallback, path.join(workDir, fileName));
    used.push(fileName);
  }
  return used;
}
