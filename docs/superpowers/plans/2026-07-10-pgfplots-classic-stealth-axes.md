# PGFPlots Classic Stealth Axes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match TeX Live 2025 non-boxed PGFPlots axes by using native `0.4pt` thin strokes and correctly line-width-scaled classic `stealth` arrow tips.

**Architecture:** First correct the shared classic-stealth metric function from the PGF formula `d=0.28pt+0.3*lineWidth`, retaining the measured XeTeX/dvisvgm scale. Then change only arrowed non-boxed PGFPlots axes (`left`, `middle`, `center`) from `0.35pt,->` to `0.4pt,-stealth`. Keep explicit widths, boxed frames, datavisualization clean axes, and all unrelated arrow kinds unchanged.

**Tech Stack:** ESM JavaScript, Node test runner, TikZKit SceneGraph/SVG pipeline, local TeX Live 2025 PGF/PGFPlots, local `tikztosvg`, `rsvg-convert`, PNG visual diff tooling.

## Global Constraints

- MacTeX is authoritative. `pgfplots.code.tex` configures every non-boxed x/y axis with `-stealth`; `tikz.code.tex` defines `thin` as `0.4pt`.
- Classic PGF `stealth` uses `d=0.28pt+0.3*lineWidth`, total back length `8d`, half height `4d`, and inset/shortening `5d`.
- Preserve the measured XeTeX/dvisvgm scale by calibrating the source formula to the existing thick reference length `4.144532pt` at `0.8pt`; do not preserve the current incorrect line-width slope.
- This slice changes classic `stealth` metrics and arrowed non-boxed PGFPlots axis defaults only. Do not change `to`, `latex`, arrows.meta tips, explicit custom tip dimensions, boxed frames, labels, ticks, grid, framing, painter order, or plot sampling.
- `axis line width=<dimension>` and `very thick` continue to override the PGFPlots default width.
- Do not add fixture IDs, source paths, node names, or fitted per-example coordinates to production code.
- The shared worktree is dirty. Take before snapshots, produce focused `git diff --no-index` evidence, and do not stage or commit dirty implementation/capability files.
- Generated QA artifacts stay under `outputs/qa-pgfplots-classic-stealth-axes/` and are not committed.

---

### Task 1: Correct classic stealth line-width scaling

**Files:**
- Modify: `src/tikz/metrics.js`
- Modify: `test/svg-renderer.test.js`

**Interfaces:**
- Consumes: `lineWidthFromPt(pt)`.
- Produces: unchanged `stealthArrowLengthFromLineWidth(lineWidth)`, `stealthArrowHalfWidthFromLength(length)`, and `stealthArrowShortenFromLength(length)` interfaces.

- [ ] **Step 1: Capture before snapshots**

```bash
cp src/tikz/metrics.js /private/tmp/tikzkit-classic-stealth-metrics-before.js
cp test/svg-renderer.test.js /private/tmp/tikzkit-classic-stealth-svg-renderer-before.test.js
```

- [ ] **Step 2: Write a failing thin-stealth metric test**

Add a renderer test named `calibrates thin classic stealth geometry against TeX Live 2025`:

```js
const result = tikzToSvg(String.raw`\begin{tikzpicture}
  \draw[thin, -stealth] (0,0) -- (2,0);
\end{tikzpicture}`, { margin: 0, mathRenderer: "svg-text" });
const tipPath = result.svg.match(/class="tikz-arrow-tip tikz-arrow-stealth" d="([^"]+)"/)?.[1] || "";
const values = [...tipPath.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));

assert.ok(Math.abs(values[2] + lineWidthFromPt(3.191406)) < 0.02);
assert.ok(Math.abs(values[3] + lineWidthFromPt(1.59375)) < 0.02);
assert.ok(Math.abs(values[4] + lineWidthFromPt(1.996094)) < 0.02);
```

Keep the existing thick-stealth test as a regression gate.

- [ ] **Step 3: Verify RED**

```bash
node --test --test-name-pattern="thin classic stealth geometry|thick stealth arrow tip geometry" test/svg-renderer.test.js
```

Expected: thin test fails because the current single-point formula produces about `3.626pt` rather than `3.191pt`; thick test passes.

- [ ] **Step 4: Implement the PGF source formula with backend calibration**

Replace the current `(3+1.25*lineWidth)` fit with:

