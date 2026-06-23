# TikZKit

TikZKit is a pure JavaScript TikZ semantic interpreter. It is not a full TeX engine. The goal is to support practical TikZ/PGF drawing semantics in the browser and in Node.js, then render them to SVG.

The current pipeline is:

```text
source -> preprocess extensions -> parser -> semantic interpreter -> drawing IR -> SVG renderer
```

It is designed for browser rendering of fenced TikZ code blocks, CLI conversion, and incremental support for common TikZ libraries.

## Install

```bash
npm install
```

Run the test suite:

```bash
npm test
```

Start the local gallery/web renderer:

```bash
npm run web
```

Open:

```text
http://127.0.0.1:5173/
```

## Browser Usage

The web app renders Markdown-like TikZ code blocks. Both backtick fences and apostrophe fences are supported:

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

## CLI Usage

Convert a `.tikz` or `.tex` file to SVG:

```bash
node bin/tikz2svg.js input.tikz -o output.svg
```

Strict mode treats warnings as blocking:

```bash
node bin/tikz2svg.js input.tex -o output.svg --strict
```

If no output path is provided, the CLI writes `<input-name>.svg`.

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
- PGFPlots subset: common `axis`, `addplot`, function sampling, coordinates, labels, legends, middle axes.
- 3D subset: TikZ `x=`, `y=`, `z=` basis projection.
- TeX-lite macros: common `\def`, `\newcommand`, `\foreach`, `\pgfmathsetmacro`.
- Built-in TikZ/PGF libraries: `\usetikzlibrary{shapes}` and `\usepgflibrary{bbox}` style declarations are treated as core library imports; common `shapes.geometric` and `shapes.symbols` nodes render as SVG paths with node-border anchors, and `bezier bounding box` tightens cubic Bézier viewBox/current-bounding-box calculations.
- Extension-backed libraries: `tikz-network`, `tikz-3dplot`, `tikz-bagua`, `tikz-bpmn`, `tikz-cd`, `tikz-decofonts`, `tikz-dimline`, `tikz-ext`, `tikz-feynhand`, `tikz-feynman`, `tikz-palattice`, `tikz-qtree`, `tikzquads`, and `tikzfxgraph` subsets, plus small compatibility layers for selected graph-style macros.

Unsupported or partially supported syntax should produce diagnostics instead of silently disappearing.

## TikZ Library Registry

`\usetikzlibrary{...}` declarations are parsed separately from source-rewriting extensions. The registry lives in:

```text
src/tikz-libraries.js
```

`parseTikz(source)` records the resolved library list on both `ast.libraries` and each `tikzpicture.libraries`, while the preprocessor removes the raw declaration before statement parsing. This keeps the LaTeX preamble readable to TikZKit without turning `\usetikzlibrary` into a drawing command.

Current core examples:

- `positioning`: implemented by `src/interpreter.js:resolvePositioning`; supports `node distance=<vertical> and <horizontal>`, `right=of`, `below=of`, and edge-to-edge placement from node bounds.
- `matrix`: implemented by `src/parser.js:parseMatrix` and `src/interpreter.js:createMatrix`; supports `matrix of nodes`, `row sep`, `column sep`, `nodes={...}`, `nodes in empty cells`, and `m-row-column` cell anchors.

When adding a built-in TikZ library, add its metadata to `src/tikz-libraries.js`, then implement the actual semantics in the parser/interpreter/renderer layer that owns the behavior. When adding a package-style compatibility layer that rewrites custom commands into ordinary TikZ, use an extension under `src/extensions/`.

## Real Gallery Validation

The project includes scripts for comparing JS output against native MacTeX output:

```bash
npm run gallery:audit
npm run gallery:native
npm run gallery:js
npm run gallery:diff
```

Generated files go under `outputs/real-gallery/`.

- `gallery:audit`: renders the configured real cases and reports diagnostics.
- `gallery:native`: uses local TeX tools to build native PNG references.
- `gallery:js`: renders JS SVG/PNG outputs.
- `gallery:diff`: compares native and JS PNGs.

The local web app at `http://127.0.0.1:5173/` exposes already-added external
corpora from the top toolbar's `案例集` selector. The core gallery stays as the
default fast view; Janosh, f0nzie, Walmes, circuitikz, and
hackl/TikZ-StructuralAnalysis cases are loaded on demand through local
`/api/corpora` endpoints so the page does not eagerly render every corpus at
startup.

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
