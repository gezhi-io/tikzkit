const COMPLEX_ROOTS_PREAMBLE = String.raw`\usepackage{amsmath}
\usepackage[outline]{contour}
\contourlength{1.0pt}
\usetikzlibrary{3d}

\tikzset{>=latex}
\definecolor{myblue}{RGB}{0,0,191}
\definecolor{mydarkblue}{RGB}{0,0,128}
\definecolor{myred}{RGB}{166,0,0}
\definecolor{mydarkred}{RGB}{102,0,0}
\tikzstyle{xline}=[myblue,very thick]
\tikzstyle{round xline}=[xline,line cap=round]
\tikzstyle{area}=[xline,fill=myblue!20,fill opacity=0.5]
\tikzstyle{yzp}=[canvas is zy plane at x=0]
\tikzstyle{xzp}=[canvas is xz plane at y=0]
\tikzstyle{xyp}=[canvas is xy plane at z=0]
\def\tick#1#2{\draw[thick] (#1) ++ (#2:0.11) --++ (#2-180:0.22)}
\def\N{50}`;

function complexRootsDocument(body) {
  return String.raw`\documentclass[border=3pt,tikz]{standalone}
${COMPLEX_ROOTS_PREAMBLE}
\begin{document}
${body}
\end{document}`;
}

