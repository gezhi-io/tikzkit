# TikZ graphs: edge labels and local styles

## Scope

This change implements one bounded extension of the existing partial
`\usetikzlibrary{graphs}` support: connector-local styles, quoted edge labels,
the default `auto` label side, apostrophe (`'`) `swap`, and curved connectors
such as `bend left`. It is driven by `graphs-edge-labels-and-styles`, based
directly on the local PGF manual. It does not claim complete `graphs` or
complete `quotes` support.

## Local PGF source and manual review

Reviewed on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/graphs/tikzlibrarygraphs.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-graphs.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryquotes.code.tex`

The graph library's `new ->`, `new --`, `new <-`, and `new <->` handlers emit
an ordinary `\path` whose connector is `edge[#3] #4`. The manual documents
`a ->[red, "foo"] b --[thick, "bar"] {c,d}` and requires
`\usetikzlibrary{graphs,quotes}` for that quote syntax. The quotes library
maps `"text"` to an edge node using `every edge quotes={auto}`; its apostrophe
form prefixes `swap`. TikZKit therefore lowers a graph connector to a normal
`edge[...] node[auto,...]{...}` statement rather than flattening it to `--`.
That reuses the shared path-curve, path-label, text and marker logic.

## Real source audit

Fixture: `test/fixtures/examples/graphs/edge-labels-and-styles.tex`.

| Input item | Status in this slice |
| --- | --- |
| `\usetikzlibrary{graphs,quotes}` | `graphs` lowering implemented; source declares `quotes` as required by the native syntax |
| `grow right=1.5cm` | implemented as the horizontal chain vector |
| `nodes={draw,circle,minimum size=6mm}` | implemented as graph-wide node style |
| `edges={thick}` | implemented as the graph-wide path style |
| `->[red, "start"]` | implemented as a red directed edge and `node[auto]{start}` |
| `--["middle"']` | implemented as an unarrowed edge and `node[auto,swap]{middle}` |
| `->[blue,bend left, "return"]` | implemented as a blue directed cubic curve with an auto edge label |

Not implemented in this slice: source/target options (`>` / `<`), target- and
source-specific graph edge labels, arbitrary `every edge quotes` style keys,
multiple quote-key callback forms, subgraphs, graph-drawing algorithms,
circular/grid placement, aliases, and graph operators.

## tikztosvg reference

`command -v tikztosvg` resolves to `/Library/TeX/texbin/tikztosvg`; the fixture
renderer used `/opt/homebrew/bin/rsvg-convert` for PNG conversion. The
reference SVG at
`/private/tmp/tikzkit-qa-graphs-edge-labels-after-2026-08-07/tikztosvg-svg/graphs-edge-labels-and-styles.svg`
has a `102.45pt x 41.14pt` viewBox, transformed circle paths, thick paths at
`0.79701pt`, separate transformed arrowhead paths, a cubic return path, and
glyph `<use>` elements for each label. It has no browser `<text>` or
`foreignObject` elements. TikZKit retains its own text renderer but now emits
the same topology: three node circles, a red arrow, a black straight edge, a
blue cubic return edge, and all three labels.

Artifacts:

- before: `/private/tmp/tikzkit-qa-graphs-edge-labels-before-2026-08-07/`
- after: `/private/tmp/tikzkit-qa-graphs-edge-labels-after-2026-08-07/`
- TikZKit SVG/PNG: `/private/tmp/tikzkit-qa-graphs-edge-labels-after-2026-08-07/tikzkit-svg/graphs-edge-labels-and-styles.svg` and `/private/tmp/tikzkit-qa-graphs-edge-labels-after-2026-08-07/tikzkit-png/graphs-edge-labels-and-styles.png`
- tikztosvg SVG/PNG: `/private/tmp/tikzkit-qa-graphs-edge-labels-after-2026-08-07/tikztosvg-svg/graphs-edge-labels-and-styles.svg` and `/private/tmp/tikzkit-qa-graphs-edge-labels-after-2026-08-07/tikztosvg-png/graphs-edge-labels-and-styles.png`
- MacTeX PNG: `/private/tmp/tikzkit-qa-graphs-edge-labels-after-2026-08-07/mactex-png/graphs-edge-labels-and-styles.png`
- inspected four-panel sheet: `/private/tmp/tikzkit-qa-graphs-edge-labels-after-2026-08-07/diff/graphs-edge-labels-and-styles-native-sheet.png`

## Visual result

Before the change, the JS panel had the three circles but omitted `start`,
`middle`, and `return`; the blue `c -> a` edge was a straight horizontal
segment. The MacTeX and tikztosvg panels had the red label above the first
edge, the swapped middle label below the second edge, and a blue downward
curved return edge with its label.

After the change, the inspected TikZKit panel visibly contains all three
labels, keeps `start` above, moves `middle` below through `swap`, and draws the
blue return as a curve. JS-versus-MacTeX mean absolute RGBA residual falls from
`0.09538` before to `0.03461` after; this is supporting evidence only. The
remaining visible difference is small viewBox padding and browser/native font
rasterization, not a missing label or curve.

## Verification

Passed:

```bash
node --test test/graphs.test.js test/case-semantic-audit.test.js test/library-modules.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-graphs-edge-labels-after-2026-08-07 \
  --only graphs-edge-labels-and-styles --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-graphs-edge-labels-after-2026-08-07 \
  --register --alignment-radius 3
```

All three renderers completed and TikZKit reported zero diagnostics. The
registry remains intentionally `partial`.
