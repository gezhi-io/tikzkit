# TikZ Trees Child Foreach

## Scope

This slice implements documented TikZ tree clauses of the form
`child [options] foreach \var[/\var...] in {values} {child body}`. It covers
slash-separated variables and values, expansion before sibling layout, nested
child foreach bodies, and inheritance of outer loop variables. It does not
claim graph-drawing algorithms, arbitrary TeX control flow, `grow'`, custom
growth functions, arbitrary edge-from-parent templates, or collision avoidance.

The permanent flowchart, mathematics, and physics drivers are:

- `test/fixtures/examples/trees/child-foreach-flowchart.tex`
- `test/fixtures/examples/trees/child-foreach-math.tex`
- `test/fixtures/examples/trees/child-foreach-physics.tex`

Their strict command, option, declaration, number, and dependency inventories
are recorded in the adjacent `child-foreach-*-audit.md` files.

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
lines 4544-4677. `\tikz@collect@children@foreach` executes a PGF foreach while
collecting the tree, increments `\tikznumberofchildren` once per value, and
stores one reusable child template. `\tikz@childrennodes` later evaluates each
physical child with the resulting total and current-child counters. Therefore
loop expansion must happen before sibling positions are calculated.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/utilities/pgffor.code.tex`.
`\pgffor@vars` parses slash-separated variables and `\pgffor@invokebody` binds
slash-separated values in an iteration-local scope. Reviewed
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-trees.tex`
lines 55-123; it defines `child foreach` as repeated ordinary child operations
and explicitly documents nesting. The growth functions in
`tikzlibrarytrees.code.tex` consume the expanded total/current counters.

## Visual References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; native compilation
used `/Library/TeX/texbin/pdflatex`, and PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. MacTeX PNG, TikZKit SVG/PNG, tikztosvg
SVG/PNG, diffs, and four-way sheets are stored in:

- `outputs/qa/2026-09-05-trees-child-foreach-before`
- `outputs/qa/2026-09-05-trees-child-foreach-after`

Before the fix, TikZKit rendered only the root in all three drivers. Every
foreach-generated node, edge, label, and color was missing. After the fix:

- The flowchart has three correctly spaced child boxes with per-value colors.
- The mathematics tree has two operator children, four derivative leaves, and
  six parent edges; nested leaves retain each outer operator binding.
- The physics tree has two colored state children, four channel leaves, and six
  parent edges; state names and colors remain in scope in the nested loop.

The after sheets show the same tree topology, coordinates, dimensions, colors,
line widths, and layers as MacTeX and tikztosvg. The remaining small differences
are glyph metrics and tight-crop margins. The auxiliary PNG comparison reports
about 10.1%, 10.5%, and 12.2% changed pixels respectively; these values include
font anti-aliasing and one-to-six-pixel canvas differences and are not the
acceptance criterion.

The tikztosvg SVGs use view boxes `202.809 x 63.911`, `224.999 x 96.716`, and
`151.563 x 94.985` points. They contain ordinary expanded path/glyph groups,
butt caps, miter joins, nonzero fill behavior, and a y-flipping matrix. There is
no renderer-level foreach construct, confirming that expansion belongs before
scene/SVG rendering.

## Implementation And Verification

- `src/frontend/parser.js` parses child foreach headers, optional child
  options, slash variables, values, ordinary node templates, and nested child
  templates into a tree AST wrapper.
- `src/engine/evaluate.js` expands the wrapper before sibling totals and
  positions, resolves options in each iteration environment, and passes the
  bindings into nested children.
- `scripts/case-semantic-audit.js` inventories child foreach declarations and
  maps named math operators stored in loop values to the math text renderer.
- `test/parser.test.js`, `test/interpreter.test.js`, and
  `test/case-semantic-audit.test.js` cover syntax, topology, positions, colors,
  nested scope, options, variables, and audit ownership.

All three strict semantic audits pass. All three TikZKit renders have zero
diagnostics; MacTeX and tikztosvg generated all requested reference artifacts.
The older TCS logo regression now produces its full recursive tree and passes
its topology/color/arrow assertions. Its pre-existing small-caps SVG attribute
assertion remains a separate font-renderer issue.
