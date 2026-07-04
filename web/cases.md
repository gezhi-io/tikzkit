# TikZ Web Test Cases

## angles-001: Parallel lines angle relationships

```tikz
\usetikzlibrary {angles,calc,quotes}
\begin{tikzpicture}[angle radius=.75cm]

  \node (A) at (-2,0)     [red,left]   {$A$};
  \node (B) at ( 3,.5)    [red,right]  {$B$};
  \node (C) at (-2,2)     [blue,left]  {$C$};
  \node (D) at ( 3,2.5)   [blue,right] {$D$};
  \node (E) at (60:-5mm)  [below]      {$E$};
  \node (F) at (60:3.5cm) [above]      {$F$};

  \coordinate (X) at (intersection cs:first line={(A)--(B)}, second line={(E)--(F)});
  \coordinate (Y) at (intersection cs:first line={(C)--(D)}, second line={(E)--(F)});

  \path
    (A) edge [red, thick]  (B)
    (C) edge [blue, thick] (D)
    (E) edge [thick]       (F)
      pic ["$\alpha$", draw, fill=yellow]   {angle = F--X--A}
      pic ["$\beta$",  draw, fill=green!30] {angle = B--X--F}
      pic ["$\gamma$", draw, fill=yellow]   {angle = E--Y--D}
      pic ["$\delta$", draw, fill=green!30] {angle = C--Y--E};

  \node at ($ (D)!.5!(B) $) [right=1cm,text width=6cm,rounded corners,fill=red!20,inner sep=1ex]
    {
      When we assume that $\color{red}AB$ and $\color{blue}CD$ are
      parallel, i.\,e., ${\color{red}AB} \mathbin{\|} \color{blue}CD$,
      then $\alpha = \gamma$ and $\beta = \delta$.
    };
\end{tikzpicture}
```

## datavisualization-068: Explicit axis scaling from source years to target length

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes,
  x axis={attribute=people, length=2.5cm, ticks=few},
  y axis={attribute=year, scaling=1900 at 0cm and 2000 at 5cm},
  visualize as scatter]
data {
  year, people
  1900, 100
  1910, 200
  1950, 200
  1960, 250
  2000, 150
};
```

## datavisualization-069: Manual pi tick and grid label

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
  [scientific axes,
   visualize as smooth line,
   all axes={grid, unit length=1.25cm},
   y axis={ticks=few},
   x axis={ticks=many, ticks and grid={major also at={(pi/2) as $\frac{\pi}{2}$}}}]
  data [format=function] {
    var x : interval [-pi/2:3*pi] samples 50;
    func y = sin(\value x r);
  };
```

## datavisualization-070: No tick text at and pi tick label

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line,
  x axis={ticks={major={
    no tick text at = 3,
    also at = (pi) as [{tick text padding=1ex}] $\pi$}}},
  data/format=function]
data {
  var x : interval [0:2*pi] samples 50;
  func y = sin(\value x r);
};
```

## datavisualization-071: Legend at data values

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  x axis={min value=0,max value=2},
  y axis={min value=0,max value=2},
  visualize as smooth line/.list={a,b},
  legend={at values={x=1,y=1}},
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  style sheet=strong colors,
  data/format=function]
data [set=a] {
  var x : interval [0:2] samples 20;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:2] samples 20;
  func y = 2-\value x;
};
```

## datavisualization-072: Legend right of data values

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  x axis={min value=0,max value=2},
  y axis={min value=0,max value=2},
  visualize as smooth line/.list={a,b},
  legend={right of={x=1,y=1}},
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  style sheet=strong colors,
  data/format=function]
data [set=a] {
  var x : interval [0:2] samples 20;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:2] samples 20;
  func y = 2-\value x;
};
```

## datavisualization-073: Polar degree ticks clean quadrant

```tikz
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={clean, 0 to 90},
  angle axis={ticks={step=30}},
  radius axis={length=1cm, ticks={step=1}},
  visualize as scatter]
data point [angle=20, radius=0.5]
data point [angle=30, radius=1]
data point [angle=40, radius=1.5];
```

## datavisualization-074: Polar degree ticks outer half-plane

```tikz
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={outer ticks, 0 to 180},
  angle axis={ticks={step=30}},
  radius axis={length=1cm, ticks={step=1}},
  visualize as scatter]
data point [angle=20, radius=0.5]
data point [angle=30, radius=1]
data point [angle=40, radius=1.5];
```

## datavisualization-079: Logarithmic angle axis in scientific polar coordinates

```tikz
\usetikzlibrary {datavisualization.formats.functions,datavisualization.polar}
\tikz[baseline] \datavisualization [
  scientific polar axes={right half clockwise, clean},
  angle axis={logarithmic,
    ticks={
      minor steps between steps=8,
      major also at/.list={2,3,4,5,15,20}}},
  radius axis={ticks={some, style=red!80!black}},
  all axes=grid,
  visualize as smooth line=sin]
  data [format=function] {
    var t : interval [-3:3] samples 31;
    func angle = exp(\value t);
    func radius = \value{t}*\value{t};
  };
```

## datavisualization-080: Visualize grid clipped minor lines

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
    xy Cartesian,
    all axes={visualize axis={low=0, style=->},
              grid={some, minor steps between steps}},
    x axis={visualize grid={
                direction axis=y axis,
                minor={low=0.25, high=1.75, style=red!50}}},
    visualize as scatter]
  data {
    x, y
    0, 0
    3, 3
  };
```

## datavisualization-081: Manual new legend entry with custom glyph

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
  school book axes, visualize as line/.list={a,b},
  style sheet=vary dashing,
  a={label in legend={text=a}},
  new legend entry={
    text=spacer,
    visualizer in legend={\draw[solid] (0,0) circle[radius=2pt];}
  },
  b={label in legend={text=b}}]
data point [x=-1, y=-1, set=a]   data point [x=1, y=0, set=a]
data point [x=-1, y=1,  set=b]   data point [x=1, y=0.5, set=b];
```

## datavisualization-082: Low-level polar angle axis degrees

```tikz
\usetikzlibrary {datavisualization.polar}
\tikz \datavisualization
    [new polar axes={angle axis}{radius axis},
     radius axis={unit length=1cm},
     angle axis={degrees},
     visualize as scatter]
  data [format=named] {
    angle={10,90}, radius={0.25,0.5,...,2}
  };
```

## datavisualization-083: Low-level polar angle axis radians

```tikz
\usetikzlibrary {datavisualization.polar}
\tikz \datavisualization
    [new polar axes={angle axis}{radius axis},
     radius axis={unit length=1cm},
     angle axis={radians},
     visualize as scatter]
  data [format=named] {
    angle={0,1.5}, radius={0.25,0.5,...,2}
  };
```

## datavisualization-084: Cartesian visualize ticks low high

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
    xy Cartesian,
    all axes={visualize axis={low=0, style=->},
              ticks={some}},
    x axis={visualize ticks={
                direction axis=y axis,
                major={low=-4pt, high=4pt, style=red!50}}},
    visualize as scatter]
  data {
    x, y
    0, 0
    3, 3
  };
```

## datavisualization-085: Cartesian visualize ticks labels at high

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
    xy Cartesian,
    all axes={visualize axis={low=0, style=->},
              ticks={some}},
    x axis={visualize ticks={
                direction axis=y axis,
                major={low=0pt, high=4pt, tick text at high}}},
    visualize as scatter]
  data {
    x, y
    0, 0
    2, 2
  };
```

## datavisualization-086: Legend label node style

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={log, lin},
  legend={label style={node style=draw}},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$, node style={circle, draw=red}}},
  style sheet=strong colors,
  data/format=function]
data [set=log] {
  var x : interval [0.2:2.5] samples 30;
  func y = ln(\value x);
}
data [set=lin] {
  var x : interval [-2:2.5] samples 30;
  func y = 0.5*\value x;
};
```

