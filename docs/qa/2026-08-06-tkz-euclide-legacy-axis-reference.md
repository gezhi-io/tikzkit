# Legacy tkz-euclide Axis References And `ticks=false`

## Scope

This slice covers the old `tkz-euclide`/`tkz-fct` Cartesian frame form used by
five real fixtures: `latex-examples-hyperbolic-geometry-not-parallel`,
`latex-examples-hyperbolische-geometrie-axiom-1-1`,
`latex-examples-hyperbolische-geometrie-axiom-1-2`,
`latex-examples-hyberbolische-geometrie-1`, and
`latex-examples-hyberbolische-geometrie-2`. Its boundary is package migration
for disposable local references plus the shared browser semantics of
`\tkzAxeXY[ticks=false]`; it does not claim general `tkz-base` or
`tkz-euclide` completion.

## Local TeX Review

Read these installed TeX Live 2025 sources and documents:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-base.sty`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-tools-base.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-obj-axes.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-base/TKZdoc-base-axes.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-fct/tkz-fct.sty`
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-fct/TKZdoc-fct-main.tex`

The installed packages require `tkz-base` and `tkz-fct` before
`tkz-euclide`. `tkzInit` owns the source bounds and local origin. `tkzAxeXY`
combines draw and label operations, whereas `noticks` is a key only of
`tkzDrawX` and `tkzDrawY`; it cannot be passed back through `tkzAxeXY`.
Therefore the legacy `ticks=false` form is represented by
`tkzDrawXY[noticks]`: arrowed axes and terminal `x`/`y` labels remain, while
graduation marks and their numeric labels disappear.

## Implementation

- `scripts/render-example-fixtures.js` adapts only disposable MacTeX and
  tikztosvg reference source: it removes `\usetkzobj{...}`, reorders
  `tkz-base`, `tkz-fct`, and `tkz-euclide`, and lowers the old axis shorthand.
  Fixture files and browser runtime inputs are not rewritten.
- `src/extensions/tkz-fct.js` applies matching JavaScript semantics to
  `\tkzAxeXY[ticks=false]`.
- `test/example-render-script.test.js` checks reference ordering and lowering;
  `test/tkz-fct.test.js` checks the browser's draw-only output.

## Artifact Review

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The final five-way artifact set is under:

`/private/tmp/tikzkit-qa-tkz-euclide-legacy-axis-visual-after-2026-08-06/`

Each case contains `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`,
`tikztosvg-png/`, `mactex-png/`, SVG-layer 1cm grids, and a four-panel native
sheet in `diff/`. For example:

- `/private/tmp/tikzkit-qa-tkz-euclide-legacy-axis-visual-after-2026-08-06/diff/latex-examples-hyberbolische-geometrie-1-native-sheet.png`
- `/private/tmp/tikzkit-qa-tkz-euclide-legacy-axis-visual-after-2026-08-06/diff/latex-examples-hyberbolische-geometrie-2-native-sheet.png`

All five now produced JS SVG/PNG, tikztosvg SVG/PNG, and MacTeX PNG. Before
the reference migration, the last two failed because current `tkz-fct` rejects
the historical package order and current `tkz-base` rejects `ticks=false`.

The inspected panels show the visible change: before the browser drew a full
numbered frame for the two `hyberbolische-geometrie` cases; afterwards its
lower-left panel keeps the horizontal/vertical arrows, the `x`/`y` terminal
labels, rays, semicircles, points, and formula labels, but no longer adds
numeric ticks that are absent from the MacTeX and tikztosvg top panels. The
first case's TikZKit/tikztosvg canvas changed from `340x162` to `327x156` for a
`327x155` reference; the second changed from `245x162` to `232x162` for a
`233x161` reference. These values support the observed removal; acceptance is
based on the viewed geometry rather than the residual alone.

The three already-compilable axis fixtures retained their semicircles, dashed
construction lines, orange segments, black points, labels, and axis placement
after the shared change. They were included as a no-regression visual set.

## Commands

```bash
node --test test/tkz-fct.test.js test/example-render-script.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-tkz-euclide-legacy-axis-visual-after-2026-08-06 \
  --only latex-examples-hyperbolic-geometry-not-parallel \
  --only latex-examples-hyperbolische-geometrie-axiom-1-1 \
  --only latex-examples-hyperbolische-geometrie-axiom-1-2 \
  --only latex-examples-hyberbolische-geometrie-1 \
  --only latex-examples-hyberbolische-geometrie-2 \
  --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-tkz-euclide-legacy-axis-visual-after-2026-08-06 \
  --register --alignment-radius 3
```

## Remaining Work

The full `tkz-base` option grammar, arbitrary custom tick/label combinations,
and broader historical `tkz-euclide` command migration remain partial. The two
focused cases still differ slightly in axis stroke/canvas crop and TeX glyph
rasterization; the next pass should measure those axis-end and text-bbox
differences without changing the established draw-only `ticks=false` behavior.
