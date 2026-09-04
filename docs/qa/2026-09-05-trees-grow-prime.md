# TikZ Trees Mirrored Growth

## Scope

This slice implements the core tree growth family used with the trees library:
grow prime for named and numeric directions, orthogonal sibling spacing,
child-local special-level placement, and inherited subtree growth. It does not
claim graph-drawing algorithms, arbitrary custom growth functions, arbitrary
edge-from-parent templates, or collision avoidance.

The permanent flowchart, mathematics, and physics drivers are:

- test/fixtures/examples/trees-grow-prime/flowchart.tex
- test/fixtures/examples/trees-grow-prime/math-expression.tex
- test/fixtures/examples/trees-grow-prime/physics-decay.tex

Their adjacent review files inventory and verify every dependency, command,
environment, option, and numeric literal.

## Local TeX Reading

Reviewed
/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex
around lines 1380-1395 and 4550-4677. The grow key installs the default growth
function with left and right sibling angles at theta minus 90 degrees and theta
plus 90 degrees. Grow prime calls the same setup and swaps those two angles; it
does not reverse the main growth vector. Child collection supplies one global
child total and current-child index, including missing slots.

The same source shows that a grow option applied inside child options records
the current level as a special level. Its current child therefore receives zero
sibling displacement, while descendants resume ordinary sibling spacing and
retain the locally selected growth direction.

Reviewed
/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-trees.tex
around the Default Growth Function section. It confirms all cardinal and
diagonal aliases, arbitrary degree values, the line orthogonal to the growth
direction, and the opposite child order produced by grow prime. Also reviewed
tikzlibrarytrees.code.tex for the library growth and edge context; directional
grow and grow prime themselves are core TikZ semantics.

## Visual References

The local tools used were:

- tikztosvg: /Library/TeX/texbin/tikztosvg
- MacTeX pdflatex: /Library/TeX/texbin/pdflatex
- SVG to PNG: /opt/homebrew/bin/rsvg-convert

MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, one-centimeter grids, registered
diffs, and four-panel sheets are stored in:

- outputs/qa/2026-09-05-trees-grow-prime-before
- outputs/qa/2026-09-05-trees-grow-prime-after

Before the fix, TikZKit treated grow prime like ordinary downward growth. The
flowchart's Verify/Deploy branches and their grandchildren were in the opposite
order; the expression tree placed y on the left instead of the right; and the
particle cascade mirrored both first-level and decay-product branches. It also
lacked the exact child-local special-level behavior.

After the fix, all three TikZKit diagrams visibly match MacTeX and tikztosvg:

- The release flowchart mirrors source-order siblings at both levels.
- The expression tree places y on the right and keeps the plus, sine,
  multiplication, and operand hierarchy in the native positions.
- The particle cascade places K+ directly right of K*0 for the child-local
  rightward override, while pi-minus retains the global second-child slot.
- Node centers, level distance, sibling distance, fills, borders, and layers
  align; all three TikZKit runs report zero diagnostics.

The remaining raster differences are Computer Modern glyph antialiasing,
subpixel stroke coverage, and at most one pixel of tight-crop width. The
TikZKit-versus-native changed-pixel ratios dropped from 14.8% to 7.5% for the
flowchart, 18.7% to 5.5% for the expression tree, and 8.8% to 7.7% for the
particle cascade. These figures support, but do not replace, visual acceptance.

The tikztosvg SVGs use nonzero fill rules, butt caps, miter joins, 0.3985pt
default strokes, and a y-flipping matrix transform. Their view boxes are
279.34 by 112.1pt, 170.21 by 136.19pt, and 191.47 by 119.19pt. Text is emitted
as glyph paths rather than SVG text, and tree edges are ordinary path data
between clipped node borders. This confirms that sibling ordering belongs in
the interpreter before SVG rendering.

## Implementation And Verification

- src/engine/evaluate.js resolves named and numeric growth angles, applies the
  native plus-or-minus 90-degree sibling vector, preserves the global child
  total/index, suppresses current-level displacement for child-local growth,
  and carries node-level or child-level growth into descendants.
- test/interpreter.test.js covers ordinary and mirrored ordering, numeric
  spacing, child-local special levels, and subtree inheritance.
- The three fixture review files provide strict semantic coverage.
- src/tikz/libraries/trees.js and the generated extension registry document the
  implemented slice and remaining boundaries.

All focused tree tests and all three strict semantic audits pass. MacTeX and
tikztosvg rendered all requested references without external failures.
