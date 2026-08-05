# `shapes.multipart`: ignored rectangle-split parts

## Scope

This slice implements the PGF option `rectangle split ignore empty parts` for
horizontal `rectangle split` nodes. It is intentionally limited to logical
part removal, original-index fills, and bare part-anchor aliases; vertical
splits and non-centre part alignment are not included.

## Local PGF review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`

The shape source retains the text part even if empty. With `ignore empty parts`
enabled, later empty parts do not contribute width or separator lines; their
bare anchors reuse the previous part anchor. The manual explicitly notes that
this can reduce a requested three-part shape to two visible parts. Fills are
still selected from the original logical part list before empty parts are
skipped.

## Visual QA

Artifacts: `outputs/qa-shapes-multipart-ignore-empty/`

- MacTeX native PNG: `native-png/pgf-rectangle-split-ignore-empty.png`
- JS SVG/PNG: `tikzkit-svg/pgf-rectangle-split-ignore-empty.svg`, `tikzkit-png/pgf-rectangle-split-ignore-empty.png`
- tikztosvg SVG/PNG: `tikztosvg-svg/pgf-rectangle-split-ignore-empty.svg`, `tikztosvg-png/pgf-rectangle-split-ignore-empty.png`
- comparison sheet: `diff/pgf-rectangle-split-ignore-empty-sheet.png`

The PGF manual example deliberately draws an ordinary three-cell record next
to one with the option enabled. Before this fix TikZKit rendered the enabled
record as three cells, leaving a blank middle compartment. After the fix the
enabled record is visibly `text | third` in both TikZKit and tikztosvg; the
blue and green fills come from original parts one and three. The B-tree 2,
B-tree 3, and B-tree-small-2 corpus cases were regenerated as regression
checks and retain their existing compartment and arrow layouts.

## Validation

```sh
node --test test/shapes-multipart-ignore-empty.test.js
node --test --test-name-pattern='lays out horizontal rectangle split|uses rectangle split text origins|matches PGF horizontal split|preserves the inline TeX box spacing|keeps split-part anchors|optically centers rectangle split' test/interpreter.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output outputs/qa-shapes-multipart-ignore-empty --only pgf-rectangle-split-ignore-empty --preserve-output
node scripts/diff-example-pngs.js --output outputs/qa-shapes-multipart-ignore-empty
```

All seven existing split-node tests plus the dedicated new regression pass. The full `test/interpreter.test.js` suite currently
has pre-existing failures from unrelated in-progress coordinate and color work;
they are outside this slice.
