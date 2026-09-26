# Twelve Common Cases

## Scope

Tested common diagrams after the npm release was postponed: function plots,
grouped bars, a commutative diagram, a linked list, triangle geometry, a tree,
a flowchart, a matrix, and four 3D plots. The exact selection is in
[common12.json](2026-09-26-common12.json).

All 12 rendered with JS, tikztosvg, and native MacTeX, with no diagnostics or
external compilation failures. All before sheets were inspected. The changed
case was inspected again after the fix; the other 11 JS SVGs are byte-identical.
**Successful rendering is not visual acceptance:** all 12 still differ from
the reference, with zero missing or stale comparisons. No npm version change
or publication was performed.

## Shared Fix: Automatic 3D Ticks

The compact saddle-surface example had only a zero label on the z axis. After
rounding the interval to a 1/2/5 multiple, the implementation stopped without
checking the interval against the actual bounds.

Read the locally installed `pgfplots.sty` loader and
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`:

- Lines 1937-2008 compute the interval from the desired count and normalize it.
- Lines 2016-2040 increment `try min ticks` and bound recursive retries.
- Lines 2188-2318 seed the interval with `(trunc(min/H)-1)*H` and retry when
  `max < seed + 2H`.
- Lines 2404-2418 combine projected axis length, maximum spacing, and minimum
  count. Lines 2487-2526 choose the nearest 1/2/5 multiple.

This is not a rule that every axis must display two or more ticks. Native
pdfLaTeX probes confirmed the asymmetric behavior caused by truncation:

| Bounds | Native labels | Previous JS | Corrected JS |
| --- | --- | --- | --- |
| -4.4 to 4.4 | -4, -2, 0, 2, 4 | 0 | -4, -2, 0, 2, 4 |
| -2.99 to -1.01 | -2.5, -2, -1.5 | -2 | -2.5, -2, -1.5 |
| 1.01 to 2.99 | 2 | 2 | 2 |
| 0 to 6 | 0, 2, 4, 6 | 0, 2, 4, 6 | 0, 2, 4, 6 |

The shared planner in `src/pgfplots/axis3d.js` now applies that bounded retry to
linear x/y/z automatic ticks. Labels, grid lines, and annotation bounds use the
same result. No fixture-specific coordinates were added. Explicit `xtick`,
`ytick`, `ztick`, explicit tick distances, empty tick lists, and logarithmic
axes bypass the retry. The separate colorbar tick planner is unchanged.

The local probe is `outputs/qa/2026-09-26-3d-tick-probe.tex`. A very small positive
range also confirmed that one native tick may be intentional; scientific-number
formatting for that probe was not changed or claimed as fixed.

## Visual Review

| Case | Main commands/options exercised | Observed result and remaining differences |
| --- | --- | --- |
| `latex-examples-activation-functions` | `axis`, `addplot`, `exp`, `tanh`, `max`, `ln`, explicit bounds, samples, dashes, legends | Five curves, clipping, and legend entries are present. Math is heavier and some formula metrics differ. |
| `latex-examples-bar-chart-grouping` | Grouped bars, overlaid axes, tick lists, tick scaling, colored labels | Bars and both value scales are present. Frame/text offsets and subscript metrics differ. |
| `latex-examples-commutative-diagram` | `node`, `to`, directional placement, `fit`, ellipse, math labels | Connections and enclosing ellipses are present. Formula weight and vertical spacing differ. |
| `latex-examples-doubly-linked-list` | `rectangle split`, `nodepart`, chains, `let`, `calc`, bent edges, path picture | Compartments, values, null boxes, and forward/backward pointers are present. Arrow tips and small text/stroke differences remain. |
| `latex-examples-equilateral-triangle` | Polar coordinates, arcs, scopes, shifts, `calc` interpolation, coordinate labels | Triangle, sectors, and labels are present. Glyph weight and baseline differences remain. |
| `latex-examples-evaluation-tree` | Nested `child`, circle nodes, minimum size, edges from parents | All seven nodes and six edges are present. Small text and baseline differences remain. |
| `chains-multiple-joins-flowchart` | Multiple chains, named joins, node styles, arrows, dashed edges | Both branches converge on Release correctly. Box sizes, text, and arrowhead geometry differ slightly. |
| `matrix-style-precedence` | Matrix nodes, column/parity/row/cell styles | Cell colors follow the intended precedence. Box and text offsets remain. |
| `latex-examples-3d-function-4` | `addplot3 surf`, expression sampling, view, colormap, grid, colorbar | Surface topology and color variation are present. Stroke/rasterization, projected positions, and label margins differ. |
| `latex-examples-hyperbolic-paraboloid` | Quadratic surface, view, samples, black mesh, colorbar | Saddle geometry is present. Mesh rendering and text/colorbar-title metrics differ. |
| `pgfplots-colorbar-top-math` | Compact surface, automatic z ticks, top colorbar, cardinal anchor | **Improved:** z ticks now read -4, -2, 0, 2, 4 rather than only 0. Colorbar gap, y-tick density, and formula weight still differ. |
| `pgfplots-colorbar-top-algorithm` | Linear surface, grid, title, top colorbar | Surface is intact. Native and JS choose different automatic z-tick densities; title/colorbar vertical spacing differs. Unchanged by this bounded fix. |

Native and tikztosvg agree on the missing ticks in the changed case. The
tikztosvg SVG uses a y-inverting transform, separate stroked tick paths with
butt caps/miter joins, and outlined glyphs referenced with `use`; it contains
no SVG `text` or `foreignObject`. The missing labels were a tick-planning
problem, not clipping or a font-loading failure. Existing MacTeX-derived font
assets remain unchanged.

## Parameter Inventories

Each selected source has an automatically extracted Markdown/JSON inventory in
`outputs/qa/2026-09-26-common-inventory/`. These list packages, libraries,
commands, environments, options, declarations, numeric literals, and expressions
with implementation-owner hints. They are **unbound review inventories**, not
proof that every parameter is fully implemented. Some entries still have missing
owner mappings. General TeX layout, exact formula metrics, all tick-density
heuristics, and full arrow parity remain incomplete.

The new regression tests specifically verify all three linear axes, signed and
positive bounds, `try min ticks`, `max space between ticks`, explicit single
ticks, `ztick distance`, disabled ticks, major-grid consistency, and isolation
from log tick planning.

## Verification

- New tests: **6/6 passed**; four failed before the implementation change.
- Existing focused PGFPlots suite: **208 passed, 37 failed**, exactly the same
  failing names as before this round.
- Full suite: **2,655 tests; 2,499 passed, 142 failed, 14 skipped**. No newly
  failing names compared with the preceding run. The project is not all green.
- Twelve JS/native/tikztosvg artifact sets are complete. The comparison gate is
  still blocked by visual differences, not missing or stale artifacts.

```sh
node --test test/pgfplots-3d-auto-tick-retry.test.js
node --test
npm run check:architecture
npm run docs:links
```

## Reproduce

```sh
node --input-type=module -e '
  import fs from "node:fs";
  import { spawnSync } from "node:child_process";
  const { cases } = JSON.parse(fs.readFileSync("docs/qa/2026-09-26-common12.json"));
  const result = spawnSync(process.execPath, ["scripts/render-example-fixtures.js",
    "--output", "outputs/qa/2026-09-26-common-after",
    ...cases.flatMap(id => ["--only", id]), "--native-reference",
    "--tikztosvg-engine", "pdflatex", "--continue-on-external-failure"
  ], { stdio: "inherit" });
  process.exit(result.status ?? 1);
'
node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-26-common-after --register
```

Local tools: `/Library/TeX/texbin/tikztosvg`, `/Library/TeX/texbin/pdflatex`,
and `/opt/homebrew/bin/rsvg-convert`. The comparison page is
`outputs/qa/2026-09-26-common-after/index.html`; its SVG/PNG, native PNG, diff,
and sheet directories retain the evidence. The prior snapshot is in
`outputs/qa/2026-09-26-common-before/`. Generated files remain local and ignored
by Git, while the selection, regression tests, and this report are versioned.

Next priorities from this batch: formula weight/metrics in ordinary node and
legend text, then parent-axis/title/colorbar spacing. These should be reviewed
against native TeX boxes rather than corrected by case-specific offsets.