## datavisualization-087: Legend explicit bbox anchor

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes, x axis={label=$x$},
  visualize as smooth line/.list={log, lin, squared, exp},
  legend={anchor=north west, at=(data visualization bounding box.north east)},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$}},
  squared={label in legend={text=$x^2$}},
  exp={label in legend={text=$e^x$}},
  style sheet=vary dashing,
  data/format=function]
data [set=log] {
  var x : interval [0.2:2.5] samples 30;
  func y = ln(\value x);
}
data [set=lin] {
  var x : interval [-2:2.5] samples 30;
  func y = 0.5*\value x;
}
data [set=squared] {
  var x : interval [-1.5:1.5] samples 30;
  func y = \value x*\value x;
}
data [set=exp] {
  var x : interval [-2.5:1] samples 30;
  func y = exp(\value x);
};
```

## datavisualization-088: Legend shifted projection coordinate

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={a,b,c},
  legend={anchor=north west, at={([xshift=.8em]data visualization bounding box.north east|- data bounding box.north)}},
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  data/format=function]
data [set=a] {
  var x : interval [0:1] samples 12;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:1] samples 12;
  func y = 0.5*\value x;
}
data [set=c] {
  var x : interval [0:1] samples 12;
  func y = 0.25*\value x;
};
```

## datavisualization-089: Ignore style sheets visualizer

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line/.list={a,b,c},
  style sheet=strong colors,
  style sheet=vary dashing,
  a={label in legend={text=a}},
  b={ignore style sheets, style={line width=1pt}, label in legend={text=b}},
  c={label in legend={text=c}},
  data/format=function]
data [set=a] {
  var x : interval [0:1] samples 12;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:1] samples 12;
  func y = \value x + 1;
}
data [set=c] {
  var x : interval [0:1] samples 12;
  func y = \value x + 2;
};
```

## library-packages-001: Arrows and trees TCS logo

```tikz
\usetikzlibrary {arrows,trees}
\tikzset{
  ld/.style={level distance=#1},lw/.style={line width=#1},
  level 1/.style={ld=4.5mm, trunk,          lw=1ex ,sibling angle=60},
  level 2/.style={ld=3.5mm, trunk!80!leaf a,lw=.8ex,sibling angle=56},
  level 3/.style={ld=2.75mm,trunk!60!leaf a,lw=.6ex,sibling angle=52},
  level 4/.style={ld=2mm,   trunk!40!leaf a,lw=.4ex,sibling angle=48},
  level 5/.style={ld=1mm,   trunk!20!leaf a,lw=.3ex,sibling angle=44},
  level 6/.style={ld=1.75mm,leaf a,         lw=.2ex,sibling angle=40},
}
\pgfarrowsdeclare{leaf}{leaf}
  {\pgfarrowsleftextend{-2pt} \pgfarrowsrightextend{1pt}}
{
  \pgfpathmoveto{\pgfpoint{-2pt}{0pt}}
  \pgfpatharc{150}{30}{1.8pt}
  \pgfpatharc{-30}{-150}{1.8pt}
  \pgfusepathqfill
}

\newcommand{\logo}[5]
{
  \colorlet{border}{#1}
  \colorlet{trunk}{#2}
  \colorlet{leaf a}{#3}
  \colorlet{leaf b}{#4}
  \begin{tikzpicture}
    \scriptsize\scshape
    \draw[border,line width=1ex,yshift=.3cm,
          yscale=1.45,xscale=1.05,looseness=1.42]
      (1,0) to [out=90, in=0]    (0,1)  to [out=180,in=90]  (-1,0)
            to [out=-90,in=-180] (0,-1) to [out=0,  in=-90] (1,0) -- cycle;

    \coordinate (root) [grow cyclic,rotate=90]
    child {
      child [line cap=round] foreach \a in {0,1} {
        child foreach \b in {0,1} {
          child foreach \c in {0,1} {
            child foreach \d in {0,1} {
              child foreach \leafcolor in {leaf a,leaf b}
                { edge from parent [color=\leafcolor,-#5] }
        } } }
      } edge from parent [shorten >=-1pt,serif cm-,line cap=butt]
    };

    \node [align=center,below] at (0pt,-.5ex)
    { \textcolor{border}{T}heoretical \\ \textcolor{border}{C}omputer \\
      \textcolor{border}{S}cience };
\end{tikzpicture}
}
\begin{minipage}{3cm}
  \logo{green!80!black}{green!25!black}{green}{green!80}{leaf}\\
  \logo{green!50!black}{black}{green!80!black}{red!80!green}{leaf}\\
  \logo{red!75!black}{red!25!black}{red!75!black}{orange}{leaf}\\
  \logo{black!50}{black}{black!50}{black!25}{}
\end{minipage}
```

## smoke-001: Smoke test

```tikz
\begin{tikzpicture}
  \draw[->, thick] (0,0) -- (2,0) node[right] {$x$};
  \draw[->, thick] (0,0) -- (0,1.5) node[above] {$y$};
  \draw[blue, thick] (0,0) -- (1.5,1);
\end{tikzpicture}
```

## datavisualization-001: Function format Gaussian and scatter

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [scientific axes=clean]
[
  visualize as smooth line=Gaussian,
  Gaussian={pin in data={text={$e^{-x^2}$},when=x is 1}}
]
data [format=function] {
  var x : interval [-7:7] samples 51;
  func y = exp(-\value x*\value x);
}
[
  visualize as scatter,
  legend={south east outside},
  scatter={
    style={mark=*,mark size=1.4pt},
    label in legend={text={
        $\sum_{i=1}^{10} x_i$, where $x_i \sim U(-1,1) $}}}
]
data [format=function] {
  var i : interval [0:1] samples 20;
  func y = 0;
  func x = (rand + rand + rand + rand + rand +
rand + rand + rand + rand + rand);
};
```

## datavisualization-002: Multiple function visualizers

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       y axis=grid,
                       visualize as smooth line/.list={sin,cos,tan},
                       style sheet=strong colors,
                       style sheet=vary dashing,
                       sin={label in legend={text=$\sin x$}},
                       cos={label in legend={text=$\cos x$}},
                       tan={label in legend={text=$\tan x$}},
                       data/format=function ]
  data [set=sin] {
    var x : interval [-0.5*pi:4];
    func y = sin(\value x r);
  }
  data [set=cos] {
    var x : interval [-0.5*pi:4];
    func y = cos(\value x r);
  }
  data [set=tan] {
    var x : interval [-0.3*pi:.3*pi];
    func y = tan(\value x r);
  };
\end{tikzpicture}
```

## datavisualization-003: Table data routed to line and scatter visualizers

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as line=sin,
  visualize as line=cos,
  visualize as scatter=tan,
  sin={style={red, densely dotted},label in legend={text=$s$}},
  cos={style={blue},label in legend={text=$c$}},
  tan={style={mark=x, mark size=2pt},label in legend={text=$t$}}]
data {
  x, y, set
  0, 0, sin
  1, 1, sin
  2, 0, sin
  3, -1, sin
  4, 0, sin
  0, 1, cos
  1, 0, cos
  2, -1, cos
  3, 0, cos
  4, 1, cos
  0, 0, tan
  1, 1, tan
  2, 2, tan
  3, 4, tan
};
```

## datavisualization-004: Mark-only line visualizer

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as smooth line=my data,
  my data={no lines, style={mark=x, mark size=2pt}}]
data [format=function] {
  var x : interval [0:pi] samples 10;
  func y = sin(\value x r);
};
```

## datavisualization-005: School book axes with explicit ticks

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [school book axes,
  x axis={min value=-2,max value=4,ticks={step=1},grid,length=6cm},
  y axis={include value={-1,1},ticks={step=.5},grid,length=3cm},
  visualize as smooth line=curve,
  curve={label in legend={text=$x^2/4$}},
  data/format=function]
data {
  var x : interval [-1:3] samples 41;
  func y = \value x*\value x/4;
};
```

## datavisualization-006: Table data routed through visualizers

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  all axes={grid,ticks={step=1}},
  visualize as line=baseline,
  visualize as scatter=samples,
  baseline={style={blue, thick},label in legend={text=trend}},
  samples={style={red, mark=x, mark size=2pt},label in legend={text=measurements}}]
data {
  x, y, set
  0, 0, baseline
  1, 1, baseline
  2, 1, baseline
  3, 2, baseline
  4, 3, baseline
  0, 0.2, samples
  1, 0.8, samples
  2, 1.3, samples
  3, 1.7, samples
  4, 3.1, samples
};
```

## datavisualization-007: Axis bounds include external reference values

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=6,ticks={some}},
  y axis={include value={-1,1},ticks={step=.5},grid},
  visualize as smooth line=damped,
  damped={style={orange, thick},pin in data={text={$e^{-x/2}\sin x$},when=x is 2}},
  data/format=function]
data {
  var x : interval [0:6] samples 61;
  func y = exp(-\value x/2)*sin(\value x r);
};
```

## datavisualization-008: Source ordered rand scatter

```tikz
\pgfmathsetseed{100}
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=-1,max value=1,ticks={step=.5},grid},
  y axis={min value=-1,max value=1,ticks={step=.5},grid},
  visualize as scatter,
  scatter={style={mark=*,mark size=1.5pt},label in legend={text={source ordered rand}}}]
data [format=function] {
  var i : interval [0:1] samples 2;
  func y = rand;
  func x = rand;
};
```

## datavisualization-009: Line visualizer list with table data

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  all axes={grid,ticks={step=1}},
  visualize as line=seriesA,
  visualize as line=seriesB,
  seriesA={style={blue, thick},label in legend={text=$L$}},
  seriesB={style={red, densely dashed},label in legend={text=$H$}}]
data {
  x, y, set
  0, 0, seriesA
  1, 0.5, seriesA
  2, 1, seriesA
  3, 1.4, seriesA
  0, 1, seriesB
  1, 1.4, seriesB
  2, 2.1, seriesB
  3, 2.6, seriesB
};
```

## datavisualization-010: Scatter visualizer list with table data

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=4,ticks={step=1},grid},
  y axis={min value=0,max value=4,ticks={step=1},grid},
  visualize as scatter/.list={train,test},
  train={style={mark=*,mark size=1.6pt},label in legend={text={train}}},
  test={style={mark=x,mark size=2pt},label in legend={text={test}}}]
data {
  x, y, set
  0.5, 1.0, train
  1.5, 1.7, train
  2.5, 2.1, train
  3.4, 3.2, train
  0.8, 0.4, test
  1.8, 1.2, test
  2.8, 2.6, test
  3.7, 3.5, test
};
```

## datavisualization-011: Function visualizer with explicit axis lengths

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=-2,max value=2,ticks={step=1},grid,length=6cm},
  y axis={min value=-1,max value=4,ticks={step=1},grid,length=3cm},
  visualize as smooth line=parabola,
  parabola={style={orange, thick},label in legend={text=$x^2$}},
  data/format=function]
data {
  var x : interval [-2:2] samples 41;
  func y = \value x*\value x;
};
```

## datavisualization-012: Scientific axes with axis labels

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={label=$x$,min value=0,max value=4,ticks={step=1},grid},
  y axis={label=$f(x)$,min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={style={blue, thick},label in legend={text=$x^2$}},
  data/format=function]
data {
  var x : interval [0:2] samples 21;
  func y = \value x*\value x;
};
```

## datavisualization-013: Scientific axes with end labels

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes={clean,end labels},
  x axis={label=$x$,min value=0,max value=4,ticks={step=1},grid},
  y axis={label=$f(x)$,min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={style={blue, thick},label in legend={text=$x^2$}},
  data/format=function]
data {
  var x : interval [0:2] samples 21;
  func y = \value x*\value x;
};
```

## datavisualization-014: Scientific axes with upright labels

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes={clean,upright labels},
  x axis={label=$x$,min value=0,max value=4,ticks={step=1},grid},
  y axis={label=$f(x)$,min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={style={blue, thick},label in legend={text=$x^2$}},
  data/format=function]
data {
  var x : interval [0:2] samples 21;
  func y = \value x*\value x;
};
```

## datavisualization-015: Scientific axes with logarithmic x axis

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={logarithmic,min value=1,max value=1000,ticks={some},grid},
  y axis={min value=0,max value=3,ticks={step=1},grid},
  visualize as line=series,
  series={style={blue, thick},label in legend={text={log axis}}}]
