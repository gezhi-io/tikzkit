# TikZ Trees Missing-Child Slots

## Scope

This slice implements TikZ tree `child[missing]` occupancy semantics, including
bare and bodied missing children, complete suppression of a missing child body,
and a child-local `missing=false` override. It does not claim graph drawing,
`child foreach`, `grow'`, arbitrary growth functions, or collision avoidance.

The permanent flowchart, mathematics, and physics drivers are:

- `test/fixtures/examples/trees/missing-flowchart.tex`
- `test/fixtures/examples/trees/missing-math.tex`
- `test/fixtures/examples/trees/missing-physics.tex`

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
lines 1362-1364 and 4550-4677. TikZ first collects every child and increments
the total count. At render time it increments the current child number, applies
`every child` followed by child-local options, and only then tests the `missing`
boolean. A true value skips the implicit coordinate/node, parent edge, body,
and descendants. Consequently the missing entry still reserves the position
computed from total child count and current child number. A local
`missing=false` can override inherited missing state.

Also reviewed
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-trees.tex`
lines 586-609. Its documented six-child example explicitly retains the fourth
slot while omitting child 4. The library file
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex`
uses the same total/current child counters for cyclic and clockwise layouts;
the boolean itself belongs to core `tikz.code.tex`.

## Visual References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. MacTeX native PNG, TikZKit SVG/PNG,
tikztosvg SVG/PNG, diff images, and four-way sheets are stored in:

- `outputs/qa/2026-09-05-trees-missing-before`
- `outputs/qa/2026-09-05-trees-missing-after`

The tikztosvg flowchart SVG has only two visible parent-edge paths. Its node
paths use nonzero fill, butt caps, miter joins, and a y-flipping matrix. It has
no hidden placeholder element or hidden child text; whitespace comes solely
from the sibling position calculation.

Before the fix, TikZKit visibly rendered the flowchart's `Escalate` and
`Ignored` nodes, the mathematics tree's `sin x` child, and the physics tree's
unobserved state and descendant. It also emitted their parent/descendant edges.
After the fix, all three panels preserve the same empty sibling slot as MacTeX
and tikztosvg while removing the missing nodes, text, edges, and descendants.
The `missing=false` logarithm node remains visible. Remaining visual residuals
come from existing text glyph metrics, formula glyph coverage, node sizing,
and tight SVG cropping, not missing-child layout.

## Implementation And Verification

- `src/frontend/parser.js`: a bare child carrying `missing` becomes one empty
  coordinate child and no longer recursively consumes following siblings.
- `src/engine/evaluate.js`: all children remain in layout arrays; after
  position calculation, a true resolved `missing` skips node/edge/subtree
  emission. `every child` is applied before local child options.
- `test/parser.test.js` and `test/interpreter.test.js`: cover bare and bodied
  children, sibling positions, ignored descendants, edge count, and
  `missing=false` overriding `every child`.

Focused tests pass and all three renderers produced every requested artifact
with zero TikZKit diagnostics and zero external failures.
