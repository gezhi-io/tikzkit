# PGFPlots Middle-Axis Terminal Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place default `xlabel` and `ylabel` nodes at the final enlarged middle-axis endpoints, matching PGFPlots `ticklabel* cs:1` semantics in the two real LaTeX examples.

**Architecture:** Keep semantic data limits in `ranges` and final paint geometry in `geometry.transformRanges`. Change only the default middle-axis label path to consume the same transformed ranges already used by `axisLines.js`; preserve explicit label-description coordinates, non-middle axes, datavisualization label placement, arrow tips, ticks, fonts, and plot sampling.

**Tech Stack:** ESM JavaScript, Node test runner, TikZKit SceneGraph/SVG pipeline, local TeX Live 2025 PGFPlots 1.18.2, local `tikztosvg`, `rsvg-convert`, PNG visual diff tooling.

## Global Constraints

- MacTeX is authoritative. TeX Live 2025 PGFPlots middle-axis styles place labels at `ticklabel* cs:1`, using final transformed/enlarged axis limits and `near ticklabel align=inside`.
- This slice changes only default middle-axis terminal label placement. Do not change arrow geometry, line width, tick generation, tick-label metrics, painter order, plot sampling, plot framing, or text glyph rendering.
- `xlabel style={at=...}` and `ylabel style={at=...}` remain authoritative and must override the default endpoint.
- Non-middle/boxed axes and `datavis axis label placement=end|upright` retain their existing raw-range placement.
- Do not add fixture IDs, source paths, node names, or fitted per-example coordinates to production code.
- Display comparison grids are not semantic input and must not affect generated SVG geometry.
- The shared worktree is dirty. Take before snapshots, produce focused `git diff --no-index` evidence, and do not stage or commit dirty implementation/capability files.
- Generated QA artifacts stay under `outputs/qa-pgfplots-middle-axis-labels/` and are not committed.

---

### Task 1: Bind default middle-axis labels to transformed endpoints

**Files:**
- Modify: `src/pgfplots/labels.js`
- Modify: `test/pgfplots-seams.test.js`

**Interfaces:**
- Consumes: `createAxisGeometry(axisOptions, ranges)` and its `geometry.transformRanges` plus `geometry.mapPoint(point)` interface.
- Produces: unchanged `renderAxisLabels(axisOptions, ranges, geometry) -> string[]`, with corrected default middle-axis label coordinates.

- [ ] **Step 1: Capture dirty-worktree before snapshots**

```bash
cp src/pgfplots/labels.js /private/tmp/tikzkit-middle-axis-labels-before.js
cp test/pgfplots-seams.test.js /private/tmp/tikzkit-middle-axis-labels-seams-before.test.js
shasum -a 256 /private/tmp/tikzkit-middle-axis-labels-before.js /private/tmp/tikzkit-middle-axis-labels-seams-before.test.js
```

- [ ] **Step 2: Write failing transformed-endpoint tests**

Add a test named `pgfplots enlarged middle-axis labels use final transformed axis endpoints` using the explicit-range parted-function options:

```js
const axisOptions = {
  "axis x line": "middle",
  "axis y line": "middle",
  xmin: "-1",
  xmax: "6",
  ymin: "-0.25",
  ymax: "2.25",
  xlabel: "$x$",
  ylabel: "$y$",
  enlargelimits: "true"
};
const ranges = { xMin: -1, xMax: 6, yMin: -0.25, yMax: 2.25 };
const geometry = createAxisGeometry(axisOptions, ranges);
const commands = renderAxisLabels(axisOptions, ranges, geometry);

assert.deepEqual(geometry.transformRanges, {
  xMin: -1.7,
  xMax: 6.7,
  yMin: -0.5,
  yMax: 2.5,
  zMin: 0,
  zMax: 1
});
assert.ok(commands.includes(String.raw`\node[axis label, anchor=south east] at (6.933,0.949) {$x$};`));
assert.ok(commands.includes(String.raw`\node[axis label, anchor=north west] at (1.387,5.785) {$y$};`));
```

Add the auto-Y x-square variant and require its final x endpoint while preserving its already-final y endpoint:

