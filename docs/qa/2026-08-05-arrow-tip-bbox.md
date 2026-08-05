# Legacy Arrow Tip Bounding Boxes

## Scope

Calibrate the shared SVG bounding-box contribution of legacy arrow tips. This
is intentionally limited to `\pgfarrowsdeclare`-style tips such as `stealth'`;
it does not change arrow geometry, path shortening, or arrows.meta behavior.

## Local Source Review

Read the following local MacTeX sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/systemlayer/pgfsys-dvisvgm.def`

`stealth'` computes its right extension as `2*temp + 0.5*linewidth`.
`pgfcorepathusage` separately expands a stroked path by half the line width.
The previous SVG bounds code treated the declared arrow extent as incomplete
and then appended a full stroke width, double-counting one half-line-width at
the terminal. The renderer now adds only that remaining half-width.

## Real Fixture And Artifacts

Driver: `latex-examples-line-segments-bounding-box` from
`test/fixtures/examples/latex-examples/line-segments-bounding-box.tex`.

- TikZKit SVG: `outputs/qa-svg-bounds-line-segments/tikzkit-svg/latex-examples-line-segments-bounding-box.svg`
- tikztosvg SVG: `outputs/qa-svg-bounds-line-segments/tikztosvg-svg/latex-examples-line-segments-bounding-box.svg`
- TikZKit/tikztosvg sheet: `outputs/qa-svg-bounds-line-segments/diff/latex-examples-line-segments-bounding-box-sheet.png`
- Native MacTeX PNG: `outputs/qa-svg-bounds-line-segments/mactex-png/latex-examples-line-segments-bounding-box.png`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and was used with
`rsvg-convert` through the fixture renderer. The source document's native
`preview` package adds a 2mm page border, so its PDF page is
`146.582 x 174.928pt`; tikztosvg renders the extracted picture and therefore
has the smaller picture-only canvas used for SVG parity.

Before the change, TikZKit measured `135.64 x 163.99pt` while tikztosvg
measured `135.24 x 163.59pt`. The extra `0.4pt` appeared on terminal arrow
edges. Afterwards both SVGs are `135.24 x 163.59pt`; the comparison has 38
antialiasing pixels (`0.00096` ratio), with no missing paths, arrows, grid
lines, fills, or endpoint crosses.

## Regression

```bash
node --test test/line-segments-new30.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-svg-bounds-line-segments \
  --only latex-examples-line-segments-bounding-box \
  --preserve-output
node scripts/diff-example-pngs.js --output outputs/qa-svg-bounds-line-segments
```

The regression passes all 18 assertions: the 14 line-segment canvases, their
endpoint crosses, grids, arrows, path order, and the cubic trefoil check.

## Remaining Boundary

This does not complete the arrows library. Declared arrow setup code, clipping,
arbitrary TeX arithmetic, and many arrow hulls remain partial. PGFPlots label,
tick, and 3D-axis calibration is a separate next slice.
