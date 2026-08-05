# PGFPlots 3D Colorbar BBox QA (2026-08-05)

## Scope

This pass is restricted to explicit-width oblique `\addplot3[surf]` axes with
`colorbar` and `colorbar style={at=...,anchor=...,height=...}`. It changes the
outer SVG layout reserve only; surface sampling, projection, tick generation,
and colormap interpolation are outside this slice.

## Local implementation reading

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`.
The `colorbar right` defaults place the bar relative to the parent axis, then
let `at`, `anchor`, `height`, and `width` override that layout. In particular,
`0.25*\pgfkeysvalueof{/pgfplots/parent axis height}` is a quarter of the
parent-axis height, not a fraction of the already-projected 3D box.

TikZKit already follows that height rule in
`src/pgfplots/axis3d.js:renderAxis3DColorbar`. The remaining difference was
the explicit-width axis *outer* bbox: the generic 3D right gutter either
under- or over-allocated whitespace after oblique projection.

## Drivers and artifacts

Artifacts are kept together in `outputs/qa-pgfplots-3d-colorbar-after/`:

- MacTeX native PNG: `mactex-png/latex-examples-3d-function-4.png`
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`
- TikZKit 1cm grid: `tikzkit-grid-svg/` and `tikzkit-grid-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`
- tikztosvg 1cm grid: `tikztosvg-grid-svg/` and `tikztosvg-grid-png/`
- visual sheets/diffs: `diff/`

The inspected real cases were `3d-function-4`, `3d-function-8`,
`3d-function-continuous`, and `hyperbolic-paraboloid`.

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. Its `3d-function-8`
SVG has `width="440.48pt" height="339.93pt"`; the colorbar itself is a
14.17pt by 80.91pt path block. This confirms the bar uses a fixed width and a
quarter-height rule. TikZKit's colorbar paths have the corresponding 0.5cm by
2.839cm geometry.

## Visual result

Before the change, explicit-width 3D canvases were 8.7pt too narrow compared
with tikztosvg, although the surface and colorbar primitives were present.
After the change, `3d-function-8` is 440.31pt wide versus tikztosvg's
440.48pt. `3d-function-4` is 437.62pt wide versus 438.17pt. The remaining
height delta for `3d-function-4` is 0.78pt, within the SVG text/stroke metric
tolerance; native, TikZKit, and tikztosvg visibly agree on the projected box,
surface, colorbar, labels, and tick positions.

The large raster diff remains dominated by independently tessellated surface
mesh edges and antialiasing. It is not a missing axis, bar, label, or clipping
error.

## Validation

Passed:

```sh
node --test --test-name-pattern='3d colorbar|oblique 3d' test/pgfplots-seams.test.js
node --test test/library-modules.test.js
node scripts/render-example-fixtures.js --fixture-root test/fixtures/examples \
  --output outputs/qa-pgfplots-3d-colorbar-after \
  --only latex-examples-3d-function-4,latex-examples-3d-function-8,latex-examples-3d-function-continuous,latex-examples-hyperbolic-paraboloid \
  --render-png --grid --grid-mode svg
node scripts/diff-example-pngs.js --output outputs/qa-pgfplots-3d-colorbar-after
```

All four driver cases report no TikZKit diagnostics.

## Remaining work

This does not make all 3D surface cases pixel-identical. The next high-value
slice is shared surface tessellation/draw-order behavior, followed by
per-view axis label placement. Both need separate visual QA because they
change painted geometry rather than only the outer layout box.
