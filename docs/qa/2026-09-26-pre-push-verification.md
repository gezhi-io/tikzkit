# Pre-Push Verification: Ten Cases

## Scope And Result

Reviewed the existing structural and compatibility changes, then selected ten
fixtures covering integer expressions, matrix styles, ellipses, scatter plots,
3D axes, decorations, colorbars, logarithmic ticks, and math labels. Existing
changes were retained, including transparent default SVG backgrounds. Callers
requiring an opaque canvas can still pass `background: "white"`.

All ten cases generated JavaScript SVG/PNG, local tikztosvg SVG/PNG, and native
MacTeX PNG successfully. All ten before and after four-panel sheets were inspected.
Four cases improved visibly; six JS SVGs were byte-identical before and after
the repairs in this review. All selected cases have zero diagnostics in both runs.
**This is not a ten-case visual-parity pass.** The image gate still reports ten
different pairs, zero missing artifacts, zero stale artifacts, and blocked
acceptance. Remaining differences are listed below.

## Repairs

- Restored colorbar cardinal-anchor offsets in `src/pgfplots/axis3d.js`.
- Restored logarithmic coordinates for custom tick templates in
  `src/pgfplots/ticks.js`, preserving the incoming tick-alignment changes.
- Restored fixed-size math angle delimiters in `src/tikz/text.js`.
- Corrected the new `src/tex/etexArithmetic.js` implementation: e-TeX division
  rounds to the nearest integer, with ties away from zero, rather than truncating
  once at the end. Consecutive multiplication/division uses a wide intermediate.
  Only a terminating `\relax` is consumed; following conditionals are preserved.
  The integer grammar uses the existing Chevrotain dependency, bounded expression
  sizes, BigInt arithmetic, and per-operation overflow checks. Unsupported
  expressions remain intact. Foreach expansion accepts whitespace between
  `\the` and `\numexpr`.

The e-TeX support remains a subset: this is not a complete TeX register, macro,
radix-number, or nested-expression engine. General stretchy delimiters and the
remaining 3D tick/layout differences are not claimed as implemented.

## Local Reference

Read the installed TeX Live 2025 files under
`/usr/local/texlive/2025/texmf-dist/`:

- `doc/etex/base/etex_man.tex`, lines 442-476: integer bounds, division rounding,
  fused multiply/divide operations, and expression termination.
- `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, lines 3957-3984: matrix
  style precedence from columns and column parity through rows and cell styles.
- `tex/generic/pgfplots/pgfplots.code.tex`, lines 882-920: legacy absolute label
  offsets and near-tick-label positioning styles.
- `tex/latex/base/fontmath.ltx`, lines 479-487: angle-delimiter declarations.

A native pdfLaTeX probe confirmed `-7/2=-4`, `7/2=4`, `7/2*20=80`,
`(7/2)*20=80`, `3*13/5=8`, and `2147483647*2/2=2147483647`.
The probe is retained locally as `outputs/qa/2026-09-26-numexpr-probe.tex`.
The earlier [twenty-case audit](2026-09-10-selected20-visual-audit.md) records
the colorbar and logarithmic tick source analysis.

Reference commands: `/Library/TeX/texbin/tikztosvg` (0.3.0),
`/Library/TeX/texbin/pdflatex` (TeX Live 2025), and
`/opt/homebrew/bin/rsvg-convert`. No fonts were downloaded or replaced.

## Visual Findings

Native and tikztosvg agree on the principal shapes and labels. Their stroke
rasterization differs slightly; native remains the reference for acceptance.
Sheets use native / tikztosvg in the top row and JS / diff in the bottom row.

| Case | Result and remaining difference |
| --- | --- |
| `etex-integer-shades` | Fixed: values and blue intensities now correspond to 20, 40, 60, 80 instead of 10, 30, 50, 70. Small glyph/baseline differences remain. |
| `matrix-style-precedence` | Column, row, parity, and specific-cell fill precedence agrees. Small box/text offsets remain. |
| `latex-examples-haskell-type-classes` | Nodes, connections, and ellipse topology are intact. Font widths, line wrapping, row spacing, and arrow geometry still differ. |
| `latex-examples-csv-bivariate-normal-distribution` | Point distribution and axis ranges are intact. Frame stroke, small placement, and marker/text rasterization differences remain. |
| `latex-examples-hypersurface-2` | Surface topology and colors are intact. Grid/tick details, label placement, and projected margins remain different. |
| `decorations-pathreplacing-fixed-waves-flowchart` | Wave count and direction, both node boxes, and connectors are intact. Label baselines and spacing remain slightly different. |
| `pgfplots-colorbar-top-math` | Fixed: the colorbar no longer shifts half its width to the right. Vertical spacing, automatic z-tick count, and formula metrics still differ. |
| `pgfplots-3d-extra-ticks-math` | Fixed: extra log labels display 1* and 2*, not 5* and 50*. Log minor ticks and some text placement still differ. |
| `trees-missing-physics` | Fixed: ket delimiters replace literal `rangle` command names. Formula weight and text metrics still differ. |
| `graphs-node-text-physics` | Rounded boxes remain correct after the refactor. Edge formulas are heavier than native; arrow tips differ. |

## Automated Checks

- Incoming full suite: 2,645 tests, 2,483 passed, 148 failed, 14 skipped.
- Final full suite: 2,649 tests, 2,493 passed, 142 failed, 14 skipped.
- The six repaired failures concern colorbar anchors, log labels, and angle
  delimiters. There are no newly failing names compared with either the incoming
  suite or the recorded September 10 baseline. The remaining 142 failing names
  exactly match that earlier baseline; **the full suite is still not green**.
- Focused arithmetic, matrix, compatibility, colorbar, log-tick, delimiter, and
  corner-radius tests: 24/24 passed.
- Architecture check: 461 modules, no new violations; the existing
  `tikz/text.js` to `frontend/latex-shell.js` dependency remains recorded debt.

```sh
node --test
node --test test/etex-numexpr-and-matrix-styles.test.js \
  test/pgfplots-compat-and-shape-alignment.test.js \
  test/pgfplots-log-tick-template.test.js test/math-angle-delimiters.test.js \
  test/pgfplots-colorbar-top.test.js test/node-rounded-corners.test.js
npm run check:architecture
npm run docs:links
```

## Reproduce The Comparison

```sh
node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-26-pre-push-after \
  --only etex-integer-shades --only matrix-style-precedence \
  --only latex-examples-haskell-type-classes \
  --only latex-examples-csv-bivariate-normal-distribution \
  --only latex-examples-hypersurface-2 \
  --only decorations-pathreplacing-fixed-waves-flowchart \
  --only pgfplots-colorbar-top-math --only pgfplots-3d-extra-ticks-math \
  --only trees-missing-physics --only graphs-node-text-physics \
  --native-reference --tikztosvg-engine pdflatex \
  --quiet-progress --continue-on-external-failure
node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-26-pre-push-after --register
```

Open `outputs/qa/2026-09-26-pre-push-after/index.html`. The directory contains
`tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`, `tikztosvg-png/`,
`mactex-png/`, and `diff/`. The incoming snapshot is retained beside it in
`2026-09-26-pre-push-before/`. Generated artifacts are local and ignored by Git;
the two new fixtures and reproduction instructions are committed instead.

No npm publication or version increment is part of this verification.
