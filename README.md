# TikZKit

[![npm](https://img.shields.io/npm/v/@gezhi-io/tikzkit.svg)](https://www.npmjs.com/package/@gezhi-io/tikzkit)

TikZKit is an experimental JavaScript interpreter that renders supported
TikZ, PGF, and PGFPlots source as SVG. It runs in Node.js and modern browsers
without invoking a TeX engine at runtime.

> TikZKit is under active testing. It is not yet a complete replacement for
> TeX, TikZ, or PGFPlots.

## Install

```bash
npm install @gezhi-io/tikzkit
```

Node.js 20 or newer is required.

## Quick Start

```js
import { tikzToSvgAsync } from "@gezhi-io/tikzkit";

const source = String.raw`
\begin{tikzpicture}
  \draw[-stealth, thick] (0,0) -- (2,1) node[right] {$x$};
\end{tikzpicture}`;

const { svg, diagnostics } = await tikzToSvgAsync(source);

if (diagnostics.length) console.warn(diagnostics);
console.log(svg);
```

Use `tikzToSvg(source)` for synchronous rendering. The package also exports
`convertTikzToSvg`, `parseTikz`, `interpretTikz`, and `renderSvg`.

## Examples

The following images were rendered by TikZKit itself.

| Geometric construction | 3D function surface | Chained flowchart |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/gezhi-io/tikzkit/main/docs/images/readme/arbelos.png" width="360" alt="Arbelos construction rendered by TikZKit"> | <img src="https://raw.githubusercontent.com/gezhi-io/tikzkit/main/docs/images/readme/3d-function-4.png" width="360" alt="Three-dimensional function surface rendered by TikZKit"> | <img src="https://raw.githubusercontent.com/gezhi-io/tikzkit/main/docs/images/readme/chains-multiple-joins-flowchart.png" width="360" alt="Flowchart with chained joins rendered by TikZKit"> |

Full sources: [arbelos](test/fixtures/examples/latex-examples/arbelos.tex),
[3D function](test/fixtures/examples/latex-examples/3d-function-4.tex), and
[chained flowchart](test/fixtures/examples/chains/multiple-joins-flowchart.tex).

See the [public example gallery](docs/examples.md) for more committed SVG,
PNG, source, and comparison files. Local files under
`test/fixtures/examples/output/` are generated on demand and do not exist as
permanent GitHub URLs.

Copy this PGFPlots example into the API, CLI, or browser demo:

```tex
\begin{tikzpicture}
  \begin{axis}[
    stack plots=y,
    area style,
    width=10cm,
    height=6cm,
    grid=major,
    legend pos=north west
  ]
    \addplot coordinates {(0,2) (1,3) (2,2) (3,4)} \closedcycle;
    \addplot coordinates {(0,1) (1,2) (2,3) (3,2)} \closedcycle;
    \addplot coordinates {(0,1) (1,1) (2,2) (3,1)} \closedcycle;
    \legend{compute,I/O,validation}
  \end{axis}
\end{tikzpicture}
```

## Visual Comparison

Compatibility work is checked against local MacTeX and `tikztosvg`. This
sheet shows the `tikztosvg` reference, TikZKit output, and their pixel
difference from left to right.

<img src="https://raw.githubusercontent.com/gezhi-io/tikzkit/main/docs/images/readme/stacked-area-comparison.png" width="100%" alt="tikztosvg reference, TikZKit output, and visual difference">

Small text and bounding-box differences remain. The project tracks supported
features and their explicit boundaries in the
[extension registry](docs/extension-registry.md).

## Browser

Use TikZKit with Vite, Parcel, webpack, or another browser bundler:

```js
import { tikzToSvgAsync } from "@gezhi-io/tikzkit";

const { svg } = await tikzToSvgAsync(tikzSource);
document.querySelector("#preview").innerHTML = svg;
```

A complete local browser consumer is available in
[`examples/npm-browser-demo`](examples/npm-browser-demo):

```bash
cd examples/npm-browser-demo
npm install
npm run dev
```

## Fonts

Available from v0.1.5.

SVGs embed their required fonts by default, so they do not depend on a demo
server or system fonts. All bundled glyphs are converted from local MacTeX
fonts; their sources, checksums, and licenses are included in `fonts/manifest.json`.

To share cached font files across many diagrams, serve the package's `.woff`
assets from one directory and use `tikzToSvg(source, { fontUrlPrefix: "/fonts/" })`.
The separate `@gezhi-io/tikzkit/fonts` entry exports `fontManifest` and
`fontStyleSheet`. See [font setup and limitations](docs/fonts.md).

## Markdown

TikZKit can find fenced `tikz` blocks while leaving normal Markdown to the
renderer of your choice:

```js
import { splitTikzCodeBlocks, tikzToSvgAsync } from "@gezhi-io/tikzkit";

for (const part of splitTikzCodeBlocks(markdown)) {
  if (part.type !== "tikz") continue;
  const { svg } = await tikzToSvgAsync(part.content);
  renderSvgBlock(svg);
}
```

````markdown
```tikz
\begin{tikzpicture}
  \draw[->] (0,0) -- (2,0) node[right] {$x$};
\end{tikzpicture}
```
````

## CLI

```bash
npx tikz2svg diagram.tex -o diagram.svg --strict
```

## Documentation

- [Documentation index](docs/README.md)
- [Public example gallery](docs/examples.md)
- [Getting started tutorial](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Fonts](docs/fonts.md)
- [Extension registry](docs/extension-registry.md)
- [Case-driven acceptance](docs/case-driven-acceptance.md)
- [Generated artifact policy](docs/generated-artifacts.md)
- [Visual QA records](docs/qa/)

The tutorial, compatibility notes, and curated images live in the GitHub
repository and are intentionally excluded from the npm package. Large QA
outputs are generated locally and are not linked as permanent GitHub files.

## Develop

```bash
npm install
npm test
npm run docs:links
npm run web
```

Open <http://127.0.0.1:5173/>. Use `PORT=5174 npm run web` when that port is
already occupied.

## Credits

TikZKit has been built and continuously improved through the tireless efforts
of Codex, with source-level study and visual validation against local TeX.
