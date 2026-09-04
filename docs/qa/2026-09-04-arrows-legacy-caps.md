# Legacy Cap Arrow Tips QA

## Scope

- Library: `arrows` (`partial`; 109 registered cases after this slice).
- Accepted slice: `round cap`, `butt cap`, `triangle 90 cap`, `triangle 90 cap reversed`, `fast cap`, and `fast cap reversed`.
- Shared capability: active-line-width geometry, stroke-only versus fill-only paint, backend/tip-end shortening, start/end parsing, bounds, and terminal-tangent placement on straight, orthogonal, and curved paths.
- Out of scope: spaced cap aliases, `implies`, arbitrary declared-arrow programs, and capitalized arrows.meta `Round Cap`, `Butt Cap`, `Triangle Cap`, `Fast Triangle`, and `Fast Round` parameters.

This slice was selected because the parser retained the lowercase names but the renderer had no matching geometry. All six therefore appeared as plain line endings. The implementation is source-derived and shared; no fixture-specific coordinates enter the renderer.

## Local PGF review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`, especially lines 806-952.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`, for arrow declaration extents, shaft assembly, and reversal.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`, especially lines 217-228.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex` and `tikzlibrarypositioning.code.tex`, for path, label, node, and positioning order.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgf/frontendlayer/tikz.sty` and `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx`, for package and document-shell behavior.

Implementation findings:

- `round cap` strokes `M(0,0) L(.5L,0)` with round line caps. Its backend is `0`, tip end is `L`, and assembly length is `L`.
- `butt cap` strokes `M(-.1L,0) L(.5L,0)` with butt caps. Its backend is `-.1L`, tip end is `.5L`, and assembly length is `.6L`.
- `triangle 90 cap` fill-only path is `(-.1L,+.5L) -> (.5L,+.5L) -> (L,0) -> (.5L,-.5L) -> (-.1L,-.5L)`.
- `triangle 90 cap reversed` is an independently declared concave polygon: `(L,+.5L) -> (-.1L,+.5L) -> (-.1L,-.5L) -> (L,-.5L) -> (.5L,0)`. It is not a generic marker rotation.
- `fast cap` and `fast cap reversed` each fill two source-defined chevron polygons. Backend is `-.1L`, tip end is `2L`, and assembly length is `2.1L`.
- At `.8pt`, the source values are: round assembly `.8pt`; butt backend `-.08pt`, tip end `.4pt`, assembly `.48pt`; triangle tip end `.8pt`, half-height `.4pt`, assembly `.88pt`; fast tip end `1.6pt`, assembly `1.68pt`.
- Lowercase legacy caps must remain distinct from capitalized arrows.meta tips after the intermediate representation is normalized.

## Reference renderers

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- MacTeX engine: `/Library/TeX/texbin/pdflatex`.
- Probe sources: `/private/tmp/tikzkit-legacy-caps-probe.tex` and `/private/tmp/tikzkit-legacy-caps-snippet.tex`.
- Probe artifacts: `/private/tmp/tikzkit-legacy-caps-probe.pdf`, `/private/tmp/tikzkit-legacy-caps-probe.svg`, `/private/tmp/tikzkit-legacy-caps-probe-native.png`, `/private/tmp/tikzkit-legacy-caps-probe-tikztosvg.png`, `/private/tmp/tikzkit-legacy-caps-before.svg`, and `/private/tmp/tikzkit-legacy-caps-after.svg`.
- Final case artifacts: `outputs/qa-arrows-legacy-caps-2026-09-04-after/`.
- The final directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG and input, MacTeX PNG/log, 1cm-grid variants, raster diffs, summaries, and four-panel native sheets for all three cases.

The tikztosvg probe uses `stroke-width="0.79701"`; round and butt cap markers are stroke-only, while triangle and fast markers use nonzero fill paths with no stroke. Marker transforms follow the final path tangent, and the path coordinates agree with the installed PGF declarations. MacTeX and tikztosvg agree on the six terminal shapes. TikZKit now emits equivalent local paths and transforms while retaining renderer-neutral text.

The standalone tikztosvg process produced a valid SVG before reporting its known local cleanup failure: its `rm` command attempted to remove a temporary directory without recursion. The fixture pipeline preserved and rasterized all three valid outputs, so the cleanup issue did not block visual comparison.

## Visual cases

### `arrows-legacy-caps-flowchart`