data {
  x, y, set
  1, 0, series
  10, 1, series
  100, 2, series
  1000, 3, series
};
```

## datavisualization-016: Logarithmic x axis with power unit length

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={logarithmic,power unit length=1cm,min value=1,max value=1000,ticks={some},grid},
  y axis={min value=0,max value=3,ticks={step=1},grid},
  visualize as line=series,
  series={style={blue, thick},label in legend={text={1 cm per decade}}}]
data {
  x, y, set
  1, 0, series
  10, 1, series
  100, 2, series
  1000, 3, series
};
```

## datavisualization-017: Four smooth visualizers with legend below

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       visualize as smooth line/.list={sin,cos,sin 2,cos 2},
                       legend={below, rows=2},
                       style sheet=strong colors,
                       sin={label in legend={text=$\sin x$}},
                       cos={label in legend={text=$\cos x$}},
                       sin 2={label in legend={text=$\sin 2x$}},
                       cos 2={label in legend={text=$\cos 2x$}},
                       data/format=function ]
  data [set=sin] {
    var x : interval [-0.5*pi:4] samples 25;
    func y = sin(\value x r);
  }
  data [set=cos] {
    var x : interval [-0.5*pi:4] samples 25;
    func y = cos(\value x r);
  }
  data [set=sin 2] {
    var x : interval [-0.5*pi:4] samples 25;
    func y = sin(2*\value x r);
  }
  data [set=cos 2] {
    var x : interval [-0.5*pi:4] samples 25;
    func y = cos(2*\value x r);
  };
\end{tikzpicture}
```

## datavisualization-018: Strong colors with varying thickness

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       visualize as smooth line/.list={a,b,c},
                       style sheet=strong colors,
                       style sheet=vary thickness,
                       a={label in legend={text=low}},
                       b={label in legend={text=mid}},
                       c={label in legend={text=high}},
                       data/format=function ]
  data [set=a] {
    var x : interval [0:4] samples 25;
    func y = 0.25*\value x;
  }
  data [set=b] {
    var x : interval [0:4] samples 25;
    func y = 0.25*\value x + 0.5;
  }
  data [set=c] {
    var x : interval [0:4] samples 25;
    func y = 0.25*\value x + 1;
  };
\end{tikzpicture}
```

## datavisualization-019: Vary hue style sheet

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       legend={south east outside},
                       visualize as smooth line/.list={a,b,c,d},
                       style sheet=vary hue,
                       a={label in legend={text=a}},
                       b={label in legend={text=b}},
                       c={label in legend={text=c}},
                       d={label in legend={text=d}},
                       data/format=function ]
  data [set=a] {
    var x : interval [0:1] samples 25;
    func y = \value x;
  }
  data [set=b] {
    var x : interval [0:1] samples 25;
    func y = \value x + 1;
  }
  data [set=c] {
    var x : interval [0:1] samples 25;
    func y = \value x + 2;
  }
  data [set=d] {
    var x : interval [0:1] samples 25;
    func y = \value x + 3;
  };
\end{tikzpicture}
```

## datavisualization-020: PGF math basic functions in function data

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       x axis={min value=0,max value=2,ticks={step=.5},grid},
                       y axis={min value=2,max value=6,ticks={step=1},grid},
                       visualize as smooth line=curve,
                       curve={label in legend={text={PGF math}}},
                       data/format=function ]
  data {
    var x : interval [0:2] samples 21;
    func y = pow(\value x,2)+floor(1.9)+ceil(.1)+round(.49)+sign(-3)+mod(5,2);
  };
\end{tikzpicture}
```

