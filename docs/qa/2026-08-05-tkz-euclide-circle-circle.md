# tkz-euclide circle-circle intersections QA

## Scope

This pass implements one geometry family only: `\tkzInterCC` for the
documented `(center,circle-point)` and `[R](center,radius)` forms, followed by
`\tkzGetPoints`, `\tkzGetFirstPoint`, or `\tkzGetSecondPoint`. The real
driver is the Pythagoras triangle from
`LaTeX-examples-master/tikz/pythagoras`.

The implementation intentionally excludes `\tkzInterCC[with nodes]`, clip
macros, and unrelated circle constructions. A non-intersecting or concentric
pair emits a diagnostic instead of inventing a coordinate.

## Local MacTeX Reading

Reviewed in TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-tools-eu-intersections.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-obj-eu-points.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-euclide/TKZdoc-euclide-intersection.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-euclide/TKZdoc-euclide-pointsSpc.tex`

`\tkzInterCC` first turns each input into a center and radius, then delegates
to `\tkzInterCCR`. That algorithm finds the radical-axis base point and adds
and subtracts a perpendicular offset. The wrapper swaps the raw contacts when
needed so the first result follows its directed-angle convention; with
`common=pt`, it keeps `pt` as the second result. `\tkzGetFirstPoint` and
`\tkzGetSecondPoint` are direct aliases of those stored construction results.

TikZKit uses the same radical-axis construction in Cartesian coordinates,
including the directed-angle and `common` reordering, before emitting ordinary
TikZ coordinates. This is shared geometry, not a Pythagoras-specific layout.

## Command Audit

The real fixture uses:

| Source command or option | Status | Notes |
| --- | --- | --- |
| `\tkzSetUpPoint[shape=circle,size=10,color=black,fill=black]` | implemented | Existing shared tkz point style. |
| `\tkzSetUpLine[line width=1]` | implemented | Existing shared tkz line style. |
| `\tkzDefPoints{0/0/A,5/0/B}` | implemented | Existing coordinate definitions. |
| `\tkzInterCC[R,/tikz/overlay](A,4cm)(B,3cm)` | implemented | Explicit-radius intersection; `/tikz/overlay` is harmless geometry metadata. |
| `\tkzGetPoints{C}{D}` | implemented | Publishes ordered contacts. |
| `\tkzDrawPolygon`, `\tkzDrawPoints` | implemented | Existing drawing lowering. |
| point/segment/angle labels and `\tkzMarkAngle` | implemented | Existing label and arc lowering. |
| `\tkzInterCC[with nodes]` | deferred | Requires the three-name circle variant. |

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVG was converted
with local `rsvg-convert`. The original old-style `\usetkzobj{all}` loader was
removed only from this fixture because local tkz-euclide 5.11c no longer
defines it; the actual geometry source is otherwise preserved.

- Native MacTeX PNG:
  `outputs/qa-tkz-euclide-circle-circle/mactex-png/tkz-euclide-pythagoras.png`
- TikZKit SVG/PNG and grid:
  `outputs/qa-tkz-euclide-circle-circle/tikzkit-svg/`,
  `outputs/qa-tkz-euclide-circle-circle/tikzkit-png/`, and
  `outputs/qa-tkz-euclide-circle-circle/tikzkit-grid-png/`
- tikztosvg SVG/PNG and grid:
  `outputs/qa-tkz-euclide-circle-circle/tikztosvg-svg/`,
  `outputs/qa-tkz-euclide-circle-circle/tikztosvg-png/`, and
  `outputs/qa-tkz-euclide-circle-circle/tikztosvg-grid-png/`
- Diff sheet:
  `outputs/qa-tkz-euclide-circle-circle/diff/tkz-euclide-pythagoras-sheet.png`

The tikztosvg SVG declares a `156.14pt x 95.33pt` viewBox. Its triangle is a
single transformed path with `stroke-linecap=round` and `stroke-linejoin=round`;
the labels are TeX glyph paths rather than browser text.

## Visual Review

Before this change, `\tkzInterCC` was unimplemented, so `C` and `D` never
entered the coordinate registry: the Pythagoras triangle could not be drawn as
the intended 3-4-5 construction. After the change, all three viewed outputs
show the same upper contact `C`, base `A--B`, sides `A--C`/`B--C`, three black
points, `a/b/c` edge labels, and the small angle arc/dot at `C`.

The 1cm grids confirm that TikZKit and tikztosvg place A, B, and C on the same
construction coordinates. The remaining visual difference is raster/bbox
presentation: TikZKit is `208x127px`, tikztosvg is `209x128px`, and the latter
uses TeX-outline glyphs. The diff's 5.17% changed-pixel ratio and 0.0078 mean
RGBA delta are supporting measurements only; the visible geometry is accepted.

## Validation

Passed:

```bash
node --test test/tkz-euclide.test.js
node scripts/render-example-fixtures.js --output outputs/qa-tkz-euclide-circle-circle --only tkz-euclide-pythagoras --comparison-grid=svg
node scripts/diff-example-pngs.js --output outputs/qa-tkz-euclide-circle-circle
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=/private/tmp/tikzkit-qa-circle-circle /private/tmp/tikzkit-qa-circle-circle/pythagoras.tex
pdftoppm -png -r 144 -singlefile /private/tmp/tikzkit-qa-circle-circle/pythagoras.pdf outputs/qa-tkz-euclide-circle-circle/mactex-png/tkz-euclide-pythagoras
```

## Next Boundary

The next tkz-euclide slice should cover either `\tkzInterCC[with nodes]` or
`\tkzDefShiftPoint`; clipping should remain separate because it changes SVG
clip-path semantics rather than only point geometry.
