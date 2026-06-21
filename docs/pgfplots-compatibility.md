# PGFPlots Compatibility Worklog

Source under review: `/Users/kaiwu/Downloads/pgfplots.doc.src`

Goal: make real TikZ/PGFPlots examples converge toward MacTeX output through a shared implementation model, not one-off case hacks.

## Review Loop

Each unattended pass should do at most two visual cases, plus any small shared primitive needed by those cases.

1. Read this file, `git status --short`, and the newest gallery/native diff report.
2. Pick the first unresolved case or PGFPlots primitive with the largest repeated impact.
3. Write or update failing tests first.
4. Implement in the shared layer: coordinates, style parsing, text metrics, arrows, shapes, colors, layers, or extension adapters.
5. Run the focused test, then `npm test` when practical.
6. Update this worklog with commands/options supported, missing commands/options, case notes, and test evidence.
7. Commit/push only when repository permissions allow it.

## Global Gaps To Track

| Area | Why it matters | Status |
| --- | --- | --- |
| Axis coordinate system | All ticks, plots, bars, labels, and marks must share one data-to-TikZ transform. | In progress |
| Node/text metrics | Node borders and arrow clipping depend on formula/text width and height. | In progress |
| Arrow tips | TikZ has many tip families and endpoint shortening rules. | Needs dedicated module |
| Colors | PGF/TikZ color models, mixes, defined colors, and PGFPlots cycle lists affect most examples. | In progress |
| Line widths/dashes | Native TikZ uses consistent width presets and dash patterns. | Partial |
| Layers/order | backgrounds, foregrounds, fills, grids, and labels need deterministic z order. | Partial |
| Shapes/anchors | rectangle/circle/ellipse/diamond/etc. need border anchors and auto edge snapping. | Partial |
| Extension system | Package-style adapters should live in `src/extensions`, while common TikZ libraries are built in. | In progress |
| Native comparison | MacTeX PNG reference and JS PNG diff should gate case completion. | Partial |

## PGFPlots Docsrc Audit

Observed high-frequency features in `.tex` docs:

| Feature | Approx count | Status |
| --- | ---: | --- |
| `axis` | 769 | Partial |
| `loglogaxis` | 51 | Added basic support |
| `semilogyaxis` | 19 | Added basic support |
| `semilogxaxis` | 1 | Added basic support |
| `table` | 1498 | Added basic inline/resolver support |
| `ybar` | 116 | Added basic bars |
| `xbar` | 69 | Added basic bars |
| `const plot` | 31 | Added basic step paths |
| `closedcycle` | 43 | Added basic filled closed paths |
| `only marks` / `mark=` | 300+ | Added circle/square/x basics |
| `nodes near coords` | 132 | Added basic numeric labels |
| `xtick` / `ytick` | 500+ | Added explicit tick labels and `xtick=data` |
| `scatter` | 264 | Added basic mark rendering |
| `colorbar`, `colormap` | 1000+ | Missing |
| `error bars` | 68 | Missing |
| `fill between` | 131 | Missing |
| `groupplot` | 94 | Missing |
| `polaraxis` | 45 | Missing |
| `ternaryaxis` | 31 | Missing |

## Implemented PGFPlots Batch 001

Tests: `test/pgfplots-docsrc.test.js`

Verified command:

```sh
node --test test/pgfplots-docsrc.test.js
npm test
npm run gallery:audit
```

Result:

- PGFPlots focused tests: 22/22 passed.
- Full suite: 228/228 passed.
- Real gallery audit: 127/127 rendered, 0 diagnostics.

Implemented:

- Environments: `axis`, `semilogxaxis`, `semilogyaxis`, `loglogaxis`.
- Axis options: `xmode=log`, `ymode=log`, `xmin`, `xmax`, `ymin`, `ymax`, `width`, `height`.
- Ticks: `xtick={...}`, `ytick={...}`, `xticklabels={...}`, `yticklabels={...}`, `xtick=data`.
- Plots: `\addplot coordinates`, `\addplot+[...] coordinates`, function plots already present.
- Tables: `\addplot table {...}`, `table[x=...,y=...]`, `row sep=\\`, file tables via `pgfplotsTableResolver`.
- Styles: default cycle colors, explicit color tokens, `draw=...`, `color=...`, `fill=...`.
- Plot modes: `ybar`, `xbar`, plot-level `ybar`, `const plot`, `\closedcycle`.
- Marks: `only marks`, `scatter`, `mark=square*`, `mark=x`, default circular marks.
- Labels: basic `nodes near coords`.
- IR semantics: `axis-bar`, `axis-mark`, `axis-closed-cycle`, `axis-tick`.

Known limitations in this batch:

- Tick auto-placement is not a full PGFPlots implementation.
- Log tick formatting is basic numeric formatting, not `10^n`.
- Bars do not yet implement grouped/stacked/interval semantics.
- Table parsing is whitespace-based and does not yet cover full `pgfplotstable`.
- Mark catalogue is minimal.
- `nodes near coords` uses y values only and does not implement formatting hooks.

## Next PGFPlots Batches

Batch 002 candidates:

- `error bars` with x/y plus/minus variants.
- `fill between` minimal named-path fill.
- `groupplot` layout adapter.
- `colorbar` and `colormap` visual legend.
- `polaraxis` basic polar coordinate mapping.
- More marks: `triangle*`, `diamond*`, `otimes`, `oplus`, `asterisk`, `star`.

Batch 003 candidates:

- `axis equal`, `axis on top`, `clip`, `enlargelimits`.
- `symbolic x coords`, `bar shift`, grouped bars.
- `legend pos`, `legend style`, cycle list customization.
- `every axis plot`, `every node near coord`, `visualization depends on`.

## Case Review Ledger

| Case | Native diff priority | Issues found | Fixed | Notes |
| --- | --- | --- | --- | --- |
| Case 001-006 | Previously improved | text, arrows, spacing, node metrics | Partial | Recheck after shared metrics changes. |
| Case 011-012 | Medium | angle marker, point label, color/style drift | Partial | Needs coordinate/angle marker pass. |
| Case 021-025 | High | missing paths/libs, positioning drift | Partial | Continue two at a time. |
| Case 035-037 | High | formula metrics, circle sizing, pgfplots/positioning | Partial | PGFPlots Batch 001 helps Case 037 foundation. |
| Case 072-074 | Medium | ellipse/path handling | Partial | Recheck after last ellipse changes. |
| PGFPlots docsrc 001-022 | Unit coverage | foundational axis/plot primitives | Yes | Use as regression base before visual docsrc expansion. |