## datavisualization-021: PGF angle conversion math in function data

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       x axis={min value=0,max value=2,ticks={step=1},grid},
                       y axis={min value=0,max value=3,ticks={step=1},grid},
                       visualize as line=angle,
                       angle={label in legend={text={angle math}}},
                       data/format=function ]
  data {
    var x : interval [0:2] samples 3;
    func y = rad(180)/pi + atan(1)/90 + acos(0)/180 + asin(1)/90;
  };
\end{tikzpicture}
```

## datavisualization-022: Plain label in data

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       x axis={min value=0,max value=4,ticks={step=1},grid},
                       y axis={min value=0,max value=4,ticks={step=1},grid},
                       visualize as smooth line=curve,
                       curve={label in data={text={$p$},when=x is 2}},
                       data/format=function ]
  data {
    var x : interval [0:4] samples 5;
    func y = \value x;
  };
\end{tikzpicture}
```

## datavisualization-023: Closed visualizer handlers

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       all axes={ticks=few},
                       visualize as smooth line=polygon,
                       polygon={straight cycle,style={blue},label in legend={text=polygon}},
                       data/format=function ]
  data [set=polygon] {
    var t : interval [0:2*pi] samples 9;
    func x = cos(\value t r);
    func y = sin(\value t r);
  }
  [
    visualize as smooth cycle=loop,
    loop={style={red},label in legend={text=loop}} ]
  data [set=loop, format=function] {
    var t : interval [0:2*pi] samples 17;
    func x = 0.72*cos(\value t r);
    func y = 0.72*sin(\value t r);
  };
\end{tikzpicture}
```

## datavisualization-024: Vary thickness and dashing style sheet

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       visualize as smooth line/.list={a,b,c,d,e,f},
                       style sheet=vary thickness and dashing,
                       a={label in legend={text=a}},
                       b={label in legend={text=b}},
                       c={label in legend={text=c}},
                       d={label in legend={text=d}},
                       e={label in legend={text=e}},
                       f={label in legend={text=f}},
                       data/format=function ]
  data [set=a] {
    var x : interval [0:6] samples 31;
    func y = 0.12*\value x;
  }
  data [set=b] {
    var x : interval [0:6] samples 31;
    func y = 0.12*\value x + 0.35;
  }
  data [set=c] {
    var x : interval [0:6] samples 31;
    func y = 0.12*\value x + 0.7;
  }
  data [set=d] {
    var x : interval [0:6] samples 31;
    func y = 0.12*\value x + 1.05;
  }
  data [set=e] {
    var x : interval [0:6] samples 31;
    func y = 0.12*\value x + 1.4;
  }
  data [set=f] {
    var x : interval [0:6] samples 31;
    func y = 0.12*\value x + 1.75;
  };
\end{tikzpicture}
```

## datavisualization-025: PGF math vector length and conditionals

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       x axis={min value=0,max value=2,ticks={step=1},grid},
                       y axis={min value=2,max value=4,ticks={step=1},grid},
                       visualize as smooth line=curve,
                       curve={label in legend={text={extended pgfmath}}},
                       data/format=function ]
  data {
    var x : interval [0:2] samples 21;
    func y = veclen(\value x,2)+ifthenelse(\value x>1,1,0)+sinh(0)+cosh(0)-1;
};
\end{tikzpicture}
```

## datavisualization-026: Scientific polar axes

```tikz
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\begin{tikzpicture}[baseline]
  \datavisualization [
    scientific polar axes={0 to pi, clean},
    all axes=grid,
    style sheet=vary hue,
    legend=below
    ]
    [visualize as smooth line=sin,
     sin={label in legend={text=$1+\sin \alpha$}}]
    data [format=function] {
      var angle : interval [0:pi] samples 25;
      func radius = sin(\value{angle}r) + 1;
    }
    [visualize as smooth line=cos,
     cos={label in legend={text=$1+\cos\alpha$}}]
    data [format=function] {
      var angle : interval [0:pi] samples 25;
      func radius = cos(\value{angle}r) + 1;
    };
\end{tikzpicture}
```

## datavisualization-027: Cross marks style sheet

```tikz
\usetikzlibrary {datavisualization,plotmarks}
\tikz \datavisualization
 [scientific axes=clean,
  all axes={ticks={step=1},grid},
  visualize as scatter/.list={a,b},
  style sheet=cross marks,
  a={label in legend={text=a}},
  b={label in legend={text=b}}]
data {
  x, y, set
  0, 0, a
  1, 1, a
  2, 0.5, a
  0, 1, b
  1, 0.2, b
  2, 1.4, b
};
```

## datavisualization-028: Gray scale style sheet

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       legend={south east outside},
                       visualize as smooth line/.list={a,b,c,d},
                       style sheet=gray scale,
                       a={label in legend={text=a}},
                       b={label in legend={text=b}},
                       c={label in legend={text=c}},
                       d={label in legend={text=d}},
                       data/format=function ]
  data [set=a] {
    var x : interval [0:2] samples 11;
    func y = \value x;
  }
  data [set=b] {
    var x : interval [0:2] samples 11;
    func y = \value x + 0.2;
  }
  data [set=c] {
    var x : interval [0:2] samples 11;
    func y = \value x + 0.4;
  }
  data [set=d] {
    var x : interval [0:2] samples 11;
    func y = \value x + 0.6;
  };
\end{tikzpicture}
```

## datavisualization-029: Vary hue color series with eight visualizers

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       legend={south east outside},
                       visualize as smooth line/.list={a,b,c,d,e,f,g,h},
                       style sheet=vary hue,
                       a={label in legend={text=a}},
                       b={label in legend={text=b}},
                       c={label in legend={text=c}},
                       d={label in legend={text=d}},
                       e={label in legend={text=e}},
                       f={label in legend={text=f}},
                       g={label in legend={text=g}},
                       h={label in legend={text=h}},
                       data/format=function ]
  data [set=a] { var x : interval [0:1] samples 5; func y = \value x; }
  data [set=b] { var x : interval [0:1] samples 5; func y = \value x + 1; }
  data [set=c] { var x : interval [0:1] samples 5; func y = \value x + 2; }
  data [set=d] { var x : interval [0:1] samples 5; func y = \value x + 3; }
  data [set=e] { var x : interval [0:1] samples 5; func y = \value x + 4; }
  data [set=f] { var x : interval [0:1] samples 5; func y = \value x + 5; }
  data [set=g] { var x : interval [0:1] samples 5; func y = \value x + 6; }
  data [set=h] { var x : interval [0:1] samples 5; func y = \value x + 7; };
\end{tikzpicture}
```

## datavisualization-030: Shades of blue color series

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       legend={south east outside},
                       visualize as smooth line/.list={a,b,c,d,e,f},
                       style sheet=shades of blue,
                       a={label in legend={text=a}},
                       b={label in legend={text=b}},
                       c={label in legend={text=c}},
                       d={label in legend={text=d}},
                       e={label in legend={text=e}},
                       f={label in legend={text=f}},
                       data/format=function ]
  data [set=a] { var x : interval [0:1] samples 5; func y = \value x; }
  data [set=b] { var x : interval [0:1] samples 5; func y = \value x + 1; }
  data [set=c] { var x : interval [0:1] samples 5; func y = \value x + 2; }
  data [set=d] { var x : interval [0:1] samples 5; func y = \value x + 3; }
  data [set=e] { var x : interval [0:1] samples 5; func y = \value x + 4; }
  data [set=f] { var x : interval [0:1] samples 5; func y = \value x + 5; };
\end{tikzpicture}
```

## datavisualization-031: Shades of red color series

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\begin{tikzpicture}[baseline]
  \datavisualization [ scientific axes=clean,
                       legend={south east outside},
                       visualize as smooth line/.list={a,b,c,d,e,f},
                       style sheet=shades of red,
                       a={label in legend={text=a}},
                       b={label in legend={text=b}},
                       c={label in legend={text=c}},
                       d={label in legend={text=d}},
                       e={label in legend={text=e}},
                       f={label in legend={text=f}},
                       data/format=function ]
  data [set=a] { var x : interval [0:1] samples 5; func y = \value x; }
  data [set=b] { var x : interval [0:1] samples 5; func y = \value x + 1; }
  data [set=c] { var x : interval [0:1] samples 5; func y = \value x + 2; }
  data [set=d] { var x : interval [0:1] samples 5; func y = \value x + 3; }
  data [set=e] { var x : interval [0:1] samples 5; func y = \value x + 4; }
  data [set=f] { var x : interval [0:1] samples 5; func y = \value x + 5; };
