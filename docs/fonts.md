# Fonts

TikZKit's font module uses glyph outlines from the locally installed MacTeX
distribution. It does not use KaTeX's font files or download fonts at runtime.
KaTeX supplies math syntax and the fallback HTML layout, not the bundled glyphs.
Fractions, scripts, radicals, ordinary matrices, `aligned`, `cases` and bold
math use a shared native CM box layout at the standard LaTeX sizes.

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
| Sans-serif optical sizes and bold sans | AMS Computer Modern `cmss8/9/10/12/17`, `cmssbx10` Type 1 |
| Typewriter optical sizes | AMS Computer Modern `cmtt8/9/10/12` Type 1 |
| Unicode text and fallback text variants | CM Unicode OpenType |
| `helvet` | TeX Gyre Heros OpenType |
| Ordinary math and extensible symbols | Latin Modern Math OpenType |
| Native formula boxes | CMR/CMMI/CMSY and CMBX/CMMIB/CMBSY optical Type 1 designs selected by local NFSS rules, plus original TFM metrics |
| Native radicals and delimiters | CMEX7/8/9/10 Type 1 glyph chains and assembly recipes |
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

The generated manifest contains 93 faces. Coverage checks find six unfilled
layout slots: Main U+23B0/U+23B1 (small moustaches), AMS U+21E0/U+21E2 (dashed
arrows), and Fraktur-Bold U+E300/U+E307 (private-use alternates). These are
recorded as missing, not supplied from another font distribution. In particular,
do not use the `svg-text` fallback as a fidelity reference for complex Fraktur,
private-use symbols, or unsupported math commands.

For local PNG comparisons, the fixture renderer decodes the packaged WOFF back
to the same OpenType tables before invoking the rasterizer. This avoids a silent
system-font substitution on hosts whose Pango/CoreText cannot load WOFF.

The font builder also sets consistent OpenType weight/style flags and unique
CFF PostScript identities. CSS declarations alone are insufficient: native SVG
rasterizers inspect the font tables, not just the `@font-face` descriptors.
These metadata changes do not modify the source glyph outlines or advances.

## Layered Validation

Do not treat an SVG-text PNG as a screenshot of the default browser renderer.
Supported native formulas use baseline-positioned SVG glyphs in both modes;
other formulas can still use different HTML and SVG-text paths.
Use a locally installed Playwright module and browser, without downloading fonts:

```sh
node scripts/audit-font-rendering.js \
  --output outputs/qa/font-audit \
  --browser-module /absolute/path/to/playwright/index.mjs \
  --browser-channel chrome
```

This checks every face in the manifest and measures 66 TeX boxes at 10/7/5pt.
The 60 supported native-layout probes must agree within 0.015 TeX pt; six
legacy-layout controls are reported separately. Seventeen fixtures pass through
the browser, SVG-text and native PDF. Sixteen use local `tikztosvg`; the
standalone Jordan math array explicitly uses native LaTeX instead.
All raster comparisons retain 96dpi physical size;
there is no independent image fitting or best-offset alignment. The report
records source/font/tool fingerprints, browser version, and both renderers'
diagnostics. `font-audit.html` displays live browser/reference SVG pairs.
Eight formula fixtures also compare every glyph origin in actual browser CSS
pixels against the reference SVG, without fitting or offset alignment.
`node scripts/probe-math-structures.js <output-directory>` independently measures
126 root/matrix/bold combinations. Their recorded native boxes are also covered
by `test/math-structures.test.js`, with a 0.001pt tolerance.
`node scripts/probe-math-alignments.js <output-directory>` measures another
384 native boxes: 16 expressions, 12 sizes and two math versions. The frozen
measurements in `test/math-alignments.test.js` have a 0.003pt tolerance.

The command fails on font substitutions, missing references, browser errors, or
renderer diagnostics, failed native-box tolerances or browser glyph positions.
`visualAccepted` deliberately remains false: human review and unresolved
layout differences must not disappear behind a successful process exit code.
TeX hbox measurements are compared with JS layout reservations, which can
include padding; they are not interchangeable with visible glyph-ink bounds.

See the [font-selection review](qa/2026-10-21-font-selection.md),
[fraction/script review](qa/2026-10-22-fractions-scripts.md),
[root/matrix/bold review](qa/2026-10-22-math-structures.md), and
[alignment/size review](qa/2026-10-22-alignments-sizes.md) for evidence and limits.
The [scoped-font review](qa/2026-10-25-scoped-fonts-failures.md) and
[polar/timeline follow-up](qa/2026-10-25-polar-timeline.md) cover the added
CMTT and CMSS faces, paragraph glue, font restoration and browser comparisons.

The new subset covers ordinary `\frac`, `\dfrac`, `\tfrac`, `_`, `^`, nested
scripts, grouped colors, roman subscripts, and named operators inside these
formulas. It uses TeX numerator/denominator shifts, math axis, rule clearances,
italic corrections and script spacing. AMS packages select optical CMEX
parameters for small sizes; `amsmath[cmex10]` retains fixed CMEX10 parameters.
Radicals use native size variants or assembled CMEX pieces. Ordinary matrices
use baseline struts, column maxima, 5pt array column separation, and math-axis
centering. `\mathbf`, `\boldsymbol`, and `\boldmath` select different native
alphabets without synthetic bolding. Native SVG text requests
`text-rendering="geometricPrecision"` to avoid the browser's extra small-text
stem darkening; the MacTeX outlines and metrics are unchanged.

`aligned` uses right/left equation columns, display-style cells, 10pt between
equation pairs, `\openup\jot` row spacing, and `[t]`/`[b]`/`[c]` positioning.
`cases` uses text-style cells, a native left brace, 1.2 array stretch, and one
text-font quad between its two left-aligned columns. Positive/negative row
skips, nested cases, and ordinary roman `\text{...}` conditions are supported.

The 10pt document profile's `\tiny`, `\scriptsize`, `\footnotesize`, `\small`,
`\normalsize`, `\large`, `\Large`, `\LARGE`, `\huge`, and `\Huge` select the
corresponding native base/script/scriptscript sizes. Explicit 6pt and 10.95pt
math are covered too. Other arbitrary base sizes, sans math, accents,
large-operator limits, `alignedat`/`gathered`/`smallmatrix`, custom array
preambles and tags remain on the older renderer. No unsupported subexpression
is dropped. Numbered document-level `align` and page layout are not certified
by the inline `aligned` implementation.

Run `node scripts/render-mactex-font-smoke.js` for real MacTeX, tikztosvg, SVG,
PNG, and browser comparison artifacts in `outputs/mactex-font-audit-2026-09-06/`.
Run `node scripts/check-font-package.js` to check font exports and both embedded
and shared-asset SVGs from an extracted npm tarball without publishing it.
