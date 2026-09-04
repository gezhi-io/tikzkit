# arrows.spaced angle QA (2026-09-04)

## Scope

This slice implements the six angle names declared by the local `arrows.spaced` library:

- `spaced angle 90`, `spaced angle 60`, and `spaced angle 45`
- `spaced angle 90 reversed`, `spaced angle 60 reversed`, and `spaced angle 45 reversed`

The acceptance boundary covers start and end terminals, active line width, straight and orthogonal paths, bidirectional paths, and curved terminal tangents. Spaced hooks, shapes, brackets, and `spaced serif cm` remain outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex`: all six names use `\pgfarrowsdeclarecombine*` to assemble the corresponding legacy angle and `space` with zero separation.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`: angle 90 uses unit `0.3pt + 0.25 * line width`, backend `-5.5 * unit - 0.5 * line width`, and tip end `0.5 * unit + 0.707 * line width`; angle 60 uses backend `-7.29 * unit - 0.5 * line width` and tip end `0.5 * unit + line width`; angle 45 uses backend `-8.705 * unit - 0.5 * line width` and tip end `0.5 * unit + 1.28 * line width`. All three are open stroked paths with round caps and miter joins, and the reversed forms reuse the visible geometry in the opposite direction.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`: `space` paints nothing, has backend zero, and has tip end `0.88pt + 0.3 * line width`.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`: documents the public compatibility names and the role of invisible spacing tips.

The implementation therefore reuses the legacy delimiter geometry and adds the source-defined invisible `space` only to placement, terminal placement, and assembly length. The visible V path is not enlarged or shifted independently.

## Reference tools and artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- QA root: `outputs/qa/2026-09-04-arrows-spaced-angles`
- TikZKit: `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- tikztosvg: `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- MacTeX: `mactex-png/`
- Three-way sheets and TikZKit-to-MacTeX differences: `sheets/` and `diff/`

The tikztosvg SVG represents each tip as `fill="none"` path data with `stroke-linecap="round"` and `stroke-linejoin="miter"`. For example, its angle 90 path is a three-point open V, while angle 60 and angle 45 use progressively narrower source apertures. Per-tip transforms align those local paths with horizontal, vertical, orthogonal, and Bezier endpoint tangents. TikZKit now emits the same path structure, paint mode, cap, join, and tangent transform.

## Visual acceptance

- `arrows-spaced-angles-flowchart`: the horizontal 90/60 tips, vertical 45 tip, reversed orthogonal retry tip, and curved bidirectional 45 tips match the reference in aperture, endpoint gap, orientation, color, and dash behavior.
- `arrows-spaced-angles-math`: start and end terminals on the quotient diagram match on horizontal, vertical, and curved maps; formulas, fixed boxes, and edge labels retain their reference positions.
- `arrows-spaced-angles-physics`: normal force, weight, diagonal force, reversed tension, and curved momentum terminals match across vertical, diagonal, and curved paths.

Before this change the six source names had no dedicated normalization or metrics and could fall through to generic arrow behavior. After the change, exact PGF angle geometry is preserved while the invisible `space` extends the assembly using the active line width. All three fixtures render with zero diagnostics. The remaining differences are one-to-four-pixel canvas rounding and font anti-aliasing, not missing geometry or misplaced terminals.

## Semantic coverage

Every dependency, command, environment, option, variable, literal number, and expression in the three fixtures is recorded in its adjacent `.review.json`. Strict semantic audits report no TODOs or blockers.
