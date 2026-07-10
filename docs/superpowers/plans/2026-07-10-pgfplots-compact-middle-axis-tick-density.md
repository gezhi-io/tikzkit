# PGFPlots Compact Middle-Axis Tick Density Plan

> **Execution mode:** Subagent-Driven Development with a fresh implementer, independent task review, real TikZKit/tikztosvg visual gate, capability update, and final whole-slice review. Production changes remain in the existing dirty worktree and are tracked by focused hashes.

## Goal

Fix automatic major tick density for compact, explicitly bounded, non-enlarged middle axes. The driving fixture is `axis-middle-lines`: TikZKit currently emits x half steps while TeX Live emits integer ticks. Preserve the legitimate half-step density of `latex-examples-2d-x-square-with-circle` and the 2/4/6 density of `latex-examples-2d-parted-function`.

## Native Source Findings

Read and cite:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex:1621-1630`: `max space between ticks=35pt` and `try min ticks=4`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex:1937-1950`: effective range divided by desired intervals.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex:2397-2425`: desired tick count from physical axis length.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex:2485-2513`: 1/2/5 distance normalization.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex:6268-6340`: explicit-bound `auto` enlargement versus forced 10% enlargement.

The broad 35pt algorithm remains future work. This slice only corrects TikZKit's existing compact-x override: it must activate when the x transform range is actually enlarged, not for every middle axis with span at most four.

## Scope And Boundary

Implement:

- a private tolerance-aware predicate comparing raw x range with `geometry.transformRanges`;
- compact middle-axis x count floor 7 only when that transformed x range is actually enlarged;
- automatic ticks and grids sharing the corrected count;
- axis-specific enlargement: y-only enlargement must not activate the x override.

Preserve:

- all explicit tick lists and tick distances;
- y-axis sparse/fractional rules;
- x-square enlarged half-step ticks;
- parted-function wide-range ticks;
- tick-label font/alignment, origin suppression, terminal filtering, minor tick generation, grid style, plot geometry, and bbox logic;
- full PGFPlots 35pt/floor-based density parity as a remaining broader gap.

## Task 1: Red Tests And Shared Fix

**Write set:**

- `src/pgfplots/ticks.js`
- `test/pgfplots-seams.test.js`

Add red tests for:

1. `axis-middle-lines` exact x/y labels `[-2,-1,1,2]` with no half steps.
2. Synthetic `[-2,2]` compact middle geometry with unchanged transform returns x count 5; the same raw range with an enlarged x transform returns at least 7.
3. `enlarge y limits=true` without x enlargement does not activate the x override.
4. Major grid values match the corrected automatic tick values.
5. Existing x-square half-step and parted-function 2/4/6 + 1/2 expectations remain unchanged.

Implement the smallest predicate and gate in `axisAutoMajorTickCountForOptions`. Do not rewrite `majorTickValues` or introduce fixture names.

Verification:

```sh
node --test --test-name-pattern='tick density|tick count|half-step|major grid|middle x auto ticks|middle y auto ticks' test/pgfplots-seams.test.js
node --test test/pgfplots-seams.test.js test/extensions.test.js
```

The second command may retain only the recorded nine baseline failures; no new failure or changed failure mode is accepted.

## Task 2: Three-Case Visual Gate

Generate fresh artifacts under `outputs/qa-pgfplots-compact-middle-axis-tick-density`:

```sh
npm run examples:render -- --fixtures test/fixtures/examples --output outputs/qa-pgfplots-compact-middle-axis-tick-density --only axis-middle-lines --only latex-examples-2d-parted-function --only latex-examples-2d-x-square-with-circle --strict-tikztosvg --no-comparison-grid --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-pgfplots-compact-middle-axis-tick-density
```

Actually inspect all three sheets and individual images. Acceptance:

- zero diagnostics;
- middle-lines has only integer x/y labels and matching integer major grids, with no missing axes, arrows, line, or labels;
- x-square retains half-step labels and all geometry;
- parted retains x 2/4/6 and y 1/2;
- the two preserved fixtures are visually/byte stable except unavoidable artifact metadata;
- middle-lines visibly improves from `2.52442002% / 0.0053913040`; target changed ratio is below `1.5%` and RGBA MAE below `0.0035`.

## Task 3: Capability And Final Review

**Write set:**

- `src/capabilities/matrix.js`
- `test/capabilities.test.js`
- `.superpowers/sdd/progress.md`

Update the existing `pgfplots_axis` row only. Record the new artifact and the narrow actual-transform enlargement rule. Keep the row partial and retain `broader automatic tick density` plus every other existing gap.

Run:

```sh
node --test test/capabilities.test.js test/pgfplots-seams.test.js test/example-fixtures.test.js test/example-render-script.test.js
```

The final whole-slice reviewer must verify the focused diff, source citations, exact density boundaries, preserved fixture sheets, diagnostics, capability truthfulness, and current hashes. No Critical or Important finding is accepted.
