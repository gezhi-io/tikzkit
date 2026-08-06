# PGFPlots scaled z multiplier bbox QA

## Scope

This slice handles the SVG picture bbox for oblique \addplot3[surf] axes
whose z ticks emit a scaled multiplier such as \cdot 10^{-2}. It does not
change surface sampling, 3D projection, colorbar tick planning, or normal
unscaled 3D axes.

## Local implementation reading

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`.
The relevant defaults are `every 3d description` and `every z tick scale
label`: PGFPlots positions the multiplier beyond the selected z tick edge and
lets that description contribute to the final picture bbox. The ordinary
colorbar path remains a separate child-axis description.

## References and artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- Before: `/private/tmp/tikzkit-qa-3d-axis-height-before-2026-08-06`
- After: `/private/tmp/tikzkit-qa-3d-scaled-z-bottom-2026-08-06`
- Drivers: `latex-examples-3d-function-7` and `latex-examples-3d-function-8`

Each artifact root contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG,
and the composed comparison sheets.

## Visual result

`3d-function-8` previously clipped the expected lower canvas extent when its
z axis rendered `\cdot 10^{-2}`: TikZKit was `440.31pt x 331.17pt`, while
tikztosvg was `440.48pt x 339.93pt`. The shared lower reserve changes TikZKit
to `440.31pt x 339.90pt`; its raster output now matches tikztosvg at
`588 x 454px`.

The actual panel was inspected after a rejected upper-reserve attempt: placing
the space above visibly pushed the surface down. Reserving it below keeps the
surface, 3D grid, labels, colorbar, and scaled multiplier in their native-like
positions. PNG comparison improved from `0.39248 / 0.03063` to
`0.38221 / 0.02986` for changed-pixel ratio / mean absolute RGBA.

`3d-function-7` has no scaled z multiplier and remains on its existing
`437.62pt x 331.17pt` layout, close to tikztosvg's `437.53pt x 330.68pt`.

## Regression

`test/pgfplots-seams.test.js` now names the real-picture gate as
`pgfplots oblique 3d scaled z ticks reserve the native lower picture extent`.

## Remaining limits

The reserve is calibrated for the default Computer Modern z-scale label.
Arbitrary custom z tick fonts, arbitrary exponent formats, and all advanced
child-axis/colorbar positioning remain partial.
