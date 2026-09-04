# arrows.spaced hook QA (2026-09-04)

## Scope

This slice implements `spaced left hook`, `spaced right hook`, `spaced hooks`, and their three `reversed` forms. The acceptance boundary covers start and end terminals, active line width, one-sided and double-sided hooks, straight and orthogonal paths, bidirectional paths, and curved terminal tangents. Spaced shapes, brackets, and `spaced serif cm` remain outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex`: each public spaced hook uses `\pgfarrowsdeclarecombine*` to append `space` to the matching visible hook with zero separation.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`: hook unit is `0.4pt + 0.2 * line width`; backend is `-0.5 * line width`; tip end is `3.75 * unit + 0.5 * line width`. The two cubic sections use the exact factors `0.75`, `1.665`, `2.415`, `3`, `3.75`, `4.665`, and `6`. Left and right hooks select opposite vertical sides, `hooks` paints both, and reversed declarations mirror x only.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`: `space` paints nothing and contributes `0.88pt + 0.3 * line width` to the tip end.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`: records the compatibility names and spacing purpose.

TikZKit therefore reuses `legacyHookArrowMetrics` and `legacyHookInlineGeometry`. Only placement, terminal placement, and assembly length gain the invisible space component.

## Reference tools and artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- QA root: `outputs/qa/2026-09-04-arrows-spaced-hooks`
- TikZKit: `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- tikztosvg: `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- MacTeX: `mactex-png/`
- Three-way sheets and TikZKit-to-MacTeX differences: `sheets/` and `diff/`

The tikztosvg SVG represents hooks as open cubic paths with no fill, round caps, miter joins, and transforms aligned to each terminal tangent. TikZKit emits the same local cubic topology and paint properties while preserving the source endpoint gap.

## Visual acceptance

- `arrows-spaced-hooks-flowchart`: one-sided horizontal hooks, the double hook on a vertical rejection path, the reversed orthogonal retry, and the curved bidirectional trace are compared against both references.
- `arrows-spaced-hooks-math`: the quotient-map square covers horizontal, vertical, start/end, reversed, double-sided, and curved hook placement around fixed formula boxes.
- `arrows-spaced-hooks-physics`: normal, weight, diagonal force, reversed tension, and curved impulse vectors cover the principal tangent orientations.

Before this change, spaced hook names could be split or normalized as ordinary hook tips and omitted the source spacing component. After the change, all six names retain their exact hook geometry and add only the active-line-width space to the assembly. All three fixtures render with zero diagnostics. Browser and three-way sheet inspection confirmed matching endpoint gaps, tangent directions, round caps, miter joins, and one- versus two-sided cubic topology. Remaining raster differences are limited to font anti-aliasing and one-to-four-pixel canvas rounding.

## Semantic coverage

Every dependency, command, environment, option, variable, literal number, and expression in the three fixtures is covered by the adjacent `.review.json` and strict semantic audit.
