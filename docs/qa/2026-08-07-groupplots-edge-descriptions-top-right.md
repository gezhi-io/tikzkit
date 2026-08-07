# Groupplots Top/Right Edge Descriptions QA

## Scope

Implement the focused `groupplots` slice in which `x descriptions at=edge top` and `y descriptions at=edge right` retain descriptions only at the selected outer axes and move the corresponding tick labels to the outer box edge. This does not claim complete `groupplots` support.

## Local MacTeX Reading

- Source reviewed: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.groupplots.code.tex`.
- Local manual reviewed: `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf`, section 5.8, especially the grouping-options examples and the `x/y descriptions at` explanation.
- `\pgfplots@group@environment@create` anchors a new column at the preceding axis `east` plus `horizontal sep`, or a new row at the above axis `south` minus `vertical sep`.
- `\pgfplots@group@determine@labels` removes labels from non-edge cells. For an upper x edge or right y edge it changes `xticklabel pos=upper` or `yticklabel pos=right` on the retained axis; it does not relocate `xlabel` or `ylabel`. The shared-gap label placement in the native rendering is therefore intentional.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used `/opt/homebrew/bin/rsvg-convert`.

- MacTeX PNG: `/private/tmp/tikzkit-qa-groupplots-edge-final-2026-08-07/mactex-png/pgfplots-groupplots-edge-descriptions-top-right.png`
- TikZKit SVG/PNG: `/private/tmp/tikzkit-qa-groupplots-edge-final-2026-08-07/tikzkit-svg/pgfplots-groupplots-edge-descriptions-top-right.svg` and `/private/tmp/tikzkit-qa-groupplots-edge-final-2026-08-07/tikzkit-png/pgfplots-groupplots-edge-descriptions-top-right.png`
- tikztosvg SVG/PNG: `/private/tmp/tikzkit-qa-groupplots-edge-final-2026-08-07/tikztosvg-svg/pgfplots-groupplots-edge-descriptions-top-right.svg` and `/private/tmp/tikzkit-qa-groupplots-edge-final-2026-08-07/tikztosvg-png/pgfplots-groupplots-edge-descriptions-top-right.png`
- Grid comparison and sheet: `/private/tmp/tikzkit-qa-groupplots-edge-final-2026-08-07/tikzkit-grid-png/pgfplots-groupplots-edge-descriptions-top-right.png`, `/private/tmp/tikzkit-qa-groupplots-edge-final-2026-08-07/tikztosvg-grid-png/pgfplots-groupplots-edge-descriptions-top-right.png`, and `/private/tmp/tikzkit-qa-groupplots-edge-final-2026-08-07/diff/pgfplots-groupplots-edge-descriptions-top-right-sheet.png`.

The tikztosvg SVG uses translated, y-flipped path groups: the first two axis frames begin at `(8.833,69.634)` and `(91.558,69.634)` with a `68.55pt` inner width. It renders grid, ticks, box frame, and curve as separate paths; text is emitted as glyph groups. That confirms the reference geometry is based on the measured axis anchors plus the `0.5cm` gap, not raw requested dimensions.

## Real Visual Change

Before this change, TikZKit kept all surviving tick labels on the default lower/left sides: top-row x ticks were below their frames and second-column y ticks were not on the right. The JS PNG was `231x196`, versus the native and tikztosvg `243x197`.

After the change, top-row x ticks are above their frames and right-column y ticks are right of their frames. The `xlabel` and `ylabel` remain in the same shared-gap positions as MacTeX. The new JS PNG is `249x206`; residual crop and glyph-raster differences remain, but the previously missing side-placement semantics are visibly fixed. Pairwise changed pixels fell from `28.42%` to `25.45%` (supporting signal only, not the acceptance criterion).

## Command And Parameter Coverage

The real fixture `pgfplots/groupplots-edge-descriptions-top-right.tex` exercises:

- Declarations: `\documentclass[border=2pt]`, `\usepackage{pgfplots}`, and `\usepgfplotslibrary{groupplots}`.
- Environments and commands: `tikzpicture`, `groupplot`, four `\nextgroupplot`, and four coordinate-form `\addplot` commands.
- Group parameters: `group name=measurements`, `group size=2 by 2`, `horizontal sep=0.5cm`, `vertical sep=0.5cm`, `x descriptions at=edge top`, and `y descriptions at=edge right`.
- Axis parameters: `width=4cm`, `height=3.5cm`, `xmin/xmax=0/2`, `ymin/ymax=0/2`, `xlabel`, `ylabel`, and `grid=major`.
- Plot parameters/data: `blue`, `red`, `green!60!black`, `orange`, `thick`, and all coordinate values `0`, `1`, and `2`.

The dedicated regression asserts four axis frames, two retained x/y labels, five top-side x tick labels, and five right-side y tick labels. The generic axis renderer supplies the colors, line width, grid, ranges, tick generation, and coordinate plots.

## Verification

```sh
node --test test/pgfplots-groupplots.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output /private/tmp/tikzkit-qa-groupplots-edge-final-2026-08-07 --only pgfplots-groupplots-edge-descriptions-top-right --native-reference --comparison-grid-mode svg
node scripts/diff-example-pngs.js --output /private/tmp/tikzkit-qa-groupplots-edge-final-2026-08-07
```

All three commands passed with no TikZKit diagnostics and with MacTeX plus tikztosvg references rendered.

## Remaining Work

This is still a partial library. `trim axis group`, arbitrary nested group styles, all shared-label permutations, and cross-group coordinate manipulation remain outside this slice. The next groupplots step should cover an outer-edge mode with explicit per-cell style overrides and compare the resulting named anchors against MacTeX.

The repository-wide `npm test` suite currently reports 117 failures across other compatibility areas, so this focused change does not claim a green full-suite baseline. The dedicated groupplots regression, strict case audit, and `gallery:audit` (333 of 333 fixtures with zero diagnostics) pass for this slice.
