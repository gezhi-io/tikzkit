import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tikzToSvg } from "../src/index.js";

const PACKT_ROOT = "work/packt-tikz-examples";
const PETARV_ROOT = "work/petarv-tikz";
const OUTPUT_PATH = "web/real-gallery-data.js";
const TARGET_COUNT = 100;

const TIKZ_NET_CASES = [
  {
    title: "Desargues's theorem",
    origin: "TikZ.net",
    sourceUrl: "https://tikz.net/desargues/",
    path: "desargues",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usetikzlibrary{calc,intersections}
\begin{document}
\begin{tikzpicture}
  \coordinate [label=above:$p$] (p) at (2,9);
  \coordinate [label=left:$u$] (u) at (0,3);
  \coordinate [label=left:$r$] (r) at ($(p)!0.5!(u)$);
  \coordinate (q) at (2,2);
  \coordinate (l) at (7,0);
  \coordinate (m) at (9,9);
  \coordinate [label=right:$x$] (x) at ($(l)!0.27!(m)$);
  \coordinate [label=right:$y$] (y) at ($(l)!0.54!(m)$);
  \coordinate [label=right:$z$] (z) at ($(l)!0.7!(m)$);
  \draw [color=red,thick] (l) -- (m);
  \path [name path = pq] (p) -- (q);
  \draw [name path = ux] (u) -- (x);
  \path [name intersections={of = pq and ux,by = v}];
  \node [label=below:$v$] at (v) {};
  \draw [color=red,dashed] (p) -- (v);
  \path [name path = uy] (u) -- (y);
  \path [name path = vz] (v) -- (z);
  \path [name intersections={of = uy and vz,by = w}];
  \node [label=below:$w$] at (w) {};
  \draw [color=red,dashed,name path=pw] (p) -- (w);
  \path [name path = rx] (r) -- (x);
  \path [name path = ry] (r) -- (y);
  \path [name intersections={of = pq and rx,by = s}];
  \node [label=below left:$s$] at (s) {};
  \path [name intersections={of = pw and ry,by = t}];
  \node [label=above right:$t$] at (t) {};
  \fill [color=green,opacity=0.2] (r) -- (s) -- (t) -- (r);
  \fill [color=blue,opacity=0.2] (u) -- (v) -- (w) -- (u);
  \draw (x) -- (r) -- (y) (u) -- (y);
  \filldraw [fill=red,draw=red] (p) circle(1pt);
  \draw (s) -- (z) -- (v);
  \draw [color=red,dashed] (p) -- (u);
\end{tikzpicture}
\end{document}`
  }
];

const TIKZ_3DPLOT_CASES = [
  {
    title: "Main coordinate frame",
    origin: "MacTeX tikz-3dplot",
    sourceUrl: "https://ctan.org/pkg/tikz-3dplot",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-3dplot/tikz-3dplot_documentation.tex#tdplotsetmaincoords",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-3dplot}
\begin{document}
\tdplotsetmaincoords{70}{110}
\begin{tikzpicture}[tdplot_main_coords]
  \draw[thick,->] (0,0,0) -- (1,0,0) node[anchor=north east]{$x$};
  \draw[thick,->] (0,0,0) -- (0,1,0) node[anchor=north west]{$y$};
  \draw[thick,->] (0,0,0) -- (0,0,1) node[anchor=south]{$z$};
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Rotated coordinate frame",
    origin: "MacTeX tikz-3dplot",
    sourceUrl: "https://ctan.org/pkg/tikz-3dplot",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-3dplot/tikz-3dplot_documentation.tex#tdplotsetrotatedcoords",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-3dplot}
\begin{document}
\tdplotsetmaincoords{70}{110}
\begin{tikzpicture}[tdplot_main_coords]
  \draw[thick,->] (0,0,0) -- (1,0,0) node[anchor=north east]{$x$};
  \draw[thick,->] (0,0,0) -- (0,1,0) node[anchor=north west]{$y$};
  \draw[thick,->] (0,0,0) -- (0,0,1) node[anchor=south]{$z$};
  \tdplotsetrotatedcoords{60}{40}{30}
  \draw[thick,color=blue,tdplot_rotated_coords,->] (0,0,0) -- (.7,0,0) node[anchor=north]{$x'$};
  \draw[thick,color=blue,tdplot_rotated_coords,->] (0,0,0) -- (0,.7,0) node[anchor=west]{$y'$};
  \draw[thick,color=blue,tdplot_rotated_coords,->] (0,0,0) -- (0,0,.7) node[anchor=south]{$z'$};
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Spherical point projections",
    origin: "MacTeX tikz-3dplot",
    sourceUrl: "https://ctan.org/pkg/tikz-3dplot",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-3dplot/tikz-3dplot_documentation.tex#tdplotsetcoord",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-3dplot}
\begin{document}
\tdplotsetmaincoords{60}{130}
\begin{tikzpicture}[scale=2,tdplot_main_coords]
  \coordinate (O) at (0,0,0);
  \tdplotsetcoord{P}{.8}{55}{60}
  \draw[thick,->] (0,0,0) -- (1,0,0) node[anchor=north east]{$x$};
  \draw[thick,->] (0,0,0) -- (0,1,0) node[anchor=north west]{$y$};
  \draw[thick,->] (0,0,0) -- (0,0,1) node[anchor=south]{$z$};
  \draw[-stealth,color=red] (O) -- (P);
  \draw[dashed,color=red] (O) -- (Px);
  \draw[dashed,color=red] (O) -- (Py);
  \draw[dashed,color=red] (O) -- (Pz);
  \draw[dashed,color=red] (Px) -- (Pxy);
  \draw[dashed,color=red] (Py) -- (Pxy);
  \draw[dashed,color=red] (Pxy) -- (P);
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Spherical angle arcs",
    origin: "MacTeX tikz-3dplot",
    sourceUrl: "https://ctan.org/pkg/tikz-3dplot",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-3dplot/tikz-3dplot_documentation.tex#tdplotdrawarc",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-3dplot}
\begin{document}
\tdplotsetmaincoords{60}{110}
\pgfmathsetmacro{\rvec}{.8}
\pgfmathsetmacro{\thetavec}{30}
\pgfmathsetmacro{\phivec}{60}
\begin{tikzpicture}[scale=5,tdplot_main_coords]
  \coordinate (O) at (0,0,0);
  \draw[thick,->] (0,0,0) -- (1,0,0) node[anchor=north east]{$x$};
  \draw[thick,->] (0,0,0) -- (0,1,0) node[anchor=north west]{$y$};
  \draw[thick,->] (0,0,0) -- (0,0,1) node[anchor=south]{$z$};
  \tdplotsetcoord{P}{\rvec}{\thetavec}{\phivec}
  \draw[-stealth,color=red] (O) -- (P);
  \draw[dashed,color=red] (O) -- (Pxy);
  \draw[dashed,color=red] (P) -- (Pxy);
  \tdplotdrawarc{(O)}{0.2}{0}{\phivec}{anchor=north}{$\phi$}
  \tdplotsetthetaplanecoords{\phivec}
  \tdplotdrawarc[tdplot_rotated_coords]{(0,0,0)}{0.5}{0}{\thetavec}{anchor=south west}{$\theta$}
\end{tikzpicture}
\end{document}`
  }
];

