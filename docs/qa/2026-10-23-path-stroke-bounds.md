# Stroked Paths With Inline Nodes

## Native Rule and Repair

Local source: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex`,
lines 112-130. A stroked path expands its original bounds by half the current
line width before arrow shortening. Adding a path node does not suppress this
step. Unstroked fills do not receive that expansion.

`src/engine/evaluate.js` previously disabled stroke bounds whenever a path
contained a node. It now keeps stroke bounds enabled; the renderer still checks
whether the stroke is painted. The separate existing arrow-hull policy is not
changed by this patch.

`test/fixtures/path-stroke-bounds-metrics.tex` is an independent local pdfTeX
probe. A 2cm line with a 4pt pen is 60.90549 TeX pt wide, whether it has no node,
a label or an empty node. Its empty-node height is 4pt, not an arbitrary 1cm.
Both failing width/height regressions were reproduced before the runtime fix.

## Actual Browser Evidence

Local `tikztosvg` is `/Library/TeX/texbin/tikztosvg`. The two fixtures use
pdflatex, direct MacTeX PNGs, tikztosvg SVG/PNG, JS SVG/PNG, Chrome screenshots
of default JS and exported SVG, and before/after/diff sheets:

- `outputs/qa/2026-10-23-path-stroke-before/`
- `outputs/qa/2026-10-23-path-stroke-after/`

The empty-node control previously cropped the rounded ends and placed a thin
red stripe at the bottom of a tall blank canvas. It now has the same compact
canvas and full rounded ends as the local reference. Default browser JS and
SVG-text exports agree. Its native raster comparison passes.

The labelled arrow's canvas width improves from 57.09bp to the native 57.49bp.
However its height is still 12.14bp instead of 11.728bp, and the bare `$x$`
glyph uses different default/export rendering. This case is **not accepted**;
the existing arrow/math-label test remains failed. No assertion was weakened
to accept that height. The next repair needs to unify compact bare-math
measurement, direction anchors and paint, not add a per-case vertical offset.

Inspected sheets include both Chrome panels and the native/JS/tikztosvg/diff
panels. There are zero diagnostics and browser errors. A run with no applicable
browser geometry gate is not recorded as an automatic visual pass.

## Coverage

Checked: `draw`, `fill`, inline `node`, empty content, `inner sep=0pt`,
`line width`, `thick`, rounded caps and the unchanged classic stealth arrow.
The node-scope and node-transform controls also pass. General arrow hulls,
bare-math optical metrics and all path/node combinations remain partial.

```sh
node --test test/path-stroke-bounds.test.js \
  test/path-node-transform.test.js test/path-node-scope.test.js
```

Result: 12 passed. The three new tests check native pen-width bounds, empty
nodes, and unstroked fill controls; they do not certify the remaining math label.
