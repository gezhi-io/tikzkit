# PGFPlots 3D tick-label lists and templates

## Scope

This slice implements custom major tick labels for perspective PGFPlots axes: positional `xticklabels`, `yticklabels`, and `zticklabels`; blank positional entries; common `xticklabel`, `yticklabel`, and `zticklabel` templates using `\tick` or `\pgfmathprintnumber{\tick}`; and shared `rotate`, `anchor`, `align`, `font`, and `inner sep` tick-label styles. It does not implement arbitrary executable TeX callbacks.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`, around lines 1425-1470: the three label-list keys install axis-specific user-list handlers; the three template keys store per-axis templates.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`, around lines 2524-2538: generic and axis-specific tick-label styles append to the final tick-label node style.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`, around lines 560-620: a list label is selected by `ticknum`, a missing or blank entry yields no text without shifting later entries, and `\tick` is inverse-transformed to the data-coordinate string before template evaluation.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfloat.code.tex`, around lines 1640-1660: `\pgfmathprintnumber` dispatches its no-option and optional-key forms separately. This slice deliberately lowers only the no-option form used by the fixtures.

These rules are implemented by reusing the 2D tick-label parser in `src/pgfplots/ticks.js` from the 3D renderer and from the 3D parent-bounds pass.

## Cases and coverage

### `pgfplots-3d-tick-labels-algorithm`

Commands/environments exercised: `\documentclass`, `\usepackage`, `\pgfplotsset`, `tikzpicture`, `axis`, and `\addplot3 coordinates`.

Options exercised: `width`, `height`, `view`, x/y/z limits, x/y/z ticks, x/y label lists, z template, rotated x-label style, `grid=major`, axis descriptions, color, line width, and plot marks.

Before the fix, TikZKit displayed `0,1,2,3`, `0,1,2`, and `0,50,100`. After the fix it visibly displays `Input/Parse/Render/Ship`, `CPU/GPU/Cloud`, and percentage labels, with the x labels rotated and the long labels included in the canvas bounds.

### `pgfplots-3d-tick-labels-math`

Commands/environments exercised: the common shell above plus sampled `\addplot3[surf]`.

Options exercised: two function domains, `samples`, explicit ranges, formula label lists, one blank z-label slot, surface rendering, grid, view, and formula axis descriptions.

Before the fix, decimal approximations `1.571` and `3.142` were shown. After the fix, both horizontal axes use `0`, `\pi/2`, and `\pi`; the middle z tick remains physically present but has no label, matching the native positional-list behavior.

### `pgfplots-3d-tick-labels-physics`

Commands/environments exercised: the common shell above plus a marked 3D coordinate trajectory.

Options exercised: x and z numeric templates, y formula labels, SI-like math units, limits, ticks, grid, view, plot color, line width, and square marks.

Before the fix, all three axes showed bare numbers. After the fix, x ticks carry seconds and z ticks carry `m s^{-1}` units. The remaining visible residual is browser formula spacing and the established perspective description margin, not missing or misordered labels.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX engine: `/Library/TeX/texbin/pdflatex`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- Before: `outputs/qa/2026-09-05-pgfplots-3d-tick-labels-before/`
- After: `outputs/qa/2026-09-05-pgfplots-3d-tick-labels-after/`
- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- MacTeX PNG: `mactex-png/`
- Four-way sheets and image diffs: `diff/` and `diff-png/`

The tikztosvg SVG uses a tight point-based `viewBox`, path outlines plus glyph `<use>` elements, and explicit transforms for rotated labels. Axis and plot strokes retain butt caps and miter joins. It does not use browser `<text>` or `foreignObject`; TikZKit keeps semantic SVG text with bundled Computer Modern fonts, so small rasterization and kerning residuals remain expected.

## Verification

```sh
node --test test/pgfplots-3d-tick-labels.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-05-pgfplots-3d-tick-labels-after --only pgfplots-3d-tick-labels-algorithm --only pgfplots-3d-tick-labels-math --only pgfplots-3d-tick-labels-physics --native-reference --strict-tikztosvg --continue-on-external-failure --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-pgfplots-3d-tick-labels-after
node scripts/case-semantic-audit.js test/fixtures/examples/pgfplots/3d-tick-labels/algorithm.tex --review test/fixtures/examples/pgfplots/3d-tick-labels/algorithm.review.json --strict
node scripts/case-semantic-audit.js test/fixtures/examples/pgfplots/3d-tick-labels/math.tex --review test/fixtures/examples/pgfplots/3d-tick-labels/math.review.json --strict
node scripts/case-semantic-audit.js test/fixtures/examples/pgfplots/3d-tick-labels/physics.tex --review test/fixtures/examples/pgfplots/3d-tick-labels/physics.review.json --strict
npm run gallery:audit
```

Focused tick-label tests pass 4/4, the combined semantic/tick-label/z-log regression selection passes 26/26, all three strict semantic audits are accepted with zero blockers, and the full gallery renders 552/552 cases with zero diagnostics. All three cases render through TikZKit, tikztosvg, and MacTeX. Visual acceptance passes because the previously absent categorical, symbolic, blank-slot, rotated, and unit-bearing labels are now present and ordered correctly.

## Remaining work

- Optional arguments inside `\pgfmathprintnumber[...]` templates.
- Arbitrary TeX execution and user-defined callback macros in tick templates.
- Complete x/y/z scaled-tick multiplier placement when a custom template is combined with scientific scaling.
- Exact browser formula kerning and final perspective text-margin calibration.
