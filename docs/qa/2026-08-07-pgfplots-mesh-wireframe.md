# PGFPlots 3D `mesh` Wireframes

## Scope

This slice implements only 3D `mesh` plot paint semantics: a rectangular
sample matrix becomes unfilled, cycle-colored quadrilateral outlines. It does
not claim general PGFPlots mesh support.

Driver: `test/fixtures/examples/pgfplots/plot-box-ratio-3d.tex`.

```tex
\begin{axis}[
  width=5cm,
  samples=10,
  mesh,
  no marks,
  view={120}{35},
  plot box ratio={1}{2}{1}
]
  \addplot3 {y};
\end{axis}
```

The semantic audit is recorded in
[`2026-08-07-pgfplots-mesh-wireframe-audit.md`](2026-08-07-pgfplots-mesh-wireframe-audit.md).
It remains `incomplete` because it inventories the entire document and its
existing partial `pgfplots` dependency; it has no blocker and the focused
`mesh` option is implemented here.

## Local TeX Reading

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsmeshplothandler.code.tex`.
Its mesh initialization forces mesh mode through the flat handler, then resolves
the linear input stream into rows and columns from `mesh/rows`, `mesh/cols`,
scanline length, or a supplied point count. That is why this implementation
keeps the sampled grid topology and emits one quadrilateral outline per cell;
it does not reuse the shaded-surface color mapper.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion uses
`/opt/homebrew/bin/rsvg-convert` through the fixture renderer. The full panel,
including MacTeX native PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, 1cm grids,
and registered diff, is at:

`/private/tmp/tikzkit-qa-pgfplots-mesh-wireframe-2026-08-07/index.html`

The tikztosvg SVG contains clipped `<path>` elements with `fill="none"`, a
blue stroke, `stroke-width="0.3985"`, butt caps, miter joins, and closed
four-corner path data. TikZKit now has the same no-fill, blue quadrilateral
structure. It preserves the renderer's ordinary SVG transform and viewBox
pipeline instead of adding a special SVG-only path format.

Before the change, TikZKit emitted 81 opaque mapped-color surface faces with
faceted outlines: the plane appeared cyan/yellow/orange and obscured the mesh
semantics. After the change, the real driver emits 81 blue unfilled cells, so
the visible plane matches the reference's wireframe. The JavaScript versus
tikztosvg raw changed-pixel ratio fell from 24.96% to 23.31%, and mean RGBA
residual from 0.0679 to 0.0563. These numbers are supporting evidence only:
the accepted visual difference is removal of the incorrect colored fill.

Remaining visible differences are the pre-existing projected 3D box geometry,
tick/label placement, text rasterization, and tight crop. The mesh path follows
the native flat-handler precedence when `shader=interp` is also present; it
does not separately implement mesh shader variants, per-vertex color mapping,
non-rectangular holes, patch input, or exact z-buffer ordering.

## Implementation And Verification

- `src/pgfplots/surface.js`: routes function, coordinate, and parametric 3D
  mesh grids through `renderAxisMeshWireframePatches`; `surf` keeps its fill
  path. The mesh slice accepts cycle/explicit colors, opacity, named or
  explicit line widths, dash patterns, line caps, and line joins.
- `test/pgfplots-seams.test.js`: regression for an axis-level mesh, no surface
  fill, default blue cycle color, and an explicit red/very-thick override.
- `src/packages/pgfplots.js`, `docs/extension-registry.md`, and
  `docs/extension-registry.csv`: implementation ownership, local-source review,
  feature, and partial boundary.

Commands run:

```bash
node --test --test-name-pattern='pgfplots mesh lowers 3D function grids|pgfplots surface lowering owns coordinate meshes' test/pgfplots-seams.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples/pgfplots --only plot-box-ratio-3d --output /private/tmp/tikzkit-qa-pgfplots-mesh-wireframe-2026-08-07 --native-reference --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
node scripts/diff-example-pngs.js --output /private/tmp/tikzkit-qa-pgfplots-mesh-wireframe-2026-08-07 --register --alignment-radius 3
npm run case:audit -- test/fixtures/examples/pgfplots/plot-box-ratio-3d.tex --output docs/qa/2026-08-07-pgfplots-mesh-wireframe-audit.md --strict
```

The two focused regressions pass; all three renderers succeed with no external
failures and the driver has no TikZKit diagnostics. The last audit command
intentionally exits nonzero because the document-level audit remains marked
incomplete, not because the mesh render fails.
