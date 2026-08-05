# PGFPlots Patchplots Triangle QA

## Scope

This slice implements only the linear three-vertex form of
`\addplot3[patch,patch type=triangle] ... coordinates {...}`. Consecutive
coordinate triples become projected 3D triangle patches with a fill, a
faceted mesh outline, opacity, and painter ordering. It is shared PGFPlots
lowering in `src/pgfplots/surface.js`, not a gallery-case coordinate override.

The real driver is
`test/fixtures/examples/pgfplots/patchplots-triangle.tex`. It declares
`\usepgfplotslibrary{patchplots}` and provides exactly three vertices:
`(0,0,0) (2,0,1) (0,2,2)`.

## Local MacTeX Study

Read the local TeX Live source:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.patchplots.code.tex`.

Its header explicitly separates the core linear patch handler (line,
triangle, and rectangle) from this library's higher-order patch classes:
quadratic triangles, biquadratic quadrilaterals, and Coons patches. The
source's high-order patch declarations collect an ordered vertex stream and
paint a path from that geometry. This establishes the narrow JS rule here:
three finite 3D vertices make one closed planar path; no sampled function grid
is invented.

There is no dedicated patchplots `.tex` manual installed under
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgfplots/` (only the package
README), so the registry keeps `localDoc` empty rather than claiming a source
that was not present.

## Command And Option Inventory

| Item | Status in this slice | Notes |
| --- | --- | --- |
| `\usepgfplotslibrary{patchplots}` | partial | resolves to `src/pgfplots/libraries/patchplots.js` |
| `\begin{axis}` plus `view={45}{30}` | supported in this path | existing projected 3D axis geometry |
| `xmin/xmax`, `ymin/ymax`, `zmin/zmax` | supported in this path | finite 3D range and projection bounds |
| `\addplot3` + `coordinates` | supported in this path | reads ordered finite 3D vertices |
| `patch` | supported for this slice | identifies a patch plot |
| `patch type=triangle` | supported | consumes each consecutive triple |
| `fill=orange!65` | supported | creates the native-like orange face |
| `draw=black` | parsed; native mesh semantics applied | PGFPlots' linear handler produces a faceted dark-orange mesh outline, so the renderer mirrors that result rather than forcing a black SVG stroke |
| `opacity` and `z buffer=none` | supported in this path | otherwise patches are painted far-to-near |

Not implemented: linear `patch type=line` and `rectangle`; tables and
point-meta streams; `shader=interp`; per-vertex interpolation; quadratic,
biquadratic, and Coons patches; PDF shading; and all custom patch class
declarations.

## References And Artifacts

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
uses `/opt/homebrew/bin/rsvg-convert`. MacTeX native output uses
`/Library/TeX/texbin/pdflatex`.

The inspected after artifacts are in
`outputs/qa-pgfplots-patchplots-triangle-2026-08-06/`:

- native PNG: `mactex-png/pgfplots-patchplots-triangle.png`;
- TikZKit SVG/PNG: `tikzkit-svg/pgfplots-patchplots-triangle.svg` and
  `tikzkit-png/pgfplots-patchplots-triangle.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfplots-patchplots-triangle.svg` and
  `tikztosvg-png/pgfplots-patchplots-triangle.png`;
- 1cm grid SVG/PNG: `tikzkit-grid-svg/`, `tikzkit-grid-png/`,
  `tikztosvg-grid-svg/`, and `tikztosvg-grid-png/`;
- four-panel comparison: `diff/pgfplots-patchplots-triangle-native-sheet.png`.

The tikztosvg SVG uses `viewBox="0 0 187.75 113.51"`, path geometry and TeX
glyph paths rather than an SVG 3D primitive. Its triangle is a closed filled
path (`... Z`) followed by a separate transformed mesh path with
`stroke-linecap="butt"` and `stroke-linejoin="miter"`. That structure is why
the JS renderer emits separate fill and mesh Scene Graph paths rather than one
stroked polygon.

## Visual Result

Before the change, the TikZKit panel rendered only the 3D coordinate box. The
orange triangle was entirely absent, making the red diff panel contain the
whole face and its outline.

After the change, the TikZKit panel shows the triangular face from the origin
to the upper z vertex and the projected `(2,0,1)` vertex in the same place as
both MacTeX and tikztosvg. Face extent, projection direction, 3D frame, ticks,
and labels are all present. The remaining visible difference is the thin mesh
outline and normal TeX/browser glyph rasterization; there is no longer a
missing patch.

The registered TikZKit-vs-MacTeX changed-pixel ratio improved from 21.27% to
15.06% (mean absolute RGBA 0.05925 to 0.04248). These numbers support the
visual check; the acceptance condition is the recovered triangle geometry.

## Implementation And Verification

- `src/pgfplots/surface.js`: recognizes and lowers triangle patches.
- `src/pgfplots/addplotLowering.js`: directs triangle coordinates to that
  lowering before the four-corner surface-grid code.
- `src/pgfplots/libraries/patchplots.js`: dedicated per-library metadata;
  `src/pgfplots/libraries/index.js` exposes it.
- `test/pgfplots-patchplots.test.js`: covers Scene Graph fill/mesh paths and
  library declaration ownership.
- `test/fixtures/examples/pgfplots/patchplots-triangle.tex` plus manifest:
  preserves the real visual driver.
- `docs/extension-registry.{csv,md}`: generated entry is now `partial`, has
  the implementation owner, reviewed source, notes, and three cases.

```bash
node --test test/pgfplots-patchplots.test.js test/pgfplots-library-modules.test.js
node scripts/gallery-audit.js --only pgfplots-patchplots-triangle
npm run extension-registry
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-pgfplots-patchplots-triangle-2026-08-06 \
  --only pgfplots-patchplots-triangle --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-pgfplots-patchplots-triangle-2026-08-06 \
  --register --alignment-radius 3
```

The focused regressions pass, the driver has `[]` diagnostics, and the full
fixture audit reports `269/269 rendered, 0 diagnostics`.

## Next Slice

Implement either `patch type=rectangle` as two native-order triangles or
`patch type=line`; keep high-order patch classes and interpolation separate
because they require their own ordered control-point and shading model.
