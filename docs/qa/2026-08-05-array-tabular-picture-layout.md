# Array Tabular Picture Layout QA

## Scope

This slice implements document-level `tabular` layout for cells containing one
or more `tikzpicture` environments. It is intentionally limited to the common
`l`, `c`, and `r` column specifiers, internal `|` rules, `\hline`, explicit
empty rows, and plain cell text. The driving case is
`latex-examples-b-tree-3-evolution`.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tools/array.sty`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx`

`array.sty` defines `\tabular` as an `\hbox` with `\tabcolsep`, then delegates
to `\@array`. `latex.ltx` builds an alignment preamble with a strut box and
uses `\@arraycr` / `\@tabularcr` for row termination. The important rendering
consequences are: measure every cell before assigning a column width, center
`c` cells within that width, preserve an explicit short row after `\hline`,
and paint `|` as a continuous rule rather than as content in a cell.

## Implementation

- `src/frontend/parser.js` records `tabularLayouts` in the TikZ document AST;
  each picture keeps a row/column reference without learning any SVG details.
- `src/engine/evaluate.js` evaluates every table picture in its own local scene,
  measures the scene bounds, calculates TeX-like column and row boxes, then
  translates items into one document scene. It renders horizontal and vertical
  table rules as ordinary scene paths.
- `test/tabular-picture-layout.test.js` uses the complete B-tree fixture as the
  regression fixture.

Implemented source features in this case:

`\begin{tabular}{c|c}`, `\end{tabular}`, `&`, `\\`, `\hline`, nested
`tikzpicture`, `rectangle split`, nested inline `\tikz \node`, `nodepart`,
and ordinary text with inline math (`$\rightarrow$`).

Still outside this slice: `p/m/b` columns, `@{...}`, `>{...}`, `<{...}`,
`\multicolumn`, `\multirow`, row-height arguments such as `\\[6pt]`,
`tabular*`, and full TeX baseline/crop semantics across remembered pictures.

## Visual Artifacts

Artifacts are in `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-btree-evolution-final/`.

- MacTeX native PNG:
  `mactex-png/latex-examples-b-tree-3-evolution.png`
- TikZKit SVG/PNG and 1cm-grid SVG/PNG:
  `tikzkit-svg/latex-examples-b-tree-3-evolution.svg`,
  `tikzkit-grid-png/latex-examples-b-tree-3-evolution.png`
- Native-vs-JS sheet and raster diff:
  `diff/latex-examples-b-tree-3-evolution-native-vs-tikzkit-sheet.png`,
  `diff-png/latex-examples-b-tree-3-evolution-native-vs-tikzkit.png`
- tikztosvg source and diagnostic log:
  `tikztosvg-input/latex-examples-b-tree-3-evolution.tex`,
  `tikztosvg-log/latex-examples-b-tree-3-evolution.log`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and `rsvg-convert` at
`/opt/homebrew/bin/rsvg-convert`. The normal wrapper and a `--pdflatex` retry
both fail before SVG generation on this nested-picture tabular source with
`Missing \endgroup inserted`; therefore no tikztosvg SVG/PNG or tikztosvg diff
exists for this case. MacTeX `pdflatex` succeeds and is the layout reference.

Before the fix, TikZKit emitted all eight pictures as one horizontal strip,
showed `\hline` literally, and placed `Node is full -> first split node` in the
strip. After the fix it has the native two-column, five-content-row table with
three rules, the separating vertical rule, the descriptive row, and both
bottom split diagrams. The final SVG is `399.59pt x 230.96pt`; the MacTeX PDF
is `398.49pt x 231.38pt`. The remaining red pixels in the native-vs-JS sheet
are anti-aliasing and small local raster offsets, not missing table structure.

## Verification

```sh
node --test test/tabular-picture-layout.test.js
npm run examples:render -- --fixtures test/fixtures/examples --output outputs/qa-btree-evolution-final --only latex-examples-b-tree-3-evolution --native-reference --comparison-grid-mode svg --external-timeout-ms 120000
node scripts/diff-example-pngs.js --output outputs/qa-btree-evolution-final
```

The regression tests pass. The rendering run has zero TikZKit diagnostics.
The final diff script correctly records the third-party reference as missing
because tikztosvg failed; that limitation is not marked as acceptance of a
visually complete third-party comparison.
