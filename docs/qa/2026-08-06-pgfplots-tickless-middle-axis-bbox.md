# PGFPlots Tickless Middle-Axis BBox QA

## Scope

This pass covers one shared PGFPlots behavior only: an explicit
`axis lines=middle` axis with `xtick=\empty` and `ytick=\empty`. It does not
claim support for arbitrary tick labels, legends, or general multi-axis layout.

Driver: `test/fixtures/pgfplots-middle-axis-empty-ticks.tex`.

## Local Source Reading

Reviewed TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.scaling.code.tex`
  lines 145-162. `\pgfplots@initsizes@get@width@withoutlabels` and its height
  counterpart both call `\pgfplots@initsizes@handle@label@const` with `45pt`.
  The requested axis size is therefore reduced by the description constant even
  when no tick labels are painted.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  lines 2776-2784 and 2885-2947. Middle axes place their terminal labels via
  current-axis/ticklabel anchors; no such label exists in this driver.

Implementation consequence: preserve the 45pt transform reserve, but do not
add a second invisible canvas gutter when both tick lists are empty.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

Artifacts are intentionally untracked:

- Before: `/private/tmp/tikzkit-qa-middle-axis-empty-ticks-before-2026-08-06/`
- Final: `/private/tmp/tikzkit-qa-middle-axis-empty-ticks-after-tuned-2026-08-06/`

Each directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, a diff,
and a native comparison sheet.

## Visual Result

Before, the TikZKit canvas measured `272.07pt × 57.77pt`; tikztosvg measured
`270.97pt × 56.57pt`. The extra synthetic tight-bounds margin made the arrows
and line endpoints appear slightly inset after the images were normalized.

After, TikZKit is `270.82pt × 56.64pt`. The sheet shows the blue diagonal,
black horizontal arrow, black vertical arrow, and endpoint marks sharing the
same physical frame. Registered TikZKit-vs-tikztosvg changed pixels improved
from `4.89%` to `2.39%`; the visible acceptance is based on the inspected
panels, not that scalar alone.

MacTeX and tikztosvg retain small raster/crop differences from their own PDF/SVG
backends. TikZKit now follows the tikztosvg canvas closely while keeping the
MacTeX 45pt sizing rule.

## Changed Files

- `src/pgfplots/geometry.js`
- `test/fixtures/pgfplots-middle-axis-empty-ticks.tex`
- `test/extensions.test.js`
- `test/pgfplots-seams.test.js`
- `README.md`

## Verification

```bash
node --test --test-name-pattern='middle-axis plot area|tickless middle axes' \
  test/extensions.test.js test/pgfplots-seams.test.js
node --test test/pgfplots-middle-axis-labels.test.js
```

The focused tests pass. The full suite remains broader than this slice and has
existing failures in unrelated fixture/visual-baseline families.

## Remaining Work

Tick-label metrics, title/legend layout, legacy versus modern label anchors,
multi-axis overlays, and 3D projected annotations remain partial and need their
own reference-backed passes.