const TIKZ_BAGUA_CASES = [
  {
    title: "Taiji symbols",
    origin: "MacTeX tikz-bagua",
    sourceUrl: "https://ctan.org/pkg/tikz-bagua",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-bagua/tikz-bagua.tex#taiji",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-bagua}
\begin{document}
\begin{tikzpicture}
  \node at (0,0) {\taiji[2]};
  \node at (0.7,0) {\taiji*[2]};
  \node at (1.4,0) {\xtaiji[2]};
  \node at (2.1,0) {\xtaiji*[2]};
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Liangyi and sixiang symbols",
    origin: "MacTeX tikz-bagua",
    sourceUrl: "https://ctan.org/pkg/tikz-bagua",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-bagua/tikz-bagua.tex#sixiang",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-bagua}
\begin{document}
\begin{tikzpicture}
  \node at (0,0.5) {\liangyi{1}[1.6]};
  \node at (0,0) {\liangyi{0}[1.6]};
  \node at (1,1.2) {$3$};
  \node at (1,0.6) {\sixiang*{3}[1.4]};
  \node at (2,1.2) {$2$};
  \node at (2,0.6) {\sixiang*{2}[1.4]};
  \node at (3,1.2) {$1$};
  \node at (3,0.6) {\sixiang*{1}[1.4]};
  \node at (4,1.2) {$0$};
  \node at (4,0.6) {\sixiang*{0}[1.4]};
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Eight trigrams",
    origin: "MacTeX tikz-bagua",
    sourceUrl: "https://ctan.org/pkg/tikz-bagua",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-bagua/tikz-bagua.tex#bagua",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-bagua}
\begin{document}
\begin{tikzpicture}
  \node at (0,0.55) {$7$};
  \node at (0,0) {\bagua*{7}[1.5]};
  \node at (1,0.55) {$6$};
  \node at (1,0) {\bagua*{6}[1.5]};
  \node at (2,0.55) {$5$};
  \node at (2,0) {\bagua*{5}[1.5]};
  \node at (3,0.55) {$4$};
  \node at (3,0) {\bagua*{4}[1.5]};
  \node at (4,0.55) {$3$};
  \node at (4,0) {\bagua*{3}[1.5]};
  \node at (5,0.55) {$2$};
  \node at (5,0) {\bagua*{2}[1.5]};
  \node at (6,0.55) {$1$};
  \node at (6,0) {\bagua*{1}[1.5]};
  \node at (7,0.55) {$0$};
  \node at (7,0) {\bagua*{0}[1.5]};
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Six-line hexagrams",
    origin: "MacTeX tikz-bagua",
    sourceUrl: "https://ctan.org/pkg/tikz-bagua",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-bagua/tikz-bagua.tex#Bagua",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-bagua}
\begin{document}
\begin{tikzpicture}
  \node at (0,0.85) {\scriptsize 77};
  \node at (0,0.5) {\Bagua[8]{77}[1.4]};
  \node at (0.7,0.85) {\scriptsize 76};
  \node at (0.7,0.5) {\Bagua[8]{76}[1.4]};
  \node at (1.4,0.85) {\scriptsize 75};
  \node at (1.4,0.5) {\Bagua[8]{75}[1.4]};
  \node at (2.1,0.85) {\scriptsize 74};
  \node at (2.1,0.5) {\Bagua[8]{74}[1.4]};
  \node at (0,0) {\scriptsize 67};
  \node at (0,-0.35) {\Bagua[8]{67}[1.4]};
  \node at (0.7,0) {\scriptsize 66};
  \node at (0.7,-0.35) {\Bagua[8]{66}[1.4]};
  \node at (1.4,0) {\scriptsize 65};
  \node at (1.4,-0.35) {\Bagua[8]{65}[1.4]};
  \node at (2.1,0) {\scriptsize 64};
  \node at (2.1,-0.35) {\Bagua[8]{64}[1.4]};
  \node at (0,-0.85) {\scriptsize 57};
  \node at (0,-1.2) {\Bagua[8]{57}[1.4]};
  \node at (0.7,-0.85) {\scriptsize 56};
  \node at (0.7,-1.2) {\Bagua[8]{56}[1.4]};
  \node at (1.4,-0.85) {\scriptsize 55};
  \node at (1.4,-1.2) {\Bagua[8]{55}[1.4]};
  \node at (2.1,-0.85) {\scriptsize 54};
  \node at (2.1,-1.2) {\Bagua[8]{54}[1.4]};
  \node at (0,-1.7) {\scriptsize 47};
  \node at (0,-2.05) {\Bagua[8]{47}[1.4]};
  \node at (0.7,-1.7) {\scriptsize 46};
  \node at (0.7,-2.05) {\Bagua[8]{46}[1.4]};
  \node at (1.4,-1.7) {\scriptsize 45};
  \node at (1.4,-2.05) {\Bagua[8]{45}[1.4]};
  \node at (2.1,-1.7) {\scriptsize 44};
  \node at (2.1,-2.05) {\Bagua[8]{44}[1.4]};
\end{tikzpicture}
\end{document}`
  }
];

const TIKZ_BBOX_CASES = [
  {
    title: "Tight Bezier bounding box",
    origin: "MacTeX tikz-bbox",
    sourceUrl: "https://ctan.org/pkg/tikz-bbox",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-bbox/pgfmanual-en-library-bbox.tex#bezier-bounding-box",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepgflibrary{bbox}
\begin{document}
\begin{tikzpicture}[bezier bounding box,bullet/.style={circle,fill,inner sep=1pt}]
  \draw (0,0) .. controls (-1,1) and (1,2) .. (2,0);
  \draw (current bounding box.south west) rectangle (current bounding box.north east);
  \draw[red,dashed]
    (0,0) -- (-1,1) node[bullet,label=above:{$(x_a,y_a)$}]{}
    (2,0) -- (1,2) node[bullet,label=above:{$(x_b,y_b)$}]{};
  \path
    (0,0) node[bullet,label=below:{$(x_0,y_0)$}]{}
    (2,0) node[bullet,label=below:{$(x_1,y_1)$}]{};
\end{tikzpicture}
\end{document}`
  }
];

