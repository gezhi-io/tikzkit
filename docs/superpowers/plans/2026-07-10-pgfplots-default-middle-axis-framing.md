# PGFPlots Default Middle-Axis Framing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calibrate the physical plot rectangle for default-size, enlarged, middle-axis PGFPlots figures to the TeX Live 2025 / PGFPlots 1.18.2 `45pt` reserve and `0.2pt` outer-margin model.

**Architecture:** Keep range resolution and data transforms in `src/pgfplots/geometry.js`; change only the shared TeX-unit constants consumed by that model. Do not compensate in SVG viewBox code or branch on fixture IDs. Use two independent real fixtures to prove the calibration is shared.

**Tech Stack:** ESM JavaScript, Node test runner, TikZKit SceneGraph/SVG pipeline, local MacTeX/tikztosvg oracle, `rsvg-convert`, PNG visual diff tooling.

## Global Constraints

- MacTeX is authoritative; local PGFPlots 1.18.2 reserves `45pt` for the default non-boxed/middle-axis plot rectangle.
- Use exact TeX dimensions through `parseDimension("45pt", {})` and `parseDimension("0.2pt", {})`; do not encode new decimal fits from one raster.
- The `0.2pt` value is the base frame overflow on all sides. The existing auto-Y-range bottom reserve is a separate transitional tick-label overflow compatibility path; preserve it in this slice, stop it from overriding the exact top overflow, and record its replacement by measured tick-layout bounds as later work.
- This slice changes framing only. Axis labels, arrow tips, tick generation/font size, paint order, line width, and plot sampling remain unchanged and explicitly tracked as later work.
- Do not add fixture-ID, source-path, node-name, or coordinate hardcoding to production code.
- Display comparison grids are not semantic input and must not affect generated SVG geometry.
- The shared worktree is dirty. Take before snapshots, produce focused `git diff --no-index` evidence, and do not stage or commit dirty implementation/capability files.
- Generated QA artifacts stay under `outputs/qa-pgfplots-middle-axis-framing/` and are not committed.

---

### Task 1: Calibrate default enlarged middle-axis framing

**Files:**
- Modify: `src/tikz/metrics.js`
- Modify: `src/pgfplots/geometry.js`
- Modify: `test/pgfplots-seams.test.js`

**Interfaces:**
- Consumes: `parseDimension(value, context)` and `createAxisGeometry(axisOptions, ranges)`.
- Produces: shared default middle-axis reserve constants equal to `45pt`, and enlarged middle-axis margins equal to `0.2pt` on all four sides.

- [ ] **Step 1: Capture dirty-worktree ownership evidence**

Copy current owned files to:

```bash
cp src/tikz/metrics.js /private/tmp/tikzkit-middle-axis-framing-metrics-before.js
cp src/pgfplots/geometry.js /private/tmp/tikzkit-middle-axis-framing-geometry-before.js
cp test/pgfplots-seams.test.js /private/tmp/tikzkit-middle-axis-framing-seams-before.test.js
shasum -a 256 src/tikz/metrics.js src/pgfplots/geometry.js test/pgfplots-seams.test.js
```

- [ ] **Step 2: Write the failing geometry contract**

Add a test named `pgfplots default enlarged middle-axis framing uses native TeX reserves` that constructs:

```js
const geometry = createAxisGeometry(
  {
    "axis x line": "middle",
    "axis y line": "middle",
    xmin: "-1",
    xmax: "6",
    ymin: "-0.25",
    ymax: "2.25",
    enlargelimits: "true"
  },
  { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 }
);
const reserve = parseDimension("45pt", {});
const margin = parseDimension("0.2pt", {});
assert.ok(Math.abs(geometry.width - (PGFPLOTS_DEFAULT_AXIS_WIDTH - reserve)) < 1e-9);
assert.ok(Math.abs(geometry.height - (PGFPLOTS_DEFAULT_AXIS_HEIGHT - reserve)) < 1e-9);
assert.deepEqual(geometry.margin, { left: margin, right: margin, top: margin, bottom: margin });
```