```js
const PGF_CLASSIC_STEALTH_BASE_PT = 0.28;
const PGF_CLASSIC_STEALTH_LINE_WIDTH_FACTOR = 0.3;
const PGF_CLASSIC_STEALTH_BACK_FACTOR = 8;
const TIKZTOSVG_STEALTH_THICK_LENGTH_PT = 4.144532;
const TIKZTOSVG_STEALTH_SOURCE_THICK_LENGTH_PT =
  PGF_CLASSIC_STEALTH_BACK_FACTOR * (PGF_CLASSIC_STEALTH_BASE_PT + PGF_CLASSIC_STEALTH_LINE_WIDTH_FACTOR * 0.8);
const TIKZTOSVG_STEALTH_LENGTH_SCALE =
  TIKZTOSVG_STEALTH_THICK_LENGTH_PT / TIKZTOSVG_STEALTH_SOURCE_THICK_LENGTH_PT;

export function stealthArrowLengthFromLineWidth(lineWidth) {
  const lineWidthPt = Math.max(0.01, lineWidth ?? TIKZ_LINE_WIDTHS.default) / lineWidthFromPt(1);
  const pgfUnit = PGF_CLASSIC_STEALTH_BASE_PT + PGF_CLASSIC_STEALTH_LINE_WIDTH_FACTOR * lineWidthPt;
  return lineWidthFromPt(PGF_CLASSIC_STEALTH_BACK_FACTOR * pgfUnit * TIKZTOSVG_STEALTH_LENGTH_SCALE);
}
```

Keep the current measured half-width ratio and `0.625` shortening ratio; the thin and thick native references verify both.

- [ ] **Step 5: Verify focused and shared arrow regressions**

```bash
node --test --test-name-pattern="classic stealth|stealth arrow|arrow tip geometry" test/svg-renderer.test.js test/renderer.test.js test/architecture-seams.test.js
```

Expected: all selected tests pass; custom tip dimensions and non-stealth kinds remain unchanged.

- [ ] **Step 6: Record native reference evidence**

Generate minimal `thin,-stealth` and `thick,-stealth` SVGs with local `tikztosvg --xelatex`; record their path coordinates, source files, exact commands, and measured dimensions in `.superpowers/sdd/pgfplots-classic-stealth-axes-task-1-report.md`.

- [ ] **Step 7: Refresh focused hashes and diffs**

```bash
shasum -a 256 src/tikz/metrics.js test/svg-renderer.test.js
git diff --no-index -- /private/tmp/tikzkit-classic-stealth-metrics-before.js src/tikz/metrics.js > /private/tmp/tikzkit-classic-stealth-metrics.diff
git diff --no-index -- /private/tmp/tikzkit-classic-stealth-svg-renderer-before.test.js test/svg-renderer.test.js > /private/tmp/tikzkit-classic-stealth-svg-renderer.diff
```

---

### Task 2: Use thin classic stealth on non-boxed PGFPlots axes

**Files:**
- Modify: `src/pgfplots/axisLines.js`
- Modify: `test/pgfplots-seams.test.js`
- Modify: `test/extensions.test.js`

**Interfaces:**
- Consumes: Task 1's corrected shared `stealth` tip metrics through existing TikZ option parsing.
- Produces: unchanged `renderAxisLines(axisOptions, ranges, geometry) -> string[]` interface.

- [ ] **Step 1: Capture before snapshots**

```bash
cp src/pgfplots/axisLines.js /private/tmp/tikzkit-pgfplots-stealth-axis-lines-before.js
cp test/pgfplots-seams.test.js /private/tmp/tikzkit-pgfplots-stealth-seams-before.test.js
cp test/extensions.test.js /private/tmp/tikzkit-pgfplots-stealth-extensions-before.test.js
```

- [ ] **Step 2: Write failing lowering and IR tests**

Update the direct lowering gate to require:

```js
assert.deepEqual(renderAxisLines({ "axis lines": "middle" }, ranges, geometry), [
  String.raw`\draw[axis line, black, line width=0.4pt, -stealth] (0,1) -- (2,1);`,
  String.raw`\draw[axis line, black, line width=0.4pt, -stealth] (1,0) -- (1,2);`
]);
```

