# TikZKit

TikZKit is an experimental JavaScript interpreter for practical TikZ/PGF
drawing semantics. It converts TikZ source into SVG in Node.js or in a bundled
browser app.

It is not a TeX engine and is not a complete replacement for TikZ, PGF, or
PGFPlots. Compatibility is added and visually checked case by case.

## Credits

TikZKit has been built and continuously improved through the tireless efforts
of Codex, with visual validation against local MacTeX and `tikztosvg`.

## Install

```bash
npm install @gezhi-io/tikzkit
```

TikZKit requires Node.js 20 or newer.

## Node.js

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

Use `tikzToSvg(source)` for synchronous rendering. The public package also
exports `parseTikz`, `interpretTikz`, and `renderSvg` for integrations that
need the intermediate stages.

## Markdown

TikZKit detects fenced code blocks whose language is `tikz`:

````markdown
# A small diagram

```tikz
\begin{tikzpicture}
  \draw[->] (0,0) -- (2,0) node[right] {$x$};
  \draw[->] (0,0) -- (0,1.5) node[above] {$y$};
\end{tikzpicture}
```
````

Split Markdown into renderable parts with `splitTikzCodeBlocks` and pass each
TikZ part to `tikzToSvgAsync`:

```js
import { splitTikzCodeBlocks, tikzToSvgAsync } from "@gezhi-io/tikzkit";

for (const part of splitTikzCodeBlocks(markdown)) {
  if (part.type === "tikz") {
    const { svg } = await tikzToSvgAsync(part.content);
    // Insert the SVG using your framework or Markdown renderer.
  }
}
```

TikZKit intentionally does not render the surrounding Markdown. Use a
Markdown library of your choice for prose, headings, links, and sanitization.

## Browser Demo

The repository includes a small browser consumer at
[`examples/npm-browser-demo`](examples/npm-browser-demo). It imports the
published npm package through a browser import map and renders a Markdown TikZ
code block:

```bash
cd examples/npm-browser-demo
npm install
npm run dev
```

Open the local URL shown in the terminal. The sample server exists only for
local development: it serves the installed npm package and its browser
dependencies. A production application should use its usual bundler or an
equivalent import-map setup.

## CLI

```bash
npx tikz2svg diagram.tex -o diagram.svg --strict
```

Options:

```text
--strict                 Treat diagnostics as failures
--math-renderer svg-text Use the SVG text math backend
--unit <pxPerCm>         Set SVG pixels per centimetre
--margin <px>            Set canvas margin
```

## Local Workbench

Clone this repository when working on compatibility or using the local editor:

```bash
npm install
npm run web
```

Then open <http://127.0.0.1:5173/>. The workbench renders entirely in browser
JavaScript; it does not invoke TeX or an external service.

## Development

```bash
npm test
```

For real-case compatibility work, compare TikZKit against local MacTeX and
`tikztosvg` rather than accepting a rendering solely because it is visible.

Useful project documentation:

- [Usage guide](docs/usage.md)
- [Architecture](docs/architecture.md)
- [Extension registry](docs/extension-registry.md)
- [Visual QA records](docs/qa)

## Status

TikZKit is under active testing. Complex TeX macro expansion, exact native font
metrics, complete PGFPlots behavior, and many third-party packages remain
partial or unsupported. Check the extension registry and visual QA records
before relying on a feature in production.
