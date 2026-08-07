# TikZKit

TikZKit is a pure JavaScript TikZ semantic interpreter. It is not a full TeX engine. The goal is to support practical TikZ/PGF drawing semantics in the browser and in Node.js, then render them to SVG.

> [!WARNING]
> **TikZKit is still under active testing.** It is not production ready and is
> not a complete replacement for TeX, TikZ, PGF, or PGFPlots. Compatibility is
> expanded and verified case by case against local MacTeX/`tikztosvg` output.

## Current Status: Experimental

TikZKit is currently an experimental compatibility prototype. It is useful for
studying TikZ semantics, comparing JavaScript rendering against local
`tikztosvg`/MacTeX output, and iterating on focused real-world cases.

It is **not ready for general use** as a drop-in TikZ renderer, npm dependency,
or production browser library. Many TikZ, PGF, PGFPlots, TeX macro, font,
layout, and package behaviors are still partial or case-driven. Unsupported or
partially supported syntax may render approximately, emit diagnostics, or fail
to match native TikZ visual output.

The current checkout is an active calibration checkpoint: a source that renders in
the browser is **not** automatically accepted as visually compatible. In
particular, font metrics, PGFPlots tick/label placement, 3D axes, and advanced
package layout are still being corrected against local MacTeX and
`tikztosvg`. Treat a green focused fixture as evidence for that fixture and
feature slice only; run the full test suite and inspect the paired reference
artifacts before promoting a change.

Use this repository as a work-in-progress renderer and testbed, not as a stable
implementation.

The current pipeline is:

```text
source -> preprocess extensions -> parser -> semantic interpreter -> drawing IR -> SVG renderer
```

It is designed for browser rendering of fenced TikZ code blocks, CLI conversion, and incremental support for common TikZ libraries.

For a copyable Chinese guide to the browser workbench, CLI export, JavaScript
API, three-way visual verification, and the current testing boundary, see
[使用指南](docs/usage.md).

## Use It Today

The repository has two separate jobs. The browser workbench is for quick,
local JavaScript previews; the visual-QA tools are for deciding whether a
renderer change is actually compatible with native TikZ. Keep those workflows
separate so a visible preview is never mistaken for a completed implementation.

