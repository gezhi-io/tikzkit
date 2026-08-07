# `shapes.multipart`: Horizontal Minimum Sizing QA

## Scope

This accepted slice covers the documented sizing rule for a horizontal
`rectangle split` only:

- `rectangle split horizontal`;
- `minimum width=<length>` is ignored;
- the width component of `minimum size=<length>` is ignored;
- `minimum height` and the height component of `minimum size` still enlarge
  the shared node height;
- the existing part fills, separators, and named-part anchors retain their
  intrinsic horizontal locations.

The real driver is
`test/fixtures/examples/workbench/rectangle-split-horizontal-minimums.tex`.
It intentionally requests an `8cm` minimum width around three real text cells
(`sign`, `exponent`, and `mantissa`) and points at `parts.one south`. This
makes the native rule visually unambiguous without hard-coding any geometry.

## Local MacTeX Reading

Reviewed locally on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`

The manual explicitly states that horizontal splits meet `minimum height` but
ignore `minimum width`, with the opposite rule for vertical splits. The source
first records a maximum part width for both modes, but its horizontal branch
only consumes the accumulated individual part widths plus separators; the
minimum-width value is consumed by the vertical branch. This is why a generic
post-layout `max(width, minimumWidth)` is wrong.

## Third-Party SVG Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. The complete after bundle is:

`/private/tmp/tikzkit-qa-rectangle-split-minimums-after-2026-08-07/`

It contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX native PNG, 1cm-grid
SVG/PNG variants, diff PNGs, and both comparison sheets. The matching before
bundle is:

`/private/tmp/tikzkit-qa-rectangle-split-minimums-before-2026-08-07/`

`tikztosvg` emits one `138.86pt x 66.7pt` SVG viewBox with path outlines and
glyph uses. TikZKit emits a browser-text SVG with separate part `<rect>`s and
separator `<path>`s. These structures differ, but both references keep the
same intrinsic three-cell span; MacTeX remains the acceptance oracle.

## Visual Change

Inspected sheets:

- before: `diff/pgf-rectangle-split-horizontal-minimums-native-sheet.png`
- after: `diff/pgf-rectangle-split-horizontal-minimums-native-sheet.png`

Before the change, the TikZKit panel expanded the three cells to the requested
`8cm` width: text clustered at the left, a large blank blue final cell occupied
the right side, and the red anchor arrow no longer corresponded to the native
cell layout. MacTeX and tikztosvg both retained the intrinsic width.

After the change, TikZKit keeps the `sign`, `exponent`, and `mantissa` cells at
their content widths, aligns its two separators with the references, preserves
the requested common height, and starts the red arrow at the first-cell south
anchor. The TikZKit/MacTeX changed-pixel ratio fell from `0.2862` to `0.1116`
and mean absolute RGBA from `0.04265` to `0.02205`; the visible removal of the
spurious horizontal expansion is the acceptance evidence.

## Implementation And Verification

Changed:

- `src/engine/evaluate.js`: horizontal multipart sizing no longer applies
  `minimum width` or the width component of `minimum size`.
- `test/shapes-multipart-horizontal-minimums.test.js`: regression for intrinsic
  width and retained minimum height.
- `test/fixtures/examples/workbench/rectangle-split-horizontal-minimums.tex`:
  three-way visual driver.
- `test/fixtures/examples/manifest.json`: catalog entry.

Verified with:

```bash
node --test test/shapes-multipart-horizontal-minimums.test.js \
  test/shapes-multipart-empty-metrics.test.js \
  test/shapes-multipart-align.test.js \
  test/shapes-multipart-ignore-empty.test.js
npm run examples:render -- --manifest test/fixtures/examples/manifest.json \
  --only pgf-rectangle-split-horizontal-minimums \
  --output /private/tmp/tikzkit-qa-rectangle-split-minimums-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-rectangle-split-minimums-after-2026-08-07 \
  --register --alignment-radius 3
```

## Remaining Limits

`shapes.multipart` stays `partial`: repeated low-level empty-part rule keys,
`rectangle split every empty part`, custom fill hooks beyond the supported
list, remaining multipart shapes, and exact arbitrary TeX text boxes are not
complete. The next useful slice is vertical multipart sizing plus the
`rectangle split use custom fill` hook, using a real class/table diagram rather
than a synthetic coordinate patch.
