# TikZ 3d canvas-plane visual QA (2026-08-06)

## Scope

This slice implements the `3d` library's canvas-plane transformation family:
generic `plane origin`, `plane x`, `plane y`, `canvas is plane`, and the six
shortcut keys `canvas is xy/yx plane at z`, `canvas is xz/zx plane at y`, and
`canvas is yz/zy plane at x`. The implementation applies the plane to ordinary
TikZ paths at picture, scope, and direct path option level.

Driver: `test/fixtures/examples/3d/canvas-planes.tex`, copied from the local
manual's three orthogonal plane-circle example. It draws one circle and one
cross on each of the `xy`, `zy`, and `zx` planes.

Out of scope: `xyz cylindrical` and `xyz spherical` coordinates, 3D node/text
layout, perspective projection, and exact native transform-key ordering when
several affine transformations share one option list.

## Local MacTeX Review

Reviewed local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-3d.tex`,
  lines 222-246. The manual constructs three circles by swapping canvas bases,
  rather than using an SVG 3D primitive; `zx` and `zy` planes therefore project
  as tilted ellipses while `xy` stays circular.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrary3d.code.tex`.
  The generic plane keys map an origin plus two basis points through the active
  3D coordinate system, then reset the local basis with PGF's triangle
  transform. The six convenience keys only provide the three basis-point
  combinations at the requested fixed coordinate.

TikZKit mirrors that basis-point model: it resolves the three defining points
through the parent 3D basis, derives a new local affine transform from their
differences, and prevents a scope's plane key from being applied again by each
descendant path.

## Command And Option Coverage

| Source command or option | Status | Notes |
| --- | --- | --- |
| `\usetikzlibrary{3d}` | partial | Registers the documented canvas-plane slice. |
| `plane origin`, `plane x`, `plane y`, `canvas is plane` | implemented | Generic plane basis at picture, scope, or path level. |
| `canvas is xy/yx plane at z` | implemented | Uses the active `x`, `y`, `z` basis. |
| `canvas is xz/zx plane at y` | implemented | Uses the active `x`, `y`, `z` basis. |
| `canvas is yz/zy plane at x` | implemented | Uses the active `x`, `y`, `z` basis. |
| `xyz cylindrical`, `xyz spherical` | unsupported | Listed by the native source but not this slice. |
| Native transform ordering | partial | Complex mixed 3D and affine options in one list need a dedicated parity pass. |

## Reference Artifacts

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
used `/opt/homebrew/bin/rsvg-convert`; native output used local `pdflatex`.

Baseline artifacts are under
`/private/tmp/tikzkit-qa-3d-canvas-planes-before-2026-08-06`; final artifacts
are under `/private/tmp/tikzkit-qa-3d-canvas-planes-after-2026-08-06`. Each
directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, grid panels,
and comparison sheets.

The inspected tikztosvg SVG has `viewBox="0 0 69.14 63.11"`. It represents the
three plane circles and crosses as ordinary `path` geometry inside a
`matrix(1, 0, 0, -1, ...)` coordinate flip, with clipping paths and a tight
bbox. It does not use SVG 3D transforms. TikZKit emits direct projected paths
in `viewBox="-121.965882 -121.965882 243.931765 243.931765"`.

## Visual Review

Viewed the TikZKit/tikztosvg grid sheet, the MacTeX/TikZKit/tikztosvg sheet,
and the registered diff panel before and after the change.

Before the change, TikZKit ignored each plane key: all three circles and
crosses were overlaid as one flat `xy` circle. Its canvas was `77x77px`, while
the reference showed the two tilted plane ellipses and their distinct cross
directions. The tikztosvg raster comparison had 1,539 changed pixels out of
5,929 (`0.2596` ratio; mean absolute difference `0.0933`).

After the change, the JavaScript SVG visibly contains the vertical `zy` ellipse,
the horizontal `zx` ellipse, and the circular `xy` plane, each with its own
cross orientation. The grid panels confirm that all three projected positions
and scales match tikztosvg. The final direct JS/tikztosvg overlap has 170
changed pixels out of 7,905 (`0.0215` ratio; mean absolute difference
`0.000924`), limited to antialiasing and bbox edges.

MacTeX and TikZKit now share the complete square-crop geometry. tikztosvg has
a shorter tight viewBox height than native MacTeX, so its raw native comparison
retains a crop difference; this is a third-party reference bbox difference, not
a missing canvas-plane projection.

## Verification

```bash
node --test test/tikz-3d-canvas-planes.test.js test/library-modules.test.js \
  test/example-render-script.test.js
npm run extension-registry
npm run gallery:audit
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-3d-canvas-planes-after-2026-08-06 \
  --only 3d-canvas-planes --native-reference --comparison-grid-mode svg \
  --strict-tikztosvg --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-3d-canvas-planes-after-2026-08-06 \
  --register --alignment-radius 3
```

Focused tests passed `58/58`; gallery audit rendered `278/278` fixtures with
zero diagnostics. The extension registry now records `3d` as `partial`, with
the local source and manual reviewed, two covered cases, and the remaining
coordinate-system boundary.
