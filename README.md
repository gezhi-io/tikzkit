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

For the shortest practical path through the workbench, CLI, JavaScript API, and
three-way visual verification, see the Chinese [usage guide](docs/usage.md).

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

### 使用速览

用下面这条最短路径就可以开始。浏览器页面只运行 TikZKit 的 JavaScript
解释器；它不会悄悄调用本机 TeX。只有在需要判断是否接近原生 TikZ 时，才
执行本地参考渲染。

```bash
# 1. 安装并打开本地编辑器。
npm install
npm run web

# 2. 在浏览器打开 http://127.0.0.1:5173/，选择一个案例或直接编辑源码。

# 3. 将单个源文件转换成可嵌入的 SVG。
node bin/tikz2svg.js path/to/diagram.tex -o outputs/diagram.svg

# 4. 修改渲染逻辑后，先检查维护中的案例没有新增诊断。
npm run gallery:audit
```

要验证一个视觉改动，使用该案例在清单中的完整 fixture ID，例如
`decorations-snake-arrow-lengths`。下面的命令会把 JavaScript SVG/PNG、
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

### Current validation scope

- A selected 30-case LaTeX-examples batch currently renders without diagnostics
  and stays within 1.5pt of the local `tikztosvg` canvas dimensions.
- Those 30 JS/reference/diff sheets have been reviewed visually. This is a
  focused compatibility gate, not a claim that arbitrary TikZ input works.
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
- PGFPlots legend rows with `legend cell align=left` retain their shared left
  anchor when the browser uses its cached SVG text engine. This removes a real
  clipping/misalignment defect in `latex-examples-2d-epochs-overfitting`; exact
  legend-box sizing and final text/bounding-box calibration remain partial.
- Package and library support is intentionally partial unless documented
  otherwise. See [the 30-case acceptance record](docs/qa/latex-examples-new30.md)
  for tested commands, parameters, and remaining boundaries.

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

`gallery:audit` should currently report `276/276 rendered, 0 diagnostics`.
These commands use only the resources declared in
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
the native MacTeX panel as the acceptance target. The converter's fixed wrapper
preamble can expose a different root order for scale-sensitive legacy geometry
macros. The focused line-circle check is:

```bash
node --test test/tkz-euclide.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-tkz-interlc \
  --only tkz-euclide-line-circle-intersections \
  --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output outputs/qa-tkz-interlc
```

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

`svg-text` avoids SVG `foreignObject` and is useful for raster comparison tools. The default renderer uses KaTeX for richer math in browser SVG.

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
- Pattern fills: built-in pattern metadata plus a focused `\pgfdeclarepatternformonly` slice. Constant `\pgfpoint`/`\pgfqpoint` tile geometry and line, circle, rectangle, close, fill, and stroke primitives are supported; pattern transforms, mutable/inherently-colored patterns, and arbitrary TeX drawing procedures remain unsupported.
- Nodes: named nodes, compass anchors, angle anchors, shape borders, circle/rectangle/diamond, text and math sizing approximations.
- Positioning: `right=... of A`, `below right=... of A`, legacy `right of=A`, shifts, node distance.
- Matrices: common `matrix of nodes`, empty cells, row style overrides, matrix cell anchors.
- Calc-like coordinates: named coordinates, `($(A)+(1,2)$)`, interpolation, projections.
- Intersections: named paths and common path intersections.
- Decorations: markings, arrows along paths, snake/brace/zigzag approximations.
  The verified `snake` subset keeps `pre length`, `segment length`, `amplitude`,
  and `post length` on the complete input subpath. Adding `-stealth` or another
  terminal tip shortens only the final painted lead; it does not change the
  wave phase or the requested decoration lengths. See the Case 005 driver at
  `test/fixtures/examples/decorations/snake-arrow-lengths.tex` and its QA
  record in `docs/qa/2026-08-06-snake-arrow-phase.md`.
- Calendar: normal Monday-first `week list` calendars, basic date predicates,
  day-node styles, and multi-month vertical placement. `week list` variants,
  localized names, and executable calendar hooks remain partial; use the
  `calendar-week-list-multimonth` fixture and its QA record as the current
  verified boundary.
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
`\pgfusepath{fill}` and `\pgfusepath{stroke}`. Keep the tile geometry constant;
pattern transforms and declarations with executable TeX arguments are still
outside the supported boundary.

## TikZ Library Registry

`\usetikzlibrary{...}` declarations are parsed separately from source-rewriting extensions. The per-library metadata lives in:

```text
src/tikz/libraries/
```

`parseTikz(source)` records the resolved library list on both `ast.libraries` and each `tikzpicture.libraries`, while the preprocessor removes the raw declaration before statement parsing. This keeps the LaTeX preamble readable to TikZKit without turning `\usetikzlibrary` into a drawing command.

Current core examples:

- `positioning`: supports `node distance=<vertical> and <horizontal>`, normal edge-to-edge `right=of` / `below=of`, `on grid` centre-to-centre placement, and `base left/right` / `mid left/right` for one-line text and formula nodes. The latter use their corresponding TeX-style text anchors; complex multi-line box metrics remain partial.
- `matrix`: supports `matrix of nodes`, `row sep`, `column sep`, `nodes={...}`, `nodes in empty cells`, and `m-row-column` cell anchors.
- `automata`: supports state circles, split output states, accepting/initial arrows, and `initial by diamond` when the source also loads `shapes.geometric`.

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
