# `decorations.text`: fit and scale text effects QA

## Scope

This pass implements one bounded `decorations.text` slice: a `text effects
along path` decoration using either `fit text to path` or `scale text to
path`, including the common TikZ spelling where `decoration=...` is placed on
the outer path and the postaction is only `postaction={decorate}`. It does not
promise arbitrary per-character styles, replacement callbacks, or rich TeX
groups.

The permanent driver is
`test/fixtures/examples/decorations/text-effects-fit-scale.tex`:

```tex
\draw[decoration={text effects along path,text={FIT TEXT},
  text effects/.cd,fit text to path},postaction={decorate}] ...;
\draw[decoration={text effects along path,text={FIT TEXT},
  text effects/.cd,scale text to path},postaction={decorate}] ...;
```

## Local MacTeX Study

Reviewed local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex`,
  lines 513-574. `scale text to path` calculates
  `decoratedPathLength/textWidth` and applies it to character nodes and their
  widths. `fit text to path` retains the first leading and last trailing
  half-character widths, then uses the same factor only for the inner
  pre/post widths.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex`.
  The TikZ layer forwards the text-effects keys into the underlying PGF
  decoration.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`.
  The manual defines both modes and warns that mixing repeat, fitting, and
  scaling is not a stable compatibility promise.

TikZKit now stores those two switches on its renderer-neutral decoration-text
item. The SVG renderer scales glyph advance plus font scale for `scale`; for
`fit`, it preserves the two outer half boxes and adjusts each internal
center-to-center step. The postaction lowering also inherits the outer
`decoration` value when its braces contain only `decorate`.

## Three-Way Visual Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its PNG conversion
used `/opt/homebrew/bin/rsvg-convert`. The completed artifact bundle is:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-decorations-text-effects-after-2026-08-08/`

- MacTeX native PNG:
  `mactex-png/decorations-text-effects-fit-scale.png`
- TikZKit SVG/PNG:
  `tikzkit-svg/decorations-text-effects-fit-scale.svg` and
  `tikzkit-png/decorations-text-effects-fit-scale.png`
- tikztosvg SVG/PNG:
  `tikztosvg-svg/decorations-text-effects-fit-scale.svg` and
  `tikztosvg-png/decorations-text-effects-fit-scale.png`
- four-panel visual comparison:
  `diff/decorations-text-effects-fit-scale-native-sheet.png`

I inspected the native, TikZKit, tikztosvg, and diff panels before and after
the implementation. Before, the TikZKit panel showed only the three curved
guides: all ordinary, fitted, and scaled path text was absent because the bare
postaction did not inherit the outer decoration. After, the first line has the
ordinary text, the second visibly spreads the characters across its curve, and
the third visibly enlarges the glyphs across its curve. MacTeX and tikztosvg
show the same three semantic outcomes.

The registered TikZKit/tikztosvg pixel percentage rises from 17.90% before to
22.53% after, so it is deliberately not used as the acceptance signal: the
previous blank output contained fewer non-white glyph pixels, while viewbox
dimensions and Computer Modern rasterization also differ. The meaningful
improvement is that the previously missing three text runs now exist with the
correct normal, fit, and scale behaviors. tikztosvg itself differs from the
native reference by 10.70% changed pixels in this raster setup.

The tikztosvg SVG has `viewBox="0 0 199.45 121.57"`, puts the guide curves in
transformed `<path>` elements, and represents Computer Modern letters as glyph
definitions plus positioned `<use>` instances rather than `<text>` or
`foreignObject`. The scaled line enlarges those glyph outlines. TikZKit keeps
its renderer-neutral glyph layout and emits positioned, rotated SVG `<text>`
glyphs with scaled font size; that structural difference explains remaining
font-edge and bounding-box residuals.

## Commands, Options, And Numbers Audited

- `\usepackage{tikz}`, `\usetikzlibrary{decorations.text}`,
  `\begin{tikzpicture}`, `\draw`, `postaction={decorate}`
- `decoration={text effects along path,...}`, `text={FIT TEXT}`,
  `raise=2pt`, `text effects/.cd`, `fit text to path`, and
  `scale text to path`
- three guide paths at `y=2.5`, `y=1.25`, and `y=0`, each spanning `x=0` to
  `x=8`, with `help lines` / `gray` / `dashed` reference geometry

## Verification

```sh
node --test --test-name-pattern='inherits outer text effects decorations|fits and scales text-effects' \
  test/interpreter.test.js test/svg-renderer.test.js
node scripts/render-example-fixtures.js --only decorations-text-effects-fit-scale \
  --output outputs/qa-decorations-text-effects-after-2026-08-08 \
  --native-reference --strict-tikztosvg
node scripts/diff-example-pngs.js \
  --output outputs/qa-decorations-text-effects-after-2026-08-08 --register
```

The focused two-test command passes. The broad command
`node --test test/interpreter.test.js test/svg-renderer.test.js` still has
pre-existing unrelated color-normalization and bounds failures; this pass did
not add a diagnostics warning to the driver.

## Remaining Work

Exact TeX box metrics, arbitrary rich math/replacement grouping,
character-specific styles, and the manual's undefined repeat-plus-fit/scale
combinations remain partial. The next useful slice is per-character style and
replacement callback handling, backed by a separate native three-way driver.