```js
const axisOptions = {
  "axis x line": "middle",
  "axis y line": "middle",
  xmin: "-1.5",
  xmax: "1.5",
  xlabel: "$x$",
  ylabel: "$y$",
  enlargelimits: "true"
};
const ranges = { xMin: -1.5, xMax: 1.5, yMin: 0, yMax: 2.475 };
const geometry = createAxisGeometry(axisOptions, ranges);
const commands = renderAxisLabels(axisOptions, ranges, geometry);

assert.ok(commands.includes(String.raw`\node[axis label, anchor=south east] at (6.933,0.474) {$x$};`));
assert.ok(commands.includes(String.raw`\node[axis label, anchor=north west] at (3.427,5.785) {$y$};`));
```

Add regression assertions in the same test area:

```js
const styled = renderAxisLabels(
  { ...axisOptions, "xlabel style": "at={(0.25,0.75)},anchor=west" },
  ranges,
  geometry
);
assert.ok(styled.includes(String.raw`\node[axis label, anchor=west] at (1.713,4.27) {$x$};`));

const withoutTransformRanges = renderAxisLabels(
  { "axis x line": "middle", "axis y line": "middle", xlabel: "$x$", ylabel: "$y$" },
  { xMin: 0, xMax: 2, yMin: 0, yMax: 1 },
  { ...createAxisGeometry({ "scale only axis": true, width: "2cm", height: "1cm" }, { xMin: 0, xMax: 2, yMin: 0, yMax: 1 }), transformRanges: undefined }
);
assert.ok(withoutTransformRanges.some((command) => command.includes("{$x$};")));
assert.ok(withoutTransformRanges.some((command) => command.includes("{$y$};")));
```

- [ ] **Step 3: Verify RED**

```bash
node --test --test-name-pattern="enlarged middle-axis labels use final transformed axis endpoints" test/pgfplots-seams.test.js
```

Expected: fail because the current default middle-axis path maps `ranges.xMax` and `ranges.yMax` rather than `geometry.transformRanges.xMax` and `geometry.transformRanges.yMax`.

- [ ] **Step 4: Implement the shared endpoint selection**

In `renderAxisLabels`, leave the datavisualization `end` branch unchanged. After that early-return branch, derive the middle-axis span once:

```js
const labelRanges = middleAxis && geometry.transformRanges ? geometry.transformRanges : ranges;
const yAxis = labelRanges.yMin <= 0 && labelRanges.yMax >= 0 ? 0 : labelRanges.yMin;
const xAxis = labelRanges.xMin <= 0 && labelRanges.xMax >= 0 ? 0 : labelRanges.xMin;
```

Use `labelRanges.xMax` and `labelRanges.yMax` only in the two default middle-axis point expressions:

```js
const point = middleAxis
  ? offsetPoint(geometry.mapPoint({ x: labelRanges.xMax, y: yAxis }), Math.min(0.08, xOffset * 0.25), 0)
  : offsetPoint(geometry.mapPoint({ x: (ranges.xMin + ranges.xMax) / 2, y: ranges.yMin }), 0, -xLabelOffset);

const point = middleAxis
  ? offsetPoint(geometry.mapPoint({ x: xAxis, y: labelRanges.yMax }), 0, middleYLabelTipOffset(ylabelStyle))
  : offsetPoint(geometry.mapPoint({ x: ranges.xMin, y: (ranges.yMin + ranges.yMax) / 2 }), -ylabelXOffset, 0);
```

Do not change `applyAxisLabelStyle`: its `at=...` override must continue to replace the computed default point.

- [ ] **Step 5: Verify focused and regression suites**

```bash
node --test --test-name-pattern="middle.*label|axis label style at|label lowering|datavisualization.*label" test/pgfplots-seams.test.js test/extensions.test.js
node --test test/example-fixtures.test.js test/example-render-script.test.js
```

Expected: all selected tests pass. If the full PGFPlots seams suite is run, require exactly the captured three pre-existing failures and no new failures.

- [ ] **Step 6: Generate and inspect the real visual gates**

```bash
npm run examples:render -- --fixtures test/fixtures/examples --output outputs/qa-pgfplots-middle-axis-labels --only latex-examples-2d-parted-function --only latex-examples-2d-x-square-with-circle --strict-tikztosvg --no-comparison-grid --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-pgfplots-middle-axis-labels
```

Actually inspect both TikZKit/tikztosvg/diff sheets. Acceptance requires:

- both default `x` labels visually sit at the final right-hand axis tip, and the parted-function `y` label visually sits at the final upper axis tip;
- terminal label displacement relative to the reference is reduced by at least 90% from the captured approximately `15.33pt` x-label and `14.54pt` y-label errors;
- `latex-examples-2d-parted-function` changed ratio does not exceed `1.606125%` and RGBA MAE does not exceed `0.002470044`;
- `latex-examples-2d-x-square-with-circle` changed ratio does not exceed `2.938944%` and RGBA MAE does not exceed `0.004833529`;
- document dimensions remain within `0.03pt` width and `0.03pt` height of the reference;
- both cases render with zero diagnostics and no missing plots, ticks, labels, axes, or layers;
- visible improvement is confirmed from the sheets, not inferred only from diff statistics.