In `test/extensions.test.js`, update both middle and left axis tests to require every axis path's `markerEnd.kind === "stealth"`. Import `lineWidthFromPt` from `src/tikz-metrics.js` and require each default axis path's `lineWidth` to equal `lineWidthFromPt(0.4)` within `1e-9`.

Add explicit override assertions:

```js
const explicit = tikzToSvg(String.raw`\begin{tikzpicture}
\begin{axis}[axis lines=middle,axis line width=1pt,xmin=0,xmax=1,ymin=0,ymax=1]
\addplot coordinates {(0,0) (1,1)};
\end{axis}\end{tikzpicture}`);
const explicitAxes = explicit.ir.items.filter((item) => item.subtype === "axis-line");
assert.equal(explicitAxes.every((item) => Math.abs(item.style.lineWidth - lineWidthFromPt(1)) < 1e-9), true);
assert.equal(explicitAxes.every((item) => item.style.markerEnd?.kind === "stealth"), true);
```

Keep the boxed-frame `0.35pt` assertion unchanged.

- [ ] **Step 3: Verify RED**

```bash
node --test --test-name-pattern="axis line lowering|arrowed middle axis|arrowed left axis" test/pgfplots-seams.test.js test/extensions.test.js
```

Expected: fail because current axis lines emit `0.35pt,->` and IR `kind=to`.

- [ ] **Step 4: Implement the native non-boxed style**

In `renderAxisLines`, compute `const arrowed = shouldArrowAxisLines(axisOptions)`. Preserve explicit width and `very thick`, but use `line width=0.4pt` as the default only when `arrowed` is true; retain `0.35pt` for existing non-arrowed paths. Emit `-stealth` instead of `->` when `arrowed` is true.

- [ ] **Step 5: Verify focused and regression suites**

```bash
node --test --test-name-pattern="axis line lowering|arrowed middle axis|arrowed left axis|middle axes" test/pgfplots-seams.test.js test/extensions.test.js
node --test test/example-fixtures.test.js test/example-render-script.test.js
```

Expected: selected tests and fixture/render tests pass. The full combined suite must have no new failures beyond the captured three PGFPlots bbox failures and the two unrelated datavisualization failures when `extensions.test.js` is included.

- [ ] **Step 6: Generate and inspect two real visual gates**

```bash
npm run examples:render -- --fixtures test/fixtures/examples --output outputs/qa-pgfplots-classic-stealth-axes --only latex-examples-2d-parted-function --only latex-examples-2d-x-square-with-circle --strict-tikztosvg --no-comparison-grid --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-pgfplots-classic-stealth-axes
```

Acceptance requires:

- both x/y axis tips are filled classic stealth shapes and visually match the reference orientation and attachment;
- generated non-boxed axis strokes resolve from `0.4pt`, matching reference `stroke-width=0.3985pt` within backend rounding;
- thin stealth length, half height, and inset are each within `0.02pt` of `3.191406pt`, `1.59375pt`, and `1.996094pt`;
- parted changed ratio does not exceed `1.5509259%`, MAE does not exceed `0.0023064`;
- x-square changed ratio does not exceed `2.9130735%`, MAE does not exceed `0.0047511`;
- document dimensions stay within `0.03pt` of reference; both cases have zero diagnostics and no missing content;
- the final sheets are actually inspected and show visible arrow/stroke improvement.

- [ ] **Step 7: Refresh evidence**

```bash
shasum -a 256 src/pgfplots/axisLines.js test/pgfplots-seams.test.js test/extensions.test.js
git diff --no-index -- /private/tmp/tikzkit-pgfplots-stealth-axis-lines-before.js src/pgfplots/axisLines.js > /private/tmp/tikzkit-pgfplots-stealth-axis-lines.diff
git diff --no-index -- /private/tmp/tikzkit-pgfplots-stealth-seams-before.test.js test/pgfplots-seams.test.js > /private/tmp/tikzkit-pgfplots-stealth-seams.diff
git diff --no-index -- /private/tmp/tikzkit-pgfplots-stealth-extensions-before.test.js test/extensions.test.js > /private/tmp/tikzkit-pgfplots-stealth-extensions.diff
```

Write exact commands, test counts, artifact paths, native/TikZKit arrow measurements, diff metrics, document dimensions, and actual sheet observations to `.superpowers/sdd/pgfplots-classic-stealth-axes-task-2-report.md`.

---