const TIKZ_BPMN_CASES = [
  {
    title: "BPMN task, events, gateways, and flows",
    origin: "MacTeX tikz-bpmn",
    sourceUrl: "https://ctan.org/pkg/tikz-bpmn",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-bpmn/tikz-bpmn-doc.tex",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usetikzlibrary{bpmn,positioning}
\begin{document}
\begin{tikzpicture}[node distance=1.7cm]
  \node[start event] (start) {};
  \node[task, right=of start] (task) {Review};
  \node[exclusive gateway, right=of task] (gate) {};
  \node[message start event, below=of task] (msg) {};
  \node[timer intermediate event, below=of gate] (timer) {};
  \node[end event, right=of gate] (end) {};
  \draw[sequence] (start) -- (task);
  \draw[sequence] (task) -- (gate);
  \draw[sequence] (gate) -- (end);
  \draw[message] (msg) -- (timer);
  \draw[association] (task.south) -- (msg.north);
\end{tikzpicture}
\end{document}`
  }
];

const TIKZ_CD_CASES = [
  {
    title: "Commutative diagram pullback square",
    origin: "MacTeX tikz-cd",
    sourceUrl: "https://ctan.org/pkg/tikz-cd",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-cd/tikz-cd-doc.tex#real-life-examples",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-cd}
\begin{document}
\begin{tikzcd}
  T
  \arrow[drr, bend left, "x"]
  \arrow[ddr, bend right, "y"]
  \arrow[dr, dotted, "{(x,y)}" description] & & \\
    & X \times_Z Y \arrow[r, "p"] \arrow[d, "q"]
      & X \arrow[d, "f"] \\
    & Y \arrow[r, "g"]
      & Z
\end{tikzcd}
\end{document}`
  }
];

