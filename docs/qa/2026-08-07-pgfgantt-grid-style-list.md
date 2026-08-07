# `pgfgantt` Grid Style-List QA (2026-08-07)

## Scope

This record covers one bounded `pgfgantt` family: basic `ganttchart`
horizontal and vertical grid rendering, including the documented repeated
style-list form used by `hgrid` and `vgrid`, plus the title, task, and group
row geometry that shares the same chart coordinate system. It does not attempt
the broader package.

The driver is `pgfgantt-grid-style-list`, adapted from the local TeX Live
manual. It uses one title row, two bars, `hgrid=true`, and
`vgrid={*2{red}, *1{green}, *{10}{blue, dashed}}`.

## Local MacTeX Study

Read locally:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfgantt/pgfgantt.sty`;
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfgantt/pgfgantt-doc.pdf`.

The implementation details used here are concrete:

- lines 50-68 make `hgrid=true` mean `dotted`;
- lines 71-97 consume an `hgrid` style list and draw consecutive horizontal
  boundaries;
- lines 99-116 give `vgrid=true` the same dotted default;
- lines 119-140 parse leading `*` repetitions and apply each style to
  consecutive vertical boundaries;
- lines 375-404 start vertical grid lines at the first internal time slot and
  horizontal grid lines beneath the final title row.
- lines 484-565 set the default `title height=.6`, `title label font=\small`,
  and calculate the title rectangle from its local left, right, and top shifts;
- lines 851-1000 calculate every chart element rectangle from the `left`,
  `right`, `top`, and `height` values and place external labels at the chart
  origin with an east anchor;
- lines 1025-1100 set bar defaults to `top=.3,height=.4` and group defaults
  to `left=-.1,right=.1,top=.4,height=.2`, with normal-size labels.

TikZKit mirrors the repeat order and cycles it when the chart has more grid
lines than the list specifies. The lowered title is painted after its grid
line, so the visible vertical grid starts under the title row, like native
`pgfgantt`. It also applies the source-defined title, bar, and group defaults,
then lets the row-local option override the chart-wide option.

## Three-Way Visual Check

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

Before this pass, `tikztosvg` could not render the fixture: the renderer
extracted the chart body but did not pass `-p pgfgantt`, so it reported
`Environment ganttchart undefined`. The renderer now explicitly supports the
installed package. After the change, all three outputs exist:

- MacTeX PNG: `/private/tmp/tikzkit-qa-pgfgantt-grid-after-2026-08-07/mactex-png/pgfgantt-grid-style-list.png`;
- TikZKit SVG/PNG: `/private/tmp/tikzkit-qa-pgfgantt-grid-after-2026-08-07/tikzkit-svg/pgfgantt-grid-style-list.svg` and `/private/tmp/tikzkit-qa-pgfgantt-grid-after-2026-08-07/tikzkit-png/pgfgantt-grid-style-list.png`;
- tikztosvg SVG/PNG: `/private/tmp/tikzkit-qa-pgfgantt-grid-after-2026-08-07/tikztosvg-svg/pgfgantt-grid-style-list.svg` and `/private/tmp/tikzkit-qa-pgfgantt-grid-after-2026-08-07/tikztosvg-png/pgfgantt-grid-style-list.png`;
- native comparison sheet: `/private/tmp/tikzkit-qa-pgfgantt-grid-after-2026-08-07/diff/pgfgantt-grid-style-list-native-sheet.png`.

The before TikZKit panel used gray solid lines everywhere. The after panel
visibly has red/red/green internal boundaries followed by blue dashed ones,
then repeats the sequence; the horizontal boundaries are black dotted. Native
MacTeX and tikztosvg show the same colour and cadence. The remaining visual
difference is not missing grid semantics: TikZKit still has a slightly
different total width, title text metrics, left label offset, and bar vertical
metrics. Those differences remain outside this grid-style boundary.

The tikztosvg SVG has `viewBox="0 0 298.6 59.6"`; its vertical grid paths use
red, green, and blue strokes, with the blue paths carrying
`stroke-dasharray="2.98883 2.98883"`. Its horizontal grid paths use the
native dotted pattern `0.3985 1.99255`. TikZKit emits separate SVG paths with
the same colour order and blue dash role; its SVG path list is therefore a
useful structural check in addition to the PNG review.

### Layout Follow-up

The follow-up artifacts are in
`/private/tmp/tikzkit-qa-pgfgantt-layout-after-2026-08-07`:

- MacTeX PNG: `mactex-png/pgfgantt-grid-style-list.png`;
- TikZKit SVG/PNG: `tikzkit-svg/pgfgantt-grid-style-list.svg` and
  `tikzkit-png/pgfgantt-grid-style-list.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfgantt-grid-style-list.svg` and
  `tikztosvg-png/pgfgantt-grid-style-list.png`;
- four-panel sheet and difference panel: `diff/pgfgantt-grid-style-list-sheet.png`
  and `diff-png/pgfgantt-grid-style-list.png`.

The earlier TikZKit image made the title strip a full `y unit title` high and
used `\scriptsize` for all labels. In the current TikZKit panel the title strip
is visibly shorter, the title uses the native small role, and Phase A/Phase B
use normal-size labels at the chart origin. Structural SVG comparison confirms
the same physical geometry after unit conversion: native `tikztosvg` places
the title at `0.6 × 0.55cm` and the first bar at
`0.55cm + .3 × .7cm` with `.4 × .7cm` height; TikZKit emits the corresponding
`33`, `76`, and `28` renderer units. The current remaining difference is
primarily font rasterization and the unimplemented specialised group shape,
not a missing title or task-row coordinate rule.

## Changes And Verification

- `src/frontend/latex-shell.js`: adds shared parsing and cyclic selection for
  `*n{style}` and `*{n}{style}` grid-list items, applies the result to each
  internal grid boundary, treats `true` as the PGF dotted default, and lowers
  source-defined title/bar/group geometry, fonts, and local shift options.
- `scripts/render-example-fixtures.js`: lets the local tikztosvg adapter load
  `pgfgantt`.
- `test/fixtures/examples/pgfgantt/grid-style-list.tex` and its manifest entry:
  retain the real visual driver.
- `test/walmes-compat.test.js`: protects colour, dash, dotted-default
  lowering, and title/task/group dimensions with local overrides.
- `src/packages/pgfgantt.js`, generated extension registry, and `README.md`:
  record the reviewed partial boundary and how to exercise it.

```bash
node --test --test-name-pattern='pgfgantt' test/walmes-compat.test.js
npm run examples:render -- --manifest test/fixtures/examples/manifest.json \
  --only pgfgantt-grid-style-list \
  --output /private/tmp/tikzkit-qa-pgfgantt-layout-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure --external-timeout-ms 60000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-pgfgantt-layout-after-2026-08-07 \
  --register --alignment-radius 4
npm run extension-registry
npm run gallery:audit
```

The focused regression and all three renderers pass with no TikZKit
diagnostics. This is a visible rendering improvement for the selected real
case, not merely a diff-score change.

## Remaining Work

`pgfgantt` remains partial. The next focused slices should cover one family at
a time: calendar/date time slots, `gantttitlelist`, links/dependencies and
their anchors, progress bars, specialised group/bar shapes, or documented
canvas and element styles. Text measurement remains a separate renderer-level
calibration task.