| Goal | Run | Result |
| --- | --- | --- |
| Edit and preview locally | `npm install` then `npm run web` | Open `http://127.0.0.1:5173/`; rendering uses browser JavaScript only. |
| Use a second browser port | `PORT=5174 npm run web` | Starts another independent workbench without stopping the first one. |
| Export one source file | `node bin/tikz2svg.js path/to/source.tex -o outputs/source.svg` | Writes a clean TikZKit SVG. |
| Audit a real source | `npm run case:audit -- path/to/source.tex --output outputs/audit.md --init-review outputs/review.json` | Lists packages, libraries, commands, options, values, and expressions that need a support decision. |
| Verify one maintained fixture | Use the three commands in [Visual QA](docs/usage.md#4-验证一个真实案例) | Produces TikZKit, `tikztosvg`, MacTeX, and diff panels in one ignored output directory. |

Start with a browser preview when writing a diagram. Before changing the
renderer or declaring a case usable, run the audit and the three-way visual
comparison. `outputs/` is intentionally ignored: commit the implementation,
fixture, regression test, registry entry, and written QA conclusion, not
generated PNG/SVG files. The complete Chinese walkthrough, including browser
troubleshooting and acceptance criteria, is [docs/usage.md](docs/usage.md).

### Compatibility Acceptance

A browser preview is only the first checkpoint. Before calling a real source
compatible, run the semantic audit, render TikZKit, local `tikztosvg`, and
local MacTeX together, then inspect the generated sheet rather than relying on
one pixel-difference number:

```bash
npm run case:audit -- path/to/case.tex --output outputs/case-audit.md
npm run examples:render -- --fixtures test/fixtures/examples --only <fixture-id> \
  --output outputs/qa-my-change --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output outputs/qa-my-change
```

The result page is `outputs/qa-my-change/index.html`. Check missing elements,
coordinate scale and crop, layers, line/arrow geometry, labels, formulas, and
font metrics against MacTeX. The implementation remains experimental until
the corresponding feature slice has a focused regression and a written QA
record; see [docs/usage.md](docs/usage.md) for the full Chinese workflow.

### Verified `text width` Inline-Math Wrap

The `svg-text` renderer now measures every inline formula as one TeX-sized
word group before applying a node's `text width` line break. This prevents a
compact relation such as `\alpha = \gamma` from incorrectly becoming its own
line after otherwise fitting prose. The focused visual driver is
`test/fixtures/implementation-examples/real-world/parallel-line-angles.tikz`:

```bash
node --test --test-name-pattern='keeps compact inline math on the TeX-sized svg-text paragraph line' test/renderer.test.js
```

Its TikZKit, local `tikztosvg`, and local MacTeX evidence is recorded in
[docs/qa/2026-08-07-text-width-inline-math-wrap.md](docs/qa/2026-08-07-text-width-inline-math-wrap.md).
This is still an experimental paragraph-layout subset: TeX hyphenation,
justification glue and penalties, and full `minipage` layout are not yet
equivalent.

### Verified Node-Local `minipage` Width

When a TikZ node contains an outer `minipage`, TikZKit now maps that required
width onto the same shared `text width` layout path. This includes native TeX
scalar/register syntax such as `0.35\textwidth`; a supplied TikZ `text width`
remains authoritative. The focused real driver is
`test/fixtures/implementation-examples/real-world/minipage-text-width.tex`:

```bash
node --test --test-name-pattern='outer minipage width' test/interpreter.test.js
```

The three-way evidence is in
[docs/qa/2026-08-07-minipage-text-width.md](docs/qa/2026-08-07-minipage-text-width.md).
It confirms matching outer width, placement, and wrapping instead of the old
single overwide line. Native discretionary hyphenation, justification glue,
footnotes, and nested minipage vertical layout remain outside this slice.

### Verified Decorated Callback Labels

`decorations.pathreplacing` can replay each original path command through
`show path construction`. Callback paths inherit `every node` placement keys,
so a terminal `node` uses `midway`, `sloped`, and `pos` on the actual line or
cubic Bezier segment rather than being pinned to its endpoint. This covers
the documented `moveto code`, `lineto code`, `curveto code`, and `closepath
code` callback form:

```tex
\usetikzlibrary{decorations.pathreplacing}
\begin{tikzpicture}[every node/.style={midway,sloped},
  decoration={show path construction,
    lineto code={\draw[blue] (\tikzinputsegmentfirst) --
      (\tikzinputsegmentlast) node[above]{line};}}]
  \path[decorate] (0,0) -- (3,1);
\end{tikzpicture}
```

Run the focused regression with
`node --test --test-name-pattern='inherits every node placement' test/interpreter.test.js`.
The real PGF manual driver and the three-way visual record are in
[docs/qa/2026-08-07-decorations-pathreplacing-show-path-construction.md](docs/qa/2026-08-07-decorations-pathreplacing-show-path-construction.md).
This is still a partial library slice: arbitrary TeX callback bodies and exact
native CMR glyph-width/bounding-box parity are not claimed.

### Verified Node Font Inheritance

TikZKit now carries a node style's resolved font into the physical SVG text
FontSpec, rather than using it only to estimate layout. This covers ordinary
`\\node` commands, `node` labels on a path, and callback labels created by a
decoration. The precedence follows the local TikZ node rules:

```tex
\begin{tikzpicture}[
  font=\small,
  every node/.style={font=\tiny},
  nodes={font=\scriptsize}
]
  \node {ordinary};
  \draw[font=\Large] (0,0) -- node[font=\bfseries] {inline} (1,0);
\end{tikzpicture}
```

The picture `font` remains the scope layer; `every node`, `nodes={...}`, and a
local node/path-node font form the node layer; a leading content command such
as `\scriptsize` takes final precedence. The focused tests are in
`test/font-spec.test.js`, and the real PGF visual QA record is
[docs/qa/2026-08-07-every-node-font-inheritance.md](docs/qa/2026-08-07-every-node-font-inheritance.md).

### A Verified Multipart Example

The following `shapes.multipart` subset is covered by a shared regression and
a local three-way visual check: vertical or horizontal rectangle splits,
`rectangle split part fill`, the source-defined custom-fill toggle, ordinary
`fill`, and `rounded corners`. Outer corners remain rounded while internal
split corners remain square.

```tex
\usetikzlibrary{shapes.multipart}
\begin{tikzpicture}
  \node[rectangle split, rectangle split horizontal, rectangle split parts=3,
    rectangle split part fill={orange!30,cyan!30,violet!30},
    rounded corners=10pt, draw]
    {left\nodepart{two}middle\nodepart{three}right};
\end{tikzpicture}
```

Run `node --test test/shapes-multipart-rounded-custom-fill.test.js` for the
semantic regression. The executable visual driver is
`pgf-rectangle-split-rounded-custom-fill`; its evidence and remaining limits
are recorded in
[docs/qa/2026-08-07-shapes-multipart-rounded-custom-fill.md](docs/qa/2026-08-07-shapes-multipart-rounded-custom-fill.md).

### A Verified `circuitikz` MOS Node Example

The experimental `circuitikz` subset also includes the common enhanced-mode
MOS node forms. `nmos` and `pmos` expose the documented `G`, `D`, and `S`
anchors; `tripoles/mos style=arrows` enables their current arrows, and a PMOS
node accepts `emptycircle` at its gate. This is a focused compatibility slice,
not a complete transistor implementation.

```tex
\usepackage{circuitikz}
\begin{tikzpicture}
  \ctikzset{tripoles/mos style=arrows}
  \node[nmos] (n) at (0,0) {};
  \node[pmos, emptycircle] (p) at (2,0) {};
  \draw (n.G) -- ++(-.7,0) node[left] {$G_n$};
  \draw (n.D) -- ++(0,.55) node[above] {$D_n$};
  \draw (n.S) -- ++(0,-.55) node[below] {$S_n$};
\end{tikzpicture}
```

Run the semantic regression with
`node --test --test-name-pattern='renders circuitikz NMOS and PMOS nodes with G D S anchors' test/interpreter.test.js`.
The permanent fixture is `circuitikz-mosfet-nodes`; the three-way visual
evidence, command and parameter coverage, and remaining limitations are in
[docs/qa/2026-08-07-circuitikz-mosfet-node-anchors.md](docs/qa/2026-08-07-circuitikz-mosfet-node-anchors.md).

### A Verified `shapes.arrows` Example

The focused `shapes.arrows` slice gives `single arrow` and `double arrow` a
shared PGF-derived geometry record: SVG polygons, path clipping, and named
anchors therefore use the same tip, shoulder, and shaft locations. Physical
`minimum height`, transverse `minimum width`, `tip angle`, `head extend`, and
`head indent` are covered.

```tex
\usetikzlibrary{shapes.arrows}
\begin{tikzpicture}
  \node[single arrow, draw, fill=blue!15,
    minimum height=3cm, minimum width=1.8cm,
    single arrow head extend=.5cm,
    single arrow head indent=.25cm] (a) {Single};
  \draw[red,<->] (a.before tip) -- (a.after tip);
\end{tikzpicture}
```

This is not yet complete `shapes.arrows` compatibility: arrow box, arbitrary
radial border anchors, full outer-separation behavior, and all rotation/text
metric variants remain partial. The permanent fixture is
`shapes-arrows-single-double`; its MacTeX/tikztosvg/TikZKit comparison is
recorded in
[docs/qa/2026-08-07-shapes-arrows-single-double.md](docs/qa/2026-08-07-shapes-arrows-single-double.md).

### A Verified `shapes.geometric` Boundary Example

The default `trapezium` construction now follows PGF's cotangent-derived side
extensions and normal minimum-size scaling. Curved terminal arrows to convex
polygon corners use the mitered outer border rather than an arbitrary adjacent
side. The same shared geometry now gives `star points`, `star point ratio`,
`star point height`, `minimum size`, and `star rotate` the PGF radius rules
instead of scaling an arbitrary text rectangle. This is deliberately a narrow
`shapes.geometric` and arrow-boundary slice: `trapezium stretches`, star
outer-separation anchors, and all concave-shape border rules remain partial.

```tex
\usetikzlibrary{arrows.meta,shapes.geometric}
\begin{tikzpicture}
  \node[draw,trapezium,trapezium left angle=70,trapezium right angle=110,
    minimum width=2.4cm,minimum height=1.3cm] (trap) {trapezium};
  \node[draw,star,star points=5,star point ratio=1.8,
    star rotate=18,minimum size=2cm] (star) at (-3,0) {star};
  \draw[-{Latex[length=4mm,width=3mm]},line width=10pt,orange]
    (3.1,1.2) to[out=-160,in=14.5] (trap);
\end{tikzpicture}
```

Run the focused regression with
`node --test --test-name-pattern='PGF star radius modes|trapezium cotangent|curved terminal arrows beyond' test/interpreter.test.js`.
The independent trapezium driver is `test/fixtures/arrows/shape-curved-terminal-miters.tex`,
with its local MacTeX, `tikztosvg`, and TikZKit visual record in
[docs/qa/2026-08-07-shapes-geometric-trapezium-miters.md](docs/qa/2026-08-07-shapes-geometric-trapezium-miters.md).
The star-radius driver is `test/fixtures/examples/arrows/shape-curved-terminal-padding.tex`,
with the corresponding three-way evidence in
[docs/qa/2026-08-07-shapes-geometric-star-radii.md](docs/qa/2026-08-07-shapes-geometric-star-radii.md).

### A Verified Tree-Anchor Example

The focused `trees` slice supports the anchors which determine how a generated
child is placed and where its generated parent edge starts and ends. In
particular, `growth parent anchor`, `every child node`, `parent anchor`,
`child anchor`, and the four standard `edge from parent fork` routes share the
same node-anchor geometry.

```tex
\usetikzlibrary{trees}
\begin{tikzpicture}[level distance=1cm,
  every node/.style={draw,rectangle,minimum height=6mm,inner sep=2pt},
  every child node/.style={anchor=north}]
  \node {root}[growth parent anchor=south,parent anchor=south,child anchor=north]
    child { node {child} edge from parent[blue,thick] };
\end{tikzpicture}
```

The executable driver is `trees-anchor-routing`; its three-way visual evidence
and remaining boundary are in
[docs/qa/2026-08-07-trees-anchor-routing.md](docs/qa/2026-08-07-trees-anchor-routing.md).
This is not a graph-drawing or collision-avoidance implementation.

### A Verified `chains` Existing-Node Example

`\chainin` can add an already drawn node to the active chain without drawing
that node a second time. The verified subset applies `every chain in` first,
then direct `\chainin` options, matching the local TikZ late-options order.
This lets the inherited style provide the join and edge appearance.

```tex
\usetikzlibrary{chains,arrows.meta}
\begin{tikzpicture}[
  start chain=walk going right,
  every join/.style={-{Stealth[length=1.8mm]}},
  every chain in/.style={join=by {red,very thick}}
]
  \node (existing) at (0,2) {existing};
  \node[draw,on chain,join] {A};
  \node[draw,on chain,join] {B};
  \chainin (existing);
  \node[draw,on chain,join] {C};
\end{tikzpicture}
```

The regression and three-way reference are documented in
[docs/qa/2026-08-07-chains-every-chain-in.md](docs/qa/2026-08-07-chains-every-chain-in.md).
Continuing an arbitrary `\path` after `\chainin` is still partial.

### A Verified Gantt Grid Example

The basic `pgfgantt` lowering covers `\gantttitle`, bars, groups, and a focused
grid style-list subset. It follows the package defaults for title height
(`.6 × y unit title`), bar geometry (`top=.3`, `height=.4`), group geometry
(`left=-.1`, `right=.1`, `top=.4`, `height=.2`), and the native
`\small`/`\normalsize` label roles. Local `title`, `bar`, and `group`
`left/right/top shift` plus `height` options are supported. `hgrid=true` uses
PGF's dotted default; `vgrid` accepts the manual's repeated form
`*{count}{style}` and cycles it across successive internal time boundaries.

```tex
\begin{ganttchart}[hgrid=true,
  vgrid={*2{red},*1{green},*{10}{blue,dashed}}]{1}{20}
  \gantttitle{Plan}{20} \\
  \ganttbar{Phase A}{1}{8} \\
  \ganttbar{Phase B}{9}{20}
\end{ganttchart}
```

This does not yet implement pgfgantt links, calendar/date slots, progress,
title lists, special bar/group shapes, or arbitrary canvas and element styles.
The fixture is
`pgfgantt-grid-style-list`; its visual QA record is in
`docs/qa/2026-08-07-pgfgantt-grid-style-list.md`.

## Start Here

Use the repository in this order. A successful browser render is useful for
editing, but is not a claim of native TikZ compatibility.

```bash
# Install the JavaScript dependencies once.
npm install

# Open the local browser workbench.
npm run web

# Or keep an existing workbench running and use another port.
PORT=5174 npm run web
```

Open <http://127.0.0.1:5173/> (or the chosen port), select a maintained case,
edit the source, and inspect the TikZKit SVG plus diagnostics. The workbench
uses only browser JavaScript: it does not call LaTeX or read arbitrary local
files.

To export one source without any QA overlay:

```bash
node bin/tikz2svg.js path/to/diagram.tex -o outputs/diagram.svg
```

To decide whether a changed real case is usable, generate one local comparison
bundle and inspect it rather than relying on a pixel-diff score:

```bash
npm run case:audit -- path/to/case.tex \
  --output outputs/qa-case/audit.md \
  --init-review outputs/qa-case/review.json

npm run examples:render -- --fixtures test/fixtures/examples \
  --only <fixture-id> \
  --output outputs/qa-case \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg

npm run examples:diff -- --output outputs/qa-case \
  --register --alignment-radius 3
```

Open `outputs/qa-case/index.html` for the TikZKit and `tikztosvg` SVG panels.
The same directory contains the local MacTeX PNG and four-panel diff sheet.
The disposable `tikztosvg` input preserves an explicit `standalone` `border=`
or `preview` `\\PreviewBorder`, so reference panels use the source document's
crop rather than a tighter unrelated picture crop.
Check missing elements, coordinate origin and scale, labels, formulas, arrows,
stroke weight, clipping, and paint order. `outputs/` and `output/` are local
artifacts ignored by Git; never include them in a compatibility commit.

### Choose A Workflow

| Goal | Command | What it does |
| --- | --- | --- |
| Try or edit TikZ in the browser | `npm run web` | Starts the local workbench at `http://127.0.0.1:5173/`; rendering stays entirely in browser JavaScript. |
| Start a second local workbench | `PORT=5174 npm run web` | Leaves the first workbench running and starts an independent local page. |
| Convert one `.tex` or `.tikz` file | `node bin/tikz2svg.js path/to/source.tex -o outputs/source.svg` | Writes one clean TikZKit SVG without the visual-QA grid. |
| Check every maintained fixture semantically | `npm run gallery:audit` | Verifies parse/evaluation diagnostics for the catalog; it is not a pixel-parity check. |
| Compare one real case visually | `npm run examples:render -- --fixtures test/fixtures/examples --output outputs/qa-case --only <fixture-id> --native-reference --comparison-grid-mode svg` | Generates TikZKit, local MacTeX, and `tikztosvg` artifacts in one ignored directory. Run `npm run examples:diff -- --output outputs/qa-case` next. |

The browser needs no TeX installation. The comparison workflow does: MacTeX,
`tikztosvg`, and `rsvg-convert` are local development references, never browser
runtime dependencies. Generated `outputs/qa-*` pixels are intentionally kept
out of commits; commit the source fixture, shared implementation, regression,
and written QA conclusion instead.

### 3D Quiver Vectors

The supported `\addplot3` quiver slice accepts the source position as the plot
expression, `quiver/u`, `quiver/v`, `quiver/w`, and `scale arrows`. Its range
survey includes every vector start and, by default, the scaled vector end, so
the 3D box, grid, ticks, and arrow plane are calculated together. Use
`update limits=false` only when PGFPlots should exclude endpoints from the
axis range.

```tex
\begin{axis}[domain=-90:90, y domain=-90:90, samples=15]
  \addplot3[/pgfplots/quiver,
    quiver/u={sin(x)}, quiver/v={cos(y)}, quiver/w=0,
    quiver/scale arrows=4, -stealth] {-4};
\end{axis}
```

This remains a focused implementation: point-meta coloring, arbitrary
`every arrow` TikZ styles, stream/table quiver handlers, logarithmic 3D
survey semantics, and every PGFPlots clipping interaction are still partial.

### Groupplots Outer Descriptions

The focused `groupplots` implementation retains only the requested outer
descriptions and moves their tick labels to the selected edge. In particular,
`x descriptions at=edge top` uses upper tick labels on the top row and
`y descriptions at=edge right` uses right tick labels on the right column.
As in local PGFPlots, the `xlabel` and `ylabel` anchors themselves remain in
their normal shared-gap positions.

The executable real-case fixture is
`test/fixtures/examples/pgfplots/groupplots-edge-descriptions-top-right.tex`.
Check its semantics with:

```sh
node --test test/pgfplots-groupplots.test.js
```

Then generate the browser SVG, local MacTeX raster, and `tikztosvg` reference
using the visual-QA command in [Choose A Workflow](#choose-a-workflow). This
is a partial library slice: nested group styles, `trim axis group`, and the
remaining shared-description combinations still need source-driven QA.

### The Smallest Reliable Loop

For a new diagram, start with the browser. For a renderer change, keep the
same source as a named fixture and use the visual workflow before treating the
result as compatible. This is the shortest repeatable path:

```bash
# 1. Fast local editing: JavaScript only.
npm run web

# 2. Inventory exactly what the real source asks TikZKit to understand.
npm run case:audit -- path/to/diagram.tex \
  --output outputs/qa-diagram/audit.md \
  --init-review outputs/qa-diagram/review.json

# 3. When the source is a maintained fixture, create the three references.
npm run examples:render -- --fixtures test/fixtures/examples \
  --only <fixture-id> --output outputs/qa-diagram \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-diagram \
  --register --alignment-radius 3
```

Open `outputs/qa-diagram/index.html` and compare the **TikZKit** and
**tikztosvg** panels first, then use the **MacTeX** panel as the acceptance
oracle. The grid helps identify a shifted origin or scale, but it cannot prove
that text anchors, clipping, arrow tips, or draw order are correct. If a
feature is still visibly different, it remains incomplete even when no
diagnostic is reported.

### Formula And Matrix Sizing

Formula boxes participate in node dimensions, label anchors, clipping, and
PGFPlots legend frames. For common inline `matrix`/`pmatrix` expressions,
TikZKit uses Computer Modern's actual standard LaTeX design sizes (`5pt`,
`7pt`, `8pt`, `9pt`, and `10pt`) instead of scaling a 10pt matrix
geometrically. This includes the fixed `\arraycolsep` column gap and focused
math advances such as the italic correction of `U` and the native math minus.

This is a compatibility slice, not a generic TeX math-layout engine. Before
relying on an unfamiliar formula, use a focused comparison with a real source;
the following command also checks the regression cases for tiny legend
matrices and normal inline node matrices:

```bash
node --test --test-name-pattern='pmatrix|Computer Modern design sizes' \
  test/convert.test.js test/svg-renderer.test.js test/pgfplots-seams.test.js
```

### Reference Order

The three renderers have different roles. When they disagree, do not tune
TikZKit to the first SVG that happens to look plausible:

1. **MacTeX native output is the acceptance oracle.** It owns the TikZ/PGF
   semantics, geometry, crop, font decisions, and paint order that TikZKit is
   trying to reproduce.
2. **TikZKit is the implementation under test.** Compare its SVG and PNG to
   the native panel after checking the source inventory and diagnostics.
3. **`tikztosvg` is an independent SVG reference, not a tie-breaker.** It is
   very useful for inspecting path structure, transforms, and browser-facing
   SVG output, but a library or advanced key can legitimately differ from
   current PGF.
4. **The diff is a locator, not a verdict.** Inspect the rendered panels for
   missing elements, origin/scale, arrows, labels, clipping, and layer order.

For example, the maintained `latex-examples-feed-forward-perceptron` driver
uses `arrows={{Latex[scale=0.5]}-}` on circular nodes. Its local MacTeX output
and TikZKit share the same physical canvas and PGF `Latex` tip geometry, while
the local `tikztosvg` output can crop the diagram more tightly. That difference
is evidence to inspect the feature, not a reason to make TikZKit diverge from
native PGF. Record this kind of finding in `docs/qa/` with the exact command
and artifact directory before accepting a renderer change.

### Commit A Verified Change

Keep one commit to one accepted capability slice. Before staging, run the
focused test and the catalog semantic gate, regenerate the affected visual-QA
directory, and inspect its panels. A normal compatibility commit contains only
the shared implementation, a regression test, the source fixture, the registry
entry, and its `docs/qa/` record:

```bash
npm test -- test/<focused-test>.test.js
npm run gallery:audit
git diff --check
git status --short
```

Do not stage `outputs/`, `output/`, browser screenshots, or generated
reference PNG/SVG files. They are reproducible evidence rather than source;
the checked-in fixture plus the command and findings in `docs/qa/` are the
durable review record.

### What A Result Means

TikZKit deliberately keeps three different outcomes separate. This matters
when deciding whether a diagram is ready to rely on:

| Result | Meaning | What it does **not** prove |
| --- | --- | --- |
| **Rendered** | The JavaScript parser and interpreter produced an SVG without a diagnostic for that source. | Native TikZ geometry, fonts, crop, or package semantics match. |
| **Reference generated** | TikZKit, local `tikztosvg`, and optionally MacTeX artifacts were produced in one QA directory. | The panels were visually inspected or judged acceptable. |
| **Accepted feature slice** | A shared implementation change has a focused regression test, no new diagnostics, and an inspected real-case comparison recorded under `docs/qa/`. | The whole package or every possible TikZ option is implemented. |

Use the workbench for the fast edit-render loop. Use the reference workflow
before accepting a visual change. A small image difference can be ordinary
font rasterization; a low difference alone does not prove that coordinates,
clipping, arrows, labels, or layering are correct.

### First Real-Case Review

This is the recommended end-to-end loop for one catalog fixture. It keeps all
generated files together while leaving the repository clean:

```bash
# Start the browser editor (a second copy can use PORT=5174).
npm run web

# Inspect the source's commands, libraries, options, literals, and diagnostics.
npm run case:audit -- \
  test/fixtures/examples/latex-examples/feed-forward-perceptron.tex \
  --output outputs/qa-feed-forward/audit.md \
  --init-review outputs/qa-feed-forward/review.json

# Create the JavaScript, tikztosvg, and native MacTeX reference bundle.
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-feed-forward \
  --only latex-examples-feed-forward-perceptron \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-feed-forward \
  --register --alignment-radius 3
```

Open `outputs/qa-feed-forward/index.html` for the JS and `tikztosvg` panels.
The same directory also contains `mactex-png/` and
`diff/<fixture-id>-native-sheet.png` for the four-way inspection. Check the
source against its package/library contract in `docs/extension-registry.md`,
then record a narrow conclusion in `docs/qa/` before declaring a feature
accepted.

### Audit A Batch Without Losing Failure Evidence

For a milestone-sized review, retain strict reference requirements but let the
renderer finish every requested case. The command writes `summary.json`, one
`tikztosvg-log/<case-id>.log` per unavailable reference, and an `index.html`
whose header and cards show the exact TikZKit, `tikztosvg`, and MacTeX status.
It still exits nonzero when `tikztosvg` fails, so it cannot be mistaken for a
passing acceptance run:

```bash
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-milestone-30 \
  --only "$(node -e 'const m=require("./test/fixtures/examples/milestone-1.json"); console.log(m.caseIds.slice(0,30).join(","))')" \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure --external-timeout-ms 30000
```

Use this mode to choose the next implementation slice from concrete failed
references and visual panels. A failed reference can be an unavailable local
tool or an oracle timeout; it is not, by itself, proof that TikZKit rendered
the source incorrectly.

### Retry A Heavy 3D Reference

The batch command above intentionally uses a 30-second external-reference
limit so one unusually expensive case cannot hide the rest of the report. A
high-sample PGFPlots surface can legitimately need longer on the local TeX
toolchain. For example, the original 60-sample
`latex-examples-3d-gaussian-distribution` source completes in the local
TikZKit, `tikztosvg`, and MacTeX renderers with a two-minute reference limit:

```bash
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-3d-gaussian \
  --only latex-examples-3d-gaussian-distribution \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-3d-gaussian \
  --register --alignment-radius 3
```

Keep the original source and its sampling contract intact when retrying. Do
not lower `samples` merely to make the reference command finish: that would
change the visual target rather than diagnose it.

For the supported `gnuplot[raw gnuplot]` numerical subset, the disposable
MacTeX reference source uses the same bounded coordinate lowering as TikZKit
and `tikztosvg`. This produces an inspectable native PNG when `gnuplot` is not
installed, without turning on TeX shell escape. The original fixture stays
unchanged; unsupported gnuplot programs remain explicitly reported as failed
MacTeX references.

### Current Visual Checkpoint

`latex-examples-feed-forward-perceptron` is the maintained reference case for
stroked circular nodes with a start-point `Latex[scale=0.5]-` arrow. It checks
that TikZKit keeps the same physical SVG canvas as the local reference, so the
browser renderer does not rescale the whole diagram because a circle outline
extends past its calculated bounds. Re-run the commands above with the same
fixture whenever changing node geometry, arrow tips, or SVG bounds.

This is a verified compatibility slice, not a claim that all TikZ arrow or
shape combinations are complete. Keep using the per-case audit and visual
comparison workflow while the project remains under active testing.

### Curved Arrow Terminal Check

`latex-examples-artificial-neuron` is the focused real case for a curved
`to[out=...,in=...]` arrow which ends at a circular node. TikZKit now moves a
terminal arrow crop out by half of the active path width after the node's outer
separation. This keeps the tip clear of the visible circle outline without
changing straight arrows or rectangular/polygon node borders.

```bash
node --test --test-name-pattern='clips curved to-path arrows|extends curved arrow tips|attaches bend edges|keeps arrow endpoints' \
  test/interpreter.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-curved-arrow-terminal \
  --only latex-examples-artificial-neuron,latex-examples-agent-environment-diagram-pomdp,latex-examples-doubly-linked-list,latex-examples-hidden-markov-model-abc-2 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-curved-arrow-terminal \
  --register --alignment-radius 3
```

Inspect `diff/latex-examples-artificial-neuron-native-sheet.png`: the five
arrow tips entering the central circle should end just outside the black
outline, like the `tikztosvg` and MacTeX panels. Ellipses use the same terminal
padding. Arbitrary shapes, tip-specific separation keys, and every PGF arrow
declaration are still partial.

### Regular Polygon Geometry Check

`arrows-regular-polygon-curved-terminal` is the focused check for
`\usetikzlibrary{shapes.geometric,arrows.meta}`. A regular polygon now follows
PGF's circumcircle interpretation of `minimum size`; even-sided polygons start
with a flat top, while odd-sided polygons start at the upward corner.
`shape border rotate` (and the common `regular polygon rotate` alias) rotates
that border. Curved terminal arrows meet the rotated side after the matching
outer-separation mitre extension.

```bash
node --test --test-name-pattern='regular polygon|clips curved to-path arrows|extends curved arrow tips' \
  test/interpreter.test.js test/svg-renderer.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --only arrows-regular-polygon-curved-terminal \
  --output outputs/qa-regular-polygon \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --tikztosvg-engine pdflatex
npm run examples:diff -- --output outputs/qa-regular-polygon \
  --register --alignment-radius 3
```

This is deliberately a regular-polygon slice. Rectangle, diamond, star,
trapezium, custom-shape anchors, and per-tip padding/separation keys remain
partial; do not infer full PGF border-anchor compatibility from this case.

### Transform Canvas Check

`transform-canvas-manual` is the maintained PGF manual fixture for backend
canvas transforms. It verifies that `transform canvas={scale=...}` and
`transform canvas={rotate=...}` are applied after ordinary TikZ coordinate
transforms, while PGF-style automatic picture-size tracking stays disabled for
the transformed items. Run the focused test and inspect the three local
renderers with:

```bash
node --test --test-name-pattern='transform canvas' test/petarv-compat.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-transform-canvas \
  --only transform-canvas-manual \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-transform-canvas
```

Open `outputs/qa-transform-canvas/index.html` and confirm that the grid and
blue scaled path align across TikZKit, `tikztosvg`, and local MacTeX. The red
rotated path is intentionally outside the normal picture bbox, so native PGF
and TikZKit crop it rather than expanding the SVG canvas.

### PGFPlots Tickless Middle-Axis Check

`test/fixtures/pgfplots-middle-axis-empty-ticks.tex` is the focused regression
case for `axis lines=middle` with both `xtick=\empty` and `ytick=\empty`.
PGFPlots keeps its documented 45pt plot-description reserve while the final
SVG crop should contain only real arrow, stroke, and plot-mark paint bounds.

```bash
node --test --test-name-pattern='middle-axis plot area|tickless middle axes' \
  test/extensions.test.js test/pgfplots-seams.test.js

npm run examples:render -- --fixtures test/fixtures \
  --only pgfplots-middle-axis-empty-ticks \
  --output outputs/qa-pgfplots-tickless-middle-axis \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfplots-tickless-middle-axis \
  --register --alignment-radius 3
```

Inspect `outputs/qa-pgfplots-tickless-middle-axis/diff/pgfplots-middle-axis-empty-ticks-native-sheet.png`.
The checked local reference is approximately `270.97pt × 56.57pt`; this is a
crop and arrow-paint rule only. Tick labels, titles, legends, 3D axes, and
general multi-axis layouts remain separate partial PGFPlots capabilities.

### PGFPlots Plot References In Formula Nodes

TikZKit now supports one narrow, inspectable PGFPlots cross-reference path in
the portable SVG-text renderer. When a direct `\label{name}` follows a
supported `\addplot`, an inline `\ref{name}` inside a formula array can show
the plot's 0.6cm legend-line sample instead of `??`. The sample preserves the
resolved line color, width, dash pattern, cap, and join. This is useful for
piecewise definitions whose formula node documents the plots beside it:

```tex
\addplot[blue, ultra thick] {1};
\label{plot one}
\addplot[red, densely dashed] {0};
\label{plot two}

\node { $f(x)=\left\{\begin{array}{lll}
  \tikz[baseline=-.5ex]\node{\ref{plot one}}; \phantom{1cm} & 1 & x\in\mathbb Q\\
  \tikz[baseline=-.5ex]\node{\ref{plot two}}; & 0 & x\in\mathbb R\setminus\mathbb Q
\end{array}\right.$ };
```

Run the focused test and visual inspection together:

```bash
node --test --test-name-pattern='PGFPlots direct plot labels|real Dirichlet' \
  test/pgfplots-seams.test.js test/renderer.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-pgfplots-plot-ref \
  --only latex-examples-dirichlet-function \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-pgfplots-plot-ref \
  --register --alignment-radius 3
```

This does **not** implement general LaTeX cross references: labels with
scatter classes, custom `legend image code`, Beamer prefixes, auxiliary-file
reuse across runs, and arbitrary external `\ref` values remain partial. The
reference artifact should still be inspected because browser font metrics can
make the enclosing formula frame slightly different from MacTeX.

### 使用速览

用下面这条最短路径就可以开始。浏览器页面只运行 TikZKit 的 JavaScript
解释器；它不会悄悄调用本机 TeX。只有在需要判断是否接近原生 TikZ 时，才
执行本地参考渲染。

```bash
# 1. 安装并打开本地编辑器。
npm install
npm run web

# 2. 在浏览器打开 http://127.0.0.1:5173/，选择一个案例或直接编辑源码。
#    点击 Render 后，“Semantic inventory”会重新审计当前编辑内容，列出实际出现的
#    package/library、命令、环境、参数、定义、数值和表达式；再次编辑后会提示重新渲染。

# 3. 将单个源文件转换成可嵌入的 SVG。
node bin/tikz2svg.js path/to/diagram.tex -o outputs/diagram.svg

# 4. 修改渲染逻辑后，先检查维护中的案例没有新增诊断。
npm run gallery:audit
```

要验证一个视觉改动，使用该案例在清单中的完整 fixture ID，例如
`decorations-snake-arrow-lengths` 或 `decorations-zigzag-native-state`。下面的命令会把 JavaScript SVG/PNG、
`tikztosvg` SVG/PNG、可选的 MacTeX 原生 PNG 和差异面板写入同一个忽略的
`outputs/qa-*` 目录：

```bash
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-snake \
  --only decorations-snake-arrow-lengths \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-snake --register --alignment-radius 3
```

打开 `outputs/qa-snake/index.html` 查看并排结果。接受一次兼容性改动前，既要
通过相关窄测试，也要实际查看 JS、`tikztosvg`、MacTeX 与 diff 面板；不要只
根据“页面能显示”或单一 diff 数值下结论。

`zigzag` 已覆盖本机 PGF 的首个四分之一 segment 尖峰、交替的半 segment 状态、
`center finish` 收尾，以及完整折线路径上的相位连续性。可直接使用
`pre length`、`segment length`、`amplitude`、`post length` 和终端箭头：

```tex
\usetikzlibrary{decorations.pathmorphing}
\draw[-stealth, decorate,
  decoration={zigzag,pre length=2mm,segment length=8mm,
    amplitude=1.5mm,post length=3mm}]
  (0,0) -- (2.15,0) -- (2.15,1.25) -- (5.5,1.25);
```

用 `node --test test/zigzag-decoration.test.js` 检查状态机顶点与折角相位，并用
`decorations-zigzag-native-state` 生成三方视觉对照。尖锐折角的法线过渡和任意曲线
的精确 PGF 展平仍在测试中，不应当作完整 path-morphing 兼容承诺。

旧文档中仍可见 `\usetikzlibrary{snakes}`。它和上面的现代 `decorate` 写法不同：
`snake` 会让每一条 `--` 独立开始一个旧式状态机。当前支持默认 `snake`（旧式
`zigzag`）、`snake=snake`、`segment amplitude`、`segment length`、`mirror snake`、
`raise snake`，以及 `line/gap before|after|around snake`：

```tex
\usetikzlibrary{snakes}
\draw[snake,segment length=4mm,segment amplitude=1mm,
  line before snake=5mm,line after snake=4mm,
  mirror snake,raise snake=.4mm,-stealth]
  (0,0) -- (4,0) -- (4,2);
```

这只是兼容层，不接受任意 `\pgfdeclaresnake` 状态或旧三角对象形状；请优先使用
`decorations.pathmorphing` 的现代 API。回归命令是
`node --test test/snakes-legacy-options.test.js`。

`bchart` 的横向柱图可用 `npm test -- test/bchart.test.js` 验证；当前支持
`\renewcommand{\bcfontstyle}{...}` 的零参数字体钩子，且 `scale` 只缩放几何、
不缩放文字。完整选项范围和三方对照命令见[使用指南](docs/usage.md#bchart-横向柱图)。

### Current validation scope

- A batch is only a triage run until every selected case has its JS,
  `tikztosvg`, MacTeX, and diff panel inspected. Successful generation of all
  reference files, a low aggregate diff, or a matching SVG canvas size does
  **not** mean that the batch is visually accepted.
- Use `npm run case:audit` before a change to inventory every package, library,
  command, option, macro, and numeric expression in the source. Then use the
  single-case commands in [使用指南](docs/usage.md#4-验证一个真实案例) to accept
  one clearly bounded behavior. Use the batch command only to find the next
  highest-impact visual discrepancy.
- A compatibility commit must name its accepted case and feature slice in
  `docs/qa/`, include a focused regression test, and leave generated
  `output/` and `outputs/` directories untracked. The project has no blanket
  “all examples are compatible” claim while it remains under active testing.
- Exact glyph hinting and antialiasing can still differ between browser SVG and
  PDF-to-SVG output even when geometry and text placement agree.
- `shapes.multipart` now verifies horizontal `rectangle split` alignment
  (`center`, `top`, `bottom`, `base`) and vertical alignment (`center`, `left`,
  `right`). Wide typewriter B-tree nodes use cmtt10 advance widths so repeated
  split-part anchors do not drift. `anchor=text` and `(node.text)` use the
  first visible text-part origin, including nodes with `rectangle split ignore
  empty parts`; the broader multipart shape family remains partial.
- The array compatibility slice can lower a marked top-level tabular into a
  TikZ matrix, preserving vertical rules and single/double hline rules so a
  same-picture tikzmark overlay can resolve its anchors. It is not a general
  TeX table implementation: complex column preambles, multicolumn, multirow,
  and native cross-picture remember-picture cropping remain unsupported.
- A standalone display-math `array` with internal `tikzmark` anchors can also
  be lowered to a math-node matrix and used by a same-picture `fit` overlay.
  This preserves the array's practical column glue, ordinary math glyph size,
  `fit` minimum dimensions, and parenthesis delimiters for the reviewed Jordan
  block case. It does not implement arbitrary TeX `array` glue, page-level
  remembered-picture coordinates, or rotated `fit` transformations.
- `shapes.misc` now verifies the `cross out` and `strike out` foreground-path
  slice against the inherited rectangle-anchor model: each diagonal reaches
  the anchor corners after automatic or explicit `outer sep`, and those
  extents participate in the SVG picture bounding box. This is intentionally
  narrower than the full `shapes.misc` library.
- PGFPlots legend rows with `legend cell align=left` retain their shared left
  anchor when the browser uses its cached SVG text engine. Formula-heavy and
  tiny `pmatrix` legend frames are also calibrated against local `tikztosvg`
  output in `activation-functions` and `faktorraum`. Custom multi-column
  legends, arbitrary font combinations, and final browser/TeX bbox parity
  remain partial.
- The SVG-text fallback used by non-HTML converters keeps paired math scripts
  such as `x_{k+1}^{(P)}` on explicit upper and lower baselines, then restores
  the TeX cursor to the wider script. This is checked with the real
  `latex-examples-kalman-filter` node-local `align*` case. It improves the
  portable SVG/PNG artifact; it does not implement the complete `amsmath`
  environment family.
- Package and library support is intentionally partial unless documented
  otherwise. See [the 30-case acceptance record](docs/qa/latex-examples-new30.md)
  for tested commands, parameters, and remaining boundaries.
- The `3d` library now has a focused canvas-plane slice: `plane origin`,
  `plane x`, `plane y`, `canvas is plane`, and the six `canvas is ... plane at ...`
  shortcuts project ordinary paths through the active 3D basis. The cylindrical
  and spherical coordinate systems, plus full transform-order parity for complex
  same-scope affine option combinations, remain partial. Reproduce the checked
  manual driver and inspect the generated comparison page before relying on a
  broader 3D source:

  ```bash
  npm run examples:render -- --only 3d-canvas-planes \
    --native-reference --comparison-grid-mode svg
  ```

## Requirements And Quick Start

Required for JavaScript rendering:

- Node.js 20 or newer. The checked local environment uses Node.js 22.
- npm, to install the repository dependencies.

Optional, only for reference generation and visual QA:

- local MacTeX, for native TikZ output;
- local `tikztosvg`, for an independent SVG reference;
- `rsvg-convert`, for PNG comparison sheets.

Start the browser workbench from a clean checkout:

```bash
npm install
npm run web
```

Open `http://127.0.0.1:5173/`. To run a second workbench without stopping the
first one, choose another port:

```bash
PORT=5174 npm run web
```

Then open `http://127.0.0.1:5174/`.

The browser renderer has no server-side TeX dependency. MacTeX and
`tikztosvg` are used only to generate reference artifacts for comparison.

### Everyday Browser Workflow

The browser workbench is the fast feedback loop: choose a catalog case, edit
the source, then render it locally in JavaScript. Its output is always a
TikZKit SVG; it never executes TeX, reads arbitrary local files, or delegates
the render to MacTeX/`tikztosvg`.

When a source change is intended to improve compatibility, use the following
two gates in order:

1. Run `npm run gallery:audit` to check that the catalog still parses and
   evaluates without new diagnostics. This is a semantic gate, not a visual
   pass.
2. Render the affected fixture into one `outputs/qa-*` directory with
   `npm run examples:render -- --native-reference`, then run
   `npm run examples:diff`. Inspect the MacTeX, tikztosvg, TikZKit, and diff
   panels before accepting the change.

Keep the source fixture under version control; keep generated SVG/PNG sheets
under `outputs/`. The latter are intentionally ignored so a commit contains
the reusable parser, interpreter, renderer, test, and written QA conclusion,
rather than a pile of regenerated pixels.

### Test Status And Focused Checks

`npm test` runs the entire experimental suite. It is useful for exposing the
current compatibility baseline, but it is **not currently a green release
gate**: the 2026-08-05 baseline has 1557 passing tests, 90 known failures, and
14 skipped optional-corpus tests. Do not report the project as fully tested
from that command alone.

For a focused renderer change, run the narrow test file that owns the feature,
then regenerate and inspect a real visual case. For example, a multipart-node
change should run its split-node tests before the case comparison:

```bash
node --test test/interpreter.test.js test/shapes-multipart-vertical.test.js
```

### Datavisualization Legend Calibration

The maintained `datavisualization-legend-math-metrics` fixture is a narrow,
repeatable check for legends that give their labels a TikZ node style, for
example `legend={label style={node style=draw}}` or an entry-level
`node style={circle,draw=red}`. TikZKit measures the inline math with compact
TeX-style metrics for that layout decision, while the SVG math renderer remains
responsible for drawing the formula. This avoids an SVG line-box reserve making
the label frame wider than the local TeX reference.

Run the semantic and visual checks together:

```bash
node --test --test-name-pattern="compact datavisualization legend math metrics" test/extensions.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-datavis-legend \
  --only datavisualization-legend-math-metrics \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-datavis-legend \
  --only datavisualization-legend-math-metrics
```

Open `outputs/qa-datavis-legend/diff/datavisualization-legend-math-metrics-native-sheet.png`
and verify the styled label frames, sample paths, and axes. This checks a
specific legend-layout slice; complex legend matrices and the wider native
data-visualization survey pipeline remain partial.

For a `legend={south east outside}` scatter entry, use the maintained
`datavisualization-scatter-south-east-outside` fixture. Its legend is anchored
from the data-area south-east corner with the native `.8em` outside offset, so
changing the axis width must move the sample and its label together:

```bash
node --test --test-name-pattern="datavisualization function data" test/extensions.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-datavis-scatter-legend \
  --only datavisualization-scatter-south-east-outside \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-datavis-scatter-legend \
  --only datavisualization-scatter-south-east-outside
```

Inspect `outputs/qa-datavis-scatter-legend/diff/datavisualization-scatter-south-east-outside-native-sheet.png`.
The curve, random scatter samples, pin, one-mark sample, and the legend label
should agree in visible placement. Arbitrary multi-column legend matrices are
still outside this focused compatibility slice.

For a PGFPlots legend or cached text-placement change, use both the renderer
test and the legend lowering tests, then inspect the real chart rather than
accepting only text coordinates:

```bash
node --test --test-name-pattern='explicit SVG text anchors|legend cell alignment' \
  test/svg-renderer.test.js test/pgfplots-seams.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-2d-epochs-overfitting \
  --output outputs/qa-pgfplots-legend-anchor \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfplots-legend-anchor \
  --register --alignment-radius 3
```

Regenerate the extension registry after a package or library implementation
change:

```bash
npm run extension-registry
```

### Batch Gallery And Data Files

The maintained fixture manifest is also the input catalog for whole-gallery
checks. Cases that declare CSV or other table resources receive those exact
files during JavaScript rendering; native reference jobs materialize the same
relative file names in their isolated TeX work directories.

```bash
# Semantic gate: reports every fixture diagnostic.
npm run gallery:audit

# Write JS SVG/PNG output for all catalog fixtures (with a 1cm QA grid).
npm run gallery:js

# Optional, slower local-MacTeX reference batch.
npm run gallery:native
```

`gallery:audit` reports the current manifest count and diagnostics. Treat its
rendered count as generated evidence, not as a fixed README promise: fixtures
are added while the renderer is being calibrated. A clean audit is a semantic
gate only; it does not certify pixel-level parity. These commands use only the resources declared in
`test/fixtures/examples/manifest.json`; they do not grant browser-authored
TikZ arbitrary filesystem access. For a visual three-way review of one case,
including MacTeX, `tikztosvg`, PNG conversion, grids, and a diff sheet:

```bash
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-case-name \
  --only latex-examples-csv-line-plot-two-axes \
  --native-reference --comparison-grid-mode svg \
  --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-case-name
```

Generated `outputs/` directories are QA evidence and are intentionally ignored
by Git. Review the native comparison sheet before treating a case as visually
aligned; a zero-diagnostic audit alone only confirms that the input resource
and supported syntax were processed.

### PGFPlots Patchplots Slice

The `patchplots` library is deliberately partial. The maintained fixtures
cover the linear 3D patch families: `patch type=line` projects each ordered
pair as one open mapped-color segment, while `patch type=triangle` and
`patch type=rectangle` project ordered triples or quadruples into closed
faces. Faces support an explicit `fill`, opacity, painter ordering, and the
native-like faceted mesh outline.

```tex
\usepackage{pgfplots}
\usepgfplotslibrary{patchplots}
\begin{tikzpicture}
  \begin{axis}[view={45}{30}, xmin=0, xmax=2, ymin=0, ymax=2, zmin=0, zmax=2]
    \addplot3[patch, patch type=line, line width=1.2pt]
      coordinates {(0,0,0) (2,2,2)};
  \end{axis}
\end{tikzpicture}
```

Tables, per-vertex point meta, `shader=interp`, quadratic/biquadratic/Coons
patch types, custom patch declarations, and PDF shading are not implemented.
See [the line-patch QA record](docs/qa/2026-08-06-pgfplots-patchplots-line.md)
for the exact local-reference comparison and acceptance boundary.

### PGFPlots Groupplots Slice

The `groupplots` library supports a focused 2D grid layout. `group size`,
`horizontal sep`, `vertical sep`, `group name`, `group/every plot`,
`group/plot c<column>r<row>/.style`, and `group/empty plot` are accepted.
Placements are calculated from each rendered plot box, so a later column starts
from the previous axis's east edge rather than from the requested outer
`width`. The named anchors can be used after the group:

```tex
\usepackage{pgfplots}
\usepgfplotslibrary{groupplots}
\begin{tikzpicture}
  \begin{groupplot}[
    group style={
      group name=measurements,
      group size=2 by 2,
      horizontal sep=0.5cm,
      vertical sep=0.5cm,
      x descriptions at=edge bottom,
      y descriptions at=edge left
    },
    width=4cm, height=3.5cm, xmin=0, xmax=2, ymin=0, ymax=2,
    xlabel={time}, ylabel={concentration}, grid=major
  ]
    \nextgroupplot \addplot coordinates {(0,0) (1,2) (2,1)};
    \nextgroupplot \addplot coordinates {(0,0) (1,1) (2,2)};
    \nextgroupplot \addplot coordinates {(0,2) (1,1) (2,1)};
    \nextgroupplot \addplot coordinates {(0,2) (1,0) (2,1)};
  \end{groupplot}
  \draw[magenta] (measurements c1r1.east) -- (measurements c2r1.west);
\end{tikzpicture}
```

`x/y labels at=edge ...`, `x/y ticklabels at=edge ...`, and the combined
`x/y descriptions at=edge ...` modes suppress the inner text and retain it
only on the requested outer edge. This remains a partial library: trimming,
the full shared-label matrix, arbitrary nested PGF key styles, and all
cross-group coordinate features are not yet complete. See
[the groupplots QA record](docs/qa/2026-08-07-pgfplots-groupplots-shared-layout.md)
for the local MacTeX and tikztosvg comparison.

### Beamer Sources

TikZKit emits one SVG per source. For a Beamer document with multiple
`frame` environments, it keeps the complete preamble and renders the first
frame only. This matches the local reference workflow, which rasterizes page 1
of the Beamer PDF, and prevents later slides from being merged into the same
SVG. Presentation wrappers such as `figure` and `center` are ignored around
the selected drawing. Frame titles, overlays, slide navigation, and rendering
all slides as separate SVGs are not implemented yet.

## Visual Compatibility Contract

TikZKit is developed as an interpreter, not by matching isolated PNG pixels.
Every accepted compatibility change must have a narrow feature boundary and a
real source case. The expected loop is:

1. Inspect the exact TikZ source and its semantic inventory. Account for every
   package, library, command, environment, style, parameter, macro, and numeric
   expression used by the selected case.
2. Read the corresponding local MacTeX/TeX Live implementation or manual
   before changing TikZKit semantics.
3. Generate the same source through MacTeX, `tikztosvg`, and TikZKit. Keep the
   SVG, PNG, and comparison sheet together in one ignored `outputs/qa-*`
   directory.
4. Inspect the visible panels for missing objects, coordinate drift, bounding
   boxes, fonts, labels, arrows, clipping, colors, layer order, and line
   weights. Pixel statistics are only triage data.
5. Add a shared regression test, make the smallest semantic/renderer change,
   regenerate the artifacts, and confirm a visible improvement without new
   diagnostics.
6. Record the source review, artifacts, supported subset, and remaining limits
   in `docs/extension-registry.csv` and a focused file under `docs/qa/`.

A source that merely produces SVG is not accepted as compatible. A case can be
called visually aligned only after the three-way inspection confirms that its
remaining difference is rasterization rather than missing or displaced TikZ
semantics.

### Render A Source File

For a standalone `.tikz` snippet or `.tex` document, use the CLI:

```bash
node bin/tikz2svg.js examples/diagram.tex -o outputs/diagram.svg
```

Use `--strict` when a warning must fail the conversion, and `--svg-text-math`
when the SVG must avoid `foreignObject` math output:

```bash
node bin/tikz2svg.js examples/diagram.tex -o outputs/diagram.svg --strict --svg-text-math
```

Run `node bin/tikz2svg.js --help` for the complete CLI options.

### PGFPlots Raw Gnuplot Subset

For browser safety, `gnuplot[raw gnuplot]` is interpreted as a bounded numeric
language and lowered to ordinary coordinates. It supports one plot expression,
numeric constants, one-expression functions, `set xrange`, `set yrange`, and
`set samples`; it does not execute a local gnuplot process or arbitrary
JavaScript.

```tex
\begin{axis}[grid=major]
  \addplot[blue, very thick] gnuplot[raw gnuplot] {
    gain = 2;
    envelope(t) = exp(-abs(t));
    set xrange [-6:6];
    set samples 121;
    plot gain * envelope(x)
  };
\end{axis}
```

Supported numeric functions include trigonometric functions, `sqrt`, `exp`,
logarithms, `min`, `max`, `gamma`, `lgamma`, and `igamma`. Multi-plot scripts,
3D/parametric programs, gnuplot file I/O, shell commands, strings, and
unsupported gnuplot functions remain unsupported. See
[`docs/qa/2026-08-06-pgfplots-raw-gnuplot.md`](docs/qa/2026-08-06-pgfplots-raw-gnuplot.md)
for the checked local-MacTeX boundary and visual-QA caveat.

### pgfplotstable Basic Table Typesetting

`\pgfplotstabletypeset` now renders its small, document-level table subset
instead of being ignored. It accepts inline data or a table registered with
`\pgfplotstableread`, detects a normal header row, supports
`col sep=space|comma|tab|&`, `columns={...}`, and
`columns/<name>/.style={column name=...}`. The output is measured through the
same renderer-neutral `tabular` scene layout used for other text tables, with
the default plain-integer thousands grouping (for example `2021` becomes
`2,021`).

For a selected column, the focused number-printer subset also supports
`int detect`, `fixed`, `fixed zerofill`, `sci`, `sci zerofill`, `sci subscript`,
`sci superscript`, the controlled `sci generic` subset, `precision`,
`sci precision`, and `use comma`. For example:

```tex
columns/value/.style={
  column name=Value,
  fixed,fixed zerofill,precision=3
}
columns/error/.style={
  column name=Error,
  sci,sci zerofill,sci precision=2
}
```

For a fixed decimal column, `dec sep align` gives every supported numeric cell
the same decimal anchor. The table header remains a single centered cell, as in
the native `r@{}l` implementation:

```tex
columns/value/.style={
  column name=Measured,
  fixed,fixed zerofill,precision=2,
  dec sep align
}
```

This currently covers fixed numeric values that actually contain the selected
decimal separator, including the `use comma` variant. `dcolumn` and TeX's
special multi-column behavior for values without a separator are still outside
this subset.

For supported scientific output, `sci sep align` anchors the start of the
exponent block across a column. It keeps `\cdot 10^0` when the exponent is zero,
which is important for matching the native aligned table form:

```tex
columns/value/.style={
  column name=Power,
  sci,sci precision=2,
  sci sep align
}
```

`sci subscript` emits the native compact form `1.00_{-3}` (including
`0.00_{0}` for zero), while `sci superscript` emits `1.00^{-3}`
(including `0.00^{0}`). Both replace the standard
`1.00\cdot10^{-3}` printer. They can be combined with `sci sep align`
without corrupting the output, but native PGF does not split either direct
script form at an exponent marker, so each remains one whole table cell rather
than gaining a shared exponent anchor:

```tex
columns/value/.style={
  column name=Script,
  sci,sci zerofill,sci precision=2,
  sci superscript,sci sep align
}
```

`sci generic` accepts the locally documented data templates `mantissa sep`,
`empty mantissa sep`, and `exponent`. TikZKit substitutes the literal `#1`
exponent argument; it does not execute arbitrary TeX callbacks. This covers a
custom multiplication form and the native omission of a unit mantissa:

```tex
columns/value/.style={
  sci,sci zerofill,sci precision=2,
  retain unit mantissa=false,
  sci generic={
    mantissa sep={\,\times\,},
    empty mantissa sep={},
    exponent={10^{#1}}
  }
}
```

The accepted scope is the standard `sci` presentation (and the existing
scientific branch of `int detect`) plus `sci subscript` and
`sci superscript`, together with the described `sci generic` templates.
Generic `#2`/`#3` callbacks, arbitrary template ordering, `dcolumn`, and
non-finite special values remain outside it.

```tex
\pgfplotstabletypeset[col sep=comma, columns={year,vehicles}] {
year,vehicles,share
2021,642,2.1
2022,904,2.8
}
```

External table files, full PGF number formatting, alternate scientific styles,
printer-order interactions, postprocessing, and arbitrary row/column styles
remain partial. See
[`docs/qa/2026-08-06-pgfplotstable-typeset.md`](docs/qa/2026-08-06-pgfplotstable-typeset.md)
and
[`docs/qa/2026-08-06-pgfplotstable-number-formats.md`](docs/qa/2026-08-06-pgfplotstable-number-formats.md)
and
[`docs/qa/2026-08-06-pgfplotstable-dec-sep-align.md`](docs/qa/2026-08-06-pgfplotstable-dec-sep-align.md)
and
[`docs/qa/2026-08-06-pgfplotstable-sci-sep-align.md`](docs/qa/2026-08-06-pgfplotstable-sci-sep-align.md)
and
[`docs/qa/2026-08-06-pgfplotstable-sci-subscript.md`](docs/qa/2026-08-06-pgfplotstable-sci-subscript.md)
and
[`docs/qa/2026-08-06-pgfplotstable-sci-superscript.md`](docs/qa/2026-08-06-pgfplotstable-sci-superscript.md)
and
[`docs/qa/2026-08-06-pgfplotstable-sci-generic.md`](docs/qa/2026-08-06-pgfplotstable-sci-generic.md)
for the local-source notes and visual acceptance records.

To verify this supported slice locally, run:

```bash
npm test -- test/pgfplotstable-typeset.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-pgfplotstable --only pgfplotstable-sci-generic \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfplotstable --register --alignment-radius 3
```

Open `outputs/qa-pgfplotstable/index.html` to compare the JavaScript and
`tikztosvg` SVG panels; the same directory retains the native MacTeX panel and
the comparison sheet. This is a focused compatibility check, not evidence that
all `pgfplotstable` formatting is complete.

### PGFPlots 3D Axis Bounds

The supported 3D subset lowers the surface, projected box, grid, ticks, and
axis descriptions to ordinary SVG elements. Tick-scale labels such as
`10^10` are rendered as real text and participate in the tight SVG bounds;
TikZKit does not add a second invisible margin for the same label. This is
important when an explicit `width` is used, because the otherwise duplicated
reserve leaves an obvious blank strip above the plot.

The check in
[`docs/qa/2026-08-06-pgfplots-3d-axis-bounds.md`](docs/qa/2026-08-06-pgfplots-3d-axis-bounds.md)
uses `3d-cmos-loss-diagram` and `3d-gradient-cos` against local MacTeX and
`tikztosvg`. It validates shared 3D axis geometry, not a full implementation
of every PGFPlots 3D feature. Per-view projection calibration, exact TeX text
metrics, and advanced 3D plot handlers remain partial.

Axis titles now use the top edge of the complete projected 3D box, not the
top-face midpoint. This prevents a title from overlapping a surface and makes
its real SVG text bounds participate in cropping. The focused comparison for
`color-blind-friendly-mesh-colormap` is recorded in
[`docs/qa/2026-08-06-pgfplots-3d-title-placement.md`](docs/qa/2026-08-06-pgfplots-3d-title-placement.md).

Vertical 3D colorbars now plan their default labels from the colorbar's own
rendered height. This mirrors the native child-axis rule of a 35pt target tick
spacing and a generic `try min ticks=4` floor, so a short 50-unit colorbar can
correctly show `-20`, `0`, and `20` rather than five crowded labels. Explicit
`ytick={...}` remains authoritative. Horizontal/left colorbars, arbitrary
tick-label formatters, and the full standalone colorbar-axis pipeline remain
partial. The checked real fixture and reproduction steps are in
[`docs/qa/2026-08-06-pgfplots-colorbar-auto-ticks.md`](docs/qa/2026-08-06-pgfplots-colorbar-auto-ticks.md).

For a default-perspective 3D `axis` without an explicit `width`/`height` or a
colorbar, TikZKit also reserves the real browser text box of the projected
`x`/`y` tick labels. This preserves the native lower edge of ordinary
Computer-Modern labels while keeping `z` labels tight. It is intentionally a
default-layout calibration, not a general replacement for PGF's oriented
`near <axis>ticklabel` machinery: explicit dimensions, colorbars, custom
tick-label styles, and arbitrary projections still need a focused reference
check. The executable real driver is `latex-examples-3d-manhattan-bar-plot`;
see
[`docs/qa/2026-08-07-pgfplots-3d-default-tick-label-box.md`](docs/qa/2026-08-07-pgfplots-3d-default-tick-label-box.md).

### PGFPlots 3D Plot Box Ratio

The browser renderer supports a focused `plot box ratio` subset for 3D
`axis` environments:

```tex
\begin{axis}[
  view={120}{35},
  plot box ratio={1}{2}{1},
  mesh
]
  \addplot3 {y};
\end{axis}
```

Finite positive numeric triplets in either `plot box ratio={1}{2}{1}` or
`plot box ratio=1 2 1` form scale the x/y/z projection basis before the
requested `width`/`height` fit. This is deliberately not a full PGFPlots 3D
transform implementation: macro/expression values, `view dir`, explicit
`x`/`y`/`z` vectors, and the broader `scale mode` family remain partial. The
local MacTeX/tikztosvg visual audit, its real fixture, and reproduction
commands are recorded in
[`docs/qa/2026-08-06-pgfplots-3d-plot-box-ratio.md`](docs/qa/2026-08-06-pgfplots-3d-plot-box-ratio.md).

### PGFPlots 3D Mesh Wireframes

For a 3D `axis` with `mesh`, TikZKit now renders the sampled matrix as
unfilled quadrilateral wireframes rather than as a mapped-color `surf`.
The focused slice supports a cycle or explicit plot color, `opacity`, explicit
or named line widths, and ordinary dash/cap/join path options:

```tex
\begin{axis}[mesh, no marks, samples=10, view={120}{35}]
  \addplot3 {y};
\end{axis}
```

The real `plot-box-ratio-3d` case is checked against local MacTeX and
`tikztosvg`: its blue grid has no colored face fills. This remains a bounded
subset: `shader` variants, per-vertex mapped colors, holes and non-rectangular
scanlines, patch input, z-buffer ordering, and exact 3D tick/text bounds are
still partial. See
[`docs/qa/2026-08-07-pgfplots-mesh-wireframe.md`](docs/qa/2026-08-07-pgfplots-mesh-wireframe.md).

### Circuitikz Voltage Notation

The current `circuitikz` support is intentionally a focused subset. The
following small circuit is covered by the browser renderer and the CLI:

```tex
\usepackage[siunitx,RPvoltages]{circuitikz}
\begin{circuitikz}[american]
  \draw (0,0)
    to[R=2<\ohm>, i=?, v=84<\volt>] (3,0)
    -- (3,2)
    to[C=$C_1$] (1.5,2)
    to[V<=$\SI{5}{\volt}$] (0,2)
    -- (0,0);
\end{circuitikz}
```

`siunitx` normalizes the common `\SI{...}{\volt}` and `<\ohm>` labels. In
`[american]` drawings, `RPvoltages` determines the polarity direction but keeps
`+/-` signs; in European notation the same voltage metadata is represented by
an external arrow. Resistors, capacitors, independent voltage sources, current
annotations, common inductor styles, and cute chokes are covered by focused
fixtures. Controlled sources and the standard battery plate families are also
covered. Independent waveform voltage sources and controlled sinusoidal
sources are covered through small verified slices; transformers, source fills,
and the broad
circuitikz component catalog remain partial.

For independent American `V` sources, the internal sign orientation follows
Circuitikz's `sources/symbol/sign rotation` key. The browser renderer supports
the native `default`, `auto`, `straight`, and numeric-angle forms, for example
`\ctikzset{sources/symbol/sign rotation=auto}`. This is limited to the built-in
`+/-` signs: custom `inner plus`/`inner minus` glyphs and source sign margins
remain unsupported. The local MacTeX/tikztosvg visual check is recorded in
[`docs/qa/2026-08-07-circuitikz-american-source-sign-rotation.md`](docs/qa/2026-08-07-circuitikz-american-source-sign-rotation.md).

### Circuitikz Tunable Inductors

The `vL` control arrow follows Circuitikz's source-defined `latexslim` tip,
rather than the ordinary TikZ `latex` marker. The focused European and American
slice accepts `inductors/modifier thickness` and
`bipoles/fix tunable direction`; the default arrow rises from bottom-left to
top-right, while `false` uses the historical descending direction. Cute
variable inductors retain their native fixed diagonal.

```tex
\usepackage{circuitikz}
\begin{circuitikz}
  \ctikzset{inductor=european}
  \draw (0,0) to[vL,l=$L$] (3,0);
  \ctikzset{bipoles/fix tunable direction=false,
    inductors/modifier thickness=.5}
  \draw (0,-1.5) to[vL,l=$L_{\mathrm{legacy}}$] (3,-1.5);
\end{circuitikz}
```

This remains a Circuitikz subset: arbitrary custom tunable tips and the full
inductor body/anchor catalogue are not yet implemented.

### Circuitikz Diode Bipoles

The browser renderer also has a verified, narrow diode-bipole slice. It keeps
the native diode body dimensions and labels for horizontal and vertical paths:

```tex
\usepackage{circuitikz}
\begin{circuitikz}
  \draw (0,0) to[D*,l=$D_{\mathrm{full}}$] (4,0);
  \draw (0,-1.5) to[Do,l=$D_{\mathrm{empty}}$] (4,-1.5);
  \draw (0,-3) to[sD*,l=$D_{\mathrm{Schottky}}$] (4,-3);
  \draw (5,0) to[leD*,l=$\mathrm{LED}$] (5,-3);
  \draw (6.5,-1.5) to[Do,diodes/scale=.65,
    diodes/fill=orange!30,l=$D_{\mathrm{small}}$] (9.5,-1.5);
  \draw (0,-4.5) to[tD-,l=$\mathrm{tunnel}$] (4,-4.5);
  \draw (5,-4.5) to[biD*,l=$\mathrm{bidirectional}$] (9,-4.5);
\end{circuitikz}
```

Supported in this slice: the documented full/empty aliases `D*` and `Do`,
the base `D` form, `sD*`/`sD` Schottky diodes, `leD*`/`leD` LEDs,
`diodes/scale`, `diodes/fill`, and `l=` labels. LEDs include the two native
outgoing emission arrows and put the label on their outer side. The additional
Zener/TVS, photo/laser, and varcap slices are documented below. Tunnel
`tD`/`tD*`/`tD-`, Shockley `shD`/`shD*`, and bidirectional `biD`/`biD*`
families have their native body geometry, `diodes/scale`, `diodes/fill`, and
horizontal/vertical placement in this same subset; tripoles and custom-diode
families remain partial.

The source fixture is
[`test/fixtures/examples/circuitikz/diodes.tex`](test/fixtures/examples/circuitikz/diodes.tex).
To reproduce its three-way visual check locally:

```bash
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-circuitikz-diodes --only circuitikz-diodes \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-circuitikz-diodes \
  --only circuitikz-diodes
```

Open `outputs/qa-circuitikz-diodes/index.html` and compare the TikZKit SVG,
`tikztosvg`, local MacTeX PNG, and difference panel. The source reading,
observed visual changes, and acceptance record are in
[`docs/qa/2026-08-06-circuitikz-diodes.md`](docs/qa/2026-08-06-circuitikz-diodes.md).
The extended-diode source and its three-way comparison are
[`test/fixtures/examples/circuitikz/extended-diodes.tex`](test/fixtures/examples/circuitikz/extended-diodes.tex)
and
[`docs/qa/2026-08-07-circuitikz-extended-diodes.md`](docs/qa/2026-08-07-circuitikz-extended-diodes.md).

### Circuitikz Zener and TVS Diodes

The diode slice also includes the shared cathode-whisker family used by Zener,
ZZener, and TVS (transorb) bipoles:

```tex
\begin{circuitikz}
  \draw (0,0) to[zD*,l=$Z$] (3,0);
  \draw (0,-1.5) to[zzD-,l=$ZZ$] (3,-1.5);
  \ctikzset{diode straight whiskers}
  \draw (4,0) to[zzD*,l=$ZZ_{\mathrm{straight}}$] (7,0);
  \draw (4,-1.5) to[tvsDo,l=$\mathrm{TVS}$] (8,-1.5);
\end{circuitikz}
```

Accepted aliases are `zD`/`zD*`/`zDo`, `zzD`/`zzD*`/`zzD-`, and
`tvsD`/`tvsD*`/`tvsDo`, including `full`, `empty`, and `stroke` long names.
`diode straight whiskers` produces the right-angle terminals, while
`diode sloped whiskers` restores the default slanted form. TVS uses the native
double-width, opposing-triangle body. This adds no claim for tunnel, optical,
Shockley, bidirectional, or tripole families.

The checked source and reproducible three-way record are
[`test/fixtures/examples/circuitikz/zener-tvs-diodes.tex`](test/fixtures/examples/circuitikz/zener-tvs-diodes.tex)
and
[`docs/qa/2026-08-06-circuitikz-zener-tvs-diodes.md`](docs/qa/2026-08-06-circuitikz-zener-tvs-diodes.md).

### Circuitikz Photo and Laser Diodes

The optical diode slice shares the native diode body but gives the optical
marks their own geometry and style layer:

```tex
\begin{circuitikz}
  \draw (0,0) to[pD*,l=$\mathrm{PD}$] (3,0);
  \draw (4,0) to[lasDo,diodes/fill=green!20,l=$\mathrm{LD}$] (7,0);
  \ctikzset{pd arrows to cathode}
  \draw (0,-2) to[pD,diodes/scale=.7] (3,-2);
  \ctikzset{pd arrows to anode}
  \draw[blue] (4,-2) to[pD*,opto arrows/color=red,
    opto arrows/relative thickness=1.5] (7,-2);
\end{circuitikz}
```

Supported here: `pD`/`pD*`/`pDo`, `lasD`/`lasD*`/`lasDo`, the documented
full/empty/stroke long names, the laser diode's second cathode bar,
`pd arrows to anode`, `pd arrows to cathode`, `opto arrows/color`,
`opto arrows/relative thickness`, `diodes/scale`, `diodes/fill`, and outer
`l=` labels. This does not yet claim arbitrary opto dash/end-arrow syntax,
photoresistors, phototransistors, solar cells, or tunnel diodes.

The checked source and three-way visual record are
[`test/fixtures/examples/circuitikz/opto-diodes.tex`](test/fixtures/examples/circuitikz/opto-diodes.tex)
and
[`docs/qa/2026-08-06-circuitikz-opto-diodes.md`](docs/qa/2026-08-06-circuitikz-opto-diodes.md).

### Circuitikz Varcap Diodes

The varcap slice implements Circuitikz's diode-like variable-capacitance
symbol: its triangular plate ends at the first vertical plate, with the second
plate offset by the source-defined two-bipole-line-width gap.

```tex
\begin{circuitikz}
  \draw (0,0) to[VC,l=$C_{\mathrm{auto}}$] (3,0);
  \draw (0,-1.8) to[VCo,diodes/fill=orange!30,l=$C_{\mathrm{empty}}$] (3,-1.8);
  \draw (4,0) to[VC-,l=$C_{\mathrm{stroke}}$] (7,0);
  \draw (4,-1.8) to[VC*,diodes/scale=.7,l=$C_{\mathrm{full}}$] (7,-1.8);
\end{circuitikz}
```

Supported forms are `VC`, `VCo`, `VC-`, `VC*`, plus `full varcap`, `empty
varcap`, and `stroke varcap`. The automatic `VC` form follows Circuitikz's
global `diode=empty|full|stroke` choice (native default: `empty`). The shared
`diodes/scale`, `diodes/fill`, and `l=` behavior applies. This is the
diode-like varcap family only; tunnel/Schottky variants and wider diode
families remain separate work.

The checked source and three-way visual record are
[`test/fixtures/examples/circuitikz/varcap-diodes.tex`](test/fixtures/examples/circuitikz/varcap-diodes.tex)
and
[`docs/qa/2026-08-06-circuitikz-varcap-diodes.md`](docs/qa/2026-08-06-circuitikz-varcap-diodes.md).

### Circuitikz Variable Capacitors

The independent variable-capacitor slice uses Circuitikz's `vC` spelling,
which is deliberately distinct from the diode-like uppercase `VC` family:

```tex
\begin{circuitikz}
  \draw (0,0) to[vC,l=$C_{\mathrm{default}}$,name=default] (3,0);
  \draw (4,0) to[variable capacitor,
    capacitors/scale=.8,
    capacitors/width=.3,
    capacitors/height=.45,
    capacitors/modifier thickness=.5,
    l=$C_{\mathrm{compact}}$] (7,0);
  \draw (default.wiper) -- (default.tip);
\end{circuitikz}
```

Supported in this verified slice: `vC` and `variable capacitor`; the two
capacitor plates; `capacitors/scale`, `capacitors/width`,
`capacitors/height`, and `capacitors/modifier thickness`; the documented
`bipoles/fix tunable direction` switch; `l=` labels; and the named `wiper`,
`W`, and `tip` anchors. The control arrow now uses Circuitikz's source-defined
`latexslim` fill-only tip, including its dynamic line-width geometry and `6d`
stem shortening. It does not yet cover the wider capacitor catalogue,
arbitrary custom tunable-arrow tips, or every capacitor style directory.

The fixture, four-way artifacts, and visual acceptance record are
[`test/fixtures/examples/circuitikz/variable-capacitors.tex`](test/fixtures/examples/circuitikz/variable-capacitors.tex)
and
[`docs/qa/2026-08-06-circuitikz-variable-capacitors.md`](docs/qa/2026-08-06-circuitikz-variable-capacitors.md).
The focused arrow-geometry follow-up is recorded in
[`docs/qa/2026-08-06-circuitikz-latexslim-arrow.md`](docs/qa/2026-08-06-circuitikz-latexslim-arrow.md).
To reproduce the local MacTeX, TikZKit, tikztosvg, PNG, grid, and difference
artifacts:

```bash
npm run examples:render -- --only circuitikz-variable-capacitors \
  --output outputs/qa-circuitikz-variable-capacitors \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-circuitikz-variable-capacitors
```

### Circuitikz Transformer Cores

`transformer core` accepts the manual's narrow core-style directory and draws
the default cute-transformer body with the same alternating half-elliptical
coil construction as local Circuitikz. Outer leads retain the component line
width, while coils and the magnetic core use the native choke-width basis.
This does not claim complete transformer compatibility: non-cute body styles,
custom transformer families, and the wider quadpole catalogue remain partial.

```tex
\begin{circuitikz}
  \draw (0,0) node[transformer core](A){};
  \ctikzset{transformer core/.cd,
    relative thickness=2,
    color=red,
    dash={{4pt}{2pt}}}
  \draw (2,0) node[transformer core](B){};
\end{circuitikz}
```

Supported: `relative thickness`, `color`, a zero-phase sequence of
`{on}{off}` dash dimensions, `dash=default` (inherit the component pattern),
and `dash=none` (force solid core strokes). The default cute body also keeps
the manual's five large coil lobes, four return lobes, full-height lead routing,
and matching L1/L2 coil-anchor span. The reference and visual records are
[`docs/qa/2026-08-06-circuitikz-transformer-core.md`](docs/qa/2026-08-06-circuitikz-transformer-core.md)
and
[`docs/qa/2026-08-06-circuitikz-transformer-geometry.md`](docs/qa/2026-08-06-circuitikz-transformer-geometry.md).

### Circuitikz Sinusoidal Sources

The independent sinusoidal source slice follows the local Circuitikz manual:

```tex
\usepackage{circuitikz}
\begin{circuitikz}[american, thick]
  \ctikzset{sources/scale=1.2, sources/symbol/thickness=1.5}
  \draw (0,2) to[sV=$V$] ++(3,0);
  \draw (0,1) to[sI=$I$] ++(3,0);
  \ctikzset{bipoles/isourcesin/angle=80}
  \draw (0,0) to[sI] ++(3,0);
\end{circuitikz}
```

Supported here: `sV`, `sI`, `vsourcesin`, `isourcesin`, the named sinusoidal
source styles, `sources/scale`, `sources/symbol/thickness`, the external
`sI=$...$` current marker, and `bipoles/isourcesin/angle` between `0` and
`90`. In `[american]` mode, `sV=$...$` also places the native external `+/-`
polarity pair below the voltage label; `l=$...$` remains a component label.

### Circuitikz Waveform Symbols and Rotation

Independent voltage sources also support the documented square and triangular
waveform aliases. Their internal symbol can be rotated by a local angle or
held in a global orientation with `auto`:

```tex
\begin{circuitikz}[thick]
  \draw (0,2) to[sqV] (3,2);
  \draw (4,2) to[tV] (4,5);
  \ctikzset{sources/symbol/rotate=auto, sources/symbol/thickness=1.5}
  \draw[red] (0,0) to[sqV] (3,0);
  \draw[red] (4,0) to[sqV] (4,-3);
\end{circuitikz}
```

Supported: `sqV`, `vsourcesquare`, `square voltage source`, `tV`,
`vsourcetri`, `triangle voltage source`, plus numeric
`sources/symbol/rotate=<angle>` and `sources/symbol/rotate=auto`. The shared
`sources/symbol/thickness` multiplier applies to sine, square, and triangle
symbols. Independent square/triangle current sources and DC waveform symbols
remain outside this slice.

### Circuitikz Controlled Sinusoidal Sources

Controlled sinusoidal sources are diamonds with a sine wave, rather than the
circle used by `sV` and `sI`:

```tex
\usepackage{circuitikz}
\begin{circuitikz}[american, thick]
  \ctikzset{csources/scale=1.2, csources/symbol/thickness=1.5}
  \draw (0,2) to[csV=$g v_x$] ++(3,0);
  \draw (0,1) to[csI=$g i_x$] ++(3,0);
  \draw (0,0) to[controlled sinusoidal voltage source, l=$\mu v_x$] ++(3,0);
\end{circuitikz}
```

Supported here: `csV`, `csI`, `cvsourcesin`, `cisourcesin`, `controlled
vsourcesin`, `controlled isourcesin`, the complete controlled-sinusoidal
style names, direction suffixes, `csources/scale`,
`csources/symbol/thickness`, external `v/i` labels, and `l=...`. In American
mode, `csV=$...$` includes native external `+/-` polarity below the voltage
label, whereas `l=$...$` deliberately does not. In native
Circuitikz, `csources/symbol/thickness` is deliberately separate from the
independent-source `sources/symbol/thickness` key. Numeric
`csources/symbol/rotate=<angle>` and `csources/symbol/rotate=auto` apply to
the controlled sinusoidal symbol. Source fills, DC/square/triangular
controlled sources, and arbitrary voltage-symbol/plus/minus overrides are
outside this verified slice. The visual reference record is in
[`docs/qa/2026-08-06-circuitikz-controlled-sinusoidal-sources.md`](docs/qa/2026-08-06-circuitikz-controlled-sinusoidal-sources.md).

### Circuitikz Battery Plate Families

This is a verified, deliberately small battery slice. It supports the three
standard symbols, the shared scale key, and a conventional component label:

```tex
\usepackage{circuitikz}
\begin{circuitikz}[thick]
  \ctikzset{batteries/scale=1.2}
  \draw (0,0) to[battery, l=$B$] (0,3);
  \draw (2.5,0) to[battery1, l=$B_1$] (2.5,3);
  \draw (5,0) to[battery2, l=$B_2$] (5,3);
\end{circuitikz}
```

Supported in this slice: `battery`, `battery1`, `battery2`,
`batteries/scale`, the verified vertical bipole placement, and `l=` labels.
Not yet accepted as compatible: `invert`, battery voltage-direction labels,
solar/baertty symbols, arbitrary source rotation, or the rest of the battery
class options.

## Browser Workbench

The local source editor has line numbers, TikZ-aware highlighting, and inline
diagnostic markers. Selecting a diagnostic moves the caret to its source line;
`Cmd/Ctrl+Enter` renders the current source and `Cmd/Ctrl+S` saves its local
draft. Its enhanced editor assets are bundled locally for offline use; when the
enhancement cannot load, the source field remains usable as a plain text editor.

The workbench discovers the unified fixture catalog, including the selected
30-case visual acceptance batch. Choose a fixture, edit its TikZ source, click
**Render**, and inspect the TikZKit SVG and diagnostics. Toggle the 1cm grid
when comparing the browser result with the `tikztosvg` reference; the fixture
selection is retained in the URL hash.

Use **Filter cases** to narrow the catalog by ID, title, or declared feature.
Edits are saved as a browser-local draft per case and never modify fixture
files. A changed source marks the existing preview as stale until it is
rendered again; **Reset** discards that local draft. **New source** opens an
independent scratch document, while **Copy SVG** and **Download SVG** export
the clean current TikZKit SVG without the QA grid. The grid toggle applies to
both the browser SVG and the `tikztosvg` reference so their visible coordinate
guides stay in the same mode.

Each catalog fixture also has a collapsible **Semantic inventory** below its
heading. It is produced from the exact fixture source and shows the individual
packages/libraries, commands, environments, nested parameter paths, source
definitions, numeric values, and plot expressions. Every row reports the
current JavaScript owner and implementation/review state. The dependency rows
perform a local MacTeX lookup and show the discovered file name, but deliberately
do not expose absolute local paths in the browser. The top status separates
unmapped or unsupported blockers from ordinary items that still need visual or
source-level review.

The inventory is a case-planning aid, not a compatibility claim. In particular,
`partial`, `requires-case-verification`, and `todo` mean that the emitted SVG
still needs comparison with the reference. Scratch documents do not have a
fixture inventory or a reference artifact; use the CLI audit when preparing a
new case. Editing a catalog fixture does not automatically re-audit the local
draft; the inventory header then says `fixture source only`. Use the CLI audit
when the draft itself becomes the next reviewed source:

```bash
npm run case:audit -- path/to/case.tex \
  --output outputs/case-audit.md \
  --init-review outputs/case-review.json
```

For a new source, paste a complete `tikzpicture` or document source into the
editor and render it locally. A successful SVG is not an acceptance signal on
its own: inspect diagnostics and, for compatibility work, compare it with a
native reference.

`npm run web` serves the workbench's static assets, TikZKit source modules,
fixture source, and pre-generated reference artifacts. It does not render
TikZ on the server and does not expose a `/api/render` endpoint. Rendering
runs in the browser through the public API in `src/index.js`.

MacTeX and `tikztosvg` are offline reference-generation tools only. They are
not browser-workbench runtime dependencies. Regenerate reference artifacts
separately with:

```bash
npm run examples:render
npm run examples:diff
```

This requires the local reference tools used by the project, including
`tikztosvg` and `rsvg-convert`. Generated output is test evidence and is
ignored by Git.

#### Legacy tkz-base / tkz-euclide References

Some archived sources use the removed `\usetkzobj{...}` loader, place
`tkz-fct` after `tkz-euclide`, or use the older
`\tkzAxeXY[ticks=false]` spelling. During `--native-reference` generation
only, TikZKit creates a disposable equivalent source: it loads `tkz-base`,
then `tkz-fct`, before `tkz-euclide`, removes the obsolete loader, and maps
that axis shorthand to modern `\tkzDrawXY[noticks]`. It never rewrites the
fixture on disk and never adds TeX as a browser dependency. The JavaScript
renderer independently accepts the legacy `ticks=false` option and keeps the
arrowed axes with their terminal `x`/`y` labels while suppressing graduations.

### Add A Focused Visual QA Case

Put a reusable real-world source under `test/fixtures/examples/<topic>/`. Then
render one fixture into a dedicated, ignored QA directory and generate its
comparison sheet:

```bash
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-my-feature \
  --only <fixture-id> \
  --native-reference \
  --preserve-output

node scripts/diff-example-pngs.js --output outputs/qa-my-feature
```

The output directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, optional
1cm-grid variants, per-case diff PNGs, and an `index.html` comparison page.
`--native-reference` also writes a local MacTeX PNG under `mactex-png/`, its
build log under `mactex-log/`, and a four-panel
`diff/<fixture-id>-native-sheet.png` containing MacTeX, tikztosvg, TikZKit,
and the TikZKit/tikztosvg diff. The browser page stays a focused two-panel
TikZKit/tikztosvg comparison; the native reference and four-panel sheet are
linked from the case's artifact row. For a manifest case with CSV or image
resources, the native run writes its rewritten `reference.tex` and copies the
declared resources beneath `.mactex-work/<fixture-id>/`; all three renderers
therefore resolve the same paths. Use `node scripts/render-example-fixtures.js --help` and
`node scripts/diff-example-pngs.js --help` to inspect the supported switches.

When a page uses different SVG rasterizers, add `--register` during triage:

```bash
node scripts/diff-example-pngs.js --output outputs/qa-my-feature --register
```

This keeps the raw diff unchanged and additionally records the best bounded
integer translation (`dx`, `dy`, default range `-3..3`) plus an aligned diff
PNG. It is an investigation aid, not a pass criterion: a nonzero translation
means the canvas/bounding-box contract still needs review, while a large
aligned residual points to missing or incorrectly rendered geometry. Use
`--alignment-radius <pixels>` only when a wider inspection window is justified.
When the directory contains a MacTeX PNG, the report also records TikZKit and
tikztosvg aligned residuals against MacTeX. Follow the lower residual only as
a clue; inspect the linked four-panel sheet before deciding which renderer is
closer for a particular TikZ feature.

### Compare One Snippet Locally

For a small standalone `tikzpicture`, keep the source and every generated
artifact in one ignored QA directory. This is the quickest way to inspect a
renderer change before adding it to the fixture catalog:

```bash
mkdir -p outputs/qa-arrow-label
node bin/tikz2svg.js path/to/diagram.tikz \
  -o outputs/qa-arrow-label/tikzkit.svg \
  --svg-text-math --margin 0
tikztosvg --pdflatex \
  -o outputs/qa-arrow-label/tikztosvg.svg \
  path/to/diagram.tikz
rsvg-convert --background-color=white --dpi-x=72 --dpi-y=72 --zoom=4 \
  outputs/qa-arrow-label/tikzkit.svg \
  -o outputs/qa-arrow-label/tikzkit.png
rsvg-convert --background-color=white --dpi-x=72 --dpi-y=72 --zoom=4 \
  outputs/qa-arrow-label/tikztosvg.svg \
  -o outputs/qa-arrow-label/tikztosvg.png
```

`tikztosvg` expects a TikZ snippet such as `\begin{tikzpicture} ...
\end{tikzpicture}`. For the native comparison, wrap that exact source in a
minimal standalone document, compile it with `pdflatex`, and rasterize the PDF
at the same 72dpi base scale. Compare position, canvas bounds, font size,
arrow tips, clipping, and line weights visually; do not accept a change from a
single pixel-difference number alone.

For a native MacTeX reference, compile the exact fixture separately and put
the PNG beside the generated artifacts. This makes the acceptance target
explicit: TikZKit geometry, clipping, labels, arrows, and visible text must be
compared with both an independent SVG converter and the local TeX result. A
low pixel difference is only a triage signal; inspect the sheet before calling
a case compatible.

```bash
mkdir -p /private/tmp/tikzkit-native outputs/qa-my-feature/mactex-png
cp test/fixtures/examples/<topic>/<case>.tex /private/tmp/tikzkit-native/main.tex
(cd /private/tmp/tikzkit-native && pdflatex -interaction=nonstopmode -halt-on-error main.tex)
pdftoppm -png -r 144 -singlefile /private/tmp/tikzkit-native/main.pdf \
  outputs/qa-my-feature/mactex-png/<case>
```

Keep the resulting `mactex-png/`, `tikzkit-svg/`, `tikzkit-png/`,
`tikztosvg-svg/`, `tikztosvg-png/`, and `diff/` directories together. They are
the minimum evidence bundle for a visual compatibility change.

For `tkz-euclide` construction results, include `--native-reference` and use
the native MacTeX panel as the acceptance target. A picture transform changes
the rendered coordinates but must not change the names bound by
`\\tkzGetPoints`; the focused line-circle/Thales check is:

```bash
node --test test/tkz-euclide.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-tkz-interlc \
  --only tkz-euclide-line-circle-intersections \
  --only tkz-euclide-line-circle-common-result \
  --only tkz-euclide-thales-circle-triangle \
  --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output outputs/qa-tkz-interlc
```

`\\tkzInterLC[common=<point>]` is deliberately different from `near` and
`next to`: the named common contact remains the *second* `\\tkzGetPoints`
result. The `tkz-euclide-line-circle-common-result` fixture labels both
outputs so an accidental swap is visible in the comparison panel.

### Inspect Library Support Before Extending It

Each observed `\usetikzlibrary{...}` name has a declaration module under
`src/tikz/libraries/`; each observed `\usepgfplotslibrary{...}` name has one
under `src/pgfplots/libraries/`. The declaration is the compatibility contract:
it records the support boundary, owning implementation, and reviewed local
MacTeX source. For example, the focused ISO-date subset is declared in
`src/pgfplots/libraries/dateplot.js`, while TikZ's loader spelling lives in
`src/tikz/libraries/pgfplots.dateplot.js`.

Run the semantic audit on the same source before making a renderer change:

```bash
npm run case:audit -- \
  test/fixtures/examples/latex-examples/landtagswahlen-in-bayern.tex \
  --output outputs/qa-dateplot-library/audit.md \
  --init-review outputs/qa-dateplot-library/review.json
```

The generated report lists every package, library, command, option, numeric
literal, and unresolved diagnostic detected in the source. Keep the review
status `incomplete` until the visual QA panel has been inspected and the
declared partial boundary is accurate.

### Verification And Commit Gate

Run the complete automated suite before calling a renderer change accepted:

```bash
npm test
```

For a focused compatibility change, also run its narrow regression test and
rebuild the actual fixture artifacts. A green focused test is useful while
iterating, but does not replace the full suite or visual review:

```bash
node --test test/<feature>.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-<feature> \
  --only <fixture-id> \
  --native-reference \
  --preserve-output
node scripts/diff-example-pngs.js --output outputs/qa-<feature>
```

For PGFPlots range, tick, or axis-placement work, start with the focused
regression before opening the generated sheet:

```bash
node --test test/pgfplots-seams.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-pgfplots-<slice> \
  --only latex-examples-2d-x-square-with-circle \
  --native-reference \
  --strict-tikztosvg \
  --comparison-grid-mode svg
node scripts/diff-example-pngs.js --output outputs/qa-pgfplots-<slice>
```

Open `outputs/qa-pgfplots-<slice>/index.html`. The page shows TikZKit and
tikztosvg side by side with the same optional grid; use the linked native
MacTeX PNG and four-panel sheet to decide whether a visual change is actually
an improvement. SVG document dimensions may differ slightly because each
renderer computes text bounds and tight crops independently; judge the
plot-frame geometry, labels, line work, and clipping rather than treating a
single canvas number as the acceptance condition.

### PGFPlots Middle-Axis Scientific Labels

For a 2D axis using `axis y line=middle`, a scientific y tick multiplier is
now placed outside the left tick-label column and 3% above its top, matching
PGFPlots' `yticklabel* cs:1.03,-0.3em` rule. This keeps it distinct from an
upright middle-axis `ylabel`.

```tex
\begin{axis}[
  axis x line=middle,
  axis y line=middle,
  ymin=0, ymax=20000000,
  ylabel=Stored game situations
]
  \addplot coordinates {(0,0) (1,10000000) (2,20000000)};
\end{axis}
```

This is a focused 2D placement rule. Arbitrary `every y tick scale label`
styles, custom `ticklabel* cs` coordinates, logarithmic axes, and complete
PGF number-format compatibility remain partial. Reproduce the checked
primary/right-overlay case with:

```bash
node --test test/pgfplots-csv-overlay.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-csv-line-plot-two-axes \
  --output outputs/qa-pgfplots-middle-y-scale-label \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfplots-middle-y-scale-label
```

The local reference reading, visible before/after result, and remaining
boundary are recorded in
[docs/qa/2026-08-07-pgfplots-middle-y-scale-label.md](docs/qa/2026-08-07-pgfplots-middle-y-scale-label.md).

### PGFPlots Automatic Tick Bounds

For a numeric axis with an explicit non-round bound such as
`xmax=2011.9`, TikZKit now keeps automatically chosen major ticks and their
matching automatic grid lines inside the final axis range. This mirrors
PGFPlots' final `checktickmin` / `checktickmax` pass: a convenient candidate
such as `2012` may be considered while planning, but it is not painted outside
the declared range.

The focused driver is `latex-examples-bar-chart-military-budget`:

```bash
node --test --test-name-pattern='fractional maximum' test/pgfplots-histogram.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-pgfplots-automatic-tick-bounds \
  --only latex-examples-bar-chart-military-budget \
  --native-reference \
  --strict-tikztosvg \
  --comparison-grid-mode svg
node scripts/diff-example-pngs.js --output outputs/qa-pgfplots-automatic-tick-bounds
```

Open `outputs/qa-pgfplots-automatic-tick-bounds/index.html` and inspect the
native four-panel sheet. This supported slice covers automatic numeric major
ticks and automatic major grids. Explicit `xtick`/`ytick` lists remain
authoritative, while log axes, minor-tick policies, custom coordinate
transforms, and arbitrary tick formatters are still partial.

Only commit a compatibility slice after its fixture has been inspected against
both local MacTeX and `tikztosvg`, its diagnostics have not increased, and its
relevant tests pass. Keep separate parser, renderer, package, and library
experiments in separate commits; do not use a broad work-in-progress diff as a
release checkpoint.

When a decoration or path operation has an unintuitive result, add a minimal
fixture beside the real-world corpus before changing the interpreter. Keep the
source path, the narrow `node --test` command, the MacTeX PNG, and both SVG
renderings in the QA record. This makes the accepted PGF state transition
explicit and prevents a visual fix for one example from silently changing
another path family.

### PGFPlots Open Axes With Equal Units

The browser subset supports the common 2D combination below. It is useful for
geometric plots where one data unit on the x and y axes must have the same
physical length, while a small final reserve keeps the last x tick visible.

```tex
\begin{axis}[
  xmin=0, ymin=0,
  axis lines*=left,
  enlarge y limits=false,
  enlarge x limits={upper,abs=0.02},
  unit vector ratio*={1 1 1},
  width=6cm,
  tick align=center
]
  \addplot[mark=square*] table {function.data};
\end{axis}
```

For this supported slice, `axis lines*=left` draws only the left and bottom
frame edges; it is not interpreted as a pair of axes through zero. The absolute
upper enlargement is included once in the final coordinate transform before
the star-form unit ratio chooses the fitted plot-box size. `unit vector ratio`
without `*`, expression-valued ratios, custom basis vectors, log axes, and
full 3D equal-image semantics remain partial. The reference workflow and
visual acceptance record are in
[`docs/qa/2026-08-06-pgfplots-open-axis-unit-vector-ratio.md`](docs/qa/2026-08-06-pgfplots-open-axis-unit-vector-ratio.md).

## Browser and Markdown Usage

TikZKit also renders Markdown-like TikZ code blocks. Both backtick fences and
apostrophe fences are supported:

````markdown
```tikz
\begin{tikzpicture}
  \draw[->] (0,0) -- (2,0) node[right] {$x$};
  \draw[->] (0,0) -- (0,1.5) node[above] {$y$};
\end{tikzpicture}
```
````

or:

```markdown
'''tikz
\begin{tikzpicture}
  \node[circle, draw] (A) at (0,0) {$A$};
  \node[circle, draw, right=2cm of A] (B) {$B$};
  \draw[-stealth] (A) -- (B);
\end{tikzpicture}
'''
```

The page defaults to rendered results and includes per-case tabs for JS rendering, native rendering, diff, source, and analysis when gallery reports exist.

If no CLI output path is provided, TikZKit writes `<input-name>.svg` next to
the input. `--strict` makes any warning a non-zero exit, which is useful in
automated checks.

## Library Usage

```js
import { parseTikz, interpretTikz, renderSvg, tikzToSvg } from "./src/index.js";

const source = String.raw`
\begin{tikzpicture}
  \draw[thick, -stealth] (0,0) -- (2,1);
\end{tikzpicture}`;

const result = tikzToSvg(source);

console.log(result.svg);
console.log(result.diagnostics);
```

Always inspect `result.diagnostics` before accepting a render. An SVG may still
be returned for partially supported input so that compatibility problems can be
debugged visually.

### Basic `graphs` chains

`\usetikzlibrary{graphs}` currently supports a deliberately small, verified
Cartesian slice: named nodes, chain groups, `->` / `--` / `<-` / `<->`, shared
`nodes={...}` and `edges={...}` styles, local edge styles such as `red` and
`bend left`, plus quoted edge labels. Quoted labels follow TikZ's common
`auto` default and apostrophe (`"label"'`) `swap` placement. Load `quotes` in
the source when using this syntax. The graph syntax is lowered to ordinary
TikZ nodes and `edge` paths before interpretation, so it uses the normal
node-border, curve, label and arrow rendering rules:

```tex
\usetikzlibrary{graphs}
\tikz \graph[
  grow right=1.4cm,
  branch down=1cm,
  nodes={draw,circle,minimum size=6mm},
  edges={thick}
] { a -> {b,c} -> d; };
```

```tex
\usetikzlibrary{graphs,quotes}
\tikz \graph[grow right=1.5cm, nodes={draw,circle}, edges={thick}] {
  a ->[red, "start"] b --["middle"'] c ->[blue,bend left, "return"] a;
};
```

This is not the entire PGF graph language. Subgraphs, graph-drawing
algorithms, node sets, circular/grid placement, aliases, graph operators,
source/target edge options, arbitrary quote key callbacks and per-edge node
syntax remain partial. The reproducible three-way visual records are
[`docs/qa/2026-08-07-graphs-basic-chain-group.md`](docs/qa/2026-08-07-graphs-basic-chain-group.md)
and [`docs/qa/2026-08-07-graphs-edge-labels-and-styles.md`](docs/qa/2026-08-07-graphs-edge-labels-and-styles.md).

Public API:

- `parseTikz(source, options)`: returns `{ ast, diagnostics }`.
- `interpretTikz(ast, options)`: returns `{ ir, diagnostics }`.
- `renderSvg(ir, options)`: returns an SVG string.
- `tikzToSvg(source, options)`: one-shot conversion returning `{ svg, diagnostics, ir, ast }`.
- `splitTikzCodeBlocks(markdown)`: splits text into normal and TikZ parts.
- `extractTikzCodeBlocks(markdown)`: extracts TikZ fenced blocks.

Useful render option:

```js
const result = tikzToSvg(source, { mathRenderer: "svg-text" });
```

`svg-text` avoids SVG `foreignObject` and is useful for raster comparison
tools. It is intentionally a compact fallback, so dense `align*`, matrix,
and nested-script formulas cannot reproduce every TeX spacing decision.
Within that portable path, `\begin{array}` now has a structured subset:
`l`/`c`/`r` columns, empty `@{}` column joins, basic `*{n}{...}` repetition,
and `\left...\right` delimiters. Custom preamble material, nonempty `@{...}`
inserts, and reference-driven formula cells remain partial.

The local workbench uses TikZKit's isolated browser-math path by default. It
embeds its styles beneath TikZKit-owned class names, so complex node formulas
keep their scripts, fractions, matrices, and alignment without changing other
formulas on the host page. Use `mathRenderer: "svg-text"` only when an
external raster tool needs pure SVG text; the default renderer is the
appropriate choice for the interactive preview.

## Testing

Before changing a real compatibility case, generate its semantic inventory:

```bash
npm run case:audit -- path/to/case.tex \
  --output outputs/case-audit.md \
  --init-review outputs/case-review.json
```

This resolves local MacTeX sources and lists every dependency, command,
environment, nested option, source variable, numeric value, and plot
expression. The strict acceptance run remains incomplete until the review
records what was learned from each local source and gives every semantic item
test or visual-artifact evidence:

```bash
npm run case:audit -- path/to/case.tex \
  --review outputs/case-review.json \
  --strict
```

Zero diagnostics, similar canvas dimensions, or a low image-diff value do not
by themselves complete a case. See
[case-driven semantic acceptance](docs/case-driven-acceptance.md).

Run the complete Node test command:

```bash
npm test
```

Run the focused 30-case compatibility gate:

```bash
node --test test/latex-examples-new30-acceptance.test.js
```

The focused gate checks that every selected case emits no diagnostics and
retains the locally measured native canvas contract. Visual changes must also
be reviewed with the generated TikZKit/reference/diff sheets; a numeric image
diff alone is not considered sufficient acceptance.

### Real-Case Visual QA Workflow

TikZKit is still under active testing, so use this workflow before treating a
new feature or a changed real-world case as compatible:

```bash
# 1. Inventory every command, option, dependency, value, and expression.
npm run case:audit -- path/to/case.tex \
  --output outputs/case-audit.md \
  --init-review outputs/case-review.json

# 2. Create MacTeX, TikZKit, tikztosvg, PNG, and comparison artifacts.
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-my-feature \
  --only <fixture-id> \
  --native-reference \
  --comparison-grid-mode svg

# 3. Produce per-pixel supporting diffs and open the generated comparison page.
node scripts/diff-example-pngs.js --output outputs/qa-my-feature
open outputs/qa-my-feature/index.html
```

Inspect the native, tikztosvg, TikZKit, and diff panels together. Check missing
elements, coordinate scale and origin, labels/fonts, arrows, line weight,
paint order, clipping, and canvas bounds. Record the reviewed local MacTeX
source and the remaining unsupported syntax in `docs/qa/`; do not accept a
case from a canvas-size or mean-difference number alone. Generated `outputs/`
artifacts are local QA evidence and are intentionally ignored by Git.

The audit creates missing parent directories for both `--output` and
`--init-review`, making it safe to start a case in a fresh QA folder. An
existing review file is never overwritten.

Some TikZ libraries delegate to a PGF implementation file whose name does not
match the TikZ library name. The audit preserves declared local source metadata
for these aliases, for example `arrows.meta` maps to
`pgflibraryarrows.meta.code.tex`, so a locally installed dependency is not
mistaken for a missing source.

## Supported TikZ Surface

Current support is pragmatic and growing. Highlights:

- Basic drawing commands: `\draw`, `\path`, `\fill`, `\filldraw`, `\node`, `\coordinate`.
- Common paths: lines, rectangles, circles, ellipses, arcs, grids, orthogonal `|-` / `-|`, `to`, `edge`, bend edges, self loops.
- Styles: `\tikzset`, `\tikzstyle`, color definitions, line widths, dash patterns, opacity, arrow tips.
- Scopes: ordinary `\begin{scope}...\end{scope}` and the `scopes` library's
  documented braced shorthand `{ [options] ... }`, including whitespace after
  `{` and nesting. The shorthand restores outer styles, transforms, coordinate
  bases, variables, and chain state when the group ends. It is intentionally
  limited to statement positions; native after-command hooks and
  catcode-sensitive TeX grouping remain partial. See
  `test/fixtures/examples/scopes/braced-local-scopes.tex` and
  `docs/qa/2026-08-07-scopes-braced-shorthand.md`.
- xcolor color normalization: `\definecolor` for `HTML`/`rgb`/`RGB`/`gray`, scoped
  `\color` state, and natural default-model mixing. In particular
  `cyan`/`magenta`/`yellow`/`olive` and `!` mixes use TeX's CMYK defaults rather
  than CSS homonyms; `\selectcolormodel`, color series, masks, and arbitrary
  model-qualified declarations remain partial.
- `arrows.meta`: capitalized `Latex` and `Stealth` use the current path line
  width. Their `scale`, `scale length`, and `scale width` keys now stay
  independent, so longitudinal scaling also changes the endpoint inset while
  width-only scaling does not. Explicit `shorten <=` / `shorten >=` combines
  with that inset. Lower-case core `latex` remains a distinct PGF tip. The
  checked source is
  `test/fixtures/examples/arrows/meta-tip-scaling.tex`; see
  `docs/qa/2026-08-06-arrows-meta-independent-scaling.md`. Composite tips,
  padding/separation, and arbitrary arrows.meta setup-code keys remain partial.
- Pattern fills: built-in pattern metadata plus a focused `\pgfdeclarepatternformonly` slice. Constant `\pgfpoint`/`\pgfqpoint` tile geometry and line, circle, rectangle, close, fill, and stroke primitives are supported. Simple preamble `/.store in` values can drive a declared tile's bounds, step, coordinates, and line width. Pattern transforms, mutable/inherently-colored patterns, post-declaration argument changes, and arbitrary TeX drawing procedures remain unsupported.
- Nodes: named nodes, compass anchors, angle anchors, shape borders, circle/rectangle/diamond, text and math sizing approximations.
- Positioning: `right=... of A`, `below right=... of A`, legacy `right of=A`, shifts, node distance.
- Matrices: common `matrix of nodes`, empty cells, row style overrides, matrix cell anchors.
- Calc-like coordinates: named coordinates, `($(A)+(1,2)$)`, interpolation, projections.
- Declared coordinate systems: the focused `\tikzdeclarecoordinatesystem{name}{code}`
  subset accepts its runtime `(<name> cs:<argument>)` payload as `#1`. A body
  can use `\pgfmathsetmacro` with that argument and finish with
  `\pgfpointxy` or `\pgfpoint`; its result follows the active TikZ basis.
  This is verified by
  `test/fixtures/examples/coordinates/declared-timeline-coordinate-system.tex`.
  Arbitrary `\pgfkeys` definitions, multi-step PGF point arithmetic, aliases,
  and unrestricted TeX macro bodies remain partial.
- Intersections: named paths and common path intersections.
- Decorations: markings, arrows along paths, verified snake/zigzag state-machine
  slices, and brace replacement.
  The verified `snake` subset keeps `pre length`, `segment length`, `amplitude`,
  and `post length` on the complete input subpath. Adding `-stealth` or another
  terminal tip shortens only the final painted lead; it does not change the
  wave phase or the requested decoration lengths. See the Case 005 driver at
  `test/fixtures/examples/decorations/snake-arrow-lengths.tex` and its QA
  record in `docs/qa/2026-08-06-snake-arrow-phase.md`.
- Legacy `snakes`: the direct `snake` option restarts its old state machine for
  each `--`, unlike modern `decorate` paths. The maintained subset includes
  default zigzags, `snake=snake`, segment amplitude/length, mirror/raise, and
  line/gap endpoint controls; see `test/snakes-legacy-options.test.js` and
  `docs/qa/2026-08-07-legacy-snakes-controls.md`. Custom snake declarations
  and old triangle object shapes remain unsupported.
- `zigzag` now mirrors PGF's `up from center`, `big down` / `big up`, and
  `center finish` state sequence. Its apex starts one quarter of a segment
  from the decoration start and continues across a polyline rather than
  restarting at every `--`. See
  `test/fixtures/examples/decorations/zigzag-native-state.tex` and
  `docs/qa/2026-08-07-decorations-zigzag-state-machine.md`. Exact native
  normals at sharp corners and arbitrary curve flattening remain partial.
- Brace replacement follows PGF's remaining-distance state for a polyline:
  it measures the full decorated subpath, but constructs the brace in the
  initial tangent frame. `mirror`, `raise`, `amplitude`, and `aspect` remain
  available. The checked driver is
  `test/fixtures/examples/decorations/brace-polyline-continuity.tex`; arbitrary
  non-linear input paths and the other path-replacing decorations remain
  partial. See `docs/qa/2026-08-05-brace-polyline-final-state.md`.
- Path text: `decorations.text` supports ordinary `text along path` and the
  documented `text effects along path` transform pipeline. Simple plain-text
  runs support `reverse text`, `group letters` and the documented alias
  `group letters into words`; `word separator` accepts the default space or a
  single custom separator, and transform order follows source order. `repeat
  text` mirrors PGF's cycle counter: the bare form fills the remaining path
  with complete text boxes; `repeat text=N` adds `N` complete copies after the
  first one. Explicit terminal spaces inside `text={...}` remain part of the
  repeated text box. Character-specific styles, arbitrary replacement
  snippets, rich/math/replacement grouping, and scale/fit text effects remain
  partial; see `test/fixtures/examples/decorations/text-group-words.tex`,
  `docs/qa/2026-08-07-decorations-text-group-words.md`, and
  `docs/qa/2026-08-07-decorations-text-repeat.md`.
- Calendar: Monday-first `week list`, all four linear `day list` directions,
  and `month list` calendars, including `day xshift`/`day yshift`,
  `month xshift`/`month yshift`, date predicates, day-node styles, and
  `month label above centered`/`month label left`. `month list` computes each
  row from the weekday of that month's first date, even when the requested
  range begins later in the month. Localized names, other month-label
  variants, custom day/month code, and executable calendar hooks remain
  partial. Use `calendar-list-arrangements` and
  `calendar-week-list-multimonth`; the inspected three-way record is
  `docs/qa/2026-08-07-calendar-list-arrangements.md`.
- `tkz-fct` Cartesian frame: `\tkzInit`, `\tkzGrid`, and `\tkzAxeXY` support
  separate x/y scales, same-sign local origins, explicit grid ranges, and
  `sub` grids. Independent `\tkzDrawX` / `\tkzDrawY` support the native
  axis line and `-latex` arrow, default `$x$`/`$y$` label or `label=...`, axis
  extension (`right space`, `left space`, `up space`, `down space`),
  `noticks`, `tickwd`, `tickup`, `tickdn`, `ticklt`, `tickrt`, `trig`, and the
  y-axis `step` tick spacing. The separate native `\tkzLabelX` / `\tkzLabelY`
  commands now lower source-unit numeric graduations and their tick redraws,
  including `step`, bare `orig` (hide the source origin), `frac=N`, `trig=N`
  (reduced `\pi` fractions), and ordinary node positioning, `text=...`, and
  `node font=...` options. `\tikzset{xlabel style=...}` and `ylabel style=...`
  now reach both axis-end and graduation labels, with tkz-base's native order:
  built-in defaults, global `.style`/`.append style`, then command-local node
  keys. `\tkzAxeX` and `\tkzAxeY` compose those commands in the same order as
  tkz-base. TeX's `np off`/`numprint` formatting remains partial. `\tkzFct` samples scalar source-unit expressions, while
  `\tkzFctPar[domain=...,samples=...]{x(t)}{y(t)}` evaluates `t`-based
  parametric curves, scales each coordinate with its own `xstep`/`ystep`, and
  clips to the initialized frame. `\tkzFctPolar[domain=...,samples=...]{r(t)}`
  uses its distinct native polar mapping: the radius uses `xstep`, same-sign
  origins shift the result, and the command does not implicitly clip. The
  documented defaults are `domain=-5:5` for `\tkzFctPar`, `domain=0:2*pi` for
  `\tkzFctPolar`, and `samples=200`; ordinary draw options such as `color`,
  `style`, and `line width` pass through. The documented scalar-function
  `\tkzDrawTangentLine` subset selects the last function or `with=a`, uses
  `kl`/`kr` source-unit half lengths, preserves independent x/y scales, and
  supports `draw` for the contact point. Global `tan style`, advanced tangent
  paint keys, areas, asymptotes, adaptive sampling, and general parametric
  discontinuity analysis remain outside the verified boundary. See
  [`docs/qa/2026-08-05-tkz-fct-parametric.md`](docs/qa/2026-08-05-tkz-fct-parametric.md),
  [`docs/qa/2026-08-05-tkz-fct-polar.md`](docs/qa/2026-08-05-tkz-fct-polar.md),
  [`docs/qa/2026-08-05-tkz-draw-axes.md`](docs/qa/2026-08-05-tkz-draw-axes.md),
  [`docs/qa/2026-08-05-tkz-axis-labels.md`](docs/qa/2026-08-05-tkz-axis-labels.md),
  [`docs/qa/2026-08-05-tkz-axis-styles.md`](docs/qa/2026-08-05-tkz-axis-styles.md),
  and [`docs/qa/2026-08-06-tkz-fct-tangent-line.md`](docs/qa/2026-08-06-tkz-fct-tangent-line.md).

  ```tex
  \usepackage{tkz-fct}
  \begin{tikzpicture}
    \tkzInit[ymax=2.25,ystep=.5]
    \tkzGrid
    \tkzDrawX
    \tkzDrawY
    \tkzFctPar[samples=400,domain=0:2*pi]{t-sin(t)}{1-cos(t)}
  \end{tikzpicture}
  ```

  ```tex
  \begin{tikzpicture}
    \tkzInit[xmin=-1,xmax=1,ymin=-1,ymax=1,xstep=.2,ystep=.2]
    \tkzGrid
    \tkzAxeXY
    \tkzFctPolar[domain=0:2*pi,samples=400]{cos(2*t)}
  \end{tikzpicture}
  ```

  ```tex
  % Independent axis geometry and labels are separate in tkz-base.
  \begin{tikzpicture}
    \tkzInit[xmin=0,xmax=5,ymin=-3.2,ymax=3.2]
    \tkzGrid
    \tkzDrawX[trig=2,label=$x$]
    \tkzDrawY[trig=2,label=$y$]
    \tkzLabelX[trig=2,below=7pt]
    \tkzLabelY[trig=2,orig] % bare orig suppresses only the 0 label
  \end{tikzpicture}
  ```
- PGFPlots subset: common `axis`, `addplot`, function sampling, coordinates, labels, legends, middle axes.
- 3D subset: TikZ `x=`, `y=`, `z=` basis projection.
- TeX-lite macros: common `\def`, `\newcommand`, `\foreach`, `\pgfmathsetmacro`.
- Built-in TikZ/PGF libraries: `\usetikzlibrary{shapes}` and `\usepgflibrary{bbox}` style declarations are treated as core library imports; common `shapes.geometric` and `shapes.symbols` nodes render as SVG paths with node-border anchors, and `bezier bounding box` tightens cubic Bézier viewBox/current-bounding-box calculations.
- Extension-backed libraries: `tikz-network`, `tikz-3dplot`, `tikz-bagua`, `tikz-bpmn`, `tikz-cd`, `tikz-decofonts`, `tikz-dimline`, `tikz-ext`, `tikz-feynhand`, `tikz-feynman`, `tikz-palattice`, `tikz-qtree`, `tikzquads`, and `tikzfxgraph` subsets, plus small compatibility layers for selected graph-style macros.
- Chemistry packages: a bounded `chemfig` / `chemmacros` scheme slice lowers horizontal reaction schemes into ordinary TikZ paths. It covers the tested aromatic six-member rings, single and double carbonyl bonds, peroxide bridges, reaction arrows, legacy `\setatomsep`, legacy `\lewis`, and the simple `\ch{...}` formula used by the corpus fixture.
- Multipart nodes: horizontal and vertical `rectangle split` nodes support `\nodepart`, per-part fills, named anchors, per-orientation part alignment, and `rectangle split ignore empty parts`; ignored slots are removed while their bare anchors resolve to the preceding visible part, matching PGF's B-tree and manual examples.

Unsupported or partially supported syntax should produce diagnostics instead of silently disappearing.

### Chemfig Scheme Slice

The current chemistry support is intentionally narrow and remains under visual
QA. A scheme shaped like the tested source below renders directly in JavaScript:

```tex
\schemestart
  \chemfig{*6(=-=(-(=[2]O)-[::-60]O-[0]O-[::30](=[2]O)-[::-60]*6(=-=-=-))-=-)}
  \arrow{->[$\Delta$]}
  2 \chemfig{*6(=-=(-(=[2]O)-[::-60]\lewis{0.,O})-=-)}
  \arrow
  2 \chemfig{*6(=-=(-[,.15,,,draw=none]\lewis{0.,})-=-)}\+\ch{2 CO2 ^}
\schemestop
```

It does not parse arbitrary Chemfig atom grammars, Cram bonds, distant hooks,
`\chemmove`, custom reaction layouts, or general chemmacros environments. The
fixture predates the current TeX Live names: native reference generation adds a
local compatibility shim from `\setatomsep` to `\setchemfig{atom sep=...}` and
loads `chemfig-lewis.tex`. See
[`docs/qa/2026-08-05-chemfig-scheme.md`](docs/qa/2026-08-05-chemfig-scheme.md)
for the visual comparison and known differences.

### Rectangle-Split Nodes

Load the library in the usual TikZ form. With `rectangle split horizontal`,
`\nodepart` creates columns and supports `center`, `top`, `bottom`, and `base`.
Without that key it creates rows and supports `center`, `left`, and `right`.
`rectangle split ignore empty parts` removes empty parts after the first text
part; fills retain their original logical part index.

```tex
\usetikzlibrary{shapes.multipart}
\begin{tikzpicture}
  \node[rectangle split,rectangle split horizontal,rectangle split parts=4,
    rectangle split ignore empty parts,draw] (record)
    {left\nodepart{two}\nodepart{three}right\nodepart{four}};
  \draw (record.two) -- (record.three);
\end{tikzpicture}
```

Horizontal and vertical rectangle splits, their orientation-specific alignment
families, and named bare part anchors are implemented for the supported part
names. `rectangle split part align=none`,
the full PGF anchor surface, arbitrary nested/multiline part boxes, and the
broader multipart shape family remain under test.

### Declared Pattern Tiles

Use a form-only declaration before the path that consumes it. The declaration's
third point is the repeat step; the final group is a small PGF drawing procedure.

```tex
\pgfdeclarepatternformonly{blue dots}
  {\pgfqpoint{-1pt}{-1pt}}
  {\pgfqpoint{1pt}{1pt}}
  {\pgfqpoint{3pt}{3pt}}
  {\pgfpathcircle{\pgfpointorigin}{.5pt}\pgfusepath{fill}}
\fill[pattern=blue dots,pattern color=blue] (0,0) rectangle (2,1);
```

The verified procedure subset is move/line/circle/rectangle/close plus
`\pgfusepath{fill}` and `\pgfusepath{stroke}`. Simple `/.store in` values in
the preamble are available while the declaration is interpreted, so this common
pattern form works:

```tex
\tikzset{hatch distance/.store in=\hatchdistance,hatch distance=10pt}
\pgfdeclarepatternformonly[\hatchdistance]{flexible hatch}
  {\pgfpointorigin}{\pgfpoint{\hatchdistance}{\hatchdistance}}
  {\pgfpoint{\hatchdistance-1pt}{\hatchdistance-1pt}}{...}
```

Pattern transforms, post-declaration argument changes, and declarations with
arbitrary executable TeX remain outside the supported boundary.

## TikZ Library Registry

`\usetikzlibrary{...}` declarations are parsed separately from source-rewriting extensions. The per-library metadata lives in:

```text
src/tikz/libraries/
```

`parseTikz(source)` records the resolved library list on both `ast.libraries` and each `tikzpicture.libraries`, while the preprocessor removes the raw declaration before statement parsing. This keeps the LaTeX preamble readable to TikZKit without turning `\usetikzlibrary` into a drawing command.

Current core examples:

- `positioning`: supports `node distance=<vertical> and <horizontal>`, normal edge-to-edge `right=of` / `below=of`, `on grid` centre-to-centre placement, and `base left/right` / `mid left/right` for one-line text and formula nodes. The latter use their corresponding TeX-style text anchors; complex multi-line box metrics remain partial.
- `matrix`: supports `matrix of nodes`, `row sep`, `column sep`, `nodes={...}`, `nodes in empty cells`, and `m-row-column` cell anchors.
- `scopes`: supports the manual's braced local-scope spelling
  `{ [<TikZ options>] <statements> }`, including nested groups whose options
  are separated from the opening brace by whitespace.
- `automata`: supports state circles, split output states, accepting/initial arrows, and `initial by diamond` when the source also loads `shapes.geometric`.
- `shadows`: supports `general shadow` plus the documented `drop shadow`
  defaults, foreground-paint-inheriting `copy shadow`, and two-stage
  `double copy shadow` for ordinary path and node preactions. A simple
  `every shadow/.style={...}` runs between those defaults and explicit caller
  overrides. `shadows.blur` additionally provides a browser SVG-filter
  approximation for ordinary path and node `blur shadow` preactions. Its
  `shadow blur radius` uses PGF's `2r` drawing extent and a calibrated
  continuous SVG falloff; `shadow blur steps` is accepted but is not the
  native discrete stroke/fading sequence. Blur inversion, fading/copy
  shadows, arbitrary hook code, marker-tip shadows, and form-only-pattern
  combinations remain partial; see
  [`docs/qa/2026-08-07-shadows-drop-shadow.md`](docs/qa/2026-08-07-shadows-drop-shadow.md),
  [`docs/qa/2026-08-07-shadows-blur-path.md`](docs/qa/2026-08-07-shadows-blur-path.md),
  and [`docs/qa/2026-08-07-shadows-blur-radius.md`](docs/qa/2026-08-07-shadows-blur-radius.md).
- `decorations.pathreplacing`: supports brace/ticks/border/waves replacements
  and the documented `show path construction` callback slice. With
  `decorate, decoration={show path construction,...}`, callback values for
  `moveto code`, `lineto code`, `curveto code`, and `closepath code` may use
  `\tikzinputsegmentfirst`, `\tikzinputsegmentlast`,
  `\tikzinputsegmentsupporta`, and `\tikzinputsegmentsupportb` inside normal
  TikZ draw/fill code. Arbitrary TeX-only callbacks and low-level PGF point
  macros remain partial. The named `postaction=style` form resolves its style
  before running callbacks, preserves the original path, and inherits source
  paint settings such as `thick` without recursively applying the postaction.
  Maintained references are
  [`decorations/pathreplacing-show-path-construction.tex`](test/fixtures/examples/decorations/pathreplacing-show-path-construction.tex)
  and
  [`decorations/pathreplacing-show-curve-controls.tex`](test/fixtures/examples/decorations/pathreplacing-show-curve-controls.tex):

  ```bash
  node --test --test-name-pattern='show path construction' test/interpreter.test.js
  npm run examples:render -- --fixtures test/fixtures/examples \
    --only decorations-pathreplacing-show-curve-controls \
    --output outputs/qa-show-path-construction \
    --native-reference --strict-tikztosvg
  npm run examples:diff -- --output outputs/qa-show-path-construction
  ```

The per-library metadata lives in `src/tikz/libraries/`; the generated
compatibility table is `docs/extension-registry.md`. Regenerate it after a
library change:

```bash
npm run extension-registry
```

When adding a built-in TikZ library, update its file in `src/tikz/libraries/`,
then implement the semantics in the parser, engine, or renderer layer that owns
the behavior. For a package-style compatibility layer that rewrites custom
commands into ordinary TikZ, use an extension under `src/extensions/`.

## Real Gallery Validation

The project includes scripts for comparing JS output against native MacTeX output:

```bash
npm run gallery:audit
npm run gallery:native
npm run gallery:js
npm run gallery:diff
```

Generated files go under `outputs/real-gallery/`.

- `gallery:audit`: renders the merged core gallery and reports diagnostics.
- `gallery:native`: uses local TeX tools to build native PNG references for the merged core gallery.
- `gallery:js`: renders JS SVG/PNG outputs for the merged core gallery.
- `gallery:diff`: compares native and JS PNGs.

The local web app at `http://127.0.0.1:5173/` uses one merged core gallery. It
combines the generated core cases with Janosh, f0nzie, Walmes, circuitikz, and
hackl/TikZ-StructuralAnalysis corpora, removes duplicate TikZ sources, and loads
that unified case list through `/api/corpora/core`.
The artifact generators use the same source through `scripts/gallery-case-source.js`.
If `outputs/real-gallery/native/report.json` or `outputs/real-gallery/js/report.json`
has fewer rows than the `/api/corpora/core` case count, rerun `gallery:native` and
`gallery:js`; the reports were generated from an older, smaller case set.

Additional corpus audits:

```bash
npm run awesome-tikz:audit
npm run f0nzie:audit
npm run janosh:audit
npm run walmes:audit
npm run circuitikz:audit
npm run structural-analysis:audit
```

`awesome-tikz:audit` is a catalog/roadmap audit rather than a render corpus:
`maphy-psd/awesome-TikZ` is an awesome-list repository with no local
`.tex`/`.tikz` examples, so the script parses its README resources and maps the
entries that TikZKit already supports as core, extension, corpus, or compatibility
subsets.

## Extension System

Extensions are normal ESM objects. The first stable hook is `preprocess`, which receives source text before parsing and returns rewritten TikZ source. This is the right layer for LaTeX/TikZ packages that define higher-level commands, because the extension can translate those commands into the core TikZ subset that the parser already understands.

TikZ libraries are different from extensions. A `\usetikzlibrary{...}` declaration enables built-in TikZ/PGF semantics; when the feature belongs to core drawing behavior, such as `shapes`, it should be implemented inside the parser/interpreter/renderer rather than as a source-rewriting extension.

Built-in extensions live in:

```text
src/extensions/
```

Current built-in extension:

```text
src/extensions/tikz-network.js
src/extensions/stanli.js
src/extensions/tikz-3dplot.js
src/extensions/tikz-bagua.js
src/extensions/tikz-bpmn.js
src/extensions/tikz-cd.js
src/extensions/tikz-decofonts.js
src/extensions/tikz-dimline.js
src/extensions/tikz-ext.js
src/extensions/tikz-feynhand.js
src/extensions/tikz-feynman.js
src/extensions/tikz-palattice.js
src/extensions/tikz-qtree.js
src/extensions/tikzquads.js
src/extensions/tikzfxgraph.js
```

The `tikzfxgraph` extension expands the practical command surface from `/usr/local/texlive/2025/texmf-dist/doc/latex/tikzfxgraph/tikzfxgraph.tex`: `\fxsetnew`, `\fxsetappend`, `\fxsetnewstyle`, `\fxgraphdraw`, and the `fxgraph` environment are translated into ordinary PGFPlots `axis` and `addplot` syntax. It supports linear/log/semilog declarations, tick specs with `min`/`max`/`N`/`delta`/`units`, function sets, legends, and extra PGFPlots body commands. Browser rendering samples expressions in JavaScript instead of invoking gnuplot, so complex-valued functions, table-file reuse, and exact logarithmic-axis behavior remain approximate.

Extension contract:

```js
export const myExtension = {
  name: "my-library",
  phase: "preprocess",
  description: "Expands my-library macros into supported TikZ.",
  commands: ["MyNode", "MyEdge"],
  preprocess(source, context) {
    context.diagnostics.push({
      severity: "warning",
      message: "optional warning from my-library"
    });

    return source.replace(
      /\\MyNode\{([^}]*)\}/g,
      String.raw`\node[circle, draw] ($1) at (0,0) {$1};`
    );
  }
};
```

Use a custom extension:

```js
import { tikzToSvg } from "./src/index.js";
import { myExtension } from "./src/extensions/my-library.js";

const result = tikzToSvg(source, {
  extensions: [myExtension]
});
```

Register a built-in extension:

```js
// src/extensions/index.js
import { myExtension } from "./my-library.js";

export const BUILTIN_EXTENSIONS = [
  tikzNetworkExtension,
  myExtension
];
```

Recommended extension layout:

```text
src/extensions/my-library.js
test/my-library.test.js
```

Recommended implementation flow:

1. Detect whether the source uses your package or commands.
2. Keep package state inside the extension, not global variables.
3. Parse only the command surface you support.
4. Expand to ordinary TikZ commands such as `\node`, `\draw`, `\path`, `\tikzset`.
5. Emit diagnostics for unsupported command forms.
6. Add tests for every command form and a small end-to-end SVG/IR assertion.

The extension should not directly mutate the drawing IR. That keeps parser, interpreter, and renderer boundaries stable for other users.

The `tikz-decofonts` extension follows this pattern for command-style packages. It expands `\tkzpixl`, `\tkzpixletter`, `\tkzbrush`, `\tkzink`, `\tkzbicolor`, `\tkzcomicbubble`, `\tkzsurround`, `\tkzunderline`, `\tkzfittextinarrow`, and `\tkzcircledtxt` into ordinary TikZ nodes and paths. The pixel font is drawn with a built-in 5x7 glyph table; brush/ink randomness is approximated deterministically so browser rendering stays stable.

The `tikz-dimline` extension expands `\dimline[options]{start}{end}{label}` into ordinary coordinates, extension lines, a dimension line, endpoint ticks, and a label node. It supports the commonly used package options `color`, `line style`, `label style`, `extension start/end length`, `extension start/end angle`, `extension start/end style`, `extension start/end path`, and `arrows`.

The `tikz-ext` extension enables a focused subset of the TikZ-Extensions collection. The first supported slice covers `ext.paths.ortho` operators (`-|-`, `|-|`, `r-ud`, `r-du`, `r-lr`, `r-rl`), `ext.paths.arcto`, `ext.topaths.arcthrough`, `ext.transformations.mirror` mirror keys, and approximate `superellipse` / `circle cross split` node shapes. Calendar, beamer overlays, image patterns, and AUX-file-driven sizing are intentionally outside this slice.

The `tikz-feynhand` extension expands common `\vertex`, `\propag`, and `\propagator` usage into ordinary TikZ nodes and paths. It supports particle/dot/ringdot/crossdot/blob-style vertices, fermion/anti-fermion, boson/photon, gluon, scalar, ghost, charged, and Majorana propagator styles, plus common edge labels and momentum labels. Automatic graph layout and exact PGF decoration internals are approximated.

The `tikz-feynman` extension expands practical `\feynmandiagram`, `\diagram`, `\diagram*`, and `\vertex` syntax into ordinary TikZ. It supports deterministic approximate graph placement for common `horizontal=... to ...` and `vertical=... to ...` diagrams, explicit vertex diagrams, particle labels, edge labels, momentum labels, and common propagator styles including fermion, anti fermion, photon/boson, gluon, scalar, ghost, charged variants, and Majorana lines. Lua graphdrawing layouts are approximated rather than reproduced exactly.

The `tikz-palattice` extension expands accelerator lattice environments into ordinary TikZ paths. It tracks the current beamline position and angle, supports common elements such as drift, dipole, quadrupole, sextupole, kicker, corrector, cavity, solenoid, source, screen, valve, marker, rule, legend, saved coordinates, and simple label/color commands. Curved dipoles and package styling are approximated with deterministic vector geometry rather than a full TeX macro execution model.

The `tikz-qtree` extension expands common `\Tree` bracket syntax into ordinary TikZ nodes and edges. It supports internal nodes like `[.S ...]`, leaf labels, simple embedded `\node(name){...};` labels, explicit `\edge[...]` commands, roof edges, and stable deterministic tree layout. The full pgftree collision-avoidance algorithm and every qtree compatibility macro are approximated.

The `tikzquads` extension provides a practical CircuiTikZ-oriented subset for one-port and two-port network diagrams. It registers `Quad`, `Quad Z`, `Quad Y`, `Quad G`, `Quad H`, `Black Box`, `Thevenin`, `Norton`, and `PG load line` node styles, implements electrical port anchors such as `1+`, `1-`, `2+`, and `2-`, and expands common `\QuadParConnect` usage into ordinary routed TikZ paths. Internal component drawing and fitting keys are approximate but deterministic.

## tikz-network Notes

The `tikz-network` extension supports a practical subset of:

- `\Vertex`
- `\Edge`
- `\Vertices{file.csv}`
- `\Edges{file.csv}`
- `\SetVertexStyle`
- `\SetEdgeStyle`
- `\SetDefaultUnit`
- `\SetDistanceScale`
- `\EdgesInBG`
- `\EdgesNotInBG`

CSV imports need a resolver:

```js
const result = tikzToSvg(source, {
  tikzNetworkFileResolver(fileName, command, commandOptions) {
    if (fileName === "vertices.csv") return "id,x,y,label\nA,0,0,A\nB,2,0,B\n";
    if (fileName === "edges.csv") return "u,v,label\nA,B,ab\n";
    return "";
  }
});
```

## Development Notes

Key source files:

- `src/parser.js`: TikZ-ish parser and statement splitter.
- `src/preprocess.js`: TeX-lite and preprocessing pipeline.
- `src/interpreter.js`: TikZ semantic execution and drawing IR.
- `src/renderer-svg.js`: SVG renderer.
- `src/extensions/`: package/library extension entry points.
- `web/app.js`: browser renderer for code blocks and gallery cases.

Run focused tests while developing:

```bash
node --test test/extensions.test.js
node --test test/tikz-network.test.js
node --test test/renderer.test.js
```

Before handing off:

```bash
npm test
npm run gallery:audit
git diff --check
```

## Design Boundary

TikZKit aims for useful semantic compatibility, not byte-for-byte LaTeX equivalence. Full TeX macro expansion, full PGF internals, and complete PGFPlots are intentionally outside the first stable boundary. The intended path is incremental: add focused extensions and tests for real-world diagrams, while keeping the core IR and renderer predictable.