- Commands/environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `document`, `tikzpicture`, five `\node`, and six `\draw` commands.
- Picture/node options: two-axis `node distance=1.35cm and 1.8cm`; `stage/.style` with `draw`, `rounded corners=2pt`, `minimum width=2.1cm`, `minimum height=8mm`, `align=center`; `right=of`, `below=of`, and five percentage fills.
- Path options: all six cap names at `line width=2pt`; six colors; `--`, `-|`, and `to[bend right=13]`; labels using `above`, `right`, `below`, and `sloped`.
- Numeric semantics: border `4pt`, distances `1.35cm` and `1.8cm`, node size `2.1cm` by `8mm`, corner radius `2pt`, line width `2pt`, bend `13`, and all color percentages.
- Before: every route ended as an ordinary shaft, so the cap family was visually absent.
- After: all six terminals are visible; retry remains orthogonal, override follows its cubic tangent, and node placement is unchanged. MacTeX, tikztosvg, and TikZKit show the same route topology and cap orientation.

### `arrows-legacy-caps-math`

- Commands/environments: document shell, `tikzpicture`, four circular `\node` commands, and six `\draw` map commands.
- Picture/node options: `node distance=1.6cm and 2.45cm`; `obj/.style={draw,circle,minimum size=9mm,inner sep=1pt}`; `right=of`, `below=of`, and percentage fills.
- Path options: all six cap names at `line width=2pt`; horizontal, vertical, and curved maps; `bend left=24`, `bend right=22`; labels with `above`, `below`, `left`, `right`, and `sloped`.
- Numeric semantics: border `4pt`, distances `1.6cm` and `2.45cm`, diameter `9mm`, inner separation `1pt`, line width `2pt`, bends `22` and `24`, and color percentages.
- Before: `f`, `g`, `p`, `q`, `h`, and `k` differed only by line color and direction because their caps were absent.
- After: round/butt strokes and four filled polygon terminals remain distinct after horizontal, vertical, and curved tangent transforms. The independently declared reversed notch and double-chevron geometry matches the two local references.

### `arrows-legacy-caps-physics`

- Commands/environments: document shell, `tikzpicture`, eight `\draw` commands, one `\fill`, a circular origin marker, and vector/math labels.
- Path options: gray axes; all six cap names at `line width=2pt`; six colors; one `to[bend left=18]`; terminal labels using `above right`, `above left`, `below left`, `below right`, and `right`.
- Numeric semantics: border `4pt`, origin radius `2pt`, bend `18`, all axis/vector coordinates, line width `2pt`, and color percentages.
- Before: force, momentum, energy, displacement, and trajectory lines had plain ends.
- After: diagonal force/vector caps preserve the requested source polygon orientation; the horizontal fast cap has both chevrons; the curved reversed fast cap follows the trajectory tangent. Axis and origin geometry remain unchanged.

## Visual result

- All three native sheets were inspected directly in four-panel form: MacTeX, tikztosvg, TikZKit, and diff.
- The visible improvement is six previously missing terminal objects with correct shape, paint, tangent orientation, and shaft shortening.
- Remaining differences are browser text glyph metrics, antialiasing, and 1-3 raster pixels of overall height rather than missing cap geometry.
- Auxiliary TikZKit-to-tikztosvg mean absolute RGBA values are `0.025716` for flowchart, `0.034420` for math, and `0.020170` for physics. These values are recorded only as supporting evidence; visual geometry is the acceptance criterion.

## Validation

- TikZKit, tikztosvg, and MacTeX rendered 3/3 cases; TikZKit diagnostics are empty for all three.
- Focused tests verify six canonical legacy kinds, capitalized arrows.meta separation, exact `.8pt` metrics, start/end parsing, eight SVG cap paths, paint, line caps, bounds, and reversed geometry. All arrow test files pass 27/27.
- Strict semantic review covers every dependency, command, environment, option, and numeric literal in the three fixtures.
- Shared options/library tests pass 12/12 and semantic-audit tests pass 14/14.
- The complete renderer file remains at its pre-existing 179/191 baseline. Its 12 failures are unchanged text, shading, endpoint-placement, and arrows.meta assertions; this slice adds no renderer regression.
- `npm pack --dry-run --json` succeeds with 444 package entries, and `git diff --check` is clean.

## Remaining work

- Implement the spaced cap aliases as a separate sequence-spacing slice.
- Implement the legacy `implies` declaration separately.
- Keep general browser font and bbox calibration separate from this arrow geometry slice.
