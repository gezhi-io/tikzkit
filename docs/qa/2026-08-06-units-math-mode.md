# units Math-Mode Commands

## Scope

This slice implements the default `tight` math-mode forms of `\unit` and
`\unitfrac` from the LaTeX `units` package. It deliberately excludes text-mode
spacing and the package's `loose` option.

## MacTeX Reference

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/latex/units/units.sty`.
`\unit` tests whether its optional value is empty, then emits the value, a thin
space in the default tight mode, and `\mathrm{...}` in math mode. `\unitfrac`
uses the same optional-value rule and delegates its numerator and denominator
to `\nicefrac[\mathrm]{...}{...}` in math mode.

## Implemented Syntax

- `\unit[12]{m}` renders as `12` followed by a thin space and upright `m`.
- `\unitfrac[36]{km}{h}` renders as `36` followed by a thin space and an
  upright raised `km/h` fraction.
- `\unitfrac{m}{s^2}` renders an upright `m/s^2` fraction without a leading
  value or spacing token.

## Visual QA

Fixture: `test/fixtures/examples/units/math-mode-units.tex`.

Artifacts are in `/private/tmp/tikzkit-qa-units-math-mode-2026-08-06-r2`:

- TikZKit SVG/PNG: `tikzkit-svg/units-math-mode-units.svg` and
  `tikzkit-grid-png/units-math-mode-units.png`.
- tikztosvg SVG/PNG: `tikztosvg-svg/units-math-mode-units.svg` and
  `tikztosvg-grid-png/units-math-mode-units.png`.
- MacTeX PNG: `mactex-png/units-math-mode-units.png`.
- JS versus tikztosvg sheet: `diff/units-math-mode-units-sheet.png`.
- JS versus MacTeX sheet: `diff/units-math-mode-units-native-sheet.png`.

Before this change, the browser fallback visibly printed the control-sequence
names and their bracketed arguments. After the change, all three rows render
actual values, upright units, and compact fractions. The JS fraction is built
from SVG `tspan` elements with a raised numerator, solidus, and lowered
denominator. tikztosvg instead outlines TeX glyphs as paths under a flipped
matrix transform, so its SVG has no browser text elements. The remaining
pixel diff is mostly font rasterization and the fallback fraction's exact
metrics, not missing commands or glyphs.

## Validation

```text
node --test test/text-package-macros.test.js
npm run gallery:audit -- --only units-math-mode
npm run examples:render -- --fixtures test/fixtures/examples --output /private/tmp/tikzkit-qa-units-math-mode-2026-08-06-r2 --only units-math-mode-units --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-units-math-mode-2026-08-06-r2 --only units-math-mode-units
```

All commands completed successfully. The PNG diff remains nonzero because the
browser text renderer and TeX outline renderer use different glyph geometry.
