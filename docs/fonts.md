# Fonts

TikZKit's font module uses glyph outlines from the locally installed MacTeX
distribution. It does not use KaTeX's font files or download fonts at runtime.
KaTeX is still the HTML math layout engine, not the source of the bundled glyphs.

## Default: Portable SVG

```js
import { tikzToSvg } from "@gezhi-io/tikzkit";

const { svg, diagnostics } = tikzToSvg(String.raw`
\begin{tikzpicture}
  \node {$\mathbb R,\quad\mathcal A,\quad\sum_{i=1}^n x_i$};
\end{tikzpicture}`);
```

The SVG embeds WOFF fonts for the families used in its rendered content.
No `/node_modules/` or demo-server font URL is needed. Embedded fonts increase
the SVG size; browsers can render it offline after the library has loaded.

## Shared Assets

For a page containing many diagrams, copy the assets once during your build:

```js
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fontManifest } from "@gezhi-io/tikzkit/fonts";

const require = createRequire(import.meta.url);
await mkdir("public/fonts", { recursive: true });
for (const file of new Set(fontManifest.flatMap(font => [font.file, font.license]))) {
  await copyFile(require.resolve(`@gezhi-io/tikzkit/fonts/${file}`), `public/fonts/${file}`);
}
```

Then use the same prefix for text and math:

```js
const { svg } = tikzToSvg(source, { fontUrlPrefix: "/fonts/" });
```

Serve fonts from the same origin, or configure CORS on your font host. The
prefix is relative to the document displaying the SVG. It must remain reachable
when exporting the file; omit it for a self-contained SVG.

`@gezhi-io/tikzkit/fonts` also exports
`fontStyleSheet({ families, fontUrlPrefix })`. This is a separate module and
asset entry within the main package, not a separately published dependency.
Keeping it in the same release prevents renderer/font-version mismatches.
The current synchronous renderer still imports its embedded font data; external
URLs reduce SVG duplication, not the library's JavaScript download size.

## MacTeX Sources

| Use | Local source family |
| --- | --- |
| Roman optical sizes and small caps | AMS Computer Modern `cmr`, `cmbx`, `cmcsc10` Type 1 |
| Unicode text, sans serif, monospace | CM Unicode OpenType |
| `helvet` | TeX Gyre Heros OpenType |
| Ordinary math and extensible symbols | Latin Modern Math OpenType |
| `\mathcal` | CMSY / CMBSY Type 1 |
| `\mathbb` capitals | MSBM10 Type 1; remaining symbols use LM Math |
| `\mathfrak` | Euler EUFM / EUFB Type 1 |

`web/fonts/manifest.json` records each source path relative to `TEXMFDIST`, its
SHA-256 digest, the generated file's digest, and the applicable font license.
The OFL and GUST license texts and source notices accompany the assets. Font
family names are changed to TikZKit names to avoid replacing installed fonts.

Rebuild from your local TeX distribution with `npm run font:build`. This needs
`kpsewhich`, Python, and fontTools installed locally. The script does not fetch
font files. In the development checkout, legacy MacTeX OTF text assets remain
for older local tools; the new renderer uses the manifest's WOFF assets.

## Sizes and Limits

TeX points are converted using 72.27 pt per inch, not CSS's 72 points per inch.
Text size commands select optical Roman designs when available. Display style
does not enlarge all letters: large operators and delimiters select their own
font variants. Math layout measures height and depth so upper/lower limits are
not clipped by the SVG foreign object.

This is not a complete TeX font system. Arbitrary NFSS substitutions, every
OpenType math variant, and exact line breaking/kerning remain partial. Browser
HTML math and the `svg-text` fallback are different painting paths; the fallback
cannot reproduce every formula. A font loading successfully is not proof of
pixel-identical LaTeX output.

The generated manifest contains 53 faces. Coverage checks find six unfilled
layout slots: Main U+23B0/U+23B1 (small moustaches), AMS U+21E0/U+21E2 (dashed
arrows), and Fraktur-Bold U+E300/U+E307 (private-use alternates). These are
recorded as missing, not supplied from another font distribution. In particular,
do not use the `svg-text` fallback as a fidelity reference for complex Fraktur,
private-use symbols, or unsupported math commands.

For local PNG comparisons, the fixture renderer decodes the packaged WOFF back
to the same OpenType tables before invoking the rasterizer. This avoids a silent
system-font substitution on hosts whose Pango/CoreText cannot load WOFF.

Run `node scripts/render-mactex-font-smoke.js` for real MacTeX, tikztosvg, SVG,
PNG, and browser comparison artifacts in `outputs/mactex-font-audit-2026-09-06/`.
Run `node scripts/check-font-package.js` to check font exports and both embedded
and shared-asset SVGs from an extracted npm tarball without publishing it.
