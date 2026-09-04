# `decorations.pathreplacing`: curved brace metrics

## Scope

This slice implements a brace over cubic and mixed line/curve input paths. The
brace consumes the complete decorated traversal length once and paints in the
first input segment's exact tangent frame. It covers `brace`, `amplitude`,
`aspect`, `mirror`, and `raise`; it does not claim arbitrary TeX callback code
or custom decoration transforms.

Permanent drivers:

- `decorations-pathreplacing-brace-curves-flowchart`
- `decorations-pathreplacing-brace-curves-math`
- `decorations-pathreplacing-brace-curves-physics`

## Local Source Review

Reviewed these TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`, lines 140-185. The `brace` state has `width=+\pgfdecoratedremainingdistance`, runs once, and uses four cubic pieces around the configured aspect point. Its control coefficients are `.15`, `.3`, `.5`, and `.7` times the curl span or amplitude.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`, lines 755-812, 1230-1284, and 1816-1958. The module exposes the complete remaining distance, derives a cubic segment's starting angle from the first support point, always subdivides a cubic once, then recursively bisects until both terminal chord-axis deltas are below `1pt` and sums those chord lengths.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex`. The TikZ layer installs `decorate`, `mirror`, and `raise` as decoration transforms.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`. The manual defines brace amplitude and aspect and confirms path replacement rather than source-path painting.

The implementation now reuses `flattenDecorationPath`, which already mirrors
the PGF recursive subdivision rule, and asks `pointOnPolyline(..., 0)` for the
analytic cubic tangent. A fixed 25-segment sampler is no longer involved.

## Reference And SVG Inspection

Local tools:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- PNG conversion: `/opt/homebrew/bin/rsvg-convert`
- native engine: local MacTeX `pdflatex`

Artifacts are in `outputs/qa/2026-09-04-pathreplacing-brace-curves/`:

- `tikzkit-svg/`, `tikzkit-png/`
- `tikztosvg-svg/`, `tikztosvg-png/`
- `mactex-png/`
- `diff/`, `diff-png/`
- `before-after/curved-brace-{before,after,tikztosvg}.{svg,png}`

For the mathematics driver, tikztosvg emits a `220.392pt x 185.041pt`
viewBox. Its brace is one unfilled path with butt caps and miter joins, under a
vertical-flip matrix. The brace spans `203.070pt`. TikZKit emits the same four
cubics and two connecting lines as one unfilled butt/miter path; its internal
span is `716.383` units, or the same `203.070pt` at the renderer scale.
tikztosvg converts formula glyphs to path definitions and uses; TikZKit keeps
the configured SVG-text representation. Neither backend needs a marker or a
fill rule for the brace.

## Visual Change

The focused high-curvature probe starts at `(0,0)` with first support point
`(.01,0)`. Before this change, the first sampled chord overrode that exact
horizontal tangent: the brace ended at `(5.305,4.996)`, crossed the gray curve,
and ran diagonally out of frame. After the change it ends at `(7.292,0)`, as
does local tikztosvg/MacTeX, with the same aspect cusp and terminal curl.

All three permanent native sheets were inspected:

- Flowchart: the brace remains horizontal below the curved branch and the three action nodes; all references are `309x218px`.
- Mathematics: the brace span, cusp, curve, axes, and arrow tips align. TikZKit is `294x257px` versus `294x247px` for MacTeX/tikztosvg because its SVG formula text has a taller crop.
- Physics: the trajectory, endpoints, horizontal brace, and aspect position align. TikZKit is `330x268px`, MacTeX `330x263px`, and tikztosvg `330x262px`; the residual is formula/text cropping, not geometry.

No element is missing, the line widths/colors/layers match, and all three
TikZKit renders have zero diagnostics. Diff ratios are retained only as an
auxiliary raster signal: 4.48%, 2.04%, and 2.27% respectively.

## Commands And Parameters

Implemented and exercised: `\documentclass`, `\usepackage`,
`\usetikzlibrary`, `\definecolor`, `\begin{tikzpicture}`, `\draw`, `\node`,
`\fill`, cubic `.. controls ..`, `--`, `brace`, `decorate`, `amplitude`,
`aspect`, `mirror`, `raise`, `line width`, `dashed`, `densely dashed`, HTML
colors and mixes, named styles, `minimum width/height`, `rounded corners`,
`above/below`, arrows.meta `Stealth`, and inline SVG math.

Not implemented by this slice: arbitrary user-declared decoration automata,
TeX-only callback bodies, low-level PGF point macros, arbitrary postaction
keys, and custom nonlinear decoration transforms.

## Verification

```bash
node --test --test-reporter=spec test/pathreplacing-brace-curves.test.js test/brace-path-segmentation.test.js
npm run case:audit -- test/fixtures/examples/decorations/pathreplacing-brace-curves/flowchart.tex --review docs/qa/2026-09-04-pathreplacing-brace-curves-review.json --strict
npm run case:audit -- test/fixtures/examples/decorations/pathreplacing-brace-curves/math.tex --review docs/qa/2026-09-04-pathreplacing-brace-curves-review.json --strict
npm run case:audit -- test/fixtures/examples/decorations/pathreplacing-brace-curves/physics.tex --review docs/qa/2026-09-04-pathreplacing-brace-curves-review.json --strict
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-04-pathreplacing-brace-curves --only decorations-pathreplacing-brace-curves-flowchart,decorations-pathreplacing-brace-curves-math,decorations-pathreplacing-brace-curves-physics --tikztosvg-engine pdflatex --math-renderer svg-text --native-reference --continue-on-external-failure
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-04-pathreplacing-brace-curves
```

The focused tests and strict semantic gates pass. All three TikZKit,
tikztosvg, and MacTeX outputs were generated without external failures.
