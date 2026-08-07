# QA: shadows.blur radius calibration

## Scope

This slice calibrates `blur shadow={shadow blur radius=...}` for both path and
node shadows. It changes only the shared SVG blur filter and its rendering
extent: the drawing canvas grows by PGF's `2r` on each side and the SVG
Gaussian uses `stdDeviation=2r/3`. It does not attempt to reproduce every
discrete fading layer of `pgf-blur`.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf-blur/tikzlibraryshadows.blur.code.tex`.

The local library defines defaults of `.4ex` blur radius, four blur steps,
`.5ex` horizontal shift, `-.5ex` vertical shift, and 40 percent opacity. Its
`render blur shadow` preaction expands the temporary canvas by `2 * radius`
on all four sides, then paints a finite sequence of fading strokes. The source
therefore gives a concrete raster bound even though TikZKit uses one SVG
filter instead of a stepped fade.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
available at `/opt/homebrew/bin/rsvg-convert`. The fixture completed for all
three renderers:

- Fixture: `test/fixtures/examples/shadows/blur-shadow-path.tex`
- Before: `/private/tmp/tikzkit-qa-shadows-blur-steps-before-2026-08-07/`
- After: `/private/tmp/tikzkit-qa-shadows-blur-steps-after-2026-08-07/`

Each output directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX
PNG, registered diff PNG, and a four-panel native sheet. The tikztosvg SVG
uses a different blur construction/crop from native TeX, so MacTeX is the
acceptance reference here.

## Visual Result

Before the change, TikZKit used `3r` canvas padding and `stdDeviation=r`.
The yellow rectangle and lavender circle shadows were visibly too broad and
too dark, and the TikZKit crop carried extra empty padding.

After the change, the JavaScript panel's shadow reaches roughly the same
finite extent as the MacTeX panel: it falls off just outside the rectangle
and circle rather than producing a large dark halo. The dimensions now remain
stable while the registered MacTeX comparison improves from 1307 changed
pixels (18.997%) / 0.02015 mean absolute RGBA to 778 (11.308%) / 0.01745.
This is a visible improvement, not just a numeric one.

The remaining difference is expected: MacTeX paints eight discrete fade
layers for this fixture while SVG uses a smooth Gaussian. tikztosvg also does
not match MacTeX's crop and halo exactly.

## Implementation And Verification

Changed:

- `src/renderers/svg/defs.js`
- `src/renderers/svg/bounds.js`
- `src/tikz/libraries/shadows.blur.js`
- `test/shadows-blur-radius.test.js`

Commands:

```bash
node --test test/shadows-blur-radius.test.js
npm run examples:render -- --manifest test/fixtures/examples/manifest.json \\
  --only shadows-blur-shadow-path \\
  --output /private/tmp/tikzkit-qa-shadows-blur-steps-after-2026-08-07 \\
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \\
  --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-shadows-blur-steps-after-2026-08-07 \\
  --register --alignment-radius 3
```

The focused regression passes and the visual fixture has no diagnostics.

## Coverage And Remaining Limits

Implemented and validated: `\\usetikzlibrary{shadows.blur}`, `blur shadow`,
`shadow blur radius`, the local default shift/opacity/scale behavior, and
ordinary node/path shadow rendering.

Accepted but not exact: `shadow blur steps`; it is retained during evaluation
but does not create PGF's discrete multiple-stroke profile in SVG.

Not implemented in this slice: `shadow blur invert`, `shadow blur extra
rounding`, exact fading masks, marker-tip shadows, form-only patterns, and
arbitrary TeX code in `every shadow`.