Add a second assertion for the auto-Y-range variant (explicit `xmin`/`xmax`, no `ymin`/`ymax`): its `margin.top` must equal `0.2pt`; its existing `margin.bottom` must remain larger than the base margin because it is the current explicit tick-label overflow reserve.

Import `PGFPLOTS_DEFAULT_AXIS_WIDTH` and `PGFPLOTS_DEFAULT_AXIS_HEIGHT` from `src/pgfplots/geometry.js` if the test does not already import them.

- [ ] **Step 3: Verify RED**

```bash
node --test --test-name-pattern="default enlarged middle-axis framing uses native TeX reserves" test/pgfplots-seams.test.js
```

Expected: fail because current reserves are `1.607cm` / `1.603cm` and current margins are `0.02cm` / `0.018cm`.

- [ ] **Step 4: Implement exact shared TeX dimensions**

In `src/tikz/metrics.js`, replace the fitted default constants with shared TeX dimensions:

```js
const TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVE = parseDimension("45pt", {});
const TIKZ_PGFPLOTS_ENLARGED_MIDDLE_AXIS_MARGIN = parseDimension("0.2pt", {});

export const TIKZ_ENLARGED_MIDDLE_AXIS_CONTAINER_MARGIN = {
  left: TIKZ_PGFPLOTS_ENLARGED_MIDDLE_AXIS_MARGIN,
  right: TIKZ_PGFPLOTS_ENLARGED_MIDDLE_AXIS_MARGIN,
  top: TIKZ_PGFPLOTS_ENLARGED_MIDDLE_AXIS_MARGIN,
  bottom: TIKZ_PGFPLOTS_ENLARGED_MIDDLE_AXIS_MARGIN
};

export const TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_X = TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVE;
export const TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVED_Y = TIKZ_PGFPLOTS_DEFAULT_MIDDLE_AXIS_RESERVE;
```

Leave explicit-size, tight-bounds, hidden-axis, 3D, and non-enlarged constants unchanged.

In `src/pgfplots/geometry.js`, keep the auto-Y-range bottom reserve but remove its old `margin.top = 0.03` override. The cloned shared margin already supplies the MacTeX `0.2pt` top overflow:

```js
if (hasExplicitXRange && !hasExplicitYRange) {
  margin.bottom = 0.173;
}
```

Do not add source/fixture checks. Do not change the bottom value in this slice; replacing it with measured tick-label bounds is explicitly later work.

- [ ] **Step 5: Verify GREEN and regression boundary**

```bash
node --test --test-name-pattern="default enlarged middle-axis framing|split middle axes|default middle axes|middle axis" test/pgfplots-seams.test.js
node --test test/example-fixtures.test.js test/example-render-script.test.js
```

Expected: all selected tests pass. If the full `pgfplots-seams` suite is also run, record the pre-existing baseline failures separately and require no new failures.

Update only coordinate expectations that are direct consequences of the new exact `45pt` rectangle. Preserve the native bbox and vertical-placement gates for x-square, and preserve the known non-enlarged `axis-middle-lines` bbox failure as a separately tracked baseline.

- [ ] **Step 6: Generate both real visual gates**

```bash
npm run examples:render -- --fixtures test/fixtures/examples --output outputs/qa-pgfplots-middle-axis-framing --only latex-examples-2d-parted-function --only latex-examples-2d-x-square-with-circle --strict-tikztosvg --no-comparison-grid --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-pgfplots-middle-axis-framing
```

Actually inspect both TikZKit/tikztosvg/diff sheets. Acceptance requires:

- `latex-examples-2d-parted-function`: changed ratio at most `2.0%`, RGBA MAE at most `0.0027`;
- `latex-examples-2d-x-square-with-circle`: changed ratio at most `5.0%`, RGBA MAE at most `0.0060`;
- default plot rectangle equals `195pt x 162pt` within `0.02pt`;
- key grid/plot coordinates differ from reference by at most `0.05pt`;
- document dimensions stay within `0.03pt` width and `0.03pt` height of reference;
- both cases render with zero diagnostics and no missing plots, ticks, labels, axes, or layers;
- visible geometry improvement is confirmed, not inferred only from diff statistics.

