# PGFPlots Boxed 3D Tick Edge Runs

## Scope

This slice implements major/minor tick-stroke placement for boxed three-dimensional
PGFPlots axes. It is limited to selecting additional connected visible frame edges.
It does not claim full 3D surface ordering, SVG crop, colorbar, or arbitrary
view-angle parity.

Real driver:

- `test/fixtures/examples/latex-examples/3d-cmos-loss-diagram.tex`

Artifacts:

- `/private/tmp/tikzkit-qa-pgfplots-3d-box-ticks-after-2026-08-07/mactex-png/latex-examples-3d-cmos-loss-diagram.png`
- `/private/tmp/tikzkit-qa-pgfplots-3d-box-ticks-after-2026-08-07/tikztosvg-svg/latex-examples-3d-cmos-loss-diagram.svg`
- `/private/tmp/tikzkit-qa-pgfplots-3d-box-ticks-after-2026-08-07/tikztosvg-grid-png/latex-examples-3d-cmos-loss-diagram.png`
- `/private/tmp/tikzkit-qa-pgfplots-3d-box-ticks-after-2026-08-07/tikzkit-svg/latex-examples-3d-cmos-loss-diagram.svg`
- `/private/tmp/tikzkit-qa-pgfplots-3d-box-ticks-after-2026-08-07/tikzkit-grid-png/latex-examples-3d-cmos-loss-diagram.png`
- `/private/tmp/tikzkit-qa-pgfplots-3d-box-ticks-after-2026-08-07/diff/latex-examples-3d-cmos-loss-diagram-native-sheet.png`

## Local Source Study

Reviewed local TeX Live sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`
  - `1325-1336`: `pgfplots@drawticklines@onorientedsurf` draws ticks on an
    oriented axis surface.
  - `1420-1538`: each selected major/minor tick can emit `LOWER` and `UPPER`
    sets. A boxed 3D axis is not represented by only a label edge and a single
    diagonal opposite edge.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  - default `every tick` is very thin gray and the default major tick length
    is `0.15cm`.

Implementation consequence: keep the label/tick-label edge, then add the
projected bridge edge and selected opposite edge. This gives a connected
visible box-edge run without duplicating tick marks on the same edge.

## Third-Party SVG Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

The generated SVG uses individual gray `stroke-width="0.19925"` paths under a
global y-axis flip. Its tick strokes appear on multiple connected parallel frame
edges, consistent with TeX Live oriented lower/upper surface code. This was
closer to the MacTeX reference than the prior TikZKit result.

## Visual Result

Before this change, the driver selected the tick-label edge plus one diagonal
opposite edge. That left gaps in the top/side frame tick runs. The generated
TikZKit SVG had 40 gray tick-stroke paths.

After the change, the projected bridge edge is included for boxed 3D axes.
The same artifact has 60 gray tick-stroke paths: the absent top/side/front short
gray tick runs are now visible and connected to the label-edge run. Geometry,
labels, and surface projection are unchanged by this slice.

The comparison remains partial. The post-change TikZKit canvas is `602x487`
while tikztosvg is `587x464`; this crop mismatch predates the tick-edge change.
Surface ordering and the native Manhattan projection footprint are separate
known regressions.

## Code and Verification

Changed files:

- `src/pgfplots/axis3d.js`
- `test/pgfplots-seams.test.js`
- `src/packages/pgfplots.js`

Checks:

    node --test --test-name-pattern='boxed 3d axes draw unlabeled ticks|axis lines left suppresses opposite-edge tick marks|3d grid and ticks choose view-dependent projected hull edges' test/pgfplots-seams.test.js
    node --test --test-name-pattern='3d' test/pgfplots-seams.test.js
    npm run examples:render -- --fixtures test/fixtures/examples --output /private/tmp/tikzkit-qa-pgfplots-3d-box-ticks-after-2026-08-07 --only latex-examples-3d-cmos-loss-diagram --native-reference --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
    npm run examples:diff -- --output /private/tmp/tikzkit-qa-pgfplots-3d-box-ticks-after-2026-08-07

The focused tick regressions pass (3/3). The wider 3D set passes 35/37; the
two remaining failures are unrelated pre-existing work:

- native reverse-y surface scanline/z-buffer order
- native Manhattan 3D projected-footprint width

The real driver rendered with TikZKit, tikztosvg, and MacTeX successfully and
reported no diagnostics.

## Remaining Work

The edge selection is a projected visible-edge approximation of PGFPlots full
oriented-surface machinery. Validate more azimuth/elevation combinations, then
address the independent surface ordering and explicit-width projection regressions.
