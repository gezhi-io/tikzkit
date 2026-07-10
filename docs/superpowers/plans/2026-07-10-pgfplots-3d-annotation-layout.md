# PGFPlots 3D Annotation Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place PGFPlots 3D ticks, tick labels, scale labels, and axis labels from one view-aware projected-edge layout so annotations move outward from the visible box at different camera azimuths.

**Architecture:** Keep the existing PGFPlots 3D projection, ranges, surface sampling, colorbar, and SVG renderer unchanged. Extend `src/pgfplots/axis3d.js` with one renderer-neutral annotation layout helper that selects each projected box edge, derives its outward screen-space normal from the projected box center, and supplies the same edge/normal/anchor data to tick and axis-label lowering.

**Tech Stack:** ESM JavaScript, Node `node:test`, existing PGFPlots AxisModel/TikZ lowering, local `tikztosvg` + xelatex + `rsvg-convert` visual references.

## Global Constraints

- Browser runtime cannot depend on MacTeX, `tikztosvg`, or server-side compilation.
- MacTeX is the final correctness oracle; `tikztosvg` is the SVG-structure reference.
- Do not implement or promise a complete TeX engine.
- KaTeX remains behind TikZKit's text metrics, baseline, and node-box adapters; this slice does not change text rendering.
- The 1cm grid is QA-only and must not enter the ungridded SVG.
- Keep TikZ semantics in the PGFPlots/engine layer; do not emit SVG from the parser.
- Do not hard-code fixture IDs, source coordinates, or case-specific offsets.
- Preserve unrelated dirty-worktree changes and commit only files owned by this task.

---

### Task 1: Share projected-edge outward normals between 3D ticks and labels

**Files:**
- Modify: `src/pgfplots/axis3d.js`
- Modify: `test/pgfplots-seams.test.js`
- Regenerate: `outputs/qa-pgfplots-3d-annotation/` for the two real-case gates (generated QA artifacts only; do not commit them)

**Interfaces:**
- Consumes: `geometry.mapPoint3d(point) -> { x, y }`, `ranges.{xMin,xMax,yMin,yMax,zMin,zMax}`, and existing `axis3DTickLabelEdges()` edge selection.
- Produces: internal `axis3DAnnotationLayout(ranges, geometry)` entries `{ ...edge, midpoint, normal, anchor }` for axes `x`, `y`, and `z`; both `renderAxis3DTicks()` and `renderAxisLabels3D()` consume it.
- Does not change the public exports from `src/pgfplots/index.js`.

- [ ] **Step 1: Write the failing projected-normal regression test**

Add a focused test beside `pgfplots 3d grid and ticks choose view-dependent projected hull edges`. Use two mocked projections whose selected z edge appears on opposite horizontal sides. For each projection, call both `renderAxis3DTicks({ ztick: "{0}", zlabel: "$z$" }, ranges, geometry)` and `renderAxisLabels3D({ zlabel: "$z$" }, ranges, geometry)`. Parse the emitted z tick endpoint, z tick-label point/anchor, and z axis-label point/anchor. Assert:

```js
assert.ok(left.tickX < left.baseX);
assert.equal(left.tickAnchor, "east");
assert.ok(left.labelX < left.baseX);
assert.equal(left.labelAnchor, "east");

assert.ok(right.tickX > right.baseX);
assert.equal(right.tickAnchor, "west");
assert.ok(right.labelX > right.baseX);
assert.equal(right.labelAnchor, "west");
```

Also assert the tick and axis-label displacement vectors have positive dot products with the same outward normal. The test must fail against the current fixed-left z placement.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test --test-name-pattern="3d annotations share view-aware projected edge normals" test/pgfplots-seams.test.js
```

Expected: FAIL because the current z tick and z label always use fixed negative-x offsets and fixed east/south anchors.

- [ ] **Step 3: Implement the shared annotation layout**

In `src/pgfplots/axis3d.js`, retain `axis3DTickLabelEdges()` as the edge selector but include projected endpoints on each candidate. Add helpers with this behavior:

```js
function axis3DAnnotationLayout(ranges, geometry) {
  const edges = axis3DTickLabelEdges(ranges, geometry);
  const center = projectedBoxCenter(ranges, geometry);
  return Object.fromEntries(Object.entries(edges).map(([axis, edge]) => {
    const tangent = normalizedVector(edge.from, edge.to);
    let normal = { x: -tangent.y, y: tangent.x };
    const outward = { x: edge.midpoint.x - center.x, y: edge.midpoint.y - center.y };
    if (dot2(normal, outward) < 0) normal = { x: -normal.x, y: -normal.y };
    return [axis, { ...edge, normal, anchor: anchorForOutwardNormal(normal) }];
  }));
}

