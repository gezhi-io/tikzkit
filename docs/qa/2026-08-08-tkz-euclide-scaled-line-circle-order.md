# tkz-euclide Scaled `tkzInterLC` Result Order

## Scope And Acceptance Target

This slice corrects only the two-name result ordering of a sloped
`\tkzInterLC` inside an enlarging uniformly scaled `tikzpicture`. It covers the
default, `near`, `common=<point>`, and `[R]` paths that share the same
construction result. It does not add new Euclidean constructions.

The acceptance source is
[`test/fixtures/examples/tkz-euclide/line-circle-intersections.tex`](../../test/fixtures/examples/tkz-euclide/line-circle-intersections.tex),
extracted from `LaTeX-examples-master/tikz/thales-circle-triangle`. Its critical
line is:

```tex
\begin{tikzpicture}[scale=1.5]
  \tkzInterLC[/tikz/overlay](M,H)(M,B) \tkzGetPoints{E}{C}
```

The required native result is `E` on the upper contact and `C` on the lower
contact. The filled triangle must therefore occupy the lower semicircle.

## Local MacTeX Reading

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-tools-eu-intersections.tex`
  implements `\tkzInterLC` via `\tkzInterLCR`, emits two aliases, and only then
  evaluates `near`, `common`, and `next to`.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-tools-eu-angles.tex`
  shows that the default route uses `\tkzFindAngle` and normalized transformed
  point angles. It is not an unordered pair that can be sorted after SVG
  rendering.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-euclide/TKZdoc-euclide-intersection.tex`
  documents the three circle forms, `near` as a first-result selector, and
  `common` as a second-result selector.

Direct local MacTeX probes established the relevant observable behavior:

| Picture transform | Sloped default `{E}{C}` | `near` first | `common=C` second | Horizontal `[R]` |
| --- | --- | --- | --- | --- |
| omitted or `scale=1` | lower, upper | upper | upper | left, right |
| `scale=1.1` or `1.5` | upper, lower | lower | lower | left, right |

TikZKit now retains the picture's uniform scale in the tkz-euclide preprocess
state, changes the sloped seed ordering when the scale enlarges the picture,
and then applies the native `near` or `common` logic. Horizontal radius-mode
results remain left-to-right.

## Source Surface Audit

The permanent
[`line-circle-intersections.review.json`](../../test/fixtures/examples/tkz-euclide/line-circle-intersections.review.json)
marks the complete audit accepted. The real source uses:

| Surface | Status in this slice |
| --- | --- |
| `\usepackage{tikz}`, `\usepackage{tkz-euclide}`, `\usetikzlibrary{calc}` | Loaded and reviewed |
| `\tkzDefPoint`, `\tkzInterLC`, `\tkzGetPoints` | Implemented; scaled result handoff covered |
| `scale=1.5`, `/tikz/overlay` | Implemented for this picture-level uniform-scale ordering path |
| `\draw`, `\fill`, `\node`, `circle`, `cycle`, `rounded corners=0.1mm` | Existing shared path/node support exercised |
| `gray!60`, `gray!2`, `red`; `2cm`, `1pt`, `1.2pt`, `.5` interpolation | Existing shared color, unit, and calc support exercised |

Still partial: nested `scope` transforms, non-uniform `xscale`/`yscale`,
negative/rotated transforms, and untested `tkzInterLC` forms are not claimed by
this change.

## Visual Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; SVG PNG conversion
used `/opt/homebrew/bin/rsvg-convert`. Artifacts are intentionally ignored and
remain under:

- before: [`outputs/qa-tkz-euclide-interlc-before-2026-08-08/`](../../outputs/qa-tkz-euclide-interlc-before-2026-08-08/)
- after: [`outputs/qa-tkz-euclide-interlc-after-2026-08-08/`](../../outputs/qa-tkz-euclide-interlc-after-2026-08-08/)

The after directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG,
1cm grid panels, and
`diff/tkz-euclide-line-circle-intersections-native-sheet.png`.

Before the correction, TikZKit and tikztosvg put `C` on the upper contact and
`E` on the lower contact. MacTeX put the triangle on the lower semicircle,
with `E` above it. After the correction, TikZKit matches MacTeX's visible
contact binding, triangle placement, radial segment, and labels. tikztosvg
continues to disagree on this scaled legacy construction, so it is retained as
a diagnostic reference rather than the acceptance target.

The registered TikZKit-to-MacTeX changed-pixel ratio fell from `0.07668` to
`0.03960`. That number is secondary: the material improvement is the triangle
and its named contacts no longer occupying the wrong half of the circle.
Remaining difference is canvas crop plus font/antialias rasterization
(`270x233` TikZKit versus `274x248` MacTeX), not missing geometry.

## Verification

```bash
node --test test/tkz-euclide.test.js
npm run case:audit -- test/fixtures/examples/tkz-euclide/line-circle-intersections.tex \
  --review test/fixtures/examples/tkz-euclide/line-circle-intersections.review.json \
  --strict
npm run examples:render -- --output outputs/qa-tkz-euclide-interlc-after-2026-08-08 \
  --only tkz-euclide-line-circle-intersections --tikztosvg --native-reference --grid
npm run examples:diff -- --output outputs/qa-tkz-euclide-interlc-after-2026-08-08 \
  --register --alignment-radius 3
```

All commands pass for this focused slice with zero TikZKit, tikztosvg, and
MacTeX render diagnostics.