const petarVFiles = await walkTex(PETARV_ROOT);
const packtFiles = await walkTex(PACKT_ROOT);
const petarVCases = [];
const packtCases = [];

for (const filePath of petarVFiles) {
  const relativePath = path.relative(PETARV_ROOT, filePath);
  const source = await readFile(filePath, "utf8");
  petarVCases.push({
    title: titleFromPath(relativePath),
    origin: "PetarV-/TikZ",
    path: relativePath,
    sourceUrl: `https://github.com/PetarV-/TikZ/blob/master/${relativePath}`,
    source
  });
}

for (const filePath of packtFiles) {
  const relativePath = path.relative(PACKT_ROOT, filePath);
  const source = await readFile(filePath, "utf8");
  if (!isRenderable(source)) continue;
  packtCases.push({
    title: titleFromPath(relativePath),
    origin: "Packt GitHub",
    path: relativePath,
    sourceUrl: `https://github.com/PacktPublishing/LaTeX-graphics-with-TikZ/blob/main/${relativePath}`,
    source
  });
}

const tikzNetCases = TIKZ_NET_CASES.filter((item) => isRenderable(item.source));
const fillerCount = TARGET_COUNT - petarVCases.length - tikzNetCases.length;
const selected = [
  ...petarVCases,
  ...tikzNetCases,
  ...packtCases.slice(0, Math.max(0, fillerCount)),
  ...TIKZ_3DPLOT_CASES,
  ...TIKZ_BAGUA_CASES,
  ...TIKZ_BBOX_CASES,
  ...TIKZ_BPMN_CASES,
  ...TIKZ_CD_CASES
];

if (selected.length < TARGET_COUNT) {
  throw new Error(`Only found ${selected.length} renderable real cases; need ${TARGET_COUNT}`);
}

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(
  OUTPUT_PATH,
  renderModule(selected, {
    petarVFound: petarVCases.length,
    packtFound: packtCases.length,
    tikzNetFound: tikzNetCases.length,
    tikzThreeDPlotFound: TIKZ_3DPLOT_CASES.length,
    tikzBaguaFound: TIKZ_BAGUA_CASES.length,
    tikzBboxFound: TIKZ_BBOX_CASES.length,
    tikzBpmnFound: TIKZ_BPMN_CASES.length,
    tikzCdFound: TIKZ_CD_CASES.length
  }),
  "utf8"
);
process.stdout.write(`Wrote ${selected.length} real gallery cases to ${OUTPUT_PATH}\n`);

async function walkTex(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkTex(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".tex")) {
      files.push(entryPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function isRenderable(source) {
  const result = tikzToSvg(source);
  return result.diagnostics.length === 0 && result.ir.items.length > 0;
}

function titleFromPath(relativePath) {
  const directory = path.dirname(relativePath).replace(/^\d+-/, "").replace(/-/g, " ");
  const name = path.basename(relativePath, ".tex").replace(/^\d+-/, "").replace(/-/g, " ");
  return `${directory} / ${name}`;
}

function renderModule(cases, summary) {
  return [
    "// Generated by scripts/build-real-gallery-data.js from real TikZ sources.",
    "// Do not edit by hand; rerun the script after changing supported syntax.",
    `export const REAL_GALLERY_CASES = ${JSON.stringify(cases, null, 2)};`,
    "",
    `export const REAL_GALLERY_SUMMARY = ${JSON.stringify(
      {
        caseCount: cases.length,
        ...summary,
        origins: [...new Set(cases.map((item) => item.origin))]
      },
      null,
      2
    )};`,
    ""
  ].join("\n");
}
