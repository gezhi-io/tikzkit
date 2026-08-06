# tkz-euclide legacy native-reference QA

## Scope

This pass fixes one verification-path capability only: rendering a local
MacTeX PNG reference for legacy `tkz-euclide` source that uses the removed
`\usetkzobj{...}` loader. It does not broaden TikZKit's geometry semantics or
claim support for every legacy `tkz-euclide` API.

The real drivers are `latex-examples-coordinate-system-1`,
`latex-examples-coordinate-system-2`, and
`latex-examples-coordinate-system-3`. These use a shared construction slice:

- `\tkzDefPoints`, `\tkzMarkAngle`, `\tkzLabelAngle`;
- `\tkzDrawLine[add=...]`, `\tkzLabelLine`, `\tkzDrawPoints`,
  `\tkzLabelPoint`, and `\tkzDrawPolygon`;
- `\tkzDefLine[orthogonal=through ...]`, `\tkzInterLL`, and
  `\tkzGetPoint` in the projection cases;
- standard TikZ `\node` and `calc` coordinate interpolation for the last
  derived point in coordinate-system-3.

The current interpreter already handles those commands and options with zero
diagnostics in all three driver cases. The defect was that their native
reference side compiled the historical loader unchanged, so the comparison
sheet silently had no native panel.

## Local MacTeX Reading

Read local TeX Live 2025 implementation files:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-draw-eu-lines.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-obj-eu-lines.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-draw-eu-angles.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-tools-eu-intersections.tex`

`tkzDrawLine` delegates to a TikZ `to` path with `add=left and right` and a
round line cap. `orthogonal=through P` produces an auxiliary perpendicular
point, and `tkzInterLL` publishes the line intersection as the point result.
`tkzMarkAngle` draws its `l` arc in centimeters while `tkzLabelAngle[pos=...]`
places the label along the angle bisector. Current TeX Live 2025 has already
absorbed the old object loader, so `\usetkzobj{all}` is undefined and must be
removed only from disposable reference input.

## Implementation

`renderNativeMacTeXPng()` now uses `normalizeLegacyTkzEuclideSource()` after
resource rewriting, matching the existing tikztosvg preparation. This removes
the obsolete loader and normalizes explicit-unit `ll`/`lll` angle sizes before
calling local `pdflatex`. User fixtures are not altered.

## Artifacts and Visual Check

Tools used:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- MacTeX: local `/Library/TeX/texbin/pdflatex`

Before the change, the three-case run at
`/private/tmp/tikzkit-qa-tkz-coordinate-systems-before-2026-08-06/` generated
TikZKit and tikztosvg SVG/PNG but **0/3 MacTeX PNG** files. Its MacTeX logs
all stop at `\usetkzobj{all}`.

After the change, the four-way artifacts are at
`/private/tmp/tikzkit-qa-tkz-coordinate-systems-native-ref-2026-08-06/`:

- TikZKit SVG/PNG and 1cm-grid SVG/PNG;
- tikztosvg SVG/PNG and 1cm-grid SVG/PNG;
- MacTeX native PNG;
- diff PNGs and four-panel native sheets.

All three native sheets were visually inspected. The coordinate axes,
orthogonal projections, `R` construction, braces, labels, angle dot, line
extensions, colors, and layer order appear in all three renderers. TikZKit
and tikztosvg retain only small anti-aliasing/canvas-border residuals against
MacTeX; no missing construction or shared coordinate shift was observed.

The wider legacy batch is at
`/private/tmp/tikzkit-qa-tkz-euclide-legacy-native-batch-2026-08-06/`.
It produced native PNGs for 11 of 19 old-loader fixtures: the three coordinate
systems, geometry-3 through geometry-9, and the interior/exterior-angle
triangle. The other eight still use separate obsolete APIs (`\tkzAxeXY`, the
old `orthogonal through` spelling, legacy `\tkzTangent`, or an incompatible
`tkz-fct` package order); they are not counted as passing this slice.

## Tests

```sh
node --test test/example-render-script.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-tkz-coordinate-systems-native-ref-2026-08-06 \
  --only latex-examples-coordinate-system-1 \
  --only latex-examples-coordinate-system-2 \
  --only latex-examples-coordinate-system-3 \
  --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output \
  /private/tmp/tikzkit-qa-tkz-coordinate-systems-native-ref-2026-08-06 \
  --register --alignment-radius 3
```

The script regression suite passes: 50 tests, 0 failures. The real three-case
run is 3/3 TikZKit SVG, 3/3 tikztosvg SVG, 3/3 PNG for each SVG renderer, and
3/3 native MacTeX PNG, all without TikZKit diagnostics.

## Remaining Work

This does not migrate historical geometry macros that current TeX Live itself
no longer accepts. The next focused slice should migrate old `tkzInit` and
`tkzAxeXY` to the supported coordinate-axis construction, then validate the
affected eight fixtures against both TikZKit and MacTeX.
