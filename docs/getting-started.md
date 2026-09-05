# Getting Started with TikZKit

This tutorial covers the npm package, Node.js, browser rendering, Markdown
integration, the CLI, and the diagnostics you should check before accepting an
SVG.

TikZKit is experimental. Supported TikZ is interpreted directly in JavaScript;
MacTeX and `tikztosvg` are development references, not runtime dependencies.

## 1. Install

Create a project with Node.js 20 or newer:

```bash
mkdir tikzkit-demo
cd tikzkit-demo
npm init -y
npm install @gezhi-io/tikzkit
```

Add `"type": "module"` to `package.json` when using the ESM examples below.

## 2. Render SVG in Node.js

Create `render.js`:

```js
import { writeFile } from "node:fs/promises";
import { tikzToSvgAsync } from "@gezhi-io/tikzkit";

const source = String.raw`
\begin{tikzpicture}
  \draw[rounded corners, fill=blue!10] (0,0) rectangle (3,1.5);
  \draw[-stealth, very thick, red] (0.4,0.4) -- (2.5,1.1);
  \node at (1.5,0.75) {$f(x)=x^2$};
\end{tikzpicture}`;

const result = await tikzToSvgAsync(source);

if (result.diagnostics.length > 0) {
  console.warn(result.diagnostics);
}

await writeFile("diagram.svg", result.svg);
```

Run it:

```bash
node render.js
```

Open `diagram.svg` in a browser. Treat diagnostics as part of the result: an
SVG can still be produced when a command or option is only partially handled.

## 3. Render in a Browser

The easiest browser setup uses Vite:

```bash
npm create vite@latest browser-demo -- --template vanilla
cd browser-demo
npm install
npm install @gezhi-io/tikzkit
```

Replace `src/main.js` with:

```js
import { tikzToSvgAsync } from "@gezhi-io/tikzkit";

document.querySelector("#app").innerHTML = `
  <textarea id="source" rows="12" cols="60"></textarea>
  <button id="render">Render</button>
  <pre id="diagnostics"></pre>
  <div id="preview"></div>
`;

const source = document.querySelector("#source");
const preview = document.querySelector("#preview");
const diagnostics = document.querySelector("#diagnostics");

source.value = String.raw`\begin{tikzpicture}
  \draw[->] (-1,0) -- (3,0) node[right] {$x$};
  \draw[->] (0,-1) -- (0,2) node[above] {$y$};
  \draw[blue, thick] plot coordinates {(-1,1) (0,0) (1,1) (2,0)};
\end{tikzpicture}`;

async function render() {
  const result = await tikzToSvgAsync(source.value);
  preview.innerHTML = result.svg;
  diagnostics.textContent = JSON.stringify(result.diagnostics, null, 2);
}

document.querySelector("#render").addEventListener("click", render);
render();
```

Then run `npm run dev` and open the URL printed by Vite. The repository also
contains a ready-to-run consumer in `examples/npm-browser-demo`.

## 4. Render a PGFPlots Chart

TikZKit accepts a growing subset of PGFPlots. This equal-grid stacked-area
example uses the recently validated `stack plots=y`, `area style`, and
`\closedcycle` path:

```tex
\begin{tikzpicture}
  \begin{axis}[
    stack plots=y,
    area style,
    width=10cm,
    height=6cm,
    xmin=0,
    xmax=5,
    ymin=0,
    ymax=12,
    enlargelimits=false,
    grid=major,
    legend style={at={(0.5,-0.2)},anchor=north,legend columns=-1}
  ]
    \addplot coordinates {(0,2) (1,3) (2,2) (3,4) (4,3) (5,2)} \closedcycle;
    \addplot coordinates {(0,1) (1,2) (2,3) (3,2) (4,2) (5,1)} \closedcycle;
    \addplot coordinates {(0,1) (1,1) (2,2) (3,1) (4,3) (5,2)} \closedcycle;
    \legend{compute,I/O,validation}
  \end{axis}
\end{tikzpicture}
```

Current boundary: this supports equal-grid 2D y-stacked coordinate or table
plots with sharp, smooth, or constant handlers. Function stacking,
x-stacked closed areas, mismatched grids, logarithmic axes, and 3D area
stacking remain outside this slice.

## 5. Render TikZ Blocks in Markdown

Split fenced blocks, send ordinary Markdown to your normal Markdown renderer,
and replace only `tikz` blocks with SVG:

```js
import { splitTikzCodeBlocks, tikzToSvgAsync } from "@gezhi-io/tikzkit";

export async function renderTikzBlocks(markdown) {
  const rendered = [];

  for (const part of splitTikzCodeBlocks(markdown)) {
    if (part.type === "tikz") {
      const result = await tikzToSvgAsync(part.content);
      rendered.push({ type: "svg", content: result.svg, diagnostics: result.diagnostics });
    } else {
      rendered.push(part);
    }
  }

  return rendered;
}
```

## 6. Use the CLI

```bash
npx tikz2svg diagram.tex -o diagram.svg --strict
```

Useful options:

```text
--strict
--math-renderer svg-text
--unit <pixels-per-centimetre>
--margin <pixels>
```

`--strict` exits unsuccessfully when diagnostics contain unsupported input.

## 7. Check Compatibility

Before relying on a command, package, or library:

1. Check the [extension registry](extension-registry.md).
2. Inspect `result.diagnostics` after every render.
3. Compare important output with native TeX when exact geometry or typography
   matters.
4. Keep the source fixture small enough to isolate unsupported behavior.

Project contributors can reproduce the full TikZKit, `tikztosvg`, and MacTeX
comparison workflow described in [case-driven acceptance](case-driven-acceptance.md).