export const IZAAK_COMPLEX_ROOTS_CASES = [
  {
    title: "Complex roots - tangent real solution",
    origin: "Izaak Neutelings complex roots",
    sourceUrl: "https://tikz.net/complex_roots/",
    path: "pasted-text.txt#one-real-solution",
    source: complexRootsDocument(String.raw`\begin{tikzpicture}[scale=1]
  \def\xmin{-0.4}
  \def\xmax{3.8}
  \def\ymin{-0.4}
  \def\ymax{2.7}
  \def\tmax{1.85}
  \def\A{0.7}
  \def\a{1.75}
  \coordinate (M) at (\a,0);
  \coordinate (R) at (\a,0);
  \draw[area,fill opacity=0.2,samples=\N,smooth,variable=\t,domain=\a-\tmax:\a+\tmax]
    plot (\t,{\A*(\t-\a)^2});
  \draw[->,black,thick] (\xmin,0) -- (\xmax,0) node[below] {$x$};
  \draw[->,black,thick] (0,\ymin,0) -- (0,\ymax+0.01) node[anchor=-30,inner sep=1] {$y$};
  \draw[xline,samples=\N,smooth,variable=\t,domain=\a-\tmax:\a+\tmax]
    plot (\t,{\A*(\t-\a)^2});
  \node[mydarkblue,left=-5,scale=0.9] at (\xmax,\ymax) {$y=A(x-a)^2$};
  \tick{R}{90} node[below=-1,scale=0.9,mydarkred] {$a$};
  \fill[myred] (M) circle(0.05);
  \fill[myred] (R) circle(0.05);
\end{tikzpicture}`)
  },
  {
    title: "Complex roots - two real solutions",
    origin: "Izaak Neutelings complex roots",
    sourceUrl: "https://tikz.net/complex_roots/",
    path: "pasted-text.txt#real-solutions",
    source: complexRootsDocument(String.raw`\begin{tikzpicture}[scale=1]
  \def\xmin{-0.4}
  \def\xmax{3.8}
  \def\ymin{-0.8}
  \def\ymax{2.4}
  \def\tmax{1.85}
  \def\A{0.8}
  \def\a{1.75}
  \def\b{0.6}
  \pgfmathsetmacro{\r}{sqrt(\b/\A)}
  \coordinate (M) at (\a,-\b);
  \coordinate (R+) at (\a+\r,0);
  \coordinate (R-) at (\a-\r,0);
  \draw[area,fill opacity=0.2,samples=\N,smooth,variable=\t,domain=\a-\tmax:\a+\tmax]
    plot (\t,{\A*(\t-\a)^2-\b});
  \draw[->,black,thick] (\xmin,0) -- (\xmax,0) node[below] {$x$};
  \draw[->,black,thick] (0,\ymin,0) -- (0,\ymax+0.01) node[anchor=-30,inner sep=1] {$y$};
  \draw[xline,samples=\N,smooth,variable=\t,domain=\a-\tmax:\a+\tmax]
    plot (\t,{\A*(\t-\a)^2-\b});
  \node[mydarkblue,left=-5,scale=0.9] at (\xmax,\ymax) {$y=A(x-a)^2+b$};
  \draw[mydarkred,densely dashed] (0,-\b) -- (M) -- (\a,0);
  \tick{0,-\b}{0} node[left=0,scale=0.9] {$b$};
  \tick{\a,0}{-90} node[above=0,scale=0.85] {$a$};
  \tick{R-}{-90} node[left=5,above=-1,scale=0.8,mydarkred] {\contour{white}{$a-\sqrt{b/A}$}};
  \tick{R+}{-90} node[right=7,above=-1,scale=0.8,mydarkred] {\contour{white}{$a+\sqrt{b/A}$}};
  \fill[myred] (M) circle(0.05);
  \fill[myred] (R+) circle(0.05) (R-) circle(0.05);
\end{tikzpicture}`)
  },
  {
    title: "Complex roots - imaginary solutions",
    origin: "Izaak Neutelings complex roots",
    sourceUrl: "https://tikz.net/complex_roots/",
    path: "pasted-text.txt#imaginary-solutions",
    source: complexRootsDocument(String.raw`\def\ymax{2.7}
\def\tmax{1.78}
\def\tlow{1.42}
\begin{tikzpicture}[scale=1]
  \def\xmin{-2.0}
  \def\xmax{2.2}
  \def\ymin{-0.8}
  \def\A{0.6}
  \def\b{0.5}
  \pgfmathsetmacro{\r}{sqrt(\b/\A)}
  \coordinate (M) at (0,\b);
  \coordinate (R+) at ( \r,0);
  \coordinate (R-) at (-\r,0);
  \coordinate (P+) at ( \r,2*\b);
  \coordinate (P-) at (-\r,2*\b);
  \draw[area,fill opacity=0.2,samples=\N,smooth,variable=\t,domain=-\tmax:\tmax]
    plot (\t,{\b+\A*\t*\t});
  \draw[->,black,thick] (\xmin,0) -- (\xmax,0) node[below] {$x$};
  \draw[->,black,thick] (0,\ymin,0) -- (0,\ymax+0.01) node[anchor=-30,inner sep=1] {$y$};
  \draw[xline,samples=\N,smooth,variable=\t,domain=-\tmax:\tmax]
    plot (\t,{\b+\A*\t*\t});
  \draw[area,thin,fill opacity=0.1,samples=\N,smooth,variable=\t,domain=-\tlow:\tlow]
    plot (\t,{\b-\A*\t*\t});
  \node[mydarkblue,right=4,scale=0.9] at (0,\ymax) {$y=Ax^2+b$};
  \draw[mydarkred,densely dashed] (R+) |- (0,2*\b) -| (R-);
  \tick{0,\b}{0} node[above=1,left=-1,scale=0.9] {\contour{white}{$b$}};
  \tick{0,2*\b}{0} node[above=1,left=-1,scale=0.9] {\contour{myblue!4}{$2b$}};
  \tick{-\r,0}{90} node[left=2,below=-2,scale=0.9,mydarkred] {\contour{white}{$-\sqrt{b/A}$}};
  \tick{\r,0}{90} node[right=2,below=-2,scale=0.9,mydarkred] {\contour{white}{$+\sqrt{b/A}$}};
  \fill[myred] (M) circle(0.05);
  \fill[myred] (R+) circle(0.05) (R-) circle(0.05);
  \fill[myred] (P+) circle(0.05) (P-) circle(0.05);
\end{tikzpicture}`)
  },
  {
    title: "Complex roots - shifted complex solutions",
    origin: "Izaak Neutelings complex roots",
    sourceUrl: "https://tikz.net/complex_roots/",
    path: "pasted-text.txt#complex-solutions",
    source: complexRootsDocument(String.raw`\def\ymax{2.7}
\def\tmax{1.78}
\def\tlow{1.42}
\begin{tikzpicture}[scale=1]
  \def\xmin{-0.6}
  \def\xmax{3.5}
  \def\ymin{-0.3}
  \def\A{0.6}
  \def\a{1.4}
  \def\b{0.5}
  \pgfmathsetmacro{\r}{sqrt(\b/\A)}
  \coordinate (M) at (\a,\b);
  \coordinate (R+) at (\a+\r,0);
  \coordinate (R-) at (\a-\r,0);
  \coordinate (P+) at (\a+\r,2*\b);
  \coordinate (P-) at (\a-\r,2*\b);
  \draw[area,fill opacity=0.25,samples=\N,smooth,variable=\t,domain=\a-\tmax:\a+\tmax]
    plot (\t,{\b+\A*(\t-\a)^2});
  \draw[->,black,thick] (\xmin,0) -- (\xmax,0) node[below] {$x$};
  \draw[->,black,thick] (0,\ymin,0) -- (0,\ymax+0.01) node[anchor=-30,inner sep=1] {$y$};
  \draw[xline,samples=\N,smooth,variable=\t,domain=\a-\tmax:\a+\tmax]
    plot (\t,{\b+\A*(\t-\a)^2});
  \draw[area,thin,fill opacity=0.1,samples=\N,smooth,variable=\t,domain=\a-\tlow:\a+\tlow]
    plot (\t,{\b-\A*(\t-\a)^2});
  \node[mydarkblue,right=5,scale=0.9] at (0,\ymax) {$y=A(x-a)^2+b$};
  \draw[mydarkred,densely dashed] (R+) |- (0,2*\b) -| (R-);
  \draw[mydarkred,densely dashed] (0,\b) -- (M) -- (\a,0);
  \tick{0,\b}{0} node[scale=0.9,left=-1] {$b$};
  \tick{0,2*\b}{0} node[scale=0.9,left=-1] {$2b$};
  \tick{\a,0}{90} node[below=1,scale=0.8] {\contour{white}{$a$}};
  \tick{R-}{90} node[left=5,below=-1,scale=0.8,mydarkred] {\contour{white}{$a-\sqrt{b/A}$}};
  \tick{R+}{90} node[right=2,below=-1,scale=0.8,mydarkred] {\contour{white}{$a+\sqrt{b/A}$}};
  \fill[myred] (M) circle(0.05);
  \fill[myred] (R+) circle(0.05) (R-) circle(0.05);
  \fill[myred] (P+) circle(0.05) (P-) circle(0.05);
\end{tikzpicture}`)
  },
  {
    title: "Complex roots - imaginary roots extended graph",
    origin: "Izaak Neutelings complex roots",
    sourceUrl: "https://tikz.net/complex_roots/",
    path: "pasted-text.txt#imaginary-roots-extended-graph",
    source: complexRootsDocument(String.raw`\begin{tikzpicture}[y=(90:1),z=(25:1),x=(-10:1),scale=1.1]
  \def\xmax{1.8}
  \def\ymin{-1.3}
  \def\ymax{2.7}
  \def\zmax{1.8}
  \def\tmax{1.0}
  \def\tlow{1.1}
  \def\A{1.5}
  \def\b{0.95}
  \pgfmathsetmacro{\r}{sqrt(\b/\A)}
  \coordinate (M) at (0,\b,0);
  \coordinate (R+) at (0,0, \r);
  \coordinate (R-) at (0,0,-\r);
  \draw[black,thick] (-\xmax,0,0) -- (0,0,0);
  \draw[area,samples=\N,smooth,variable=\t,domain=-\tlow:\tlow]
    plot (0,{\b-\A*\t*\t},\t);
  \draw[area,samples=\N,smooth,variable=\t,domain=-\tmax:\tmax]
    plot (\t,{\A*\t*\t+\b},0);
  \node[mydarkblue,right=7,scale=0.9] at (0,0.96*\ymax,0) {$y=Ax^2+b$};
  \node[mydarkblue,below=5,left=4,scale=0.9] at (0,\ymin,0) {$y=b-At^2$};
  \draw[->,black,thick] (0,\ymin,0,0) -- (0,\ymax+0.06,0) node[above left=-3] {$y$};
  \draw[->,black,thick] (0,0,-\zmax) -- (0,0,\zmax) node[right=8,above=-2] {$t=\Im[z]$};
  \tick{0,\b,0}{0} node[left=1] {$b$};
  \fill[myred] (M) circle(0.05);
  \fill[myred,xzp] (R+) circle(0.05) (R-) circle(0.05);
  \draw[round xline,samples=\N,smooth,variable=\t]
    plot[domain=0.006-\r:-0.01] (0,{\b-\A*\t*\t},\t)
    plot[domain=\r/2:\r-0.008] (0,{\b-\A*\t*\t},\t);
  \draw[->,black,thick,line cap=round] (0.01,0,0) -- (\xmax,0,0) node[right=5,below=0] {$x=\Re[z]$};
  \tick{R-}{-90} node[mydarkred,scale=0.9,anchor=-5,inner sep=2] {$-\sqrt{b/A}$};
  \tick{R+}{90} node[mydarkred,scale=0.9,anchor=186,inner sep=2] {$+\sqrt{b/A}$};
\end{tikzpicture}`)
  },
  {
    title: "Complex roots - shifted extended graph",
    origin: "Izaak Neutelings complex roots",
    sourceUrl: "https://tikz.net/complex_roots/",
    path: "pasted-text.txt#complex-roots-extended-graph",
    source: complexRootsDocument(String.raw`\begin{tikzpicture}[y=(90:1),z=(25:1),x=(-7:1),scale=1.2]
  \def\xmax{3.2}
  \def\ymin{-1.3}
  \def\ymax{2.8}
  \def\zmin{-1.6}
  \def\zmax{2.4}
  \def\tmax{1.00}
  \def\tlow{1.10}
  \def\A{1.5}
  \def\a{1.5}
  \def\b{1.1}
  \pgfmathsetmacro{\r}{sqrt(\b/\A)}
  \coordinate (M) at (\a,\b,0);
  \coordinate (R+) at (\a,0, \r);
  \coordinate (R-) at (\a,0,-\r);
  \draw[black,thick] (-0.1*\ymax,0,0) -- (\a,0,0);
  \draw[->,black,thick] (0,\ymin,0,0) -- (0,\ymax,0) node[above left=-3] {$y$};
  \draw[->,black,thick] (0,0,\zmin) -- (0,0,\zmax) node[above=1,right=1] {$t=\Im[z]$};
  \draw[mydarkred,densely dashed] (R+) -- (0,0,\r);
  \draw[area,samples=\N,smooth,variable=\t,domain=-\tlow:\tlow]
    plot (\a,{\b-\A*\t*\t},\t);
  \draw[area,samples=\N,smooth,variable=\t,domain=\a-\tmax:\a+\tmax]
    plot (\t,{\b+\A*(\t-\a)^2},0);
  \node[mydarkblue,right=2,scale=0.9] at (\a,\ymax,0) {$y=A(x-a)^2+b$};
  \node[mydarkblue,right=0,scale=0.9] at (0.6*\a,0.9*\ymin,0) {$y=b-At^2$ ($x=a$)};
  \fill[myred] (M) circle(0.05);
  \fill[myred,xzp] (R+) circle(0.05) (R-) circle(0.05);
  \draw[mydarkred,densely dashed] (M) -- (0,\b,0) (R-) -- (0,0,-\r) (R+) -- (R-);
  \draw[round xline,samples=\N,smooth,variable=\t]
    plot[domain=0.006-\r:-0.01] (\a,{\b-\A*\t*\t},\t)
    plot[domain=\r/2:\r-0.008] (\a,{\b-\A*\t*\t},\t);
  \draw[->,black,thick,line cap=round] (\a,0,0) -- (\xmax,0,0) node[right=5,below=0] {$x=\Re[z]$};
  \tick{\a,0,0}{90} node[below=-1] {$a$};
  \tick{0,0,-\r}{-90} node[mydarkred,scale=0.9,anchor=-40,inner sep=0] {$-\sqrt{b/A}$};
  \tick{0,0,\r}{-90} node[mydarkred,scale=0.9,anchor=-40,inner sep=0] {$+\sqrt{b/A}$};
  \tick{0,\b,0}{0} node[left=0] {$b$};
\end{tikzpicture}`)
  },
  {
    title: "Complex roots - equation text block",
    origin: "Izaak Neutelings complex roots",
    sourceUrl: "https://tikz.net/complex_roots/",
    path: "pasted-text.txt#quadratic-equation",
    source: complexRootsDocument(String.raw`\begin{tikzpicture}[scale=1]
  \node[align=left] at (0,0) {
    \begin{minipage}{9.2cm}
      Take an upward (convex) parabola with a quadratic equation
      \begin{equation}\label{real}
        y = A(x-a)^2 + b,
      \end{equation}
      with real $A,b>0$.
      If $a=0$, there two imaginary roots
      \begin{equation*}
        x = \pm i\sqrt{\frac{b}{A}}.
      \end{equation*}
      If $a\neq0$, there are two complex solutions
      \begin{equation*}
        x = a \pm i\sqrt{\frac{b}{A}}.
      \end{equation*}
      To extend the graph from the real $x$ axis to the complex plane,
      substitute a complex number \mbox{$z = x + it$} for real $x$, $t$:
      \begin{equation*}
        y = \Re\!\big[ A(x+it-a)^2 + b \big].
      \end{equation*}
      Rewriting,
      \begin{equation*}
        y = \Re\!\big[ A(x-a)^2 -At^2 + b \big].
      \end{equation*}
      If $t=0$, we retrieve the real parabola.
      The complex parabola that has the same solution for $x=a$ is
      \begin{equation*}
        y = b -At^2.
      \end{equation*}
    \end{minipage}
  };
\end{tikzpicture}`)
  }
];