\end{tikzpicture}
```

## datavisualization-032: Pin in data text prime swap

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=6,ticks={some}},
  y axis={include value={-1,1},ticks={step=.5},grid},
  visualize as smooth line=damped,
  damped={style={orange, thick},pin in data={text'={$e^{-x/2}\sin x$},when=x is 2}},
  data/format=function]
data {
  var x : interval [0:6] samples 61;
  func y = exp(-\value x/2)*sin(\value x r);
};
```

## datavisualization-033: Polar right half clockwise

```tikz
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={right half clockwise, clean},
  all axes=grid,
  visualize as smooth line=arc,
  arc={label in legend={text={$r=1$}}},
  data/format=function]
data {
  var angle : interval [0:100] samples 9;
  func radius = 1;
};
```

## datavisualization-035: Full-circle clean polar axes

```tikz
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\begin{tikzpicture}[baseline]
  \datavisualization [
    scientific polar axes={clean},
    all axes=grid,
    visualize as smooth line=circle,
    circle={label in legend={text={$r=1$}}},
    data/format=function]
  data {
    var angle : interval [0:360] samples 25;
    func radius = 1;
  };
\end{tikzpicture}
```

## datavisualization-034: Data group style sheet legend

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization data group {function classes} = {
  data [set=log, format=function] {
    var x : interval [0.2:2.5] samples 25;
    func y = ln(\value x);
  }
  data [set=lin, format=function] {
    var x : interval [-2:2.5] samples 25;
    func y = 0.5*\value x;
  }
  data [set=squared, format=function] {
    var x : interval [-1.5:1.5] samples 25;
    func y = \value x*\value x;
  }
  data [set=exp, format=function] {
    var x : interval [-2.5:1] samples 25;
    func y = exp(\value x);
  }
};
\tikz \datavisualization [
  school book axes,
  all axes={unit length=7.5mm},
  x axis={label=$x$},
  visualize as smooth line/.list={log,lin,squared,exp},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$}},
  squared={label in legend={text=$x^2$}},
  exp={label in legend={text=$e^x$}},
  style sheet=vary dashing]
data group {function classes};
```

## datavisualization-078: Data labels inherit visualizer color

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  school book axes,
  all axes={unit length=7.5mm},
  every data set label/.append style={text colored},
  visualize as smooth line/.list={rise,fall},
  rise={label in data={text=$r$, when=x is 2}},
  fall={pin in data={text=$f$, when=x is 2}},
  style sheet=strong colors,
  data/format=function]
data [set=rise] {
  var x : interval [0:4] samples 25;
  func y = .25*\value x;
}
data [set=fall] {
  var x : interval [0:4] samples 25;
  func y = 1-.2*\value x;
};
```

## datavisualization-036: Custom traffic-light style sheet

```tikz
\usetikzlibrary {datavisualization}
\pgfkeys{
  /pgf/data visualization/style sheets/traffic light/.cd,
  1/.style={green!50!black},
  2/.style={yellow!90!black},
  3/.style={red!80!black},
  default style/.style={black}
}
\tikz \datavisualization [
  school book axes,
  visualize as line=1,
  visualize as line=2,
  visualize as line=3,
  style sheet=traffic light]
data point [x=0, y=0, set=1]
data point [x=2, y=2, set=1]
data point [x=0, y=1, set=2]
data point [x=2, y=1, set=2]
data point [x=0.5, y=1.5, set=3]
data point [x=2.25, y=1.75, set=3];
```

## datavisualization-037: Style sheet key handler on set attribute

```tikz
\usetikzlibrary {datavisualization}
\pgfkeys{
  /pgf/data visualization/style sheets/traffic light/.cd,
  1/.style={green!50!black},
  2/.style={yellow!90!black},
  3/.style={red!80!black},
  default style/.style={black}
}
\tikz \datavisualization [
  school book axes,
  visualize as line=1,
  visualize as line=2,
  visualize as line=3,
  /data point/set/.style sheet=traffic light]
data point [x=0, y=0, set=1]
data point [x=2, y=2, set=1]
data point [x=0, y=1, set=2]
data point [x=2, y=1, set=2]
data point [x=0.5, y=1.5, set=3]
data point [x=2.25, y=1.75, set=3];
```

## datavisualization-038: Declared traffic-light style sheet

```tikz
\usetikzlibrary {datavisualization}
\pgfdvdeclarestylesheet{traffic light}{
  1/.style={green!50!black},
  2/.style={yellow!90!black},
  3/.style={red!80!black},
  default style/.style={black}
}
\tikz \datavisualization [
  school book axes,
  visualize as line=1,
  visualize as line=2,
  visualize as line=3,
  style sheet=traffic light]
data point [x=0, y=0, set=1]
data point [x=2, y=2, set=1]
data point [x=0, y=1, set=2]
data point [x=2, y=1, set=2]
data point [x=0.5, y=1.5, set=3]
data point [x=2.25, y=1.75, set=3];
```

## datavisualization-039: Set initial remapping in data group

```tikz
\usetikzlibrary {datavisualization}
\pgfdvdeclarestylesheet{traffic light}{
  1/.style={green!50!black},
  2/.style={yellow!90!black},
  3/.style={red!80!black},
  default style/.style={black}
}
\begin{tikzpicture}
  \datavisualization data group {lines} = {
    data point [x=0, y=0,       set=normal]
    data point [x=2, y=2,       set=normal]
    data point [x=0, y=1,       set=heated]
    data point [x=2, y=1,       set=heated]
    data point [x=0.5, y=1.5,   set=critical]
    data point [x=2.25, y=1.75, set=critical]
  };
  \datavisualization [
    school book axes,
    visualize as line=normal,
    visualize as line=heated,
    visualize as line=critical,
    /data point/set/critical/.initial=1,
    style sheet=traffic light]
  data group {lines};
\end{tikzpicture}
```

## datavisualization-040: Parameterized dash style sheet

```tikz
\usetikzlibrary {datavisualization}
\pgfdvdeclarestylesheet{my dashings}{
  default style/.style={dash pattern={on #1pt off 1pt}}
}
\tikz \datavisualization [
  school book axes,
  visualize as line=normal,
  visualize as line=heated,
  visualize as line=critical,
  style sheet=my dashings]
data point [x=0, y=0, set=normal]
data point [x=2, y=2, set=normal]
data point [x=0, y=1, set=heated]
data point [x=2, y=1, set=heated]
data point [x=0.5, y=1.5, set=critical]
data point [x=2.25, y=1.75, set=critical];
```

## datavisualization-041: Low-level custom polar axes

```tikz
\usetikzlibrary { datavisualization.polar }
\tikz \datavisualization
    [new polar axes={angle axis}{radius axis},
     radius axis={length=2cm},
     visualize as scatter]
  data [format=named] {
    angle={0,20,...,160}, radius={0,...,5}
  };
```

## datavisualization-042: Straight legend line with plot marks

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  visualize as line=line,
  line={style={mark=x}, label in legend={text=example, straight label in legend line}},
  data/format=function]
data {
  var x : interval [0:1] samples 2;
  func y = \value x;
};
```

## datavisualization-043: Gap line visualizer

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz [scale=.55] \datavisualization
 [scientific axes=clean,
  all axes={ticks=few},
  visualize as smooth line=my data,
  my data={gap line},
  data/format=function]
data {
  var t : interval [0:4] samples 5;
  func x = cos(\value t r);
  func y = sin(\value t r);
};
```

