# Array Top-Level Tabular QA

## Scope

This review covers the array and LaTeX tabular slice used by
latex-examples/cache-4-way-associative.tex: a two-column |l|l| table with an
initial rule, a double rule below the header, a final rule, two tikzmark
anchors, and a brace overlay.

It does not claim general table support. p/m/b columns, arbitrary preambles,
multicolumn, multirow, nested tables, and full cross-picture remember-picture
bounding-box semantics are outside this slice.

## Local Implementation Reading

Reviewed /usr/local/texlive/2025/texmf-dist/tex/latex/tools/array.sty.
The package augments LaTeX alignment preambles: @mkpream consumes column
specifiers and rule tokens, while ordinary tabular remains the horizontal
alignment wrapper. The renderer therefore preserves only the observed
cell/rule geometry, rather than claiming a full array.sty preamble engine.

## Artifacts

- MacTeX native PNG:
  outputs/qa-array-current/mactex-png/latex-examples-cache-4-way-associative.png
- TikZKit before:
  outputs/qa-array-current/tikzkit-grid-png/latex-examples-cache-4-way-associative.png
- TikZKit after:
  outputs/qa-array-after/tikzkit-grid-png/latex-examples-cache-4-way-associative.png
- TikZKit SVG:
  outputs/qa-array-after/tikzkit-svg/latex-examples-cache-4-way-associative.svg

tikztosvg was found at /Library/TeX/texbin/tikztosvg and attempted with both
XeLaTeX and pdfLaTeX. Its generated standalone wrapper fails at the fixture's
inline tikzmark with Missing endgroup inserted, before SVG generation. The
failure log is
outputs/qa-array-pdflatex/tikztosvg-log/latex-examples-cache-4-way-associative.log.
MacTeX native output is the reference for this slice.

## Visual Result

Before the change, JS removed every hline and synthesized one horizontal rule
below the header. After the change, the table keeps both visible strokes of the
double header rule at a 2pt separation, matching the native table rule
structure. The two cell marks remain ordered and the brace still has a
resolved path and label.

The unresolved visible difference is deliberate and documented: native
cross-picture remember-picture cropping places the brace label at the
standalone canvas edge, while the JS lowering keeps the overlay with the table
and places it beside the marked cells. This is not fixed by the table-rule
work.

## Verification

node --test --test-name-pattern='inline tabular' test/tikzmark-math-overlay.test.js
passes with no diagnostics. The full tikzmark-math-overlay test file still has
a pre-existing Jordan-array fit-size assertion failure unrelated to this
tabular change.
