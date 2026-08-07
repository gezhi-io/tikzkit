# PGFPlots Boxed Axis Line Style QA - 2026-08-07

## Scope

This slice covers one shared PGFPlots behavior: a normal 2D boxed axis must
inherit `axis line style`, including paint visibility such as
`draw opacity=0`. It does not expand 3D frame styling, individual x/y style
precedence, ticks, grid planning, or labels.

The real driver is
`test/fixtures/examples/latex-examples/histogram-large-1d-dataset.tex`. Its
axis uses `axis on top`, white major grids, `tick style={draw=none}`, and
`axis line style={draw opacity=0}`. Before this change TikZKit alone painted a
gray rectangle around the plot, while native MacTeX and tikztosvg kept only
the requested white grid.

## Local MacTeX Review

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`,
  lines 940-965: `axis line style` appends its argument to every inner and
  outer x/y/z axis-line style.
- The same file, lines 5168-5265 and 8629-8635: a 2D boxed axis is emitted as
  one closed outer path using the outer x and y style lists.

This means opacity is a property of the frame paint, not a signal to skip
layout, tick labels, grid lines, or the clipping rectangle.

## Third-Party Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its PNG conversion
used `/opt/homebrew/bin/rsvg-convert`.

Artifacts are kept locally and ignored by Git:

- Before scan: `outputs/qa-user-recent-scan-2026-08-07/`
- After three-way output: `outputs/qa-histogram-axis-frame-after-2026-08-07/`
- Native four-panel sheet:
  `outputs/qa-histogram-axis-frame-after-2026-08-07/diff/latex-examples-histogram-large-1d-dataset-native-sheet.png`
- TikZKit/tikztosvg/diff sheet:
  `outputs/qa-histogram-axis-frame-after-2026-08-07/diff/latex-examples-histogram-large-1d-dataset-sheet.png`

The tikztosvg SVG has white grid paths and no visible black frame. Its SVG
uses ordinary stroked paths with opacity attributes; TikZKit now emits the
same closed frame path with `stroke-opacity="0"`, preserving its geometry for
the bounding-box pass without painting it.

## Implementation and Audit

- `src/pgfplots/axisLines.js` builds the boxed frame style from the same
  `axis line style` fragments used for ordinary axis lines.
- `test/pgfplots-histogram.test.js` verifies the real fixture produces a
  transparent stroke and no related diagnostic.

The semantic surface of the driver is:

- Environments: `tikzpicture`, `axis`.
- Commands: `\\newcommand`, `\\fill`, `\\pgfresetboundingbox`,
  `\\useasboundingbox`, `\\addplot`.
- Relevant options: `axis on top`, `grid style={white,thick}`,
  `axis line style={draw opacity=0}`, `tick style={draw=none}`,
  `width=\\textwidth`, `height=5cm`, `ybar interval`, explicit ticks,
  rotated near-coordinate labels, and the final `clipright` crop.
- Relevant numeric semantics: y ticks `0..100` in steps of `20`, eight bar
  boundaries `0..7`, label shift `(3pt,4pt)`, `rotate=45`, and the `5cm`
  physical height.

No command or option from this case was removed or special-cased by fixture
name. The change only shares the box-frame style path.

The generated full-file semantic audit is intentionally **blocked**: seven
unmapped global commands (including `\\pgfresetboundingbox` and
`\\useasboundingbox`) still need audit-owner entries. That is a coverage gap in
the audit registry, not a runtime diagnostic from this render. Accordingly,
this record accepts only the boxed-frame style slice; it does not claim that
the entire historical histogram source is completely supported.

## Visual Result

All native, TikZKit, tikztosvg, and diff panels were inspected. Before the
change, TikZKit had an extra gray top/right/bottom/left rectangle. After the
change that rectangle is absent; the blue interval bars, white grid, labels,
rotated values, and final right-edge crop remain present. The TikZKit versus
tikztosvg changed-pixel ratio moved from `13.33%` to `12.69%`; mean absolute
RGBA moved from `0.0357` to `0.0320`. These figures support the visual review,
but do not replace it.

## Verification

```sh
node --test --test-name-pattern='boxed axes apply axis line style visibility' \
  test/pgfplots-histogram.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-histogram-axis-frame-after-2026-08-07 \
  --only latex-examples-histogram-large-1d-dataset \
  --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output outputs/qa-histogram-axis-frame-after-2026-08-07 \
  --only latex-examples-histogram-large-1d-dataset
```

The focused new regression passes. The wider historical PGFPlots seam suite
contains unrelated pre-existing snapshot tolerances; it was not used as proof
for this slice.

## Remaining Boundary

This does not implement the complete PGFPlots style cascade. Separate axis
lines with conflicting x/y outer styles, inner/outer style precedence,
arbitrary PGF style callbacks, 3D boxed-frame style cascades, and exact
font/label rasterization remain partial.
