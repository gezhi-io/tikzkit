# TikZ Trees Edge-From-Parent Paths

## Scope

This slice implements the `trees` library's stored `edge from parent path`
template family. The acceptance boundary is:

- substitute `\tikzparentnode` and `\tikzchildnode`, including explicit or
  configured parent and child anchors;
- expand scalar products of the active `\tikzleveldistance`;
- parse straight, orthogonal (`|-` and `-|`), and cubic Bezier templates with
  relative waypoints and control points;
- apply the `edge from parent` style before child-local edge options;
- collect and place path nodes written after `edge from parent`;
- reuse normal path construction and node-border clipping.

`edge from parent macro`, arbitrary TeX callbacks, and path operations not
understood by the shared path parser are outside this slice.

The permanent visual drivers are:

- `test/fixtures/examples/trees-edge-path/flowchart.tex`
- `test/fixtures/examples/trees-edge-path/math.tex`
- `test/fixtures/examples/trees-edge-path/physics.tex`

Each fixture has an adjacent source review and a strict generated semantic
audit in `docs/qa`.

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
around lines 1366-1414. The default `\tikz@edge@from@parent@macro` first
applies `style=edge from parent`, then executes the stored edge path, and then
adds collected node specifications. The default path is
`(\tikzparentnode\tikzparentanchor) --
(\tikzchildnode\tikzchildanchor)`. A configured anchor becomes a dot suffix;
`border` remains empty so the path engine clips against the node border.

Reviewed the same file around lines 3135-3160 and 4645-4678. TikZ collects all
nodes following `edge from parent`, creates the child before evaluating the
parent edge, binds the parent and child names, and only then runs the path
template. This establishes why the browser parser must retain trailing edge
nodes instead of discarding them while parsing children.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex`
from line 115. `fork down`, `fork up`, `fork left`, and `fork right` are stored
path templates. They use relative coordinates such as
`+(0pt,-.5\tikzleveldistance)` followed by an orthogonal connector. This is
the installed-source model for the mathematical factor-tree fixture.

Reviewed the registry-linked
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-trees.tex`
in its Edges From Parent subsection. It defines each fork direction as a
half-level-distance stem followed by horizontal and vertical segments. This
matches the source templates and confirms the shared orthogonal-path behavior.

Reviewed
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-trees.tex`
in the Edges From the Parent Node section. Its custom curve example is
`(\tikzparentnode.south) .. controls +(0,-1) and +(0,1) ..
(\tikzchildnode.north)`. It also specifies that nodes following the edge
command are implicitly positioned path nodes.

## Visual References

Local reference tools:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX `pdflatex`: `/Library/TeX/texbin/pdflatex`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`

MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, one-centimeter grids, diffs,
and four-panel sheets are stored in:

- `outputs/qa/2026-09-05-trees-edge-path-before`
- `outputs/qa/2026-09-05-trees-edge-path-after`

The before and after four-panel sheets were inspected at original resolution.
Before the fix, TikZKit replaced every custom template with a direct diagonal
segment. The flowchart lost both cubic routing and arrow tips; the factor tree
lost its vertical stem and horizontal bus; the transition tree lost its
curves, both edge labels, and the arrow style.

After the fix:

- the flowchart has the native pair of cubic parent edges, clipped at the
  south/north node borders, with thick stealth tips;
- the factor tree has a vertical stem, shared horizontal bus, and two vertical
  drops at the same logical coordinates as MacTeX and tikztosvg;
- the transition tree has curved arrows, a locally dashed right edge, and the
  `\gamma` and `\hbar\omega` edge-label circles on the correct sides;
- all three TikZKit renders retain zero diagnostics.

The flowchart and physics changed-pixel ratios against tikztosvg move from
8.8% to 8.0% and from 6.0% to 5.2%. The factor-tree ratio moves from 10.1% to
10.8% even though the visibly wrong diagonal edges become the correct
orthogonal bus. That increase is a useful reminder that raw pixel counts are
not geometry-aware and are not the acceptance criterion. Remaining visible
differences are the SVG text/glyph rasterization, formula node metrics, and
the exact stealth-tip outline.

## SVG Structure

The tikztosvg flowchart stores the left route as a cubic path beginning
`M 0.0015625 -10.121375 C 0.0015625 -27.129188 ...`; the factor-tree route is
the explicit polyline `M 0.000875 -15.83125 L 0.000875 -35.675 L -45.354594
-35.675 L -45.354594 -43.245312`. It emits TeX glyphs as reusable paths,
uses `matrix(1,0,0,-1,...)`, `fill-rule=nonzero`, butt line caps, miter joins,
and a 0.79701pt thick edge stroke.

TikZKit now stores equivalent cubic or line commands in the renderer-neutral
scene path. It keeps text as SVG text using the bundled Computer Modern fonts
and emits the stealth tip as a separate filled path. Because template parsing,
anchor resolution, clipping, and path-node placement occur before SVG output,
the renderer remains independent of tree syntax.

## Command And Parameter Coverage

Implemented and verified in the three selected cases:

- shell and dependency commands: `\documentclass`, `\usepackage`,
  `\usetikzlibrary`, `\begin`, and `\end`;
- tree commands and macros: `\node`, `child`, `edge from parent`,
  `\tikzparentnode`, `\tikzchildnode`, and `\tikzleveldistance`;
- math text commands: `\gamma`, `\hbar`, `\omega`, and `\rangle`;
- growth and sizing parameters: `grow=down`, `level distance`, `sibling
  distance`, `minimum width`, `minimum height`, `minimum size`, and `inner
  sep`;
- style parameters: `every node/.style`, `edge from parent/.style`, `draw`,
  `fill`, `circle`, `rounded corners`, `thick`, `-stealth`, and the child-local
  `dashed` option;
- path parameters: explicit `.south`/`.north` anchors, relative `+(...)`
  coordinates, cubic `controls ... and ...`, straight `--`, orthogonal `-|`,
  and the `.35\tikzleveldistance` scalar product;
- path-node parameters: `left`, `right`, `fill=white`, and `inner sep=1pt`.

No command, option, or numeric literal used by these three cases is unreviewed;
the generated audits contain the full per-line inventory. The out-of-scope
library work remains listed in the Scope section.

## Implementation And Verification

- `src/frontend/parser.js` preserves trailing edge nodes on each child AST.
- `src/tikz/libraries/trees.js` expands template macros, anchors, and the level
  distance, then delegates syntax to the shared path parser.
- `src/engine/evaluate.js` binds parent/child aliases, builds the route with the
  normal path engine, applies styles in TikZ order, clips node borders, and
  renders collected edge nodes.
- `scripts/case-semantic-audit.js` assigns the tree template macros and options
  to their actual implementation owners.
- `test/trees-edge-path.test.js` covers parsing, cubic geometry and arrows,
  orthogonal level-distance geometry, and two edge-label positions.

All three strict semantic audits pass. Visual acceptance passes for the three
selected cases; the remaining differences are documented above rather than
being represented as exact SVG parity. The focused tree and semantic-audit run
passes 31 tests. The full filesystem-sandbox run reports 2192 passing tests,
137 known failures, and 14 skipped optional-corpus tests. Five of those
failures are workbench tests denied permission to bind `127.0.0.1`; the same
five pass in an allowed local-socket run. The normalized result is 2197
passing tests, the unchanged baseline of 132 known failures, and 14 skipped
tests.
