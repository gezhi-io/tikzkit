# PGFPlots 2D Tick Metrics And Alignment Plan

> **Execution mode:** Subagent-Driven Development. Each implementation task gets a fresh worker, an independent review, and a final whole-slice review. Because the production worktree already contains broad user work, implementation evidence is recorded with focused diffs and SHA-256 snapshots rather than a broad implementation commit.

## Goal

Make non-boxed middle-axis PGFPlots ticks and tick labels follow the local TeX Live implementation instead of compensating with TikZKit-only constants. The real visual gates are:

- `latex-examples-2d-parted-function` (`tick align=outside`);
- `latex-examples-2d-x-square-with-circle` (`tick align=outside`);
- `axis-middle-lines` (implicit non-boxed `tick align=center`).

The slice is complete only when all three regenerated TikZKit/reference sheets have been inspected and the labels are visibly closer in font footprint and outer-normal placement without losing ticks, grid lines, curves, arrows, or axis labels.

## Native Semantics

Read and cite these local sources during implementation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex:1038-1042`: default `every tick label` styles do not reduce the font, so labels inherit the document's normal 10pt font.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex:1615-1619`: the default major tick length is `0.15cm`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex:1793-1824`: `inside`, `outside`, and `center` map to alignment numbers 0, 1, and 2.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex:2668-2692`: non-boxed axes default to centered ticks.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex:723-769`: the tick line begins at `-offset` and ends at `-offset + tick width`, where the offset is 0, one tick width, or half a tick width for inside, outside, or center.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex:1598-1684`: tick labels use the same offset along the outer normal and the `near ticklabel` anchor.

TikZKit's existing node engine already supplies the ordinary TikZ `.3333em` inner separation when `inner sep` is omitted. Do not duplicate that value in PGFPlots lowering.

## Scope

Implement only non-boxed middle-axis `renderAxisTicks` behavior:

- default middle-axis tick-label font inheritance (`\normalsize` in the lowered node command);
- explicit `axis tick label font` precedence;
- `tick align`, `xtick align`, and `ytick align` for middle-axis major/minor tick segments;
- native label-point offset factors: inside `0`, center `0.5`, outside `1` tick length;
- default non-boxed middle-axis alignment `center`;
- existing explicit non-negative `x/y axis tick label distance` precedence, including `0pt`;
- ordinary TikZ default inner separation unless an explicit `axis tick label inner sep` is provided.

Preserve these boundaries:

- datavisualization visual tick configs and their explicit font/inner-sep overrides;
- 3D/colorbar tick rendering;
- boxed-axis tick geometry and its currently calibrated compact tick-label metrics in this slice; native boxed normal-font metrics remain a separate tracked gap;
- explicit tick-label lists, origin suppression, terminal suppression, minor-tick generation, grid generation, tick colors, and line widths;
- axis labels, arrow tips, plot geometry, and plot sampling.

## Task 1: Red Tests And Shared Implementation

**Write set:**

- `src/pgfplots/ticks.js`
- `test/pgfplots-seams.test.js`

### Tests

Add focused lowering tests that prove:

1. `tick align=outside` places the lower-side tick from `-tickLength` to the axis and places the label point one tick length along the outer normal.
2. implicit non-boxed middle axes use centered ticks (`-0.5*tickLength` to `+0.5*tickLength`) and a half-tick label offset.
3. `tick align=inside` places the tick from the axis inward and keeps the label point at the axis before normal TikZ inner separation.
4. `xtick align` and `ytick align` override the common `tick align` independently.
5. default middle-axis labels lower as `font=\normalsize` without `inner sep=0pt`; explicit `axis tick label font` and `axis tick label inner sep` still win, while boxed-axis defaults remain unchanged.
6. existing origin suppression, tick values, and label text are unchanged.
7. explicit `x/y axis tick label distance=0pt` is preserved rather than replaced by an alignment-derived distance.

Run the new focused test first and confirm it fails for the old `1.55`, `\scriptsize`, and forced-zero-inner-sep behavior.

### Implementation

Introduce small private helpers in `ticks.js` for normalized per-axis alignment and its offset factor. Use those helpers for middle-axis major and minor segment endpoints and for default label distance. Keep the visualized-tick branch and boxed-axis branch untouched, including the existing compact boxed tick-label default until its bbox can be calibrated independently. Accept finite explicit distances greater than or equal to zero. Reorder local declarations as needed so the middle-axis state is available when selecting the default font.

### Verification

Run:

```sh
node --test --test-name-pattern='tick align|tick label' test/pgfplots-seams.test.js
node --test test/pgfplots-seams.test.js test/extensions.test.js
```

The second command may retain only already-recorded baseline failures; no new failure is accepted.

## Task 2: Three-Case Visual Gate

**Artifact directory:** `outputs/qa-pgfplots-tick-label-metrics-alignment`

Generate fresh TikZKit and local `tikztosvg` artifacts:

```sh
npm run examples:render -- --fixtures test/fixtures/examples --output outputs/qa-pgfplots-tick-label-metrics-alignment --only latex-examples-2d-parted-function --only latex-examples-2d-x-square-with-circle --only axis-middle-lines --strict-tikztosvg --no-comparison-grid --external-timeout-ms 120000
```

Inspect each TikZKit PNG, reference PNG, and diff sheet. Record, case by case:

- digit height/width relative to the reference;
- the gap from tick endpoint to glyph bounds;
- x/y tick segment direction and centering;
- any bbox movement;
- missing or shifted non-tick content;
- diagnostics.

Acceptance:

- all three cases have zero diagnostics;
- outside ticks in the two real examples point outward and labels sit outside them;
- the implicit middle-axis fixture has visibly centered ticks;
- default tick digits have the reference's normal-font footprint;
- no content is missing and no label overlaps an axis or curve;
- the two existing real-case diff metrics do not regress from the classic-stealth baselines (`0.883190883% / 0.0018902575` and `2.12142118% / 0.0042998938`); the middle-lines fixture must show a visible placement/size improvement even if antialiasing prevents a near-zero diff.

If a metric regresses despite visible improvement, do not hide it: inspect the panel, document the specific antialiasing/bbox cause, and require independent review before acceptance.

## Task 3: Capability Record And Final Review

**Write set:**

- `src/capabilities/matrix.js`
- `test/capabilities.test.js`
- `.superpowers/sdd/progress.md`

Update the existing PGFPlots axis capability row rather than adding a duplicate. Record the native source files, the three fixtures, the QA artifact directory, implemented middle-axis alignment/font/inner-sep semantics, and the remaining boxed-font metric, tick-label style/rotation, and 3D cases. Keep the capability partial.

Run:

```sh
node --test test/capabilities.test.js test/pgfplots-seams.test.js test/example-fixtures.test.js test/example-render-script.test.js
```

Then ask a fresh reviewer to inspect the focused diff, tests, three visual panels, diagnostics, capability boundary, and recorded file hashes. The slice is not complete until the reviewer reports no Critical or Important finding.
