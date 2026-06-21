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

const TIKZ_NETWORK_CASES = [
  {
    title: "Styled directed network with loops",
    origin: "MacTeX tikz-network",
    sourceUrl: "https://ctan.org/pkg/tikz-network",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-network/tikz-network.tex",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-network}
\begin{document}
\begin{tikzpicture}
  \SetVertexStyle[MinSize=.65cm,FillColor=orange!20,LineColor=black,LineWidth=1pt,TextColor=black]
  \SetEdgeStyle[Color=gray,LineWidth=1pt,TextFillColor=white,Arrow=-latex]
  \Vertex[x=0,y=0,IdAsLabel]{A}
  \Vertex[x=2,y=0,IdAsLabel]{B}
  \Vertex[x=1,y=1.5,label=C,Math,color=blue!20]{C}
  \Vertex[x=3,y=1.2,label=D,color=green!20]{D}
  \Edge[Direct,label=$a$,bend=25,color=red,lw=1.2pt](A)(B)
  \Edge[Direct,label=$b$,fontcolor=blue](B)(C)
  \Edge[style={dashed},path={A,{1,-.8},C}](A)(C)
  \Edge[loopposition=90,loopsize=.45cm,label=L](D)(D)
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

const TIKZ_DIMLINE_CASES = [
  {
    title: "Dimension lines with extension paths",
    origin: "MacTeX tikz-dimline",
    sourceUrl: "https://ctan.org/pkg/tikz-dimline",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-dimline/tikz-dimline-doc.tex",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-dimline}
\usetikzlibrary{calc}
\begin{document}
\begin{tikzpicture}[scale=.75]
  \draw[fill=blue!8,draw=blue!50,rounded corners=2pt,line width=.8pt] (0,0) rectangle (2.5,4);
  \draw[fill=white,draw=black,line width=.7pt] (.5,1.1) rectangle (2,2.9);
  \coordinate (A) at (2.7,0);
  \coordinate (B) at (2.7,4);
  \dimline[color=blue,line style={line width=.7pt},label style={right=0.5ex,font=\small},extension start length=.35,extension end length=.35]{(A)}{(B)}{$4.0$}
  \dimline[color=red,line style={line width=.7pt},label style={above=0.5ex,font=\small},extension start length=0,extension end length=0]{(.5,2)}{(2,2)}{$d=1.5$}
  \dimline[label style={above=0.5ex,fill=blue!10,font=\small},extension start path={(0,4.45) (0,4.15) (.5,3.9)},extension end path={(2.5,4.45) (2.5,4.15) (2,3.9)},extension start style={draw=green!60!black},extension end style={draw=green!60!black}]{(0,4.45)}{(2.5,4.45)}{custom}
\end{tikzpicture}
\end{document}`
  }
];

const TIKZ_EXT_CASES = [
  {
    title: "Core tikz-ext paths, mirrors, and shapes",
    origin: "MacTeX tikz-ext",
    sourceUrl: "https://ctan.org/pkg/tikz-ext",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-ext/tikz-ext-manual.tex",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usetikzlibrary{ext.paths.ortho,ext.paths.arcto,ext.topaths.arcthrough,ext.transformations.mirror,ext.shapes.superellipse,ext.shapes.circlecrosssplit}
\begin{document}
\begin{tikzpicture}[very thick]
  \coordinate[label=below left:$A$] (A) at (0,0);
  \coordinate[label=above right:$B$] (B) at (3,2);
  \coordinate[label=above:$C$] (C) at (1,2.6);
  \draw[help lines,step=.5] (-.5,-1) grid (4.8,3.2);
  \draw[blue,-latex] (A) -|- node[pos=.5,above] {hvh} (B);
  \draw[red,-latex] (0,-.55) |-| node[pos=.5,right] {vhv} (3,1.4);
  \draw[green!60!black,-latex] (A) r-ud node[pos=.5,above] {ud} (B);
  \draw[purple] (A) arc to[radius=2.5,clockwise] node[midway,below] {arc to} (B);
  \draw[orange,fill=orange!20] (A) to[ext/arc through={clockwise,(C)}] (B) -- (arc through center) -- cycle;
  \node[draw,shape=superellipse,fill=blue!10,minimum width=1.5cm,minimum height=.75cm] at (4.1,1.65) {super};
  \node[draw,shape=circle cross split,fill=yellow!15,minimum size=.95cm] at (4.1,.25) {};
  \draw[dashed] (1.5,-.9) -- (1.5,3.1);
  \begin{scope}[ext/xmirror=1.5]
    \draw[teal,dashed,-latex] (0,.25) .. controls (.5,1.05) .. (1,.75);
  \end{scope}
\end{tikzpicture}
\end{document}`
  }
];

const TIKZ_FEYNHAND_CASES = [
  {
    title: "FeynHand vertices and propagators",
    origin: "MacTeX tikz-feynhand",
    sourceUrl: "https://ctan.org/pkg/tikz-feynhand",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-feynhand/tikz-feynhand.userguide.tex",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-feynhand}
\begin{document}
\begin{tikzpicture}
\begin{feynhand}
  \vertex [particle] (e1) at (0,1.2) {$e^-$};
  \vertex [particle] (e2) at (0,-1.2) {$e^+$};
  \vertex [dot] (v1) at (1,0) {};
  \vertex [ringdot] (v2) at (2.35,0) {};
  \vertex [blob] (b) at (3.65,1.05) {};
  \vertex [crossdot] (x) at (3.65,-1.05) {};
  \propag [fer, blue, mom={$p$}] (e1) to [edge label=$k$] (v1);
  \propag [antfer, red] (e2) to (v1);
  \propag [pho, orange] (v1) to [out=20, in=160] (v2);
  \propag [glu, green] (v2) to (b);
  \propag [sca, purple] (v2) to [edge label'=$m$] (x);
  \propag [chabos, top] (b) to (x);
\end{feynhand}
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

const TIKZ_DECOFONTS_CASES = [
  {
    title: "Decorative text effects",
    origin: "MacTeX tikz-decofonts",
    sourceUrl: "https://ctan.org/pkg/tikz-decofonts",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-decofonts/tikz-decofonts-doc.tex",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-decofonts}
\begin{document}
\tkzbrush[color=blue]{DECORATION}
\tkzink[color=orange,thick=5]{DECORATION}
\tkzbicolor[colors=blue/red,style=ndiag]{\Huge\sffamily DECORATION}
\tkzsurround[color=orange]{$I=\displaystyle\int_a^b f(x)\,\mathrm{d}x$}
\tkzunderline[color=blue,width=1.5pt,height=8mm]{underlining}
\tkzcomicbubble[width=3cm,coltxt=red,colframe=teal,colbg=yellow!15,rcorners]{Let's play!}
\tkzfittextinarrow[width=4cm,color=teal,txtcolor=yellow]{\bfseries Demo}
\tkzcircledtxt[auto=2,fill=false,rule color=orange]{99}
\end{document}`
  }
];

const RICH_EXTENSION_CASES = [
  {
    title: "3D rotated frame with spherical guides",
    origin: "MacTeX tikz-3dplot",
    sourceUrl: "https://ctan.org/pkg/tikz-3dplot",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-3dplot/tikz-3dplot_documentation.tex#combined",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-3dplot}
\begin{document}
\tdplotsetmaincoords{65}{120}
\begin{tikzpicture}[scale=3,tdplot_main_coords]
  \coordinate (O) at (0,0,0);
  \tdplotsetcoord{P}{.9}{45}{65}
  \draw[thick,->] (O) -- (1,0,0) node[anchor=north east]{$x$};
  \draw[thick,->] (O) -- (0,1,0) node[anchor=north west]{$y$};
  \draw[thick,->] (O) -- (0,0,1) node[anchor=south]{$z$};
  \draw[-stealth,red,line width=.7pt] (O) -- (P) node[anchor=south west]{$P$};
  \draw[dashed,red] (O) -- (Pxy) -- (P);
  \draw[dashed,red] (Px) -- (Pxy) -- (Py);
  \tdplotdrawarc{(O)}{.25}{0}{65}{anchor=north}{$\phi$}
  \tdplotsetthetaplanecoords{65}
  \tdplotdrawarc[tdplot_rotated_coords]{(0,0,0)}{.45}{0}{45}{anchor=south west}{$\theta$}
  \tdplotsetrotatedcoords{55}{25}{35}
  \draw[tdplot_rotated_coords,blue,->] (0,0,0) -- (.65,0,0) node[anchor=north]{$x'$};
  \draw[tdplot_rotated_coords,blue,->] (0,0,0) -- (0,.65,0) node[anchor=west]{$y'$};
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Bagua ring composition",
    origin: "MacTeX tikz-bagua",
    sourceUrl: "https://ctan.org/pkg/tikz-bagua",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-bagua/tikz-bagua.tex#composition",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-bagua}
\begin{document}
\begin{tikzpicture}
  \node at (0,0) {\taiji*[2.4]};
  \node at (0,1.55) {\bagua*{7}[1.4]};
  \node at (1.1,1.1) {\bagua*{6}[1.4]};
  \node at (1.55,0) {\bagua*{5}[1.4]};
  \node at (1.1,-1.1) {\bagua*{4}[1.4]};
  \node at (0,-1.55) {\bagua*{3}[1.4]};
  \node at (-1.1,-1.1) {\Bagua[8]{56}[1.1]};
  \node at (-1.55,0) {\Bagua[8]{65}[1.1]};
  \node at (-1.1,1.1) {\Bagua[8]{74}[1.1]};
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Bezier bounding box control study",
    origin: "MacTeX tikz-bbox",
    sourceUrl: "https://ctan.org/pkg/tikz-bbox",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-bbox/pgfmanual-en-library-bbox.tex#control-points",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepgflibrary{bbox}
\begin{document}
\begin{tikzpicture}[bezier bounding box,bullet/.style={circle,fill,inner sep=1.2pt}]
  \draw[blue,line width=.8pt] (0,0) .. controls (-1.3,1.4) and (.8,2.2) .. (2.4,.2)
    .. controls (3.1,-.9) and (4.2,1.3) .. (5,.1);
  \draw[red,dashed] (0,0) -- (-1.3,1.4) (.8,2.2) -- (2.4,.2)
    (2.4,.2) -- (3.1,-.9) (4.2,1.3) -- (5,.1);
  \path (0,0) node[bullet,label=below:$P_0$]{} (2.4,.2) node[bullet,label=below:$P_1$]{}
    (5,.1) node[bullet,label=below:$P_2$]{};
  \draw[gray] (current bounding box.south west) rectangle (current bounding box.north east);
\end{tikzpicture}
\end{document}`
  },
  {
    title: "BPMN order flow",
    origin: "MacTeX tikz-bpmn",
    sourceUrl: "https://ctan.org/pkg/tikz-bpmn",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-bpmn/tikz-bpmn-doc.tex#process",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usetikzlibrary{bpmn,positioning}
\begin{document}
\begin{tikzpicture}[node distance=1.55cm]
  \node[start event] (start) {};
  \node[task, right=of start] (pick) {Pick};
  \node[exclusive gateway, right=of pick] (ok) {};
  \node[manual task, above right=of ok] (fix) {Fix};
  \node[task, right=of ok] (ship) {Ship};
  \node[data object, below=of pick] (doc) {Order};
  \node[end event, right=of ship] (end) {};
  \draw[sequence] (start) -- (pick);
  \draw[sequence] (pick) -- (ok);
  \draw[sequence] (ok) -- node[above]{yes} (ship);
  \draw[sequence] (ok) -- node[left]{no} (fix);
  \draw[sequence] (fix) -- (ship);
  \draw[association] (doc) -- (pick);
  \draw[message] (ship) -- (end);
\end{tikzpicture}
\end{document}`
  },
  {
    title: "TikZ-CD grid with diagonal maps",
    origin: "MacTeX tikz-cd",
    sourceUrl: "https://ctan.org/pkg/tikz-cd",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-cd/tikz-cd-doc.tex#arrows",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-cd}
\begin{document}
\begin{tikzcd}
  A \arrow[r, "f"] \arrow[d, "g"'] \arrow[dr, dashed, "\alpha" description] & B \arrow[r, two heads, "p"] \arrow[d, "h"] & C \arrow[d, hook, "k"] \\
  D \arrow[r, "u"'] & E \arrow[r, "v"'] \arrow[ur, dotted, "\beta" description] & F
\end{tikzcd}
\end{document}`
  },
  {
    title: "Decorative text sampler",
    origin: "MacTeX tikz-decofonts",
    sourceUrl: "https://ctan.org/pkg/tikz-decofonts",
    path: "/usr/local/texlive/2025/texmf-dist/doc/latex/tikz-decofonts/tikz-decofonts-doc.tex#sampler",
    source: String.raw`\documentclass[tikz,border=10pt]{standalone}
\usepackage{tikz-decofonts}
\begin{document}
\tkzbrush[color=purple]{BRUSH}
\tkzink[color=teal,thick=4]{INK}
\tkzbicolor[colors=orange/blue,style=diag]{\Large\sffamily SPLIT}
\tkzsurround[color=red]{$E=mc^2$}
\tkzunderline[color=green!60!black,width=1pt,height=5mm]{measured underline}
\tkzcomicbubble[width=3.4cm,coltxt=blue,colframe=orange,colbg=yellow!15,rcorners]{Rich case}
\tkzfittextinarrow[width=4.5cm,color=blue,txtcolor=white]{follow me}
\tkzcircledtxt[auto=3,rule color=purple]{OK}
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
  ...TIKZ_NETWORK_CASES,
  ...TIKZ_3DPLOT_CASES,
  ...TIKZ_BAGUA_CASES,
  ...TIKZ_BBOX_CASES,
  ...TIKZ_BPMN_CASES,
  ...TIKZ_CD_CASES,
  ...TIKZ_DECOFONTS_CASES,
  ...TIKZ_DIMLINE_CASES,
  ...TIKZ_EXT_CASES,
  ...TIKZ_FEYNHAND_CASES,
  ...RICH_EXTENSION_CASES
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
    tikzNetworkFound: TIKZ_NETWORK_CASES.length,
    tikzThreeDPlotFound: TIKZ_3DPLOT_CASES.length,
    tikzBaguaFound: TIKZ_BAGUA_CASES.length,
    tikzBboxFound: TIKZ_BBOX_CASES.length,
    tikzBpmnFound: TIKZ_BPMN_CASES.length,
    tikzCdFound: TIKZ_CD_CASES.length,
    tikzDecofontsFound: TIKZ_DECOFONTS_CASES.length,
    tikzDimlineFound: TIKZ_DIMLINE_CASES.length,
    tikzExtFound: TIKZ_EXT_CASES.length,
    tikzFeynhandFound: TIKZ_FEYNHAND_CASES.length,
    richExtensionFound: RICH_EXTENSION_CASES.length
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
