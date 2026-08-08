# PGFPlots Bare Axis-Description Label Bbox

## Boundary

This slice covers a shared PGFPlots behavior: on a middle-axis plot,
`x/y label style={at={(u,v)}}` uses normalized axis-description coordinates,
and a plain-text y-label contributes its measured node box to the SVG crop.
It deliberately does not claim full PGFPlots label compatibility.

The driving real fixtures are:

- `test/fixtures/examples/latex-examples/2d-epochs-overfitting.tex`
- `test/fixtures/examples/latex-examples/2d-light-bulb.tex`

## Local MacTeX Review

Reviewed `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`.
The axis-description coordinate transform maps normalized description fractions
independently of the data transform. The same file installs `xlabel near ticks`
and `ylabel near ticks` as description-node styles. That means an explicit
bare numeric `at={(u,v)}` is not a data coordinate and should not require a
generic fixed axis frame reserve: the placed TikZ node owns its own bounding box.

The old TikZKit behavior recognized only `axis description cs:...` for that
rule, then attached a static `.48/.492/.23/.618cm` middle-axis gutter for a
top-positioned y-label. It produced either an empty frame or an inadequate
long-label crop. The replacement recognizes both forms and computes the extra
plain-glyph width from the same measured text used by rendering.

## Third-Party Reference and Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- `rsvg-convert`: `/opt/homebrew/bin/rsvg-convert`
- MacTeX native PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, registered diffs, and
  one-centimetre grids: `outputs/qa-pgfplots-y-label-style-2026-08-08/after-label-bbox/`
- Pre-fix comparison: `outputs/qa-pgfplots-y-label-style-2026-08-08/before/`

`tikztosvg` emits normal SVG text/path structure with the label's text node
participating in its viewBox. Its rendered content tracks MacTeX closely here;
the remaining vertical size difference is a blank `dvisvgm` crop allowance,
not a missing painted element.

## Visual Result

| Fixture | Before | After | Residual |
| --- | --- | --- | --- |
| `2d-epochs-overfitting` | static middle-axis gutter created a visibly empty frame around a short `ylabel` | TikZKit is `523x269px`, tikztosvg is `522x272px`; axis, grid, curves, arrowheads, legend and label stay present | registered pixel difference remains mostly text rasterization, line antialiasing, and 3px blank crop height |
| `2d-light-bulb` | long `Amortization time\\in h` label did not have a matching expanded node bbox | TikZKit's SVG width is `397.94pt`, in the reference `397.2..398.5pt` range; the long label and legend both stay inside the crop | TikZKit is `536x277px` versus reference `536x280px`; the 3px difference is blank native vertical crop space |

The four-up sheets were inspected directly. They show no missing axis line,
grid run, curve, legend row, arrow tip, or y-label after the change. Diff
numbers are supporting evidence only, not the acceptance criterion.

## Reproduction

```bash
node --test --test-name-pattern='light bulb fixture|bare axis-description label coordinates' \
  test/pgfplots-seams.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --only 'latex-examples-2d-epochs-overfitting,latex-examples-2d-light-bulb' \
  --output outputs/qa-pgfplots-y-label-style-2026-08-08/after-label-bbox \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg

npm run examples:diff -- --output outputs/qa-pgfplots-y-label-style-2026-08-08/after-label-bbox \
  --register --alignment-radius 3
```

The focused regression passes. The complete `test/pgfplots-seams.test.js`
suite still has unrelated 3D/tick/legend exact-geometry failures; this slice
does not mark PGFPlots as complete.

## Remaining Work

- Math labels and arbitrary TeX templates still need their own rendered bbox path.
- Scoped font overrides, `axis description cs` expressions, and multiline TeX
  node layout are not covered by this plain-text correction.
- Matching native blank crop allowances would be page-crop emulation, not a
  geometry fix, and remains intentionally out of scope.