## datavisualization-044: Gap cycle visualizer

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz [scale=.55] \datavisualization
 [scientific axes=clean,
  all axes={ticks=few},
  visualize as smooth line=my data,
  my data={gap cycle},
  data/format=function]
data {
  var t : interval [0:4] samples 5;
  func x = cos(\value t r);
  func y = sin(\value t r);
};
```

## datavisualization-045: Inside legend text-only placement

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization data group {function classes} = {
  data [set=log, format=function] {
    var x : interval [0.01:3] samples 25;
    func y = ln(\value x);
  }
  data [set=lin, format=function] {
    var x : interval [0:3] samples 25;
    func y = \value x;
  }
  data [set=squared, format=function] {
    var x : interval [0:3] samples 25;
    func y = \value x * \value x;
  }
  data [set=exp, format=function] {
    var x : interval [0:3] samples 25;
    func y = exp(\value x);
  }
};

\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={log, lin, squared, exp},
  legend={south east inside, rows=2, label style=text only},
  log=    {label in legend={text=$\log x$}},
  lin=    {label in legend={text=$x/2$}},
  squared={label in legend={text=$x^2$}},
  exp=    {label in legend={text=$e^x$}},
  style sheet=strong colors]
data group {function classes};
```

## datavisualization-046: Scientific axes inner ticks

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes={inner ticks},
  visualize as line=line,
  data/format=function]
data {
  var x : interval [0:2] samples 3;
  func y = \value x;
};
```

## datavisualization-047: Legend text left placement

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as line=line,
  legend={label style=text left},
  line={label in legend={text=$f$}},
  data/format=function]
data {
  var x : interval [0:2] samples 3;
  func y = \value x;
};
```

## datavisualization-048: Polar inner ticks without grid

```tikz
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={inner ticks, 0 to 180},
  visualize as smooth line,
  data/format=function]
data {
  var angle : interval [0:100] samples 11;
  func radius = \value{angle};
};
```

## datavisualization-049: Legend text colored labels

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={a,b},
  legend={label style=text colored},
  a={label in legend={text=$a$}},
  b={label in legend={text=$b$}},
  style sheet=strong colors,
  data/format=function]
data [set=a] {
  var x : interval [0:2] samples 20;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:2] samples 20;
  func y = 2-\value x;
};
```

## datavisualization-050: Scatter legend three marks

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as scatter/.list={a,b,c},
  style sheet=cross marks,
  a={label in legend={text=example a, label in legend three marks}},
  b={label in legend={text=example b, label in legend three marks}},
  c={label in legend={text=example c}}]
data point [x=0,y=0,set=a]
data point [x=0.5,y=1,set=b]
data point [x=1,y=0.5,set=c];
```

## datavisualization-051: Explicit scatter legend mark coordinates

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as scatter=samples,
  samples={
    style={mark=*,mark size=1.5pt},
    label in legend={
      text=custom marks,
      label in legend mark coordinates={(-2em,0),(0,0)}
    }}]
data point [x=0,y=0,set=samples];
```

## datavisualization-052: West outside scatter legend with text-left samples

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  legend=west outside,
  visualize as scatter=samples,
  samples={style={mark=*,mark size=1.5pt}, label in legend={text=left scatter,
    label in legend mark coordinates={(-2em,0),(0,0)}}}]
data point [x=0,y=0,set=samples];
```

## datavisualization-053: Global straight legend path

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
  school book axes,
  visualize as line/.list={a,b},
  legend entry options/default label in legend path/.style=
    straight label in legend line,
  style sheet=vary dashing,
  a={label in legend={text=a}},
  b={label in legend={text=b}}]
data point [x=-1, y=-1, set=a]   data point [x=1, y=0, set=a]
data point [x=-1, y=1,  set=b]   data point [x=1, y=0.5, set=b];
```

## datavisualization-054: Built-in circle mark style sheets

```tikz
\usetikzlibrary {datavisualization}
\begin{tikzpicture}
  \datavisualization [
    scientific axes=clean,
    x axis={length=2cm},
    y axis={length=1.4cm},
    visualize as scatter=samples,
    style sheet=* mark]
  data point [x=0, y=0, set=samples]
  data point [x=1, y=1, set=samples];

  \begin{scope}[xshift=3.2cm]
  \datavisualization [
    scientific axes=clean,
    x axis={length=2cm},
    y axis={length=1.4cm},
    visualize as scatter=samples,
    style sheet=dot mark]
  data point [x=0, y=0, set=samples]
  data point [x=1, y=1, set=samples];
  \end{scope}

  \begin{scope}[xshift=6.4cm]
  \datavisualization [
    scientific axes=clean,
    x axis={length=2cm},
    y axis={length=1.4cm},
    visualize as scatter=samples,
    style sheet=o mark]
  data point [x=0, y=0, set=samples]
  data point [x=1, y=1, set=samples];
  \end{scope}
\end{tikzpicture}
```

## datavisualization-055: Circular closed legend samples

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes={clean}, all axes={length=3cm},
  visualize as line/.list={a,b,c},
  style sheet=cross marks,
  a={polygon,label in legend={text=polygon}},
  b={smooth cycle,label in legend={text=circle}},
  c={label in legend={text=line}}]
data [format=function, set=a] {
  var t : {0,72,...,359};
  func x = cos(\value t);
  func y = sin(\value t);
}
data [format=function, set=b] {
  var t : interval [0:2*pi] samples 20;
  func x = .8*cos(\value t r);
  func y = .8*sin(\value t r);
}
data point [x=-1, y=0.5, set=c]
data point [x=1, y=0.25, set=c];
```

## datavisualization-056: Gap circular closed legend samples

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes={clean}, all axes={length=3cm},
  visualize as line/.list={a,b,c},
  style sheet=cross marks,
  a={gap cycle,label in legend={text=gap}},
  b={smooth cycle,label in legend={text=circle}},
  c={gap line,label in legend={text=line}}]
data [format=function, set=a] {
  var t : {0,72,...,359};
  func x = cos(\value t);
  func y = sin(\value t);
}
data [format=function, set=b] {
  var t : interval [0:2*pi] samples 20;
  func x = .8*cos(\value t r);
  func y = .8*sin(\value t r);
}
data point [x=-1, y=0.5, set=c]
data point [x=1, y=0.25, set=c];
```

## datavisualization-057: Cartesian axes using angle and radius attributes

```tikz
\usetikzlibrary { datavisualization.formats.functions }
\tikz[baseline] \datavisualization [
  scientific axes={clean},
  x axis={attribute=angle, ticks={minor steps between steps=4}},
  y axis={attribute=radius, ticks={some, style=red!80!black}},
  all axes=grid,
  visualize as smooth line=sin]
data [format=function] {
  var t : interval [-3:3];
  func angle = exp(\value t);
  func radius = \value{t}*\value{t};
};
```

## datavisualization-058: Declared HSB color-series style sheet

```tikz
\usetikzlibrary {datavisualization}
\tikzdvdeclarestylesheetcolorseries{greens}{hsb}{0.3,1.3,0.8}{0,-.4,-.1}
\tikz \datavisualization [
  school book axes,
  visualize as line=normal,
  visualize as line=heated,
  visualize as line=critical,
  normal={label in legend={text=normal}},
  heated={label in legend={text=heated}},
  critical={label in legend={text=critical}},
  style sheet=greens]
data point [x=0, y=0, set=normal]
data point [x=2, y=2, set=normal]
data point [x=0, y=1, set=heated]
data point [x=2, y=1, set=heated]
data point [x=0.5, y=1.5, set=critical]
data point [x=2.25, y=1.75, set=critical];
```

## datavisualization-059: Low-level polar unit vectors

```tikz
\usetikzlibrary {datavisualization.polar}
\tikz \datavisualization
    [new polar axes={angle axis}{radius axis},
     radius axis={unit length=1cm},
     angle axis={unit vectors={(10:1pt)}{(60:1pt)}},
     visualize as scatter]
  data [format=named] {
    angle={0,90}, radius={0.25,0.5,...,2}
  };
