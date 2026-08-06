# tkz-euclide line-circle scale-order QA

> Superseded on 2026-08-07 by
> `docs/qa/2026-08-07-tkz-euclide-scaled-line-circle-results.md`.
> The earlier scale-specific result swap was disproved by fresh MacTeX and
> tikztosvg panels for the full Thales construction; do not use this note as
> an acceptance claim.

## Scope

This pass covers one construction family only: `\tkzInterLC` followed by
`\tkzGetPoints` inside a magnified `tikzpicture`. It preserves the normal
default root order and the documented `near`, `common`, `next to`, `[R]`, and
`[with nodes]` selection forms. Nested scope transforms, rotations, and a
general affine construction frame remain outside this slice.

The real driver is
`test/fixtures/examples/tkz-euclide/line-circle-intersections.tex`, extracted
from the Thales-circle corpus case. It uses `scale=1.5`, four `\tkzDefPoint`
coordinates, `\tkzInterLC[/tikz/overlay](M,H)(M,B)`, `\tkzGetPoints{E}{C}`,
`circle (2cm)`, a filled rounded triangle, `1pt`/`1.2pt` points, calc
midpoints, and label placements. No command or numeric literal in this source
is silently treated as an acceptance claim beyond that listed subset.

## Local MacTeX Reading

Reviewed locally in TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-tools-eu-intersections.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-obj-eu-points.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-euclide/TKZdoc-euclide-intersection.tex`

`\tkzInterLC` reduces its center/radius forms to `\tkzInterLCR`. The latter
projects the center onto the line, uses `\pgfpointborderellipse`, then mirrors
the contact. The outer macro applies `near`, `common`, and `next to` only
after this raw order is established. Under a magnifying picture `scale`,
`xscale`, or `yscale`, that PGF point-border path makes the forward line
contact the first construction result. TikZKit now records that picture-level
condition before explicit selectors run.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` (version `0.3.0`),
and `rsvg-convert` at `/opt/homebrew/bin/rsvg-convert`.

- Native: `outputs/qa-tkz-interlc-after-2026-08-06/mactex-png/tkz-euclide-line-circle-intersections.png`
- TikZKit: `outputs/qa-tkz-interlc-after-2026-08-06/tikzkit-svg/` and `tikzkit-grid-png/`
- tikztosvg: `outputs/qa-tkz-interlc-after-2026-08-06/tikztosvg-svg/` and `tikztosvg-grid-png/`
- Four-panel MacTeX sheet: `outputs/qa-tkz-interlc-after-2026-08-06/diff/tkz-euclide-line-circle-intersections-native-sheet.png`

The tikztosvg SVG uses a `199.33pt x 179.49pt` viewBox, path glyph outlines,
`stroke-linecap=butt`, `stroke-linejoin=miter`, and an outer
`matrix(1 0 0 -1 ...)` transform. Its converter wrapper produces `C` at the
upper contact and `E` at the lower contact; this differs from local MacTeX
5.11c for this scale-sensitive macro. MacTeX is therefore the acceptance
criterion for this case.

## Visual Result

Before the change, TikZKit placed the filled triangle at the upper contact and
the red `E` dot at the lower-left contact, the same visible mistake as the
tikztosvg wrapper. After the change, TikZKit places red `E` at the circle's
upper-right contact and `C` at the lower triangle vertex, matching the native
panel's triangle, radius segment, labels, and 1cm grid positions. The remaining
difference is only crop/raster presentation between the renderers, not a
missing construction element.

## Validation

Passed:

```bash
node --test test/tkz-euclide.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-tkz-interlc-after-2026-08-06 \
  --only tkz-euclide-line-circle-intersections,tkz-euclide-thales-circle-triangle \
  --native-reference --math-renderer svg-text
npm run examples:diff -- --output outputs/qa-tkz-interlc-after-2026-08-06
npm run extension-registry
```

The second fixture cannot produce a native panel because the source retains
legacy `\usetkzobj{all}`, which is undefined in the installed tkz-euclide
5.11c. Its JS/tikztosvg artifacts remain in the same QA directory but are not
used as native acceptance evidence.

## Next Boundary

Track transforms introduced by nested `scope` environments and audit rotation
and non-uniform scaling separately. They alter the construction frame rather
than only this default line-circle root order.
