# PGFPlots Middle-Axis `enlargelimits`

## Scope

This slice covers one PGFPlots range family: `axis x line=middle` and
`axis y line=middle`, with an explicit range on one axis, an inferred
single-sign range on the other, and `enlargelimits=true`. It does not change
fully inferred axes, explicit bounds, log axes, or 3D surface ranges.

The driver is
`test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex`.
It declares `xmin=-1.5`, `xmax=1.5`, a positive `y=x^2` plot, middle axes,
outside ticks, and `enlargelimits=true`.

## Local Implementation Study

Read the local PGFPlots source:

`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`

- `/pgfplots/enlargelimits` delegates to the independent x/y/z controls.
- The `true` form enables both lower and upper enlargement flags.
- The default relative enlargement is 10 percent of the resolved span.

PGFPlots applies that expansion while resolving the surveyed axis range. A
middle axis then has its separate geometry transform/reserve. The prior JS
implementation only supplied the latter, so the semantic y range remained
`0..2.25` rather than the native `0..2.475`.

## Change

`src/pgfplots/rangeResolver.js` now recognizes this zero-preserving middle-axis
family. When the nonzero bound is inferred, `enlargelimits=true` applies the
default 10 percent survey expansion to that far bound. The existing geometry
layer still adds its opposite transform reserve. For the driver this produces:

```text
surveyed range:  x=-1.5..1.5, y=0..2.475
transform range: x=-1.8..1.8, y=-0.225..2.475
```

The change is shared range logic, not a fixture-specific coordinate override.

## References And Visual Review

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX: `/Library/TeX/texbin/pdflatex`
- rasterizer: `/opt/homebrew/bin/pdftocairo`
- artifact root:
  `outputs/qa-pgfplots-x-square-enlargelimits/`

The reviewed artifacts are the MacTeX PNG, tikztosvg SVG/PNG, TikZKit SVG/PNG,
and `diff/latex-examples-2d-x-square-with-circle-native-sheet.png`. The visual
criterion is visible space above the parabola consistent with the native plot
range, while retaining the zero line and outside tick/label layout. Different
SVG converters still use different glyph and tight-crop bounds, so crop pixels
are tracked separately from plot-frame geometry.

## Tests

```bash
node --test --test-name-pattern='x-square' test/pgfplots-seams.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-pgfplots-x-square-enlargelimits \
  --only latex-examples-2d-x-square-with-circle \
  --native-reference \
  --strict-tikztosvg \
  --comparison-grid-mode svg
node scripts/diff-example-pngs.js --output outputs/qa-pgfplots-x-square-enlargelimits
```

## Remaining Work

This does not implement the full `enlarge x/y/z limits` key grammar, arbitrary
relative/absolute enlargement values, modern ticklabel coordinate systems, or
identical text/crop metrics across MacTeX, tikztosvg, and browser SVG.
