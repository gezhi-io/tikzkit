# PGFPlots 3D Quiver Range Survey

## Scope

This review accepts one PGFPlots slice only: survey ranges for a 3D
`\addplot3` quiver function. It covers `quiver/u`, `quiver/v`, `quiver/w`,
`quiver/scale arrows`, and the default/explicit `quiver/update limits` rule.
It does not claim general PGFPlots or general 3D parity.

## Local implementation study

Reviewed local TeX Live 2025 source:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsplothandlers.code.tex`,
  lines 1233-1297 define the 2D/3D quiver handler and default
  `quiver/update limits=true`.
- Lines 1510-1537 run the survey: PGFPlots updates limits for the parsed start
  point, adds the scaled `u`, `v`, and `w` components, then updates limits for
  the end point unless the option is false.
- Lines 1616 onward transform the same start/end pair for drawing. This is why
  range survey must share the renderer's key normalization and scale logic.

TikZKit now keeps that shared logic in `src/pgfplots/quiverOptions.js` and
uses it both in `quiver.js` and `rangeResolver.js`.

## Real driver and artifacts

Driver: `test/fixtures/examples/latex-examples/3d-gradient-cos.tex`.

Commands:

```bash
node --test --test-name-pattern='quiver' test/pgfplots-seams.test.js
npm run examples:render -- --manifest test/fixtures/examples/manifest.json \
  --only latex-examples-3d-gradient-cos \
  --output /private/tmp/tikzkit-qa-pgfplots-3d-quiver-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure --external-timeout-ms 60000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-pgfplots-3d-quiver-after-2026-08-07 \
  --register --alignment-radius 4
```

Generated artifacts:

- TikZKit SVG/PNG: `/private/tmp/tikzkit-qa-pgfplots-3d-quiver-after-2026-08-07/tikzkit-svg/` and `tikzkit-png/`.
- `tikztosvg` at `/Library/TeX/texbin/tikztosvg`: `tikztosvg-svg/` and
  `tikztosvg-png/`.
- Native MacTeX PNG: `mactex-png/`.
- Three/four-panel sheets and registered diff: `diff/` and `diff-png/`.

All three renderers completed successfully. The `tikztosvg` SVG uses a
`0 0 398.64 331.98` viewBox and path-based Computer Modern glyphs; TikZKit
uses browser SVG text/font resources and a larger crop. Its path structure is
therefore useful for inspecting projected line geometry, but native MacTeX is
the visual acceptance oracle.

## Visual result

Before the fix, the quiver's constant `{-4}` was omitted from the range survey:
the sampled surface supplied approximately `-3.99`, while the arrows were
drawn at `z=-4`. The floor/grid and its arrows consequently came from slightly
different z ranges, and the JS PNG was `540x442px`.

After the fix, the resolved range is exactly `zMin=-4, zMax=0`. In the viewed
native comparison sheet, the JS floor, `-4` z tick, projected verticals, and
blue vector field share the native plane. TikZKit is now `556x457px` versus
MacTeX `547x458px`; the non-white bounds are JS `x=14..536, y=7..444` and
MacTeX `x=13..535, y=7..444`. This is a visible crop and placement improvement,
not merely a diff-score change.

Remaining differences are the browser SVG text/crop and antialiasing relative
to both native output and `tikztosvg`; neither is accepted as full 3D renderer
parity.

## Regression and residual risk

`test/pgfplots-seams.test.js` now verifies the default start/end survey and
`update limits=false`. The focused quiver tests pass. The full
`test/pgfplots-seams.test.js` suite retains unrelated pre-existing calibration
failures outside this slice, so it is not reported as fully green.

Unimplemented quiver work includes table/stream data, point-meta coloring,
full `every arrow` styles, logarithmic survey edge cases, and arbitrary
clipping interactions.
