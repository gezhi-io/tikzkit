# Matrix Scoped Text-Width QA

## Scope

One shared layout slice only: a `text width` node whose individual source lines have different font scales, as in the `Enum` cell in `latex-examples-haskell-type-classes`. The change is not specific to Haskell or to ellipses: it changes the node text metric input used by all non-circular text-width nodes with scoped line-size declarations.

## Local PGF Reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarymatrix.code.tex`: matrix cells are ordinary TikZ nodes, and row/column spacing is based on their node boxes.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`: ellipse radii begin with half the text-box width/height plus inner separation, then use the `sqrt(2)` radius construction before outer separation.

The implication is important: a line scoped with `\small` must be wrapped and measured at its own scale before the matrix cell box is used in ellipse and matrix layout.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used local `rsvg-convert` at `/opt/homebrew/bin/rsvg-convert`.

Before artifacts: `/private/tmp/tikzkit-qa-haskell-before`.

After artifacts: `/private/tmp/tikzkit-qa-haskell-after`.

The after directory contains MacTeX PNG, tikztosvg SVG/PNG, TikZKit SVG/PNG, both 1cm-grid renderings, a pixel diff, and the inspected four-panel sheet:

`/private/tmp/tikzkit-qa-haskell-after/diff/latex-examples-haskell-type-classes-native-sheet.png`.

## Visual Result

Before the fix, TikZKit wrapped `Enum` as if its `\small` body used the normal font scale while calculating the node box. Its ellipse half-height was `136.27` renderer units. tikztosvg's shape path gives a `31.38pt` half-height, equivalent to about `110.7` TikZKit renderer units.

After the fix, TikZKit first wraps each source line at the line's own scale, then measures those physical lines without feeding `text width` to the text engine a second time. The JS `Enum` half-height is `107.23` renderer units. The next matrix rows move to the same relative region as the tikztosvg rows, so their ellipse boundaries and the twelve directed edge endpoints visibly no longer inherit the old oversized `Enum` cell.

The raw PNG comparison is still a dimension mismatch: TikZKit is `521x402px`, tikztosvg is `531x417px`. The changed-pixel ratio changes from `21.13%` before to `21.74%` after because the outer canvas crop shifts; it is not used as the acceptance signal. The inspected geometry is the acceptance signal for this slice.

## Supported Source Surface

- `\matrix`, `row sep`, `column sep`, named matrix-cell anchors, and inherited `nodes={...}` options.
- `text width`, `align=center`, explicit `\\` line breaks, `\textbf`, and scoped `\small` line metrics.
- `ellipse`, `draw`, `fill`, `thick`, and arrow endpoints derived from the corrected node box.

Still partial: arbitrary TeX paragraph shaping, exact TeX leading/depth for every font declaration, complex nested inline math in a wrapped paragraph, and the full PGF shapes/matrix option families.

## Verification

```sh
node --test test/text-package-macros.test.js test/matrix-layout-spacing.test.js
npm run examples:render -- --fixtures test/fixtures/examples --output /private/tmp/tikzkit-qa-haskell-after --only latex-examples-haskell-type-classes --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-haskell-after
```

All focused tests pass and the example renders with zero diagnostics.