### Task 3: Record verified classic-stealth axis support

**Files:**
- Modify: `src/capabilities/matrix.js`
- Modify: `test/capabilities.test.js`

**Interfaces:**
- Consumes: Tasks 1-2 tests and `outputs/qa-pgfplots-classic-stealth-axes`.
- Produces: updated existing `arrow_tips` and `pgfplots_axis` capability rows; no new feature IDs.

- [ ] **Step 1: Add failing capability assertions**

Capture before snapshots:

```bash
cp src/capabilities/matrix.js /private/tmp/tikzkit-classic-stealth-capability-before.js
cp test/capabilities.test.js /private/tmp/tikzkit-classic-stealth-capabilities-before.test.js
```

Add a test named `capability matrix records classic stealth scaling and PGFPlots axis gates`:

```js
const arrows = capabilityMatrix.arrow_tips;
assert.equal(arrows.parser, "stable");
assert.equal(arrows.semantic, "partial");
assert.equal(arrows.svg, "partial");
assert.ok(arrows.fixtures.includes("test/fixtures/basic/arrow-tips.tikz"));
assert.match(arrows.notes, /classic stealth/i);
assert.match(arrows.notes, /0\.28pt/i);
assert.match(arrows.notes, /0\.3.*line width/i);
assert.match(arrows.notes, /thin.*thick/i);

const axes = capabilityMatrix.pgfplots_axis;
assert.equal(axes.parser, "partial");
assert.equal(axes.semantic, "partial");
assert.equal(axes.svg, "partial");
assert.ok(axes.verification.artifacts.includes("outputs/qa-pgfplots-classic-stealth-axes"));
assert.match(axes.notes, /0\.4pt.*stealth/i);
assert.doesNotMatch(axes.notes.match(/Remaining gaps are ([^.]+)/i)?.[1] || "", /classic stealth|axis line width/i);
assert.match(axes.notes.match(/Remaining gaps are ([^.]+)/i)?.[1] || "", /other label placements/i);

assert.equal(new Set(arrows.fixtures).size, arrows.fixtures.length);
assert.equal(new Set(axes.fixtures).size, axes.fixtures.length);
assert.equal(new Set(axes.verification.artifacts).size, axes.verification.artifacts.length);
```

Run:

```bash
node --test --test-name-pattern="classic stealth scaling and PGFPlots axis gates" test/capabilities.test.js
```

Expected: fail because the rows do not record the source formula, thin/thick gates, new artifact, or verified non-boxed axis style.

- [ ] **Step 2: Update only the existing rows**

Remove `classic stealth arrow geometry` and `axis line width` from `pgfplots_axis` Remaining gaps. Preserve `other label placements`, non-enlarged margins, ticks, tick-label metrics, layer/paint ordering, auto-Y reserve, and broader input handlers. Do not claim all arrow kinds or PGFPlots are stable.

- [ ] **Step 3: Verify capability and combined suites**

```bash
node --test test/capabilities.test.js test/svg-renderer.test.js test/pgfplots-seams.test.js test/example-fixtures.test.js test/example-render-script.test.js
```

Expected: no new failures relative to captured baselines.

- [ ] **Step 4: Preserve dirty-worktree evidence**

```bash
shasum -a 256 src/capabilities/matrix.js test/capabilities.test.js
git diff --no-index -- /private/tmp/tikzkit-classic-stealth-capability-before.js src/capabilities/matrix.js > /private/tmp/tikzkit-classic-stealth-capability.diff
git diff --no-index -- /private/tmp/tikzkit-classic-stealth-capabilities-before.test.js test/capabilities.test.js > /private/tmp/tikzkit-classic-stealth-capabilities.diff
```

Write `.superpowers/sdd/pgfplots-classic-stealth-axes-task-3-report.md` with exact hashes, test counts, source references, artifact paths, and remaining gaps. Do not stage or commit dirty capability files.

## Plan Self-Review

- Shared classic-stealth scaling and PGFPlots axis defaults are separate reviewable tasks connected by the existing arrow interface.
- The source formula, backend reference values, owners, tests, real visual gates, and explicit non-goals are exact.
- Explicit widths, boxed axes, datavisualization, other arrow kinds, labels, ticks, framing, and plot content remain outside the behavior change.
- No placeholder, fixture branch, duplicate capability row, or full-compatibility claim is permitted.