- [ ] **Step 7: Produce focused review evidence**

Create final SHA-256 records and focused diffs:

```bash
shasum -a 256 src/tikz/metrics.js src/pgfplots/geometry.js test/pgfplots-seams.test.js
git diff --no-index -- /private/tmp/tikzkit-middle-axis-framing-metrics-before.js src/tikz/metrics.js > /private/tmp/tikzkit-middle-axis-framing-metrics.diff
git diff --no-index -- /private/tmp/tikzkit-middle-axis-framing-geometry-before.js src/pgfplots/geometry.js > /private/tmp/tikzkit-middle-axis-framing-geometry.diff
git diff --no-index -- /private/tmp/tikzkit-middle-axis-framing-seams-before.test.js test/pgfplots-seams.test.js > /private/tmp/tikzkit-middle-axis-framing-seams.diff
```

Write the test counts, artifact paths, exact vector measurements, and actual visual observations to `.superpowers/sdd/pgfplots-middle-axis-framing-task-1-report.md`.

---

### Task 2: Record the verified framing capability

**Files:**
- Modify: `src/capabilities/matrix.js`
- Modify: `test/capabilities.test.js`

**Interfaces:**
- Consumes: Task 1's two real fixtures and `outputs/qa-pgfplots-middle-axis-framing` evidence.
- Produces: an updated existing `pgfplots_axis` capability record; no new feature ID.

- [ ] **Step 1: Write a failing capability assertion**

Add a test named `capability matrix records default middle-axis framing visual gates` that requires:

```js
const feature = capabilityMatrix.pgfplots_axis;
assert.equal(feature.parser, "partial");
assert.equal(feature.semantic, "partial");
assert.equal(feature.svg, "partial");
assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/2d-parted-function.tex"));
assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex"));
assert.ok(feature.verification.artifacts.includes("outputs/qa-pgfplots-middle-axis-framing"));
assert.match(feature.notes, /default enlarged middle-axis framing/i);
assert.match(feature.notes, /45pt reserve/i);
assert.match(feature.notes, /0\.2pt outer margins/i);
assert.match(feature.notes, /remaining/i);
assert.match(feature.notes, /labels/i);
assert.match(feature.notes, /arrow/i);
assert.match(feature.notes, /ticks/i);
assert.match(feature.notes, /paint order/i);
```

Also assert fixture and artifact arrays contain no duplicates.

- [ ] **Step 2: Verify RED**

```bash
node --test --test-name-pattern="default middle-axis framing visual gates" test/capabilities.test.js
```

Expected: fail because the existing row does not record these real gates.

- [ ] **Step 3: Update only the existing `pgfplots_axis` row**

Keep parser/semantic/SVG status `partial`. Add both fixtures and the QA artifact. Record the exact verified framing boundary and retain the remaining gaps: terminal label placement, classic stealth geometry, axis line width, origin/padded minor tick behavior, tick-label metrics, layer ordering, and broader PGFPlots input handlers.

- [ ] **Step 4: Run capability and combined regression suites**

```bash
node --test test/capabilities.test.js test/pgfplots-seams.test.js test/example-fixtures.test.js test/example-render-script.test.js
```

Expected: no new failures relative to the captured PGFPlots baseline; capability, fixture, and render-script tests pass.

- [ ] **Step 5: Preserve the dirty-worktree boundary**

Record before/after SHA-256 hashes and focused diffs for `src/capabilities/matrix.js` and `test/capabilities.test.js`. Do not stage or commit these dirty files. Write `.superpowers/sdd/pgfplots-middle-axis-framing-task-2-report.md` and let the main agent update `.superpowers/sdd/progress.md` only after independent review.

## Plan Self-Review

- Scope covers one shared framing capability and excludes label/arrow/tick/layer fixes; the auto-Y bottom tick-label overflow remains explicitly transitional.
- Exact units, owner files, interfaces, RED/GREEN commands, real artifacts, visual gates, and dirty-worktree evidence are specified.
- No placeholder, fixture branch, duplicate capability row, or full-PGFPlots compatibility claim is permitted.
