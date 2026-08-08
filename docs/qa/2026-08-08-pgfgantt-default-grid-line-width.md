# PGFGantt Default Grid Line Width: Visual QA

## Scope

This slice fixes only the default `hgrid` / `vgrid` dotted stroke width in
`ganttchart`. It does not change title, bar, group peak, milestone, or link
geometry.

Driver: [`test/fixtures/examples/pgfgantt/group-peaks-linked.tex`](../../test/fixtures/examples/pgfgantt/group-peaks-linked.tex).

## Local MacTeX Reading

Reviewed the installed TeX Live 2025 implementation:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfgantt/pgfgantt.sty`,
  lines 50-97: `hgrid` defaults to `dotted`; its grid loop emits
  `\\draw [#2]` without a line-width key.
- The same file, lines 99-140: `vgrid` follows the same `dotted` default and
  direct `\\draw [#2]` behavior.
- Lines 357-404 establish the canvas background layer and the grid/title/chart
  bounds used by the real example.

Therefore a default grid must inherit TikZ's ordinary `0.4pt` stroke, whose
`dotted` pattern is `on \\pgflinewidth off 2pt`. It must not inject a local
`0.2pt` width.

## Implementation

[`src/frontend/latex-shell.js`](../../src/frontend/latex-shell.js) now lowers
each grid line with its selected pgfgantt style only. The normal TikZ option
resolver supplies the inherited `0.4pt` width. The previous hard-coded
`line width=0.2pt` halved every grid dot and changed the dot pattern itself.

[`test/walmes-compat.test.js`](../../test/walmes-compat.test.js) now asserts
that default `hgrid` and `vgrid` both retain `lineWidthFromPt(0.4)`, while the
existing repeated-style-list regression still verifies style sequencing.

## Three-Way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; MacTeX used local `pdflatex`.

- TikZKit SVG: `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-pgfgantt-links-2026-08-08/after/tikzkit-svg/pgfgantt-group-peaks-linked.svg`
- tikztosvg SVG: `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-pgfgantt-links-2026-08-08/after/tikztosvg-svg/pgfgantt-group-peaks-linked.svg`
- MacTeX PNG: `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-pgfgantt-links-2026-08-08/after/mactex-png/pgfgantt-group-peaks-linked.png`
- inspected three-way sheet: `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-pgfgantt-links-2026-08-08/after/diff/pgfgantt-group-peaks-linked-native-sheet.png`
- registered diff: `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-pgfgantt-links-2026-08-08/after/diff-png/pgfgantt-group-peaks-linked-registered.png`

The emitted TikZKit SVG now has `stroke-width="1.405839..."` and
`stroke-dasharray="1.405839... 7.029196..."` in internal units. Its viewBox
scale converts those to `0.3985pt` and `0.3985pt 1.99255pt`, exactly the
corresponding tikztosvg grid path values. Before the fix the emitted line was
`0.2pt` and only the dot length, not the fixed `2pt` gap, was halved.

## Visual Review

I inspected TikZKit, tikztosvg, MacTeX, the native comparison sheet, and the
registered diff. Before the fix TikZKit's grid dots were visibly smaller and
fainter than both references. Afterward the dot diameter and cadence match
the tikztosvg SVG structure; the chart's title, groups, orange delivery bar,
blue link, white bars, and labels are unchanged.

The whole-image registered TikZKit/tikztosvg changed-pixel ratio moves from
14.54% to 14.85%. That small aggregate increase is the expected raster effect
of correctly painting larger black dots; it is not treated as the acceptance
criterion. SVG inspection verifies the source-defined grid geometry now
matches exactly. Residual MacTeX difference is mostly `pdflatex`/PDF raster
antialiasing and the still-separate chart/text bounding-box calibration.

## Validation

```bash
npm test -- --test-name-pattern="pgfgantt" test/walmes-compat.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only pgfgantt-group-peaks-linked \
  --output outputs/qa-pgfgantt-links-2026-08-08/after \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfgantt-links-2026-08-08/after \
  --register --alignment-radius 3
```

The focused suite passes; all three renderers complete; the real driver emits
zero diagnostics. `pgfgantt` remains `partial`: calendar/date slots, custom
link declarations, specialized canvas/element shapes, and arbitrary
link-anchor styles are still outside this slice.