- [ ] **Step 7: Produce focused review evidence**

```bash
shasum -a 256 src/pgfplots/labels.js test/pgfplots-seams.test.js
git diff --no-index -- /private/tmp/tikzkit-middle-axis-labels-before.js src/pgfplots/labels.js > /private/tmp/tikzkit-middle-axis-labels.diff
git diff --no-index -- /private/tmp/tikzkit-middle-axis-labels-seams-before.test.js test/pgfplots-seams.test.js > /private/tmp/tikzkit-middle-axis-labels-seams.diff
```

Write test counts, artifact paths, command-level label coordinates, SVG glyph measurements, and actual sheet observations to `.superpowers/sdd/pgfplots-middle-axis-labels-task-1-report.md`.

---

### Task 2: Record the verified terminal-label capability

**Files:**
- Modify: `src/capabilities/matrix.js`
- Modify: `test/capabilities.test.js`

**Interfaces:**
- Consumes: Task 1's two real fixtures and `outputs/qa-pgfplots-middle-axis-labels` evidence.
- Produces: an updated existing `pgfplots_axis` capability record; no new feature ID.

- [ ] **Step 1: Write a failing capability assertion**

Add a test named `capability matrix records middle-axis terminal-label visual gates` that requires:

```js
const feature = capabilityMatrix.pgfplots_axis;
assert.equal(feature.parser, "partial");
assert.equal(feature.semantic, "partial");
assert.equal(feature.svg, "partial");
assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/2d-parted-function.tex"));
assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex"));
assert.ok(feature.verification.artifacts.includes("outputs/qa-pgfplots-middle-axis-labels"));
assert.match(feature.notes, /middle-axis terminal labels/i);
assert.match(feature.notes, /ticklabel\* cs:1/i);
assert.match(feature.notes, /transformed.*limits/i);
assert.match(feature.notes, /remaining/i);
assert.match(feature.notes, /arrow/i);
assert.match(feature.notes, /ticks/i);
assert.match(feature.notes, /paint order/i);
```

Also assert fixture and artifact arrays contain no duplicates.

- [ ] **Step 2: Verify RED**

```bash
node --test --test-name-pattern="middle-axis terminal-label visual gates" test/capabilities.test.js
```

Expected: fail because the existing `pgfplots_axis` row records the framing gates but not the terminal-label artifact or verified transformed-limit semantics.

- [ ] **Step 3: Update only the existing `pgfplots_axis` row**

Keep parser/semantic/SVG status `partial`. Add `outputs/qa-pgfplots-middle-axis-labels` without duplicating fixtures. Record the verified `ticklabel* cs:1` transformed-endpoint behavior and retain the remaining gaps: classic stealth geometry, axis line width, origin/padded minor tick behavior, tick-label metrics, layer ordering, transitional auto-Y bottom reserve, and broader PGFPlots input handlers.

- [ ] **Step 4: Run capability and combined regression suites**

```bash
node --test test/capabilities.test.js test/pgfplots-seams.test.js test/example-fixtures.test.js test/example-render-script.test.js
```

Expected: no new failures relative to the captured PGFPlots baseline; capability, fixture, and render-script tests pass.

- [ ] **Step 5: Preserve the dirty-worktree boundary**

Record before/after SHA-256 hashes and focused diffs for `src/capabilities/matrix.js` and `test/capabilities.test.js`. Do not stage or commit these dirty files. Write `.superpowers/sdd/pgfplots-middle-axis-labels-task-2-report.md`; update `.superpowers/sdd/progress.md` only after independent task and whole-slice review.

## Plan Self-Review

- Scope is one shared semantic defect: default middle-axis terminal labels use raw limits while the axis line uses transformed limits.
- The plan preserves explicit description coordinates, non-middle axes, datavisualization placement, framing, arrows, ticks, fonts, painter order, and sampling.
- Exact owner files, RED/GREEN commands, real artifacts, visual gates, fallback behavior, and dirty-worktree evidence are specified.
- No placeholder, fixture branch, fitted production coordinate, duplicate capability row, or full-PGFPlots compatibility claim is permitted.
