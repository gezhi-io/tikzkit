# QA: trees anchor routing

## Scope

This accepted `trees` slice covers generated-child placement from
`growth parent anchor`, `every child node`, explicit `parent anchor` and
`child anchor` endpoints, and the standard fork down/up/left/right routes.
It does not claim graph drawing, collision avoidance, or arbitrary
`edge from parent path` code.

## Local PGF Reading

Reviewed on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-trees.tex`, tree placement and tree-edge anchor sections around lines 610-670 and 798-834.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytrees.code.tex`, `grow cyclic`, sibling-angle, and all four fork route definitions around lines 63-105.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, child lifecycle and `every child node` application around lines 4637-4668.

PGF first chooses the selected parent anchor as the child-placement origin,
then places the child's own selected anchor there. Tree-edge anchors are
independent of that placement choice; `border` means the normal automatic
node-boundary intersection.

## Source Inventory

The driver uses `tikz` and `trees`; its executable statements are two
`\node` roots, two `child` clauses, and two `edge from parent[...]` clauses.
The inspected keys are `level distance=1cm`, `every node/.style` with
`rectangle`, `draw`, `minimum height=6mm`, and `inner sep=2pt`,
`every child node/.style={anchor=north}`, plus per-tree
`growth parent anchor`, `parent anchor`, `child anchor`, `blue,thick`, and
`red,dashed`. The explicit root positions are `(0,0)` and `(3,0)`; no macros,
variables, plots, or expressions are involved.

`npm run case:audit` wrote
`/private/tmp/tikzkit-qa-trees-anchors-after-2026-08-07/case-audit.md`. It
currently inventories the document shell, `\node`, and picture-level style
keys, but does not yet classify `child` and `edge from parent[...]` as their
own command records. That audit limitation is not treated as support: the
fixture, regression assertions, and source review above cover those tree
tokens explicitly.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
found at `/opt/homebrew/bin/rsvg-convert`.

- Before: `/private/tmp/tikzkit-qa-trees-anchors-before-2026-08-07/`
- After: `/private/tmp/tikzkit-qa-trees-anchors-after-2026-08-07/`
- Fixture: `test/fixtures/examples/trees/anchor-routing.tex`

All of MacTeX native PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, and the diff
sheet were generated and inspected. The third-party SVG declares a
`145.58pt` by `63.36pt` viewBox and uses transformed, filled glyph paths for
text. Its blue edge is a single vertical path from the parent south side to
the child north side; its red dashed edge is likewise vertical from the
parent north-east anchor to the child's west anchor. Strokes use explicit
line cap/join and dash attributes, so the anchor geometry can be examined
without relying on font rendering.

## Visual Result

Before this change, the blue `south -> north` edge collapsed to a short line
near the root because the returned tree-child layout record lost its actual
node box. The red `north east -> west` edge started from the root center and
ran diagonally into the child. After the change, the blue and red edges are
vertical and meet the same intended sides as both MacTeX and tikztosvg; the
child nodes also keep their explicit anchors rather than being centered after
placement.

The after comparison registered `8.721%` changed pixels and `0.02007` mean
absolute RGBA against MacTeX. Those values are only a locator: the inspected
remaining differences are compact crop dimensions and font rasterization,
not a missing or misrouted tree edge. The pre-existing `family-tree` fixture
does not use this anchor family and changed slightly from `11.4568%` to
`11.5512%`; it is not presented as an improvement for this narrow slice.

## Implementation And Verification

Changed:

- `src/engine/evaluate.js`
- `src/tikz/libraries/trees.js`
- `test/interpreter.test.js`
- `test/fixtures/examples/trees/anchor-routing.tex`
- `test/fixtures/examples/manifest.json`
- `docs/extension-registry.{md,csv}`

Commands:

```bash
node --test --test-name-pattern='growth and edge anchors|anonymous coordinate|node-less child|orthogonal west-anchored|edge-from-parent options' test/interpreter.test.js
npm run examples:render -- --manifest test/fixtures/examples/manifest.json \
  --only trees-anchor-routing \
  --output /private/tmp/tikzkit-qa-trees-anchors-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-trees-anchors-after-2026-08-07 \
  --register --alignment-radius 3
```

The focused regression passes and the visual fixture has no diagnostics.

## Remaining Limits

`trees` remains partial. Arbitrary `edge from parent path`, custom growth
functions, deferred child-node code hooks, graph-drawing layouts, and the
full PGF border-anchor algorithm need separate source-driven slices.