function anchorForOutwardNormal(normal) {
  if (Math.abs(normal.x) >= Math.abs(normal.y)) return normal.x >= 0 ? "west" : "east";
  return normal.y >= 0 ? "south" : "north";
}
```

`normalizedVector`, `dot2`, and `projectedBoxCenter` must handle degenerate projections with finite fallbacks. `projectedBoxCenter` is the average of the eight projected 3D box corners. Do not read DOM/SVG metrics here.

- [ ] **Step 4: Lower ticks and labels from the same layout**

Update `renderAxis3DTicks()`:

- map each tick to the selected data-space edge as today;
- start from `base + normal * 0.08` for the tick endpoint;
- start from `base + normal * 0.13` for the tick-label point;
- use the layout anchor instead of fixed north/west/east;
- place the scaled-z multiplier from the same z edge/normal with a larger finite offset, preserving `formatScaledAxisTickLabel()` and existing tick values.

Update `renderAxisLabels3D()`:

- use the x/y/z selected edge midpoint from `axis3DAnnotationLayout()`;
- start from offsets along the same normal of `0.36` for x, `0.42` for y, and `0.48` for z;
- use the layout anchor for x/y/z labels;
- retain `rotate=90` for the z label;
- retain the existing title logic, which is outside this slice.

Do not change surface polygons, projection basis, tick values, range resolution, colorbar logic, fonts, renderer bounds, or overlay lowering.

The listed distances are initial global calibration values, not fixture contracts. If the native-bbox tests or the two real-case gates show that a distance reserves too much or too little space, calibrate the shared axis-specific constant while preserving the selected edge, outward-normal direction, anchor semantics, and zero case-specific branches.

- [ ] **Step 5: Run focused and PGFPlots regression tests**

Run:

```bash
node --test test/pgfplots-seams.test.js test/svg-renderer.test.js test/convert.test.js
```

Expected: all tests pass. Update old exact-coordinate assertions only where the new view-aware normal intentionally changes their output; retain assertions for tick values, scale labels, and grid edges.

- [ ] **Step 6: Regenerate and inspect two real-case gates**

Run:

```bash
npm run examples:render -- --fixtures test/fixtures/examples --output outputs/qa-pgfplots-3d-annotation --only latex-examples-3d-gaussian-distribution,latex-examples-3d-function-8 --strict-tikztosvg --comparison-grid-mode svg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-pgfplots-3d-annotation
```

Actually inspect both generated `*-sheet.png` files. Acceptance requires:

- gaussian: `x_1`, `x_2`, and `P` remain associated with the exposed projected box edges and do not move inward over the surface;
- function-8: z tick labels, z label, and `10^{-2}` scale marker move consistently outward while the ungridded SVG remains approximately `440.48pt x 339.93pt`;
- neither case loses paths, labels, surface polygons, grid, frame, or colorbar;
- diagnostics remain zero for both cases;
- visual placement improves in both cases; a lower diff number alone is insufficient.

If either case visibly regresses, revise the normal orientation/anchor logic and repeat the focused tests and visual gate before committing.

- [ ] **Step 7: Commit the capability slice**

```bash
git add src/pgfplots/axis3d.js test/pgfplots-seams.test.js
git commit -m "Align PGFPlots 3D annotations to projected edges"
```

Do not stage generated output artifacts or unrelated dirty files.

### Task 2: Record the verified slice and remaining 3D differences

**Files:**
- Modify: `src/capabilities/matrix.js`
- Modify: `test/capabilities.test.js`

**Interfaces:**
- Consumes: the reviewed Task 1 tests and `outputs/qa-pgfplots-3d-annotation/` visual artifacts.
- Produces: an updated `capabilityMatrix.pgfplots_3d_surface` record with owner modules, real fixtures, verification artifacts, and remaining differences.

- [ ] **Step 1: Write the failing capability assertion**

Add a test that requires the existing `pgfplots_3d_surface` row to retain `partial` status and record both real gates plus the QA artifact directory:

```js
test("capability matrix records PGFPlots 3D annotation visual gates", () => {
  const feature = capabilityMatrix.pgfplots_3d_surface;
  assert.equal(feature.semantic, "partial");
  assert.equal(feature.svg, "partial");
  assert.ok(feature.modules.includes("src/pgfplots/axis3d.js"));
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/3d-gaussian-distribution.tex"));
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/3d-function-8.tex"));
  assert.deepEqual(feature.verification.artifacts, ["outputs/qa-pgfplots-3d-annotation"]);
  assert.match(feature.notes, /view-aware projected-edge annotation layout/i);
  assert.match(feature.notes, /remaining/i);
});
```

- [ ] **Step 2: Run the capability test and verify RED**

Run:

```bash
node --test --test-name-pattern="PGFPlots 3D annotation visual gates" test/capabilities.test.js
```

Expected: FAIL because the two fixtures, artifact directory, and updated notes are absent.

- [ ] **Step 3: Update the existing partial capability row**

Keep `parser`, `semantic`, and `svg` as `partial`. Extend `fixtures` with the gaussian and function-8 fixture paths, add:

```js
artifacts: ["outputs/qa-pgfplots-3d-annotation"]
```

inside `verification`, and update `notes` to state that view-aware projected-edge annotation layout is verified for opposing views. The same note must explicitly retain remaining differences: projection calibration, surface/color interpolation, overlays, colorbar placement, and exact TeX glyph metrics.

- [ ] **Step 4: Run capability and focused semantic tests**

Run:

```bash
node --test test/capabilities.test.js test/pgfplots-seams.test.js
```

Expected: all tests pass and `pgfplots_3d_surface` remains partial.

- [ ] **Step 5: Preserve the dirty-worktree boundary**

Because `src/capabilities/` and `test/capabilities.test.js` contain pre-existing uncommitted architecture work, do not stage or commit them as part of this task. Record before/after snapshot hashes and hand the focused diff to the reviewer.
