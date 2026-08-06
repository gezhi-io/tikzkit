# PGFPlots Restricted Middle-Axis QA

## Scope

This slice corrects the shared PGFPlots geometry used by an explicit
`axis x/y line=middle` together with `enlargelimits=true` and a restricted
zero-bound data range. The driver is
`latex-examples/2d-chi-squared-pdf.tex`.

The change is intentionally limited to the final data-to-canvas transform and
the default axis-title anchor. It does not add a case-specific path, nor does
it change raw-gnuplot evaluation, curve sampling, or legend parsing.

## Local TeX Review

Reviewed from the installed TeX Live 2025 tree:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`:
  the surveyed/restricted interval and the final transform interval are
  distinct phases.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`:
  `every axis title shift` defaults to `6pt`, and `every axis title` is placed
  at the final axis-description box rather than at the final sampled point.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.scaling.code.tex`:
  explicit `width` and `height` retain the normal non-plot allocation.

The reference SVG confirmed the resulting geometry: a surveyed `0:0.5` y
interval with `enlargelimits=true` maps to a symmetric `-0.05:0.55` final
range. The previous implementation incorrectly used `0:0.6`, which removed
the lower grid reserve and made the title use the surveyed upper bound.

## References And Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- PNG conversion: `/opt/homebrew/bin/rsvg-convert`
- Before sheet:
  `/private/tmp/tikzkit-qa-chi-before-2026-08-06/diff/latex-examples-2d-chi-squared-pdf-sheet.png`
- After sheet:
  `/private/tmp/tikzkit-qa-chi-symmetric-title-6pt-2026-08-06/diff/latex-examples-2d-chi-squared-pdf-sheet.png`
- After JS SVG/PNG:
  `/private/tmp/tikzkit-qa-chi-symmetric-title-6pt-2026-08-06/tikzkit-svg/latex-examples-2d-chi-squared-pdf.svg`
  and
  `/private/tmp/tikzkit-qa-chi-symmetric-title-6pt-2026-08-06/tikzkit-png/latex-examples-2d-chi-squared-pdf.png`
- After tikztosvg SVG/PNG:
  `/private/tmp/tikzkit-qa-chi-symmetric-title-6pt-2026-08-06/tikztosvg-svg/latex-examples-2d-chi-squared-pdf.svg`
  and
  `/private/tmp/tikzkit-qa-chi-symmetric-title-6pt-2026-08-06/tikztosvg-png/latex-examples-2d-chi-squared-pdf.png`

The local MacTeX native PNG remains unavailable for this exact source because
the original raw `gnuplot` program needs an external `gnuplot` executable,
which is not installed. No dependency was installed. `tikztosvg` normalizes
the supported raw-gnuplot expression to coordinates and is the usable local
visual reference for this case.

## Visual Result

Before the fix, the JS canvas placed the zero y axis on the lower plot edge;
all 10% enlargement was spent above the restricted range. The top grid,
curves, title, and x tick labels consequently occupied a different vertical
frame from tikztosvg.

After the fix, the JS and tikztosvg panels have the same lower grid reserve,
zero-axis position, `0.1` through `0.5` y-grid spacing, x ticks `1` through
`8`, six unmarked curves, cycle-list dash styles, and title reference edge.
The viewed after-sheet is visibly aligned on the grid; this is a shared
coordinate-system improvement rather than a fixture override.

The raw PNG comparison changed from `12.87% / 0.02366` to
`11.21% / 0.01936` (changed pixels / mean absolute RGBA). These numbers are
only supporting evidence. The residual is one raster row of browser SVG text
bbox descent (`235.14pt` JS versus `234.24pt` tikztosvg), plus font outline
and anti-aliasing differences in the title and legend.

## Supported Driver Surface

The driver now uses all of the following through shared implementations:

- `\\pgfplotscreateplotcyclelist`, `cycle list name`, color entries, and dash
  entries.
- `\\foreach`, `\\addplot+`, `mark={}`, `domain`, `samples`, and
  `restrict y to domain`.
- The browser-safe recognized `gnuplot[raw gnuplot]` subset: assignments,
  scalar function definitions, conditionals, `exp`, `log`, `lgamma`, ranges,
  sample counts, and one plot expression.
- `axis x line=middle`, `axis y line=middle`, `enlargelimits=true`, major
  grid, title, labels, legend placement, and default `6pt` title shift.

Still partial: arbitrary gnuplot programs or external process execution,
generic PGFPlots survey pipelines, the full enlarge-limits grammar, arbitrary
number-format templates, and exact browser-to-TeX text bounds.

## Verification

Passed:

```sh
node --test --test-name-pattern='restricted zero-bound|chi-squared|title styles|titles use' test/pgfplots-seams.test.js test/example-render-script.test.js
npm run gallery:audit
```

The focused suite passed and `gallery:audit` rendered `283/283` fixtures with
zero diagnostics. A wider `pgfplots-seams` run currently still reports 30
failures in legacy tick and 3D baseline tests outside this slice; they remain
follow-up work.
