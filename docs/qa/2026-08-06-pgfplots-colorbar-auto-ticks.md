# PGFPlots 3D Colorbar Automatic Ticks

## Scope

This slice corrects one shared PGFPlots rule: the default labels on a vertical
3D `colorbar` are planned from the colorbar's own physical height. It does not
change surface sampling, projection, colour interpolation, title placement,
explicit `ytick={...}` values, or any case-specific geometry.

The real driver is
`test/fixtures/examples/latex-examples/color-blind-friendly-mesh-colormap.tex`:

```tex
\begin{axis}[
  colormap name=whitered,
  title=Rectangle from matrix input,
  colorbar,
  colorbar style={
    at={(-0.3,0)},
    anchor=south west,
    height=0.6*\pgfkeysvalueof{/pgfplots/parent axis height},
    title={$f(x,y)$}
  }]
  \addplot3[surf,samples=30] {x*y};
\end{axis}
```

Implemented here: vertical `colorbar`, inherited z range, default tick count
based on the rendered bar height, `max space between ticks`, `try min ticks`,
and explicit `ytick` precedence. Still partial: horizontal/left bars,
standalone child-axis configuration, arbitrary number-format commands,
custom `yticklabels`, and full PGFPlots tick-survey behavior.

## Local MacTeX Study

Read these local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`,
  lines 1124-1253: `colorbar right` creates an independent vertical child axis
  with a parent-derived height; the 3D parent default has `try min ticks=3`,
  while the generic child-axis default remains independent.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`,
  lines 1937-2026 and 2380 onward: requested ticks come from physical axis
  length divided by `max space between ticks`; the result is bounded by
  `try min ticks` and normalized to a 1/2/5/10-style step.

The key detail is that the colorbar is not the parent 3D axis. It uses the
generic 35pt spacing and generic `try min ticks=4` floor. For the 50-unit
driver range this produces a 20-unit step and the labels `-20`, `0`, `20`.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The fixture runner produced MacTeX native
PNG, TikZKit JS SVG/PNG, tikztosvg SVG/PNG, grid variants, diff images, and a
comparison sheet.

- Before: `/private/tmp/tikzkit-qa-3dmesh-current-2026-08-06/`
- After: `/private/tmp/tikzkit-qa-3dmesh-colorbar-ticks-after-2026-08-06/`
- Inspected after sheet:
  `/private/tmp/tikzkit-qa-3dmesh-colorbar-ticks-after-2026-08-06/diff/latex-examples-color-blind-friendly-mesh-colormap-native-sheet.png`

The generated tikztosvg SVG contains exactly the three colorbar text labels
`-20`, `0`, and `20`, matching the MacTeX panel. It also keeps the colorbar as
ordinary SVG paths/text rather than a browser `foreignObject`.

## Visual Result

Before this change, TikZKit visibly placed five labels on the same short
vertical bar: `-20`, `-10`, `0`, `10`, `20`. MacTeX and tikztosvg placed just
`-20`, `0`, `20`; the extra labels made the JS colorbar look crowded even
though its surface, frame, colormap, and title were otherwise present.

After the change, all three renderers show the same three labels. The surface,
mesh, title, tick scale, and colorbar position are unchanged. The registered
TikZKit-versus-MacTeX residual also improved from `0.0382624` mean absolute
RGBA / `22.66704%` changed pixels to `0.0377912` / `22.51273%`, but the
acceptance decision is based on the visible removal of the two incorrect
labels. Remaining differences are browser-versus-TeX fonts, projected-frame
offsets, and rasterization of the faceted mesh.

## Implementation And Verification

- `src/pgfplots/axis3d.js`: replaces the former coarse short/tall colorbar
  count with physical-height planning, a generic 35pt spacing default, and a
  `try min ticks=4` floor. The supported subset caps automatic labels at five
  to avoid overlapping fractional labels on unusually tall bars.
- `test/pgfplots-seams.test.js`: adds the real fixture regression asserting
  that only `-20`, `0`, and `20` are emitted for this colorbar.
- `src/packages/pgfplots.js`, generated extension registry, and `README.md`:
  record the implementation and its partial boundary.

```bash
node --test --test-name-pattern='colorbar (automatic|derives|short|tall|keeps)' test/pgfplots-seams.test.js
node scripts/render-example-fixtures.js \
  --output /private/tmp/tikzkit-qa-3dmesh-colorbar-ticks-after-2026-08-06 \
  --only latex-examples-color-blind-friendly-mesh-colormap \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-3dmesh-colorbar-ticks-after-2026-08-06 \
  --register --alignment-radius 3
npm run extension-registry
```

The focused regression passes and the three renderer artifact families were
generated and inspected. Broader PGFPlots seam tests still include unrelated
baseline calibration failures, so this scoped visual acceptance does not claim
that the complete PGFPlots suite is green.

## Next Work

1. Implement the remaining child-axis colorbar directions and layout forms.
2. Match `yticklabels`, number-format keys, and exact PGFPlots tick-survey
   rounding for more ranges.
3. Continue 3D projection, text metric, and mesh-raster calibration with
   MacTeX as the acceptance reference.
