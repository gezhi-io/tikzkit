# PGFPlots 3D `scale uniformly` units-only QA

## Scope

This slice covers only a 3D `axis` with explicit `scale mode=scale uniformly`
and `scale uniformly strategy=units only`, plus the implicit `surf` colormap.
It does not claim general PGFPlots 3D scaling or all scale-mode strategies.

The two drivers are:

- `test/fixtures/examples/pgfplots/scale-mode-uniform-3d.tex`: x/y spans of 1 and z span of 2.
- `test/fixtures/examples/pgfplots/scale-mode-uniform-3d-large-range.tex`: the same relative spans at 10x range.

Both use `\begin{tikzpicture}`, `\begin{axis}`, `\addplot3[surf]`, `width`,
`height`, `scale only axis`, `scale mode`, `scale uniformly strategy`, `view`,
`xmin/xmax`, `ymin/ymax`, `zmin/zmax`, `grid=major`, `xlabel/ylabel/zlabel`,
`domain`, `y domain`, `samples`, and the expression `x+y`.

## Local Source Record

Reviewed local MacTeX / TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.scaling.code.tex`
  lines 1091-1121 describe common unit-vector scaling and range compensation;
  lines 1400-1418 show that `units only` retains all limits and derives one
  common x/y scale from the projected box.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  lines 3993 and 4027-4036 initialize `colormap name=hot` and declare the
  default stops as blue, yellow, orange, and red.
- The `tikztosvg` SVG uses the same flat surface mesh topology, miter joins,
  butt caps, and the hot-map intermediate colors; it is used as a structural
  reference, while MacTeX remains the visual authority.

Implementation consequence: the projected x/y/z spans are normalized by their
common multiplier before applying the units-only scale. Thus `1:1:2` and
`10:10:20` share a shape, while changing only one span changes its projected
length. Implicit surface colors now use the same four stops as explicit
`colormap name=hot`.

## Three-Way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion uses
`/opt/homebrew/bin/rsvg-convert` through the fixture script. Artifacts are
intentionally untracked:

`outputs/qa-pgfplots-scale-uniform-after-v6-2026-08-08/`

It contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, 1cm-grid SVG/PNG,
and two native comparison sheets:

- `diff/pgfplots-scale-mode-uniform-3d-native-sheet.png`
- `diff/pgfplots-scale-mode-uniform-3d-large-range-native-sheet.png`

The small driver has a tikztosvg canvas of `72.54pt x 98.63pt` and a TikZKit
canvas of `77.38pt x 95.71pt`. The larger-range driver is `79.99pt x 98.67pt`
versus `78.96pt x 95.71pt`. The remaining outer-bounds difference is primarily
tick-label / text-box measurement; the projected box, three grid faces, labels,
and surface are present and aligned.

Before the correction, the implicit-colormap fallback used an approximate
dark-blue-to-red palette, and multiplying all three ranges enlarged the
units-only JS box. Afterward, both visual sheets show the native
blue/yellow/orange/red surface progression and the same compact 1:1:2
perspective for the 1x and 10x drivers. The diff still paints dense red mesh
and text-raster differences; it does not indicate missing geometry. Registered
mean absolute RGBA residuals are about `0.0653` for the small driver and
`0.0580` for the large driver, while tikztosvg itself differs from MacTeX by
roughly `0.0117` and `0.0104` from rasterization and font handling.

## Existing-Corpus Check

The checked 30-example LaTeX corpus has no source that uses `scale uniformly`,
`scale uniformly strategy`, or `units only`; the two drivers are therefore
source-derived regression fixtures, not renamed existing corpus cases.

`latex-examples-3d-function-8` was also regenerated into
`outputs/qa-pgfplots-3d-function-8-after-hot-2026-08-08/`. It explicitly
declares and selects a `whitered` colormap, so its TikZKit SVG is byte-identical
before and after this change. That check establishes that custom colormaps did
not regress; it is not evidence of a visible default-`hot` improvement. The
visible improvement delivered here is the compact, range-stable units-only 3D
box.

## Verification

```bash
node --test --test-name-pattern='native hot colormap|scale uniformly units only' \
  test/pgfplots-seams.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --only pgfplots-scale-mode-uniform-3d \
  --only pgfplots-scale-mode-uniform-3d-large-range \
  --output outputs/qa-pgfplots-scale-uniform-after-v6-2026-08-08 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg

npm run examples:diff -- --output outputs/qa-pgfplots-scale-uniform-after-v6-2026-08-08 \
  --register --alignment-radius 3
```

Both fixtures produced zero TikZKit diagnostics, zero tikztosvg failures, and
zero MacTeX failures. The semantic audit still lists generic review TODOs for
the broad `pgfplots` package; it is metadata work, not a rendering diagnostic.

## Remaining Boundary

`scale uniformly strategy=auto`, `change horizontal limits`, `change vertical
limits`, complete axis-limit compensation, arbitrary explicit unit-vector
ratios, 3D label bounding boxes, shader interpolation, and colorbar child-axis
layout remain partial. Do not use this slice as evidence that an arbitrary 3D
PGFPlots source is accepted.
