# QA: `shapes.arrows` single/double geometry

## Scope

This slice implements the shared geometry for `single arrow` and `double
arrow` nodes. It deliberately covers one coherent family: physical
`minimum height`, transverse `minimum width`, `tip angle`, `head extend`,
`head indent`, polygon drawing, border clipping, and the associated named
anchors. It does not claim `arrow box` or all `shapes.arrows` options.

## Local PGF Reading

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshapes.arrows.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.arrows.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`

The PGF definition treats `minimum height` as the longitudinal arrow size and
`minimum width` as the transverse size. Before applying the longitudinal
minimum, a transverse minimum rescales the shaft half-height, arrow shoulder,
and tip extension together. `head indent` then moves only the shaft/head join
toward the tip. The single arrow is anchored around the text box rather than
being a symmetric polygon, while the double arrow has two symmetric tips.

TikZKit now calculates those source-derived points once in the interpreter and
passes the same record to the SVG renderer and named-anchor/border logic.

## Third-Party SVG Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` is at
`/opt/homebrew/bin/rsvg-convert`. The permanent real driver is
`test/fixtures/examples/shapes/arrows-single-double.tex`.

Artifacts:

- Before: `/private/tmp/tikzkit-qa-shapes-arrows-before-2026-08-07/`
- After: `/private/tmp/tikzkit-qa-shapes-arrows-after-2026-08-07/`
- Four-panel native sheet: `/private/tmp/tikzkit-qa-shapes-arrows-after-2026-08-07/diff/shapes-arrows-single-double-native-sheet.png`

Both runs produced TikZKit SVG/PNG, tikztosvg SVG/PNG, native MacTeX PNG, and
the comparison sheet without external failures or fixture diagnostics.

## Visual Result

Before the change, TikZKit made the single arrow symmetric around its text.
Its tail was too far left, its tip too short, and the vertical red
`before tip`/`after tip` measurement did not lie on the native arrow shoulder.
The double arrow also used the wrong body/shoulder proportions.

After the change, the TikZKit panel and both reference panels share the single
arrow tail at about `-1.34cm`, the single-arrow tip at about `1.66cm`, and the
double-arrow tips at `-1.5cm` and `1.5cm`. The rendered shoulder and head
indent now visibly coincide with the reference. Remaining red pixels in the
sheet are primarily Computer Modern browser-font rasterization and small
stroke antialiasing differences, not displaced arrow geometry. The raw pixel
score is only supporting evidence: the native comparison changed from 5385 to
5172 pixels because the corrected non-symmetric arrow moves paint into the
right native locations while text rasterization remains unresolved.

## Implementation And Verification

Changed:

- `src/engine/evaluate.js`
- `src/renderers/svg/nodeShapes.js`
- `src/tikz/libraries/shapes.arrows.js`
- `test/interpreter.test.js`
- `test/fixtures/examples/shapes/arrows-single-double.tex`
- `test/fixtures/examples/manifest.json`
- `README.md`

Commands:

```bash
node --test --test-name-pattern="PGF shapes.arrows" test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-shapes-arrows-after-2026-08-07 \
  --only shapes-arrows-single-double --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-shapes-arrows-after-2026-08-07
npm run extension-registry
```

The focused semantic regression passes. The fixture was rendered and visually
inspected against both local references. The broad `test/interpreter.test.js`
file still contains unrelated pre-existing color-normalization failures, so
this QA records only the focused result rather than claiming the entire file
is green.

## Remaining Limits

`arrow box`, arbitrary radial border-anchor behavior, full outer-separation
and rotation parity, complete text-box metrics, and every source key in
`shapes.arrows` remain partial. The next slice should validate rotation plus
outer separation with a separate real fixture rather than broadening this one
without a native visual driver.
