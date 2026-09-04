# PGFPlots Fill-Between Split Regions

## Scope

This slice implements `pgfplots.fillbetween` intersection splitting for two
single-valued, x-monotone 2D function or coordinate paths. Soft clipping is
applied first; both paths are split at ordered polyline intersections; the
second fragment is reversed; and one closed fill path is emitted per region.
The native per-segment style order is preserved.

The permanent algorithm, mathematics, and physics drivers are:

- `test/fixtures/examples/pgfplots/fillbetween-split/algorithm.tex`
- `test/fixtures/examples/pgfplots/fillbetween-split/math.tex`
- `test/fixtures/examples/pgfplots/fillbetween-split/physics.tex`

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.fillbetween.code.tex`.
The PGFPlots wrapper transforms named axis paths, builds the soft-clip domain in
axis coordinates, delegates to `\tikzfillbetween`, and paints on the pre-main
fill-between layer.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfcontrib/tikzlibraryfillbetween.code.tex`.
With `split=true`, every intersection region is streamed to a separate `\fill`.
Its style order is `every segment`, addplot options, `every segment no N`, the
appropriate odd/even style, and finally `every last segment`.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfcontrib/pgflibraryfillbetween.code.tex`.
The low-level algorithm normalizes path direction, applies soft clipping before
intersection discovery, sorts intersection times, splits both paths at matching
positions, reverses the second section, closes each pair, and omits empty
regions.

Also reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryintersections.code.tex`,
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfcontrib/tikzlibrarydecorations.softclip.code.tex`,
and the local `pgfplots.pdf` section 5.7. The source archive example in
`pgfplots.libs.fillbetween.tex` confirms the sine/cosine odd/even-color case.

## Command And Parameter Coverage

Implemented and verified in all three drivers:

- shell and setup: `\documentclass`, `\usepackage{pgfplots}`,
  `\usepgfplotslibrary{fillbetween}`, `\pgfplotsset{compat=1.18}`;
- environments: `document`, `tikzpicture`, and `axis`;
- axis parameters: `width`, `height`, `xmin`, `xmax`, `ymin`, `ymax`,
  `axis lines`, `grid`, `xlabel`, `ylabel`, and `title`;
- named plot parameters: `name path`, bare and mixed colors, `thick`,
  `very thick`, `mark`, `domain`, and `samples`;
- fill plot parameters: `fill`, `fill opacity`, bare fill color semantics;
- fill-between parameters: `of`, bare `split`, `split=true`,
  `every segment`, `every segment no N`, `every odd segment`,
  `every even segment`, and `every last segment`, including nested `.style`;
- data and math: coordinate tables, constants, `sin`, `cos`, and `exp`.

The strict audit reports enumerate every dependency, command, environment,
option, numeric literal, and plot expression. The audit itself now recognizes
the second `fill between[...]` option group after `\addplot[...]` instead of
silently attributing only the first bracket.

Not implemented by this slice: self-intersecting or multivalued paths,
coincident/tangent overlap semantics, exact cubic intersection subdivision,
arbitrary closed TikZ paths, `intersection segments` sequences, `inner moveto`,
mesh/surface fills, and explicit non-auto `reverse` behavior. The library
therefore remains `partial`.

## Visual References

Local tools:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX `pdflatex`: `/Library/TeX/texbin/pdflatex`
- SVG-to-PNG: `/opt/homebrew/bin/rsvg-convert`

MacTeX PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, one-centimeter grids,
registered differences, and four-panel sheets are stored in:

- `outputs/qa/2026-09-05-pgfplots-fillbetween-split-before`
- `outputs/qa/2026-09-05-pgfplots-fillbetween-split-after`

Before the fix, TikZKit emitted one self-crossing fill path. The algorithm case
lost the two orange over-target regions, the sine/cosine case lost its yellow
middle region, and the oscillator lost the red negative-displacement regions.
After the fix, the TikZKit panels contain 5, 3, and 5 independently closed
regions with exactly the same alternating color order as MacTeX and
tikztosvg. Their crossings, peaks, zero line, axis origins, ticks, and plot
layer order align on the one-centimeter grids. All three cases report zero
diagnostics.

The TikZKit-to-MacTeX registered changed-pixel ratios fell from 21.96% to
18.61% for the algorithm case, 21.01% to 8.90% for mathematics, and 13.63% to
10.42% for physics. These numbers are supporting evidence; all six before and
after four-panel sheets and all six final grid images were inspected directly.
The remaining differences are text antialiasing, minor title/tick positioning,
and 3 to 15 pixels of outer canvas sizing in two cases.

The three tikztosvg SVGs use `fill-rule="nonzero"`, butt line caps, miter joins,
and y-flipping matrix transforms. Their view boxes are 287.868 by 185.971pt,
274.109 by 155.09pt, and 304.584 by 161.834pt. Text is represented by glyph
paths and `<use>` elements rather than `<text>`. The colored fill-path counts
are 3 blue plus 2 orange, 2 cyan plus 1 yellow, and 3 blue plus 2 red. This
matches the implemented region counts and confirms that splitting belongs in
the PGFPlots lowering stage before SVG serialization.

## Verification

- `node --test test/pgfplots-fillbetween.test.js`: 8 passed.
- `node --test test/case-semantic-audit.test.js`: 20 passed.
- `node --test test/pgfplots-library-modules.test.js`: 1 passed.
- Three strict semantic audits: accepted, no todos, no blockers.
- Three MacTeX, three tikztosvg, and three TikZKit renders: successful.
- The broad `test/pgfplots-seams.test.js` baseline and current runs both have
  187 passed and the same 36 pre-existing failures; this slice adds no failure.