```

## datavisualization-060: Explicit legend line coordinates

```tikz
\usetikzlibrary {datavisualization}
\tikz \datavisualization [
  school book axes,
  visualize as line/.list={a,b},
  style sheet=vary dashing,
  a={label in legend={text=a,
      label in legend line coordinates={(-1em,0),(0,0)}}},
  b={label in legend={text=b,
      label in legend line coordinates={(-2em,0),(0,0)}}}]
data point [x=-1, y=-1, set=a]
data point [x=1, y=0, set=a]
data point [x=-1, y=1, set=b]
data point [x=1, y=0.5, set=b];
```

## datavisualization-061: Rectangle visualizer list with remapped attributes

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={attribute=temp,min value=0,max value=4,ticks={step=1},grid},
  y axis={attribute=load,min value=0,max value=3,ticks={step=1},grid},
  visualize as rectangles/.list={cold,hot},
  cold={attribute 1=temp,attribute 2=load,style=blue,label in legend={text={cold}}},
  hot={attribute 1=temp,attribute 2=load,style=red,label in legend={text={hot}}}]
data {
  set,  temp/min, temp/max, load/min, load/max
  cold, 0,        1,        0,        1
  hot,  1,        3,        0,        2
};
```

## datavisualization-062: Polar radius ticks none

```tikz
\usetikzlibrary { datavisualization.formats.functions, datavisualization.polar }
\tikz \datavisualization [
  scientific polar axes={clean},
  all axes=grid,
  radius axis={ticks=none},
  visualize as smooth line=circle,
  data/format=function]
data {
  var angle : interval [0:360] samples 17;
  func radius = 1;
};
```

## datavisualization-063: East outside legend columns

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  all axes={length=2cm},
  visualize as smooth line/.list={a,b,c,d},
  legend={right then down, columns=2},
  style sheet=strong colors,
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  d={label in legend={text=d}},
  data/format=function]
data [set=a] {
  var x : interval [0:1] samples 16;
  func y = .1*\value x;
}
data [set=b] {
  var x : interval [0:1] samples 16;
  func y = .2*\value x;
}
data [set=c] {
  var x : interval [0:1] samples 16;
  func y = .3*\value x;
}
data [set=d] {
  var x : interval [0:1] samples 16;
  func y = .4*\value x;
};
```

## datavisualization-064: East outside legend max columns

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  all axes={length=2cm},
  visualize as smooth line/.list={a,b,c,d,e},
  legend={right then down, max columns=2},
  style sheet=strong colors,
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  d={label in legend={text=d}},
  e={label in legend={text=e}},
  data/format=function]
data [set=a] {
  var x : interval [0:1] samples 16;
  func y = .1*\value x;
}
data [set=b] {
  var x : interval [0:1] samples 16;
  func y = .2*\value x;
}
data [set=c] {
  var x : interval [0:1] samples 16;
  func y = .3*\value x;
}
data [set=d] {
  var x : interval [0:1] samples 16;
  func y = .4*\value x;
}
data [set=e] {
  var x : interval [0:1] samples 16;
  func y = .5*\value x;
};
```

## datavisualization-075: Legend max rows

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  all axes={length=2cm},
  visualize as smooth line/.list={a,b,c,d,e},
  legend={max rows=2},
  style sheet=strong colors,
  a={label in legend={text=a}},
  b={label in legend={text=b}},
  c={label in legend={text=c}},
  d={label in legend={text=d}},
  e={label in legend={text=e}},
  data/format=function]
data [set=a] {
  var x : interval [0:1] samples 16;
  func y = .1*\value x;
}
data [set=b] {
  var x : interval [0:1] samples 16;
  func y = .2*\value x;
}
data [set=c] {
  var x : interval [0:1] samples 16;
  func y = .3*\value x;
}
data [set=d] {
  var x : interval [0:1] samples 16;
  func y = .4*\value x;
}
data [set=e] {
  var x : interval [0:1] samples 16;
  func y = .5*\value x;
};
```

## datavisualization-076: Sloped label in data

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=4,ticks={step=1},grid},
  y axis={min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={style={blue,thick},label in data={text={$p$},node style=sloped,when=x is 2}},
  data/format=function]
data {
  var x : interval [0:4] samples 9;
  func y = \value x;
};
```

## datavisualization-077: Named upper and lower legends

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization data group {function classes} = {
  data [set=log, format=function] {
    var x : interval [0.2:2.5] samples 25;
    func y = ln(\value x);
  }
  data [set=lin, format=function] {
    var x : interval [-2:2.5] samples 25;
    func y = 0.5*\value x;
  }
  data [set=squared, format=function] {
    var x : interval [-1.5:1.5] samples 25;
    func y = \value x*\value x;
  }
  data [set=exp, format=function] {
    var x : interval [-2.5:1] samples 25;
    func y = exp(\value x);
  }
};

\tikz \datavisualization [
  school book axes, all axes={unit length=7.5mm},
  visualize as smooth line/.list={log,lin,squared,exp},
  new legend={upper legend},
  new legend={lower legend},
  upper legend=above,
  lower legend=below,
  log={label in legend={text=$\log x$, legend=upper legend}},
  lin={label in legend={text=$x/2$, legend=upper legend}},
  squared={label in legend={text=$x^2$, legend=lower legend}},
  exp={label in legend={text=$e^x$, legend=lower legend}},
  style sheet=vary dashing]
data group {function classes};
```

## datavisualization-065: Candle stick plot

```tikz
\usetikzlibrary {datavisualization.barcharts}
\tikz \datavisualization
 [scientific axes=clean,
  candle stick plot,
  index/source=dax]
data {
  day, dax/low, dax/high, dax/entry, dax/exit
  1,   10,      40,       18,        32
  2,   12,      42,       35,        20
  3,   18,      55,       30,        48
  4,   25,      80,       74,        42
};
```

## datavisualization-066: Sparkline compact line

```tikz
\usetikzlibrary {datavisualization.sparklines}
\tikz \datavisualization
 [spark line]
data {
  x, y
  0, 0
  1, 1
  2, .2
  3, .8
};
```

## datavisualization-067: North outside legend

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as smooth line/.list={a,b,c},
  legend=north outside,
  style sheet=strong colors,
  a={label in legend={text=$a$}},
  b={label in legend={text=$b$}},
  c={label in legend={text=$c$}},
  data/format=function]
data [set=a] {
  var x : interval [0:1] samples 9;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:1] samples 9;
  func y = 0.5*\value x;
}
data [set=c] {
  var x : interval [0:1] samples 9;
  func y = 0.25*\value x;
};
```

## datavisualization-090: Data label by visualizer index

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=5,ticks={step=1},grid},
  y axis={min value=0,max value=5,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={label in data={text={$i=3$},index=3}},
  data/format=function]
data {
  var x : interval [0:5] samples 6;
  func y = \value x;
};
```

## datavisualization-091: Data label by visualizer position

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=5,ticks={step=1},grid},
  y axis={min value=0,max value=5,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={style={red, thick},label in data={text={$p=.8$},pos=.8}},
  data/format=function]
data {
  var x : interval [0:5] samples 6;
  func y = \value x;
};
```

## datavisualization-092: Automatic data labels by visualizer order

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=4,ticks={step=1},grid},
  y axis={min value=0,max value=16,ticks={step=4},grid},
  visualize as smooth line/.list={linear,squared,cubed},
  linear={label in data={text={$2x$}}},
  squared={label in data={text={$x^2$}}},
  cubed={label in data={text={$x^3$}}},
  data/format=function]
data [set=linear] {
  var x : interval [0:4] samples 9;
  func y = 2*\value x;
}
data [set=squared] {
  var x : interval [0:4] samples 9;
  func y = \value x*\value x;
}
data [set=cubed] {
  var x : interval [0:2.5] samples 9;
  func y = \value x*\value x*\value x;
};
```

## datavisualization-093: Legend matrix node style background

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes,
  visualize as smooth line/.list={log, lin},
  legend={matrix node style={fill=black!25}},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$}},
  style sheet=vary dashing,
  data/format=function]
data [set=log] {
  var x : interval [0.2:2.5] samples 8;
  func y = ln(\value x);
}
data [set=lin] {
  var x : interval [-2:2.5] samples 8;
  func y = 0.5*\value x;
};
```

