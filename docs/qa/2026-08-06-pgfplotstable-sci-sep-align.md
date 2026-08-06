# pgfplotstable Scientific Exponent Alignment QA (2026-08-06)

## Scope

This slice adds `sci sep align` to the existing `\pgfplotstabletypeset` path.
It accepts the currently supported standard scientific printer (`sci`, plus the
scientific result of `int detect`) and aligns its exponent block column-wide.
It does not claim arbitrary PGF number formatting or all scientific styles.

The real fixture is
`test/fixtures/examples/pgfplots/pgfplotstable-sci-sep-align.tex`, adapted
from the TeX Live manual. Its mantissas have visibly different widths (`1`,
`9.8`, and `1.23`), use three different exponents, and include an exponent-zero
value. It therefore detects both a false whole-cell centering layout and a
missing `10^0` block.

## Local MacTeX Study

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/numtable/pgfplotstable.code.tex`,
  lines 298-330: `sci sep align` requires `array`, replaces the scientific
  exponent mark with `$&$`, creates an `r@{}l` pair, and emits a two-column
  header with `\multicolumn`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfloat.code.tex`,
  lines 819-899: standard scientific output puts the configurable exponent
  marker immediately before `\cdot 10^{n}`. The aligned printer therefore
  still produces the exponent-zero form `\cdot 10^{0}`.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplotstable.pdf`,
  pages 13-15: distinguishes `sci sep align` from decimal alignment and
  `dcolumn`.

TikZKit records the same semantic split through a non-user-visible
`\\tikzkitscialign{mantissa}{exponent}` table-cell marker. The generic tabular
scene layout measures the two math fragments once per column, right-aligns the
mantissa and left-aligns `\cdot 10^n` on the shared exponent anchor. Splitting
the math cell no longer applies formula-box padding twice.

## Implemented Parameters

| Command or key | Status | Boundary |
| --- | --- | --- |
| `\pgfplotstabletypeset` | implemented subset | inline or registered tables only |
| `columns/<name>/.style` | implemented subset | selected column styles |
| `sci`, `sci precision`, `sci zerofill` | implemented subset | existing standard scientific printer |
| `int detect` | implemented subset | non-integers use the scientific branch |
| `sci sep align` | implemented | standard scientific cells; tail begins at one exponent anchor |
| exponent `0` under `sci sep align` | implemented | emits `\cdot 10^0` like local TeX Live |
| `sci subscript` | implemented separately | direct `mantissa_{exponent}` form; it does not create an `sci sep align` split |
| `sci superscript` | implemented separately | direct `mantissa^{exponent}` form; it does not create an `sci sep align` split |
| `sci generic`, `dcolumn` | not implemented | custom exponent representations or package behavior |
| `NaN`, infinities, arbitrary post-processing | partial | native special-value/multicolumn path not generalized |

## SVG and Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Artifacts are in
`/private/tmp/tikzkit-qa-pgfplotstable-sci-sep-align-2026-08-06`:

- TikZKit SVG/PNG: `tikzkit-svg/pgfplotstable-sci-sep-align.svg` and
  `tikzkit-png/pgfplotstable-sci-sep-align.png`.
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfplotstable-sci-sep-align.svg` and
  `tikztosvg-png/pgfplotstable-sci-sep-align.png`.
- MacTeX PNG and four-panel sheet:
  `mactex-png/pgfplotstable-sci-sep-align.png` and
  `diff/pgfplotstable-sci-sep-align-native-sheet.png`.

I inspected the JS, tikztosvg, MacTeX, grid, and registered-diff panels. The
before state centered each whole `$mantissa\\cdot10^n$` cell independently and
suppressed the zero exponent. The JS result now shares the visible start of
`\cdot 10^n` for all four values, matches the references' retained `1\cdot
10^0`, and keeps the `Power` heading intact. JS and tikztosvg PNG canvases are
both `129 x 80` pixels; their root SVGs are both `96.6pt x 59.78pt` after the
comparison pipeline was corrected to preserve source preview borders.

The tikztosvg SVG uses path outlines rather than SVG `<text>` elements, with
`viewBox="0 0 96.6 59.78"`; its glyph rasterization consequently differs from
TikZKit's font-backed SVG even when the anchor geometry agrees. The registered
pixel comparison is supporting evidence only (`20.73%` changed, mean RGBA
`0.0608`): direct panel inspection confirms the functional change is aligned.

## Regression

```bash
npm test -- test/pgfplotstable-typeset.test.js \
  test/example-render-script.test.js \
  test/tabular-picture-layout.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplotstable-sci-sep-align-2026-08-06 \
  --only pgfplotstable-sci-sep-align --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output \
  /private/tmp/tikzkit-qa-pgfplotstable-sci-sep-align-2026-08-06 \
  --register --alignment-radius 3
```

The regression asserts that all mantissa and exponent fragments use the same
SVG x-anchor, and that the exponent-zero fragment remains visible.
