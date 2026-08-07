# PGFPlots Default 3D Tick-Label Box QA

## Scope

This slice covers default-perspective, boxed 3D PGFPlots axes with no explicit
`width`/`height` and no colorbar. It calibrates the x/y tick-label node box
after 3D projection. It does not change surface sampling, z-buffer ordering,
explicit-size axes, colorbars, or arbitrary `ticklabel` styles.

Driver: `test/fixtures/examples/latex-examples/3d-manhattan-bar-plot.tex`.

## Local Implementation Reading

Reviewed local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.scaling.code.tex`
  lines 147-180 and 360-680: default `240pt` by `207pt` dimensions reserve
  `45pt` for axis descriptions before scaling the eight projected plot-box
  corners. The reserve is layout math, not a generic painted rectangle.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`
  lines 1582-1695: 3D ticks and labels are placed on selected oriented box
  surfaces through `near <axis>ticklabel` anchors. The lower x/y label boxes
  participate in the picture bounds; z labels follow their own selected edge.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  lines 150-152 and 912-918: default axis dimensions and `every 3d
  description` defaults.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

Artifacts are in
`/private/tmp/tikzkit-qa-pgfplots-manhattan-footprint-final-2026-08-07`:

- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-svg/` and `tikztosvg-png/`
- `mactex-png/`
- `diff/latex-examples-3d-manhattan-bar-plot-native-sheet.png`

The tikztosvg SVG uses direct CM glyph `<use>` placements and a clipped
projected 3D box; it has no `foreignObject` or marker-based ticks. Its
standalone wrapper omits the source `\\PreviewBorder{2mm}`, while MacTeX keeps
that source border. MacTeX is therefore the page-size authority; the
margin-free JS SVG is compared directly with tikztosvg.

## Visual Result

Before this change, JS preserved the 3D frame width but its default x/y labels
left the page too short: `218.86pt x 170.24pt` with `margin: 0`. The rendered
source image was `307x243px` while the MacTeX PNG was `306x249px`; the lower
tick-label extent was visibly cramped.

After the shared x/y node-box calibration, the margin-free JS SVG is
`218.86pt x 175.42pt`, versus tikztosvg `217.66pt x 175.20pt`. With the source
preview border retained, JS is `307x249px` versus MacTeX `306x249px`. The
projected frame, tick locations, box faces, and numeric labels remain aligned;
the lower x/y labels now occupy the native vertical extent instead of clipping
the picture early.

The tikztosvg/JS diff sheet still reports a dimension mismatch because the
third-party wrapper intentionally drops the source preview border; that is a
wrapper difference, not a remaining 3D geometry offset.

## Implementation And Tests

Changed:

- `src/pgfplots/axis3d.js`: `defaultPerspectiveTickLabelInnerSep()` applies
  the measured `0.26em` x/y reserve only to default-size, no-colorbar 3D axes;
  z labels and explicit-size/colorbar axes retain their prior behavior.
- `test/pgfplots-seams.test.js`: Manhattan footprint gate now uses the local
  MacTeX-derived margin-free size rather than subtracting a preview border from
  tikztosvg's already-cropped wrapper output.

Validation:

```sh
node --test --test-name-pattern='3d' test/pgfplots-seams.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pgfplots-manhattan-footprint-final-2026-08-07 \
  --only latex-examples-3d-manhattan-bar-plot --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-pgfplots-manhattan-footprint-final-2026-08-07
```

The focused Manhattan regression passes with no diagnostics. The 3D test
selection has one unrelated pre-existing failure in the default surface
scanline coordinate assertion; all other 36 selected tests pass.

## Remaining Work

- Generalize `near <axis>ticklabel` to measure arbitrary fonts, rotated labels,
  and the maximum actual tick-label box rather than using this default-style
  calibration.
- Resolve the separate default surface z-buffer coordinate regression before
  claiming the full 3D test selection is green.
- Bring tikztosvg's wrapper behavior into the comparison report so its source
  border omission is labelled automatically.
