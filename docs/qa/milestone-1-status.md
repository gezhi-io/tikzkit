# Milestone 1 Historical Ledger

This page records the original 30-case milestone snapshot. The active
[`milestone-1.json`](../../test/fixtures/examples/milestone-1.json) manifest has
since expanded beyond those original cases, so this page is historical rather
than the current acceptance dashboard.

The SVG, PNG, and diff files cited by the original report are generated under
`test/fixtures/examples/output/`. They are intentionally ignored by Git and do
not exist as permanent GitHub files. See [Generated Artifacts](../generated-artifacts.md)
to reproduce them locally.

At the time of the snapshot, all 30 cases rendered with empty TikZKit
diagnostic lists, but all still required human visual review. A zero-diagnostic
render is not a visual acceptance result.

| Source case | Feature inventory | Snapshot diagnostics | Snapshot status |
| --- | --- | --- | --- |
| [latex-examples-2048](../../test/fixtures/examples/latex-examples/2048.tex) | TikZ; `fit`, `backgrounds`; `foreach`, paths, nodes | None (0) | Accepted 2026-09-05; see [case-by-case ledger](case-by-case-acceptance.md) |
| [latex-examples-2d-chi-squared-cdf](../../test/fixtures/examples/latex-examples/2d-chi-squared-cdf.tex) | PGFPlots; `foreach`; `addplot` | None (0) | Accepted 2026-09-05; see [case-by-case ledger](case-by-case-acceptance.md) |
| [latex-examples-2d-chi-squared-pdf](../../test/fixtures/examples/latex-examples/2d-chi-squared-pdf.tex) | PGFPlots; `foreach`; `addplot` | None (0) | Accepted 2026-09-05; see [case-by-case ledger](case-by-case-acceptance.md) |
| [latex-examples-2d-epochs-overfitting](../../test/fixtures/examples/latex-examples/2d-epochs-overfitting.tex) | PGFPlots; positioning/decorations; `addplot`, paths | None (0) | Accepted 2026-09-05; see [case-by-case ledger](case-by-case-acceptance.md) |
| [latex-examples-2d-light-bulb](../../test/fixtures/examples/latex-examples/2d-light-bulb.tex) | PGFPlots; positioning/decorations; `addplot`, paths | None (0) | Accepted 2026-09-05; see [case-by-case ledger](case-by-case-acceptance.md) |
| [latex-examples-2d-parted-function](../../test/fixtures/examples/latex-examples/2d-parted-function.tex) | PGFPlots; `addplot` | None (0) | Accepted 2026-09-05; see [case-by-case ledger](case-by-case-acceptance.md) |
| [latex-examples-2d-x-square-with-circle](../../test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex) | PGFPlots; `addplot`, paths | None (0) | Accepted 2026-09-05; see [case-by-case ledger](case-by-case-acceptance.md) |
| [latex-examples-3d-cmos-loss-diagram](../../test/fixtures/examples/latex-examples/3d-cmos-loss-diagram.tex) | PGFPlots 3D; `patchplots`; `addplot3` | None (0) | Accepted 2026-09-05; see [case-by-case ledger](case-by-case-acceptance.md) |
| [latex-examples-3d-function-2](../../test/fixtures/examples/latex-examples/3d-function-2.tex) | PGFPlots 3D; `addplot3` | None (0) | Accepted 2026-09-05: 56x56 quadratic surface, faceted shader, 3D projection/grid/ticks/labels, and colorbar match MacTeX/tikztosvg; focused regression added. |
| [latex-examples-3d-function-3](../../test/fixtures/examples/latex-examples/3d-function-3.tex) | PGFPlots 3D; `addplot3` | None (0) | Accepted 2026-09-05: rational saddle singularity, 56x56 faceted surface, rotated 3D view, grid/ticks/labels, and colorbar match MacTeX/tikztosvg. |
| [latex-examples-3d-function-4](../../test/fixtures/examples/latex-examples/3d-function-4.tex) | PGFPlots 3D; `addplot3` | None (0) | Accepted 2026-09-05: normalized saddle, central transition, 56x56 faceted surface, projection/grid/ticks/labels, and colorbar match MacTeX/tikztosvg. |
| [latex-examples-3d-function-5](../../test/fixtures/examples/latex-examples/3d-function-5.tex) | PGFPlots 3D; `addplot3` | None (0) | Accepted 2026-09-05: radial cone, 56x56 faceted sampling, 65/35 projection, grid/ticks/labels, and colorbar match MacTeX/tikztosvg. |
| [latex-examples-3d-function-6](../../test/fixtures/examples/latex-examples/3d-function-6.tex) | PGFPlots 3D; `addplot3` | None (0) | Accepted 2026-09-05: three-lobed rational surface, 56x56 faceted sampling, projection/grid/ticks/labels, and colorbar match MacTeX/tikztosvg. |
| [latex-examples-3d-function-7](../../test/fixtures/examples/latex-examples/3d-function-7.tex) | PGFPlots 3D; `addplot3` | None (0) | Accepted 2026-09-05: asymmetric domain, quartic rational surface, exact 599x457 bounds, projection/grid/ticks/labels, and colorbar match MacTeX/tikztosvg. |
| [latex-examples-3d-function-8](../../test/fixtures/examples/latex-examples/3d-function-8.tex) | PGFPlots 3D; `addplot3` | None (0) | Accepted 2026-09-05: legacy 50x50 fixed-point sampling, radial ripple topology, 65/65 projection, scientific colorbar, grid/ticks/labels, and exact 603x469 raster bounds match MacTeX/tikztosvg. |
| [latex-examples-3d-function-9](../../test/fixtures/examples/latex-examples/3d-function-9.tex) | PGFPlots 3D; `addplot3` | None (0) | Accepted 2026-09-06: 50x50 sinusoidal ridge, measured projected tick/axis labels, grid, colorbar, and topology match MacTeX/tikztosvg; only browser-text crop remains. |
| [latex-examples-3d-function-continuous](../../test/fixtures/examples/latex-examples/3d-function-continuous.tex) | PGFPlots 3D; `addplot3` | None (0) | Accepted 2026-09-06: 55x55 rational surface, central pinch, projection, labels, and colorbar match MacTeX/tikztosvg; only browser-text crop remains. |
| [latex-examples-3d-function-semicubical-parabola](../../test/fixtures/examples/latex-examples/3d-function-semicubical-parabola.tex) | PGFPlots 3D; `addplot3` | None (0) | Visual review required |
| [latex-examples-3d-gaussian-distribution](../../test/fixtures/examples/latex-examples/3d-gaussian-distribution.tex) | PGFPlots 3D; `addplot3`, paths, nodes | None (0) | Visual review required |
| [latex-examples-3d-gradient-colored](../../test/fixtures/examples/latex-examples/3d-gradient-colored.tex) | PGFPlots 3D; `arrows.meta`; `addplot3` | None (0) | Visual review required |
| [latex-examples-3d-gradient-cos](../../test/fixtures/examples/latex-examples/3d-gradient-cos.tex) | PGFPlots 3D; `patchplots`; `addplot3` | None (0) | Visual review required |
| [latex-examples-3d-helix](../../test/fixtures/examples/latex-examples/3d-helix.tex) | PGFPlots 3D; `addplot3` | None (0) | Visual review required |
| [latex-examples-3d-manhattan-bar-plot](../../test/fixtures/examples/latex-examples/3d-manhattan-bar-plot.tex) | PGFPlots 3D; `addplot3` | None (0) | Visual review required |
| [latex-examples-3d-vector](../../test/fixtures/examples/latex-examples/3d-vector.tex) | TikZ 3D (`tikz-3dplot`); paths | None (0) | Visual review required |
| [latex-examples-activation-functions](../../test/fixtures/examples/latex-examples/activation-functions.tex) | PGFPlots; `addplot` | None (0) | Visual review required |
| [latex-examples-agent-environment-diagram-mdp](../../test/fixtures/examples/latex-examples/agent-environment-diagram-mdp.tex) | TikZ; shapes/snakes/positioning/decorations; nodes, paths | None (0) | Visual review required |
| [latex-examples-agent-environment-diagram-pomdp](../../test/fixtures/examples/latex-examples/agent-environment-diagram-pomdp.tex) | TikZ; shapes/snakes/positioning/decorations; nodes, paths | None (0) | Visual review required |
| [latex-examples-agent-environment-diagram-rl](../../test/fixtures/examples/latex-examples/agent-environment-diagram-rl.tex) | TikZ; shapes/snakes/positioning/decorations; nodes, paths | None (0) | Visual review required |
| [latex-examples-aggregation-blocks](../../test/fixtures/examples/latex-examples/aggregation-blocks.tex) | TikZ; arrows/shapes/positioning; nodes, paths | None (0) | Visual review required |
| [latex-examples-arbelos](../../test/fixtures/examples/latex-examples/arbelos.tex) | TikZ; coordinates, paths | None (0) | Visual review required |
