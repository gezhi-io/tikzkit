# arrows.spaced delimiter QA (2026-09-04)

## Scope

This slice implements `spaced [`, `spaced ]`, `spaced (`, `spaced )`, and `spaced |`, including the five paired shorthands declared by PGF. The acceptance boundary covers normal and reversed terminals, active line width, straight and orthogonal paths, bidirectional paths, and curved terminal tangents. Spaced shapes and `spaced serif cm` remain outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex`: round delimiters and the bar use starred combinations with `space`; the square-bracket pairs are public `means` aliases for `square bracket[].space` and its reversed counterpart.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`: square brackets use half-height `2pt + 1.5 * line width`, arm length `0.5 * (half-height + line width)`, backend `-(1pt + 1.25 * line width)`, tip end `0.5 * line width`, butt caps, and miter joins. Round brackets use the same half-height, backend `-0.5 * half-height - 0.5 * line width`, tip end `0.0625 * half-height + 0.5 * line width`, and a cubic path with round caps.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`: `@bar` uses backend `-0.25 * line width`, tip end `0.75 * line width`, a vertical path at `0.25 * line width`, half-height `2pt + 1.5 * line width`, and a rectangular cap. `space` paints nothing and contributes `0.88pt + 0.3 * line width`.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`: documents the spaced delimiter compatibility names and their endpoint-spacing purpose.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/utilities/pgffor.code.tex`: the mathematical fixture's tick loop expands an explicit list and binds the loop variable for each tick.

TikZKit reuses the reviewed visible delimiter geometry and adds the invisible space only to placement, terminal placement, and assembly length. Ordinary `|` is now normalized to the same source `@bar` geometry instead of a fixed generic delimiter.

## Reference tools and artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- QA root: `outputs/qa/2026-09-04-arrows-spaced-delimiters`
- TikZKit: `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- tikztosvg: `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- MacTeX: `mactex-png/`
- Four-way sheets and raster differences: `diff/*-native-sheet.png` and `diff-png/`

The tikztosvg SVG paints square brackets as open three-segment paths with butt caps, round brackets as open cubic paths with round caps, and bars as vertical stroked segments. Each tip has the active path stroke width and a transform aligned to its terminal tangent. TikZKit emits the same topology and paint properties.

## Visual acceptance

- `arrows-spaced-delimiters-flowchart`: all five paired shorthands are visible. Horizontal square and round brackets, vertical bars, reversed brackets on an orthogonal route, and curved reversed parentheses agree with MacTeX and tikztosvg in orientation, endpoint gap, cap, join, and line width.
- `arrows-spaced-delimiters-math`: closed and open interval ends, an absolute-value bar pair, and curved domain/codomain delimiters retain the correct direction and active line width. No terminal is parsed as path syntax or omitted.
- `arrows-spaced-delimiters-physics`: measurement brackets and bars remain perpendicular to horizontal, vertical, diagonal, and curved terminal tangents. The visible delimiter geometry is unchanged by the appended invisible space.

Before this change, the paired spaced names were not parsed as complete arrow specifications, and ordinary bars used a fixed generic geometry. After the change, all five source aliases render with zero diagnostics. TikZKit raster dimensions are 417x126, 308x92, and 228x109; MacTeX dimensions are 417x128, 306x96, and 225x109. Direct inspection attributes the remaining edge differences to two-to-four-pixel canvas rounding and text rasterization rather than missing or misplaced arrow geometry.

## Semantic coverage

Every dependency, command, environment, option, loop declaration, literal number, and expression in the three fixtures is covered by the adjacent `.review.json` and strict semantic audit.
