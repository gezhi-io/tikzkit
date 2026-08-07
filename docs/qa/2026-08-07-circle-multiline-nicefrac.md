# Multi-Line Nicefrac Circle QA

## Scope

This accepted slice changes one shared node-sizing behavior only: `circle`
nodes whose content is split across multiple math rows. The driver is the
`units` package's `\\nicefrac` content in the real
`hidden-markov-model-abc` and `hidden-markov-model-abc-2` fixtures. It does
not change ordinary math nodes, ellipse geometry, arrow tips, picture scaling,
or `units` text-mode spacing.

## Local MacTeX Reading

Reviewed locally on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex`:
  the `circle` shape starts with the TeX text-box half width plus `inner xsep`
  and the half height/depth span plus `inner ysep`, then takes their Euclidean
  norm for the radius. It applies minimum dimensions after that construction.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`:
  ordinary node shape dimensions are not picture-scaled unless `transform
  shape` is active; only placement transforms with the picture.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/units/units.sty`:
  `units` loads `nicefrac`, uses tight `\\,` spacing for its optional value,
  and delegates math-mode `\\unitfrac` to upright `\\nicefrac` content.

The implementation now deliberately uses the calibrated TeX-row metric path
for this circle family. The SVG text engine still paints the visible fraction
glyphs, but its wider renderer line box is not allowed to determine the PGF
circle radius.

## Commands And Parameters Exercised

The two real fixtures use `\\usepackage{units}`, `\\usepackage{ifthen}`,
`\\usetikzlibrary{calc}`, `\\tikzstyle`, `\\begin{tikzpicture}[scale=2.5]`,
named `\\node`s, `circle`, `draw`, `fill=gray!10`, `align=left`,
`minimum size=10pt`, `inner sep=0pt`, `label=below:$x$`, three `\\nicefrac`
math rows, `edge`, `loop above`, `looseness=5`, `thick`, and `->`.

Implemented in this slice: multi-line math circle sizing through the same
packed TeX row metrics used by the fallback text model. Still outside the
slice: arbitrary TeX font/package metrics, text-mode `units` spacing, loose
units options, and exact native fraction glyph/line-box behavior.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its PNG references
were rasterized with local `rsvg-convert`. The inspected final bundle is:

`outputs/qa-circle-multiline-nicefrac-2026-08-07-final/`

It contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, registered diffs,
and four-panel sheets for both drivers. In particular, inspect:

- `diff/latex-examples-hidden-markov-model-abc-native-sheet.png`;
- `diff/latex-examples-hidden-markov-model-abc-2-native-sheet.png`.

The tikztosvg SVG encodes each native node as a cubic circle path with a
21.465pt radius, `stroke-width="0.3985"`, and a placement transform. TikZKit
emits an SVG `ellipse` plus nested `tspan` elements for the raised numerator,
solidus, and script-sized denominator. That structure made the mismatch clear:
the renderer's math measurement was wider than the TeX box even though it
painted the same content.

Before this change, the browser-rendering path sized each `abc-2` circle to
`1.571747cm`. It now sizes it to `1.524889cm`; the native tikztosvg path has a
`42.93pt` (`1.508817cm`) diameter. Visually, the three circles now sit tightly
around their three fraction rows, the between-node arrows span the native-like
gap, and the loop arrows start closer to the top borders. The remaining visible
difference is in the fraction glyphs and baseline placement, not the circle
envelope. For `abc-2`, the registered TikZKit-to-MacTeX residual improved from
`0.15699` changed pixels / `0.04137` mean absolute RGBA to `0.13410` /
`0.02863`; these values support, but do not replace, the inspected panels.

## Verification

Passed:

```bash
node --test test/circle-multiline-nicefrac.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-hidden-markov-model-abc,latex-examples-hidden-markov-model-abc-2 \
  --output outputs/qa-circle-multiline-nicefrac-2026-08-07-final \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-circle-multiline-nicefrac-2026-08-07-final \
  --register --alignment-radius 3
```

No diagnostics were added for either real fixture. The full suite is not the
acceptance gate for this narrow slice because it contains unrelated pre-existing
visual baselines; the focused regression and inspected three-way artifacts are
the gate here.

## Remaining Work

Exact native `nicefrac` glyph metrics and baseline/crop parity remain partial,
as do arbitrary multi-line TeX macro boxes. A future text-engine pass should
provide authoritative TeX box metrics generally, so this calibrated circle
branch can be generalized without using browser/SVG measurement for geometry.
