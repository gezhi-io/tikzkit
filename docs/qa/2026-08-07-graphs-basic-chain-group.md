# TikZ graphs: basic chain groups

## Scope

This change implements one bounded `\usetikzlibrary{graphs}` slice: a named
node chain may contain comma-separated chain groups, with the four built-in
edge operators and Cartesian placement vectors. It is driven by
`graphs-basic-chain-group`, a compact real example adapted from the local PGF
manual. It does not claim the complete `graphs` library.

## Local PGF source and manual review

Reviewed on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/graphs/tikzlibrarygraphs.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-graphs.tex`

The source declares `new ->`, `new --`, `new <-`, and `new <->` as normal
TikZ edges. Its parser collects entries and exits for each chain/group, then
connects all compatible pairs. The placement layer resolves accumulated chain
width and group depth through `placement/place`; `grow ...` controls the chain
vector and `branch ...` controls the group vector. TikZKit follows that design
for the Cartesian subset by lowering graph syntax to normal named `\node` and
`\draw` statements rather than emitting SVG directly.

## Real source audit

Fixture: `test/fixtures/examples/graphs/basic-chain-group.tex`.

| Input item | Status in this slice |
| --- | --- |
| `\usetikzlibrary{graphs}` | resolved to `src/tikz/libraries/graphs.js` |
| inline `\tikz \graph` | implemented |
| `grow right=1.4cm` | implemented, parsed as a 1.4 cm chain vector |
| `branch down=1cm` | implemented, parsed as a 1 cm group vector |
| `nodes={draw,circle,minimum size=6mm}` | implemented as shared node options; audit retains `draw`, `circle` and `minimum size=6mm` separately |
| `edges={thick}` | implemented as a shared edge option |
| `a -> {b,c} -> d` | implemented as four nodes and four directed edges |

The group produces `a -> b`, `a -> c`, `b -> d`, and `c -> d`. Node centres
are `(0,0)`, `(1.4,0)`, `(1.4,-1)`, and `(2.8,0)` in TikZ coordinates.

Not implemented here: subgraphs, graph-drawing algorithms, node sets,
circular/grid placement, aliases, graph operators, per-edge nodes, and
arbitrary TeX key callbacks.

`scripts/case-semantic-audit.js` now maps `\graph` to this library and records
all eight graph option paths from the fixture. Its generated report is
`/private/tmp/tikzkit-qa-graphs-after-2026-08-07/graphs-basic-chain-group-audit.md`:
it has zero unmapped-command blockers. The report remains `incomplete` until a
separate review file marks general document-shell features and every literal as
accepted; that deliberate audit gate is not presented as library completion.

## tikztosvg reference

`command -v tikztosvg` resolved to `/Library/TeX/texbin/tikztosvg`; PNGs were
made with `/opt/homebrew/bin/rsvg-convert` through the fixture renderer.

Artifacts:

- before: `/private/tmp/tikzkit-qa-graphs-before-2026-08-07/`
- after: `/private/tmp/tikzkit-qa-graphs-after-2026-08-07/`
- reference SVG: `/private/tmp/tikzkit-qa-graphs-after-2026-08-07/tikztosvg-svg/graphs-basic-chain-group.svg`
- TikZKit SVG: `/private/tmp/tikzkit-qa-graphs-after-2026-08-07/tikzkit-svg/graphs-basic-chain-group.svg`
- MacTeX PNG: `/private/tmp/tikzkit-qa-graphs-after-2026-08-07/mactex-png/graphs-basic-chain-group.png`
- four-panel sheet: `/private/tmp/tikzkit-qa-graphs-after-2026-08-07/diff/graphs-basic-chain-group-native-sheet.png`

The reference SVG uses transformed path circles, a `0.3985` pt node outline,
`0.79701` pt thick edges, and separately transformed curved arrow-tip paths.
TikZKit emits SVG ellipses plus its shared curved `to` arrow tips. Both have
the same four-node topology and the same horizontal/diagonal edge placement;
the remaining bbox and text-raster differences are renderer-level rather than
missing graph semantics.

## Visual result

Before this change, the JS PNG was a tiny blank `44x44` panel with an
`Unsupported command \graph` diagnostic, while MacTeX and tikztosvg showed the
complete four-node fan-out. After lowering, all three visible panels contain
the four circles and four directed edges. The JS output is `136x68` pixels and
the reference is `130x62`; the inspected sheet shows matching geometry, with
the small residual mostly from viewBox padding, stroke rasterization and font
rendering. The JS-versus-MacTeX registered changed-pixel ratio is `0.1099`;
this number is only a supplement to the visual inspection.

## Verification

Passed:

```bash
node --test test/graphs.test.js test/library-modules.test.js
npm run case:audit -- test/fixtures/examples/graphs/basic-chain-group.tex \
  --output /private/tmp/tikzkit-qa-graphs-after-2026-08-07/graphs-basic-chain-group-audit.md
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-graphs-after-2026-08-07 \
  --only graphs-basic-chain-group --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-graphs-after-2026-08-07 \
  --register --alignment-radius 3
```

The fixture has no TikZKit diagnostics, and both external references completed.
The registry entry remains `partial` intentionally.
