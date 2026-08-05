# `arrows.meta` Local-Source Audit Resolution

## Scope

This change improves the semantic-audit path for PGF-backed TikZ libraries. It
does not tune arrow coordinates for a single fixture. The driving real case is
`test/fixtures/examples/latex-examples/feed-forward-perceptron.tex`, which uses
`\\usetikzlibrary{arrows,arrows.meta}` and the style
`arrows={{Latex[scale=0.5]}-}, thick`.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`

The `Latex` tip is declared by PGF with line-width-dependent dimensions:
`length=+3pt 4.5 .8`, `width'=+0pt .75`, and a stroke outline capped at one
fifth of the calculated arrow length. TikZKit already applies that geometry in
`src/tikz/metrics.js` for `Latex[scale=...]`; the audit previously lost this
library's declared source path because `arrows.meta` is implemented in a PGF
file, not a `tikzlibraryarrows.meta.code.tex` file.

## Artifacts And Visual Review

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and run with XeLaTeX.
The following local artifacts were generated and inspected together:

- MacTeX PNG: `outputs/qa-feed-forward-perceptron/mactex-png/latex-examples-feed-forward-perceptron.png`
- TikZKit SVG/PNG: `outputs/qa-feed-forward-perceptron/tikzkit-svg/latex-examples-feed-forward-perceptron.svg` and `outputs/qa-feed-forward-perceptron/tikzkit-png/latex-examples-feed-forward-perceptron.png`
- tikztosvg SVG/PNG: `outputs/qa-feed-forward-perceptron/tikztosvg-svg/latex-examples-feed-forward-perceptron.svg` and `outputs/qa-feed-forward-perceptron/tikztosvg-png/latex-examples-feed-forward-perceptron.png`
- Four-panel sheet: `outputs/qa-feed-forward-perceptron/diff/latex-examples-feed-forward-perceptron-native-sheet.png`

The real-case comparison shows the same five input nodes, three hidden nodes,
two bias nodes, output node, all 19 edges, and outward-facing small Latex tips.
There is no visible missing or displaced element to repair. The residual image
difference is limited to SVG/raster antialiasing around tips and circular node
boundaries, so no geometry change was made just to optimize a scalar diff.

## Supported Slice

Verified in this case:

- `\\usetikzlibrary{arrows,arrows.meta}` source resolution
- `\\tikzstyle` declarations and reuse
- nested `\\foreach` expansion with source-local `\\dist`
- circle nodes with fill, `minimum size`, and `inner sep`
- `\\draw ... edge[...] (...)`
- `arrows={{Latex[scale=0.5]}-}` and `thick`

The general `arrows` library and the complete `arrows.meta` key space remain
partial. The audit correctly remains `incomplete` until every command, option,
declaration, number, and case review is explicitly accepted; it now has zero
false missing-source blockers for `arrows.meta`.

## Validation

Passed:

```text
node --test test/case-semantic-audit.test.js
node --test --test-name-pattern='Latex geometry|Latex tip scale|named tip families' test/renderer.test.js
npm run case:audit -- test/fixtures/examples/latex-examples/feed-forward-perceptron.tex ...
```

The full `test/renderer.test.js` was also sampled and still contains unrelated
pre-existing exact text-wrap and bounding-box expectation failures. Those are
not claimed as resolved by this audit-metadata change.
