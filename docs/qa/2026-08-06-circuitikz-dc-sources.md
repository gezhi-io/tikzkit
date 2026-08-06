# circuitikz DC sources visual QA (2026-08-06)

## Scope

This slice implements only independent `dcvsource` and `dcisource`: the DC
voltage-source circle with two plates, and the DC current-source fill, open
outline, current arrow, and `bipoles/dcisource/angle`. It does not claim the
remaining circuitikz source catalog.

Driver: `test/fixtures/examples/circuitikz/dc-sources.tex`, adapted from the
local circuitikz manual's DC-sources example.

## Local MacTeX Review

Reviewed local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`,
  lines 3108-3123. The manual uses `dcvsource` and `dcisource`, and changes
  the current-source open-arc angle from its default `80` to `45` through
  `\ctikzset{bipoles/dcisource/angle=45}`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex`,
  lines 1923-1927 and 2537-2585. `dcvsource` is a circle plus two parallel
  plates; `dcisource` paints a filled ellipse underneath two open arcs, then
  draws a shaft and the `currarrow` node.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircshapes.tex`,
  lines 413-450. `currarrow` is a filled, stroked four-point arrow body, not
  a generic TikZ `latex` marker.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; native reference rendering used local
`pdflatex`.

The inspected before and final artifact directories are:

- `/private/tmp/tikzkit-qa-circuitikz-dc-sources-before-2026-08-06/`
- `/private/tmp/tikzkit-qa-circuitikz-dc-sources-after-currarrow-2026-08-06/`

Each contains MacTeX PNG, TikZKit JS SVG/PNG, tikztosvg SVG/PNG, matching
one-centimetre grid versions, a three-way native sheet, and a diff sheet.

The tikztosvg SVG has `viewBox="0 0 114.18 82.1"`. Its voltage source is one
closed circle path followed by two plate paths. Its current source is three
layers: a filled yellow circle, two unfilled open-arc paths, and a separate
shaft plus `currarrow` polygon. TikZKit now follows that same layer order;
its SVG uses a translated viewBox but retains the same `114.18pt × 82.1pt`
output dimensions.

## Visual Review

Viewed the MacTeX/TikZKit/tikztosvg sheet, JS/tikztosvg grid sheet, and diff
sheet before and after the change. Before the change, TikZKit emitted only
two horizontal wires: both source circles, the four voltage plates, yellow
fills, open current-source gaps, and arrows were missing. Its output height
was `77px` against the `110px` tikztosvg reference.

After the change, the TikZKit panel has the two voltage circles with their
parallel plates and both yellow current-source bodies. The default `80`
opening and local `45` opening visibly differ as in both references. The
current arrow is now a circuitikz-shaped shaft and filled head rather than a
large generic SVG marker. The final JS and tikztosvg rasters are both
`153px × 110px`, use the same symbol ordering, line placement, fill color,
and open-arc orientation. The remaining diff is antialiasing and small
native/SVG stroke-shape variation, not a missing symbol or coordinate shift.

The registered TikZKit-to-tikztosvg comparison is `1355 / 16830` changed
pixels (`8.05%`, mean absolute RGBA `0.00145`). This is supporting evidence;
the accepted visual change is the restored DC-source family and the restored
second-row source geometry.

## Verification

```bash
node --test test/circuitikz-dc-sources.test.js \
  test/circuitikz-sinusoidal-sources.test.js \
  test/circuitikz-controlled-sources.test.js \
  test/circuitikz-voltage-polarity.test.js
node scripts/render-example-fixtures.js \
  --output /private/tmp/tikzkit-qa-circuitikz-dc-sources-after-currarrow-2026-08-06 \
  --only circuitikz-dc-sources --native-reference --comparison-grid-mode svg \
  --strict-tikztosvg --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-circuitikz-dc-sources-after-currarrow-2026-08-06 \
  --register --alignment-radius 3
```

Focused tests pass with no diagnostics. The fixture renderer generated all
three reference families without missing artifacts.

## Remaining Boundary

`current arrow scale`, source-specific fill defaults outside this DC family,
other DC waveform sources, and the broader independent/dependent bipole
catalog remain partial or unsupported.
