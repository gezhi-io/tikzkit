# TikZKit

[![npm](https://img.shields.io/npm/v/@gezhi-io/tikzkit.svg)](https://www.npmjs.com/package/@gezhi-io/tikzkit)

TikZKit is a JavaScript interpreter that renders supported
TikZ, PGF, and PGFPlots source as SVG. It runs in Node.js and modern browsers
without invoking a TeX engine at runtime.

> Usable for supported diagrams and interactive previews, and still under
> active testing. TikZKit is not a complete or pixel-identical replacement for
> TeX, TikZ, or PGFPlots. Check diagnostics and compare important output with TeX.

## Install

```bash
npm install @gezhi-io/tikzkit
```

Node.js 20 or newer is required.
Recent changes on `main` may not be published to npm yet; use a local checkout
to try them (see [Develop](#develop)).

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

From v0.1.6, the SVG canvas is transparent by default. Pass
`{ background: "white" }` as the second argument for a white canvas.

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

Recent browser-checked examples:

| Polar functions | Chronology |
| --- | --- |
| [<img src="https://raw.githubusercontent.com/gezhi-io/tikzkit/main/docs/images/examples/polar-half-plane.png" width="420" alt="Polar functions rendered by TikZKit in Chromium">](docs/examples.md#polar-functions) | [<img src="https://raw.githubusercontent.com/gezhi-io/tikzkit/main/docs/images/examples/chronology.png" width="420" alt="Chronology events rendered by TikZKit in Chromium">](docs/examples.md#chronology) |

Each example includes its source, SVG, and a browser-rendered `tikztosvg`
reference. These are real JS renderings, not substituted TeX images.

## Visual Comparison

Compatibility work is checked against local MacTeX and `tikztosvg`. This
sheet shows the `tikztosvg` reference, TikZKit output, and their pixel
difference from left to right.

<img src="https://raw.githubusercontent.com/gezhi-io/tikzkit/main/docs/images/readme/stacked-area-comparison.png" width="100%" alt="tikztosvg reference, TikZKit output, and visual difference">

Small text and bounding-box differences remain. The project tracks supported
features and their explicit boundaries in the
[extension registry](docs/extension-registry.md).

The 2026-10-25 checkpoint has **3,119 passing tests, zero failures, and 14
existing skips**. The focused polar and chronology browser checks pass;
independent native-PDF pixel comparisons still differ. See the
[validation record](docs/qa/2026-10-25-polar-timeline.md) for scope and limits.

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

The checkout API is `./src/index.js`; the CLI is `node bin/tikz2svg.js`.
MacTeX, `tikztosvg`, and image-conversion tools are only needed to rebuild
native references, not to render SVG with JavaScript.

## Credits

TikZKit has been built and continuously improved through the tireless efforts
of Codex, with source-level study and visual validation against local TeX.