export const CALIBRATION_CASES = [
  {
    title: "Calibration - shapes and anchors",
    origin: "TikZKit calibration",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "calibration/shapes-and-anchors",
    source: String.raw`\documentclass[tikz,border=8pt]{standalone}
\usetikzlibrary{shapes,positioning,calc}
\begin{document}
\begin{tikzpicture}[font=\small]
  \node[draw,rectangle,minimum width=1.4cm,minimum height=.8cm,fill=blue!10] (r) at (0,0) {$R$};
  \node[draw,circle,minimum size=1.1cm,fill=red!10,right=1.4cm of r] (c) {$C$};
  \node[draw,ellipse,minimum width=1.6cm,minimum height=.8cm,fill=green!10,right=1.4cm of c] (e) {$E$};
  \node[draw,diamond,minimum width=1.3cm,minimum height=1.0cm,fill=yellow!20,right=1.5cm of e] (d) {$D$};
  \foreach \n in {r,c,e,d} {
    \fill[black] (\n.center) circle (0.025);
    \draw[red] (\n.north) -- ++(0,.18);
    \draw[blue] (\n.east) -- ++(.18,0);
  }
  \draw[->,thick] (r.east) -- (c.west);
  \draw[->,thick] (c.east) -- (e.west);
  \draw[->,thick] (e.east) -- (d.west);
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Calibration - arrow tips and line styles",
    origin: "TikZKit calibration",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "calibration/arrows-and-lines",
    source: String.raw`\documentclass[tikz,border=8pt]{standalone}
\begin{document}
\begin{tikzpicture}[font=\scriptsize]
  \draw[->,line width=.7pt] (0,0) -- (3,0) node[right] {to};
  \draw[<-,line width=.7pt] (0,-.45) -- (3,-.45) node[right] {from};
  \draw[<->,line width=.7pt] (0,-.9) -- (3,-.9) node[right] {both};
  \draw[-stealth,line width=.7pt] (0,-1.35) -- (3,-1.35) node[right] {stealth};
  \draw[stealth-stealth,line width=.7pt] (0,-1.8) -- (3,-1.8) node[right] {stealth both};
  \draw[-latex,line width=.7pt] (0,-2.25) -- (3,-2.25) node[right] {latex};
  \draw[latex-latex,line width=.7pt] (0,-2.7) -- (3,-2.7) node[right] {latex both};
  \draw[dashed,->,line width=.7pt] (0,-3.15) -- (3,-3.15) node[right] {dashed};
  \draw[dotted,very thick,->] (0,-3.6) -- (3,-3.6) node[right] {dotted thick};
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Calibration - formula node boxes",
    origin: "TikZKit calibration",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "calibration/formula-node-boxes",
    source: String.raw`\documentclass[tikz,border=8pt]{standalone}
\usetikzlibrary{positioning}
\begin{document}
\begin{tikzpicture}
  \node[draw,circle,minimum size=1.45cm,inner sep=2pt,fill=blue!8] (a) at (0,0) {$\alpha_{t-1}(s_1)$};
  \node[draw,rectangle,rounded corners=2pt,minimum width=2.1cm,minimum height=.9cm,inner sep=3pt,fill=green!8,right=1.9cm of a] (b) {$\displaystyle \frac{x^2+y^2}{\sqrt{z}}$};
  \node[draw,circle,minimum size=1.2cm,inner sep=2pt,fill=red!8,right=2.2cm of b] (c) {$\vec{h}^{\ell+1}_i$};
  \draw[-stealth,thick] (a) -- (b);
  \draw[-stealth,thick] (b) -- (c);
  \draw[blue,dashed] (a.north) -- (a.south);
  \draw[red,dashed] (b.west) -- (b.east);
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Calibration - relative positioning",
    origin: "TikZKit calibration",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "calibration/relative-positioning",
    source: String.raw`\documentclass[tikz,border=8pt]{standalone}
\usetikzlibrary{positioning}
\begin{document}
\begin{tikzpicture}[node distance=1.1cm and 1.6cm,box/.style={draw,rounded corners=2pt,minimum width=1.4cm,minimum height=.65cm,align=center,fill=blue!8}]
  \node[box] (input) {Input\\$x$};
  \node[box,right=of input] (encode) {Encode\\$f(x)$};
  \node[box,right=of encode] (latent) {Latent\\$z$};
  \node[box,below=of encode] (loss) {Loss\\$\mathcal L$};
  \draw[-latex,thick] (input) -- node[above] {$w_1$} (encode);
  \draw[-latex,thick] (encode) -- node[above] {$w_2$} (latent);
  \draw[-latex,dashed] (latent.south) |- (loss.east);
  \draw[-latex,dashed] (loss.west) -| (input.south);
\end{tikzpicture}
\end{document}`
  },
  {
    title: "Calibration - plot sampling and oblique basis",
    origin: "TikZKit calibration",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "calibration/plot-and-basis",
    source: String.raw`\documentclass[tikz,border=8pt]{standalone}
\begin{document}
\begin{tikzpicture}[x=(25:1),y=(90:1)]
  \draw[->,thick] (0,0) -- (3.4,0) node[right] {$x$};
  \draw[->,thick] (0,0) -- (0,2.2) node[above] {$y$};
  \draw[blue,very thick,samples=41,variable=\t] plot[domain=0:3] (\t,{0.5+0.35*\t*\t});
  \draw[red,dashed,samples=31,variable=\t] plot[domain=0:3] (\t,{1.8-0.35*\t});
  \fill[black] (1,1) circle (0.04) node[above left] {$(1,1)$};
\end{tikzpicture}
\end{document}`
  }
];

const MATH_CONCEPT_PREAMBLE = String.raw`\usetikzlibrary{calc,positioning,matrix}
\tikzset{
  concept axis/.style={->,thick},
  concept guide/.style={densely dashed,black!45},
  concept main/.style={very thick,blue!70!black},
  concept accent/.style={very thick,red!70!black},
  concept region/.style={fill=blue!12,draw=blue!60!black,thick}
}`;

function mathConceptDocument(body) {
  return String.raw`\documentclass[tikz,border=8pt]{standalone}
${MATH_CONCEPT_PREAMBLE}
\begin{document}
${body}
\end{document}`;
}

export const MATH_CONCEPT_COVERAGE_CASES = [
  {
    title: "Math concept - triangle medians altitudes and angle marks",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/geometry/triangle-median-altitude-angle",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \coordinate (A) at (0,0);
  \coordinate (B) at (4.2,0);
  \coordinate (C) at (1.15,2.9);
  \coordinate (M) at ($(B)!0.5!(C)$);
  \coordinate (D) at (1.15,0);
  \draw[concept main] (A) -- (B) -- (C) -- cycle;
  \draw[concept accent] (A) -- (M) node[midway,above] {median};
  \draw[concept guide] (C) -- (D) node[midway,right] {altitude};
  \draw (D) rectangle ++(.18,.18);
  \draw[red] (0.55,0) arc[start angle=0,end angle=68,radius=.55];
  \node[red] at (.72,.28) {$\alpha$};
  \node[below left] at (A) {$A$};
  \node[below right] at (B) {$B$};
  \node[above] at (C) {$C$};
  \node[right] at (M) {$M$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - circle tangent chord and central angle",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/geometry/circle-tangent-chord",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \coordinate (O) at (0,0);
  \coordinate (A) at (1.8,0);
  \coordinate (B) at (.55,1.71);
  \draw[concept main] (O) circle (1.8);
  \draw[concept accent] (A) -- (B) node[midway,above right] {chord};
  \draw[thick] (O) -- (A) node[midway,below] {$r$};
  \draw[thick] (O) -- (B);
  \draw[red] (.55,0) arc[start angle=0,end angle=72,radius=.55];
  \draw[concept guide] (A) -- ++(0,1.7) node[above] {tangent};
  \draw (A) rectangle ++(.18,.18);
  \fill (O) circle(.035) node[below left] {$O$};
  \fill (A) circle(.035) node[below right] {$A$};
  \fill (B) circle(.035) node[above] {$B$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - similar triangles and parallel lines",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/geometry/similar-triangles-parallel",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \coordinate (A) at (0,0);
  \coordinate (B) at (5,0);
  \coordinate (C) at (1.3,3);
  \coordinate (D) at ($(A)!0.45!(B)$);
  \coordinate (E) at ($(A)!0.45!(C)$);
  \draw[concept main] (A) -- (B) -- (C) -- cycle;
  \draw[concept accent] (D) -- (E) node[midway,above] {$DE\parallel BC$};
  \node[below left] at (A) {$A$};
  \node[below] at (D) {$D$};
  \node[below right] at (B) {$B$};
  \node[left] at (E) {$E$};
  \node[above] at (C) {$C$};
  \node at (3.35,1.45) {$\triangle ADE\sim\triangle ABC$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - coordinate distance and midpoint",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/analytic-geometry/distance-midpoint",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-.4,0) -- (5,0) node[right] {$x$};
  \draw[concept axis] (0,-.4) -- (0,3.4) node[above] {$y$};
  \coordinate (A) at (.8,.7);
  \coordinate (B) at (4.2,2.7);
  \coordinate (M) at ($(A)!0.5!(B)$);
  \draw[concept main] (A) -- (B) node[midway,above] {$d$};
  \draw[concept guide] (A) -- (.8,0) node[below] {$x_1$};
  \draw[concept guide] (B) -- (4.2,0) node[below] {$x_2$};
  \draw[concept guide] (A) -- (0,.7) node[left] {$y_1$};
  \draw[concept guide] (B) -- (0,2.7) node[left] {$y_2$};
  \fill (A) circle(.04) node[above left] {$A$};
  \fill (B) circle(.04) node[above] {$B$};
  \fill[red] (M) circle(.04) node[below right] {$M$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - parabola focus and directrix",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/conics/parabola-focus-directrix",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-2.4,0) -- (2.4,0) node[right] {$x$};
  \draw[concept axis] (0,-.9) -- (0,3.2) node[above] {$y$};
  \draw[concept main,samples=61,variable=\t] plot[domain=-1.9:1.9] (\t,{0.45*\t*\t});
  \coordinate (F) at (0,.56);
  \draw[concept accent] (-2.2,-.56) -- (2.2,-.56) node[right] {directrix};
  \fill[red] (F) circle(.045) node[right] {$F$};
  \coordinate (P) at (1.35,.82);
  \draw[concept guide] (P) -- (F);
  \draw[concept guide] (P) -- (1.35,-.56);
  \fill (P) circle(.04) node[above right] {$P$};
  \node at (1.35,.25) {$PF=d$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - ellipse and hyperbola comparison",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/conics/ellipse-hyperbola",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-3.2,0) -- (3.2,0) node[right] {$x$};
  \draw[concept axis] (0,-1.8) -- (0,1.8) node[above] {$y$};
  \draw[concept main] (0,0) ellipse (2.3 and 1.15);
  \draw[concept accent,samples=41,variable=\t] plot[domain=-1.4:1.4] ({sqrt(1+\t*\t)},\t);
  \draw[concept accent,samples=41,variable=\t] plot[domain=-1.4:1.4] ({-sqrt(1+\t*\t)},\t);
  \foreach \x in {-1.6,1.6} \fill[red] (\x,0) circle(.04);
  \foreach \x in {-1,1} \fill[blue] (\x,0) circle(.04);
  \node[blue] at (0,1.45) {ellipse};
  \node[red] at (0,-1.45) {hyperbola};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - quadratic roots tangent and vertex",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/functions/quadratic-roots-tangent",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-.5,0) -- (4.6,0) node[right] {$x$};
  \draw[concept axis] (0,-1.3) -- (0,3.1) node[above] {$y$};
  \draw[concept main,samples=61,variable=\t] plot[domain=.2:4.2] (\t,{0.55*(\t-2.2)*(\t-2.2)-.8});
  \coordinate (V) at (2.2,-.8);
  \draw[concept guide] (2.2,-1.1) -- (2.2,2.6);
  \draw[concept accent] (.7,-.8) -- (3.7,-.8) node[right] {tangent};
  \fill[red] (V) circle(.04) node[below] {$V$};
  \foreach \x/\lab in {1.0/$x_1$,3.4/$x_2$} \fill (\x,0) circle(.035) node[above] {\lab};
  \node[blue] at (3.15,2.1) {$y=a(x-h)^2+k$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - absolute value piecewise function",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/functions/absolute-value-piecewise",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-2.4,0) -- (3.2,0) node[right] {$x$};
  \draw[concept axis] (0,-.4) -- (0,2.8) node[above] {$y$};
  \draw[concept main] (-2,2.4) -- (.6,.2) -- (2.8,2);
  \fill[red] (.6,.2) circle(.04) node[below] {vertex};
  \draw[concept guide] (.6,.2) -- (.6,0) node[below] {$h$};
  \node[blue] at (1.85,2.35) {$y=|x-h|+k$};
  \node at (-1.2,1.6) {$-x+h+k$};
  \node at (2.1,1.25) {$x-h+k$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - unit circle sine cosine tangent",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/trigonometry/unit-circle-sin-cos",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-1.4,0) -- (1.8,0) node[right] {$x$};
  \draw[concept axis] (0,-1.3) -- (0,1.5) node[above] {$y$};
  \draw[concept main] (0,0) circle (1);
  \coordinate (P) at (.64,.77);
  \draw[concept accent] (0,0) -- (P) node[midway,above left] {$1$};
  \draw[concept guide] (P) -- (.64,0) node[below] {$\cos\theta$};
  \draw[concept guide] (P) -- (0,.77) node[left] {$\sin\theta$};
  \draw[red] (.35,0) arc[start angle=0,end angle=50,radius=.35];
  \node[red] at (.45,.2) {$\theta$};
  \draw[thick] (1,-.8) -- (1,1.25) node[above] {tan line};
  \fill (P) circle(.04) node[above right] {$P$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - vector addition and projection",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/vectors/vector-addition-projection",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \coordinate (O) at (0,0);
  \coordinate (A) at (2.4,.8);
  \coordinate (B) at (.9,2.1);
  \coordinate (S) at ($(A)+(B)$);
  \draw[->,concept main] (O) -- (A) node[midway,below] {$\vec a$};
  \draw[->,concept accent] (O) -- (B) node[midway,left] {$\vec b$};
  \draw[concept guide] (A) -- (S) -- (B);
  \draw[->,very thick,green!50!black] (O) -- (S) node[midway,above] {$\vec a+\vec b$};
  \draw[dashed,red] (B) -- ($(O)!(B)!(A)$) node[midway,right] {projection};
  \fill (O) circle(.035) node[below left] {$O$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - cube projection and plane section",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/solid-geometry/cube-plane-section",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[x={(1cm,0cm)},y={(0.45cm,0.32cm)},z={(0cm,1cm)},font=\scriptsize]
  \coordinate (O) at (0,0,0);
  \coordinate (A) at (2,0,0);
  \coordinate (B) at (2,2,0);
  \coordinate (C) at (0,2,0);
  \coordinate (D) at (0,0,2);
  \coordinate (E) at (2,0,2);
  \coordinate (F) at (2,2,2);
  \coordinate (G) at (0,2,2);
  \draw[concept main] (O)--(A)--(B)--(C)--cycle (D)--(E)--(F)--(G)--cycle (O)--(D) (A)--(E) (B)--(F) (C)--(G);
  \draw[fill=red!18,draw=red!70!black,thick] (0,0,1.25) -- (2,0,.55) -- (2,2,1.35) -- (0,2,1.85) -- cycle;
  \node at (1,1,2.25) {plane section};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - Venn diagram for set operations",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/sets/venn-union-intersection",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[rounded corners=4pt,thick] (-2,-1.35) rectangle (2.6,1.55);
  \fill[blue!25,opacity=.75] (-.55,0) circle (1);
  \fill[red!25,opacity=.75] (.55,0) circle (1);
  \draw[concept main] (-.55,0) circle (1);
  \draw[concept accent] (.55,0) circle (1);
  \node at (-1.05,.78) {$A$};
  \node at (1.05,.78) {$B$};
  \node at (0,0) {$A\cap B$};
  \node at (0,-1.05) {$A\cup B$};
  \node[above left] at (-2,1.55) {$U$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - number line interval operations",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/sets/number-line-intervals",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-.5,0) -- (6.3,0) node[right] {$x$};
  \foreach \x/\lab in {0/$-2$,2/$0$,4/$2$,6/$4$} {
    \draw (\x,.08) -- (\x,-.08) node[below] {\lab};
  }
  \draw[blue,very thick] (1,.35) -- (4,.35);
  \draw[blue,fill=white,thick] (1,.35) circle(.07);
  \fill[blue] (4,.35) circle(.07);
  \node[blue] at (2.5,.68) {$(-1,2]$};
  \draw[red,very thick] (2,-.35) -- (5,-.35);
  \fill[red] (2,-.35) circle(.07);
  \draw[red,fill=white,thick] (5,-.35) circle(.07);
  \node[red] at (3.5,-.68) {$[0,3)$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - matrix multiplication grid",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/matrices/matrix-multiplication-grid",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \matrix (A) [matrix of nodes,nodes={draw,minimum width=.55cm,minimum height=.45cm},row sep=-\pgflinewidth,column sep=-\pgflinewidth]
  { a & b & c \\ d & e & f \\ };
  \matrix (B) [right=1.2cm of A,matrix of nodes,nodes={draw,minimum width=.55cm,minimum height=.45cm},row sep=-\pgflinewidth,column sep=-\pgflinewidth]
  { p & q \\ r & s \\ t & u \\ };
  \matrix (C) [right=1.2cm of B,matrix of nodes,nodes={draw,minimum width=.65cm,minimum height=.45cm},row sep=-\pgflinewidth,column sep=-\pgflinewidth]
  { ap+br+ct & aq+bs+cu \\ dp+er+ft & dq+es+fu \\ };
  \draw[blue,very thick] (A-1-1.north west) rectangle (A-1-3.south east);
  \draw[red,very thick] (B-1-1.north west) rectangle (B-3-1.south east);
  \draw[green!50!black,very thick] (C-1-1.north west) rectangle (C-1-1.south east);
\end{tikzpicture}`)
  },
  {
    title: "Math concept - linear transform determinant area",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/matrices/linear-transform-determinant-area",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-.3,0) -- (4.2,0) node[right] {$x$};
  \draw[concept axis] (0,-.3) -- (0,3) node[above] {$y$};
  \draw[fill=blue!12,draw=blue,thick] (0,0) -- (1,0) -- (1,1) -- (0,1) -- cycle;
  \draw[fill=red!14,draw=red,thick] (2,0) -- (3.8,.55) -- (3.15,2.55) -- (1.35,2) -- cycle;
  \draw[->,thick] (1.25,.5) -- (1.85,.5) node[midway,above] {$T$};
  \node at (.5,.5) {$1$};
  \node at (2.65,1.25) {$|\det A|$};
  \draw[->,blue] (2,0) -- (3.8,.55) node[midway,below] {$A\vec e_1$};
  \draw[->,red] (2,0) -- (1.35,2) node[midway,left] {$A\vec e_2$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - probability tree diagram",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/probability/probability-tree",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize,node distance=1.2cm and 1.5cm]
  \node[draw,circle,inner sep=2pt] (S) {$S$};
  \node[draw,circle,above right=of S] (A) {$A$};
  \node[draw,circle,below right=of S] (B) {$B$};
  \node[draw,circle,above right=of A] (AC) {$C$};
  \node[draw,circle,below right=of A] (AD) {$D$};
  \node[draw,circle,above right=of B] (BC) {$C$};
  \node[draw,circle,below right=of B] (BD) {$D$};
  \draw[-latex,thick] (S) -- node[above] {$p$} (A);
  \draw[-latex,thick] (S) -- node[below] {$1-p$} (B);
  \draw[-latex] (A) -- node[above] {$q$} (AC);
  \draw[-latex] (A) -- node[below] {$1-q$} (AD);
  \draw[-latex] (B) -- node[above] {$r$} (BC);
  \draw[-latex] (B) -- node[below] {$1-r$} (BD);
\end{tikzpicture}`)
  },
  {
    title: "Math concept - statistics histogram and boxplot",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/statistics/histogram-boxplot",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-.2,0) -- (5.6,0) node[right] {score};
  \draw[concept axis] (0,-.2) -- (0,3.1) node[above] {freq};
  \foreach \x/\h/\c in {0.3/1.1/blue!20,1.1/2.4/blue!30,1.9/2.8/blue!40,2.7/1.9/blue!30,3.5/.9/blue!20} {
    \draw[fill=\c,draw=blue!70!black] (\x,0) rectangle ++(.65,\h);
  }
  \draw[red,thick] (1,-.8) -- (4.4,-.8);
  \draw[red,thick,fill=red!10] (1.7,-1.05) rectangle (3.6,-.55);
  \draw[red,thick] (2.55,-1.05) -- (2.55,-.55);
  \foreach \x in {1,4.4} \draw[red,thick] (\x,-.95) -- (\x,-.65);
  \node[red] at (2.55,-1.35) {boxplot};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - arithmetic and geometric sequences",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/sequences/arithmetic-geometric-sequences",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-.3,0) -- (5.8,0) node[right] {$n$};
  \draw[concept axis] (0,-.3) -- (0,3.5) node[above] {$a_n$};
  \draw[concept main] (.6,.8) -- (1.4,1.15) -- (2.2,1.5) -- (3,1.85) -- (3.8,2.2) -- (4.6,2.55);
  \draw[concept accent] (.6,.45) -- (1.4,.65) -- (2.2,.98) -- (3,1.55) -- (3.8,2.45) -- (4.6,3.25);
  \foreach \p in {(.6,.8),(1.4,1.15),(2.2,1.5),(3,1.85),(3.8,2.2),(4.6,2.55)} \fill[blue] \p circle(.035);
  \foreach \p in {(.6,.45),(1.4,.65),(2.2,.98),(3,1.55),(3.8,2.45),(4.6,3.25)} \fill[red] \p circle(.035);
  \node[blue] at (4.1,1.7) {arithmetic};
  \node[red] at (3.6,3.15) {geometric};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - linear inequalities feasible region",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/inequalities/linear-programming-region",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-.3,0) -- (4.8,0) node[right] {$x$};
  \draw[concept axis] (0,-.3) -- (0,4) node[above] {$y$};
  \fill[green!18] (.6,.6) -- (3.1,.6) -- (2.35,2.25) -- (1,2.7) -- cycle;
  \draw[concept main] (.6,.6) -- (3.8,.6) node[right] {$y\ge1$};
  \draw[concept accent] (.6,3) -- (3.8,.95) node[right] {$2x+3y\le10$};
  \draw[very thick,green!45!black] (.5,2.9) -- (3.3,.25) node[right] {$x+y\ge3$};
  \foreach \p in {(.6,.6),(3.1,.6),(2.35,2.25),(1,2.7)} \fill[black] \p circle(.035);
  \node[green!45!black] at (1.85,1.35) {feasible};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - derivative tangent and integral area",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/calculus/derivative-integral-area",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-.3,0) -- (4.2,0) node[right] {$x$};
  \draw[concept axis] (0,-.3) -- (0,3.4) node[above] {$y$};
  \fill[blue!12] (.5,0) -- (.5,.66) -- (1,.95) -- (1.5,1.28) -- (2,1.65) -- (2.5,2.06) -- (2.5,0) -- cycle;
  \draw[concept main,samples=61,variable=\t] plot[domain=.2:3.6] (\t,{0.45+0.34*\t+0.08*\t*\t});
  \coordinate (P) at (1.8,1.32);
  \draw[concept accent] (.7,.86) -- (3.2,2.18) node[right] {tangent};
  \draw[red,densely dashed] (P) -- (1.8,0) node[below] {$a$};
  \fill[red] (P) circle(.04) node[above left] {$f'(a)$};
  \node[blue] at (1.55,.45) {$\int_a^b f(x)\,dx$};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - polar rose and parametric curve",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/parametric/polar-rose-parametric",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-2.2,0) -- (2.2,0) node[right] {$x$};
  \draw[concept axis] (0,-2.1) -- (0,2.1) node[above] {$y$};
  \draw[concept guide] (0,0) circle(1);
  \draw[concept main,samples=97,variable=\t] plot[domain=0:6.28] ({cos(3*\t r)*cos(\t r)},{cos(3*\t r)*sin(\t r)});
  \draw[concept accent,samples=61,variable=\t] plot[domain=0:6.28] ({1.35*cos(\t r)},{.6*sin(2*\t r)});
  \node[blue] at (-1.35,1.55) {$r=\cos 3\theta$};
  \node[red] at (1.35,-1.45) {parametric};
\end{tikzpicture}`)
  },
  {
    title: "Math concept - complex plane modulus argument",
    origin: "TikZKit math concept coverage",
    sourceUrl: "https://github.com/gezhi-io/tikzkit",
    path: "math-concepts/complex-plane/modulus-argument",
    source: mathConceptDocument(String.raw`\begin{tikzpicture}[font=\scriptsize]
  \draw[concept axis] (-1.1,0) -- (3.5,0) node[right] {$\Re$};
  \draw[concept axis] (0,-1) -- (0,2.8) node[above] {$\Im$};
  \coordinate (Z) at (2.4,1.7);
  \draw[concept main,->] (0,0) -- (Z) node[midway,above left] {$|z|$};
  \draw[concept guide] (Z) -- (2.4,0) node[below] {$a$};
  \draw[concept guide] (Z) -- (0,1.7) node[left] {$b$};
  \draw[red] (.65,0) arc[start angle=0,end angle=35,radius=.65];
  \node[red] at (.82,.27) {$\arg z$};
  \fill[red] (Z) circle(.045) node[above right] {$z=a+bi$};
\end{tikzpicture}`)
  }
];
