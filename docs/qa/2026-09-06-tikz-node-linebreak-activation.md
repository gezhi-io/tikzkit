# TikZ Node Line-Break Activation

## Scope

This severe-gap slice covers one shared core-TikZ rule: a double-backslash in
ordinary node text creates a new row only when TikZ node alignment is active.
The real driver is `latex-examples-inverse-function`, whose unaligned
`{1\\2\\3}` and `{a\\b\\c}` nodes were incorrectly rendered as tall stacks.

The accepted boundary includes ordinary nodes, inline path nodes, labels, and
pins; `align=left`, `align=right`, `align=center`, the flush and justify
variants, `text width`, `node halign header`, and `align=none`; optional starred
or dimensioned double-backslashes; and preservation of row separators inside
matrix, array, cases, aligned, tabular, minipage, shortstack, parbox, and
makecell content. It does not claim a complete TeX paragraph engine, custom
halign-token execution, or exact browser glyph rasterization.

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
around lines 1132-1183 and 4210-4265. `/tikz/node halign header` is empty by
default. The `align` styles install a nonempty header, and the node scanner
redefines the double-backslash command only when fixed-width or explicit
alignment processing is active. `align=none` restores an empty header.

Reviewed
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex`
around lines 873-920 and 946-1075. The manual explicitly limits node line
breaks to nodes with `align` or `text width`; standard structured environments
retain their own row grammar.

## Visual References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. MacTeX used
`/Library/TeX/texbin/pdflatex`, and SVG rasterization used
`/opt/homebrew/bin/rsvg-convert`. The complete post-fix artifacts are in:

- `outputs/qa/2026-09-06-node-linebreak-activation-after/`
- `tikztosvg-svg/latex-examples-inverse-function.svg`
- `tikztosvg-png/latex-examples-inverse-function.png`
- `mactex-png/latex-examples-inverse-function.png`
- `tikzkit-svg/latex-examples-inverse-function.svg`
- `tikzkit-png/latex-examples-inverse-function.png`
- `diff/latex-examples-inverse-function-native-sheet.png`
- `diff/latex-examples-inverse-function-sheet.png`

Before the fix, TikZKit stacked `1`, `2`, `3` and `a`, `b`, `c` vertically,
making both ellipses substantially taller and moving the curved connector
endpoints. MacTeX and tikztosvg both paint `123` and `abc` in one horizontal
hbox. After the fix, TikZKit has the same short equal-height ellipses, centered
single-line text, curved arrows, arrowheads, and side decoration labels.
Remaining visible pixels are limited to browser-versus-Type-1 glyph shape and
minor crop/antialiasing differences.

The tikztosvg SVG uses glyph-path `<use>` elements under a flipped transform,
whereas TikZKit keeps selectable SVG text. Both now share the same node text
topology and geometry; this confirms the behavior belongs in node evaluation,
before text measurement and SVG rendering.

## Implementation And Verification

- `src/tikz/commands/node.js` centralizes line-break activation and protects
  math or structured environments from ordinary-node normalization.
- `src/engine/evaluate.js` applies the rule before measuring and painting
  ordinary nodes, inline nodes, labels, and pins while leaving matrix-node
  parsing untouched.
- `test/renderer.test.js`, `test/svg-renderer.test.js`, and
  `test/case-by-case-acceptance.test.js` cover direct semantics, explicit
  multiline opt-in, font restoration, and the real inverse-function fixture.

The focused tests pass, the fixture renders successfully through TikZKit,
MacTeX, and tikztosvg, and the TikZKit diagnostic list remains empty.
