# PGFPlots Faceted Surface Painter Order Implementation Plan

> **Goal:** Match native PGFPlots faceted-surface occlusion by emitting each depth-ordered patch as its own fill/stroke pair, then record the verified compatibility slice without claiming complete 3D support.

## Context and Oracle

The frozen 30-case milestone contains 14 faceted 3D surface cases. TikZKit already orders patches by the selected PGFPlots z-buffer policy, but `renderAxisSurfacePatchLayerCommands()` currently emits every fill first and every mesh stroke afterward. That global mesh pass leaves far patch edges visible over nearer faces.

MacTeX is authoritative. Review `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsmeshplothandler.code.tex`, especially `\pgfplotsplothandlermesh@VISUALIZE@std@separate@fillstroke`, `\pgfplotsplothandlermesh@init@flat@color@usepath`, and `\pgfplotsplothandlermeshusepathfillstroke`. Native PGFPlots performs fill/stroke while visualizing each patch. Use the generated tikztosvg SVGs as structural evidence that patch paint operations alternate in z-buffer order.

## Global Constraints

- Keep the semantic change in `src/pgfplots/surface.js`; parser and SVG renderer must not gain PGFPlots-specific ordering knowledge.
- Preserve the existing patch order selected by `z buffer=none`, explicit scanline modes, `z buffer=sort`, and the default view-aware scanline policy.
- For each faceted patch, emit its fill immediately followed by its mesh stroke. If mesh is disabled, emit only the fill. Do not combine distinct patches into one path.
- Preserve axis layer ordering: box/grid before surface commands; ticks, labels, and colorbar after surface commands.
- Do not change top-view `shader=interp` raster behavior, projection math, colormap interpolation, colorbar placement, overlays, text metrics, or the reviewed 3D annotation layout.
- No fixture-specific coordinates or case-ID branches.
- Generated QA artifacts stay under `outputs/qa-pgfplots-faceted-order/` and are not committed.
- Because the owned implementation and capability files contain pre-existing uncommitted work, use before/after snapshots and focused diffs; do not stage or commit those dirty files.

## Task 1: Interleave fill and mesh commands per ordered patch

**Files:**
- Modify: `src/pgfplots/surface.js`
- Modify: `test/pgfplots-seams.test.js`

**Interfaces:**
- Consumes: ordered patch records produced by coordinate and sampled surface lowering.
- Produces: TikZ semantic commands in `fill(patch 1), mesh(patch 1), fill(patch 2), mesh(patch 2)` order.

- [ ] **Step 1: Add failing semantic tests**

Update the existing multi-patch surface assertion and add focused coverage that proves:

1. two ordered faceted patches emit alternating fill/mesh commands;
2. `z buffer=sort` and default scanline ordering still choose the same first patch after interleaving;
3. a mesh-disabled/interpolated patch emits no empty mesh command;
4. stepped coordinate/cuboid faces also use the same per-patch pairing;
5. the full axis lowering still keeps grid/box before surfaces and ticks/labels after surfaces.

Run:

```bash
node --test --test-name-pattern="faceted surface|surface patch paint order|surface layers" test/pgfplots-seams.test.js
```

Expected: at least the alternating-order assertion fails because current output is `fill 1, fill 2, mesh 1, mesh 2`.

- [ ] **Step 2: Implement the smallest shared semantic change**

Keep `renderAxisSurfacePatchLayers()` responsible for one patch. Change `renderAxisSurfacePatchLayerCommands(layers)` to flatten each layer in order:

```js
function renderAxisSurfacePatchLayerCommands(layers) {
  return layers.flatMap((layer) => [layer.fillCommand, layer.meshCommand].filter(Boolean));
}
```

Do not alter patch construction, depth calculation, scanline order, color selection, line width, or renderer code.

- [ ] **Step 3: Run focused and regression tests**

```bash
node --test test/pgfplots-seams.test.js test/svg-renderer.test.js test/convert.test.js
```

Expected: all tests pass. Existing exact command-order assertions may change only where they encoded the old global mesh pass.

- [ ] **Step 4: Generate isolated real-case artifacts**

```bash
npm run examples:render -- --fixtures test/fixtures/examples --output outputs/qa-pgfplots-faceted-order --only latex-examples-3d-function-2,latex-examples-3d-function-8,latex-examples-3d-gradient-cos,latex-examples-3d-manhattan-bar-plot --strict-tikztosvg --comparison-grid-mode svg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-pgfplots-faceted-order
```

- [ ] **Step 5: Inspect the four comparison sheets**

Actually view native/tikztosvg, TikZKit, and diff content for all four cases. Acceptance requires:

- far mesh edges are occluded by nearer filled faces instead of crossing them;
- no surface patch, grid line, frame, tick, label, or colorbar disappears;
- function-8 remains approximately `440.48pt x 339.93pt` before QA-grid injection;
- Manhattan top and side facets have coherent local borders rather than a global overdraw veil;
- diagnostics stay at zero;
- visual structure improves; diff percentage is supporting evidence only.

If any case visibly regresses, revise only the pairing logic or its tests and repeat the visual gate.

## Task 2: Record the verified faceted-order slice

**Files:**
- Modify: `src/capabilities/matrix.js`
- Modify: `test/capabilities.test.js`

**Interfaces:**
- Consumes: Task 1 tests and `outputs/qa-pgfplots-faceted-order/`.
- Produces: an updated partial `pgfplots_3d_surface` capability record.

- [ ] **Step 1: Add a failing capability assertion**

Require the existing row to remain `partial`, include the four real fixtures, include the new artifact directory, mention verified per-patch faceted painter ordering, and preserve the remaining gaps.

- [ ] **Step 2: Verify RED**

```bash
node --test --test-name-pattern="PGFPlots faceted painter visual gates" test/capabilities.test.js
```

- [ ] **Step 3: Update the existing row only**

Append the four fixtures without duplicates. Add `outputs/qa-pgfplots-faceted-order` to `verification.artifacts` while retaining the annotation artifact directory. State that per-patch faceted painter ordering is verified. Keep `parser`, `semantic`, and `svg` partial and explicitly retain remaining differences: projection calibration, surface/color interpolation, overlays, colorbar placement, exact TeX glyph metrics, and unsupported shader/patch modes.

- [ ] **Step 4: Run the capability and semantic suites**

```bash
node --test test/capabilities.test.js test/pgfplots-seams.test.js
```

Expected: all tests pass and `pgfplots_3d_surface` remains partial.

- [ ] **Step 5: Preserve the dirty-worktree boundary**

Record before/after hashes and focused diffs for the reviewer. Do not stage or commit the dirty capability or implementation files.
