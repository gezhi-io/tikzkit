# Shapes.multipart: Rectangle Split Separator Suppression

## Scope

One PGF `shapes.multipart` capability slice only: `rectangle split draw splits=false`.
The key is a paint toggle: it must retain rectangle-split part dimensions, fills,
text positions, and anchors while removing the internal separator strokes.

## Local Reference Reading

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`
  - Lines 465 and 505 define `\ifpgfrectanglesplitdrawsplits` and expose it as
    `/pgf/rectangle split draw splits` with a true default.
  - Lines 1211 onward condition only the separator `\pgfpath` construction on
    that boolean. The outer rectangle and part layout happen outside the branch.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`
  - Lines 1785--1788 document the default and state that the key controls the
    lines between node parts.

## Real Driver

`test/fixtures/examples/workbench/rectangle-split-draw-splits.tex` is a focused
PGF-manual-derived fixture. It renders one default three-part horizontal node and
one otherwise identical `rectangle split draw splits=false` node, each with three
part fills.

Commands and keys exercised:

- `\node`, `\nodepart{two}`, and `\nodepart{three}`.
- `rectangle split`, `rectangle split horizontal`, `rectangle split parts=3`.
- `rectangle split part fill={blue!20,green!20,orange!20}`.
- `draw`, `inner sep=2pt`, and `rectangle split draw splits=false`.

This slice is complete for separator suppression in both horizontal and vertical
rectangle-split rendering. Repeated empty-part rule accumulation, circle-split
variants, and advanced multipart shapes remain outside this slice.

## Artifacts And Visual Inspection

Before implementation:

- `/private/tmp/tikzkit-qa-multipart-draw-splits-before-2026-08-06/mactex-png/pgf-rectangle-split-draw-splits.png`
- `/private/tmp/tikzkit-qa-multipart-draw-splits-before-2026-08-06/tikzkit-svg/pgf-rectangle-split-draw-splits.svg`
- `/private/tmp/tikzkit-qa-multipart-draw-splits-before-2026-08-06/tikztosvg-svg/pgf-rectangle-split-draw-splits.svg`
- `/private/tmp/tikzkit-qa-multipart-draw-splits-before-2026-08-06/diff/pgf-rectangle-split-draw-splits-native-sheet.png`

After implementation:

- `/private/tmp/tikzkit-qa-multipart-draw-splits-after-2026-08-06/mactex-png/pgf-rectangle-split-draw-splits.png`
- `/private/tmp/tikzkit-qa-multipart-draw-splits-after-2026-08-06/tikzkit-svg/pgf-rectangle-split-draw-splits.svg`
- `/private/tmp/tikzkit-qa-multipart-draw-splits-after-2026-08-06/tikztosvg-svg/pgf-rectangle-split-draw-splits.svg`
- `/private/tmp/tikzkit-qa-multipart-draw-splits-after-2026-08-06/diff/pgf-rectangle-split-draw-splits-native-sheet.png`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and rendered through
its local XeLaTeX path; `/opt/homebrew/bin/rsvg-convert` produced the PNGs.
The third-party SVG gives a direct structural reference: the normal node has one
outer rectangle path plus two internal `M ...` separator segments, while the
`false` node has only its outer rectangle path. Before this change TikZKit emitted
two separator paths for both nodes. Afterwards it emits separator paths only for
the default node and leaves the false node's same three fill rectangles and outer
border intact.

The four-way sheet was inspected visually. Before the fix, the lower TikZKit node
showed two black vertical seams that are absent in both the MacTeX and tikztosvg
references. After the fix, the lower JS node is a continuous outlined rectangle
with the same blue, green, and orange part fills and unchanged text positions.
Residual differences are glyph rasterization and SVG canvas whitespace, not a
missing element or coordinate mismatch.

## Verification

```sh
node --test test/shapes-multipart-draw-splits.test.js \
  test/shapes-multipart-ignore-empty.test.js \
  test/shapes-multipart-empty-metrics.test.js \
  test/shapes-multipart-vertical.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-multipart-draw-splits-after-2026-08-06 \
  --only pgf-rectangle-split-draw-splits --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-multipart-draw-splits-after-2026-08-06 \
  --only pgf-rectangle-split-draw-splits
npm run gallery:audit
npm test
```

The targeted multipart tests pass. `gallery:audit` rendered 281/281 fixture-core
cases with zero diagnostics. The reference comparison remains `different` only
because of font rasterization and whitespace; the visible separator defect is
gone.

The full `npm test` run still has unrelated baseline failures in the semantic
audit's stale `arrows.meta` implementation-owner expectation and several
datavisualization text-metric/tick assertions. The `arrows.meta` mismatch is
already present in `HEAD`: its library metadata lists the current renderer
owners while the test expects an older shorter string. None of those tests import
or exercise `rectangleSplitLayout` or `rectangleSplitNodes`; they are not claimed
as passing for this change.
