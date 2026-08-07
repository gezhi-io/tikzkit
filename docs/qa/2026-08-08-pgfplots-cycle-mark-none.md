# PGFPlots Cycle List Mark Ownership

## Scope

This slice fixes one shared PGFPlots rule: `\addplot+` appends the active
cycle-list entry, but does not independently request a plot mark. A custom
cycle list can contain only color and dash styles. Conversely, the unnamed
default cycle may declare a mark, and that mark must still be preserved.

The real driver is `latex-examples-2d-chi-squared-pdf`. Its six raw-gnuplot
curves use a named `mylist` cycle list and every `\addplot+` explicitly says
`mark={}`. The case also exercises `\foreach`, `gnuplot[raw gnuplot]`,
`samples=800`, `restrict y to domain`, middle axes, `every axis plot/.append
style={very thick}`, a legend, and math labels.

## Local Source Study

Reviewed from local TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  installs and selects named cycle lists through `/pgfplots/cycle list name`;
  each list entry is a normal style list rather than an implicit marker.
- The same file defines `/pgfplots/no markers` by appending `mark=none`, so an
  explicit empty marker declaration must win over a cycle-provided mark.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`
  receives `raw gnuplot`, prepares its domain and samples, and passes its
  program to PGF's external table workflow. TikZKit deliberately evaluates
  only its safe numeric subset in the browser.

## Implementation

`applyPgfplotsCycleStyles()` now materializes the default cycle style for any
unnamed `\addplot+`, including 3D plots. That gives the normal default cycle a
real mark declaration. `shouldRenderPlotMarks()` then relies only on a real
`mark`, `scatter`, or `only marks` option; it no longer treats the parser's
internal `pgfplots plus` bookkeeping flag as a marker request. Thus a named
list such as `{yellow}` remains line-only, while `mark={}` overrides either
kind of cycle to `mark=none`.

## Artifacts And Visual Review

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

Focused artifacts are in
`outputs/qa-pgfplots-cycle-mark-none-2026-08-08`:

- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`;
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`;
- MacTeX native PNG: `mactex-png/`;
- three-way sheets and diff: `diff/` and `diff-png/`.

All three renderers produced the case with zero diagnostics. I inspected
`diff/latex-examples-2d-chi-squared-pdf-native-sheet.png` and
`diff/latex-examples-2d-chi-squared-pdf-sheet.png`.

Before the fix, TikZKit put a small circular marker into each of the six legend
samples although the source requested `mark={}`. After the fix, the yellow,
green-dashed, cyan-dashed, blue-dotted, magenta-dotted, and red loosely-dotted
legend samples are line-only like MacTeX and tikztosvg. The curves, grid,
middle axes, title, labels, and legend frame remain present. The remaining
pixel difference is primarily glyph rasterization and a one-pixel crop delta;
it is not a missing or displaced plot element.

## Verification

```bash
node --test --test-name-pattern='pgfplots (addplot3 parametric tuples|cycle list declarations|marks lowering)' test/pgfplots-seams.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-2d-chi-squared-pdf \
  --output outputs/qa-pgfplots-cycle-mark-none-2026-08-08 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfplots-cycle-mark-none-2026-08-08
npm run extension-registry
```

The focused test selection passes 3/3. The complete `pgfplots-seams` suite
still has unrelated historical exact-geometry expectations; this change does
not claim that broad suite is green.

## Remaining Boundary

Cycle entries with executable TeX, marker phase controls, multi-index cycle
lists, and arbitrary `mark options` inheritance remain partial. Raw gnuplot
also remains intentionally bounded: arbitrary system commands, files, string
processing, and unsupported functions are not evaluated by browser code.
