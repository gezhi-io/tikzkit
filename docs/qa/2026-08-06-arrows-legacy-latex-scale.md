# Legacy `latex` versus `arrows.meta` `Latex`

## Scope

This slice corrects a shared arrow semantic: lower-case core PGF `latex` is
not the same arrow tip as capitalized `arrows.meta` `Latex`. It implements the
core tip's line-width-derived curve and prevents the meta-only `scale` key
from inflating it. It deliberately does not change declaration parsing,
composite tips, or any legend/text layout.

The new minimal regression source is
`test/fixtures/arrows/legacy-latex-vs-meta-latex.tex`; it draws
`latex[scale=3]` above `Latex[scale=3]` at the same `very thick` line width.
The real driver is
`test/fixtures/examples/latex-examples/2d-epochs-overfitting.tex`, whose
`overfitting` annotation uses:

```tex
\draw[-{latex[scale=3.0]}, very thick] (axis cs:51,0.15) -- (axis cs:90,0.15);
```

## Local MacTeX Study

Read these TeX Live 2025 source files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`,
  lines 1198-1228: core `latex` calculates
  `d = .28pt + .3 * linewidth`, declares a right extent of `9d`, and draws a
  filled two-cubic arrow from `9d` to `-d`. It exposes no `scale` key.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`,
  lines 806-896: `Latex` is a different configurable tip, with defaults
  `length=+3pt 4.5 .8`, `width'=+0pt .75`, and an outline capped at one fifth
  of its computed length.

The implementation therefore preserves source casing through the arrow IR:
small `latex` uses the core curve and fill; capital `Latex` retains the
existing `arrows.meta` geometry and `scale` processing.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

- Baseline minimal fixture:
  `/private/tmp/tikzkit-qa-legacy-latex-identity-baseline-2026-08-06/`
- Corrected minimal fixture:
  `/private/tmp/tikzkit-qa-legacy-latex-identity-after-2026-08-06/`
- Corrected real case:
  `/private/tmp/tikzkit-qa-decorations-text-overfitting-after-legacy-latex-2026-08-06/`

Inspected comparison sheets:

- `/private/tmp/tikzkit-qa-legacy-latex-identity-after-2026-08-06/diff/legacy-latex-vs-meta-latex-native-sheet.png`
- `/private/tmp/tikzkit-qa-decorations-text-overfitting-after-legacy-latex-2026-08-06/diff/latex-examples-2d-epochs-overfitting-native-sheet.png`

The tikztosvg SVG uses ordinary `path` elements with `fill-rule=nonzero`,
`stroke-linecap=butt`, and `stroke-linejoin=miter`; the core annotation tip is
a compact filled cubic path, whereas its axis/curve lines remain stroked
paths. There are no SVG markers or `foreignObject`s involved in the arrow.

## Visual Result

Before, TikZKit lower-cased all arrow names and rendered both lines in the
minimal fixture as the large, outlined `Latex[scale=3]` geometry. In the real
overfitting example that made the annotation arrow visibly too long and too
wide.

After, the upper core `latex[scale=3]` is the short filled curve seen in
MacTeX and tikztosvg, while the lower capitalized `Latex[scale=3]` remains the
large outlined arrow. The real annotation now has the native small arrowhead;
its plot curves, decoration text, and axis geometry are unchanged. The
TikZKit/MacTeX diff's changed-pixel ratio fell from `11.69%` to `11.51%` for
the unregistered raster comparison; that measurement is auxiliary, while the
arrow-size correction is visually clear.

## Implemented Surface

- `\draw[-latex]` and `\draw[-{latex[scale=...]}`: core PGF lower-case
  filled curve with `d=.28pt+.3*linewidth`; `scale` is ignored.
- `\draw[-Latex]` and `\draw[-{Latex[scale=...]}`: existing arrows.meta
  line-width-aware outline, including scaled geometry.
- `thick`, `very thick`, and explicit `line width`: affect both paths through
  their documented line-width formulas.

Still partial: arbitrary arrows.meta keys/composite tips, legacy double-line
and inner-line arrow rules, setup-code arithmetic inside user declarations,
and the unrelated long-legend text measurement/crop seen in the real driver.

## Verification

```bash
node --test --test-name-pattern='renders TikZ arrow tips as inline paths and shortens stroked path endpoints|uses the arrows.meta Latex geometry for thick paths|applies Latex tip scale after deriving its PGF line-width geometry|keeps classic latex distinct from arrows.meta Latex' test/renderer.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/arrows --output /private/tmp/tikzkit-qa-legacy-latex-identity-after-2026-08-06 --only legacy-latex-vs-meta-latex --native-reference --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
node scripts/render-example-fixtures.js --output /private/tmp/tikzkit-qa-decorations-text-overfitting-after-legacy-latex-2026-08-06 --only latex-examples-2d-epochs-overfitting --native-reference --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
```

The four focused regression tests pass; all native, TikZKit, tikztosvg, PNG,
grid, diff, and sheet artifacts were generated and visually inspected. The
full renderer suite still has unrelated baseline failures in math fallback,
text wrapping, and viewBox calibration, so this scoped acceptance does not
claim that the complete renderer suite is green.
