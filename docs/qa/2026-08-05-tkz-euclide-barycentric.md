# tkz-euclide barycentric construction QA

## Scope

This pass implements one `tkz-euclide` construction family only:
`\tkzDefBarycentricPoint(pt1=weight1,pt2=weight2,...)` followed by
`\tkzGetPoint{name}`. The real driver is the Menelaus triangle from
`LaTeX-examples-master/tikz/triangle-menelaos-1`; the corpus contains nine
uses across Menelaus, exterior-angle, and escribed-circle examples.

The implementation accepts two or more already-known point names and finite
numeric weights, including values previously created by `\pgfmathsetmacro`.
Positive weights construct interior barycenters and negative weights construct
the exterior points used to extend triangle sides. Unknown points, nonnumeric
weights, fewer than two entries, and a zero total weight remain explicitly
diagnostic rather than silently producing a false coordinate.

## Local implementation record

Read from the local TeX Live 2025 installation:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-obj-eu-points-spc.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-euclide/TKZdoc-euclide-pointsSpc.tex`

The package implementation delegates to PGF's `barycentric cs:` coordinate
system and stores the result in `tkzPointResult`. The documentation defines
the result as `(sum(weight_i * point_i)) / sum(weight_i)`, requiring at least
two points. TikZKit now computes that exact Cartesian construction and emits a
normal `\coordinate (tkzPointResult)` so existing `\tkzGetPoint`,
`\tkzInterLL`, and drawing commands retain the same handoff model.

## Reference artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and rendered the
fixture with the local `rsvg-convert` PNG conversion.

- MacTeX native PNG: `outputs/qa-tkz-euclide-barycentric/mactex-png/tkz-euclide-triangle-menelaos-1.png`
- TikZKit SVG/PNG: `outputs/qa-tkz-euclide-barycentric/tikzkit-svg/` and `outputs/qa-tkz-euclide-barycentric/tikzkit-png/`
- tikztosvg SVG/PNG: `outputs/qa-tkz-euclide-barycentric/tikztosvg-svg/` and `outputs/qa-tkz-euclide-barycentric/tikztosvg-png/`
- Grid PNGs: `outputs/qa-tkz-euclide-barycentric/tikzkit-grid-png/` and `outputs/qa-tkz-euclide-barycentric/tikztosvg-grid-png/`
- Diff sheet: `outputs/qa-tkz-euclide-barycentric/diff/tkz-euclide-triangle-menelaos-1-sheet.png`

The tikztosvg SVG uses a `159.54pt x 114.22pt` viewBox, PGF glyph paths,
and transformed paths with round line caps and joins for the triangle. Its red
transversal is a clipped, transformed straight path. TikZKit preserves the
same construction points and visible line topology; it uses its browser-font
text pipeline instead of embedding TeX glyph paths.

## Visual result

Before the shared coordinate-registry correction, the TikZKit panel could
lose named coordinates from the returned Scene Graph and crop this case down
to a fragment of the red line. After the correction, the 1cm-grid panels show
the same A/B/C triangle, X barycenter, Y line intersection, Z baseline point,
and red transversal as tikztosvg. The native MacTeX PNG confirms the same
geometry and labels.

The remaining visible difference is presentation-only: TikZKit's canvas is
three pixels shorter than tikztosvg's rasterized canvas and browser text is
not identical to TeX glyph outlines. The diff reports a `0.0334` mean absolute
RGBA delta and an `8.78%` changed-pixel ratio after the raster dimension
alignment, but the visual review, not that number, is the acceptance basis.

## Validation

Passed:

```bash
node --test --test-name-pattern='(exposes tkz-euclide|constructs named tkz-euclide midpoints|constructs tkz-euclide barycentric)' test/tkz-euclide.test.js
node scripts/render-example-fixtures.js --output outputs/qa-tkz-euclide-barycentric --only tkz-euclide-triangle-menelaos-1 --comparison-grid=svg
node scripts/diff-example-pngs.js --output outputs/qa-tkz-euclide-barycentric
```

The full repository suite is not a gate for this focused change while the
shared worktree contains concurrent, uncommitted parser/renderer work. The
targeted regression and all three rendered references pass.

## Next boundary

This does not claim complete `tkz-euclide` support. The next high-value
geometry slice should be selected from actual corpus frequency, then checked
against its local TeX Live macro source before implementation.
