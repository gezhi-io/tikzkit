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

Use this repository as a work-in-progress renderer and testbed, not as a stable
implementation.

The current pipeline is:

```text
source -> preprocess extensions -> parser -> semantic interpreter -> drawing IR -> SVG renderer
```

It is designed for browser rendering of fenced TikZ code blocks, CLI conversion, and incremental support for common TikZ libraries.

### Current validation scope

- A selected 30-case LaTeX-examples batch currently renders without diagnostics
  and stays within 1.5pt of the local `tikztosvg` canvas dimensions.
- Those 30 JS/reference/diff sheets have been reviewed visually. This is a
  focused compatibility gate, not a claim that arbitrary TikZ input works.
- Exact glyph hinting and antialiasing can still differ between browser SVG and
  PDF-to-SVG output even when geometry and text placement agree.
- `shapes.multipart` now verifies horizontal `rectangle split` part alignment
  for `center`, `top`, `bottom`, and `base`; vertical split alignment and the
  broader multipart shape family remain partial.
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

Start from a clean checkout:

```bash
npm install
npm test
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

## Browser Workbench

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
  --preserve-output

node scripts/diff-example-pngs.js --output outputs/qa-my-feature
```

The output directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, optional
1cm-grid variants, per-case diff PNGs, and an `index.html` comparison page.
Use `node scripts/render-example-fixtures.js --help` and
`node scripts/diff-example-pngs.js --help` to inspect the supported switches.

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

## Supported TikZ Surface

Current support is pragmatic and growing. Highlights:

- Basic drawing commands: `\draw`, `\path`, `\fill`, `\filldraw`, `\node`, `\coordinate`.
- Common paths: lines, rectangles, circles, ellipses, arcs, grids, orthogonal `|-` / `-|`, `to`, `edge`, bend edges, self loops.
- Styles: `\tikzset`, `\tikzstyle`, color definitions, line widths, dash patterns, opacity, arrow tips.
- Nodes: named nodes, compass anchors, angle anchors, shape borders, circle/rectangle/diamond, text and math sizing approximations.
- Positioning: `right=... of A`, `below right=... of A`, legacy `right of=A`, shifts, node distance.
- Matrices: common `matrix of nodes`, empty cells, row style overrides, matrix cell anchors.
- Calc-like coordinates: named coordinates, `($(A)+(1,2)$)`, interpolation, projections.
- Intersections: named paths and common path intersections.
- Decorations: markings, arrows along paths, snake/brace/zigzag approximations.
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
  `style`, and `line width` pass through. Cache IDs, tangents, areas,
  asymptotes, adaptive sampling, advanced paint keys, and general parametric
  discontinuity analysis remain outside the verified boundary. See
  [`docs/qa/2026-08-05-tkz-fct-parametric.md`](docs/qa/2026-08-05-tkz-fct-parametric.md),
  [`docs/qa/2026-08-05-tkz-fct-polar.md`](docs/qa/2026-08-05-tkz-fct-polar.md),
  [`docs/qa/2026-08-05-tkz-draw-axes.md`](docs/qa/2026-08-05-tkz-draw-axes.md),
  [`docs/qa/2026-08-05-tkz-axis-labels.md`](docs/qa/2026-08-05-tkz-axis-labels.md),
  and [`docs/qa/2026-08-05-tkz-axis-styles.md`](docs/qa/2026-08-05-tkz-axis-styles.md).

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
- Multipart nodes: horizontal `rectangle split` nodes support `\nodepart`, per-part fills, named anchors, and `rectangle split ignore empty parts`; ignored slots are removed while their bare anchors resolve to the preceding visible part, matching PGF's B-tree and manual examples.

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

Load the library in the usual TikZ form. For a horizontal split, `\nodepart`
starts the next logical part. `rectangle split ignore empty parts` removes empty
parts after the first text part; fills retain their original logical part index.

```tex
\usetikzlibrary{shapes.multipart}
\begin{tikzpicture}
  \node[rectangle split,rectangle split horizontal,rectangle split parts=4,
    rectangle split ignore empty parts,draw] (record)
    {left\nodepart{two}\nodepart{three}right\nodepart{four}};
  \draw (record.two) -- (record.three);
\end{tikzpicture}
```

The implemented slice covers horizontal layouts. Vertical rectangle splits,
all per-part `top`/`base`/`bottom` alignment modes, and the full PGF anchor
surface remain under test.

## TikZ Library Registry

`\usetikzlibrary{...}` declarations are parsed separately from source-rewriting extensions. The per-library metadata lives in:

```text
src/tikz/libraries/
```

`parseTikz(source)` records the resolved library list on both `ast.libraries` and each `tikzpicture.libraries`, while the preprocessor removes the raw declaration before statement parsing. This keeps the LaTeX preamble readable to TikZKit without turning `\usetikzlibrary` into a drawing command.

Current core examples:

- `positioning`: supports `node distance=<vertical> and <horizontal>`, `right=of`, `below=of`, and edge-to-edge placement from node bounds.
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
