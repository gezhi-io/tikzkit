# arrows.spaced triangle QA (2026-09-04)

## Scope

This slice implements the twelve names declared by the local `arrows.spaced` library:

- `spaced triangle 90/60/45` and each `reversed` form
- `spaced open triangle 90/60/45` and each `reversed` form

The acceptance boundary covers start and end terminals, active line width, straight and orthogonal paths, bidirectional paths, and curved terminal tangents. Spaced angles, hooks, shapes, brackets, and `spaced serif cm` remain outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.spaced.code.tex`: all twelve names use `\pgfarrowsdeclarecombine*` to assemble the corresponding legacy triangle and `space` with zero separation.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`: filled 90/60/45 triangles use source-specific paths and `fillstroke`; open triangles use `stroke`; open reversed forms are independent declarations with asymmetric extents.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`: `space` paints nothing, has backend zero, and has tip end `0.88pt + 0.3 * \pgflinewidth`.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`: records the compatibility names and explains that spacing tips keep arrowheads from touching a line endpoint.

The implementation therefore reuses `legacyTriangleArrowMetrics` and `legacyTriangleInlineGeometry`; only placement, terminal placement, and assembly length gain the source-defined invisible space.

## Reference tools and artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- QA root: `outputs/qa/2026-09-04-arrows-spaced-triangles`
- TikZKit: `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- tikztosvg: `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- MacTeX: `mactex-png/`
- Four-panel sheets and differences: `sheets/` and `diff/`

The tikztosvg SVG uses polygonal `path` elements with butt caps and miter joins. Filled tips carry both fill and stroke; open tips carry `fill=none`. Transforms place the same local triangle path on the final straight, orthogonal, or Bezier tangent. TikZKit now emits the same structure and paint decisions through renderer-neutral metrics.

## Visual acceptance

- `arrows-spaced-triangles-flowchart`: the 90/60/45 filled tips, orthogonal open 60 tip, and curved bidirectional open 45 tips match the reference in aperture, endpoint gap, orientation, color, and dash behavior.
- `arrows-spaced-triangles-math`: all open terminals and the curved filled reversed pair align with tikztosvg and MacTeX; fixed object boxes isolate arrow behavior from unrelated circle text sizing.
- `arrows-spaced-triangles-physics`: force, normal, weight, friction, and torque terminals match on vertical, horizontal, diagonal, and curved paths.

Before this change the twelve names had no dedicated normalization or geometry path and could fall through to a generic terminal. After the change their exact PGF triangle geometry remains unchanged while the visible tip is separated from the endpoint by the active-line-width space. All three fixtures render with zero diagnostics. Remaining visible differences are text rasterization and a one-to-two-pixel canvas-height rounding, not arrow geometry.

## Semantic coverage

Every dependency, command, environment, option, variable, literal number, and expression in the three fixtures is recorded in its adjacent `.review.json`. Strict semantic audits report no TODOs or blockers.
