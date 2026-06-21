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