## datavisualization-094: Inside legend opaque color

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as smooth line/.list={log, lin},
  legend={south east inside, label style=text only, opaque=yellow!30},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$}},
  style sheet=strong colors,
  data/format=function]
data [set=log] {
  var x : interval [0.2:2.5] samples 8;
  func y = ln(\value x);
}
data [set=lin] {
  var x : interval [-2:2.5] samples 8;
  func y = 0.5*\value x;
};
```

## datavisualization-095: Inside legend transparent

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as smooth line/.list={log, lin},
  legend={south east inside, label style=text only, transparent},
  log={label in legend={text=$\log x$}},
  lin={label in legend={text=$x/2$}},
  style sheet=strong colors,
  data/format=function]
data [set=log] {
  var x : interval [0.2:2.5] samples 8;
  func y = ln(\value x);
}
data [set=lin] {
  var x : interval [-2:2.5] samples 8;
  func y = 0.5*\value x;
};
```

## datavisualization-096: Legend visualizer-only styling

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization [
  scientific axes=clean,
  visualize as smooth line/.list={series, reference},
  legend={south east outside},
  series={style={blue}, label in legend={text=series,
    visualizer in legend style={red, line width=1.5pt}}},
  reference={style={black, densely dashed}, label in legend={text=reference}},
  data/format=function]
data [set=series] {
  var x : interval [0:2] samples 9;
  func y = \value x;
}
data [set=reference] {
  var x : interval [0:2] samples 9;
  func y = 1.2 - 0.3*\value x;
};
```

## datavisualization-097: Repeated labels in one data visualizer

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=4,ticks={step=1},grid},
  y axis={min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={
    label in data={text={$a$},when=x is 1},
    label in data={text={$b$},when=x is 3}
  },
  data/format=function]
data {
  var x : interval [0:4] samples 9;
  func y = \value x;
};
```

## datavisualization-098: Repeated pins in one data visualizer

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikz \datavisualization
 [scientific axes=clean,
  x axis={min value=0,max value=4,ticks={step=1},grid},
  y axis={min value=0,max value=4,ticks={step=1},grid},
  visualize as smooth line=curve,
  curve={
    pin in data={text={$a$},when=x is 1},
    pin in data={text={$b$},when=x is 3}
  },
  data/format=function]
data {
  var x : interval [0:4] samples 9;
  func y = \value x;
};
```

## datavisualization-099: TikZ datavisualization named style

```tikz
\usetikzlibrary {datavisualization.formats.functions}
\tikzdatavisualizationset{
  legend example/.style={
    scientific axes,
    all axes={length=1cm,ticks=none},
    a={label in legend={text=a}},
    b={label in legend={text=b}}
  }
}
\tikz \datavisualization [
  visualize as smooth line/.list={a,b},
  legend example,
  style sheet=strong colors,
  data/format=function]
data [set=a] {
  var x : interval [0:1] samples 12;
  func y = \value x;
}
data [set=b] {
  var x : interval [0:1] samples 12;
  func y = 1-\value x;
};
```

## eigenvector-001: Eigenvector stays on same line after transformation

```tikz
\definecolor{paper}{HTML}{F8FAFC}
\definecolor{axis}{HTML}{334155}
\definecolor{gridline}{HTML}{D7E1EA}
\definecolor{eig}{HTML}{2563EB}
\definecolor{image}{HTML}{F97316}
\definecolor{other}{HTML}{64748B}
\definecolor{text}{HTML}{0F172A}
\begin{tikzpicture}[
  x=1cm,
  y=1cm,
  line cap=round,
  line join=round,
  font=\sffamily
]
  \path[fill=paper, rounded corners=10pt] (-3.25,-2.15) rectangle (3.55,3.2);
  \foreach \x in {-3,-2,-1,0,1,2,3} {
    \draw[gridline, line width=0.32pt] (\x,-1.8) -- (\x,2.75);
  }
  \foreach \y in {-1,0,1,2} {
    \draw[gridline, line width=0.32pt] (-2.95,\y) -- (3.25,\y);
  }
  \draw[axis, line width=0.85pt, -stealth] (-2.95,0) -- (3.28,0);
  \draw[axis, line width=0.85pt, -stealth] (0,-1.78) -- (0,2.9);
  \draw[eig, line width=1.1pt, densely dashed] (-2.7,-1.35) -- (2.9,1.45);
  \draw[eig, line width=1.8pt, -stealth] (0,0) -- (1.15,0.58);
  \draw[image, line width=1.8pt, -stealth] (0,0) -- (2.25,1.13);
  \node[text=eig, font=\scriptsize, anchor=south] at (1.05,0.65) {$\mathbf v$};
  \node[text=image, font=\scriptsize, anchor=south] at (2.15,1.22) {$A\mathbf v=\lambda\mathbf v$};
  \draw[other, line width=1.7pt, -stealth] (0,0) -- (0.85,1.35);
  \draw[image, line width=1.7pt, -stealth] (0,0) -- (1.85,0.72);
  \node[text=other, font=\scriptsize, anchor=south east] at (0.85,1.35) {$\mathbf w$};
  \node[text=image, font=\scriptsize, anchor=west] at (1.88,0.72) {$A\mathbf w$};
  \node[text=text, font=\bfseries\large, anchor=west] at (-2.95,2.92) {Eigenvector};
  \node[text=axis, font=\scriptsize, anchor=west] at (-2.95,2.63) {same line after transformation};
\end{tikzpicture}
```

## eigenvector-002: Two eigen-directions

```tikz
\definecolor{paper}{HTML}{F8FAFC}
\definecolor{axis}{HTML}{334155}
\definecolor{gridline}{HTML}{D7E1EA}
\definecolor{blue}{HTML}{2563EB}
\definecolor{orange}{HTML}{F97316}
\definecolor{text}{HTML}{0F172A}
\begin{tikzpicture}[
  x=1cm,
  y=1cm,
  line cap=round,
  line join=round,
  font=\sffamily
]
  \path[fill=paper, rounded corners=10pt] (-3.15,-2.2) rectangle (3.55,3.25);
  \foreach \x in {-3,-2,-1,0,1,2,3} {
    \draw[gridline, line width=0.32pt] (\x,-1.85) -- (\x,2.8);
  }
  \foreach \y in {-1,0,1,2} {
    \draw[gridline, line width=0.32pt] (-2.9,\y) -- (3.25,\y);
  }
  \draw[axis, line width=0.85pt, -stealth] (-2.9,0) -- (3.28,0);
  \draw[axis, line width=0.85pt, -stealth] (0,-1.8) -- (0,2.95);
  \draw[blue, line width=1pt, densely dashed] (-2.75,0) -- (3.05,0);
  \draw[orange, line width=1pt, densely dashed] (-2.0,-2.0) -- (2.55,2.55);
  \draw[blue, line width=1.7pt, -stealth] (0,0) -- (1,0);
  \draw[blue, line width=1.7pt, -stealth] (0,0.16) -- (2,0.16);
  \node[text=blue, font=\scriptsize, anchor=south] at (1,0.25) {$\lambda=2$};
  \draw[orange, line width=1.7pt, -stealth] (0,0) -- (0.75,0.75);
  \draw[orange, line width=1.7pt, -stealth] (0.1,0) -- (2.25,2.15);
  \node[text=orange, font=\scriptsize, anchor=west] at (2.05,2.18) {$\lambda=3$};
  \node[text=text, font=\bfseries\large, anchor=west] at (-2.9,2.96) {Two eigen-directions};
  \node[text=axis, font=\scriptsize, anchor=west] at (-2.9,2.67) {$A=\begin{pmatrix}2&1\\0&3\end{pmatrix}$};
\end{tikzpicture}
```
