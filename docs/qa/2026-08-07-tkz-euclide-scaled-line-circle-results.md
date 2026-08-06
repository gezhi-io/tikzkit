# tkz-euclide scaled line-circle result binding QA

## Scope

This pass corrects one `tkz-euclide` construction family only:
`\tkzInterLC` followed by `\tkzGetPoints` inside a scaled
`tikzpicture`. The accepted contract is that picture scaling transforms the
two constructed positions, but does not swap the names bound to them. It does
not change the `near`, `common`, `next to`, `[R]`, or `[with nodes]` selectors,
nor does it claim arbitrary affine scope support.

The real drivers are:

- `test/fixtures/examples/tkz-euclide/line-circle-intersections.tex`
- `test/fixtures/examples/tkz-euclide/thales-circle-triangle.tex`

The latter is the visible acceptance case: `C` must be the forward, upper
circle contact used by the filled Thales triangle; `E` must be the opposite
contact.

## Local Source Reading

Reviewed from TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-tools-eu-intersections.tex`
  lines 175-234 (`tkzInterLC`) and 237 onward (`tkzInterLCR`)
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-obj-eu-points.tex`
  lines 122-126 (`tkzGetPoint(s)`)
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-euclide/TKZdoc-euclide-intersection.tex`

`tkzInterLC` calculates a radius, delegates to `tkzInterLCR`, then only
reorders for explicit `near`, `common`, or `next to` options. The raw routine
projects the circle center onto the directed line and constructs the mirrored
pair. `tkzGetPoints{E}{C}` aliases those already-ordered results; a picture
`scale=1.5` transforms the coordinates but is not a selector. The earlier
TikZKit scale-specific swap was therefore removed.

## Three References

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert`
is `/opt/homebrew/bin/rsvg-convert`.

Artifacts are retained in:

- `/private/tmp/tikzkit-qa-tkz-interlc-thales-after-2026-08-07/tikzkit-svg/`
- `/private/tmp/tikzkit-qa-tkz-interlc-thales-after-2026-08-07/tikztosvg-svg/`
- `/private/tmp/tikzkit-qa-tkz-interlc-thales-after-2026-08-07/mactex-png/`
- `/private/tmp/tikzkit-qa-tkz-interlc-thales-after-2026-08-07/diff/`

The tikztosvg SVG for the full Thales case uses TeX glyph paths, explicit
stroke paths, `stroke-linecap="butt"`, `stroke-linejoin="miter"`, and the
outer `matrix(1 0 0 -1 ...)` coordinate inversion. Its upper `C` triangle
matches the local MacTeX reference, so both independent renderers reject the
old lower-contact result.

## Visual Result

Before this correction, TikZKit swapped the two named intersections whenever a
picture scale was greater than one. In the Thales case that put `C` below the
diameter: the triangle, its fill, radius segment, and all six angle marks were
constructed in the wrong half of the circle.

Afterward, TikZKit draws the triangle on the upper semicircle, keeps `E` on
the lower-left contact, and preserves the outer sector, labels, radii, and
angle arcs in the same geometric arrangement as MacTeX and tikztosvg. The
remaining visible differences are line/font rasterization and small label
spacing, rather than missing or wrongly bound construction elements.

The MacTeX-registered comparison after the fix is `0.03881` mean absolute
RGBA for the full Thales figure. This value is only a triage aid; the accepted
evidence is the four-panel sheet, where the previously inverted triangle has
visibly moved to the correct upper location.

## Validation

Passed:

```bash
node --test test/tkz-euclide.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-tkz-interlc-thales-after-2026-08-07 \
  --only tkz-euclide-line-circle-intersections \
  --only tkz-euclide-thales-circle-triangle \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-tkz-interlc-thales-after-2026-08-07 \
  --register --alignment-radius 3
```

Both real cases produced TikZKit SVG/PNG, tikztosvg SVG/PNG, and MacTeX PNG;
both had zero external failures and no TikZKit diagnostics.

## Remaining Boundary

Nested rotated/non-uniform transformed construction frames, tangent cases at
degenerate roots, and the broader modern `tkz-euclide` circle families remain
partial. They need their own real-case visual acceptance pass.
