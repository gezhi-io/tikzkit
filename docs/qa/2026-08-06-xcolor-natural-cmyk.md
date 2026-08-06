# xcolor Natural CMYK Defaults

## Scope

This accepted slice corrects one shared `xcolor` behavior only: the natural
CMYK models of the default `cyan`, `magenta`, `yellow`, and `olive` colors,
including their normal `!` mixes such as `cyan!50!black`. It does not attempt
all `xcolor` target models or declarations.

The work is driven by `xcolor-natural-cmyk` and the real user-reviewed
`latex-examples-csv-2d-gaussian-multivarate-distributions` scatter plot. The
latter uses `cyan!50!black` for one class of points, so this is a color-model
fix rather than a case-specific style override.

## Local TeX Reading

- `/usr/local/texlive/2025/texmf-dist/tex/latex/graphics/color.sty`, lines
  188-195: default `red`, `green`, and `blue` are RGB, while `cyan`,
  `magenta`, and `yellow` are declared in CMYK.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/xcolor/xcolor.sty`, lines
  1434-1450: `cyan`, `magenta`, `yellow`, and `olive` carry CMYK natural
  definitions alongside conversion forms. xcolor mixes source-model channels
  before converting the final paint color.

The implementation keeps that source model through `!` mixing, then uses the
existing DeviceCMYK-to-SVG conversion. For example, `cyan!50!black` is CMYK
`[0.5, 0, 0, 0.5]`, which becomes SVG `rgb(73 118 141)`; it is not an RGB
half-mix of browser cyan and black.

## Artifacts

- TikZKit SVG/PNG:
  `/private/tmp/tikzkit-qa-xcolor-natural-cmyk-2026-08-06/tikzkit-svg/`
  and `/private/tmp/tikzkit-qa-xcolor-natural-cmyk-2026-08-06/tikzkit-png/`
- `tikztosvg` SVG/PNG, generated with
  `/Library/TeX/texbin/tikztosvg` and rasterized by
  `/opt/homebrew/bin/rsvg-convert`:
  `/private/tmp/tikzkit-qa-xcolor-natural-cmyk-2026-08-06/tikztosvg-svg/`
  and `/private/tmp/tikzkit-qa-xcolor-natural-cmyk-2026-08-06/tikztosvg-png/`
- MacTeX native PNG:
  `/private/tmp/tikzkit-qa-xcolor-natural-cmyk-2026-08-06/reference-native-png/`
- Inspected four-way sheets:
  `/private/tmp/tikzkit-qa-xcolor-natural-cmyk-2026-08-06/diff/xcolor-natural-cmyk-native-sheet.png`
  and
  `/private/tmp/tikzkit-qa-xcolor-natural-cmyk-2026-08-06/diff/latex-examples-csv-2d-gaussian-multivarate-distributions-native-sheet.png`

## Visual Result

Before the correction, TikZKit rendered `cyan!50!black` as bright RGB teal
(`rgb(0 128 128)`), so the 2,500 cyan-class scatter marks visibly disagreed
with MacTeX and `tikztosvg`'s muted blue-gray. The same error affected the
natural magenta, yellow, and olive families.

After the correction, the eight calibration swatches -- each base color and
its `!50!black` variant -- have a zero-pixel TikZKit-versus-MacTeX comparison.
The real scatter plot's lower point cloud is now blue-gray and matches the
native/tikztosvg hue. Its remaining visible differences are pre-existing text
metrics, tick layout, and antialiasing; this color slice does not claim to
resolve those separate PGFPlots/font issues.

## Supported and Deferred Syntax

Supported in this slice:

- Natural CMYK defaults: `cyan`, `magenta`, `yellow`, `olive`.
- Normal color-mix syntax using those colors, for example
  `cyan!50!black` and `olive!25!white`.
- Existing `HTML`, `rgb`, `RGB`, and `gray` definitions and scoped `\color`
  behavior remain unchanged.

Deferred: `\selectcolormodel`, color series, masks, arbitrary target-model
conversion controls, and arbitrary model-qualified `\color[model]{...}`.

## Verification

```bash
npm test -- test/options.test.js test/pgfplots-csv-overlay.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-xcolor-natural-cmyk-2026-08-06 \
  --only xcolor-natural-cmyk \
  --only latex-examples-csv-2d-gaussian-multivarate-distributions \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-xcolor-natural-cmyk-2026-08-06 \
  --register --alignment-radius 3
```

The focused test suite passes. The calibration fixture has no JavaScript or
native pixel difference, and both inspected real-case panels retain zero new
diagnostics.
